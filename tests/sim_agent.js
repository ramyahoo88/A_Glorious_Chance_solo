function rnd(n) { return Math.floor(Math.random() * n); }
function shuffleA(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function answerFor(E, s, p, style) {
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


module.exports={answer:(E,s,p,style)=>answerFor(E,s,p,style||'aggressive')};
