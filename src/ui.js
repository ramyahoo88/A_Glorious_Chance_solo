/* ============================================================================
   User interface (vanilla DOM). Renders the game state and the pending prompt.
   ========================================================================== */
const SAVE_KEY = 'agc_solo_companion_v1';
let G_STATE = null;          // current game state
let UNDO = [];               // JSON snapshots
let UI = { err: '', local: null, localFor: null, showLogAll: false, logFilter: 'all', logSearch: '' };

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    const v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
  return e;
}
function $(id) { return document.getElementById(id); }
function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); }
function esc(t) { return String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }

/* ---------- persistence ---------- */
const UNDO_LIMIT = 60;
// Ship records and log entries recur across snapshots. Intern the exact text
// between object separators; joining the pieces reproduces even the original
// whitespace and key order. The current state stays independently readable.
function autosaveText(count) {
  const history = count ? UNDO.slice(-count) : [];
  if (!history.length) return JSON.stringify({ state: G_STATE, undo: [] });
  const parts = [], indices = new Map();
  // Index newest first: including an older snapshot only grows the encoding.
  const rows = history.reverse().map(snapshot => snapshot.split('},').map(part => {
    if (!indices.has(part)) { indices.set(part, parts.length); parts.push(part); }
    return indices.get(part);
  })).reverse();
  const packed = JSON.stringify({ state: G_STATE, packedUndo: { parts, rows } });
  if (count === 1) {
    const single = JSON.stringify({ state: G_STATE, undo: history });
    if (single.length < packed.length) return single;
  }
  return packed;
}
function autosave() {
  if (!G_STATE) return;
  if (UNDO.length > UNDO_LIMIT) UNDO.splice(0, UNDO.length - UNDO_LIMIT);
  const write = count => localStorage.setItem(SAVE_KEY, autosaveText(count));
  UI.savedUndoCount = null;
  try { write(UNDO.length); UI.saveFailed = false; return; }
  catch (e) {
    UI.saveFailed = true;
    if (!UNDO.length || !e || (e.name !== 'QuotaExceededError' && e.name !== 'NS_ERROR_DOM_QUOTA_REACHED' && e.code !== 22 && e.code !== 1014)) return;
  }
  // Preserve the current move first. setItem is atomic: a rejected larger
  // attempt leaves the last successful write intact.
  try { write(0); } catch (e) { return; }
  UI.saveFailed = false;
  let low = 0, high = UNDO.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    try { write(mid); low = mid; } catch (e) { high = mid - 1; }
  }
  UI.savedUndoCount = low;
}
function loadSaved() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if (raw === null) return null;
  let saved;
  try { saved = JSON.parse(raw); } catch (e) { return { unreadable: true }; }
  if (!saved || !saved.state || typeof saved.state !== 'object' || Array.isArray(saved.state)) return { unreadable: true };
  const packed = saved.packedUndo;
  if (packed && Array.isArray(packed.rows) && Array.isArray(packed.parts)) {
    saved.undo = packed.rows.slice(-UNDO_LIMIT).map(row => {
      if (!Array.isArray(row) || !row.every(i => Number.isInteger(i) && i >= 0 && typeof packed.parts[i] === 'string')) return '';
      return row.map(i => packed.parts[i]).join('},');
    });
  }
  return saved;
}
function doAct(answer) {
  if (!G_STATE || !G_STATE.prompt) return;
  const snap = JSON.stringify(G_STATE);
  try {
    playTableAction(G_STATE, answer);
    UNDO.push(snap); if (UNDO.length > 60) UNDO.shift();
    UI.err = ''; UI.local = null;
  } catch (e) {
    G_STATE = JSON.parse(snap);
    UI.err = e.message || String(e);
    console.error(e);
  }
  autosave(); render();
  revealPromptStart();
}
function revealPromptStart() {
  const p = $('proc'); if (!p) return;
  p.scrollTop = 0;
  const title = p.querySelector('.ptitle') || p, bounds = title.getBoundingClientRect();
  const header = $('hdr'), headerPosition = header && getComputedStyle(header).position;
  const top = header && (headerPosition === 'sticky' || headerPosition === 'fixed') ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  // On phones the document scrolls, rather than the procedure panel. Reveal a
  // new prompt only when its title is outside the unobscured viewport.
  if ((bounds.top < top || bounds.bottom > window.innerHeight) && typeof p.scrollIntoView === 'function') {
    p.style.scrollMarginTop = `${top + 8}px`;
    p.scrollIntoView({ block: 'start', inline: 'nearest' });
  }
}
function undo() {
  if (!UNDO.length) return;
  const before = G_STATE, draft = UI.local, draftFor = UI.localFor;
  let skipped = 0;
  while (UNDO.length) {
    const snapshot = UNDO.pop();
    try {
      G_STATE = checkSaveState(JSON.parse(snapshot));
      recordEventUndo(before, G_STATE);
      UI.local = null;
      UI.err = UI.loadNotes.filter(n => !(G_STATE.recovery || []).includes(n)).join(' ');
      if (skipped) UI.err += ' An unreadable Undo position was skipped.';
      render();
      break;
    } catch (e) {
      G_STATE = before; UI.local = draft; UI.localFor = draftFor;
      skipped++;
    }
  }
  if (G_STATE === before) UI.err = 'The saved Undo history could not be read. Your current position is still open.';
  autosave(); render();
}
// The player has read an unresolved-recovery notice and chooses to keep playing this position
function acknowledgeRecovery() { if (!G_STATE) return; delete G_STATE.recovery; autosave(); render(); }
function recoveryBanner(s) {
  if (!s.recovery || !s.recovery.length) return null;
  return el('div', { class: 'banner recovery' },
    el('b', null, 'This game needs an earlier save. '), s.recovery.join(' '), el('br'),
    el('button', { onclick: () => importSave() }, 'Load an earlier save'), ' ',
    el('button', { onclick: () => acknowledgeRecovery() }, 'Keep playing this position'));
}
function startGame(human, seed, opts) {
  G_STATE = newGame(human, seed, opts);
  enablePhysicalEvents(G_STATE);
  UNDO = []; UI.local = null; UI.localFor = null; UI.err = '';
  run(G_STATE);
  autosave(); render();
}
function saveText() { return JSON.stringify({ state: G_STATE, undo: [] }); }
function checkSavedCards(st, bad) {
  const event = (id, field) => { if (!Number.isInteger(id) || !Object.hasOwn(EVENTS, id)) bad(field + ': unknown Event card'); };
  const target = (id, field) => {
    if (typeof id !== 'string' || !Object.hasOwn(TARGET_CARDS, id) || TARGET_CARDS[id].deck !== (st.human === 'US' ? 'A' : 'B'))
      bad(field + ': unknown or wrong-campaign Target card');
  };
  const tactic = (id, deck, field) => {
    if (typeof id !== 'string' || !Object.hasOwn(TACTIC_BY_ID, id) || TACTIC_BY_ID[id].deck !== deck)
      bad(field + ': unknown or wrong-deck Tactic card');
  };
  const list = (items, field, check) => {
    if (!Array.isArray(items)) bad(field + ': expected a card list');
    items.forEach((id, i) => check(id, `${field}[${i}]`));
  };
  list(st.deck.event, 'deck.event', event);
  if (new Set(st.deck.event).size !== st.deck.event.length) bad('duplicate Event cards in draw pile');
  list(st.deck.target, 'deck.target', target);
  for (const deck of ['A', 'D']) list(st.deck['tac' + deck], 'deck.tac' + deck, (id, field) => tactic(id, deck, field));
  list(st.targetRow, 'targetRow', (card, field) => target(card && card.id, field));
  list(st.eventsDrawn, 'eventsDrawn', (card, field) => event(card && card.id, field));
  for (const z of ZONES) if (st.zones[z].event != null) event(st.zones[z].event, `zones.${z}.event`);
  for (const side of ['US', 'BR']) if (st.intelligence[side] != null) event(st.intelligence[side].card, `intelligence.${side}`);
  if (st.encounter && st.encounter.wgCard != null) event(st.encounter.wgCard, 'encounter.wgCard');
  if (st.prompt) {
    if (st.prompt.eventCard != null) event(st.prompt.eventCard, 'prompt.eventCard');
    if (st.prompt.targetCard != null) target(st.prompt.targetCard, 'prompt.targetCard');
    if (st.prompt.tactic) {
      if (!st.combat) bad('Tactics decision without combat');
      const deck = st.combat.att === st.human ? 'A' : 'D';
      list(st.prompt.options, 'prompt.options', (option, field) => tactic(option && option.id, deck, field));
    }
  }
  if (st.combat && st.combat.tac) for (const [role, deck] of [['att', 'A'], ['def', 'D']]) {
    const card = st.combat.tac[role];
    if (card != null) tactic(card.id, deck, `combat.tac.${role}`);
  }
  for (const fr of Object.values(st.forces)) if (fr.cardId != null) target(fr.cardId, 'Force cardId');
  for (const fr of st.calls) {
    const loc = fr.L || {};
    if (fr.proc === 'aiDeploy' && loc.card != null) target(loc.card, 'deployment Target card');
    if (fr.proc === 'encounter' && loc.ev != null) event(loc.ev, 'Encounter Event card');
    if (fr.proc === 'combat' && loc.hDrawn != null) {
      if (!['A', 'D'].includes(loc.hDeck)) bad('pending Tactic deck');
      list(loc.hDrawn, 'pending Tactics', (id, field) => tactic(id, loc.hDeck, field));
    }
  }
}
// An Event child can return only to these six saved callers. Check their live
// context before import commits anything; a well-shaped child alone is not enough.
function checkPendingEvent(st, bad) {
  const child = st.calls.at(-1), parent = st.calls.at(-2), p = st.prompt;
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const strings = xs => Array.isArray(xs) && xs.every(x => typeof x === 'string');
  const force = (id, side, zone) => {
    const fr = st.forces[id];
    return obj(fr) && fr.id === id && fr.side === side && fr.zone === zone &&
      ZONES.includes(zone) && Array.isArray(fr.ships) && fr.ships.every(id => st.ships[id]);
  };
  const encounter = () => {
    const e = st.encounter;
    return obj(e) && ZONES.includes(e.zone) && obj(e.ships) && obj(e.side) && obj(e.withdrawn) &&
      ['patrol', 'reaction'].includes(e.segment) &&
      Object.keys(e.ships).every(id => st.ships[id] && ['US', 'BR'].includes(e.side[id])) &&
      ['US', 'BR'].every(sd => typeof e.withdrawn[sd] === 'boolean');
  };
  if (!child || child.proc !== 'eventDraw' || child.pc !== 'number' || !obj(child.A) ||
      typeof child.A.purpose !== 'string' || typeof child.A.allowGale !== 'boolean' ||
      (child.L.gale != null && typeof child.L.gale !== 'boolean') ||
      p.purpose !== child.A.purpose || p.allowGale !== child.A.allowGale ||
      !Array.isArray(st.deck.event) || !st.deck.event.length || p.remaining !== st.deck.event.length || !parent)
    bad('pending physical Event draw');
  let purpose, allowGale = false;
  const loc = parent.L;
  switch (parent.proc + '.' + parent.pc) {
    case 'turn.B2event': {
      if (!st.pe.every(pe => obj(pe))) bad('pending Event Encounter Check');
      const pe = st.pe.find(pe => pe.status === 'possible');
      if (!pe || !Number.isInteger(pe.num) || !Number.isInteger(pe.idx) || !st.targetRow[pe.idx] ||
          !Object.hasOwn(TARGET_CARDS, st.targetRow[pe.idx].id) || TARGET_CARDS[st.targetRow[pe.idx].id].zone !== pe.zone ||
          !force(pe.forceId, st.human, pe.zone) || !st.forces[pe.forceId].ships.length)
        bad('pending Event Encounter Check');
      purpose = `Encounter Check PE${pe.num}`;
      break;
    }
    case 'encounter.eventEntered':
    case 'encounter.reactionEvent': {
      if (!encounter() || !obj(parent.A) || parent.A.zone !== st.encounter.zone) bad('pending Event Encounter');
      const e = st.encounter;
      if (parent.pc === 'reactionEvent') {
        if (!strings(loc.reactionLines) || e.segment !== 'reaction') bad('pending Event Reaction results');
        purpose = `Reaction Segment Weather Gage (${ZONE_NAME[e.zone]})`;
      } else {
        const fresh = !st.zones[e.zone].event;
        purpose = `Encounter ${ZONE_NAME[e.zone]} (Weather Gage${fresh ? ' + Lake Zone Event' : ''})`;
        allowGale = fresh && st.phase === 'lake';
      }
      break;
    }
    case 'combat.wgEvent': {
      const c = st.combat;
      const ids = xs => Array.isArray(xs) && xs.every(id => id === null || st.ships[id]);
      if (!encounter() || !obj(c) || !['US', 'BR'].includes(c.att) || c.def !== OTHER[c.att] ||
          !Object.hasOwn(SEQ_STEPS, c.seq) || !Number.isInteger(c.pos) || SEQ_STEPS[c.seq][c.pos] !== 'WG' ||
          !obj(c.col) || !ids(c.col.US) || !ids(c.col.BR) || !obj(c.tows) || !obj(c.tac) ||
          !['patrol', 'reaction'].includes(c.segment)) bad('pending Event combat Weather Gage');
      purpose = 'Weather Gage recheck';
      break;
    }
    case 'coastal.raidEvent':
    case 'coastal.asBattleEvent': {
      const queue = (ids, mission) => strings(ids) && new Set(ids).size === ids.length &&
        ids.every(id => !st.forces[id] || (st.forces[id].side === loc.side && st.forces[id].mission === mission));
      if (st.phase !== 'coastal' || !Array.isArray(loc.order) || loc.order.length !== 2 ||
          loc.order[0] !== st.ai || loc.order[1] !== st.human || !Number.isInteger(loc.si) ||
          loc.si < 0 || loc.si > 1 || loc.side !== loc.order[loc.si] ||
          !queue(loc.raids, 'Raid') || !queue(loc.as, 'ArmySupport') || !obj(st.coastal) ||
          !['raids', 'battles', 'cutouts'].every(k => Array.isArray(st.coastal[k]))) bad('pending Event coastal phase');
      if (parent.pc === 'raidEvent') {
        const fr = st.forces[loc.raidForce];
        if (!fr || !force(loc.raidForce, loc.side, fr.zone) || !fr.ships.length || fr.mission !== 'Raid') bad('pending Event Raid force');
        purpose = `${SIDE_SHORT[loc.side]} Raid on ${ZONE_NAME[fr.zone]} coastline`;
      } else {
        const cur = loc.cur;
        const battle = item => obj(item) && ZONES.includes(item.z) && strings(item.forces) && item.forces.length > 0 &&
          new Set(item.forces).size === item.forces.length && item.forces.every(fid =>
            st.forces[fid] ? force(fid, loc.side, item.z) : item.troops !== undefined) &&
          (item.troops === undefined || (Number.isInteger(item.troops) && item.troops >= 0));
        if (!Array.isArray(loc.lz) || !loc.lz.every(battle) || !battle(cur) ||
            !Number.isInteger(cur.troops) || loc.troops !== cur.troops ||
            new Set([cur.z, ...loc.lz.map(item => item.z)]).size !== loc.lz.length + 1)
          bad('pending Event Land Battle');
        // A Harbor Encounter can remove a supporting Force after its Troops
        // launched. Those retained IDs are valid; their support is now zero.
        purpose = `${SIDE_SHORT[loc.side]} Land Battle (${ZONE_NAME[cur.z]})`;
      }
      break;
    }
    default: bad('pending Event caller');
  }
  if (child.A.purpose !== purpose || child.A.allowGale !== allowGale) bad('pending Event context');
}
/* Check a loaded save before it replaces anything. Fields added by later versions are filled in from a
   fresh game; anything missing, mistyped or out of range is refused with a message. */
