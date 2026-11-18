/* ============================================================================
   User interface (vanilla DOM). Renders the game state and the pending prompt.
   ========================================================================== */
const SAVE_KEY = 'agc_solo_companion_v1';
let G_STATE = null;          // current game state
let UNDO = [];               // JSON snapshots
let UI = { err: '', local: null, localFor: null, showLogAll: false, logFilter: 'all' };

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
function autosave() { try { if (G_STATE) localStorage.setItem(SAVE_KEY, JSON.stringify({ state: G_STATE, undo: UNDO.slice(-25) })); } catch (e) { /* storage full or blocked */ } }
function loadSaved() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function doAct(answer) {
  if (!G_STATE || !G_STATE.prompt) return;
  const snap = JSON.stringify(G_STATE);
  try {
    act(G_STATE, answer);
    UNDO.push(snap); if (UNDO.length > 60) UNDO.shift();
    UI.err = ''; UI.local = null;
  } catch (e) {
    G_STATE = JSON.parse(snap);
    UI.err = e.message || String(e);
    console.error(e);
  }
  autosave(); render();
  const p = $('proc'); if (p) p.scrollTop = 0;
}
function undo() { if (!UNDO.length) return; G_STATE = JSON.parse(UNDO.pop()); UI.err = ''; UI.local = null; autosave(); render(); }
function startGame(human, seed, opts) {
  G_STATE = newGame(human, seed, opts);
  UNDO = [];
  run(G_STATE);
  autosave(); render();
}
function saveText() { return JSON.stringify({ state: G_STATE, undo: [] }); }
function loadFromText(txt) {
  const d = JSON.parse(txt);
  const st = d.state || d;
  if (!st || !st.ships || !st.calls) throw new Error('This does not look like a Solo Companion save.');
  G_STATE = st; UNDO = []; UI.local = null; UI.err = ''; autosave(); closeModal(); render();
}
function exportSave() {
  const box = el('div');
  box.appendChild(el('h2', null, 'Save game'));
  box.appendChild(el('p', null, 'The game also autosaves in this browser. To move it to another device or keep a backup, download the save file or copy the save text.'));
  const msg = el('div', { class: 'muted' });
  box.appendChild(el('div', { class: 'opts' },
    el('button', { class: 'primary', onclick: () => {
      try {
        const blob = new Blob([saveText()], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `agc-${G_STATE.human}-${TURN_NAMES[Math.min(G_STATE.turn, 7)].replace(' ', '')}.json` });
        document.body.appendChild(a); a.click(); a.remove();
        msg.textContent = 'Download started (if nothing happens, your viewer blocks downloads – use Copy instead).';
      } catch (e) { msg.textContent = 'Download is not available here – use Copy instead.'; }
    } }, 'Download .json'),
    el('button', { onclick: async () => {
      try { await navigator.clipboard.writeText(saveText()); msg.textContent = 'Save text copied to the clipboard.'; }
      catch (e) { ta.style.display = 'block'; ta.select(); msg.textContent = 'Copy the text below manually (Ctrl/Cmd+C).'; }
    } }, 'Copy save text')));
  const ta = el('textarea', { style: { display: 'none', width: '100%', height: '120px', marginTop: '6px' }, readonly: true });
  ta.value = saveText();
  box.appendChild(msg); box.appendChild(ta);
  openModal(box);
}
function importSave() {
  const box = el('div');
  box.appendChild(el('h2', null, 'Load game'));
  const msg = el('div', { class: 'err' });
  const inp = el('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { loadFromText(r.result); } catch (e) { msg.textContent = 'Could not read that file: ' + e.message; } };
    r.readAsText(f);
  });
  const ta = el('textarea', { style: { width: '100%', height: '110px' }, placeholder: '…or paste save text here' });
  box.appendChild(el('p', null, 'Choose a saved .json file: ', inp));
  box.appendChild(ta);
  box.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', onclick: () => { try { loadFromText(ta.value); } catch (e) { msg.textContent = 'Could not read that text: ' + e.message; } } }, 'Load pasted text')));
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
function shipChip(s, id, extraClass) {
  const sh = s.ships[id]; const d = def(sh); const v = curVals(sh);
  const isFlag = s.flagship[sh.owner] === id;
  const flags = [d.main ? 'M' : '', d.T && isFull(sh) ? 'T' : '', d.F && isFull(sh) ? 'F' : '', d.cls ? 'CLS' : ''].filter(Boolean).join(' ');
  const title = `${shipName(s, id)} – ${d.type}, ${d.guns} guns${d.main ? ', Main ship' : ', Secondary'}${d.T ? ', can tow' : ''}${d.F ? ', Fast' : ''}\n` +
    `Full: LG ${d.full[0]} Car ${d.full[1]} CA ${d.full[2]} Def ${d.full[3]} (${d.full[4]} steps)\nReduced: LG ${d.red[0]} Car ${d.red[1]} CA ${d.red[2]} Def ${d.red[3]}\nVP if destroyed/captured: ${d.vp[0]}/${d.vp[1]}`;
  return el('span', { class: `ship ${sh.owner} ${isReduced(sh) ? 'red' : ''} ${isFlag ? 'flag' : ''} ${extraClass || ''}`, title },
    el('span', { class: 'nm' }, (isFlag ? '★ ' : '') + d.name + (d.ver ? ' ' + d.ver : '')),
    el('span', { class: 'st' }, `${v[0]}·${v[1]}·${v[2]}·${v[3]} `, el('span', { class: 'dots' }, dots(sh)), flags ? ' ' + flags : ''));
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
  if (!s) {
    h.appendChild(el('div', { class: 'btns' }, el('button', { onclick: importSave }, 'Load game'), el('button', { onclick: () => openRef() }, 'Reference')));
    return;
  }
  const tt = el('div', { class: 'turntrack' });
  TURN_NAMES.forEach((n, i) => tt.appendChild(el('span', { class: i === s.turn ? 'cur' : i < s.turn ? 'past' : '' }, n.replace('September', 'Sep').replace('August', 'Aug').replace('June', 'Jun').replace('July', 'Jul'))));
  const score = gameScore(s);
  h.appendChild(el('div', { class: 'stat' }, el('span', null, `${SIDE_NAME[s.human]} campaign`), tt));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'VP U.S. / Br.'), el('b', null, `${sgn(s.vp.US)} / ${sgn(-s.vp.BR)}`)));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Game Score'), el('b', null, `${score >= 0 ? '+' : ''}${score}`), el('span', null, victoryLevel(score))));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Naval Balance'), el('b', null, `${s.nb >= 0 ? '+' : ''}${s.nb}`), el('span', null, NB_LABELS[s.nbBand])));
  h.appendChild(el('div', { class: 'stat' }, el('span', null, 'Leaders'), el('span', null, `U.S.: ${leaderName(s, 'US')}${s.leader.US.wounded ? ' (W)' : ''}`), el('span', null, `Br.: ${leaderName(s, 'BR')}${s.leader.BR.wounded ? ' (W)' : ''}`)));
  h.appendChild(el('div', { class: 'btns' },
    el('button', { onclick: undo, disabled: !UNDO.length, title: 'Undo the last decision (dice included)' }, '↶ Undo'),
    el('button', { onclick: exportSave }, 'Save'),
    el('button', { onclick: importSave }, 'Load'),
    el('button', { onclick: () => openRef() }, 'Reference'),
    el('button', { onclick: () => openAdjust() }, 'Adjust'),
    el('button', { onclick: () => openSettings() }, 'Settings'),
    el('button', { onclick: () => confirmBox('New game?', 'Abandon this game and return to the setup screen? (Save it first if you want to keep it.)', 'Abandon game', () => { G_STATE = null; UNDO = []; try { localStorage.removeItem(SAVE_KEY); } catch (e) { } render(); }) }, 'New game')));
}

