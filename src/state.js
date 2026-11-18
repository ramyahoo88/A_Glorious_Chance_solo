/* ============================================================================
   Game state creation and helper queries
   ========================================================================== */
const APP_VERSION = '0.2.0';

// Boxes a ship can be in. 'lake' = deployed in a Lake Zone (zone field).
// port: 'home' or 'temp' (temporary homeport for Isolated ships)
const BOXES = ['deployable', 'makeReady', 'repairing', 'construction', 'ordinary', 'transit', 'outOfPlay', 'lake', 'sunk', 'requisitioned', 'escortBox', 'coast'];
const BOX_NAME = { deployable: 'Deployable', makeReady: 'Make Ready', repairing: 'Repairing', construction: 'Construction', ordinary: 'In Ordinary', transit: 'In Transit', outOfPlay: 'Out of Play', lake: 'Lake', sunk: 'Sunk', requisitioned: 'Requisitioned', escortBox: 'Escort Convoy box', coast: 'Beached' };

function defaultOptions() {
  return {
    cuttingOut: false,          // Playbook OA2 (both campaigns)
    oa1Upgrades: false,         // Playbook OA1 (U.S. campaign only) instead of 7.1 random A/B
    usAiPrecondition: 'longgun',// 'longgun' (Lake Combat mat) or 'carronade' (British Living Rules LC1 text)
    confirmAiSteps: true,       // pause so the player can mirror AI moves on the physical board
    manualPackages: false,      // British campaign: pick Force Package ships by hand instead of automatically
    manualLandBattle: false,    // read the Land Battle Table by hand instead of automatically
  };
}

function newShip(base, ver, owner, box) {
  return { id: base, ver: ver, owner: owner, box: box, zone: null, port: 'home', steps: 0, delay: 0,
    forceId: null, isolated: false, flags: {} };
}

function newGame(human, seed, options) {
  const ai = OTHER[human];
  const s = {
    app: APP_VERSION, human, ai, rng: (seed >>> 0) || 1, seed: (seed >>> 0) || 1,
    options: Object.assign(defaultOptions(), options || {}),
    turn: 0, phase: 'setup', stepLabel: 'Setup', over: false, result: null,
    ships: {}, forces: {}, nextForce: 1,
    zones: {}, blockade: {}, vp: { US: 0, BR: 0 }, vpLog: [],
    supply: { US: 1, BR: 1 }, cd: { US: 0, BR: 0 }, niagara: 3, nb: 0, nbBand: 3,
    fallOffensive: null,
    flagship: { US: 'madison', BR: 'wolfe' },
    leader: { US: { seq: 0, wounded: false }, BR: { seq: 0, wounded: false } },
    convoys: { US: {}, BR: {} }, pendingConvoy: { US: [], BR: [] }, convoyDeployed: { US: null, BR: null },
    troops: { US: { track: [], available: 0 }, BR: { track: [], available: 0 } },
    aiTroops: { track: [], box: [] },
    deck: { target: [], event: [], tacA: [], tacD: [] },
    targetRow: [], eventsDrawn: [], pe: [], peNext: 1,
    cuttingOutUsed: { US: false, BR: false },
    intelligence: { US: null, BR: null },
    coastal: { raids: [], battles: [], cutouts: [] },
    turnFlags: {},
    calls: [], prompt: null, log: [], lastRolls: [],
    encounter: null, combat: null,
  };
  ZONES.forEach(z => { s.zones[z] = { control: null, blockade: null, event: null, flags: {} }; });
  s.blockade = { US: false, BR: false };
  // British ships [3.1]
  ['wolfe', 'rg', 'moira', 'beres'].forEach(b => { s.ships[b] = newShip(b, 'A', 'BR', 'deployable'); });
  s.ships.sss = newShip('sss', '', 'BR', 'deployable');
  s.ships.melville = newShip('melville', '', 'BR', 'construction');
  // U.S. ships
  ['oneida', 'madison', 'tompkins', 'fairam', 'conquest', 'asp', 'growler', 'hamilton', 'julia', 'lady', 'ontario', 'pert', 'raven', 'scourge']
    .forEach(b => { s.ships[b] = newShip(b, '', 'US', 'deployable'); });
  s.ships.sylph = newShip('sylph', '', 'US', 'construction');
  s.ships.pike = newShip('pike', '', 'US', 'construction');
  Object.values(s.ships).forEach(sh => { sh.steps = def(sh).full[4]; });
  // decks
  const deckId = human === 'US' ? 'A' : 'B';
  s.deck.target = Object.keys(TARGET_CARDS).filter(k => TARGET_CARDS[k].deck === deckId);
  s.deck.event = shuffle(s, Object.keys(EVENTS).map(Number));
  s.deck.tacA = shuffle(s, TACTICS.filter(t => t.deck === 'A').map(t => t.id));
  s.deck.tacD = shuffle(s, TACTICS.filter(t => t.deck === 'D').map(t => t.id));
  // AI convoy markers: one real convoy per month, hidden on one of the two turns
  for (let m = 0; m < 4; m++) {
    const real = rint(s, 2);
    for (let k = 0; k < 2; k++) s.convoys[ai][m * 2 + k] = { real: k === real, revealed: false, delay: false, deployed: false, result: null };
  }
  // AI Troops markers: 3 Troops + 5 No Troops; 7 on spaces 2..8 of the AI Convoy Supply Track, 1 in Available box
  const mk = shuffle(s, [1, 1, 1, 0, 0, 0, 0, 0]);
  for (let i = 0; i < 7; i++) s.aiTroops.track.push({ space: i + 2, troops: !!mk[i] });
  s.aiTroops.box.push({ troops: !!mk[7], revealed: false });
  // Human Troops markers: 3 rolls on the "8 ships" column of the Hit Distribution Table
  const spaces = [];
  const rollsTxt = [];
  while (spaces.length < 3) {
    const r = d66(s); const sp = hitPosition(8, r.red, r.blue);
    rollsTxt.push(r.v + '→' + sp);
    if (spaces.indexOf(sp) < 0) spaces.push(sp);
  }
  spaces.forEach(sp => { if (sp === 1) s.troops[human].available++; else s.troops[human].track.push(sp); });
  s.troops[human].track.sort((a, b) => a - b);
  log(s, `New ${SIDE_NAME[human]} Solo Campaign (seed ${s.seed}). Your Troops markers set up on Convoy Supply spaces ${spaces.join(', ')} (rolls ${rollsTxt.join(', ')})${spaces.indexOf(1) >= 0 ? '; the one on space 1 goes to your Available Troops box' : ''}.`, 'setup');
  s.calls = [{ proc: 'turn', pc: 'start', L: {} }];
  return s;
}