function checkSaveState(st) {
  const bad = what => { throw new Error(`this save is damaged or incomplete (${what}). Your current game was not changed.`); };
  if (!st || typeof st !== 'object' || Array.isArray(st)) throw new Error('this does not look like a Solo Companion save. Your current game was not changed.');
  if (st.human !== 'US' && st.human !== 'BR') bad('campaign side');
  const fresh = newGame(st.human, 1);
  const core = ['ai', 'turn', 'ships', 'zones', 'forces', 'calls', 'vp', 'supply', 'convoys', 'flagship', 'leader', 'troops', 'deck', 'rng'];
  const missing = core.filter(k => !(k in st));
  if (missing.length) bad('missing ' + missing.join(', '));
  if (st.ai !== OTHER[st.human]) bad('A.I. side');
  Object.keys(fresh).forEach(k => { if (!(k in st) && k !== 'build') st[k] = JSON.parse(JSON.stringify(fresh[k])); });   // build: only the save's own
  if (st.options && typeof st.options === 'object' && !Array.isArray(st.options)) {
    const options = st.options;
    st.options = Object.assign(defaultOptions(), options);
    // Grouping is opt-in. A missing preference already has the correct
    // behavior, so preserve the original setting on an older position.
    if (!Object.hasOwn(options, 'groupUpdates')) delete st.options.groupUpdates;
    if (options.physicalEvents != null && typeof options.physicalEvents !== 'boolean') bad('physical Event deck');
  }
  if (st.eventCardsPrepared != null && typeof st.eventCardsPrepared !== 'boolean') bad('physical Event deck preparation');
  Object.keys(fresh).forEach(k => {
    const a = fresh[k], b = st[k];
    if (a === null || (k === 'build' && b === undefined)) return;
    if (b === null || Array.isArray(a) !== Array.isArray(b) || typeof a !== typeof b) bad(`field “${k}”`);
    if (typeof a === 'number' && !Number.isFinite(b)) bad(`field “${k}”`);
  });
  if (!Number.isInteger(st.turn) || st.turn < 0 || st.turn > 8) bad('turn');
  Object.keys(st.ships).forEach(id => { if (!fresh.ships[id]) bad('unknown ship ' + id); });
  Object.keys(fresh.ships).forEach(id => {
    const sh = st.ships[id];
    if (!sh || typeof sh !== 'object' || sh.id !== id || BOXES.indexOf(sh.box) < 0 || (sh.owner !== 'US' && sh.owner !== 'BR')) bad('ship ' + id);
    let d = null; try { d = def(sh); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.full)) bad('ship ' + id + ' version');
    if (!Number.isInteger(sh.steps) || sh.steps < 0 || sh.steps > d.full[4]) bad(`ship ${id} steps`);
    if (sh.delay != null && (!Number.isInteger(sh.delay) || sh.delay < 0)) bad(`ship ${id} repair delay`);
    if (sh.box === 'lake' && ZONES.indexOf(sh.zone) < 0) bad(`ship ${id} zone`);
    if (!sh.flags || typeof sh.flags !== 'object') sh.flags = {};
  });
  ZONES.forEach(z => { if (!st.zones[z] || typeof st.zones[z] !== 'object') bad('zone ' + z); if (!st.zones[z].flags) st.zones[z].flags = {}; });
  ['US', 'BR'].forEach(sd => {
    ['vp', 'cd'].forEach(k => { if (!Number.isInteger(st[k][sd])) bad(`${k} ${sd}`); });
    if (!Number.isInteger(st.supply[sd]) || st.supply[sd] < SUPPLY_MIN || st.supply[sd] > SUPPLY_MAX) bad(`Convoy Supply ${sd}`);
    if (st.cd[sd] < 0) bad(`Construction Delay ${sd}`);
    if (!st.troops[sd] || !Number.isInteger(st.troops[sd].available) || st.troops[sd].available < 0 || !Array.isArray(st.troops[sd].track)) bad('Troops');
    if (!st.leader[sd] || !st.ships[st.flagship[sd]]) bad('Flagship / Leader');
  });
  Object.values(st.forces).forEach(fr => {
    if (!fr || !Array.isArray(fr.ships) || fr.ships.some(id => !st.ships[id]) || (fr.troops != null && (!Number.isInteger(fr.troops) || fr.troops < 0))) bad('a Force');
  });
  const humanTroops = st.troops[st.human];
  const returning = st.troopsReturning && st.troopsReturning[st.human] != null ? st.troopsReturning[st.human] : 0;
  const embarked = Object.values(st.forces).filter(f => f.side === st.human).reduce((n, f) => n + (f.troops || 0), 0);
  if (!Number.isInteger(returning) || returning < 0 ||
      humanTroops.track.some(n => !Number.isInteger(n) || n < 2 || n > 8) || new Set(humanTroops.track).size !== humanTroops.track.length ||
      humanTroops.available + humanTroops.track.length + returning + embarked > 3) bad('human Troops markers');
  if (!Number.isInteger(st.niagara) || st.niagara < 0 || st.niagara > 6) bad('Niagara Front');
  if (!Number.isInteger(st.nbBand) || st.nbBand < 0 || st.nbBand >= NB_LABELS.length) bad('Naval Balance');
  st.calls.forEach(fr => {
    if (!fr || typeof fr !== 'object' || !PROCS[fr.proc] || typeof fr.pc !== 'string' || typeof PROCS[fr.proc][fr.pc] !== 'function') bad('procedure stack');
    if (!fr.L || typeof fr.L !== 'object' || Array.isArray(fr.L)) bad('procedure locals');
  });
  if (!st.over && (!st.calls.length || !st.prompt || typeof st.prompt.kind !== 'string' || ['info', 'choice', 'select', 'assign', 'lineup', 'event'].indexOf(st.prompt.kind) < 0)) bad('pending decision');
  if (!st.over && st.calls.some(fr => fr.proc === 'eventDraw') && st.prompt.kind !== 'event') bad('pending physical Event draw');
  if (!st.over) {
    const p = st.prompt;
    const namedItems = items => Array.isArray(items) && items.every(item => item && (typeof item.id === 'string' || Number.isInteger(item.id)));
    if (p.kind === 'event') {
      checkPendingEvent(st, bad);
    } else if (p.kind === 'info' || p.kind === 'choice') {
      if (!namedItems(p.options) || !p.options.some(o => !o.disabled && (p.kind === 'choice' || o.id === 'ok'))) bad('no usable option for the pending decision');
    } else if (p.kind === 'select') {
      const min = p.min == null ? 0 : p.min, max = p.max == null ? Infinity : p.max;
      if (!namedItems(p.items) || !Number.isInteger(min) || min < 0 || min > p.items.length || max < min ||
          (p.max != null && !Number.isInteger(max)) || (p.validate && !Object.hasOwn(SELECT_VALIDATORS, p.validate))) bad('pending selection');
    }
  }
  if (st.over && !st.result) bad('final result');
  if (st.leaderResult != null && (typeof st.leaderResult !== 'object' || Array.isArray(st.leaderResult) || !st.combat ||
      Object.entries(st.leaderResult).some(([side, fate]) => !['US', 'BR'].includes(side) || !['killed', 'captured'].includes(fate)))) bad('pending Leader succession');
  if (st.encounter) {
    const e = st.encounter;
    if (typeof e !== 'object' || ZONES.indexOf(e.zone) < 0 || !e.ships || typeof e.ships !== 'object' || Object.keys(e.ships).some(id => !st.ships[id])) bad('current Encounter');
    if (!e.side) e.side = {};
    if (!e.flagIn) {   // reconstruct a missing participating Flagship in older saves
      for (const id of Object.keys(e.ships)) {
        const side = e.side[id] || st.ships[id].owner;
        if (st.flagship[side] === id) {
          e.flagIn = e.flagIn || {};
          e.flagIn[side] = true;
        }
      }
    }
  }
  checkSavedCards(st, bad);
  if (st.eventRestore != null) {
    const note = st.eventRestore;
    if (!note || typeof note !== 'object' || Array.isArray(note) ||
        !Array.isArray(note.cards) || (!note.cards.length && !note.reshuffled) || note.cards.some(id => !Number.isInteger(id) || !st.deck.event.includes(id)) ||
        new Set(note.cards).size !== note.cards.length || typeof note.reshuffled !== 'boolean') bad('physical Event restoration');
  }
  UI.loadNotes = [];
  upgradeLegacy(st, UI.loadNotes);
  st.build = APP_VERSION;   // checked and upgraded once: later loads of this game leave it alone
  return st;
}
// Replace the current game with a checked save; if it cannot be shown, put the old game back.
function commitLoaded(st, undo, retained) {
  const prevS = G_STATE, prevU = UNDO;
  const prevDraft = UI.local, prevDraftFor = UI.localFor, prevErr = UI.err;
  const loadedUndo = Array.isArray(undo) ? undo.slice(-UNDO_LIMIT).filter(u => typeof u === 'string') : [];
  // keep the previous game reachable: one Undo after loading returns to it (and its own Undo history)
  const prior = prevS || (retained && retained.state);
  const priorUndo = prevS ? prevU : retained && Array.isArray(retained.undo) ? retained.undo.filter(u => typeof u === 'string') : [];
  const keep = prior ? priorUndo.concat([JSON.stringify(prior)]) : [];
  G_STATE = st; UNDO = keep.length ? keep : loadedUndo; UI.local = null; UI.loadNotes = UI.loadNotes || [];
  UI.err = UI.loadNotes.filter(n => !(st.recovery || []).includes(n)).join(' '); UI.loadNotes = [];   // unresolved notices show in their own panel
  try { render(); }
  catch (e) {
    G_STATE = prevS; UNDO = prevU;
    UI.local = prevDraft; UI.localFor = prevDraftFor; UI.err = prevErr;
    try { render(); } catch (e2) { /* ignore */ }
    throw new Error(`this save could not be displayed (${e.message}). Your current game was not changed.`);
  }
  autosave();
  renderHeader(G_STATE);   // autosave can change the storage-warning status after the first render
}
function loadFromText(txt) {
  let d;
  try { d = JSON.parse(txt); } catch (e) { throw new Error('this is not complete save text (it may have been cut off). Your current game was not changed.'); }
  const st = checkSaveState(d && typeof d === 'object' && d.state ? d.state : d);
  let retained = null;
  if (!G_STATE) {
    const saved = loadSaved(), notes = UI.loadNotes;
    // A setup-screen import must be undoable too. Checking the stored copy does not write to storage.
    try { if (saved && saved.state) retained = { state: checkSaveState(saved.state), undo: saved.undo }; }
    catch (e) { /* an unreadable retained game cannot supply a usable Undo position */ }
    finally { UI.loadNotes = notes; }
  }
  commitLoaded(st, [], retained);
  closeModal();
}
function appDownloadControls() {
  const status = el('p', { class: 'muted', role: 'status' });
  const button = el('button', { onclick: () => {
    let url, anchor;
    try {
      url = URL.createObjectURL(new Blob([APP_DOWNLOAD_HTML], { type: 'text/html;charset=utf-8' }));
      anchor = el('a', { href: url, download: `A_Glorious_Chance_Solo_v${APP_VERSION}.html` });
      document.body.appendChild(anchor); anchor.click();
      status.textContent = 'App download started. Open the .html file in your browser to play offline. Use Save separately to keep your current campaign.';
    } catch (e) { status.textContent = 'The app could not be downloaded. Check that your browser allows downloads, then try again.'; }
    finally {
      if (anchor) anchor.remove();
      if (url && typeof URL.revokeObjectURL === 'function') setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } }, 'Download app (.html)');
  return el('div', { class: 'app-download' }, button, status);
}
function exportSave() {
  const box = el('div');
  box.appendChild(el('h2', null, 'Save game'));
  box.appendChild(el('p', null, 'The game also autosaves in this browser. To move it to another device or keep a backup, download the save file or copy the save text.'));
  const msg = el('div', { class: 'muted', role: 'status' });
  const ta = el('textarea', { 'aria-label': 'Text to copy', style: { display: 'none', width: '100%', height: '120px', marginTop: '6px' }, readonly: true });
  ta.value = saveText();
  const copyManually = text => {
    ta.value = text; ta.style.display = 'block'; ta.focus(); ta.select();
    msg.textContent = 'Copy the text below manually (Ctrl/Cmd+C).';
  };
  const filename = `agc-${G_STATE.human}-${TURN_NAMES[Math.min(G_STATE.turn, 7)].replace(' ', '')}-seed${G_STATE.seed}-step${G_STATE.promptSeq || 0}`;
  const download = (text, type, suffix) => {
    let url, anchor;
    try {
      url = URL.createObjectURL(new Blob([text], { type }));
      anchor = el('a', { href: url, download: filename + suffix });
      document.body.appendChild(anchor); anchor.click();
      msg.textContent = 'Download started.';
    } catch (e) { copyManually(text); }
    finally {
      if (anchor) anchor.remove();
      if (url && typeof URL.revokeObjectURL === 'function') setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  box.appendChild(el('div', { class: 'opts' },
    el('button', { class: 'primary', onclick: () => download(saveText(), 'application/json', '.json') }, 'Download .json'),
    el('button', { onclick: async () => {
      try { await navigator.clipboard.writeText(saveText()); msg.textContent = 'Save text copied to the clipboard.'; }
      catch (e) { copyManually(saveText()); }
    } }, 'Copy save text'),
    el('button', { onclick: () => {
      const lines = [`A Glorious Chance · ${SIDE_NAME[G_STATE.human]} campaign · seed ${G_STATE.seed}`, ''];
      for (const entry of G_STATE.log) lines.push(`${TURN_NAMES[Math.min(entry.turn, 7)]} · ${entry.phase} · ${entry.text}`);
      download(lines.join('\n') + '\n', 'text/plain;charset=utf-8', '-log.txt');
    } }, 'Download game log (.txt)')));
  box.appendChild(msg); box.appendChild(ta);
  openModal(box);
}
function importSave() {
  const box = el('div');
  box.appendChild(el('h2', null, 'Load game'));
  box.appendChild(el('p', { class: 'muted' }, 'Loading replaces the game you have open. Press Undo once to return to it.'));
  const msg = el('div', { class: 'err', role: 'status' });
  const inp = el('input', { type: 'file', accept: '.json,application/json' });
  let pending = 0;
  const load = (text, source) => {
    try { loadFromText(text); UI.loadDraft = ''; }
    catch (e) { msg.textContent = `Could not read that ${source}: ${e.message}`; }
  };
  inp.addEventListener('change', () => {
    const request = ++pending, f = inp.files[0]; if (!f) return;
    inp.value = '';
    const r = new FileReader();
    const active = () => request === pending && box.isConnected && $('modal').classList.contains('open');
    r.onload = () => { if (active()) load(r.result, 'file'); };
    r.onerror = () => { if (active()) msg.textContent = 'The file could not be opened. Choose it again or paste the save text.'; };
    msg.textContent = 'Reading file…';
    try { r.readAsText(f); } catch (e) { r.onerror(); }
  });
  const ta = el('textarea', { style: { width: '100%', height: '110px' }, placeholder: '…or paste save text here' });
  ta.value = UI.loadDraft || '';
  ta.addEventListener('input', () => { pending++; UI.loadDraft = ta.value; msg.textContent = ''; });
  box.appendChild(el('p', null, 'Choose a saved .json file: ', inp));
  box.appendChild(ta);
  box.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', onclick: () => { pending++; UI.loadDraft = ta.value; load(ta.value, 'text'); } }, 'Load pasted text'),
    el('button', { onclick: () => { pending++; UI.loadDraft = ''; ta.value = ''; msg.textContent = ''; ta.focus(); } }, 'Clear pasted text')));
  box.appendChild(msg);
  openModal(box);
}
function confirmBox(title, text, okLabel, onOk) {
  openModal(el('div', null, el('h2', null, title), el('p', null, text), el('div', { class: 'opts' },
    el('button', { class: 'primary', onclick: () => { closeModal(); onOk(); } }, okLabel), el('button', { onclick: closeModal }, 'Cancel'))));
}

/* ---------- small renderers ---------- */
function dots(sh) {
  const full = def(sh).full[4];
  let t = '';
  for (let i = 0; i < full; i++) t += i < sh.steps ? '●' : '○';
  return t;
}
function shipChip(s, id, inspectable = true) {
  const sh = s.ships[id]; const d = def(sh); const v = curVals(sh);
  const noSteps = sh.steps === 0 && s.encounter && s.encounter.ships[id] === 'in';
  const noStepsText = 'No Steps – combat strengths 0';
  const isFlag = s.flagship[sh.owner] === id;
  const flags = [d.main ? 'M' : '', d.T && isFull(sh) ? 'T' : '', d.F && isFull(sh) ? 'F' : '', d.cls ? 'CLS' : ''].filter(Boolean).join(' ');
  const title = `${shipName(s, id)} – ${d.type}, ${d.guns} guns${d.main ? ', Main ship' : ', Secondary'}${d.T ? ', can tow at full strength' : ''}${d.F ? ', Fast at full strength' : ''}\n` +
    `Full: LG ${d.full[0]} Car ${d.full[1]} CA ${d.full[2]} Def ${d.full[3]} (${d.full[4]} steps)\nReduced: LG ${d.red[0]} Car ${d.red[1]} CA ${d.red[2]} Def ${d.red[3]}\nVP if destroyed/captured: ${d.vp[0]}/${d.vp[1]}`;
  const attrs = { class: `ship ${sh.owner} ${isReduced(sh) ? 'red' : ''} ${isFlag ? 'flag' : ''}`, title };
  if (inspectable) Object.assign(attrs, { type: 'button', 'aria-label': 'Inspect ' + shipName(s, id) + (noSteps ? ' – ' + noStepsText : ''),
    'aria-haspopup': 'dialog', onclick: () => openShipDetails(s, id) });
  return el(inspectable ? 'button' : 'span', attrs,
    el('span', { class: 'nm' }, (isFlag ? '★ ' : '') + d.name + (d.ver ? ' ' + d.ver : '')),
    el('span', { class: 'st' }, `${v[0]}·${v[1]}·${v[2]}·${v[3]} `, el('span', { class: 'dots' }, dots(sh)), flags ? ' ' + flags : ''),
    noSteps && el('span', { class: 'no-steps' }, noStepsText));
}
function trackRow(s, side) {
  const wrap = el('div', { class: 'trk' });
  for (let i = SUPPLY_MIN; i <= SUPPLY_MAX; i++) {
    const on = s.supply[side] === i;
    const hasTroops = side === s.human ? s.troops[side].track.indexOf(i) >= 0 : s.aiTroops.track.some(m => m.space === i);
    const trig = Object.keys(CONSTRUCTION_TRIGGERS).filter(k => CONSTRUCTION_TRIGGERS[k].side === side && CONSTRUCTION_TRIGGERS[k].space === i).map(k => SHIP_BY_ID[k].name).join(', ');
    wrap.appendChild(el('i', { class: `${on ? 'on ' + side : ''} ${hasTroops ? 'tr' : ''}`, title: `Space ${i}${trig ? ' – ' + trig + ' launches' : ''}${hasTroops ? ' – Troops marker' : ''}` }, String(i)));
  }
  return wrap;
}

/* ---------- header ---------- */
function renderHeader(s) {
  const h = $('hdr'); h.innerHTML = '';
  h.appendChild(el('h1', null, 'A Glorious Chance · Solo Companion'));
  h.appendChild(el('span', { class: 'app-version' }, `v${APP_VERSION}`));
  if (!s) {
    h.appendChild(el('div', { class: 'btns' }, el('button', { onclick: importSave }, 'Load game'), el('button', { onclick: () => openRef() }, 'Reference')));
    return;
  }
  const tt = el('div', { class: 'turntrack' });
  TURN_NAMES.forEach((n, i) => tt.appendChild(el('span', { class: i === s.turn ? 'cur' : i < s.turn ? 'past' : '' }, n.replace('September', 'Sep').replace('August', 'Aug').replace('June', 'Jun').replace('July', 'Jul'))));
  const score = gameScore(s);
  h.appendChild(el('div', { class: 'stat' }, el('span', null, `${s.human === 'US' ? 'U.S.' : 'British'} Solo Campaign`), tt));
  if (UI.saveFailed) h.appendChild(el('div', { class: 'stat', style: { color: '#b00' } }, el('b', null, 'Not autosaved'), el('span', null, 'This browser refused to store the game – use Save to keep a copy.')));
  else if (UI.savedUndoCount != null) h.appendChild(el('div', { class: 'stat', role: 'status' }, el('b', null, 'Autosaved'), el('span', null, `Browser storage is nearly full. Undo steps available after reload: ${UI.savedUndoCount}.`)));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'VP U.S. / Br.'), el('b', null, `${sgn(s.vp.US)} / ${sgn(-s.vp.BR)}`)));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Game Score'), el('b', null, `${score >= 0 ? '+' : ''}${score}`), el('span', null, s.over && s.result ? s.result.level : victoryLevel(score))));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Naval Balance'), el('b', null, `${s.nb >= 0 ? '+' : ''}${s.nb}`), el('span', null, NB_LABELS[s.nbBand])));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Leaders'), el('span', null, `U.S.: ${leaderName(s, 'US')}${s.leader.US.wounded ? ' (W)' : ''}`), el('span', null, `Br.: ${leaderName(s, 'BR')}${s.leader.BR.wounded ? ' (W)' : ''}`)));
  h.appendChild(el('div', { class: 'btns' },
    el('button', { onclick: undo, disabled: !UNDO.length, title: `Undo the last action, including its dice. ${UNDO.length} Undo steps available.` }, '↶ Undo'),
    el('button', { onclick: exportSave }, 'Save'),
    el('button', { onclick: importSave }, 'Load'),
    el('button', { onclick: () => openCampaignMap(s) }, 'Map'),
    el('button', { onclick: () => openRef() }, 'Reference'),
    el('button', { onclick: () => openAdjust() }, 'Adjust'),
    el('button', { onclick: () => openSettings() }, 'Settings'),
    el('button', { onclick: () => confirmBox('New game?', 'Abandon this game and return to the setup screen? (Save it first if you want to keep it.)', 'Abandon game', () => { G_STATE = null; UNDO = []; try { localStorage.removeItem(SAVE_KEY); } catch (e) { } render(); }) }, 'New game')));
}

