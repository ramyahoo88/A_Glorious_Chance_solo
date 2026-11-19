// Independent expectations from British Solo 5.1, 5.3.1, A2–A3, Aid V and card faces.
// Pass another checkout as argument to reproduce the pre-patch failures.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const ctx = vm.createContext({ console });
vm.runInContext(files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();', ctx);
const E = vm.runInContext('({newGame,run,act,validateAnswer,aiDeployablePool,topFrame,PROCS,cardCell,TARGET_CARDS,def,lg,ca,gameScore,manualPackageSuggestion:typeof manualPackageSuggestion==="function"?manualPackageSuggestion:null})',ctx);
let pass = 0, fail = 0;
function check(label, ok) {
  if (ok) pass++; else { fail++; console.error('FAIL', label); }
}
function eq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) console.error('Actual', JSON.stringify(actual), 'expected', JSON.stringify(expected));
  check(label, ok);
}
const clone = s => JSON.parse(JSON.stringify(s));
const accepts = (s, selection) => !E.validateAnswer(s, s.prompt, selection);
const troop = () => ({ troops: true, revealed: true });
const mainIds = ['pike','sylph','madison','oneida','tompkins','fairam','conquest'];
const secondaries = ['asp','growler','hamilton','julia','lady','ontario','pert','raven','scourge'];

// Real campaign replay: the fixture contains only the 48 answers given from setup.
// No board, deck, enemy pool, die or prompt is overridden during the replay.
const pathToB35 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v0210-deploy-path.json')));
const game = E.newGame('BR', 871004, { manualPackages: true, confirmAiSteps: false });
E.run(game);
for (const a of pathToB35) E.act(game, a);
eq('Natural B35 checkpoint after 48 decisions', [pathToB35.length, game.turn, E.topFrame(game).L.card, E.topFrame(game).L.cell, game.rng], [48,4,'B35',{row:1,col:6,v:8},1828191314]);
const patrol = ['oneida','madison','tompkins','fairam','conquest','growler','hamilton','julia','ontario','pert','raven','scourge'];
const combined = ['pike',...patrol];
for (const a of [[],['pike'],patrol,combined.concat('lady'),combined.filter(id => id!=='growler')]) {
  check('A fulfilled Package 8 cannot be skipped, incompletely staffed or padded: '+JSON.stringify(a), !accepts(game,a));
}
check('A legal two-Force union is accepted', accepts(game,combined));
const olderFirst = clone(game); delete olderFirst.prompt.validate;
check('An existing unstamped picker still enforces both Forces',!accepts(olderFirst,['pike']) && accepts(olderFirst,combined));
function preview(s, expected) {
  const before = JSON.stringify(s);
  for (let i=0;i<2;i++) eq('Suggestion identifies ships in this stage',E.manualPackageSuggestion?.(s,s.prompt),expected);
  eq('Checking a proposal does not change any game state or dice',JSON.stringify(s),before);
}
preview(game,combined);
const second = clone(game); E.act(second,combined);
for (const a of [[],['pike'],patrol.slice(0,-1),patrol.filter(id=>id!=='madison').concat('pike')]) {
  check('Package 8 Patrol cannot be empty, understrength or leave an illegal first Force',!accepts(second,a));
}
check('Legal 22 LG Patrol accepted', accepts(second,patrol));
const olderSecond = clone(second);
delete olderSecond.prompt.validate; delete olderSecond.prompt.packageStage; olderSecond.prompt.min = 0;
check('An existing unstamped Patrol picker still checks the split',!accepts(olderSecond,[]) && !accepts(olderSecond,['pike']) && accepts(olderSecond,patrol));
preview(second,patrol);
for (const [cursor,roll,mission] of [[game.rng,1,'Army Support'],[1,4,'Patrol']]) {
  const s = clone(second); s.rng = cursor;
  E.act(s,patrol);
  const forces = Object.values(s.forces).filter(f=>f.cardId==='B35');
  eq('Both Forces stay in Kingston after the Encounter draw '+roll,forces.map(f=>[f.zone,f.mission,f.troops]),[['KIN','ArmySupport',1],['KIN','Patrol',0]]);
  eq('The forces contain exactly the selected ships',forces.map(f=>f.ships),[['pike'],patrol]);
  check('Parity assigns the Encounter to '+mission,s.log.some(l=>l.text.includes('Package #8 roll 1d6 = '+roll)&&l.text.includes('Encounter is with the '+mission+' Force')));
  eq('Embarked Troops leave the box immediately',s.aiTroops.box.filter(t=>t.troops&&t.revealed).length,0);
}