/* ---------- procedure panel ---------- */
function renderProc(s) {
  const p = $('proc'); p.innerHTML = '';
  p.appendChild(el('div', { class: 'step' }, `${TURN_NAMES[Math.min(s.turn, 7)]} · ${s.stepLabel || ''}`));
  if (s.over) {
    p.appendChild(el('div', { class: 'ptitle' }, 'Game Over'));
    p.appendChild(el('div', { class: 'ptext' }, `Final Game Score: ${sgn(s.result.score)}\n${s.result.level}\n\nU.S. VP ${sgn(s.vp.US)} · British VP ${sgn(-s.vp.BR)} (British VPs count negative).`));
    p.appendChild(vpBreakdown(s));
    return;
  }
  const pr = s.prompt;
  if (!pr) { p.appendChild(el('div', null, 'Working…')); return; }
  if (UI.localFor !== pr.id) { UI.local = null; UI.localFor = pr.id; }
  p.appendChild(el('div', { class: 'ptitle' }, pr.title || ''));
  if (pr.eventCard) p.appendChild(eventCardView(pr.eventCard));
  if (pr.targetCard) p.appendChild(targetCardView(s, pr.targetCard));
  if (pr.text && pr.kind !== 'assign') p.appendChild(el('div', { class: 'ptext' }, pr.text));
  if (pr.combatView || pr.combatPreview) { const cv = combatView(s); if (cv) p.appendChild(cv); }
  const body = el('div');
  if (pr.kind === 'info') body.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', onclick: () => doAct('ok'), id: 'btn-ok' }, 'Continue')));
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
    pr.options.forEach(o => box.appendChild(el('div', { class: `optcard tac-${o.color || 'white'}`, onclick: () => doAct(o.id) }, el('div', { class: 't' }, o.label), el('div', { class: 'd' }, o.desc || ''))));
    return box;
  }
  const box = el('div', { class: 'opts' });
  pr.options.forEach(o => box.appendChild(el('button', { class: o.primary ? 'primary' : '', disabled: o.disabled, onclick: () => doAct(o.id) }, o.label)));
  return box;
}
function renderSelect(s, pr) {
  if (!UI.local) UI.local = { sel: (pr.initial || []).slice() };
  const L = UI.local;
  const wrap = el('div');
  const list = el('div', { class: 'sel-list' });
  let lastGroup = null;
  pr.items.forEach(it => {
    if (it.group && it.group !== lastGroup) { lastGroup = it.group; const g = (pr.groups || []).find(x => x.key === it.group); list.appendChild(el('div', { class: 'sel-group' }, g ? `${g.label} (DRM ${g.drm >= 0 ? '+' : ''}${g.drm})` : it.group)); }
    const cb = el('input', { type: 'checkbox', checked: L.sel.indexOf(it.id) >= 0 ? true : null });
    cb.addEventListener('change', () => { if (cb.checked) { if (L.sel.indexOf(it.id) < 0) L.sel.push(it.id); } else L.sel = L.sel.filter(x => x !== it.id); renderProc(s); });
    list.appendChild(el('label', null, cb, it.label));
  });
  wrap.appendChild(list);
  if (pr.pkg) wrap.appendChild(packageHelper(s, pr, L));
  const err = validateAnswer(s, pr, L.sel);
  let extra = '';
  if (pr.validate === 'squadron30') { const keep = pr.items.filter(i => L.sel.indexOf(i.id) < 0); extra = `Deployable squadron: ${sumBy(keep, i => i.ca)} / 30 Close Action points.`; }
  if (extra) wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '4px' } }, extra));
  const row = el('div', { class: 'opts' });
  if (pr.items.length > 3) row.appendChild(el('button', { class: 'small', onclick: () => { L.sel = pr.items.map(i => i.id).slice(0, pr.max == null ? 999 : pr.max); renderProc(s); } }, 'Select all'));
  row.appendChild(el('button', { class: 'small', onclick: () => { L.sel = []; renderProc(s); } }, 'Clear'));
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
    const cb = el('input', { type: 'checkbox', checked: L.att.indexOf(id) >= 0 ? true : null });
    cb.addEventListener('change', () => {
      if (cb.checked) L.att.push(id); else { L.att = L.att.filter(x => x !== id); delete L.tows[id]; Object.keys(L.tows).forEach(t => { if (L.tows[t] === id) delete L.tows[t]; }); }
      renderProc(s);
    });
    const row = el('label', null, cb, shipChip(s, id));
    if (canTow(sh) && !isCLS(sh) && L.att.indexOf(id) >= 0) {
      const sel = el('select', null, el('option', { value: '' }, '— no tow —'));
      L.att.filter(x => isCLS(s.ships[x])).forEach(x => {
        const takenBy = Object.keys(L.tows).find(t => L.tows[t] === x && t !== id);
        if (!takenBy) sel.appendChild(el('option', { value: x, selected: L.tows[id] === x ? true : null }, 'tows ' + def(s.ships[x]).name));
      });
      sel.addEventListener('change', () => { if (sel.value) L.tows[id] = sel.value; else delete L.tows[id]; renderProc(s); });
      row.appendChild(sel);
    }
    list.appendChild(row);
  });
  wrap.appendChild(list);
  const ans = { attackers: L.att.slice(), tows: Object.assign({}, L.tows) };
  const err = validateAnswer(s, pr, ans);
  if (pr.side === 'US') {
    const towed = Object.values(L.tows);
    const unt = L.att.filter(id => isCLS(s.ships[id]) && towed.indexOf(id) < 0).length;
    wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '4px' } }, unt ? `${unt} untowed Laker Schooner(s): roll 1d6 – ≤ ${unt / 2} gives −2 DRM, ≤ ${unt} gives −1.` : 'No untowed Laker Schooners – no DRM penalty.'));
  }
  const def_ = encIds(s, OTHER[pr.side]);
  const str = sideStrength(s, L.att, pr.side, hazeActive(s)), dstr = sideStrength(s, def_, pr.side, hazeActive(s));
  wrap.appendChild(el('div', { class: 'muted' }, `Gunnery strength ${fmt(str)} vs ${fmt(dstr)} → ${dstr ? fmt(str / dstr) : '∞'}:1 (${CRT_COLS[crtColumnForRatio(dstr ? str / dstr : 99)]})${hazeActive(s) ? ' – Haze: no Long Guns in Gunnery Round 1' : ''}.`));
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', disabled: !!err, onclick: () => doAct(ans) }, 'Attack with these ships')));
  if (err) wrap.appendChild(el('div', { class: 'err' }, err));
  return wrap;
}

