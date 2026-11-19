// Independent reproductions of Claude's M1/L4/L6 and the LC2 tow boundary.
// M3 stays the printed A05-specific ruling; test both eligible/no-eligible cases.
// node tests/regression_v029_combat_followup.js [checkout-to-test]
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console, Math, JSON, Object, Array, String, Number, Error, Date });
vm.runInContext(files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\ninstallResume();', ctx);
const X = code => vm.runInContext(code, ctx), value = code => JSON.parse(X(`JSON.stringify(${code})`));
let pass = 0, fail = 0;
function check(name, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); pass++; }
  catch (e) { fail++; console.error('FAIL', name, '\n actual:', actual, '\n expected:', expected); }
}
X(`function fresh(side, seed) {
  const s=newGame(side,seed); s.turn=2; s.phase='lake'; s.calls=[]; s.prompt=null;
  s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0}; return s;
}
function stage(s, us, br, att) {
  const u=newForce(s,'US','NOR','Patrol',us), b=newForce(s,'BR','NOR','Patrol',br);
  s.encounter={zone:'NOR',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{BR:false,US:false},
    humanForce:(s.human==='US'?u:b).id,aiForce:(s.ai==='US'?u:b).id,wg:att,wgCard:8,firstAttack:false};
  us.concat(br).forEach(id=>encAdd(s,id)); s.zones.NOR.event=8;
  s.deck.event=[9].concat(s.deck.event.filter(n=>n!==8&&n!==9));
  s.combat={att,def:OTHER[att],seq:att==='US'?'A':'B',pos:0,segment:'patrol',col:{US:us.slice(),BR:br.slice()},
    tows:{},tac:{att:null,def:null},gr:0,roundAttackers:[],newSeq:false};
}
function wait(s, pc, L) { s.calls=[{proc:'combat',pc,A:{},L:L||{}}]; s.prompt=info('Test position','Continue.'); }
function signalPosition(human,us,br,missed) {
  const s=fresh(human,101); stage(s,us,br,'BR'); s.zones.NOR.flags.missedSignal=missed; return s;
}
var a=signalPosition('US',['madison'],['wolfe','rg'],'wolfe');
var ap=aiAttackDecision(a,false);`);
check('M1: missing AI Wolfe cannot raise 0.59:1 to the 1:1 minimum', value('ap.ships'), []);
check('M1: AI explains the actual first-round odds', X("ap.why.includes('odds 0.59:1')"), true);
X(`var b=signalPosition('US',['pike','tompkins'],['wolfe','moira'],'pike'); var bp=aiAttackDecision(b,false);`);
check('M1 inverse: missing human Pike permits the otherwise legal AI attack', value('bp.ships'), ['wolfe','moira']);
check('M1 inverse: odds are 6.5:1', X("bp.why.includes('odds 6.5:1')"), true);
X(`delete a.zones.NOR.flags.missedSignal; var control=aiAttackDecision(a,false);`);
check('control: no Missed Signal retains the 1.41:1 attack', X("control.ships.length===2 && control.why.includes('odds 1.41:1')"), true);
X(`a.zones.NOR.flags.missedSignal='wolfe'; a.zones.NOR.flags.missedSignalUsed=true; var spent=aiAttackDecision(a,false);`);
check('control: a spent Missed Signal no longer changes odds', X("spent.ships.length===2 && spent.why.includes('odds 1.41:1')"), true);
X(`var towers=signalPosition('BR',['pike','tompkins','madison','fairam'],['wolfe'],'pike');
var tp=aiPlanFor(towers,'US',['pike','tompkins','madison','fairam'],['wolfe'],true);`);
check('M1: a sitting-out tower cannot tow in that first Round', value('tp.tows'), {madison:'tompkins'});
X(`var lone=signalPosition('US',['madison'],['wolfe'],'wolfe'); var lp=aiAttackDecision(lone,true);`);
check('control: even waived preconditions cannot make an absent ship fire', value('lp.ships'), []);