/* ---------- ship helpers ---------- */
function defId(sh) { return sh.id + (sh.ver || ''); }
function def(sh) { return SHIP_BY_ID[defId(sh)]; }
function shipName(s, id) { const sh = s.ships[id]; const d = def(sh); return d.name + (d.ver ? ' (' + d.ver + ')' : '') + (sh.owner !== d.side ? ' [' + (sh.owner === 'US' ? 'U.S.' : 'Br.') + ']' : ''); }
function isFull(sh) { return sh.steps >= def(sh).full[4]; }
function isReduced(sh) { return !isFull(sh); }
function curVals(sh) { return isFull(sh) ? def(sh).full : def(sh).red; }
function lg(sh) { return curVals(sh)[0]; }
function car(sh) { return curVals(sh)[1]; }
function ca(sh) { return curVals(sh)[2]; }
function dfn(sh) { return curVals(sh)[3]; }
function isCLS(sh) { return !!def(sh).cls; }
function isMain(sh) { return !!def(sh).main; }
function canTow(sh) { return !!def(sh).T && isFull(sh); }
function isFast(sh) { return !!def(sh).F; }
function guns(sh) { return def(sh).guns; }
function vpCapture(sh) { return def(sh).vp[1]; }
function vpDestroy(sh) { return def(sh).vp[0]; }
function sideShips(s, side) { return Object.values(s.ships).filter(sh => sh.owner === side); }
function shipsIn(s, side, box, port) { return sideShips(s, side).filter(sh => sh.box === box && (!port || sh.port === port)); }
function deployable(s, side, port) { return shipsIn(s, side, 'deployable', port); }
function shipsInZone(s, z, side) { return Object.values(s.ships).filter(sh => sh.box === 'lake' && sh.zone === z && (!side || sh.owner === side)); }
function sumBy(arr, f) { return arr.reduce((a, x) => a + f(x), 0); }

/* ---------- forces ---------- */
function newForce(s, side, zone, mission, shipIds, extra) {
  const id = 'F' + (s.nextForce++);
  const f = Object.assign({ id, side, zone, mission, ships: [], troops: 0, ended: false, origin: 'prep', cardId: null, aborted: false }, extra || {});
  s.forces[id] = f;
  shipIds.forEach(sid => addShipToForce(s, sid, id));
  return f;
}
function addShipToForce(s, sid, fid) {
  const sh = s.ships[sid], f = s.forces[fid];
  if (sh.forceId && s.forces[sh.forceId]) removeShipFromForce(s, sid);
  sh.forceId = fid; sh.box = 'lake'; sh.zone = f.zone;
  if (f.ships.indexOf(sid) < 0) f.ships.push(sid);
}
function removeShipFromForce(s, sid) {
  const sh = s.ships[sid];
  const f = s.forces[sh.forceId];
  if (f) { f.ships = f.ships.filter(x => x !== sid); if (!f.ships.length) delete s.forces[f.id]; }
  sh.forceId = null;
}
function forcesInZone(s, z, side) { return Object.values(s.forces).filter(f => f.zone === z && f.ships.length && (!side || f.side === side)); }
function forceShips(s, f) { return f.ships.map(id => s.ships[id]); }
function forceLabel(s, f) { return `${MISSION_NAME[f.mission] || f.mission} Force (${f.ships.map(id => shipName(s, id)).join(', ')})` + (f.troops ? ` +${f.troops} Troops` : ''); }
function forceCA(s, f) { return sumBy(forceShips(s, f), ca); }
function troopCapacity(s, shipIds) { return Math.floor(sumBy(shipIds.map(id => s.ships[id]), ca) / 4); }