/* ---------- procedure panel ---------- */
function renderProc(s) {
  const p = $('proc'); p.innerHTML = '';
  p.appendChild(el('div', { class: 'step' }, `${TURN_NAMES[Math.min(s.turn, 7)]} · ${s.stepLabel || ''}`));
  const rb = recoveryBanner(s); if (rb) p.appendChild(rb);
  if (s.eventRestore) p.appendChild(el('div', { class: 'banner', role: 'status' }, eventRestoreText(s)));
  if (s.over) {
    p.appendChild(el('div', { class: 'ptitle' }, 'Game Over'));
    p.appendChild(el('div', { class: 'ptext' }, `Final Game Score: ${sgn(s.result.score)}\n${s.result.level}\n\nU.S. VP ${sgn(s.vp.US)} · British VP ${sgn(-s.vp.BR)} (British VPs count negative).`));
    appendTableReport(p, s);
    p.appendChild(vpBreakdown(s));
    return;
  }
  const pr = s.prompt;
  if (!pr) { p.appendChild(el('div', null, 'Working…')); return; }
  if (UI.localFor !== pr.id) { UI.local = null; UI.localFor = pr.id; }
  p.appendChild(el('div', { class: 'ptitle' }, pr.title || ''));
  appendTableReport(p, s);
  if (pr.eventCard) p.appendChild(eventCardView(pr.eventCard));
  if (pr.targetCard) p.appendChild(targetCardView(s, pr.targetCard));
  if (pr.text && pr.kind !== 'assign') p.appendChild(el('div', { class: 'ptext' }, pr.kind === 'event' ?
    eventDrawText(s, pr.purpose, topFrame(s).L.gale, !!s.eventRestore) : pr.text));
  if (pr.combatView || pr.combatPreview) { const cv = combatView(s); if (cv) p.appendChild(cv); }
  const body = el('div');
  if (pr.kind === 'event') body.appendChild(renderEventEntry(s, pr));
  else if (pr.kind === 'info') body.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', onclick: () => doAct('ok'), id: 'btn-ok' }, 'Continue')));
  else if (pr.kind === 'choice') body.appendChild(renderChoice(s, pr));
  else if (pr.kind === 'select') body.appendChild(renderSelect(s, pr));
  else if (pr.kind === 'assign') body.appendChild(renderAssign(s, pr));
  else if (pr.kind === 'lineup') body.appendChild(renderLineup(s, pr));
  p.appendChild(body);
  p.appendChild(el('div', { class: 'err' }, UI.err || ''));
}
function renderChoice(s, pr) {
  if (pr.tactic) {
    const box = el('div');
    pr.options.forEach(o => box.appendChild(el('button', { type: 'button', class: `optcard tac-${o.color || 'white'}`, disabled: o.disabled, onclick: () => doAct(o.id) }, el('span', { class: 't' }, o.label), el('span', { class: 'd' }, o.desc || ''))));
    return box;
  }
  const box = el('div', { class: 'opts' });
  pr.options.forEach(o => box.appendChild(el('button', { class: o.primary ? 'primary' : '', disabled: o.disabled, onclick: () => doAct(o.id) }, o.label)));
  return box;
}
// Selection prompts re-render for validation and previews. Keep the player's
// place in the scrollable list and return keyboard focus to the same control.
function refreshSelection(s, focusId) {
  const oldList = $('proc').querySelector('.sel-list');
  const top = oldList && oldList.scrollTop;
  renderProc(s);
  const list = $('proc').querySelector('.sel-list');
  if (list && top != null) list.scrollTop = top;
  const control = $(focusId);
  if (control) control.focus({ preventScroll: true });
}
function renderSelect(s, pr) {
  if (!UI.local) {
    UI.local = { sel: (pr.initial || []).slice() };
    const remembered = pr.pkg && pkgMemory()[pr.pkg];
    if (remembered && !pr.initial) UI.local.sel = pkgAutoFill(s, pr.items.map(i => i.id), remembered);
  }
  const L = UI.local;
  const wrap = el('div');
  const list = el('div', { class: 'sel-list' });
  let lastGroup = null;
  pr.items.forEach((it, index) => {
    if (it.group && it.group !== lastGroup) { lastGroup = it.group; const g = (pr.groups || []).find(x => x.key === it.group); list.appendChild(el('div', { class: 'sel-group' }, g ? `${g.label} (DRM ${g.drm >= 0 ? '+' : ''}${g.drm})` : it.group)); }
    const cb = el('input', { type: 'checkbox', id: 'select-item-' + index, checked: L.sel.indexOf(it.id) >= 0 ? true : null });
    cb.addEventListener('change', () => { if (cb.checked) { if (L.sel.indexOf(it.id) < 0) L.sel.push(it.id); } else L.sel = L.sel.filter(x => x !== it.id); L.msg = ''; refreshSelection(s, cb.id); });
    list.appendChild(el('label', null, cb, it.label));
  });
  wrap.appendChild(list);
  const patrol = manualPackagePatrol(pr);
  if (pr.pkg || patrol) wrap.appendChild(packageHelper(s, pr, L, patrol));
  const err = validateAnswer(s, pr, L.sel);
  let extra = '';
  if (pr.validate === 'squadron30') { const keep = pr.items.filter(i => L.sel.indexOf(i.id) < 0); extra = `Deployable squadron: ${sumBy(keep, i => i.ca)} / 30 Close Action points.`; }
  if (extra) wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '4px' } }, extra));
  const row = el('div', { class: 'opts' });
  if (pr.items.length > 3) row.appendChild(el('button', { class: 'small', id: 'select-all', onclick: () => { L.sel = pr.items.map(i => i.id).slice(0, pr.max == null ? 999 : pr.max); L.msg = ''; refreshSelection(s, 'select-all'); } }, 'Select all'));
  row.appendChild(el('button', { class: 'small', id: 'select-clear', onclick: () => { L.sel = []; L.msg = ''; refreshSelection(s, 'select-clear'); } }, 'Clear'));
  row.appendChild(el('button', { class: 'primary', disabled: !!err, onclick: () => doAct(L.sel.slice()) }, 'Confirm'));
  wrap.appendChild(row);
  if (err) wrap.appendChild(el('div', { class: 'err' }, err));
  return wrap;
}
function renderLineup(s, pr) {
  if (!UI.local) UI.local = { att: pr.candidates.slice(), tows: Object.assign({}, pr.defaultTows || {}) };
  const L = UI.local;
  const wrap = el('div');
  const list = el('div', { class: 'sel-list' });
  pr.candidates.forEach(id => {
    const sh = s.ships[id];
    const cb = el('input', { type: 'checkbox', id: 'lineup-' + id, checked: L.att.indexOf(id) >= 0 ? true : null });
    cb.addEventListener('change', () => {
      if (cb.checked) L.att.push(id); else { L.att = L.att.filter(x => x !== id); delete L.tows[id]; Object.keys(L.tows).forEach(t => { if (L.tows[t] === id) delete L.tows[t]; }); }
      refreshSelection(s, cb.id);
    });
    const row = el('div', { class: 'lineup-row' }, el('label', null, cb, shipChip(s, id, false)));
    if (canTow(sh) && !isCLS(sh) && L.att.indexOf(id) >= 0) {
      const sel = el('select', { id: 'lineup-tow-' + id, 'aria-label': 'Tow for ' + shipName(s, id) }, el('option', { value: '' }, '— no tow —'));
      L.att.filter(x => isCLS(s.ships[x])).forEach(x => {
        const takenBy = Object.keys(L.tows).find(t => L.tows[t] === x && t !== id);
        if (!takenBy) sel.appendChild(el('option', { value: x, selected: L.tows[id] === x ? true : null }, 'tows ' + def(s.ships[x]).name));
      });
      sel.addEventListener('change', () => { if (sel.value) L.tows[id] = sel.value; else delete L.tows[id]; refreshSelection(s, sel.id); });
      row.appendChild(sel);
    }
    list.appendChild(row);
  });
  wrap.appendChild(list);
  const ans = { attackers: L.att.slice(), tows: Object.assign({}, L.tows) };
  const err = validateAnswer(s, pr, ans);
  const rainy = rainySquallsActive(s);
  // Preview the Round actually fought, including Rainy Squalls, Missed Signal
  // and the selected towing/column order. These helpers never roll dice.
  const ms = missedSignalShip(s);
  const attNow = buildColumn(s, L.att, L.tows, pr.side).filter(id => id !== ms);
  if (pr.side === 'US' && !rainy) {
    const towed = towedInRound({ tows: L.tows }, attNow);
    const unt = attNow.filter(id => isCLS(s.ships[id]) && !towed.includes(id)).length;
    wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '4px' } }, unt ? `${unt} untowed Laker Schooner(s): roll 1d6 – ≤ ${unt / 2} gives −2 DRM, ≤ ${unt} gives −1.` : 'No untowed Laker Schooners – no DRM penalty.'));
  }
  const defendersAtStart = defendingIds(s, OTHER[pr.side]);
  const def_ = defendersAtStart.filter(id => id !== ms);
  const emptyRound = missedRoundPreview(s, L.att, pr.defenders || defendersAtStart);
  const notes = [];
  if (ms) notes.push(`Missed Signal: ${shipName(s, ms)} sits out the first Round`);
  if (emptyRound) {
    wrap.appendChild(el('div', { class: 'muted ptext' }, emptyRound + '.'));
  } else if (rainy) {
    const defenders = buildColumn(s, defendersAtStart, {}, OTHER[pr.side]).filter(id => id !== ms);
    wrap.appendChild(el('div', { class: 'muted ptext' }, 'Rainy Squalls: no Gunnery — straight to Close Action.\n' + closeActionPreviewText(s, attNow, defenders, false) + (notes.length ? '\n' + notes.join('; ') + '.' : '')));
  } else {
    const str = sideStrength(s, attNow, pr.side, hazeActive(s)), dstr = sideStrength(s, def_, pr.side, hazeActive(s));
    if (hazeActive(s)) notes.push('Haze: no Long Guns in Gunnery Round 1');
    wrap.appendChild(el('div', { class: 'muted' }, `First-Round Gunnery strength ${fmt(str)} vs ${fmt(dstr)} → ${dstr ? fmt(str / dstr) : '∞'}:1 (${CRT_COLS[crtColumnForRatio(dstr ? str / dstr : 99)]})${notes.length ? ' – ' + notes.join('; ') : ''}.`));
  }
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', disabled: !!err, onclick: () => doAct(ans) }, 'Attack with these ships')));
  if (err) wrap.appendChild(el('div', { class: 'err' }, err));
  return wrap;
}