// L6: consume according to eligibility, not the human's selected lineup.
X(`var l=fresh('US',31); stage(l,['madison','oneida'],['wolfe','rg'],'US');
l.zones.NOR.flags.missedSignal='oneida';
PROCS.combat.assemble2(l,{A:{},L:{},answer:{attackers:['madison'],tows:{}}});`);
check('L6: eligible Oneida left out voluntarily uses Missed Signal', X('!!l.zones.NOR.flags.missedSignalUsed'), true);
check('L6: an omitted ship is not silently added back to the attacking column', value('[l.combat.col.US,l.combat.sitting]'), [['madison'],null]);
X(`var reduced=fresh('US',31); stage(reduced,['madison','oneida'],['wolfe','rg'],'US');
reduced.ships.oneida.steps=1; reduced.zones.NOR.flags.missedSignal='oneida';
PROCS.combat.assemble2(reduced,{A:{},L:{},answer:{attackers:['madison'],tows:{}}});`);
check('L6 control: a Reduced attacker was ineligible, so the Event remains pending', X('!!reduced.zones.NOR.flags.missedSignalUsed'), false);
X(`reduced.combat.att='BR'; reduced.combat.def='US'; reduced.combat.plan={ships:['wolfe','rg'],tows:{}};
PROCS.combat.assemble2(reduced,{A:{},L:{}});`);
check('L6 control: that Reduced ship uses the Event when it becomes eligible to defend', value('[reduced.zones.NOR.flags.missedSignalUsed,reduced.combat.sitting]'), [true,{id:'oneida',side:'US'}]);

// LC2/LC6: when Madison drops out, Pike must keep its original Fair American
// tow. It cannot acquire the orphaned higher-Long-Gun Tompkins without moving.
X(`var tow=fresh('BR',441); stage(tow,['madison','tompkins','pike','fairam'],['wolfe'],'US');
tow.ships.madison.steps=2; tow.encounter.ships.madison='dis';
var oldPairs={madison:'tompkins',pike:'fairam'};
var kept=aiPlanFor(tow,'US',['tompkins','pike','fairam'],['wolfe'],true,oldPairs);
var freshPairs=aiPlanFor(tow,'US',['tompkins','pike','fairam'],['wolfe'],true);`);
check('LC2: later-round tow pairing retains actual adjacent ships', value('kept.tows'), {pike:'fairam'});
check('LC2 control: a new assembly may choose a new tow pairing', value('freshPairs.tows'), {pike:'tompkins'});

