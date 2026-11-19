// Rules/card regressions from the second independent v0.2.8 audit.
// node tests/regression_v029_coastal.js [checkout-to-test]
// The positions below are minimal boards, made from newGame, not historical-save repairs.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const order = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console, Math, JSON, Object, Array, String, Number, Error, Date });
vm.runInContext(order.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\ninstallResume();', ctx);
const X = code => vm.runInContext(code, ctx), J = code => JSON.parse(X('JSON.stringify(' + code + ')'));
let passed = 0, failed = 0;
function check(name, actual, expected) {
  try { assert.deepEqual(actual, expected); passed++; }
  catch (e) { failed++; console.error('FAIL', name, '\n actual:', actual, '\n expected:', expected); }
}
X(`function fresh(side,seed) {
 const s=newGame(side,seed);s.turn=2;s.calls=[];s.prompt=null;s.lossesThisTurn=[];s.troopsReturning={US:0,BR:0};return s;
}
function frame() {return {A:{},L:{}};}
// F7/6.1: discard the Last Step marker, retain the Reduced face and use the temporary port.
var req=fresh('BR',81), rf=newForce(req,'BR','NIA','ArmySupport',['wolfe','moira']);
req.ships.wolfe.steps=1;req.ships.wolfe.isolated=true;req.zones.KIN.blockade='US';
req.ships.wolfe.flags.requisition=true;req.ships.moira.flags.requisition=true;
PROCS.tally.reset(req,frame());`);
check('Requisition F7 removes Last Step without making Wolfe full strength', J("[req.ships.wolfe.steps,req.ships.wolfe.box]"), [2,'requisitioned']);
check('Requisition F7 retains isolated temporary homeport', X("req.ships.wolfe.port"), 'temp');
check('requisition lasts the following whole turn', J("[req.ships.wolfe.flags.reqUntil,req.ships.wolfe.forceId,req.ships.wolfe.zone]"), [4,null,null]);
X('req.turn=3;PROCS.turn.A2(req,frame());');
check('ship is still unavailable next turn', X("req.ships.wolfe.box"), 'requisitioned');
X('req.turn=4;PROCS.turn.A2(req,frame());');
check('Reduced return goes to In Transit rather than Deployable', X("req.ships.wolfe.box"), 'transit');
check('full-strength return remains immediately Deployable', X("req.ships.moira.box"), 'deployable');
X('PROCS.turn.A3(req,frame());');
check('Reduced ship spends its return turn Repairing', J("[req.ships.wolfe.box,req.ships.wolfe.steps,req.ships.wolfe.port]"), ['repairing',2,'temp']);
X('req.turn=5;PROCS.turn.A3(req,frame());');
check('next A3 completes repair and restores full strength', J("[req.ships.wolfe.box,req.ships.wolfe.steps]"), ['deployable',3]);

// Event 36 + Aid VII: 3 Long Guns / 1 Troop, two bands left -> 0 Long Guns / 1 Troop.
X(`function land(manual,event=36) {
 const s=fresh('BR',47);s.options.manualLandBattle=manual;
 const fr=newForce(s,'BR','NIA','ArmySupport',['wolfe','rg','moira']);
 const f={A:{},L:{side:'BR',cur:{z:'NIA',forces:[fr.id]},troops:1}};
 s.deck.event=[event].concat(s.deck.event.filter(n=>n!==event));s.rng=1;
 const result=PROCS.coastal.asBattle(s,f);return {s,f,result};
}
var manual=land(true), automatic=land(false);`);
check('manual prompt names the final shifted printed column', X('manual.result.prompt.text.includes("column “0 Long Gun / 1 Troops”")'), true);
check('manual prompt contains no double-negative left shift', X('/shifted -[0-9]+ column\\(s\\) left/.test(manual.result.prompt.text)'), false);
check('manual and automatic modes spend the same dice', J('[manual.s.rng,manual.f.L.lb.roll]'), J('[automatic.s.rng,automatic.f.L.lb.roll]'));
X("var unshifted=land(true,1);");
check('no-event control retains the original printed column', X('unshifted.result.prompt.text.includes("column “1 to 6 Long Gun / 1 Troops”")'), true);
X('manual.f.answer=automatic.f.answer;PROCS.coastal.asResult(manual.s,manual.f);PROCS.coastal.asResult(automatic.s,automatic.f);');
check('manual lookup and automatic result apply identically', J('manual.s.coastal.battles'), J('automatic.s.coastal.battles'));

// Rule 12 + note 15: a captured CLS cannot trigger a British A.I. Harbor defense.
X(`function coastCaptured(human) {
 const s=fresh(human,46);sideShips(s,'BR').forEach(sh=>{if(sh.box==='deployable')sh.box='repairing';});
 s.ships.julia.owner='BR';s.ships.julia.box='transit';s.ships.julia.steps=0;s.ships.julia.port='home';
 const fr=newForce(s,'US','KIN','ArmySupport',['madison','oneida']);fr.troops=1;
 const f={A:{},L:{side:'US',lz:[{z:'KIN',forces:[fr.id]}],si:0}};
 return {s,f,result:PROCS.coastal.asZone(s,f)};
}
var emptyHarbor=coastCaptured('US'),humanHarbor=coastCaptured('BR');`);
check('captured British A.I. CLS alone skips an empty Harbor Encounter', X('emptyHarbor.result.goto'), 'asBattle');
check('Troops launch still proceeds when no eligible Harbor defender exists', X('emptyHarbor.f.L.troops'), 1);
check('human British captured-CLS control still triggers legal defense', X('humanHarbor.result.call'), 'harbor');
X(`var normalPort=coastCaptured('US');normalPort.s.ships.beres.box='transit';normalPort.s.ships.beres.port='home';
normalPort.f.L.lz=[{z:'KIN',forces:normalPort.f.L.cur.forces}];normalPort.s.forces[normalPort.f.L.cur.forces[0]].troops=1;
var normalCall=PROCS.coastal.asZone(normalPort.s,normalPort.f);`);
check('a combat-capable Reduced ship in transit still defends', X('normalCall.call'), 'harbor');

// Cards 16/17/23 Haze and 6/13/29/35 Missed Signal cover pending Lake Combat in the zone.
// Printed BR attack strength: Wolfe A 9 + Royal George A 6.5 = 15.5.
// Against it Madison full has 11, Reduced has 5.5. Haze removes Long Guns -> 14 vs 10.
X(`function harbor(opts={}) {
 const s=fresh('BR',71);sideShips(s,'US').forEach(sh=>{if(sh.box==='deployable')sh.box='repairing';});
 s.ships.madison.box='deployable';s.ships.madison.port='home';
 if(opts.reduced){s.ships.madison.steps=2;s.ships.madison.box='transit';}
 const fr=newForce(s,'BR','SAC','ArmySupport',opts.single?['wolfe']:['wolfe','rg']);
 if(opts.reducedAtt)s.ships.rg.steps=2;
 s.zones.SAC.flags=Object.assign({},opts.flags||{});
 const f={A:{zone:'SAC',att:'BR',forces:[fr.id],port:'home'},L:{}};
 const decks=JSON.stringify(s.deck);PROCS.harbor.start(s,f);s.rng=1;
 return {s,f,decks};
}
function fire(h){return PROCS.harbor.round(h.s,h.f);}
var plain=harbor(),haze=harbor({flags:{haze:true}}),spentHaze=harbor({flags:{haze:true,hazeUsed:true}});
var plainR=fire(plain),hazeR=fire(haze),spentR=fire(spentHaze);`);
check('pending Haze removes Long Guns in Harbor Round 1', X("hazeR.prompt.text.includes('British 14 vs 10 = 1.4:1')"), true);
check('Haze is consumed by the first actual Harbor Gunnery Round 1', X('haze.s.zones.SAC.flags.hazeUsed'), true);
check('spent Haze has the no-event strengths', X("spentR.prompt.text.includes('British 15.5 vs 11 = 1.41:1')"), true);
check('Harbor neither draws Weather Gage nor Event/Tactic cards', X('haze.decks===JSON.stringify(haze.s.deck)'), true);
X('haze.s.rng=1;var hazeR2=fire(haze);');
check('Haze does not suppress Long Guns in Round 2 against a Reduced defender', X("hazeR2.prompt.text.includes('Harbor Gunnery Round 2: British 15.5 vs 5.5')"), true);
X(`var reduced=harbor({reduced:true,flags:{haze:true}});var reducedR=fire(reduced);`);
check('Haze uses the Reduced defender counter strengths', X("reducedR.prompt.text.includes('British 14 vs 5 = 2.8:1')"), true);
X(`var ms=harbor({flags:{missedSignal:'rg'}});var msR=fire(ms);`);
check('Missed Signal omits the selected attacker from Harbor Round 1 strength', X("msR.prompt.text.includes('British 9 vs 11 = 0.82:1')"), true);
check('eligible Harbor Missed Signal is spent exactly once', X('ms.s.zones.SAC.flags.missedSignalUsed'), true);
check('Missed Signal ship remains Engaged and returns for Round 2', X("ms.s.encounter.ships.rg==='in' && ms.s.combat.col.BR.includes('rg')"), true);
X('ms.s.rng=1;var msR2=fire(ms);');
check('Round 2 again includes the ship that missed Round 1', X("msR2.prompt.text.includes('Harbor Gunnery Round 2: British 6.5 vs 11')"), true);
X(`var msSpent=harbor({flags:{missedSignal:'rg',missedSignalUsed:true}}),msIneligible=harbor({reducedAtt:true,flags:{missedSignal:'rg'}});
var msSpentR=fire(msSpent),ineligibleR=fire(msIneligible);`);
check('already-spent Missed Signal has normal Round 1 strength', X("msSpentR.prompt.text.includes('British 15.5 vs 11')"), true);
check('Reduced attacking ship is not eligible and does not consume Missed Signal', X('!!msIneligible.s.zones.SAC.flags.missedSignalUsed'), false);
// Force a returning hit at d10=0: the selected ship must not be a distribution target.
X("var msHit=harbor({flags:{missedSignal:'rg'}});msHit.s.rng=7;var hitR=fire(msHit);");
check('Missed Signal ship is also excluded from return-hit distribution', X("hitR.prompt.text.includes('British hit distribution (1-ship column') && msHit.s.ships.rg.steps===3"), true);

// The card removes participation in one Round, not the whole Harbor Encounter.
X(`var soleA=harbor({single:true,flags:{missedSignal:'wolfe'}}),soleD=harbor({flags:{missedSignal:'madison'}});
var soleBefore=soleA.s.rng,soleAR=fire(soleA),soleDR=fire(soleD);`);
check('sole attacking ship skips only Round 1', J('[soleAR.then,soleA.f.L.round,soleA.s.rng===soleBefore]'), ['round',1,true]);
check('sole defending ship skips only Round 1', J('[soleDR.then,soleD.f.L.round,soleD.s.encounter.ships.madison]'), ['round',1,'in']);
X('var soleAR2=fire(soleA),soleDR2=fire(soleD);');
check('sole attacker participates in Round 2', X("!!soleAR2.prompt && soleAR2.prompt.text.includes('Harbor Gunnery Round 2: British 9 vs 11')"), true);
check('sole defender participates in Round 2', X("!!soleDR2.prompt && soleDR2.prompt.text.includes('Harbor Gunnery Round 2: British 15.5 vs 11')"), true);
X(`var rainy=harbor({flags:{rainy:true}});var rainyR=fire(rainy);`);
check('Rule 12 Harbor restriction retains Gunnery under Rainy Squalls', X("rainyR.prompt.text.includes('Harbor Gunnery Round 1') && !rainyR.prompt.text.includes('Close Action')"), true);
X(`var renewed=harbor({flags:{haze:true,hazeUsed:true,missedSignal:'rg',missedSignalUsed:true}});
PROCS.turn.start(renewed.s,frame());`);
check('the next turn clears old zone-event use flags and effects', J('renewed.s.zones.SAC.flags'), {});

console.log(passed + ' coastal follow-up regressions passed; ' + failed + ' failed.');
process.exitCode = failed ? 1 : 0;
