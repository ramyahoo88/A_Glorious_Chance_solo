// Physical entry vs the established automatic resolver, with exactly the same
// drawn-card transcript. No card number is chosen by a human strategy policy.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');process.argv[2] ||= root;
const spec=JSON.parse(fs.readFileSync(path.join(root,'tools/files.json'))),source=spec.engine.map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n;\n');
function load(observe){
 const ctx=vm.createContext({console,Math,JSON,Object,Array,String,Number,Error,Date,observe});
 const text=observe?source.replace('const id = s.deck.event.shift();','const id = s.deck.event.shift(); observe(id, purpose);'):source;
 vm.runInContext(text+'\n;installResume();\n'+fs.readFileSync(path.join(root,'src/ui.js'),'utf8'),ctx);
 return vm.runInContext('({newGame,run,act,validateAnswer,checkSaveState,PROCS,EVENTS})',ctx);
}
let checks=0;const check=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const plain=s=>JSON.parse(JSON.stringify(s));
const semantic=s=>{
 const x=plain(s);delete x.options.physicalEvents;delete x.eventCardsPrepared;delete x.promptSeq;
 if(x.prompt)delete x.prompt.id;
 x.calls.forEach(f=>delete f.ret);
 x.log=x.log.filter(r=>!r.text.startsWith('Physical Event card #')).map(r=>r.text.startsWith('Event deck exhausted')?{...r,text:'Event deck exhausted'}:r);
 return x;
};
const transcript=[],automatic=load((id,purpose)=>transcript.push({id,purpose})),physical=load();
function entry(ids,allowGale=false){
 const s=physical.newGame('US',1,{physicalEvents:true});s.deck.event=ids;
 s.calls=[{proc:'eventDraw',pc:'start',A:{purpose:'Focused Event check',allowGale},L:{}}];physical.run(s);return s;
}
{
 const s=entry([1,2,30]);const stable=JSON.stringify(s);
 for(const n of ['',null,0,39,1.1,Infinity,'1'])check(!!physical.validateAnswer(s,s.prompt,n),true,'reject invalid number');
 check(JSON.stringify(s),stable,'validation is read-only');
 const saved=physical.checkSaveState(plain(s));check(plain(saved),plain(s),'pending entry saves exactly');
 for(const mutate of [x=>delete x.calls[0].A,x=>x.calls[0].A.allowGale='yes',x=>x.prompt.purpose='wrong',x=>x.prompt.remaining=2,x=>x.deck.event.push(1)]){
  const bad=plain(s);mutate(bad);assert.throws(()=>physical.checkSaveState(bad));checks++;
 }
 physical.act(s,1);check(Array.from(s.deck.event),[2,30],'only entered card leaves the pile');
 const repeat=entry([2,30]);check(!!physical.validateAnswer(repeat,repeat.prompt,1),true,'a used card cannot be entered again');
 const held=entry([1,2]);held.intelligence.US={card:1,until:1};check(!!physical.validateAnswer(held,held.prompt,1),true,'held Intelligence card is refused');
 const gale=entry([30,1]);physical.act(gale,30);check(gale.prompt.kind,'event','Gale asks for a separate card');check(gale.deck.event.includes(30),false,'Gale was actually consumed');check(gale.prompt.text.includes('Discard Event #30'),true,'redraw explains the physical action');
 const galeSaved=physical.checkSaveState(plain(gale));physical.act(gale,1);physical.act(galeSaved,1);check(plain(galeSaved),plain(gale),'Gale continuation saves without replay');
 const allowed=entry([30],true);physical.act(allowed,30);check(allowed.calls.length,0,'legal Lake Action Gale returns to its parent');
 const empty=entry([30]);empty.intelligence.US={card:1,until:1};physical.act(empty,30);check(empty.prompt.remaining,37,'exhaustion excludes held Intelligence');check(empty.prompt.text.includes('Prepare and shuffle'),true,'exhaustion requests physical reshuffle');
}
const {policy}=require(path.join(root,'audits/2026-11-19-v0.2.13/evidence/campaign/policy'));
const result={games:0,actions:0,enteredCards:0,galeRedraws:0,pendingSaveChecks:0,purposes:{},results:[]};
for(let i=0;i<32;i++)for(const side of ['US','BR']){
 const seed=975000+i,style=['fleet','coast','screen','blockade'][i%4],opts={confirmAiSteps:i%2===0,cuttingOut:true,oa1Upgrades:i%3===0};
 const a=automatic.newGame(side,seed,opts),s=physical.newGame(side,seed,{...opts,physicalEvents:true});automatic.run(a);physical.run(s);let n=0,entries=0;
 while(!a.over){
  assert(n++<1600);check(s.prompt.kind,a.prompt.kind,'same decision type');check(s.prompt.title,a.prompt.title,'same decision context');
  const answer=policy(a,a.prompt,style);transcript.length=0;automatic.act(a,answer);physical.act(s,JSON.parse(JSON.stringify(answer)));
  while(s.prompt?.kind==='event'){
   const draw=transcript.shift();assert(draw,'every physical prompt corresponds to one actual draw');check(draw.purpose,s.prompt.purpose,'correct draw purpose');
   const redraw=draw.id===30&&!s.prompt.allowGale;
   const saved=physical.checkSaveState(plain(s));physical.act(s,draw.id);physical.act(saved,draw.id);check(plain(saved),plain(s),'card-entry continuation is exact');
   result.pendingSaveChecks++;result.enteredCards++;entries++;if(redraw)result.galeRedraws++;
   result.purposes[draw.purpose]=(result.purposes[draw.purpose]||0)+1;
  }
  check(transcript.length,0,'no Event draws skipped');check(semantic(s),semantic(a),'all gameplay, RNG, cards, log and procedure locals match');result.actions++;
 }
 result.games++;result.results.push({side,seed,style,actions:n,entries,result:s.result});
}
for(const name of ['Encounter Check','Encounter ','Reaction Segment Weather Gage','Weather Gage recheck','Raid on','Land Battle'])
 check(Object.keys(result.purposes).some(p=>p.includes(name)),true,'covered '+name);
result.assertions=checks;result.passed=true;
if(process.env.AGC_EVIDENCE_OUT)fs.writeFileSync(path.join(process.env.AGC_EVIDENCE_OUT,'physical-equivalence.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,results:undefined},null,2));