/* Force Package helper (British campaign): totals + auto-fill + per-package memory */
const PKG_KEY = 'agc_pkg_memory_v1';
function pkgMemory() {
  try {
    const memory = JSON.parse(localStorage.getItem(PKG_KEY));
    return memory && typeof memory === 'object' && !Array.isArray(memory) ? memory : {};
  } catch (e) { return {}; }
}
function savePkgMemory(m) { try { localStorage.setItem(PKG_KEY, JSON.stringify(m)); } catch (e) { } }
function pkgAutoFill(s, pool, rule) {
  const ships = pool.map(id => s.ships[id]);
  const values = { lg, ca, car, ships: () => 1 }, value = values[rule.type];
  if (!value || !Number.isFinite(rule.n) || rule.n <= 0 || (rule.type === 'ships' && !Number.isInteger(rule.n))) return [];
  // Use the same minimum-size selection as automatic packages. A preview uses
  // a copy of the RNG cursor, so repeated clicks reproduce the choice without
  // changing any later die roll, save or Undo state.
  const chosen = mainsFirst({ rng: s.rng }, ships, value, rule.n);
  return chosen ? chosen.map(sh => sh.id) : [];
}
function packageHelper(s, pr, L, patrol) {
  const box = el('div', { class: 'banner' });
  const sel = L.sel.map(id => s.ships[id]);
  box.appendChild(el('div', null, el('b', null, `Selected: ${sel.length} ship(s) – `), `Main ${sel.filter(isMain).length} · LG ${sumBy(sel, lg)} · Car ${sumBy(sel, car)} · CA ${sumBy(sel, ca)} (carries ${Math.floor(sumBy(sel, ca) / 4)} Troops) · Def ${sumBy(sel, dfn)} · ${sumBy(sel, guns)} guns`));
  box.appendChild(el('button', { type: 'button', id: 'pkg-suggest', class: 'small',
    'aria-describedby': L.msg ? 'pkg-result' : null, onclick: () => {
      L.sel = manualPackageSuggestion(s, pr);
      L.msg = L.sel.length ? `Suggested selection: ${L.sel.length} ${L.sel.length === 1 ? 'ship' : 'ships'}.` :
        'The suggested selection has no ships.' + (!patrol && !validateAnswer(s, pr, []) ? ' Confirm for no Deployment.' : '');
      refreshSelection(s, 'pkg-suggest');
    } }, 'Use suggested ships'));
  if (L.msg) box.appendChild(el('div', { id: 'pkg-result', role: 'status' }, L.msg));
  if (patrol) {
    const army = pr.items.filter(it => !L.sel.includes(it.id)).map(it => s.ships[it.id]);
    box.appendChild(el('p', null, `Patrol: ${sumBy(sel, lg)} Long Gun (22 required). Army Support: ${sumBy(army, ca)} Close Action (8 required).`));
    return box;
  }
  const mem = pkgMemory();
  if (!L.pkgRule) L.pkgRule = { type: 'lg', n: '', remember: true, ...mem[pr.pkg] };
  const rule = L.pkgRule;
  const tSel = el('select', { 'aria-label': 'Custom selection criterion' }, ...[['lg', 'Long Gun ≥'], ['ca', 'Close Action ≥'], ['car', 'Carronade ≥'], ['ships', 'Number of ships =']].map(([v, l]) => el('option', { value: v, selected: rule.type === v ? true : null }, l)));
  const nIn = el('input', { type: 'number', 'aria-label': 'Custom selection threshold', min: 0, value: rule.n, style: { width: '60px' } });
  const remember = el('input', { type: 'checkbox', checked: rule.remember });
  tSel.onchange = () => { rule.type = tSel.value; };
  nIn.oninput = nIn.onchange = () => { rule.n = nIn.value; };
  remember.onchange = () => {
    rule.remember = remember.checked;
    if (!remember.checked && mem[pr.pkg]) { delete mem[pr.pkg]; savePkgMemory(mem); }
  };
  const apply = () => {
    const r = { type: tSel.value, n: +nIn.value || 0 };
    if (remember.checked && r.n) { mem[pr.pkg] = r; savePkgMemory(mem); }
    const pick_ = pkgAutoFill(s, pr.items.map(i => i.id), r);
    L.sel = pick_;
    L.msg = pick_.length ? `Custom selection: ${r.type === 'ships' ? r.n + ' ships' : r.type.toUpperCase() + ' ≥ ' + r.n}.` : 'No ships meet this custom selection.';
    refreshSelection(s, 'pkg-custom');
  };
  box.appendChild(el('div', { style: { marginTop: '4px' } }, 'Custom selection ', tSel, ' ', nIn, ' ', el('button', { class: 'small', id: 'pkg-custom', onclick: apply }, 'Auto-fill'), ' ', el('label', { style: { display: 'inline' } }, remember, ' remember for this package')));
  box.appendChild(el('div', { class: 'muted', style: { fontSize: '.8rem' } }, 'Use suggested ships applies the printed package. You can also select ships by hand or use a custom threshold.'));
  return box;
}

