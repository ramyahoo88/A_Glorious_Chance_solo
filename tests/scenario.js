// Targeted scenario checks of Tally/Blockade/Convoy logic
const load = require('../tools/bundle_engine.js');
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'files.json'))).engine;
const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();';
const ctx = { console, Math, JSON, Object, Array, String, Number, Error };
vm.createContext(ctx); vm.runInContext(src, ctx);
const X = e => vm.runInContext(e, ctx);
let pass = 0, fail = 0;
const eq = (n, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; console.log('FAIL', n, JSON.stringify(g), 'want', JSON.stringify(w)); } };
function drain(sname) { X(`run(${sname}); var __g=0; while(${sname}.prompt && __g++<50){ if(${sname}.prompt.kind==='info') act(${sname},'ok'); else break; }`); }

// 1. U.S. Blockade of Kingston: 4 full-strength Main ships, U.S. control, no British ships deployed in Kingston
X(`var s = newGame('US', 5); s.turn = 2; s.phase='tally'; s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0};
var f = newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam','conquest']);
var g = newForce(s,'BR','YOR','Patrol',['wolfe','rg']);
s.zones.KIN.control = 'US';
s.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
drain('s');
eq('blockade placed', X('s.zones.KIN.blockade'), 'US');
eq('British in York isolated', X("[s.ships.wolfe.isolated, s.ships.rg.isolated]"), [true, true]);
eq('isolated ships at temp port after reset', X("[s.ships.wolfe.box, s.ships.wolfe.port]"), ['deployable', 'temp']);
eq('British blockaded', X("isBlockaded(s,'BR')"), true);
eq('AI pool = isolated only', X("aiDeployablePool(s).map(x=>x.id).sort()"), ['rg', 'wolfe']);
eq('naval balance excludes blockaded home ships', X("computeNavalBalance(s)"), X("sumBy(deployable(s,'US'),vpCapture) - (32+28)"));
eq('British keep York this turn (F2 runs before F6)', X("ZONES.filter(z=>s.zones[z].control==='BR')"), ['YOR']);

// 2. Convoy Delay event chain: delayed this turn, arrives next F5
X(`var t = newGame('US', 6); t.turn=0; t.convoys.US[0]={real:true,revealed:true,delay:true}; t.convoys.US[1]={real:false};
t.lossesThisTurn=[]; t.troopsReturning={US:0,BR:0}; t.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
drain('t');
eq('delayed convoy no advance', X('t.supply.US'), 1);
eq('pending arrived after F7', X('t.pendingConvoy.US.map(p=>p.status)'), ['arrived']);
X(`t.turn=1; t.calls=[{proc:'tally',pc:'start',A:{},L:{}}]; t.prompt=null;`);
drain('t');
eq('arrives next turn', X('t.supply.US'), 3);

// 3. Lake control needs 5 steps of full-strength warships, unopposed
X(`var u = newGame('US', 8); u.troops.US.available=0; u.lossesThisTurn=[]; u.troopsReturning={US:0,BR:0};
newForce(u,'US','NOR','Patrol',['madison','oneida']);
newForce(u,'BR','SOU','Patrol',['moira','beres']);
newForce(u,'US','SOU','Patrol',['asp']);
u.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
drain('u');
eq('US controls North Lake (3+2 steps)', X('u.zones.NOR.control'), 'US');
eq('South Lake contested', X('u.zones.SOU.control'), null);
eq('Lake control VP', X('u.vp.US'), 1);

// 4. Raid VP and supplies, Sudden Storm
X(`var v = newGame('BR', 10); v.lossesThisTurn=[]; v.troopsReturning={US:0,BR:0};
v.coastal = { raids:[{side:'BR',zone:'SAC',guns:12,events:['suddenStorm']},{side:'BR',zone:'SOU',guns:12,events:[]}], battles:[], cutouts:[] };
v.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
drain('v');
eq('raid VPs (storm 2VP→1, plus South Lake 1)', X('v.vp.BR'), 2);

console.log(`scenario tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