// Start a real aiDeploy procedure with one known printed card and a controlled pool.
function picker(pkg, ids) {
  const s = E.newGame('BR',170011,{manualPackages:true,confirmAiSteps:false});
  Object.values(s.ships).filter(sh=>sh.owner==='US').forEach(sh=>{sh.box=ids.includes(sh.id)?'deployable':'outOfPlay';});
  const card = pkg<=7 ? 'B9' : pkg===8 ? 'B35' : 'B1';
  s.nbBand = pkg<=7 ? 7-pkg : {8:6,9:1,10:4,11:3}[pkg];
  s.aiTroops.box = pkg<=7 ? [] : [troop()];
  s.targetRow=[{id:card,revealed:false,removed:false,enc:false}];
  s.calls=[{proc:'aiDeploy',pc:'start',A:{cardIdx:0,phase:'enemy',encounter:false},L:{}}];s.prompt=null;E.run(s);
  eq('Printed cell produces requested Package '+pkg,s.prompt.pkg,pkg);
  return s;
}
const all = mainIds.concat(secondaries);
let s = picker(1,all);
check('Package 1 must include every Main and no Secondary',accepts(s,mainIds)&&!accepts(s,mainIds.slice(1))&&!accepts(s,mainIds.concat('asp')));
const needs={2:28,3:22,4:16,5:18,6:20};
for (const [pkg,need] of Object.entries(needs)) {
  s=picker(+pkg,all);
  // Exhaust all Main-only combinations. No game selector is used to set the expected answers.
  const legal=[];
  for(let bits=0;bits<1<<mainIds.length;bits++){
    const group=mainIds.filter((id,i)=>bits&(1<<i));
    if(group.reduce((n,id)=>n+E.lg(s.ships[id]),0)>=need)legal.push(group);
  }
  const count=Math.min(...legal.map(g=>g.length));
  for(const g of legal)check('Package '+pkg+' numerical threshold and fewest hulls '+g.join(','),accepts(s,g)===(g.length===count));
  const first=legal.find(g=>g.length===count);
  check('Package '+pkg+' excludes surplus Secondary',!accepts(s,first.concat('lady')));
  check('Package '+pkg+' excludes understrength',!accepts(s,['pike']));
}
s=picker(7,all);
const seven=mainIds.concat(secondaries.filter(id=>!['asp','lady'].includes(id)));
check('Package 7 includes every armed Secondary and every Main',accepts(s,seven)&&!accepts(s,mainIds)&&!accepts(s,all));
s=picker(9,['lady','asp','growler','julia','hamilton']);
check('Package 9 with Lady requires zero-CA Secondary at minimum Long Gun',accepts(s,['lady','asp'])&&!accepts(s,['lady','growler'])&&!accepts(s,['lady','hamilton']));
s=picker(9,['asp','ontario','pert','growler','hamilton']);
check('Package 9 without Lady permits both minimum-LG ties',accepts(s,['asp','ontario'])&&accepts(s,['asp','pert'])&&!accepts(s,['ontario','pert'])&&!accepts(s,['asp','hamilton']));
s=picker(10,['pike','lady','asp','ontario']);
check('Package 10 accepts either two different Secondaries only',accepts(s,['lady','ontario'])&&accepts(s,['asp','ontario'])&&!accepts(s,['pike','lady'])&&!accepts(s,['lady','lady'])&&!accepts(s,[]));
s=picker(10,['pike','asp']);
check('A truly impossible two-Secondary package deploys nothing',accepts(s,[])&&!accepts(s,['asp']));
s=picker(11,secondaries.concat('pike'));
check('Package 11 permits the drawn fifth step or a two-step final draw under rule note 38',
  accepts(s,['asp','growler','julia','ontario','pert'])&&accepts(s,['asp','growler','julia','lady'])&&accepts(s,['asp','growler','julia','ontario','lady']));
check('Package 11 rejects four steps, surplus draws and Main ships',
  !accepts(s,['asp','growler','julia','ontario'])&&!accepts(s,['asp','growler','julia','ontario','pert','raven'])&&!accepts(s,['pike','lady']));
s=picker(8,['madison','oneida','tompkins','fairam','conquest',...secondaries,'sylph']);
check('Known Package 8 first-choice ambiguity: a legitimate first stack can fail',accepts(s,[]));
s=picker(8,['pike','asp']);
check('No second Force possible: zero deployment',accepts(s,[])&&!accepts(s,['pike']));