/* A7 assignment editor */
function renderAssign(s, pr) {
  if (!UI.local) UI.local = { forces: [], flagship: pr.flagship };
  const L = UI.local;
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'ptext' }, pr.text));
  const mz = pr.missions;
  // Troops note
  if (pr.troops) wrap.appendChild(el('div', { class: 'banner' }, `You have ${pr.troops} Troops marker(s) Available. Each one you leave in the box costs 1 VP in the Tally Phase (F3.3). A Force carries 1 Troops marker per 4 Close Action points.`));
  if (mz.Escort) wrap.appendChild(el('div', { class: 'banner' }, `Your Convoy runs this turn. ${s.human === 'US' ? "Escort Forces go to the Sacket's Lake Zone." : 'Escort ships go in the Escort Convoy box (they deploy with the Convoy only if the A.I. attacks it).'}`));
  // flagship
  const fs = el('select', { id: 'asg-flagship', 'aria-label': 'Flagship' });
  pr.flagshipOptions.forEach(id => fs.appendChild(el('option', { value: id, selected: id === L.flagship ? true : null }, shipName(s, id))));
  fs.addEventListener('change', () => { L.flagship = fs.value; });
  wrap.appendChild(el('div', { class: 'row asg-heading' }, el('b', null, 'Flagship: '), fs,
    pr.ships.length ? el('button', { type: 'button', class: 'small', 'aria-haspopup': 'dialog',
      onclick: () => openShipDetails(s, pr.ships.includes(L.flagship) ? L.flagship : pr.ships[0], pr.ships) }, 'Inspect ships') : null));
  const used = {}; L.forces.forEach(f => f.ships.forEach(id => { used[id] = f; }));
  L.forces.forEach((f, i) => {
    const box = el('div', { class: 'asg-force' });
    const mSel = el('select', { id: 'asg-mission-' + i, 'aria-label': `Force ${i + 1} mission` });
    Object.keys(mz).forEach(m => mSel.appendChild(el('option', { value: m, selected: f.mission === m ? true : null }, MISSION_NAME[m])));
    mSel.addEventListener('change', () => { f.mission = mSel.value; if (mz[f.mission].indexOf(f.zone) < 0) f.zone = mz[f.mission][0]; if (f.mission !== 'ArmySupport') f.troops = 0; else f.troops = Math.max(1, f.troops || 0); refreshSelection(s, mSel.id); });
    const zSel = el('select', { id: 'asg-zone-' + i, 'aria-label': `Force ${i + 1} zone` });
    mz[f.mission].forEach(z => zSel.appendChild(el('option', { value: z, selected: f.zone === z ? true : null }, z === 'ESC' ? 'Escort Convoy box' : ZONE_NAME[z])));
    zSel.addEventListener('change', () => { f.zone = zSel.value; refreshSelection(s, zSel.id); });
    const row = el('div', { class: 'row' }, el('b', null, `Force ${i + 1}`), mSel, zSel);
    if (f.mission === 'ArmySupport') {
      const cap = troopCapacity(s, f.ships);
      const tIn = el('input', { type: 'number', id: 'asg-troops-' + i, 'aria-label': `Force ${i + 1} Troops`, min: 1, max: pr.troops, step: 1, inputmode: 'numeric', value: f.troops, style: { width: '52px' } });
      tIn.addEventListener('change', () => { const v = Number(tIn.value); f.troops = Number.isFinite(v) ? Math.max(0, v) : 0; refreshSelection(s, tIn.id); });
      row.appendChild(el('span', null, ' Troops ', tIn, ` (capacity ${cap})`));
    }
    row.appendChild(el('button', { class: 'small', onclick: () => { L.forces.splice(i, 1); refreshSelection(s, L.forces[i] ? 'asg-mission-' + i : 'asg-add'); } }, 'Remove'));
    box.appendChild(row);
    const ships = el('div', { class: 'asg-ships' });
    pr.ships.forEach(id => {
      const mine = f.ships.indexOf(id) >= 0; const taken = used[id] && !mine;
      const d = def(s.ships[id]);
      const controlId = `asg-${i}-${id}`;
      ships.appendChild(el('button', { type: 'button', id: controlId, class: `asg-ship ${mine ? 'on' : ''} ${taken ? 'taken' : ''}`, disabled: !!taken, 'aria-pressed': String(mine), title: `LG ${lg(s.ships[id])} Car ${car(s.ships[id])} CA ${ca(s.ships[id])} Def ${dfn(s.ships[id])}`,
        onclick: () => { if (taken) return; if (mine) f.ships = f.ships.filter(x => x !== id); else f.ships.push(id); refreshSelection(s, controlId); } }, d.name + (d.ver ? ' ' + d.ver : '') + (s.ships[id].port === 'temp' ? ' (Isolated)' : '')));
    });
    box.appendChild(ships);
    const fShips = f.ships.map(id => s.ships[id]);
    box.appendChild(el('div', { class: 'muted', style: { fontSize: '.8rem', marginTop: '3px' } }, f.ships.length ? `LG ${sumBy(fShips, lg)} · Car ${sumBy(fShips, car)} · CA ${sumBy(fShips, ca)} · Def ${sumBy(fShips, dfn)} · ${sumBy(fShips, guns)} guns · defending vs British attack ${fmt(sideStrength(s, f.ships, 'BR'))}, vs U.S. attack ${fmt(sideStrength(s, f.ships, 'US'))}` : 'Select ships to add them to this Force.'));
    wrap.appendChild(box);
  });
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { id: 'asg-add', onclick: () => { L.forces.push({ mission: 'Patrol', zone: Object.keys(mz).length ? mz.Patrol[0] : 'YOR', ships: [], troops: 0 }); refreshSelection(s, 'asg-mission-' + (L.forces.length - 1)); } }, '+ Add Force')));
  const port = pr.ships.filter(id => !used[id]);
  wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '6px' } }, `Staying in port: ${port.map(id => shipName(s, id)).join(', ') || 'none'}.`));
  const assignment = () => ({ flagship: L.flagship, forces: L.forces.map(f => ({ zone: f.zone, mission: f.mission, ships: f.ships.slice(), troops: f.mission === 'ArmySupport' ? (f.troops || 0) : 0 })) });
  const err = validateAnswer(s, pr, assignment());
  if (pr.ships.length && !L.forces.length) wrap.appendChild(el('p', { class: 'banner' }, 'No Forces assigned. Confirming keeps every ship in port this turn.'));
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', disabled: !!err, onclick: () => doAct(assignment()) }, 'Confirm assignments')));
  if (err) wrap.appendChild(el('div', { class: 'err' }, err));
  return wrap;
}

/* ---------- cards ---------- */
function eventCardView(id) {
  const ev = EVENTS[id];
  return el('div', { class: 'evcard' },
    el('div', { class: 'top' }, el('span', null, `Event #${id} · ${EVENT_TITLE[ev.lake]}${ev.lakeSide ? ' (' + SIDE_SHORT[ev.lakeSide] + ')' : ''}`), el('span', null, ev.spy ? '🔭 Encounter' : '— no spyglass')),
    el('div', null, EVENT_TEXT[ev.lake](ev.lakeSide)),
    el('div', { class: 'mid' }, el('span', null, ev.sym.length ? '⦸ ' + ev.sym.map(x => SYM[x]).join(' ') : 'no Tactic symbols'), ev.wg ? el('span', { class: 'wg' + ev.wg }, `Weather Gage ${ev.wg === 'A' ? 'American (A)' : 'British (B)'}`) : el('span', null, '—')),
    el('div', null, el('b', null, 'Coastal: '), ev.coastal === 'gale' ? 'Discard and draw again.' : EVENT_TITLE[ev.coastal] + (ev.coastal !== 'none' ? ' – ' + EVENT_TEXT[ev.coastal]() : '')));
}
function targetCardView(s, id) {
  const c = TARGET_CARDS[id];
  const rowCard = s.targetRow.find(card => card.id === id);
  const frame = s.calls.findLast(f => f.proc === 'aiDeploy' && f.L.card === id);
  const used = rowCard && rowCard.usedCell || frame && frame.L.cell;
  const cell = used || cardCell(s, c);
  const tbl = el('table', null, el('tr', null, el('th', null, 'Troops'), ...NB_CARD_LABELS.map((l, i) => el('th', { style: i === cell.col ? { background: '#dfe8f1' } : null }, l))));
  c.grid.forEach((row, r) => {
    const tr = el('tr', null, el('th', null, String(r)));
    for (let k = 0; k < 7; k++) {
      const v = c.deck === 'A' ? (row[k] === '1') : row[k];
      tr.appendChild(el('td', { class: `${v ? 'hit' : ''} ${r === cell.row && k === cell.col ? 'cur' : ''}` }, c.deck === 'A' ? (v ? '⛵' : '') : (v ? String(v) : '–')));
    }
    tbl.appendChild(tr);
  });
  return el('div', { class: 'tgt' },
    el('div', null, el('b', null, `Target Card ${id}: ${ZONE_NAME[c.zone]} – ${MISSION_NAME[c.mission]}`), c.secondary ? ` (${MISSION_NAME[c.secondary]})` : ' (None)'),
    c.cond ? el('div', { class: 'muted' }, COND_TEXT[c.cond]) : null,
    tbl, el('div', { class: 'muted' }, `${used ? 'Deployment lookup' : 'Current board lookup'} · Troops ${cell.row}, Naval Balance ${NB_CARD_LABELS[cell.col]}.`),
    el('div', { class: 'muted' }, `${c.lastTurn ? '[removed on the final turn] ' : ''}${c.isolated ? '[hourglass: removed when the AI has Isolated ships]' : ''}`));
}

