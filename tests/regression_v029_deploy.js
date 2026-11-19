// Claude v0.2.8 M4 (text only), L1, L2. Expected behavior independently read from
// Living Playbook p.6; U.S. Rules pp.12,22,25,27; British Rules p.26.
// Optional argument: another checkout, so the same assertions expose v0.2.8.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console, localStorage: { getItem() { return null; }, setItem() {} } });
vm.runInContext(files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') +
  '\n;installResume();\n' + fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8'), ctx);
const X = code => vm.runInContext(code, ctx);
let passed = 0, failed = 0;
function eq(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, JSON.stringify(actual), 'expected', JSON.stringify(expected)); }
}

// L1: Beresford A has CA3; an Army Support Force needs at least CA4 before
// either kind of upgrade becomes eligible. Test the exact boundary with Moira CA4.
X(`function armyPosition(oa1, id, card) {
  var q = newGame('US',182401,{oa1Upgrades:oa1}); q.turn=2; q.phase='lake';
  sideShips(q,'BR').forEach(sh=>{if(sh.box==='deployable'&&sh.id!==id){sh.box='repairing';sh.steps=def(sh).red[4];}});
  q.nb=0;q.nbBand=3;q.aiTroops.track=[];q.aiTroops.box=[{troops:true,revealed:true},{troops:true,revealed:true},{troops:true,revealed:true}];
  q.targetRow=[{id:card||'A26',revealed:false,removed:false,enc:false}];
  q.calls=[{proc:'aiDeploy',pc:'start',A:{cardIdx:0,phase:'lake',encounter:true,peNum:1},L:{}}];q.prompt=null;q.rng=1;
  return q;
}`);
for (const oa1 of [false, true]) {
  X(`var s=armyPosition(${oa1},'beres');var beforeRng=s.rng;run(s);`);
  eq(`L1 ${oa1 ? 'OA1' : '7.1'} cannot upgrade a CA3 Army Support non-deployment`, X('[s.ships.beres.ver,s.ships.beres.box,!!s.turnFlags.oa1Done]'), ['A','deployable',false]);
  eq(`L1 ${oa1 ? 'OA1' : '7.1'} failed capacity consumes no dice`, X('s.rng'), X('beforeRng'));
  eq(`L1 ${oa1 ? 'OA1' : '7.1'} failed capacity embarks no Troops`, X('[Object.keys(s.forces).length,aiTroopsInBox(s)]'), [0,3]);
  eq(`L1 ${oa1 ? 'OA1' : '7.1'} explains the unmet capacity`, X("s.log.some(l=>l.text.includes('cannot carry Troops'))"), true);
}
X("var s=armyPosition(false,'moira');run(s);");
eq('L1 CA4 control makes ordinary Upgrade Check and deploys', X('[s.ships.moira.ver,s.ships.moira.box,Object.values(s.forces)[0].troops]'), ['B','lake',1]);
X("var s=armyPosition(true,'moira');run(s);");
eq('L1 CA4 control spends OA1 and sends chosen ship for refit', X('[s.ships.moira.box,!!s.turnFlags.oa1Done,s.rng!==1]'), ['makeReady',true,true]);
X("var s=armyPosition(false,'beres','A4');run(s);");
eq('L1 Patrol control does not require transport capacity', X('[s.ships.beres.ver,s.ships.beres.box]'), ['B','lake']);