// L4: exact seed-6 CA hits Lord Melville, fails Disengagement, no Melee (Pike).
X(`var ca=fresh('BR',6); stage(ca,['pike'],['sss','melville'],'US'); ca.flagship.BR='melville';
ca.combat.pos=4; ca.combat.gr=2; ca.combat.roundAttackers=['pike']; wait(ca,'next'); act(ca,'ok');`);
check('L4: the flagship is Reduced and still Engaged in the exact CA fixture', value('[ca.ships.melville.steps,ca.encounter.ships.melville]'), [1,'in']);
check('L4: offer the flag transfer after Close Action', X('ca.prompt.title'), 'Transfer the flag?');
if (X("ca.prompt.title==='Transfer the flag?'")) {
  X(`var stayed=JSON.parse(JSON.stringify(ca)), reloaded=JSON.parse(JSON.stringify(ca)), succeeded=JSON.parse(JSON.stringify(ca));
  succeeded.rng=1; act(succeeded,'sss'); act(stayed,'stay'); act(ca,'sss'); act(reloaded,'sss');`);
  check('L4: accepted transfer checks casualties (seed 6 rolls 11, killing Yeo)', X("ca.flagship.BR==='melville' && ca.prompt.text.includes('2d6 11: KILLED')"), true);
  check('L4 control: a passed transfer check moves Yeo to the adjacent full-strength ship', X('succeeded.flagship.BR'), 'sss');
  check('L4: decline leaves the flag aboard Melville', X('stayed.flagship.BR'), 'melville');
  check('L4: saving and loading at the transfer prompt is deterministic', X('JSON.stringify(ca)===JSON.stringify(reloaded)'), true);
  check('L4: transfer resumes CA results without advancing twice', value('[ca.prompt.title,ca.combat.pos]'), ['Close Action Round',5]);
} else {
  for (const name of ['accepted transfer','successful transfer','declined transfer','save/load','CA timing']) check('L4 '+name+' reachable',false,true);
}
X(`var wound=fresh('BR',6); stage(wound,['pike'],['sss','melville'],'US'); wound.flagship.BR='melville';
wound.leader.BR.wounded=true; wound.combat.pos=4; wound.combat.roundAttackers=['pike']; wait(wound,'next'); act(wound,'ok');`);
check('L4 control: a wounded leader is not offered transfer', X('wound.prompt.title'), 'Close Action Round');
X(`var ns=fresh('BR',41); stage(ns,['tompkins'],['melville','sss'],'US'); ns.flagship.BR='melville'; ns.ships.melville.steps=1;
ns.calls=[{proc:'combat',pc:'wgSwitch2',A:{},L:{},answer:'attack'}]; ns.prompt=null; run(ns);`);
check('L4: the human may transfer before a new attacking Sequence discards the old column', X('ns.prompt.title'), 'Transfer the flag?');
X(`var ai=fresh('US',41); stage(ai,['tompkins'],['melville','sss'],'US'); ai.flagship.BR='melville'; ai.ships.melville.steps=1;
wait(ai,'wgSwitch',{newAtt:'BR'}); ai.rng=1; act(ai,'ok');`);
check('L4: the AI transfers when it becomes attacker and retains its Command bonus', value('[ai.prompt.title,ai.flagship.BR]'), ['Flag transfer','sss']);

// M3 is ambiguous, not changed. Literal A05 says DW plus ships eligible to
// withdraw; eligibility (after damage), rather than an elected W, is the trigger.
X(`var pursuit=fresh('US',8); stage(pursuit,['oneida','tompkins','fairam'],['wolfe','rg','moira'],'BR');
pursuit.combat.tac.att={id:'A_pursuit',used:false,negated:false}; wait(pursuit,'grRoll',{st:'GR1'});
pursuit.calls.unshift({proc:'encounter',pc:'afterCombat',A:{},L:{}}); act(pursuit,'ok');`);
check('M3 retained ruling: eligible Defender triggers A05 directly', X("pursuit.prompt.title==='Gunnery Round results' && pursuit.prompt.text.includes('Pursuit!')"), true);
X(`act(pursuit,'ok');`);
check('M3 retained agreed boundary: struck Fair American settles before the new Encounter', X('pursuit.ships.fairam.owner'), 'BR');
X(`var noEligible=fresh('US',8); stage(noEligible,['oneida'],['wolfe'],'BR');
noEligible.combat.tac.att={id:'A_pursuit',used:false,negated:false};
var wf={L:{wQueue:['US'],failedDis:{US:['oneida']},lines:[]}}; PROCS.combat.withdraw(noEligible,wf);`);
check('M3 control: no eligible Defender leaves Pursuit unused', X('noEligible.combat.tac.att.used'), false);
X(`var noPursuit=fresh('US',8); stage(noPursuit,['oneida','tompkins','fairam'],['wolfe','rg','moira'],'BR'); wait(noPursuit,'grRoll',{st:'GR1'}); act(noPursuit,'ok');`);
check('M3 control: ordinary W still offers the optional human withdrawal', X('noPursuit.prompt.title'), 'Withdrawal result against you');
console.log('v0.2.9 combat follow-up: '+pass+' passed, '+fail+' failed');
if (fail) process.exitCode=1;