/* ---------- combat view ---------- */
function combatView(s) {
  const e = s.encounter, c = s.combat;
  if (!e) return null;
  const wrap = el('div');
  const previous = c && e.kind !== 'harbor' && e.wg && e.wg !== c.att;
  const segment = e.kind === 'harbor' ? 'Harbor Encounter' : e.segment === 'patrol' ? 'Patrol Segment' : 'Reaction Segment';
  const context = [ZONE_NAME[e.zone], segment, 'Weather Gage: ' + (e.wg ? SIDE_NAME[e.wg] : '—')];
  if (c && c.seq && e.kind !== 'harbor') {
    context.push(previous ? `Previous formation (Sequence ${c.seq})` : `Combat Sequence ${c.seq}`);
  }
  wrap.appendChild(el('div', { class: 'muted' }, context.join(' · ')));
  const grid = el('div', { class: 'combat' });
  ['US', 'BR'].forEach(side => {
    let label = SIDE_NAME[side];
    if (c) {
      const attacking = c.att === side;
      if (previous) label += attacking ? ' – previous attacker' : ' – previous defender';
      else label += attacking ? ' – attacking' : ' – defending';
    }
    const col = el('div', { class: `colm ${side}` }, el('b', null, label));
    const ids = c ? c.col[side] : encIds(s, side);
    ids.forEach((id, i) => {
      if (!id) { col.appendChild(el('div', { class: 'pos gap' }, el('b', null, String(i + 1)), '(gap)')); return; }
      if (e.ships[id] !== 'in') { col.appendChild(el('div', { class: 'pos gap' }, el('b', null, String(i + 1)), `${def(s.ships[id]).name} – off board`)); return; }
      col.appendChild(el('div', { class: 'pos' }, el('b', null, String(i + 1)), shipChip(s, id)));
    });
    const off = Object.keys(e.ships).filter(id => e.side[id] === side && ['dis', 'struck', 'wd', 'sunk', 'cap', 'hstruck'].indexOf(e.ships[id]) >= 0);
    if (off.length) col.appendChild(el('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '4px' } }, 'Off board: ' + off.map(id => `${def(s.ships[id]).name} (${({ dis: 'Disengaged', struck: 'Struck Colors', wd: 'Withdrawn', sunk: 'Sunk', cap: 'Captured', hstruck: 'Struck in port' })[e.ships[id]]})`).join(', ')));
    const stay = encIds(s, side).filter(id => !(c && (c.col[side] || []).indexOf(id) >= 0));
    if (c && stay.length) col.appendChild(el('div', { class: 'muted', style: { fontSize: '.78rem' } }, 'In Force Assembly: ' + stay.map(id => def(s.ships[id]).name).join(', ')));
    if (c && c.tac) {
      const t = c.att === side ? c.tac.att : c.tac.def;
      if (t) col.appendChild(el('div', { class: `optcard tac-${TACTIC_BY_ID[t.id].color}`, style: { cursor: 'default' } }, el('div', { class: 't' }, `Tactic: ${TACTIC_BY_ID[t.id].name}${t.negated ? ' (negated)' : t.used ? ' (used)' : ''}`), el('div', { class: 'd' }, TACTIC_BY_ID[t.id].text)));
    }
    grid.appendChild(col);
  });
  wrap.appendChild(grid);
  return wrap;
}

/* ---------- board ---------- */
function renderBoard(s) {
  const b = $('board'); b.innerHTML = '';
  // Tracks
  const tr = el('div', { class: 'panel' });
  tr.appendChild(el('h2', null, 'Tracks'));
  const tracks = el('div', { class: 'tracks' });
  tracks.appendChild(el('div', null, el('div', null, el('b', { class: 'us' }, 'U.S. Convoy Supply '), `${s.supply.US} · Construction Delay ${s.cd.US}`), trackRow(s, 'US')));
  tracks.appendChild(el('div', null, el('div', null, el('b', { class: 'br' }, 'British Convoy Supply '), `${s.supply.BR} · Construction Delay ${s.cd.BR}`), trackRow(s, 'BR')));
  const nf = el('div', { class: 'niag' }); NIAGARA_SPACES.forEach((n, i) => nf.appendChild(el('span', { class: s.niagara === i ? 'on' : '' }, n)));
  tracks.appendChild(el('div', null, el('b', null, 'Niagara Front '), nf));
  const h = s.human;
  const convTxt = [0, 1, 2, 3].map(m => { const a = s.convoys[h][m * 2], b2 = s.convoys[h][m * 2 + 1]; return `${MONTHS[m].slice(0, 3)}: ${a && a.real ? 'I' : b2 && b2.real ? 'II' : '?'}`; }).join(' · ');
  const due = sd => (s.troopsReturning && s.troopsReturning[sd]) || 0;
  tracks.appendChild(el('div', null, el('b', null, 'Troops '), `You: ${s.troops[h].available} available${due(h) ? `, ${due(h)} due back at F7` : ''}${s.troops[h].track.length ? ', on track at ' + s.troops[h].track.join(', ') : ''}. A.I.: ${aiTroopsInBox(s)} available${due(s.ai) ? `, ${due(s.ai)} due back at F7` : ''}, ${s.aiTroops.box.filter(m => !m.revealed).length} unrevealed, ${s.aiTroops.track.length} on track.`));
  tracks.appendChild(el('div', null, el('b', null, 'Your Convoys '), convTxt));
  tracks.appendChild(el('div', null, el('b', null, 'Flagships '), `U.S.: ${shipName(s, s.flagship.US)} · Br.: ${shipName(s, s.flagship.BR)}`));
  tr.appendChild(tracks);
  // Lake
  const lp = el('div', { class: 'panel' });
  lp.appendChild(el('h2', null, 'Lake Ontario'));
  lp.appendChild(campaignMap(s));
  const zoneDetails = el('details', { class: 'map-zone-list' }, el('summary', null, 'All zone details'));
  const lake = el('div', { id: 'lake' });
  ['YOR', 'NOR', 'KIN', 'NIA', 'SOU', 'SAC'].forEach(z => lake.appendChild(zoneView(s, z)));
  zoneDetails.appendChild(lake); lp.appendChild(zoneDetails);
  // Target row
  if (s.targetRow && s.targetRow.length) {
    lp.appendChild(el('h3', null, 'Target Card row'));
    const row = el('div', { class: 'cardrow' });
    s.targetRow.forEach((c, i) => {
      const tc = TARGET_CARDS[c.id];
      const pe = s.pe.filter(p => p.idx === i).map(p => 'PE' + p.num + (p.status === 'encounter' || p.status === 'ended' && c.enc ? '★' : ''));
      const attrs = { class: `tcard ${c.revealed ? 'rev' : 'back'} ${c.removed ? 'removed' : ''}`, title: c.revealed ? `${c.id} ${MISSION_NAME[tc.mission]}` : 'face down' };
      if (c.revealed) Object.assign(attrs, { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Inspect Target Card ' + c.id + (c.removed ? ' (removed)' : ''),
        onclick: () => openModal(el('div', { class: 'ref' }, el('h2', null, 'Revealed Target Card'), targetCardView(s, c.id))) });
      row.appendChild(el(c.revealed ? 'button' : 'div', attrs,
        el('span', null, `${i + 1}. `, el('span', { class: 'z' }, ZONE_NAME[tc.zone])),
        c.revealed ? el('span', null, `${c.id} ${MISSION_NAME[tc.mission]}`) : null,
        pe.length ? el('span', null, pe.join(' ')) : null,
        c.removed ? el('span', { class: 'muted' }, 'Removed') : null));
    });
    lp.appendChild(row);
  }
  b.appendChild(lp);
  b.appendChild(tr);
  // Ports
  const pp = el('div', { class: 'ports' });
  ['US', 'BR'].forEach(side => pp.appendChild(portView(s, side)));
  const pw = el('div', { class: 'panel' }, el('h2', null, 'Homeport Displays'), el('div', { class: 'muted', style: { fontSize: '.78rem' } }, 'Ship chips: Long Gun · Carronade · Close Action · Defense, then Steps (● remaining, ○ lost). M = Main ship, T = can tow, F = Fast, CLS = Converted Laker Schooner, ★ = Flagship. Hatched = Reduced. Select a ship to inspect both faces.'), pp);
  b.appendChild(pw);
  // Log
  const lg_ = el('div', { class: 'panel' });
  const logLabels = { all: 'All entries', combat: 'Combat and events', ai: 'A.I. moves', roll: 'Dice rolls', vp: 'Scoring', player: 'Your decisions' };
  const filt = el('select', { id: 'log-filter', 'aria-label': 'Filter the game log' }, ...Object.keys(logLabels).map(k => el('option', { value: k, selected: UI.logFilter === k ? true : null }, logLabels[k])));
  filt.addEventListener('change', () => { UI.logFilter = filt.value; showEntries(); });
  lg_.appendChild(el('h2', null, 'Log ', filt));
  const search = el('input', { id: 'log-search', type: 'search', 'aria-label': 'Search the full game log', placeholder: 'Ship, card number or phase' });
  search.value = UI.logSearch;
  search.addEventListener('input', () => { UI.logSearch = search.value; showEntries(); });
  lg_.appendChild(el('label', { class: 'log-search-label' }, 'Search full log ', search));
  const logBox = el('div', { id: 'log' });
  const count = el('div', { class: 'muted', id: 'log-count', role: 'status' });
  const toggle = el('button', { id: 'log-toggle', class: 'small', onclick: () => { UI.showLogAll = !UI.showLogAll; showEntries(); } });
  function showEntries() {
    const query = UI.logSearch.trim().toLocaleLowerCase();
    const entries = s.log.filter(l => (UI.logFilter === 'all' || l.kind === UI.logFilter || (UI.logFilter === 'combat' && (l.kind === 'roll' || l.kind === 'event'))) &&
      (!query || `${TURN_NAMES[Math.min(l.turn, 7)]} ${l.phase} ${l.text}`.toLocaleLowerCase().includes(query)));
    const shown = UI.showLogAll ? entries.slice() : entries.slice(-400);
    count.textContent = `Showing ${shown.length} of ${entries.length} matching entries (newest first).`;
    toggle.hidden = entries.length <= 400;
    toggle.setAttribute('aria-pressed', String(UI.showLogAll));
    toggle.textContent = UI.showLogAll ? 'Show recent 400' : 'Show full log';
    logBox.replaceChildren(...shown.reverse().map(l => el('div', { class: l.kind }, `${TURN_NAMES[Math.min(l.turn, 7)].replace('September', 'Sep')} · ${l.phase} · ${l.text}`)));
    if (!shown.length) logBox.appendChild(el('p', { class: 'muted' }, 'No log entries match. Clear the search or choose another category.'));
  }
  showEntries();
  lg_.appendChild(count); lg_.appendChild(toggle);
  lg_.appendChild(logBox);
  b.appendChild(lg_);
  refreshCampaignMaps();
}
function zoneView(s, z) {
  const zs = s.zones[z];
  const encHere = s.encounter && s.encounter.zone === z;
  const box = el('div', { style: { gridArea: z }, class: `zone ${zs.control ? 'ctl-' + zs.control : ''} ${encHere ? 'enc' : ''}` });
  box.appendChild(el('div', { class: 'zh' }, el('span', null, ZONE_NAME[z]), el('span', { class: 'muted', style: { fontWeight: 'normal', fontSize: '.7rem' } }, COAST_OWNER[z] ? `${SIDE_SHORT[COAST_OWNER[z]]} coast` : 'contested coast')));
  const tags = el('div', { class: 'tags' });
  if (zs.control) tags.appendChild(el('span', { class: 'tag ' + zs.control.toLowerCase() }, `${SIDE_SHORT[zs.control]} control`));
  if (zs.blockade) tags.appendChild(el('span', { class: 'tag blk' }, `${SIDE_SHORT[zs.blockade]} Blockade`));
  if (zs.event) { const ev = EVENTS[zs.event]; tags.appendChild(el('button', { type: 'button', class: 'tag ev', 'aria-haspopup': 'dialog', onclick: () => openModal(el('div', null, el('h2', null, 'Event card'), eventCardView(ev.id))), title: EVENT_TEXT[ev.lake](ev.lakeSide) }, `${EVENT_TITLE[ev.lake]}${ev.lakeSide ? ' (' + SIDE_SHORT[ev.lakeSide] + ')' : ''}`)); }
  if (z === homeZone('US')) tags.appendChild(el('span', { class: 'tag us' }, "Sacket's Harbor"));
  if (z === homeZone('BR')) tags.appendChild(el('span', { class: 'tag br' }, 'Kingston Harbour'));
  (s.coastal.raids || []).filter(r => r.zone === z).forEach(r => tags.appendChild(el('span', { class: 'tag ' + r.side.toLowerCase() }, `${SIDE_SHORT[r.side]} Raid marker`)));
  (s.coastal.battles || []).filter(bt => bt.zone === z).forEach(bt => tags.appendChild(el('span', { class: 'tag ' + bt.side.toLowerCase() }, `Land Battle: ${LB_RESULTS.find(x => x.id === bt.result).label}`)));
  if (s.convoyDeployed.US && s.convoyDeployed.US.zone === z) tags.appendChild(el('span', { class: 'tag us' }, 'U.S. Convoy'));
  if (s.convoyDeployed.BR && s.convoyDeployed.BR.zone === z) tags.appendChild(el('span', { class: 'tag br' }, 'British Convoy'));
  box.appendChild(tags);
  forcesInZone(s, z).forEach(f => {
    const pes = s.pe.filter(p => p.forceId === f.id && (p.status === 'possible' || p.status === 'encounter'));
    const fb = el('div', { class: `force ${f.side}` }, el('div', { class: 'fh' }, `${f.id} · ${MISSION_NAME[f.mission] || f.mission}${f.troops ? ' · ' + f.troops + ' Troops' : ''}${f.ended ? ' · Enc. ended' : ''}${pes.length ? ' · ' + pes.map(p => (p.status === 'encounter' ? 'Enc ' : 'PE') + p.num).join(' ') : ''}`));
    const ships = el('div', { class: 'ships' });
    f.ships.forEach(id => ships.appendChild(shipChip(s, id)));
    fb.appendChild(ships);
    box.appendChild(fb);
  });
  return box;
}
function portView(s, side) {
  const box = el('div', { class: `port ${side}` });
  box.appendChild(el('h3', null, `${side === 'US' ? HOMEPORT_NAME.US : HOMEPORT_NAME.BR}${isBlockaded(s, side) ? ' – BLOCKADED' : ''}${side === s.human ? ' (you)' : ' (A.I.)'}`));
  const groups = [
    ['Deployable', sh => sh.box === 'deployable' && sh.port === 'home'],
    [`Isolated – ${TEMP_HOMEPORT_NAME[side]}`, sh => (sh.box === 'deployable' || sh.box === 'transit') && sh.port === 'temp'],
    ['Escort Convoy box', sh => sh.box === 'escortBox'],
    ['Make Ready', sh => sh.box === 'makeReady'],
    ['Repairing', sh => sh.box === 'repairing'],
    ['Construction', sh => sh.box === 'construction'],
    ['In Ordinary', sh => sh.box === 'ordinary'],
    ['In Transit', sh => sh.box === 'transit' && sh.port !== 'temp'],
    ['Requisitioned', sh => sh.box === 'requisitioned'],
    ['Lost', sh => sh.box === 'sunk' || sh.box === 'outOfPlay'],
  ];
  groups.forEach(([label, fn]) => {
    const ships = sideShips(s, side).filter(fn);
    if (!ships.length) return;
    const row = el('div', { class: 'ships' });
    ships.forEach(sh => { const chip = shipChip(s, sh.id); if (sh.delay) chip.title += `\nRepair delay markers: ${sh.delay}`; row.appendChild(chip); });
    box.appendChild(el('div', { class: 'box' }, el('div', { class: 'bl' }, `${label}${label === 'Deployable' ? ` (${sumBy(ships, ca)} CA)` : ''}`), row));
  });
  return box;
}
function vpBreakdown(s) {
  const t = el('table', { class: 'ref' }, el('tr', null, el('th', null, 'Turn'), el('th', null, 'Side'), el('th', null, 'Score effect'), el('th', null, 'Why')));
  s.vpLog.forEach(v => t.appendChild(el('tr', null, el('td', null, TURN_NAMES[Math.min(v.turn, 7)]), el('td', null, SIDE_SHORT[v.side]), el('td', null, sgn(v.side === 'US' ? v.n : -v.n)), el('td', { style: { textAlign: 'left' } }, v.why))));
  return el('div', { class: 'ref' }, t);
}

/* ---------- setup screen ---------- */
function renderSetup() {
  const p = $('app'); p.innerHTML = '';
  const saved = loadSaved();
  const st = { human: 'US', seed: Math.floor(Math.random() * 1e9), opts: defaultOptions() };
  const box = el('div', { class: 'panel setup' });
  box.appendChild(el('h2', null, 'A Glorious Chance – Solo Companion'));
  box.appendChild(el('p', null, 'This companion runs the A.I. opponent, all the bookkeeping and the dice for the U.S. and British Solo Campaigns of ',
    el('i', null, 'A Glorious Chance: The Naval Struggle for Lake Ontario in the War of 1812'), ' (Legion Wargames). Keep your physical map, counters and cards in front of you – the app tells you what to move and resolves the cards.'));
  box.appendChild(el('p', { class: 'banner' }, 'Physical Event deck required. Draw from your deck and enter the card number when prompted. The app supplies Target and Tactic cards.'));
  if (saved && saved.state && typeof saved.state === 'object') {
    const ss = saved.state, fin = !!ss.over;
    const msg = el('div', { class: 'err' });
    const label = `${SIDE_SHORT[ss.human] || '?'} Solo Campaign, ${TURN_NAMES[Math.min(ss.turn, 7)] || '?'}`;
    box.appendChild(el('div', { class: 'banner' }, fin ? `A finished game was found: ${label}. ` : `A game in progress was found: ${label}. `,
      el('button', { class: 'primary', onclick: () => {
        try { commitLoaded(checkSaveState(ss), saved.undo || []); }
        catch (e) { msg.textContent = 'Could not open the saved game. ' + e.message + ' Load a backup or start a new campaign.'; }
      } }, fin ? 'Review it' : 'Continue it'), msg));
  } else if (saved && saved.unreadable) box.appendChild(el('div', { class: 'banner', role: 'status' }, 'The saved game in this browser could not be read. Load a backup or start a new campaign.'));
  const camp = el('div', { class: 'camp' });
  const bUS = el('button', { class: 'on' }, el('b', null, 'U.S. Solo Campaign'), el('br'), el('span', { class: 'muted' }, 'You are Cdre. Chauncey; the A.I. runs the British squadron.'));
  const bBR = el('button', null, el('b', null, 'British Solo Campaign'), el('br'), el('span', { class: 'muted' }, 'You are Cdre. Yeo; the A.I. runs the American squadron.'));
  bUS.onclick = () => { st.human = 'US'; bUS.classList.add('on'); bBR.classList.remove('on'); };
  bBR.onclick = () => { st.human = 'BR'; bBR.classList.add('on'); bUS.classList.remove('on'); };
  camp.appendChild(bUS); camp.appendChild(bBR);
  box.appendChild(camp);
  const opt = (k, label) => { const cb = el('input', { type: 'checkbox', checked: st.opts[k] ? true : null }); cb.onchange = () => { st.opts[k] = cb.checked; }; return el('label', null, cb, ' ', label); };
  box.appendChild(el('h3', null, 'Options'));
  box.appendChild(opt('cuttingOut', 'Optional rule OA2: Cutting-Out missions (both campaigns)'));
  box.appendChild(opt('oa1Upgrades', 'Optional rule OA1: British ship upgrades by Make Ready roll (U.S. campaign; replaces the 7.1 A/B random check)'));
  box.appendChild(opt('confirmAiSteps', TABLE_PAUSE_LABEL));
  box.appendChild(opt('groupUpdates', TABLE_GROUP_LABEL));
  box.appendChild(opt('manualPackages', 'British campaign: pick the American Force Package ships myself (default: the app applies Player Aid V automatically)'));
  box.appendChild(opt('manualLandBattle', 'Read the Land Battle Table myself (default: the app applies Player Aid VII automatically)'));
  const pc = el('select', null, el('option', { value: 'longgun' }, 'Long Gun + Defense (Lake Combat Sequences of Play mat)'), el('option', { value: 'carronade' }, 'Carronade + Defense (British Living Rules LC1 text)'));
  pc.onchange = () => { st.opts.usAiPrecondition = pc.value; };
  box.appendChild(el('label', null, 'British campaign – A.I. American attack precondition: ', pc));
  const seedIn = el('input', { type: 'number', value: st.seed, style: { width: '140px' } });
  seedIn.onchange = () => { st.seed = +seedIn.value || 1; };
  box.appendChild(el('label', null, 'Random seed: ', seedIn, el('span', { class: 'muted' }, ' (same seed, choices and Event card numbers = same game)')));
  const begin = () => startGame(st.human, st.seed, st.opts);
  box.appendChild(el('div', { class: 'opts', style: { marginTop: '12px' } }, el('button', { class: 'primary', onclick: () => {
    if (saved) confirmBox('Replace saved game?', 'Starting a new campaign replaces the game saved in this browser.', 'Start new campaign', begin);
    else begin();
  } }, 'Start campaign'), el('button', { onclick: importSave }, 'Load a saved game')));
  box.appendChild(appDownloadControls());
  box.appendChild(el('h3', null, 'Physical setup reminders'));
  box.appendChild(el('ul', null,
    el('li', null, 'Set up the map, Homeport Displays and markers per rule 3.1 and Player Aid II or IV. When you start, the app prepares the decks and hidden markers. The log gives the setup rolls and spaces for your Troops markers.'),
    el('li', null, 'Your physical Event deck is required. When prompted, draw a card and enter its printed number. Keep the draw and discard piles with your saved campaign.'),
    el('li', null, 'Target and Tactic cards are drawn by the app. Event effects, dice and table lookups are resolved automatically after you enter the Event card number.'),
    el('li', null, 'Every A.I. decision, dieroll and table lookup is shown in the log. Use Undo if you click the wrong thing, and Adjust to correct anything by hand.')));
  p.appendChild(box);
}

/* ---------- modals ---------- */
function openModal(content, navigation = {}) {
  const m = $('modal');
  const nested = m.classList.contains('open') && navigation.backLabel;
  if (!m.classList.contains('open')) UI.modalReturnFocus = document.activeElement;
  if (nested) {
    const previous = m.querySelector('.inner');
    (UI.modalStack ||= []).push({ inner: previous, focus: document.activeElement,
      scroll: previous.scrollTop });
    previous.remove();
  } else { UI.modalStack = []; m.replaceChildren(); }
  const title = content.querySelector('h2');
  if (title) title.id = 'modal-title';
  const close = el('button', { type: 'button', onclick: closeModal }, 'Close');
  const controls = el('div', { class: 'modal-controls' });
  if (navigation.backLabel) controls.appendChild(el('button', { type: 'button', onclick: nested ? modalBack : closeModal }, navigation.backLabel));
  controls.appendChild(close);
  const inner = el('div', { class: 'inner', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? title.id : null, 'aria-label': title ? null : 'Game dialog', tabindex: -1 }, controls, content);
  m.appendChild(inner); m.classList.add('open');
  $('hdr').setAttribute('inert', ''); $('app').setAttribute('inert', '');
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  close.focus();
  refreshCampaignMaps();
}
function modalBack() {
  const previous = UI.modalStack?.pop();
  if (!previous) return;
  $('modal').replaceChildren(previous.inner);
  refreshCampaignMaps();
  if (previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
  previous.inner.scrollTop = previous.scroll;
}
function closeModal() {
  $('modal').classList.remove('open');
  UI.modalStack = [];
  $('hdr').removeAttribute('inert'); $('app').removeAttribute('inert');
  const target = UI.modalReturnFocus;
  UI.modalReturnFocus = null;
  if (target && target.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
}
function modalKeydown(e) {
  const m = $('modal');
  if (!m || !m.classList.contains('open')) return false;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return true; }
  if (e.key === 'Tab') {
    const controls = [...m.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')]
      .filter(x => !x.closest('[hidden]') && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden');
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { e.preventDefault(); m.querySelector('.inner').focus(); }
    else if (e.shiftKey && (document.activeElement === first || !m.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !m.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }
  return true;
}
function openRef() {
  const topics = [];
  function topic(name) {
    const content = el('section', { class: 'ref-topic', 'aria-label': name });
    topics.push({ name, content }); return content;
  }
  let r = topic('Lake Combat Table');
  const t = el('table', null, el('tr', null, el('th', null, 'd10'), ...CRT_COLS.map(c => el('th', null, c))));
  CRT.forEach((row, i) => t.appendChild(el('tr', null, el('th', null, String(i)), ...row.map(x => el('td', null, x)))));
  r.appendChild(t);
  r.appendChild(el('p', null, 'British attack: ½ Long Gun + Carronade + Defense. American attack: Long Gun + ½ Carronade + Defense (both sides use the attacker\'s formula). Shore batteries −1 column. Add 1 for Command when the attacking Flagship participates with Yeo or Sinclair available. Untowed U.S. Laker Schooners: 1d6 ≤ half their number −2, ≤ their number −1.'));
  topic('Hit Distribution (Player Aid VI)').appendChild(hitDistributionLookup());
  r = topic('Convoy Scatter Table (1d10)');
  const t2 = el('table', null, el('tr', null, el('th', null, 'Guns'), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => el('th', null, String(i)))));
  SCATTER.forEach((row, i) => t2.appendChild(el('tr', null, el('th', null, SCATTER_ROWS[i][1] > 999 ? '96+' : SCATTER_ROWS[i].join('–')), ...row.split('').map(x => el('td', null, x)))));
  r.appendChild(t2);
  r.appendChild(el('p', null, 'Project ruling: an attack needs at least one eligible gun. With none, the Convoy continues normally; do not roll or scatter it.'));
  r = topic('Land Battle Table (Player Aid VII) – roll 11-66');
  const lbt = el('table', null, el('tr', null, el('th', null, 'Long Gun / Troops'), ...['Def. Major', 'Def. Success', 'Draw', 'Att. Success', 'Att. Major', 'Feat of Arms'].map(h => el('th', null, h))));
  LB_TABLE.forEach((band, bi) => band.forEach((col, ti) => lbt.appendChild(el('tr', null, el('th', null, `${LB_BANDS[bi]} / ${ti + 1}`), ...col.map(rg => el('td', null, rg ? (rg[0] === rg[1] ? String(rg[0]) : rg[0] + '–' + rg[1]) : '—'))))));
  r.appendChild(lbt);
  r.appendChild(el('p', null, 'Niagara Front: British Feat of Arms 3 right, Major 2, Success 1; U.S. Success 1 left, Major 2, Feat of Arms 3. Homeport: Attacker Major Success / Feat of Arms → Shipyard Damage Table; any Attacker Success or better → the defender’s Convoy Supply −2 (Living Rules F5.3).'));
  r = topic('American A.I. Force Packages (Player Aid V)');
  const fpt = el('table', null, el('tr', null, el('th', null, '#'), el('th', null, 'Requirements')));
  Object.keys(FORCE_PACKAGE_TEXT).forEach(k => fpt.appendChild(el('tr', null, el('th', null, k), el('td', { style: { textAlign: 'left' } }, FORCE_PACKAGE_TEXT[k]))));
  r.appendChild(fpt);
  r.appendChild(el('p', null, FORCE_PACKAGE_FOOTNOTE + ' Selection [5.3.1]: Main Ships first, then Secondary; the smallest number of ships; ties by random draw.'));
  r = topic('Checks');
  r.appendChild(el('ul', null,
    el('li', null, 'Disengagement: 1d6 1–3 Disengages (−1 per friendly ship already Struck). A Fast ship that was at full strength before the hit passes its first check automatically.'),
    el('li', null, 'Strike Check: 1d10 1–2 Fight On, 3–8 Strike Colors, 9–10 Sinks (−1 Flagship with original Leader; +1 per hit on a zero-step ship).'),
    el('li', null, 'Leader Casualty: 2d6 10 Wounded, 11–12 Killed (+1 hit in Close Action, +1 win Melee, +2 lose Melee).'),
    el('li', null, 'Project ruling: resolve the starting commander’s fate throughout the combat Round result. Once killed or captured, he takes no more checks; his successor takes command after that result, including its withdrawals and flag transfers.'),
    el('li', null, 'Close Action: 2:1 CA or better; 1d10 ≤ difference = step loss (then Disengagement/Strike Check – a defender still Engaged goes to Melee), otherwise Melee (d6 + CA each; 150% captures).'),
    el('li', null, 'Reaction Check: 1d10 5–9 succeeds; +1 same zone, −1 per zone of distance (Homeport to its zone = 1). A.I. Homeport pool: no modifiers.'),
    el('li', null, 'Struck ships at Encounter end: Captured if their side withdrew/was eliminated, rescued if the enemy did, otherwise 1d6 1–3 Captured.')));
  r = topic('Ships');
  const t3 = el('table', null, el('tr', null, ...['Ship', 'Type', 'Guns', 'Full LG/Car/CA/Def/Steps', 'Reduced', 'VP D/C', 'Notes'].map(h => el('th', null, h))));
  SHIP_DEFS.forEach(d => t3.appendChild(el('tr', null, el('td', { class: d.side === 'US' ? 'us' : 'br' }, d.name + (d.ver ? ' (' + d.ver + ')' : '')), el('td', null, d.type), el('td', null, String(d.guns)), el('td', null, d.full.join('/')), el('td', null, d.red.join('/')), el('td', null, d.vp.join('/')), el('td', null, [d.main ? 'Main' : 'Secondary', d.T ? 'T' : '', d.F ? 'F' : ''].filter(Boolean).join(' ')))));
  r.appendChild(t3);
  r = topic('Victory');
  r.appendChild(el('p', null, '−33 or less British Decisive · −22 to −32 British Victory · −11 to −21 British Marginal · −10 to +10 Draw · +11 to +21 U.S. Marginal · +22 to +32 U.S. Victory · +33 or more U.S. Decisive. Construction Delay left at the end is deducted from each side.'));
  topic('Revealed cards').appendChild(revealedCardsLookup(G_STATE));
  if (G_STATE) topic('Event deck status').appendChild(eventDeckStatus(G_STATE));
  topic('Offline app').appendChild(appDownloadControls());
  openReferenceTopics(topics);
}
function openSettings() {
  const s = G_STATE; if (!s) return;
  const box = el('div');
  box.appendChild(el('h2', null, 'Settings'));
  box.appendChild(el('p', null, 'Use your physical Event deck. The app asks for the printed card number whenever an Event draw is required.'));
  const saveSettings = () => { autosave(); renderHeader(s); };
  const cb = el('input', { type: 'checkbox', checked: s.options.confirmAiSteps ? true : null });
  cb.onchange = () => { s.options.confirmAiSteps = cb.checked; saveSettings(); };
  box.appendChild(el('label', null, cb, ' ' + TABLE_PAUSE_LABEL));
  const tog = (k, label) => { const c = el('input', { type: 'checkbox', checked: s.options[k] ? true : null }); c.onchange = () => { s.options[k] = c.checked; saveSettings(); }; return el('label', null, c, ' ', label); };
  box.appendChild(tog('manualPackages', 'Pick American Force Package ships myself (British campaign)'));
  box.appendChild(tog('manualLandBattle', 'Read the Land Battle Table myself'));
  box.appendChild(tog('groupUpdates', TABLE_GROUP_LABEL));
  box.appendChild(el('p', { class: 'muted' }, `Seed ${s.seed} · Cutting-Out ${s.options.cuttingOut ? 'on' : 'off'} · OA1 ${s.options.oa1Upgrades ? 'on' : 'off'} · U.S. A.I. precondition: ${s.options.usAiPrecondition}. App version ${APP_VERSION}.`));
  openModal(box);
}
function openAdjust() {
  const s = G_STATE; if (!s) return;
  const box = el('div');
  box.appendChild(el('h2', null, 'Adjust (manual corrections)'));
  if (s.prompt?.kind === 'event') {
    box.appendChild(el('p', null, 'An Event draw is pending. Enter that card, or use Undo to return to before this draw, before making manual corrections.'));
    openModal(box); return;
  }
  box.appendChild(el('p', { class: 'muted' }, 'Use this to match the app to your table if something went differently. Every change is logged and can be undone.'));
  const msg = el('div', { class: 'err', role: 'status' });
  const beginCorrection = () => { UNDO.push(JSON.stringify(s)); delete s.tableReport; };
  const num = (label, get, set, min, max) => {
    const inp = el('input', { type: 'number', step: 1, value: get(), style: { width: '70px' } });
    return el('label', null, label + ' ', inp, ' ', el('button', { class: 'small', onclick: () => {
      const v = Number(inp.value);
      if (inp.value === '' || !Number.isSafeInteger(v)) { msg.textContent = `${label}: enter a whole number.`; return; }
      if (min != null && (v < min || (max != null && v > max))) {
        msg.textContent = max == null ? `Enter ${min} or more for ${label}.` : `Enter a value from ${min} to ${max} for ${label}.`;
        return;
      }
      if (v === get()) { msg.textContent = `${label} already has that value.`; return; }
      beginCorrection(); set(v); log(s, `Manual adjustment: ${label} = ${v}`, 'player'); autosave(); render(); openAdjust(); } }, 'Set'));
  };
  const setVP = (side, v) => {
    addVP(s, side, v - s.vp[side], 'Manual adjustment');
    if (s.over && s.result) { s.result.score = gameScore(s); if (!s.result.forced) s.result.level = victoryLevel(s.result.score); }
  };
  box.appendChild(num('U.S. VP', () => s.vp.US, v => setVP('US', v)));
  box.appendChild(num('British VP (positive points reduce Game Score)', () => s.vp.BR, v => setVP('BR', v)));
  box.appendChild(num('U.S. Convoy Supply', () => s.supply.US, v => { s.supply.US = v; }, SUPPLY_MIN, SUPPLY_MAX));
  box.appendChild(num('British Convoy Supply', () => s.supply.BR, v => { s.supply.BR = v; }, SUPPLY_MIN, SUPPLY_MAX));
  box.appendChild(num('U.S. Construction Delay', () => s.cd.US, v => { s.cd.US = v; }, 0));
  box.appendChild(num('British Construction Delay', () => s.cd.BR, v => { s.cd.BR = v; }, 0));
  box.appendChild(num('Niagara Front (0 Burlington … 6 Fort George)', () => s.niagara, v => { s.niagara = v; }, 0, 6));
  box.appendChild(el('h3', null, 'Ships'));
  const sel = el('select', { 'aria-label': 'Ship to correct' }); Object.keys(s.ships).forEach(id => sel.appendChild(el('option', { value: id }, `${shipName(s, id)} – ${BOX_NAME[s.ships[id].box]}`)));
  const boxSel = el('select', { 'aria-label': 'Destination box' }, el('option', { value: '' }, 'Keep current box')); ['deployable', 'makeReady', 'repairing', 'construction', 'ordinary', 'transit', 'sunk', 'outOfPlay'].forEach(b => boxSel.appendChild(el('option', { value: b }, BOX_NAME[b])));
  const stepIn = el('input', { type: 'number', min: 0, step: 1, 'aria-label': 'Ship steps', style: { width: '50px' } });
  const ownSel = el('select', { 'aria-label': 'Ship owner' }, el('option', { value: 'US' }, 'U.S.'), el('option', { value: 'BR' }, 'British'));
  const shipNotice = el('p', { class: 'muted', role: 'status', id: 'ship-correction-notice' });
  const sync = () => {
    const sh = s.ships[sel.value];
    boxSel.options[0].textContent = `Keep current box (${BOX_NAME[sh.box]})`; boxSel.value = '';
    stepIn.max = def(sh).full[4]; stepIn.value = sh.steps; ownSel.value = sh.owner;
    shipNotice.textContent = s.encounter && Object.hasOwn(s.encounter.ships, sh.id)
      ? 'This ship belongs to the active Encounter. Ship corrections are locked until it ends. Use Undo to return to before the Encounter if a correction is needed.'
      : 'A pending ship selection or attacking lineup may also lock this ship. Track corrections remain available.';
  };
  sel.onchange = sync; sync();
  box.appendChild(el('div', null, sel, ' box ', boxSel, ' steps ', stepIn, ' owner ', ownSel, ' ', el('button', { class: 'small', onclick: () => {
    const sh = s.ships[sel.value];
    const steps = Number(stepIn.value), maxSteps = def(sh).full[4];
    if (stepIn.value === '' || !Number.isInteger(steps) || steps < 0 || steps > maxSteps) {
      msg.textContent = `Ship steps: enter a whole number from 0 to ${maxSteps}.`; return;
    }
    const destination = boxSel.value || sh.box;
    if (ownSel.value === sh.owner && destination === sh.box && steps === sh.steps) {
      msg.textContent = 'The ship already matches these settings.'; return;
    }
    if (ownSel.value !== sh.owner && destination === sh.box && (sh.forceId || sh.box === 'lake' || sh.box === 'escortBox')) {
      msg.textContent = 'To change a deployed ship\'s owner, choose a destination box off the lake.'; return;
    }
    const pr = s.prompt;
    if (pr && pr.kind === 'select') {
      const listed = pr.items.some(item => item.id === sh.id);
      const side = pr.pkg || pr.validate === 'forcePackage' ? s.ai : s.human;
      const deployableBefore = sh.owner === side && sh.box === 'deployable';
      const deployableAfter = ownSel.value === side && destination === 'deployable';
      const reactionAtSea = pr.groups && sh.owner === side && sh.box === 'lake' && sh.forceId && s.forces[sh.forceId]?.mission === 'Patrol';
      if (listed || deployableBefore || deployableAfter || reactionAtSea) {
        msg.textContent = `“${pr.title}” uses a fixed list of ships and strengths. Finish this decision, or use Undo and make the correction before it opens.`;
        return;
      }
    }
    if (pr && pr.kind === 'lineup' && (pr.candidates.includes(sh.id) || (pr.defenders || []).includes(sh.id) || s.encounter?.ships[sh.id])) {
      msg.textContent = 'The attacking lineup uses this ship’s current position and strength. Finish the lineup, or use Undo and make the correction before it opens.';
      return;
    }
    if (s.encounter && Object.hasOwn(s.encounter.ships, sh.id)) {
      msg.textContent = 'The active Encounter uses this ship’s position, owner and strength. Finish the Encounter, or use Undo and make the correction before it opens.';
      return;
    }
    beginCorrection();
    if (destination !== sh.box) {
      if (sh.forceId) removeShipFromForce(s, sh.id);
      sh.box = destination; sh.zone = null;
    }
    sh.owner = ownSel.value; sh.steps = steps;
    if (s.prompt && s.prompt.kind === 'assign') {
      Object.assign(s.prompt, buildAssignPrompt(s));
      if (UI.local) {
        if (!s.prompt.flagshipOptions.includes(UI.local.flagship)) UI.local.flagship = s.prompt.flagship;
        for (const force of UI.local.forces) {
          force.ships = force.ships.filter(id => s.prompt.ships.includes(id));
          if (!s.prompt.missions[force.mission]) { force.mission = 'Patrol'; force.troops = 0; }
          if (!s.prompt.missions[force.mission].includes(force.zone)) force.zone = s.prompt.missions[force.mission][0];
        }
      }
    }
    log(s, `Manual adjustment: ${shipName(s, sh.id)} → ${BOX_NAME[sh.box]}, ${sh.steps} steps, ${SIDE_SHORT[sh.owner]}.`, 'player');
    autosave(); render(); openAdjust();
  } }, 'Apply')));
  box.appendChild(shipNotice);
  const markers = s.troops[s.human];
  box.appendChild(el('h3', null, 'Your Troops'));
  box.appendChild(el('p', null, `${markers.available} Available. Supply track: ${markers.track.join(', ') || 'empty'}.`));
  const spaces = el('select', { 'aria-label': 'Move one Troops marker' });
  for (let space = 2; space <= 8; space++) {
    const onTrack = markers.track.includes(space);
    if (onTrack || markers.available > 0) spaces.appendChild(el('option', { value: space }, onTrack ? `Space ${space} → Available` : `Available → space ${space}`));
  }
  if (spaces.length) box.appendChild(el('div', null, spaces, ' ', el('button', { onclick: () => {
    const space = Number(spaces.value), index = markers.track.indexOf(space);
    if (index < 0 && s.prompt && s.prompt.kind === 'assign' && UI.local) {
      const assigned = UI.local.forces.reduce((n, f) => n + (f.troops || 0), 0);
      if (assigned >= markers.available || (markers.available === 1 && UI.local.forces.some(f => f.mission === 'ArmySupport'))) {
        msg.textContent = 'Adjust the Army Support Forces in your open A7 assignment before moving this marker.';
        return;
      }
    }
    beginCorrection();
    if (index >= 0) { markers.track.splice(index, 1); markers.available++; }
    else { markers.available--; markers.track.push(space); markers.track.sort((a, b) => a - b); }
    if (s.prompt && s.prompt.kind === 'assign') Object.assign(s.prompt, buildAssignPrompt(s));
    log(s, `Manual adjustment: one of your Troops markers moved from ${index >= 0 ? 'space ' + space + ' to Available' : 'Available to space ' + space}.`, 'player');
    autosave(); render(); openAdjust();
  } }, 'Move marker')));
  if (!s.over && s.phase === 'prep' && !s.encounter && !s.targetRow.length) {
    box.appendChild(el('h3', null, 'Lake Control'));
    const zone = el('select', { 'aria-label': 'Lake Control zone' }, ...ZONES.map(z => el('option', { value: z }, ZONE_NAME[z])));
    const owner = el('select', { 'aria-label': 'Lake Control owner' }, el('option', { value: '' }, 'Contested'),
      el('option', { value: 'US' }, SIDE_NAME.US), el('option', { value: 'BR' }, SIDE_NAME.BR));
    const showOwner = () => { owner.value = s.zones[zone.value].control || ''; };
    showOwner(); zone.addEventListener('change', showOwner);
    box.appendChild(el('div', null, zone, ' ', owner, ' ', el('button', { onclick: () => {
      const z = s.zones[zone.value], side = owner.value || null;
      if (z.control === side) { msg.textContent = 'That Lake Control marker is already set.'; return; }
      if (z.blockade) { msg.textContent = 'This zone has a Blockade. Its Lake Control marker is linked to the Blockade check at Tally.'; return; }
      beginCorrection(); z.control = side;
      log(s, `Manual adjustment: ${ZONE_NAME[zone.value]} is now ${side ? 'controlled by the ' + SIDE_PL[side] : 'Contested'}.`, 'player');
      autosave(); render(); openAdjust();
    } }, 'Set Lake Control')));
  }
  if (s.prompt && s.prompt.kind === 'assign' && s.prompt.flagshipOptions.length) {
    box.appendChild(el('h3', null, 'Your Flagship'));
    const flag = el('select', { 'aria-label': 'Eligible Flagship at A7' }, ...s.prompt.flagshipOptions.map(id =>
      el('option', { value: id, selected: id === s.flagship[s.human] }, shipName(s, id))));
    box.appendChild(el('div', null, flag, ' ', el('button', { onclick: () => {
      if (s.flagship[s.human] === flag.value) { msg.textContent = 'That ship already carries your flag.'; return; }
      beginCorrection(); s.flagship[s.human] = flag.value; s.prompt.flagship = flag.value;
      if (UI.local) UI.local.flagship = flag.value;
      log(s, `Manual adjustment: ${shipName(s, flag.value)} is your Flagship at A7.`, 'player');
      autosave(); render(); openAdjust();
    } }, 'Set Flagship')));
  }
  box.appendChild(msg);
  box.appendChild(el('p', { class: 'muted' }, 'Ship changes take effect from the next step; a ship moved off the lake leaves its Force.'));
  openModal(box);
}

/* ---------- main render ---------- */
function render() {
  const s = G_STATE;
  if (s) enablePhysicalEvents(s);
  renderHeader(s);
  if (!s) { renderSetup(); return; }
  const app = $('app');
  if (!$('proc')) { app.innerHTML = ''; app.appendChild(el('div', { id: 'proc', class: 'panel' })); app.appendChild(el('div', { id: 'board' })); }
  renderProc(s);
  renderBoard(s);
}

// There is no automatic-Event option in the player interface. Old campaigns
// switch at their next draw and receive a physical-pile preparation reminder.
function enablePhysicalEvents(s) {
  if (!s.options.physicalEvents) { s.options.physicalEvents = true; s.eventCardsPrepared = false; }
}
function renderEventEntry(s, pr) {
  if (!UI.local) UI.local = { eventNumber: '' };
  const form = el('form', { class: 'event-entry' });
  const input = el('input', { id: 'event-card-number', type: 'number', min: 1, max: 38, step: 1,
    inputmode: 'numeric', autocomplete: 'off', 'aria-describedby': 'event-entry-message' });
  input.value = UI.local.eventNumber;
  const message = el('div', { id: 'event-entry-message', role: 'status', class: 'err' });
  const submit = el('button', { type: 'submit', class: 'primary' }, 'Use Event card');
  const error = () => input.value.trim() === '' ? 'Enter the number printed on the physical card.' : validateAnswer(s, pr, Number(input.value));
  const update = () => { UI.local.eventNumber = input.value; const err = error(); submit.disabled = !!err; message.textContent = input.value === '' ? '' : err || ''; };
  input.addEventListener('input', update); update();
  form.addEventListener('submit', e => { e.preventDefault(); if (!error()) doAct(Number(input.value)); });
  form.append(el('label', { for: input.id }, 'Event card number'), input, el('div', { class: 'opts' }, submit,
    el('button', { type: 'button', onclick: () => openEventDeckStatus(s) }, 'Deck status')), message,
    el('p', { class: 'muted' }, `${pr.remaining} card${pr.remaining === 1 ? '' : 's'} remaining in this draw pile. Use Undo if you entered the wrong card.`));
  return form;
}

// Saved presentation metadata: restoring a physical pile must not change the
// game checkpoint, repeat dice or disappear when the player reloads/transfers it.
function recordEventUndo(before, restored) {
  if (!restored.options.physicalEvents || before?.seed !== restored.seed ||
      !restored.log.every((r, i) => JSON.stringify(r) === JSON.stringify(before.log[i]))) return;
  const extra = before.log.slice(restored.log.length);
  const entered = extra.flatMap(r => { const m = /^Physical Event card #(\d+) entered for /.exec(r.text); return m ? [Number(m[1])] : []; });
  const cards = [...new Set(entered.concat(before.eventRestore?.cards || [], restored.eventRestore?.cards || []))]
    .filter(id => restored.deck.event.includes(id));
  const reshuffled = before.turn !== restored.turn || !!before.eventRestore?.reshuffled ||
    !!restored.eventRestore?.reshuffled || extra.some(r => r.text.startsWith('Event deck exhausted'));
  // A reset may be crossed at an information screen, several Undos before the
  // earlier draw. Carry it with that checkpoint, even with no returned card yet.
  if (cards.length || reshuffled) restored.eventRestore = { cards, reshuffled };
}
function eventRestoreText(s) {
  const { cards, reshuffled } = s.eventRestore;
  const top = cards.map(id => '#' + id).join(', ');
  const action = !cards.length ? 'Restore the physical Event piles for this checkpoint.' :
    cards.length === 1 ? `Return the Event card ${top} to the top of your physical draw pile.` :
    `Return the Event cards to the top of your physical draw pile in this order, top first: ${top}.`;
  return action + (reshuffled ?
    ` This Undo crossed a reshuffle. Restore the earlier draw pile (${s.deck.event.length} cards) and used pile using Deck status in Reference. If the earlier order was lost, shuffle the other remaining cards first, then put any returned cards on top. Keep held Intelligence cards aside.` :
    ' Keep the other cards in their previous order. Do not shuffle.');
}
function eventDeckStatus(s) {
  const box = el('div', { class: 'event-deck-status' }, el('h2', null, 'Event deck status'),
    el('p', null, 'Compare these numbers with your physical cards. The lists are in numerical order.'));
  const available = s.deck.event.slice().sort((a, b) => a - b);
  const held = ['US', 'BR'].filter(sd => s.intelligence[sd]);
  const used = Object.keys(EVENTS).map(Number).filter(id => !available.includes(id) && !held.some(sd => s.intelligence[sd].card === id));
  const list = (title, cards) => box.append(el('h3', null, `${title} (${cards.length})`),
    el('p', { class: 'event-deck-numbers' }, cards.length ? cards.join(', ') : 'None.'));
  if (s.eventRestore) box.appendChild(el('p', { class: 'banner' }, eventRestoreText(s)));
  list('Remaining in draw pile', available);
  list('Used cards', used);
  box.appendChild(el('h3', null, `Held for Intelligence (${held.length})`));
  box.appendChild(el('p', null, held.length ? held.map(sd => `#${s.intelligence[sd].card} – ${SIDE_NAME[sd]}`).join('; ') : 'None.'));
  const last = s.log.slice().reverse().find(row => /^Physical Event card #\d+ entered for /.test(row.text));
  box.append(el('h3', null, 'Last entered'), el('p', null, last ? last.text.replace('Physical Event card ', '') : 'No physical Event card entered yet.'),
    el('p', { class: 'muted' }, 'Keep used cards aside until the next Event-deck reshuffle. Keep held Intelligence cards out of the draw pile.'));
  return box;
}
function openEventDeckStatus(s) { openModal(eventDeckStatus(s)); }