// M4: natural new game, all American ships on a Kingston Patrol. Preserve the
// existing literal A6 recalculation; only the displayed/stored lookup must follow it.
X(`function oa1Natural(enabled) {
  var q=newGame('US',3,{oa1Upgrades:enabled});run(q);
  for(var guard=0;guard<25&&q.prompt.title!=='B1 Possible Encounters';guard++){
    var p=q.prompt,a='ok';
    if(p.kind==='choice')a=(p.options.find(o=>o.primary)||p.options[0]).id;
    else if(p.kind==='select')a=p.initial||[];
    else if(p.kind==='assign')a={forces:[{mission:'Patrol',zone:'KIN',ships:p.ships,troops:0}],flagship:p.flagship};
    act(q,a);
  }
  return q;
}
var s=oa1Natural(true);act(s,'ok');`);
eq('M4 seed3 retains literal A6 result pending an OA1 ruling', X('[s.nb,s.nbBand]'), [-62,1]);
eq('M4 seed3 deployment says its actual recalculated column', X('s.prompt.text.includes(`Naval Balance “${NB_CARD_LABELS[1]}” column`)'), true);
eq('M4 stored lookup matches applied OA1 lookup', X('topFrame(s).L.cell.col'), 1);
eq('M4 subsequent log identifies the same new column', X('s.log.at(-1).text.includes(`Naval Balance “${NB_CARD_LABELS[1]}” column`)'), true);
X("var s=oa1Natural(false);act(s,'ok');");
eq('M4 ordinary-upgrade control keeps the A6 column', X('[s.nb,s.nbBand,topFrame(s).L.cell.col]'), [0,3,3]);
eq('M4 ordinary-upgrade description still matches', X('s.prompt.text.includes(`Naval Balance “${NB_CARD_LABELS[3]}” column`)'), true);

// L2: every permutation of 3 Forces is legal, with one PE each. In a second
// cycle only the least-loaded Forces may be offered. No marker choice rolls dice.
X(`function pePosition(side, cards) {
  var q=newGame(side,4401);q.turn=2;q.phase='lake';q.pe=[];q.peNext=1;
  q.troops[side]={available:2,track:[]}; // one embarked below, three real human markers total
  var z=side==='BR'?'SAC':'KIN';
  var groups=side==='BR'?[['wolfe','rg'],['beres','sss'],['moira']]:[['madison'],['oneida'],['tompkins']];
  var ids=groups.map((ships,i)=>newForce(q,side,z,i===1?'ArmySupport':i===2?'Raid':'Patrol',ships,{troops:i===1?1:0}).id);
  q.targetRow=(cards||(side==='BR'?['B2','B36','B37']:['A4','A9','A1'])).map(id=>({id,revealed:false,removed:false,enc:false}));
  q.calls=[{proc:'turn',pc:'B1',A:{},L:{}}];q.prompt=null;run(q);
  return {state:q,ids};
}
function followPEOrder(q,ids,order) {
  for(var g=0;g<20&&q.prompt&&q.prompt.kind==='choice'&&q.prompt.title.startsWith('B1');g++){
    var want=ids[order[q.pe.length]-1];
    if(!q.prompt.options.some(o=>o.id===want))return false;
    act(q,want);
  }
  return q.pe.map(p=>ids.indexOf(p.forceId)+1).join('');
}`);
for (const side of ['BR','US']) {
  for (const order of ['123','132','213','231','312','321']) {
    X(`var p=pePosition('${side}');var s=p.state,ids=p.ids,markerRng=s.rng;var got=followPEOrder(s,ids,${JSON.stringify(order.split('').map(Number))});`);
    eq(`L2 ${side} legal marker order ${order}`, X('got'), order);
    eq(`L2 ${side} ${order} consumes no dice`, X('s.rng'), X('markerRng'));
  }
}
X("var p=pePosition('BR',['B2','B36','B37','B2','B36']);var s=p.state,ids=p.ids;act(s,ids[0]);");
eq('L2 PE2 permits either still-unmarked Force', X('s.prompt.kind===\'choice\'?s.prompt.options.map(o=>o.id):[]'), X('[ids[1],ids[2]]'));
eq('L2 already-marked Force is rejected for PE2', X("validateAnswer(s,s.prompt,ids[0])!==null"), true);
if (X("s.prompt.kind==='choice'&&s.prompt.options.some(o=>o.id===ids[2])")) {
  X('act(s,ids[2]);'); // PE3 is forced onto the remaining unmarked Force.
}
eq('L2 all three Forces may receive PE4 after one complete cycle', X("s.prompt.kind==='choice'?s.prompt.options.map(o=>o.id):[]"), X('ids'));
if (X("s.prompt.kind==='choice'&&s.prompt.options.some(o=>o.id===ids[2])")) X('act(s,ids[2]);');
eq('L2 PE5 excludes the Force that just received its second marker', X("s.prompt.kind==='choice'?s.prompt.options.map(o=>o.id):[]"), X('[ids[0],ids[1]]'));

