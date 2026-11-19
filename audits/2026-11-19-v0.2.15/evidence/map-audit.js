// Audit-only observational harness. Source is not modified.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||'.'),out=__dirname;
const load=require('./campaign/load'),{ctx,x}=load(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8'),ctx);
const E=x('({newGame,run,act,playTableAction,checkSaveState,PROCS})');
const direct=load(root).x('({act})'),{policy}=require('./campaign/policy');
const stats={games:0,actions:0,saveChecks:0,moves:0,intermediateOmissions:0,crowdedPositions:0,examples:{},modes:{}};
const clean=s=>{const {tableReport,...rest}=s;return JSON.stringify(rest);};
const pos=sh=>['lake','coast'].includes(sh.box)?sh.zone:sh.box==='escortBox'?'ESC_'+sh.owner:['deployable','makeReady','repairing','construction','ordinary','transit'].includes(sh.box)?((sh.port==='temp'&&['deployable','transit'].includes(sh.box)?'TEMP_':'HOME_')+sh.owner):null;
const snap=s=>Object.fromEntries(Object.values(s.ships).map(sh=>[sh.id,pos(sh)]));
let tracked=null,prior=null,transitions=[];
for(const [proc,handlers] of Object.entries(E.PROCS)) for(const [pc,original] of Object.entries(handlers)){
 handlers[pc]=function(s,f){const result=original(s,f);if(s===tracked){const next=snap(s);for(const id of Object.keys(next))if(prior[id]!==next[id])transitions.push({id,from:prior[id],to:next[id],handler:proc+'.'+pc});prior=next;}return result;};
}
function save(name,before,s,meta){if(stats.examples[name])return;stats.examples[name]=meta;fs.writeFileSync(path.join(out,name+'-before.json'),before);fs.writeFileSync(path.join(out,name+'-after.json'),JSON.stringify({state:s,undo:[]}));}
let highScore=-1, mostRoutes=-1;
for(let i=0;i<16;i++)for(const human of ['US','BR'])for(let mode=0;mode<4;mode++){
 const seed=971000+i,style=['fleet','coast','screen','blockade'][i%4],options={groupUpdates:!!(mode&1),confirmAiSteps:!!(mode&2),cuttingOut:true};
 const s=E.newGame(human,seed,options);E.run(s);const other=JSON.parse(JSON.stringify(s));let n=0;
 while(!s.over){
  assert(n++<1500,'termination');const answer=policy(s,s.prompt,style),before=JSON.stringify({state:s,undo:[]}),oldPrompt=s.prompt.title;
  tracked=s;prior=snap(s);transitions=[];E.playTableAction(s,answer);tracked=null;
  direct.act(other,answer);for(const notice of s.tableReport.notices){assert.equal(other.prompt.title,notice.title);direct.act(other,other.prompt.kind==='info'?'ok':other.prompt.options.filter(o=>!o.disabled)[0].id);}
  assert.equal(clean(s),clean(other),'presentation must preserve full game state, RNG, decks and log');
  if(n%13===0){const checked=E.checkSaveState(JSON.parse(JSON.stringify(s)));assert.equal(JSON.stringify(s),JSON.stringify(checked));stats.saveChecks++;}
  stats.actions++;const moves=s.tableReport.map.moves;stats.moves+=moves.length;
  const meta={human,seed,style,options,step:n,prompt:oldPrompt,answer};
  const absent=transitions.filter(t=>t.from&&t.to&&!moves.some(m=>m.ships.includes(t.id)&&m.from.place===t.from&&m.to.place===t.to));
  if(absent.length){stats.intermediateOmissions++;save('intermediate-omitted',before,s,{...meta,missing:absent,actualMoves:moves,transitions});}
  const routeCount=moves.filter(m=>m.from.place&&m.to.place&&m.from.place!==m.to.place).length;
  if(routeCount>mostRoutes){mostRoutes=routeCount;fs.writeFileSync(path.join(out,'busy.json'),JSON.stringify({state:s,undo:[]}));stats.busiest={...meta,routes:routeCount};}
  const seenPairs={};for(const m of moves)if(m.from.place&&m.to.place&&m.from.place!==m.to.place){const pair=[m.from.place,m.to.place].sort().join('-');seenPairs[pair]=(seenPairs[pair]||0)+1;}
  if(Object.values(seenPairs).some(n=>n>1))save('shared-routes',before,s,{...meta,pairs:seenPairs});
  if(moves.some(m=>m.side===s.ai&&m.from.place?.startsWith('HOME')&&m.to.place==='SAC'))save('home-to-sackets',before,s,meta);
  if(moves.some(m=>m.from.box==='lake'&&m.to.box==='transit'))save('withdrawal',before,s,meta);
  const crowd=Object.keys(s.zones).reduce((n,z)=>n+(['US','BR'].every(sd=>Object.values(s.ships).some(sh=>sh.box==='lake'&&sh.zone===z&&sh.owner===sd))?10:0)+(s.zones[z].control?1:0)+(s.zones[z].blockade?1:0)+(s.encounter?.zone===z?2:0),0)+moves.length;
  if(crowd>highScore){highScore=crowd;fs.writeFileSync(path.join(out,'crowded.json'),JSON.stringify({state:s,undo:[]}));stats.crowdedPosition={...meta,crowd};}
 }
 stats.games++;stats.modes[mode]=(stats.modes[mode]||0)+1;
}
assert.equal(stats.intermediateOmissions,0,'Every procedure-boundary movement is recorded');
stats.passedGameplayEquivalence=true;
fs.writeFileSync(path.join(out,'map-audit.json'),JSON.stringify(stats,null,2));console.log(JSON.stringify(stats,null,2));
