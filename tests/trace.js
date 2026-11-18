const loadEngine = require('../tools/bundle_engine.js');
const E = loadEngine();
const human = process.argv[2] || 'US', seed = +(process.argv[3] || 42);
const s = E.newGame(human, seed, {});
E.run(s);
let n = 0;
const sim = require('./sim_agent.js');
while (!s.over && n < 5000) {
  const p = s.prompt;
  const a = sim.answer(E, s, p);
  if (process.argv[4] === 'v') console.log(`>> [${p.kind}] ${p.title} :: ${JSON.stringify(a).slice(0, 160)}`);
  E.act(s, a); n++;
}
s.log.forEach(l => console.log(`[T${l.turn} ${l.phase}] ${l.text}`));
console.log('RESULT', s.result, 'prompts', n);