/* Force Package helper (British campaign): totals + auto-fill + per-package memory */
const PKG_KEY = 'agc_pkg_memory_v1';
function pkgMemory() { try { return JSON.parse(localStorage.getItem(PKG_KEY) || '{}'); } catch (e) { return {}; } }
function savePkgMemory(m) { try { localStorage.setItem(PKG_KEY, JSON.stringify(m)); } catch (e) { } }
function pkgAutoFill(s, pool, rule) {
  const ships = pool.map(id => s.ships[id]);
  const rnd = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const mains = rnd(ships.filter(isMain)), secs = rnd(ships.filter(sh => !isMain(sh)));
  const out = [];
  if (rule.type === 'ships') {
    mains.concat(secs).slice(0, rule.n).forEach(sh => out.push(sh.id));
    return out.length === rule.n ? out : [];
  }
  const key = rule.type === 'lg' ? lg : rule.type === 'ca' ? ca : car;
  // Main Ships first (largest value first = fewest ships), then Secondary Ships drawn at random [5.3.1]
  let tot = 0;
  mains.sort((a, b) => key(b) - key(a)).forEach(sh => { if (tot < rule.n && key(sh) > 0) { out.push(sh.id); tot += key(sh); } });
  secs.forEach(sh => { if (tot < rule.n && key(sh) > 0) { out.push(sh.id); tot += key(sh); } });
  return tot >= rule.n ? out : [];
}
function packageHelper(s, pr, L) {
  const box = el('div', { class: 'banner' });
  const sel = L.sel.map(id => s.ships[id]);
  box.appendChild(el('div', null, el('b', null, `Selected: ${sel.length} ship(s) – `), `Main ${sel.filter(isMain).length} · LG ${sumBy(sel, lg)} · Car ${sumBy(sel, car)} · CA ${sumBy(sel, ca)} (carries ${Math.floor(sumBy(sel, ca) / 4)} Troops) · Def ${sumBy(sel, dfn)} · ${sumBy(sel, guns)} guns`));
  const mem = pkgMemory();
  const rule = mem[pr.pkg] || { type: 'lg', n: 0 };
  const tSel = el('select', null, ...[['lg', 'Long Gun ≥'], ['ca', 'Close Action ≥'], ['car', 'Carronade ≥'], ['ships', 'Number of ships =']].map(([v, l]) => el('option', { value: v, selected: rule.type === v ? true : null }, l)));
  const nIn = el('input', { type: 'number', min: 0, value: rule.n || '', style: { width: '60px' } });
  const remember = el('input', { type: 'checkbox', checked: true });
  const apply = () => {
    if (!G_STATE.prompt || G_STATE.prompt.id !== pr.id) return;
    const r = { type: tSel.value, n: +nIn.value || 0 };
    if (remember.checked && r.n) { mem[pr.pkg] = r; savePkgMemory(mem); }
    const pick_ = pkgAutoFill(s, pr.items.map(i => i.id), r);
    L.sel = pick_;
    L.msg = pick_.length ? `Auto-filled for ${r.type === 'ships' ? r.n + ' ships' : r.type.toUpperCase() + ' ≥ ' + r.n}.` : `Package #${pr.pkg} cannot be met with the ships available – confirm with nothing selected for no Deployment.`;
    renderProc(s);
  };
  box.appendChild(el('div', { style: { marginTop: '4px' } }, `Auto-fill Package #${pr.pkg}: `, tSel, ' ', nIn, ' ', el('button', { class: 'small', onclick: apply }, 'Auto-fill'), ' ', el('label', { style: { display: 'inline' } }, remember, ' remember for this package')));
  if (mem[pr.pkg] && !L.autoDone) { L.autoDone = true; setTimeout(apply, 0); }
  if (L.msg) box.appendChild(el('div', null, el('b', null, L.msg)));
  box.appendChild(el('div', { class: 'muted', style: { fontSize: '.8rem' } }, 'Reads Main ships first (fewest ships), then Secondary ships at random, as in 5.3.1. Adjust the ticks by hand if Player Aid V asks for something more specific.'));
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
  const fs = el('select', null);
  pr.flagshipOptions.forEach(id => fs.appendChild(el('option', { value: id, selected: id === L.flagship ? true : null }, shipName(s, id))));
  fs.addEventListener('change', () => { L.flagship = fs.value; });
  wrap.appendChild(el('div', { class: 'row' }, el('b', null, 'Flagship: '), fs));
  const used = {}; L.forces.forEach(f => f.ships.forEach(id => { used[id] = f; }));
  L.forces.forEach((f, i) => {
    const box = el('div', { class: 'asg-force' });
    const mSel = el('select', null);
    Object.keys(mz).forEach(m => mSel.appendChild(el('option', { value: m, selected: f.mission === m ? true : null }, MISSION_NAME[m])));
    mSel.addEventListener('change', () => { f.mission = mSel.value; if (mz[f.mission].indexOf(f.zone) < 0) f.zone = mz[f.mission][0]; if (f.mission !== 'ArmySupport') f.troops = 0; else f.troops = Math.max(1, f.troops || 0); renderProc(s); });
    const zSel = el('select', null);
    mz[f.mission].forEach(z => zSel.appendChild(el('option', { value: z, selected: f.zone === z ? true : null }, z === 'ESC' ? 'Escort Convoy box' : ZONE_NAME[z])));
    zSel.addEventListener('change', () => { f.zone = zSel.value; renderProc(s); });
    const row = el('div', { class: 'row' }, el('b', null, `Force ${i + 1}`), mSel, zSel);
    if (f.mission === 'ArmySupport') {
      const cap = troopCapacity(s, f.ships);
      const tIn = el('input', { type: 'number', min: 1, max: pr.troops, value: f.troops || 1, style: { width: '52px' } });
      tIn.addEventListener('change', () => { f.troops = Math.max(0, +tIn.value || 0); renderProc(s); });
      row.appendChild(el('span', null, ' Troops ', tIn, ` (capacity ${cap})`));
    }
    row.appendChild(el('button', { class: 'small', onclick: () => { L.forces.splice(i, 1); renderProc(s); } }, 'Remove'));
    box.appendChild(row);
    const ships = el('div', { class: 'asg-ships' });
    pr.ships.forEach(id => {
      const mine = f.ships.indexOf(id) >= 0; const taken = used[id] && !mine;
      const d = def(s.ships[id]);
      ships.appendChild(el('span', { class: `asg-ship ${mine ? 'on' : ''} ${taken ? 'taken' : ''}`, title: `LG ${lg(s.ships[id])} Car ${car(s.ships[id])} CA ${ca(s.ships[id])} Def ${dfn(s.ships[id])}`,
        onclick: () => { if (taken) return; if (mine) f.ships = f.ships.filter(x => x !== id); else f.ships.push(id); renderProc(s); } }, d.name + (d.ver ? ' ' + d.ver : '') + (s.ships[id].port === 'temp' ? ' (Isolated)' : '')));
    });
    box.appendChild(ships);
    const fShips = f.ships.map(id => s.ships[id]);
    box.appendChild(el('div', { class: 'muted', style: { fontSize: '.8rem', marginTop: '3px' } }, f.ships.length ? `LG ${sumBy(fShips, lg)} · Car ${sumBy(fShips, car)} · CA ${sumBy(fShips, ca)} · Def ${sumBy(fShips, dfn)} · ${sumBy(fShips, guns)} guns · defending vs British attack ${fmt(sideStrength(s, f.ships, 'BR'))}, vs U.S. attack ${fmt(sideStrength(s, f.ships, 'US'))}` : 'Click ships to add them to this Force.'));
    wrap.appendChild(box);
  });
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { onclick: () => { L.forces.push({ mission: 'Patrol', zone: Object.keys(mz).length ? mz.Patrol[0] : 'YOR', ships: [], troops: 0 }); renderProc(s); } }, '+ Add Force')));
  const port = pr.ships.filter(id => !used[id]);
  wrap.appendChild(el('div', { class: 'muted', style: { marginTop: '6px' } }, `Staying in port: ${port.map(id => shipName(s, id)).join(', ') || 'none'}.`));
  const ans = { flagship: L.flagship, forces: L.forces.map(f => ({ zone: f.zone, mission: f.mission, ships: f.ships.slice(), troops: f.mission === 'ArmySupport' ? (f.troops || 0) : 0 })) };
  const err = validateAnswer(s, pr, ans);
  wrap.appendChild(el('div', { class: 'opts' }, el('button', { class: 'primary', disabled: !!err, onclick: () => doAct(ans) }, 'Confirm assignments')));
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
    el('div', null, el('b', null, 'Coastal: '), EVENT_TITLE[ev.coastal] + (ev.coastal !== 'none' && ev.coastal !== 'gale' ? ' – ' + EVENT_TEXT[ev.coastal]() : '')));
}
function targetCardView(s, id) {
  const c = TARGET_CARDS[id];
  const cell = cardCell(s, c);
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
    tbl,
    el('div', { class: 'muted' }, `${c.lastTurn ? '[removed on the final turn] ' : ''}${c.isolated ? '[hourglass: removed when the AI has Isolated ships]' : ''}`));
}

