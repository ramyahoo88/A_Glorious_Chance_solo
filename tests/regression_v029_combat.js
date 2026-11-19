// A06 is one-shot even though a combat frame survives several rounds/sequences.
// node tests/regression_v029_combat.js [checkout-to-test]
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const E = require(path.join(root, 'tools/bundle_engine.js'))();
let pass = 0, fail = 0;
function check(name, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); pass++; }
  catch (e) { fail++; console.error('FAIL', name, '\n actual:', actual, '\n expected:', expected); }
}

// Genuine fresh British campaign, seed 291006. No state editing or mocked dice.
const s = E.newGame('BR', 291006, { cuttingOut: true });
E.run(s);
const answers = ['I', ['wolfe'], [], {
  forces: [
    { mission: 'Escort', zone: 'ESC', ships: ['sss'], troops: 0 },
    { mission: 'ArmySupport', zone: 'NIA', ships: ['rg', 'moira'], troops: 1 },
    { mission: 'Patrol', zone: 'KIN', ships: ['beres'], troops: 0 },
  ], flagship: 'rg',
}, 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'confront', 'ok', 'D_openrange', 'ok', 'ok'];
for (const answer of answers) E.act(s, answer);
check('original Rake still sinks its selected target in Round 1',
  [s.prompt.title, s.ships.moira.box, s.lossesThisTurn.length], ['Weather Gage recheck', 'sunk', 1]);
const saved = JSON.stringify(s), restored = JSON.parse(saved), logStart = s.log.length;
E.act(s, 'ok'); E.act(restored, 'ok');
check('Round 2 cannot destroy the same ship twice', s.lossesThisTurn.filter(x => x.id === 'moira').length, 1);
check('Round 2 hits the surviving Royal George and allows Disengagement',
  [s.ships.rg.steps, s.encounter.ships.rg], [2, 'dis']);
check('spent Rake no longer bypasses Open Range or its distribution dice',
  s.log.slice(logStart).some(x => x.text === 'British hit distribution (6-ship column, Open Range +5): 51→#5 (empty – no effect), 11→#1 Royal George, 25→#2 (empty – no effect).'), true);
check('save/reload at the round boundary produces identical results', JSON.stringify(s), JSON.stringify(restored));