// A pending placement survives export/import; the next legal choice stays exact.
X("var p=pePosition('BR');var s=p.state,ids=p.ids;act(s,ids[0]);var restored=checkSaveState(JSON.parse(JSON.stringify(s)));");
eq('L2 current placement prompt and options survive checked save round-trip', X('[restored.prompt,restored.rng]'), X('[s.prompt,s.rng]'));
if (X("s.prompt.kind==='choice'&&s.prompt.options.some(o=>o.id===ids[2])")) {
  X('act(s,ids[2]);act(restored,ids[2]);');
}
eq('L2 original and restored placement continue identically', X('restored'), X('s'));
X("var p=pePosition('BR');var s=p.state,ids=p.ids;s.prompt=null;s.pe=[];s.peNext=1;[ids[1],ids[2]].forEach(id=>{s.forces[id].zone='NIA';s.forces[id].ships.forEach(i=>s.ships[i].zone='NIA');});s.calls=[{proc:'turn',pc:'B1',A:{},L:{}}];var r0=s.rng;run(s);");
eq('L2 single-Force control automatically receives every marker', X('[s.prompt.kind,s.pe.map(p=>p.forceId),s.rng===r0]'), X("['info',[ids[0],ids[0],ids[0]],true]"));

// Transfers use 11.1.3's different-Force-in-original-zone rule. It does not
// impose the initial-placement minimum-load restriction on a transfer.
X(`function transferPosition() {
  var p=pePosition('BR'),q=p.state,ids=p.ids;
  q.forces[ids[0]].zone='NIA';q.forces[ids[0]].ships.forEach(id=>q.ships[id].zone='NIA');
  q.pe=[{num:1,idx:0,zone:'SAC',forceId:ids[0],status:'possible'},{num:2,idx:1,zone:'SAC',forceId:ids[1],status:'possible'}];
  q.deck.event=[31,32,33];q.eventsDrawn=[];q.calls=[{proc:'turn',pc:'B2',A:{},L:{}}];q.prompt=null;return {state:q,ids};
}
var p=transferPosition();var s=p.state,ids=p.ids,r0=s.rng;run(s);`);
eq('L2 transfer offers either remaining Force, including an already-marked one', X("s.prompt.kind==='choice'?s.prompt.options.map(o=>o.id):[]"), X('[ids[1],ids[2]]'));
eq('L2 transfer choice does not draw an Event or roll dice first', X('[s.eventsDrawn.length,s.deck.event,s.rng===r0]'), [0,[31,32,33],true]);
if (X("s.prompt.kind==='choice'&&s.prompt.options.some(o=>o.id===ids[2])")) {
  X('var restored=checkSaveState(JSON.parse(JSON.stringify(s)));act(s,ids[2]);act(restored,ids[2]);');
  eq('L2 transferred encounter reaches the chosen second recipient', X('s.pe[0].forceId'), X('ids[2]'));
  eq('L2 transfer resumes with the same next Event', X('[s.eventsDrawn.length,s.eventsDrawn[0].id,s.rng===r0]'), [1,31,true]);
  eq('L2 transfer save round-trip continues identically', X('restored'), X('s'));
} else {
  eq('L2 transferred encounter reaches the chosen second recipient', X('s.pe[0].forceId'), X('ids[2]'));
  eq('L2 transfer resumes with the same next Event', false, true);
  eq('L2 transfer save round-trip continues identically', false, true);
}
X("var p=transferPosition();var s=p.state,ids=p.ids;s.forces[ids[2]].zone='NIA';s.forces[ids[2]].ships.forEach(id=>s.ships[id].zone='NIA');var r0=s.rng;run(s);");
eq('L2 one-recipient transfer is automatic and preserves the next Event', X('[s.prompt.kind,s.pe[0].forceId,s.eventsDrawn[0].id,s.rng===r0]'), X("['info',ids[1],31,true]"));
X("var p=transferPosition();var s=p.state,ids=p.ids;[ids[1],ids[2]].forEach(fid=>{s.forces[fid].zone='NIA';s.forces[fid].ships.forEach(id=>s.ships[id].zone='NIA');});var r0=s.rng;run(s);");
eq('L2 no-recipient control discards markers without drawing Events', X('[s.pe.map(p=>p.status),s.eventsDrawn.length,s.rng===r0]'), [['discarded','discarded'],0,true]);

console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