// Read each row and column from B35 and A25 directly off the two card faces, left to right.
for(const [card,expected] of Object.entries({
  B35:['0000000','0077088','7080708','0708070'],
  A25:['0000000','1001110','0110101','1111011'],
})){
 for(let row=0;row<4;row++)for(let col=0;col<7;col++){
  const side=card==='B35'?'BR':'US', t=E.newGame(side,170099);
  t.nbBand=col;
  // One still aboard counts towards the printed row but cannot embark a second time.
  t.aiTroops.box=[{troops:false,revealed:true},{troops:true,revealed:false},...Array.from({length:Math.max(0,row-1)},troop)];
  t.forces={example:{side:t.ai,troops:row?1:0}};
  eq('Card '+card+' row '+row+' col '+col,E.cardCell(t,E.TARGET_CARDS[card]),{row,col,v:+expected[row][col]});
 }
}

// A5's compulsory purchase costs two Close Action per point. Lady is the
// 0-CA flagship so none of these expectations depends on a transfer ruling.
for (const [ids,cd,count,remaining] of [
  [['hamilton'],2,0,1],
  [['hamilton','fairam'],2,2,0],
  [['hamilton','fairam','conquest'],3,2,1],
  [['oneida'],2,1,0],
  [['hamilton','fairam'],1,0,0],
]) {
  const q=E.newGame('BR',871101);
  Object.values(q.ships).filter(sh=>sh.owner==='US').forEach(sh=>{sh.box=sh.id==='lady'||ids.includes(sh.id)?'deployable':'outOfPlay';});
  q.flagship.US='lady';q.cd.US=cd;q.turn=2;
  q.calls=[{proc:'turn',pc:'A4',A:{},L:{}}];q.prompt=null;E.run(q);E.act(q,[]);
  const laidUp=ids.filter(id=>q.ships[id].box==='ordinary');
  eq('Exact affordable purchase with '+ids+' and starting delay '+cd,[laidUp.length,q.cd.US],[count,remaining]);
  if(count)check('Compulsory purchase uses Secondary first whenever available',!ids.includes('hamilton')||laidUp.includes('hamilton'));
  if(!count)check('No zero-point purchase announced',!q.log.some(l=>l.text.includes('must buy down Construction Delay')));
}

// Same price when the human Americans choose whether to buy.
for(const ids of [['hamilton'],['hamilton','fairam']]){
 const q=E.newGame('US',871101);q.cd.US=2;q.turn=2;
 Object.values(q.ships).filter(sh=>sh.owner==='US').forEach(sh=>{sh.box=ids.includes(sh.id)?'deployable':'outOfPlay';});
 q.calls=[{proc:'turn',pc:'A5',A:{},L:{}}];q.prompt=null;E.run(q);
 if(ids.length===1){
  check('Skip the human purchase screen when there is less than 2 CA',!q.prompt.title.startsWith('A5'));
  eq('Skipping a purchase preserves Hamilton',q.ships.hamilton.box,'deployable');
 } else {
  check('Human may decline or buy, but a single CA is not a purchase',accepts(q,[])&&accepts(q,ids)&&!accepts(q,['hamilton']));
  E.act(q,ids);eq('Exactly 2 CA bought the human one point',q.cd.US,0);
 }
}

// September I reset with only one A.I. ship remaining. Observe the usual turn.next entry.
for(const human of ['BR','US']){
 const id=human==='BR'?'madison':'wolfe';
 for(const [steps,due,over] of [[2,7,true],[3,7,false],[3,8,true]]){
  const q=E.newGame(human,871100);
  q.turn=6;
  Object.values(q.ships).filter(sh=>sh.owner===q.ai).forEach(sh=>{sh.box='sunk';sh.steps=0;});
  const ship=q.ships[id];ship.box='requisitioned';ship.steps=steps;ship.flags.reqUntil=due;
  q.calls=[{proc:'turn',pc:'next',A:{},L:{}}]; q.prompt=null;E.run(q);
  eq(human+' last-turn eligibility for '+steps+' steps, return '+due,q.over,over);
  if(over) eq('Normal scoring at rule 5.1',q.result?.score,E.gameScore(q));
  if(!over) eq('A full ship due back is Deployable in A2',ship.box,'deployable');
 }
}
console.log(pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