/* ---------- misc ---------- */
function log(s, text, kind) { s.log.push({ turn: s.turn, phase: s.phase, text, kind: kind || 'info' }); }
function homeZone(side) { return HOMEPORT_ZONE[side]; }
function isBlockaded(s, side) { return s.zones[homeZone(side)].blockade === OTHER[side]; }
function usingTempHomeport(s, side) { return sideShips(s, side).some(sh => sh.isolated && sh.box !== 'sunk' && sh.box !== 'outOfPlay'); }
function addVP(s, side, n, why) {
  if (!n) return;
  s.vp[side] += n;
  s.vpLog.push({ turn: s.turn, side, n, why });
  const eff = side === 'US' ? n : -n;
  log(s, `${side === 'US' ? 'U.S.' : 'British'} ${n > 0 ? 'scores' : 'loses'} ${Math.abs(n)} VP (Game Score ${eff > 0 ? '+' : '−'}${Math.abs(eff)}): ${why}`, 'vp');
}
function gameScore(s) { return s.vp.US - s.vp.BR; }
function computeNavalBalance(s) {
  const val = side => sumBy(deployable(s, side).filter(sh => !(isBlockaded(s, side) && sh.port === 'home')), vpCapture);
  return val('US') - val('BR');
}
function aiTroopsAvailable(s) {
  // Troops markers in the AI Available Troops box (revealed "Troops") + embarked on AI forces
  const box = s.aiTroops.box.filter(m => m.revealed && m.troops).length;
  const emb = sumBy(Object.values(s.forces).filter(f => f.side === s.ai), f => f.troops || 0);
  return box + emb;
}
function aiTroopsInBox(s) { return s.aiTroops.box.filter(m => m.revealed && m.troops).length; }
function takeAiTroops(s, n) {
  let taken = 0;
  for (let i = 0; i < s.aiTroops.box.length && taken < n; i++) {
    const m = s.aiTroops.box[i];
    if (m.revealed && m.troops) { s.aiTroops.box.splice(i, 1); i--; taken++; }
  }
  return taken;
}
function returnAiTroops(s, n) { for (let i = 0; i < n; i++) s.aiTroops.box.push({ troops: true, revealed: true }); }
function convoyRunning(s, side) {
  const c = s.convoys[side][s.turn];
  if (!c) return false;
  return !!c.real;
}
function clampSupply(v) { return Math.max(SUPPLY_MIN, Math.min(SUPPLY_MAX, v)); }
function moveSupply(s, side, n, why) {
  if (!n) return;
  const before = s.supply[side];
  if (before >= SUPPLY_MAX && n > 0) return; // stays in Fall Offensive Supplied space
  if (before >= SUPPLY_MAX && n < 0) return; // 5.4: it stays there for the rest of the game
  s.supply[side] = clampSupply(before + n);
  log(s, `${SIDE_SHORT[side]} Convoy Supply ${before} → ${s.supply[side]} (${why})`, 'track');
}
function changeCD(s, side, n, why) {
  const b = s.cd[side];
  s.cd[side] = Math.max(0, b + n);
  if (b !== s.cd[side]) log(s, `${SIDE_SHORT[side]} Construction Delay ${b} → ${s.cd[side]} (${why})`, 'track');
}
function flagshipOf(s, side) { return s.flagship[side]; }
function leaderName(s, side) {
  const L = s.leader[side];
  if (side === 'BR') return L.seq === 0 ? 'Cdre. Yeo' : 'generic leader';
  return L.seq === 0 ? 'Cdre. Chauncey' : L.seq === 1 ? 'Capt. Sinclair' : 'generic leader';
}
function originalLeaderOk(s, side) {
  const L = s.leader[side];
  return (side === 'BR' ? L.seq === 0 : L.seq <= 1) && !L.wounded;
}
function commandDRMAvailable(s, side) {
  const L = s.leader[side];
  if (L.wounded) return false;
  return side === 'BR' ? L.seq === 0 : L.seq === 1;
}