/* ---------- combat view ---------- */
function combatView(s) {
  const e = s.encounter, c = s.combat;
  if (!e) return null;
  const wrap = el('div');
  const head = el('div', { class: 'muted' }, `${ZONE_NAME[e.zone]} · ${e.kind === 'harbor' ? 'Harbor Encounter' : (e.segment === 'patrol' ? 'Patrol Segment' : 'Reaction Segment')} · Weather Gage: ${e.wg ? SIDE_NAME[e.wg] : '—'}${c && c.seq && e.kind !== 'harbor' ? ` · Combat Sequence ${c.seq}` : ''}`);
  wrap.appendChild(head);
  const grid = el('div', { class: 'combat' });
  ['US', 'BR'].forEach(side => {
    const col = el('div', { class: `colm ${side}` }, el('b', null, `${SIDE_NAME[side]}${c ? (c.att === side ? ' – attacking' : ' – defending') : ''}`));
    const ids = c && c.col[side] && c.col[side].length ? c.col[side] : encIds(s, side);
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
  tracks.appendChild(el('div', null, el('b', null, 'Troops '), `You: ${s.troops[h].available} available${s.troops[h].track.length ? ', on track at ' + s.troops[h].track.join(', ') : ''}. A.I.: ${aiTroopsInBox(s)} available, ${s.aiTroops.box.filter(m => !m.revealed).length} unrevealed, ${s.aiTroops.track.length} on track.`));
  tracks.appendChild(el('div', null, el('b', null, 'Your Convoys '), convTxt));
  tracks.appendChild(el('div', null, el('b', null, 'Flagships '), `U.S.: ${shipName(s, s.flagship.US)} · Br.: ${shipName(s, s.flagship.BR)}`));
  tr.appendChild(tracks);
  b.appendChild(tr);
  // Lake
  const lp = el('div', { class: 'panel' });
  lp.appendChild(el('h2', null, 'Lake Ontario'));
  const lake = el('div', { id: 'lake' });
  (window.innerWidth <= 640 ? ['YOR', 'NIA', 'NOR', 'SOU', 'KIN', 'SAC'] : ['YOR', 'NOR', 'KIN', 'NIA', 'SOU', 'SAC']).forEach(z => lake.appendChild(zoneView(s, z)));
  lp.appendChild(lake);
  // Target row
  if (s.targetRow && s.targetRow.length) {
    lp.appendChild(el('h3', null, 'Target Card row'));
    const row = el('div', { class: 'cardrow' });
    s.targetRow.forEach((c, i) => {
      const tc = TARGET_CARDS[c.id];
      const pe = s.pe.filter(p => p.idx === i).map(p => 'PE' + p.num + (p.status === 'encounter' || p.status === 'ended' && c.enc ? '★' : ''));
      row.appendChild(el('div', { class: `tcard ${c.revealed ? 'rev' : 'back'} ${c.removed ? 'removed' : ''}`, title: c.revealed ? `${c.id} ${MISSION_NAME[tc.mission]}${tc.secondary ? ' (' + MISSION_NAME[tc.secondary] + ')' : ''}` : 'face down' },
        el('div', null, `${i + 1}. `, el('span', { class: 'z' }, ZONE_NAME[tc.zone])),
        c.revealed ? el('div', null, `${c.id} ${MISSION_NAME[tc.mission]}`) : null,
        pe.length ? el('div', null, pe.join(' ')) : null));
    });
    lp.appendChild(row);
  }
  b.appendChild(lp);
  // Ports
  const pp = el('div', { class: 'ports' });
  ['US', 'BR'].forEach(side => pp.appendChild(portView(s, side)));
  const pw = el('div', { class: 'panel' }, el('h2', null, 'Homeport Displays'), el('div', { class: 'muted', style: { fontSize: '.78rem' } }, 'Ship chips: Long Gun · Carronade · Close Action · Defense, then Steps (● remaining, ○ lost). M = Main ship, T = can tow, F = Fast, CLS = Converted Laker Schooner, ★ = Flagship. Hatched = Reduced. Hover for full details.'), pp);
  b.appendChild(pw);
  // Log
  const lg_ = el('div', { class: 'panel' });
  const filt = el('select', null, ...['all', 'combat', 'ai', 'roll', 'vp', 'player'].map(k => el('option', { value: k, selected: UI.logFilter === k ? true : null }, k)));
  filt.addEventListener('change', () => { UI.logFilter = filt.value; renderBoard(s); });
  lg_.appendChild(el('h2', null, 'Log ', filt));
  const logBox = el('div', { id: 'log' });
  const entries = s.log.filter(l => UI.logFilter === 'all' || l.kind === UI.logFilter || (UI.logFilter === 'combat' && (l.kind === 'roll' || l.kind === 'event')));
  entries.slice(-400).reverse().forEach(l => logBox.appendChild(el('div', { class: l.kind }, `${TURN_NAMES[Math.min(l.turn, 7)].replace('September', 'Sep')} · ${l.text}`)));
  lg_.appendChild(logBox);
  b.appendChild(lg_);
}
function zoneView(s, z) {
  const zs = s.zones[z];
  const encHere = s.encounter && s.encounter.zone === z;
  const box = el('div', { class: `zone ${zs.control ? 'ctl-' + zs.control : ''} ${encHere ? 'enc' : ''}` });
  box.appendChild(el('div', { class: 'zh' }, el('span', null, ZONE_NAME[z]), el('span', { class: 'muted', style: { fontWeight: 'normal', fontSize: '.7rem' } }, COAST_OWNER[z] ? `${SIDE_SHORT[COAST_OWNER[z]]} coast` : 'contested coast')));
  const tags = el('div', { class: 'tags' });
  if (zs.control) tags.appendChild(el('span', { class: 'tag ' + zs.control.toLowerCase() }, `${SIDE_SHORT[zs.control]} control`));
  if (zs.blockade) tags.appendChild(el('span', { class: 'tag blk' }, `${SIDE_SHORT[zs.blockade]} Blockade`));
  if (zs.event) { const ev = EVENTS[zs.event]; tags.appendChild(el('span', { class: 'tag ev', title: EVENT_TEXT[ev.lake](ev.lakeSide) }, `${EVENT_TITLE[ev.lake]}${ev.lakeSide ? ' (' + SIDE_SHORT[ev.lakeSide] + ')' : ''}`)); }
  if (z === homeZone('US')) tags.appendChild(el('span', { class: 'tag us' }, "Sacket's Harbor"));
  if (z === homeZone('BR')) tags.appendChild(el('span', { class: 'tag br' }, 'Kingston Harbour'));
  (s.coastal.raids || []).filter(r => r.zone === z).forEach(r => tags.appendChild(el('span', { class: 'tag ' + r.side.toLowerCase() }, `${SIDE_SHORT[r.side]} Raid marker`)));
  (s.coastal.battles || []).filter(bt => bt.zone === z).forEach(bt => tags.appendChild(el('span', { class: 'tag ' + bt.side.toLowerCase() }, `Land Battle: ${LB_RESULTS.find(x => x.id === bt.result).label}`)));
  if (s.convoyDeployed.US && s.convoyDeployed.US.zone === z) tags.appendChild(el('span', { class: 'tag us' }, 'U.S. Convoy'));
  if (s.convoyDeployed.BR && s.convoyDeployed.BR.zone === z) tags.appendChild(el('span', { class: 'tag br' }, 'British Convoy'));
  box.appendChild(tags);
  forcesInZone(s, z).forEach(f => {
    const pes = s.pe.filter(p => p.forceId === f.id && (p.status === 'possible' || p.status === 'encounter'));
    const fb = el('div', { class: `force ${f.side}` }, el('div', { class: 'fh' }, `${MISSION_NAME[f.mission] || f.mission}${f.troops ? ' · ' + f.troops + ' Troops' : ''}${f.ended ? ' · Enc. ended' : ''}${pes.length ? ' · ' + pes.map(p => (p.status === 'encounter' ? 'Enc ' : 'PE') + p.num).join(' ') : ''}`));
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
    el('i', null, 'A Glorious Chance: The Naval Struggle for Lake Ontario in the War of 1812'), ' (Legion Wargames). Keep your physical map, counters and cards in front of you – the app tells you what to move, and it draws the cards for you.'));
  if (saved && saved.state && !saved.state.over) box.appendChild(el('div', { class: 'banner' }, `A game in progress was found: ${SIDE_NAME[saved.state.human]} campaign, ${TURN_NAMES[saved.state.turn]}. `, el('button', { class: 'primary', onclick: () => { G_STATE = saved.state; UNDO = saved.undo || []; render(); } }, 'Continue it')));
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
  box.appendChild(opt('confirmAiSteps', 'Pause after each A.I. move so I can mirror it on the board'));
  box.appendChild(opt('manualPackages', 'British campaign: pick the American Force Package ships myself (default: the app applies Player Aid V automatically)'));
  box.appendChild(opt('manualLandBattle', 'Read the Land Battle Table myself (default: the app applies Player Aid VII automatically)'));
  const pc = el('select', null, el('option', { value: 'longgun' }, 'Long Gun + Defense (Lake Combat Sequences of Play mat)'), el('option', { value: 'carronade' }, 'Carronade + Defense (British Living Rules LC1 text)'));
  pc.onchange = () => { st.opts.usAiPrecondition = pc.value; };
  box.appendChild(el('label', null, 'British campaign – A.I. American attack precondition: ', pc));
  const seedIn = el('input', { type: 'number', value: st.seed, style: { width: '140px' } });
  seedIn.onchange = () => { st.seed = +seedIn.value || 1; };
  box.appendChild(el('label', null, 'Random seed: ', seedIn, el('span', { class: 'muted' }, ' (same seed + same choices = same game)')));
  box.appendChild(el('div', { class: 'opts', style: { marginTop: '12px' } }, el('button', { class: 'primary', onclick: () => startGame(st.human, st.seed, st.opts) }, 'Start campaign'), el('button', { onclick: importSave }, 'Load a saved game')));
  box.appendChild(el('h3', null, 'Physical setup reminders'));
  box.appendChild(el('ul', null,
    el('li', null, 'Set up the map, Homeport Displays and markers per the rulebook 3.1 / Player Aid II or IV. The app has already shuffled the decks, hidden the A.I. Convoy and A.I. Troops markers, and rolled your Troops markers onto your Convoy Supply Track (see the log).'),
    el('li', null, 'You do not need to draw Target, Event or Tactic cards – the app draws them and shows you each card.'),
    el('li', null, 'Every A.I. decision, dieroll and table lookup is shown in the log. Use Undo if you click the wrong thing, and Adjust to correct anything by hand.')));
  p.appendChild(box);
}

/* ---------- modals ---------- */
function openModal(content) {
  const m = $('modal'); m.innerHTML = '';
  const inner = el('div', { class: 'inner' }, el('div', { style: { textAlign: 'right' } }, el('button', { onclick: closeModal }, 'Close')), content);
  m.appendChild(inner); m.classList.add('open');
  m.onclick = (e) => { if (e.target === m) closeModal(); };
}
function closeModal() { $('modal').classList.remove('open'); }
function openRef() {
  const r = el('div', { class: 'ref' });
  r.appendChild(el('h2', null, 'Lake Combat Table'));
  const t = el('table', null, el('tr', null, el('th', null, 'd10'), ...CRT_COLS.map(c => el('th', null, c))));
  CRT.forEach((row, i) => t.appendChild(el('tr', null, el('th', null, String(i)), ...row.map(x => el('td', null, x)))));
  r.appendChild(t);
  r.appendChild(el('p', null, 'British attack: ½ Long Gun + Carronade + Defense. American attack: Long Gun + ½ Carronade + Defense (both sides use the attacker\'s formula). Shore batteries −1 column. +1 Command DRM (Yeo, or Sinclair for the U.S.). Untowed U.S. Laker Schooners: 1d6 ≤ half their number −2, ≤ their number −1.'));
  r.appendChild(el('h2', null, 'Convoy Scatter Table (1d10)'));
  const t2 = el('table', null, el('tr', null, el('th', null, 'Guns'), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => el('th', null, String(i)))));
  SCATTER.forEach((row, i) => t2.appendChild(el('tr', null, el('th', null, SCATTER_ROWS[i][1] > 999 ? '96+' : SCATTER_ROWS[i].join('–')), ...row.split('').map(x => el('td', null, x)))));
  r.appendChild(t2);
  r.appendChild(el('h2', null, 'Land Battle Table (Player Aid VII) – roll 11-66'));
  const lbt = el('table', null, el('tr', null, el('th', null, 'Long Gun / Troops'), ...['Def. Major', 'Def. Success', 'Draw', 'Att. Success', 'Att. Major', 'Feat of Arms'].map(h => el('th', null, h))));
  LB_TABLE.forEach((band, bi) => band.forEach((col, ti) => lbt.appendChild(el('tr', null, el('th', null, `${LB_BANDS[bi]} / ${ti + 1}`), ...col.map(rg => el('td', null, rg ? (rg[0] === rg[1] ? String(rg[0]) : rg[0] + '–' + rg[1]) : '—'))))));
  r.appendChild(lbt);
  r.appendChild(el('p', null, 'Niagara Front: British Feat of Arms 3 right, Major 2, Success 1; U.S. Success 1 left, Major 2, Feat of Arms 3. Homeport: Attacker Major Success / Feat of Arms → Shipyard Damage Table; any Attacker Success or better → the defender’s Convoy Supply −2 (Living Rules F5.3).'));
  r.appendChild(el('h2', null, 'American A.I. Force Packages (Player Aid V)'));
  const fpt = el('table', null, el('tr', null, el('th', null, '#'), el('th', null, 'Requirements')));
  Object.keys(FORCE_PACKAGE_TEXT).forEach(k => fpt.appendChild(el('tr', null, el('th', null, k), el('td', { style: { textAlign: 'left' } }, FORCE_PACKAGE_TEXT[k]))));
  r.appendChild(fpt);
  r.appendChild(el('p', null, FORCE_PACKAGE_FOOTNOTE + ' Selection [5.3.1]: Main Ships first, then Secondary; the smallest number of ships; ties by random draw.'));
  r.appendChild(el('h2', null, 'Checks'));
  r.appendChild(el('ul', null,
    el('li', null, 'Disengagement: 1d6 1–3 Disengages (−1 per friendly ship already Struck). Fast ships pass their first check automatically.'),
    el('li', null, 'Strike Check: 1d10 1–2 Fight On, 3–8 Strike Colors, 9–10 Sinks (−1 Flagship with original Leader; +1 per hit on a zero-step ship).'),
    el('li', null, 'Leader Casualty: 2d6 10 Wounded, 11–12 Killed (+1 hit in Close Action, +1 win Melee, +2 lose Melee).'),
    el('li', null, 'Close Action: 2:1 CA or better; 1d10 ≤ difference = step loss, otherwise Melee (d6 + CA each; 150% captures).'),
    el('li', null, 'Reaction Check: 1d10 5–9 succeeds; +1 same zone, −1 per zone of distance (Homeport to its zone = 1). A.I. Homeport pool: no modifiers.'),
    el('li', null, 'Struck ships at Encounter end: Captured if their side withdrew/was eliminated, rescued if the enemy did, otherwise 1d6 1–3 Captured.')));
  r.appendChild(el('h2', null, 'Ships'));
  const t3 = el('table', null, el('tr', null, ...['Ship', 'Type', 'Guns', 'Full LG/Car/CA/Def/Steps', 'Reduced', 'VP D/C', 'Notes'].map(h => el('th', null, h))));
  SHIP_DEFS.forEach(d => t3.appendChild(el('tr', null, el('td', { class: d.side === 'US' ? 'us' : 'br' }, d.name + (d.ver ? ' (' + d.ver + ')' : '')), el('td', null, d.type), el('td', null, String(d.guns)), el('td', null, d.full.join('/')), el('td', null, d.red.join('/')), el('td', null, d.vp.join('/')), el('td', null, [d.main ? 'Main' : 'Secondary', d.T ? 'T' : '', d.F ? 'F' : ''].filter(Boolean).join(' ')))));
  r.appendChild(t3);
  r.appendChild(el('h2', null, 'Victory'));
  r.appendChild(el('p', null, '−33 or less British Decisive · −22 to −32 British Victory · −11 to −21 British Marginal · −10 to +10 Draw · +11 to +21 U.S. Marginal · +22 to +32 U.S. Victory · +33 or more U.S. Decisive. Construction Delay left at the end is deducted from each side.'));
  openModal(r);
}
function openSettings() {
  const s = G_STATE; if (!s) return;
  const box = el('div');
  box.appendChild(el('h2', null, 'Settings'));
  const cb = el('input', { type: 'checkbox', checked: s.options.confirmAiSteps ? true : null });
  cb.onchange = () => { s.options.confirmAiSteps = cb.checked; autosave(); };
  box.appendChild(el('label', null, cb, ' Pause after each A.I. move'));
  const tog = (k, label) => { const c = el('input', { type: 'checkbox', checked: s.options[k] ? true : null }); c.onchange = () => { s.options[k] = c.checked; autosave(); }; return el('label', null, c, ' ', label); };
  box.appendChild(tog('manualPackages', 'Pick American Force Package ships myself (British campaign)'));
  box.appendChild(tog('manualLandBattle', 'Read the Land Battle Table myself'));
  box.appendChild(el('p', { class: 'muted' }, `Seed ${s.seed} · Cutting-Out ${s.options.cuttingOut ? 'on' : 'off'} · OA1 ${s.options.oa1Upgrades ? 'on' : 'off'} · U.S. A.I. precondition: ${s.options.usAiPrecondition}. App version ${APP_VERSION}.`));
  openModal(box);
}
function openAdjust() {
  const s = G_STATE; if (!s) return;
  const box = el('div');
  box.appendChild(el('h2', null, 'Adjust (manual corrections)'));
  box.appendChild(el('p', { class: 'muted' }, 'Use this to match the app to your table if something went differently. Every change is logged and can be undone.'));
  const num = (label, get, set) => {
    const inp = el('input', { type: 'number', value: get(), style: { width: '70px' } });
    return el('label', null, label + ' ', inp, ' ', el('button', { class: 'small', onclick: () => { UNDO.push(JSON.stringify(s)); set(+inp.value); log(s, `Manual adjustment: ${label} = ${inp.value}`, 'player'); autosave(); render(); openAdjust(); } }, 'Set'));
  };
  box.appendChild(num('U.S. VP', () => s.vp.US, v => { s.vp.US = v; }));
  box.appendChild(num('British VP', () => s.vp.BR, v => { s.vp.BR = v; }));
  box.appendChild(num('U.S. Convoy Supply', () => s.supply.US, v => { s.supply.US = clampSupply(v); }));
  box.appendChild(num('British Convoy Supply', () => s.supply.BR, v => { s.supply.BR = clampSupply(v); }));
  box.appendChild(num('U.S. Construction Delay', () => s.cd.US, v => { s.cd.US = Math.max(0, v); }));
  box.appendChild(num('British Construction Delay', () => s.cd.BR, v => { s.cd.BR = Math.max(0, v); }));
  box.appendChild(num('Niagara Front (0 Burlington … 6 Fort George)', () => s.niagara, v => { s.niagara = Math.max(0, Math.min(6, v)); }));
  box.appendChild(num('Your Available Troops', () => s.troops[s.human].available, v => { s.troops[s.human].available = Math.max(0, v); }));
  box.appendChild(el('h3', null, 'Ships'));
  const sel = el('select', null); Object.keys(s.ships).forEach(id => sel.appendChild(el('option', { value: id }, `${shipName(s, id)} – ${BOX_NAME[s.ships[id].box]}`)));
  const boxSel = el('select', null); ['deployable', 'makeReady', 'repairing', 'construction', 'ordinary', 'transit', 'sunk', 'outOfPlay'].forEach(b => boxSel.appendChild(el('option', { value: b }, BOX_NAME[b])));
  const stepIn = el('input', { type: 'number', min: 0, max: 3, style: { width: '50px' } });
  const ownSel = el('select', null, el('option', { value: 'US' }, 'U.S.'), el('option', { value: 'BR' }, 'British'));
  const sync = () => { const sh = s.ships[sel.value]; boxSel.value = sh.box === 'lake' ? 'deployable' : sh.box; stepIn.value = sh.steps; ownSel.value = sh.owner; };
  sel.onchange = sync; sync();
  box.appendChild(el('div', null, sel, ' box ', boxSel, ' steps ', stepIn, ' owner ', ownSel, ' ', el('button', { class: 'small', onclick: () => {
    UNDO.push(JSON.stringify(s));
    const sh = s.ships[sel.value];
    if (sh.forceId) removeShipFromForce(s, sh.id);
    sh.box = boxSel.value; sh.zone = null; sh.owner = ownSel.value; sh.steps = Math.max(0, Math.min(def(sh).full[4], +stepIn.value));
    log(s, `Manual adjustment: ${shipName(s, sh.id)} → ${BOX_NAME[sh.box]}, ${sh.steps} steps, ${SIDE_SHORT[sh.owner]}.`, 'player');
    autosave(); render(); openAdjust();
  } }, 'Apply')));
  box.appendChild(el('p', { class: 'muted' }, 'Ship changes take effect from the next step; a ship moved off the lake leaves its Force.'));
  openModal(box);
}

/* ---------- main render ---------- */
function render() {
  const s = G_STATE;
  renderHeader(s);
  if (!s) { renderSetup(); return; }
  const app = $('app');
  if (!$('proc')) { app.innerHTML = ''; app.appendChild(el('div', { id: 'proc', class: 'panel' })); app.appendChild(el('div', { id: 'board' })); }
  renderProc(s);
  renderBoard(s);
}