// Adjacent boundary: a Weather Gage switch reuses the frame but changes attacker.
const order = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console, Math, JSON, Object, Array, String, Number, Error, Date });
vm.runInContext(order.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\ninstallResume();', ctx);
const X = code => vm.runInContext(code, ctx);
X(`var b=newGame('BR',291006); b.calls=[]; b.prompt=null; b.lossesThisTurn=[]; b.troopsReturning={US:0,BR:0};
newForce(b,'BR','NOR','Patrol',['rg','moira']); newForce(b,'US','NOR','Patrol',['madison','oneida']);
b.encounter={zone:'NOR',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},leaderFate:{}};
['rg','moira','madison','oneida'].forEach(id=>encAdd(b,id));
b.combat={att:'BR',def:'US',seq:'B',pos:0,segment:'patrol',col:{BR:['rg','moira'],US:['madison','oneida']},tows:{},tac:{att:null,def:null},gr:0,roundAttackers:[]};
b.rng=4; var control=JSON.parse(JSON.stringify(b));
var frame={proc:'combat',pc:'grRoll',A:{},L:{st:'GR1',rakeTarget:'moira',rakeRandom:'moira'}};
var clean={proc:'combat',pc:'grRoll',A:{},L:{st:'GR1'}};
PROCS.combat.grRoll(b,frame); PROCS.combat.grRoll(control,clean);
PROCS.combat.grApply(b,frame); PROCS.combat.grApply(control,clean);`);
check('Weather Gage switch cannot direct defender hits onto a friendly former Rake target',
  X('JSON.stringify(b) === JSON.stringify(control)'), true);
// D02 adds DW to the next CRT result even when that result is END (LC3c/g).
X(`function escapePosition(human, tactic, seed) {
  const s=newGame(human,292013); s.calls=[]; s.prompt=null; s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0};
  newForce(s,'BR','NOR','Patrol',['wolfe','rg','moira']); newForce(s,'US','NOR','Patrol',['madison','oneida']);
  s.encounter={zone:'NOR',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},leaderFate:{}};
  ['wolfe','rg','moira','madison','oneida'].forEach(id=>encAdd(s,id));
  s.leader.BR.seq=1; // no command modifier, so the seeded d10 is the table row
  s.combat={att:'BR',def:'US',seq:'B',pos:0,segment:'patrol',col:{BR:['wolfe','rg','moira'],US:['madison','oneida']},tows:{},tac:{att:null,def:tactic?{id:'D_escape',used:false,negated:false}:null},gr:0,roundAttackers:[]};
  s.calls=[{proc:'combat',pc:'grRoll',A:{},L:{st:'GR1'}}]; s.rng=seed; return s;
}
var esc=escapePosition('US',true,18); run(esc);`);
check('Escape + END offers the human the added withdrawal', X('esc.prompt.title'), 'Withdrawal result against you');
if (X(`esc.prompt.title==='Withdrawal result against you'`)) {
  X(`var declined=JSON.parse(JSON.stringify(esc)); act(declined,'stay'); act(declined,'ok'); act(esc,'withdraw'); act(esc,'ok');`);
  check('accepting Escape + END withdraws the Force and ends the Segment',
    JSON.parse(X(`JSON.stringify([esc.ships.madison.box,esc.ships.oneida.box,esc.calls.length])`)), ['transit','transit',0]);
  check('declining Escape + END keeps the Force but still ends the Segment',
    JSON.parse(X(`JSON.stringify([declined.ships.madison.box,declined.ships.oneida.box,declined.calls.length])`)), ['lake','lake',0]);
} else { check('accepting Escape + END is reachable', false, true); check('declining Escape + END is reachable', false, true); }
X(`var aiEsc=escapePosition('BR',true,18); run(aiEsc);`);
check('the AI accepts Escape + END withdrawal automatically',
  JSON.parse(X(`JSON.stringify([aiEsc.ships.madison.box,aiEsc.ships.oneida.box])`)), ['transit','transit']);
X(`var plainEnd=escapePosition('US',false,18); run(plainEnd);`);
check('END without Escape is still a plain Segment ending',
  JSON.parse(X(`JSON.stringify([plainEnd.prompt.title,plainEnd.ships.madison.box])`)), ['Gunnery result','lake']);
X(`var nonEnd=escapePosition('US',true,4); run(nonEnd);`);
check('Escape still offers withdrawal on a non-END result', X('nonEnd.prompt.title'), 'Withdrawal result against you');
// Pursuit and Escape have matching color bars, so neither applies (LC3g).
X(`var neg=escapePosition('US',true,18); neg.calls=[];
neg.deck.tacA=['A_pursuit']; neg.deck.tacD=[];
var tframe={L:{hDeck:'D',hDrawn:['D_escape']},answer:'D_escape'};
PROCS.combat.tactics2(neg,tframe);
neg.calls=[{proc:'combat',pc:'grRoll',A:{},L:{st:'GR1'}}]; neg.rng=18; run(neg);`);
check('matching Pursuit/Escape bars cancel before END is resolved',
  JSON.parse(X(`JSON.stringify([neg.combat.tac.att.negated,neg.combat.tac.def.negated,neg.prompt.title,neg.ships.madison.box])`)), [true,true,'Gunnery result','lake']);
// LC6 rechecks LC1 before each round. After Pike is Reduced and Disengages,
// Fair American is untowed; the AI must leave it out to use the 1:1 threshold.
X(`function subsetPosition() {
  const s=newGame('BR',293109); s.calls=[]; s.prompt=null; s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0};
  newForce(s,'BR','NOR','Patrol',['wolfe','rg','moira']); newForce(s,'US','NOR','Patrol',['pike','fairam','madison','tompkins','oneida']);
  ['wolfe','rg','moira'].forEach(id=>s.ships[id].ver='B'); s.ships.wolfe.steps=2; s.ships.pike.steps=2;
  s.encounter={zone:'NOR',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},leaderFate:{}};
  ['wolfe','rg','moira','pike','fairam','madison','tompkins','oneida'].forEach(id=>encAdd(s,id)); s.encounter.ships.pike='dis';
  s.combat={att:'US',def:'BR',seq:'A',pos:2,segment:'patrol',col:{BR:['wolfe','rg','moira'],US:['fairam','madison','tompkins','oneida']},tows:{madison:'tompkins',pike:'fairam'},tac:{att:null,def:null},gr:1,roundAttackers:['pike','fairam','madison','tompkins','oneida']};
  s.calls=[{proc:'combat',pc:'gr',A:{},L:{}}]; s.rng=14; return s;
}
var sub=subsetPosition(); run(sub);`);
check('later AI gunnery uses the legal subset selected by its precondition check',
  JSON.parse(X('JSON.stringify(sub.combat.roundAttackers)')), ['madison','tompkins','oneida']);
check('reduced/disengaged Pike no longer supplies a tow',
  JSON.parse(X('JSON.stringify(sub.combat.tows)')), {madison:'tompkins'});
check('the omitted schooner neither fires nor enters return-hit distribution',
  X(`sub.log.some(l=>l.text.includes('U.S. hit distribution (3-ship column')) && !sub.log.some(l=>/untowed Laker Schooners/.test(l.text) && l.kind==='roll')`), true);
check('omitted ships stay Engaged', X("sub.encounter.ships.fairam"), 'in');
X(`var nextSequence=subsetPosition(); var nf={A:{},L:{},answer:{attackers:['rg','moira'],tows:{}}};
nextSequence.combat.att='BR'; nextSequence.combat.def='US'; nextSequence.combat.plan=null;
PROCS.combat.assemble2(nextSequence,nf);`);
check('a Weather Gage switch can include the omitted schooner as a defender', X("nextSequence.combat.col.US.includes('fairam')"), true);
X(`var caSub=subsetPosition(); caSub.combat.roundAttackers=['fairam','madison','tompkins','oneida']; caSub.combat.pos=4;
var caFrame={A:{},L:{}}; PROCS.combat.ca(caSub,caFrame);`);
check('Close Action uses the legal subset too',
  JSON.parse(X('JSON.stringify(caFrame.L.caAtt)')), ['madison','tompkins','oneida']);
X(`var strong=subsetPosition(); strong.ships.wolfe.steps=0; run(strong);`);
check('with sufficient odds the AI keeps its untowed schooner', X("strong.combat.roundAttackers.includes('fairam')"), true);
X(`var gaps=subsetPosition(); gaps.combat.col.BR=['wolfe',null,'rg','moira']; gaps.combat.tac.att={id:'A_outmaneuver',negated:false,used:false}; run(gaps);`);
check('per-round selection preserves Attacker Outmaneuver gaps', X('gaps.combat.col.BR.includes(null)'), true);
console.log(`v0.2.9 combat regression: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
