// Headless random-play simulation: plays complete games for both campaigns with
// random (but legal) answers to every prompt, checking engine invariants.
const loadEngine = require('../tools/bundle_engine.js');
const E = loadEngine();

function rnd(n) { return Math.floor(Math.random() * n); }
function shuffleA(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function answerFor(s, p, style) {
  if (p.kind === 'info') return 'ok';
  if (p.kind === 'choice') {
    const opts = p.options.filter(o => !o.disabled);
    if (style === 'aggressive') { const pr = opts.find(o => o.primary); if (pr && Math.random() < 0.8) return pr.id; }
    return opts[rnd(opts.length)].id;
  }
  if (p.kind === 'select') {
    for (let t = 0; t < 30; t++) {
      const k = p.min + rnd((p.max - p.min) + 1);
      const sel = shuffleA(p.items.map(i => i.id)).slice(0, Math.min(k, p.items.length));
      if (!E.validateAnswer(s, p, sel)) return sel;
    }
    if (p.initial && !E.validateAnswer(s, p, p.initial)) return p.initial;
    // try removing ships until valid (30-point limit)
    let sel = [];
    for (const it of p.items) { if (!E.validateAnswer(s, p, sel)) break; sel.push(it.id); }
    return sel;
  }
  if (p.kind === 'lineup') {
    const att = shuffleA(p.candidates).slice(0, 1 + rnd(p.candidates.length));
    const tows = {}; const dt = p.defaultTows || {};
    Object.keys(dt).forEach(t => { if (att.indexOf(t) >= 0 && att.indexOf(dt[t]) >= 0) tows[t] = dt[t]; });
    return { attackers: att, tows };
  }
  if (p.kind === 'assign') {
    for (let t = 0; t < 40; t++) {
      const ships = shuffleA(p.ships);
      const forces = [];
      let troopsLeft = p.troops;
      const nF = rnd(5);
      const missions = Object.keys(p.missions);
      for (let i = 0; i < nF && ships.length; i++) {
        const m = missions[rnd(missions.length)];
        const zs = p.missions[m];
        const z = zs[rnd(zs.length)];
        const n = 1 + rnd(Math.min(5, ships.length));
        const fs = ships.splice(0, n);
        const fr = { zone: z, mission: m, ships: fs, troops: 0 };
        if (m === 'ArmySupport') { const cap = E.troopCapacity(s, fs); fr.troops = Math.min(cap, troopsLeft); troopsLeft -= fr.troops; }
        forces.push(fr);
      }
      const a = { forces, flagship: p.flagship };
      if (!E.validateAnswer(s, p, a)) return a;
    }
    return { forces: [], flagship: p.flagship };
  }
  throw new Error('Unknown prompt kind ' + p.kind);
}

function checkInvariants(s) {
  const errs = [];
  Object.values(s.ships).forEach(sh => {
    const d = E.def(sh);
    if (!d) errs.push('no def for ' + sh.id + sh.ver);
    if (sh.steps < 0 || sh.steps > d.full[4]) errs.push(`bad steps ${sh.id} ${sh.steps}`);
    if (sh.box === 'lake' && !s.ZONES_OK) {
      if (!sh.zone) errs.push(`lake ship without zone ${sh.id}`);
      if (sh.forceId && !s.forces[sh.forceId]) errs.push(`dangling force ${sh.id}`);
    }
  });
  Object.values(s.forces).forEach(f => f.ships.forEach(id => { if (s.ships[id].forceId !== f.id) errs.push(`force mismatch ${f.id} ${id}`); }));
  if (s.supply.US < -1 || s.supply.US > 12 || s.supply.BR < -1 || s.supply.BR > 12) errs.push('supply out of range');
  if (s.niagara < 0 || s.niagara > 6) errs.push('niagara out of range');
  return errs;
}

function playGame(human, seed, style, opts) {
  const s = E.newGame(human, seed, opts);
  E.run(s);
  let steps = 0;
  const kinds = {};
  while (!s.over) {
    if (!s.prompt) throw new Error('Stalled without prompt at ' + JSON.stringify(s.calls.slice(-2)));
    const a = answerFor(s, s.prompt, style);
    kinds[s.prompt.kind + ':' + (s.prompt.title || '').slice(0, 30)] = (kinds[s.prompt.title] || 0) + 1;
    E.act(s, a);
    // JSON round-trip (save/load) must preserve the game
    if (steps % 37 === 0) { const c = JSON.parse(JSON.stringify(s)); Object.assign(s, c); }
    const errs = checkInvariants(s);
    if (errs.length) throw new Error('Invariant: ' + errs.join('; ') + ' @ ' + s.stepLabel);
    if (++steps > 20000) throw new Error('Too many steps');
  }
  return { s, steps };
}

const N = +(process.argv[2] || 60);
const results = { US: [], BR: [] };
let failures = 0;
for (let i = 0; i < N; i++) {
  for (const human of ['US', 'BR']) {
    const seed = 1000 + i * 7 + (human === 'US' ? 0 : 3);
    const style = i % 2 ? 'aggressive' : 'random';
    const opts = { cuttingOut: i % 3 === 0, oa1Upgrades: i % 4 === 1 };
    try {
      const { s, steps } = playGame(human, seed, style, opts);
      results[human].push({ score: s.result.score, level: s.result.level, steps, turn: s.turn });
    } catch (e) {
      failures++;
      console.log(`FAIL ${human} seed ${seed} style ${style} opts ${JSON.stringify(opts)}: ${e.message}`);
      if (failures < 4) console.log(e.stack.split('\n').slice(0, 8).join('\n'));
    }
  }
}
for (const h of ['US', 'BR']) {
  const r = results[h];
  if (!r.length) continue;
  const avg = r.reduce((a, x) => a + x.score, 0) / r.length;
  const lv = {}; r.forEach(x => { lv[x.level] = (lv[x.level] || 0) + 1; });
  console.log(`${h}: ${r.length} games, avg score ${avg.toFixed(1)}, avg prompts ${(r.reduce((a, x) => a + x.steps, 0) / r.length).toFixed(0)}`, lv);
}
console.log('failures:', failures);
process.exit(failures ? 1 : 0);
