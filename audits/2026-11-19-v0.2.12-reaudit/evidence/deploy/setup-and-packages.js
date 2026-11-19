// Independent full-strength Aid V oracle and campaign setup checks.
// node setup-and-packages.js /path/to/checkout
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),ctx=vm.createContext({console});
const order=JSON.parse(fs.readFileSync(path.join(root,'tools/files.json'))).engine;
vm.runInContext(order.map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n;\n')+'\n;installResume();',ctx);
const E=vm.runInContext('({newGame,forcePackageSelect})',ctx);
const british=['wolfe','rg','beres','moira','sss'].sort();
const M=['pike','madison','sylph','oneida','tompkins','fairam','conquest'];
const S=['asp','growler','hamilton','julia','lady','ontario','pert','raven','scourge'];
// [printed Long Gun, Close Action, steps]. Main/Secondary follows the right-side icon.
const panels={pike:[10,9,3],madison:[2,5,3],sylph:[6,3,3],oneida:[1,3,2],tompkins:[4,2,2],fairam:[3,1,1],conquest:[3,1,1],asp:[0,0,1],growler:[2,0,1],hamilton:[1,1,1],julia:[2,0,1],lady:[0,0,2],ontario:[1,0,1],pert:[1,0,1],raven:[1,0,1],scourge:[1,0,1]};
const sum=(ids,stat)=>ids.reduce((n,id)=>n+panels[id][stat],0);
const key=ids=>ids.slice().sort().join(',');
const expected={setups:0,automaticSelections:0,successful:0,unmet:0,distinctTiedSelections:{}};
for(let seed=964000;seed<964128;seed++)for(const side of ['BR','US']){
 const s=E.newGame(side,seed);
 const ids=(owner,box)=>Object.values(s.ships).filter(x=>x.owner===owner&&x.box===box).map(x=>x.id).sort();
 assert.equal(key(ids('BR','deployable')),key(british));assert.equal(key(ids('BR','construction')),'melville');
 assert.equal(key(ids('US','deployable')),key(M.filter(x=>!['pike','sylph'].includes(x)).concat(S)));assert.equal(key(ids('US','construction')),'pike,sylph');
 assert(Object.values(s.ships).filter(sh=>['wolfe','rg','beres','moira'].includes(sh.id)).every(sh=>sh.ver==='A'));
 assert.equal(s.flagship.BR,'wolfe');assert.equal(s.flagship.US,'madison');assert.equal(s.niagara,3);assert.equal(s.nbBand,3);assert.equal(s.turn,0);
 for(const sd of ['BR','US']){assert.equal(s.vp[sd],0);assert.equal(s.cd[sd],0);assert.equal(s.supply[sd],1);}
 assert.equal(s.aiTroops.box.length,1);assert.equal(s.aiTroops.box[0].revealed,false);
 assert.equal(s.aiTroops.track.map(t=>t.space).join(','),'2,3,4,5,6,7,8');
 assert.equal(s.aiTroops.box.concat(s.aiTroops.track).filter(m=>m.troops).length,3);
 const humanSpaces=s.troops[side].track.concat(s.troops[side].available?[1]:[]);
 assert.equal(humanSpaces.length,3);assert.equal(new Set(humanSpaces).size,3);assert(humanSpaces.every(n=>n>=1&&n<=8));
 for(let m=0;m<4;m++){const pair=[s.convoys[s.ai][2*m],s.convoys[s.ai][2*m+1]];assert.equal(pair.filter(c=>c.real).length,1);assert(pair.every(c=>!c.revealed));}
 expected.setups++;
}
function combinations(ids){return Array.from({length:2**ids.length},(_,bits)=>ids.filter((_,i)=>bits&(1<<i)));}
function minimum(ids,stat,target){
 const groups=combinations(ids).filter(g=>sum(g,stat)>=target);
 const n=Math.min(...groups.map(g=>g.length));
 return groups.filter(g=>g.length===n);
}
function mainFirst(ids,stat,target){
 const mains=ids.filter(id=>M.includes(id)), sec=ids.filter(id=>S.includes(id));
 if(sum(mains,stat)>=target)return minimum(mains,stat,target);
 return minimum(sec,stat,target-sum(mains,stat)).map(g=>mains.concat(g));
}
function oracle(n,pool,hasTroops){
 const mains=pool.filter(id=>M.includes(id)), secs=pool.filter(id=>S.includes(id));
 switch(n){
 case 1:return mains.length?[key(mains)]:['none'];
 case 2:case 3:case 4:case 5:case 6:return mainFirst(pool,0,[28,22,16,18,20][n-2]).map(key);
 case 7:{const g=mains.concat(secs.filter(id=>panels[id][0]+panels[id][1]>0));return g.length?[key(g)]:['none'];}
 case 8:{
  if(!hasTroops)return ['none'];
  const out=[];
  for(const first of minimum(mains,1,8)){
   const rest=pool.filter(id=>!first.includes(id)), options=mainFirst(rest,0,22);
   if(!options.length)out.push('none');else for(const g of options)out.push(key(first)+' / '+key(g));
  }return out;
 }
 case 9:{
   const zero=secs.filter(id=>id!=='lady'&&!panels[id][1]);const lady=secs.includes('lady');
   const groups=combinations(zero).filter(g=>g.length===(lady?1:2)), cost=Math.min(...groups.map(g=>sum(g,0)));
   return groups.filter(g=>sum(g,0)===cost).map(g=>key(lady?['lady',...g]:g));
 }
 case 10:return combinations(secs).filter(g=>g.length===2).map(key);
 case 11:return combinations(secs).filter(g=>sum(g,2)>=5 && g.some(id=>sum(g,2)-panels[id][2]<5)).map(key);
 }
}
const poolCases=[
 {pool:M.concat(S),troops:true},
 {pool:M.filter(id=>id!=='pike').concat(S),troops:true},
 {pool:M.concat(S.filter(id=>id!=='asp')),troops:true},
 {pool:['asp','ontario','pert','growler','raven','hamilton'],troops:true},
 {pool:['pike','sylph','tompkins','fairam','conquest','growler','julia'],troops:false},
 {pool:['lady'],troops:true},{pool:['pike'],troops:true},{pool:[],troops:false},
];
const ties={};
for(const [i,{pool,troops}] of poolCases.entries())for(let pkg=1;pkg<=11;pkg++){
 const legal=new Set(oracle(pkg,pool,troops));if(!legal.size)legal.add('none');
 const observed=new Set();
 for(let rng=1;rng<=64;rng++){
  const game=E.newGame('BR',874001);game.rng=rng;game.aiTroops.box=troops?[{troops:true,revealed:true}]:[];
  const r=E.forcePackageSelect(game,pkg,pool.map(id=>game.ships[id]));
  const result=!r.ok?'none':key(r.ships)+(r.ships2?' / '+key(r.ships2):'');
  assert(legal.has(result),'pool '+i+' package '+pkg+' cursor '+rng+' returned '+result);
  observed.add(result);expected.automaticSelections++;if(r.ok)expected.successful++;else expected.unmet++;
 }
 if(legal.size>1)ties['pool'+i+'-pkg'+pkg]={legal:legal.size,observed:observed.size};
}
for(const [id,n] of [['pool0-pkg3',2],['pool1-pkg8',2],['pool3-pkg9',2],['pool0-pkg10',2],['pool0-pkg11',2]])assert(ties[id].observed>=n);
expected.distinctTiedSelections=ties;console.log(JSON.stringify(expected,null,2));
