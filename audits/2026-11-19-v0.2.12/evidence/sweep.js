// Reproducible new-game audit. Policies inspect human-visible options and ship values only.
// Invariants read the complete state after play, never to guide decisions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(process.argv[2]), start=+(process.argv[3]||710000), count=+(process.argv[4]||128), label=process.argv[5]||'candidate';
const out=__dirname;
const load=require('./load'),{ctx,x}=load(repo);
const restoredEngine=load(repo).x('({act})');
const E=x('({newGame,run,act,validateAnswer,def,troopCapacity,encSummary,aiAttackDecision,combatSummary,PROCS})');
require('vm').runInContext(fs.readFileSync(path.join(repo,'src/ui.js'),'utf8'), ctx);
const validateSave=x('checkSaveState');
const basePolicy=require('./policy').policy;
const sourceFiles=JSON.parse(fs.readFileSync(path.join(repo,'tools/files.json'))).engine;
const sourceHash=crypto.createHash('sha256').update(sourceFiles.map(f=>fs.readFileSync(path.join(repo,'src',f))).join('\n')).digest('hex');
const printed=[
'11-14 11-13 11-12 11 - - 11 - - 11 - - - - -',
'15-23 14-23 13-21 12-16 11-14 11-13 12-13 11-12 11 12 11 11 11 11 11',
'24-43 24-41 22-34 21-34 15-31 14-26 14-31 13-26 12-24 13-24 12-22 12-21 12-16 12-15 12-14',
'44-65 42-64 35-61 35-62 32-61 31-56 32-55 27-54 25-53 25-52 23-51 22-46 21-44 16-35 15-33',
'66 65-66 64-65 63-66 62-66 61-64 56-66 55-66 54-63 53-66 52-66 51-62 45-66 36-66 34-61',
'- - 66 - - 65-66 - - 64-66 - - 63-66 - - 62-66'].map(r=>r.split(' '));
const ids=['DM','DS','DR','AS','AM','AF'];
function readAid(lb){
 const b=lb.lg===0?0:lb.lg<=6?1:lb.lg<=15?2:lb.lg<=24?3:4, col=Math.max(0,b+lb.shift)*3+Math.min(lb.troops,3)-1;
 report.coverage.landColumns[col]++;
 report.coverage.landShift[lb.shift]=(report.coverage.landShift[lb.shift]||0)+1;
 for(let r=0;r<6;r++){const v=printed[r][col];if(v==='-')continue;const q=v.split('-').map(Number);if(lb.roll>=q[0]&&lb.roll<=q.at(-1))return ids[r];}
 // Documented project resolution for the two unassigned printed faces.
 if(col===2&&[62,63].includes(lb.roll))return 'AS';
 throw Error('Aid VII has no assigned result '+JSON.stringify(lb));
}
const val=(s,id,k)=>{const d=E.def(s.ships[id]);return (s.ships[id].steps>=d.full[4]?d.full:d.red)[k]};
function fewest(s,pool,k,minimum){
 const mains=pool.filter(id=>E.def(s.ships[id]).main), secs=pool.filter(id=>!E.def(s.ships[id]).main);
 function subs(a,need){let best=null;for(let mask=1;mask<(1<<a.length);mask++){const q=a.filter((id,i)=>mask&(1<<i));if(best&&q.length>=best.length)continue;if(q.reduce((n,id)=>n+val(s,id,k),0)>=need)best=q;}return best;}
 const mainTotal=mains.reduce((n,id)=>n+val(s,id,k),0);
 if(mainTotal>=minimum)return subs(mains,minimum)||[];
 const add=subs(secs,minimum-mainTotal);return add?mains.concat(add):[];
}
function choosePackage(s,p){
 const pool=p.items.map(i=>i.id), mains=pool.filter(id=>E.def(s.ships[id]).main),secs=pool.filter(id=>!E.def(s.ships[id]).main);
 switch(p.pkg){
 case 1:return {first:mains};
 case 2:case 3:case 4:case 5:case 6:return {first:fewest(s,pool,0,{2:28,3:22,4:16,5:18,6:20}[p.pkg])};
 case 7:return {first:mains.concat(secs.filter(id=>val(s,id,0)||val(s,id,2)))};
 case 8:{if(!s.aiTroops.box.some(m=>m.revealed&&m.troops))return {first:[]};const first=fewest(s,mains,2,8);if(!first.length)return {first:[]};const second=fewest(s,pool.filter(id=>!first.includes(id)),0,22);return second.length?{first,second}:{first:[]};}
 case 9:{const zero=secs.filter(id=>val(s,id,2)===0).sort((a,b)=>val(s,a,0)-val(s,b,0)||a.localeCompare(b));const lady=zero.includes('lady');const rest=zero.filter(id=>id!=='lady');return {first:lady&&rest.length?['lady',rest[0]]:!lady&&rest.length>=2?rest.slice(0,2):[]};}
 case 10:return {first:secs.length>=2?secs.slice(0,2):[]};
 case 11:{let n=0;const q=[];for(const id of secs){q.push(id);n+=s.ships[id].steps;if(n>=5)return {first:q};}return {first:[]};}
 default:throw Error('Package '+p.pkg);
 }
}
function manualPackage(s,p){
 const q=choosePackage(s,p);
 const army=p.text.includes('Army Support:')||p.requireTroops===true;
 if(p.pkg<=7&&army&&q.first.reduce((n,id)=>n+val(s,id,2),0)<4)return {first:[]};
 return q;
}
function expectedLevel(score,forced){if(forced)return (forced==='US'?'U.S.':'British')+' Decisive Victory (Dual Blockade)';return Math.abs(score)<=10?'Draw':(score>0?'U.S.':'British')+(Math.abs(score)>=33?' Decisive':Math.abs(score)>=22?'':' Marginal')+' Victory';}
function stock(s,sd,landed){return (sd===s.human?s.troops[sd].available+s.troops[sd].track.length:s.aiTroops.box.filter(m=>m.troops).length+s.aiTroops.track.filter(m=>m.troops).length)+(s.troopsReturning?.[sd]||0)+Object.values(s.forces).filter(f=>f.side===sd).reduce((n,f)=>n+(f.troops||0),0)+landed[sd];}
function invariant(s,landed){
 for(const sd of ['US','BR']){assert.equal(stock(s,sd,landed),3,'Troops conservation '+sd);assert(Number.isInteger(s.supply[sd])&&s.supply[sd]>=-1&&s.supply[sd]<=12,'Supply bounds');assert(Number.isInteger(s.cd[sd])&&s.cd[sd]>=0,'Construction delay');assert.equal(s.vp[sd],s.vpLog.filter(v=>v.side===sd).reduce((n,v)=>n+v.n,0),'side VP ledger');}
 assert(s.niagara>=0&&s.niagara<=6&&Number.isInteger(s.niagara),'Niagara bounds');
 for(const sh of Object.values(s.ships)){assert(Number.isInteger(sh.steps)&&sh.steps>=0&&sh.steps<=E.def(sh).full[4],'Ship steps '+sh.id);if(sh.forceId){assert(s.forces[sh.forceId]?.ships.includes(sh.id),'Ship has matching Force '+sh.id);}}
 for(const f of Object.values(s.forces)){assert.equal(new Set(f.ships).size,f.ships.length,'duplicate ship in Force');for(const id of f.ships){assert.equal(s.ships[id].owner,f.side,'Force ownership');assert.equal(s.ships[id].forceId,f.id,'Force membership');assert.equal(s.ships[id].zone,f.zone,'Force zone');}assert(Number.isInteger(f.troops)&&f.troops>=0,'Troop field');}
 // A ship may change hands more than once, but it cannot sink twice in one turn.
 const sunk=(s.lossesThisTurn||[]).filter(l=>l.how==='sunk').map(l=>l.id);assert.equal(new Set(sunk).size,sunk.length,'duplicate sinking in turn');
 if(s.encounter)for(const [id,status] of Object.entries(s.encounter.ships)){
  const sh=s.ships[id];
  if(status==='in'&&sh.box==='lake')assert.equal(sh.zone,s.encounter.zone,'Active ship is in Encounter zone: '+id);
 }
 for(const pile of Object.values(s.deck)) assert.equal(new Set(pile).size,pile.length,'Card occurs twice in a draw pile');
 for(const f of s.calls)assert(typeof E.PROCS[f.proc]?.[f.pc]==='function','Executable procedure');
 if(!s.over){assert(s.prompt&&s.calls.length,'Pending decision');}else{assert.equal(s.result.score,s.vp.US-s.vp.BR);assert.equal(s.result.level,expectedLevel(s.result.score,s.result.forced));}
}
const report={label,repo,sourceHash,start,count,policies:(process.env.AGC_POLICIES||'fleet,coast,cautious,screen,blockade').split(','),games:[],failures:[],checks:{prompts:0,roundTrips:0,previewPurity:0,manualPackages:0,manualLandBattles:0,firstRoundPreview:0,textOddsChecked:0,fullSaveContinuations:0,fullSaveActions:0},coverage:{kinds:{},prompts:{},tactics:{},events:{},endings:{},landColumns:Array(15).fill(0),landShift:{}}};
const probe=require('./observations')({report,E,ctx,x,out,label,repo});
const humanSeats=(process.env.AGC_SEATS||'US,BR').split(',');
for(let i=0;i<count;i++)for(const human of humanSeats)for(const style of report.policies){
 const seed=start+i,k=seed-710000,manual=k%4===0,opts={cuttingOut:k%2===0,oa1Upgrades:k%4===0,usAiPrecondition:k%4<2?'longgun':'carronade',confirmAiSteps:process.env.AGC_PAUSES===undefined?k%5!==0:process.env.AGC_PAUSES==='1',manualPackages:manual,manualLandBattle:manual};
 if(process.env.AGC_OPTION_GRID==='1'){
  const bits=(seed-713000)&63;
  Object.assign(opts,{cuttingOut:!!(bits&1),oa1Upgrades:!!(bits&2),manualPackages:!!(bits&4),manualLandBattle:!!(bits&8),confirmAiSteps:!!(bits&16),usAiPrecondition:bits&32?'carronade':'longgun'});
 }
 const s=E.newGame(human,seed,opts),landed={US:0,BR:0};E.run(s);let n=0,pendingSecond=[],pendingSnapshot,answer,lastPrompt,pendingPreview=null,restored=null;const kinds={};
 try{
  probe.begin(s,style,seed);
  invariant(s,landed);
  while(!s.over&&n<1600){
   const p=s.prompt;lastPrompt=p.title;kinds[p.kind]=(kinds[p.kind]||0)+1;report.coverage.kinds[p.kind]=(report.coverage.kinds[p.kind]||0)+1;report.coverage.prompts[p.title]=(report.coverage.prompts[p.title]||0)+1;
   if(p.pkg){const q=manualPackage(s,p);pendingSecond=q.second||[];answer=q.first.concat(pendingSecond);report.checks.manualPackages++;}
   else if(p.packageStage==='patrol'||p.title==='Force Package #8 – second stack')answer=pendingSecond;
   else if(p.landBattle){answer=readAid(p.landBattle);report.checks.manualLandBattles++;}
   else if(style==='cautious'&&p.kind==='choice'){
    const options=p.options.filter(o=>!o.disabled),avoid=['bypass','pass','withdraw','no'];const pick=avoid.map(id=>options.find(o=>o.id===id)).find(Boolean);answer=pick?pick.id:basePolicy(s,p,'fleet');
   }else answer=basePolicy(s,p,style==='cautious'?'fleet':style);
   assert.equal(E.validateAnswer(s,p,answer),null,'policy must make legal choices');
   if(p.tactic)report.coverage.tactics[answer]=(report.coverage.tactics[answer]||0)+1;
   pendingSnapshot=JSON.stringify({state:s,undo:[]});
   if(p.kind==='lineup'){
    const z=s.zones[s.encounter.zone].flags, ms=z.missedSignal&&!z.missedSignalUsed&&s.encounter.ships[z.missedSignal]==='in'?z.missedSignal:null;
    const noLG=!!(z.haze&&!z.hazeUsed);
    const strength=ids=>ids.filter(id=>id!==ms).reduce((n,id)=>{
     const sh=s.ships[id],d=E.def(sh),v=sh.steps<=0?[0,0,0,0]:sh.steps>=d.full[4]?d.full:d.red;
     return n+(p.side==='BR'?(noLG?0:v[0]/2)+v[1]+v[3]:(noLG?0:v[0])+v[1]/2+v[3]);
    },0);
    const all = answer.attackers.length===p.candidates.length;
    const forecast = all && /Odds if you attack with all full-strength ships: ([0-9.]+) vs ([0-9.]+)/.exec(E.encSummary(s));
    if(forecast){assert.equal(+forecast[1],strength(answer.attackers),'Player-visible attacking preview');assert.equal(+forecast[2],strength(p.defenders),'Player-visible defensive preview');}
    pendingPreview={combat:s.combat,seq:s.combat.seq,att:p.side,a:strength(answer.attackers),d:strength(p.defenders),forecast:!!forecast};
   }
   if(s.encounter&&n%7===0){const before=JSON.stringify(s);E.encSummary(s);E.aiAttackDecision(s,false);if(s.combat)E.combatSummary(s);assert.equal(JSON.stringify(s),before,'Preview consumes no state/dice');report.checks.previewPurity++;}
   if(!restored&&seed%16===0&&n===30){
    restored=JSON.parse(pendingSnapshot).state;
    if(seed===start&&style==='coast'&&human==='US')fs.writeFileSync(path.join(out,label+'-midgame.json'),pendingSnapshot);
   }
   const oldLog=s.log.length,mirror=n%31===0?JSON.parse(JSON.stringify(s)):null;
   probe.before(s,p,answer,pendingSnapshot,n);E.act(s,answer);probe.after(s);
   if(restored){restoredEngine.act(restored,JSON.parse(JSON.stringify(answer)));report.checks.fullSaveActions++;}
   if(mirror){validateSave(mirror);E.act(mirror,answer);assert.equal(JSON.stringify(s),JSON.stringify(mirror),'Exact JSON continuation including dice');report.checks.roundTrips++;}
   for(const row of s.log.slice(oldLog)){const m=/^(U\.S\.|British) Troops launched in .+: (\d+)\./.exec(row.text);if(m)landed[m[1]==='U.S.'?'US':'BR']+=+m[2];}
   if(pendingPreview){
    const line=s.log.slice(oldLog).map(r=>r.text).find(t=>/^Gunnery Round 1:/.test(t));
    if(line){
     const found=/^Gunnery Round 1: (British|U\.S\.) ([0-9.]+) vs (British|U\.S\.) ([0-9.]+)/.exec(line);
     assert(found,'Read displayed first round');assert.equal(found[1],pendingPreview.att==='BR'?'British':'U.S.','Preview attacker');
     assert.equal(+found[2],pendingPreview.a,'First-round preview attacking strength');assert.equal(+found[4],pendingPreview.d,'First-round preview defending strength');
     report.checks.firstRoundPreview++;if(pendingPreview.forecast)report.checks.textOddsChecked++;pendingPreview=null;
    }else if(s.combat!==pendingPreview.combat||s.combat.seq!==pendingPreview.seq)pendingPreview=null;
   }
   n++;report.checks.prompts++;invariant(s,landed);
  }
  assert(s.over,'Campaign must end');
  if(restored){assert.equal(JSON.stringify(s),JSON.stringify(restored),'Cross-runtime save follows every remaining action to the same complete score, log and dice');report.checks.fullSaveContinuations++;}
  report.coverage.endings[s.result.level]=(report.coverage.endings[s.result.level]||0)+1;
  const row={human,seed,style,opts,prompts:n,kinds,turn:s.turn,score:s.result.score,level:s.result.level,launched:landed,...probe.finish(s)};report.games.push(row);
  for(const row of s.log){const m=/Event #(\d+)/.exec(row.text);if(m)report.coverage.events[m[1]]=(report.coverage.events[m[1]]||0)+1;}
 }catch(e){
  const error={human,seed,style,opts,prompt:lastPrompt,prompts:n,answer,error:e.message};
  report.failures.push(error);
  if(report.failures.length<=12){const name=label+'_'+human+'_'+seed+'_'+style;fs.writeFileSync(path.join(out,name+'.json'),pendingSnapshot||JSON.stringify({state:s,undo:[]}));error.fixture=name+'.json';}
 }
}
report.summary={attempts:count*humanSeats.length*report.policies.length,completed:report.games.length,failures:report.failures.length,early:report.games.filter(g=>g.turn<8).length,draws:report.games.filter(g=>g.level==='Draw').length,totalPrompts:report.checks.prompts,manualGames:report.games.filter(g=>g.opts.manualPackages).length,minPrompts:Math.min(...report.games.map(g=>g.prompts)),maxPrompts:Math.max(...report.games.map(g=>g.prompts))};
fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceHash,summary:report.summary,checks:report.checks,firstFailures:report.failures.slice(0,12)},null,2));process.exitCode=report.failures.length?1:0;
