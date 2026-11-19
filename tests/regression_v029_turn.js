// British Living Rules 7.2 (p.23), Living Playbook p.12: a completed repair
// and an upgrade share the same turn. Run against another checkout by passing it.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console });
vm.runInContext(files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();', ctx);
const x = code => vm.runInContext(code, ctx);
let pass = 0, fail = 0;
const eq = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, JSON.stringify(actual), 'expected', JSON.stringify(expected)); }
};
const start = extra => x(`var s = newGame('BR', 290101); s.turn = 2; s.phase = 'prep';
  s.ships.wolfe.box = 'repairing'; s.ships.wolfe.steps = 2;
  ${extra || ''}
  s.calls = [{proc:'turn',pc:'A2',A:{},L:{}}]; run(s);`);

for (const id of ['wolfe', 'rg', 'moira', 'beres']) {
  start(`s.ships.wolfe.box='deployable';s.ships.wolfe.steps=def(s.ships.wolfe).full[4];
    s.ships.${id}.box='repairing';s.ships.${id}.steps=def(s.ships.${id}).full[4]-1;`);
  eq(`${id} is offered within the rolled quota`, x(`s.prompt.items.some(i=>i.id==='${id}')`), true);
  x(`act(s,['${id}']);`);
  eq(`${id} completes repair and upgrade this turn`, x(`[s.ships.${id}.ver,s.ships.${id}.box,s.ships.${id}.steps]`),
    x(`['B','deployable',SHIP_BY_ID['${id}B'].full[4]]`));
  eq(`${id} remains eligible for A7 assignment`, x(`assignableShips(s,'BR').some(sh=>sh.id==='${id}')`), true);
}

start(); x('act(s,[]);');
eq('Declining upgrade completes ordinary repairs as A', x('[s.ships.wolfe.ver,s.ships.wolfe.box,s.ships.wolfe.steps]'), ['A','deployable',3]);

start("s.ships.wolfe.box='deployable';s.ships.wolfe.steps=3;"); x("act(s,['wolfe']);");
eq('An undamaged Deployable A ship still needs a turn in Make Ready', x('[s.ships.wolfe.ver,s.ships.wolfe.box,!!s.ships.wolfe.flags.upgrading]'), ['A','makeReady',true]);
x("s.turn++;s.prompt=null;s.calls=[{proc:'turn',pc:'A2',A:{},L:{}}];run(s);");
eq('That ordinary refit finishes next turn', x('[s.ships.wolfe.ver,s.ships.wolfe.box]'), ['B','deployable']);

start('s.ships.wolfe.delay=1;');
eq('A repair with a delay remaining cannot be upgraded this turn', x("s.prompt.items.some(i=>i.id==='wolfe')"), false);
x('act(s,[]);');
eq('Delayed repair waits while removing one delay', x('[s.ships.wolfe.ver,s.ships.wolfe.box,s.ships.wolfe.delay]'), ['A','repairing',0]);

start('s.ships.wolfe.isolated=true;s.ships.wolfe.port="temp";');
eq('Isolated ships cannot upgrade', x("s.prompt.items.some(i=>i.id==='wolfe')"), false);
x('act(s,[]);');
eq('Isolated repair still completes without upgrade', x('[s.ships.wolfe.ver,s.ships.wolfe.box]'), ['A','deployable']);

start(); x("act(s,['wolfe','rg']);");
eq('A mixed selection uses the same roll for repair/refit and ordinary refit', x('[s.ships.wolfe.ver,s.ships.wolfe.box,s.ships.rg.ver,s.ships.rg.box]'), ['B','deployable','A','makeReady']);
eq('Over-quota mixed selection is refused', x("(function(){var t=newGame('BR',290104);t.ships.wolfe.box='repairing';t.ships.wolfe.steps=2;t.calls=[{proc:'turn',pc:'A2',A:{},L:{}}];run(t);return validateAnswer(t,t.prompt,['wolfe','rg']);})()"), 'Select at most 1');

// A10 may add a ninth card to an eight-card draw, then tells the tabletop player
// to lay out the actual resulting row, including why the extra card was added.
const row = (seed, blocked) => x(`var s=newGame('BR',${seed});s.turn=2;s.phase='prep';
  s.zones.SAC.blockade=${blocked ? "'BR'" : 'null'};s.nb=0;s.nbBand=3;
  s.calls=[{proc:'turn',pc:'A9',L:{}}];run(s);`);
row(290202, true);
eq('Blockade adds a missing homeport card', x('s.targetRow.length'), 9);
eq('A10 instructs the player to lay out all nine cards', x('/^Lay out 9 Target Cards/.test(s.prompt.text)'), true);
eq('A10 explains the extra card in prompt and log', x("[s.prompt.text,s.log.at(-1).text].every(t=>/Added one Sacket's card for the Blockade/.test(t))"), true);
eq('Added homeport card is first', x('TARGET_CARDS[s.targetRow[0].id].zone'), 'SAC');
row(290201, true);
eq('Existing homeport card is moved first without an extra card', x('[s.targetRow.length,TARGET_CARDS[s.targetRow[0].id].zone]'), [8,'SAC']);
eq('Existing homeport card does not claim an extra draw', x('/^Lay out 8 Target Cards/.test(s.prompt.text) && !/Added one/.test(s.prompt.text)'), true);
row(290202, false);
eq('No blockade keeps ordinary eight-card draw', x('s.targetRow.length'), 8);
eq('Ordinary draw instruction agrees with row', x('/^Lay out 8 Target Cards/.test(s.prompt.text) && !/Added one/.test(s.prompt.text)'), true);

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
