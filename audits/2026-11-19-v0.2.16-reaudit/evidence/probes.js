const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(process.argv[2]||'.'),out=__dirname;
const {ctx,x}=require('./campaign/load')(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8'),ctx);
const E=x('({newGame,run,act,checkSaveState,validateAnswer})');
const {policy}=require('./campaign/policy'),paperDeck=require('./campaign/paper-deck');
const report=process.env.AGC_REPLAY_PROBES?JSON.parse(fs.readFileSync(path.join(out,'probes.json'))):{natural:{},corruptions:[],sameSideIntelligenceReplacement:null};
const plain=s=>JSON.parse(JSON.stringify(s));
function save(name,s){fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({state:s,undo:[]}));}
for(let seed=980000;seed<(process.env.AGC_REPLAY_PROBES?980000:980064);seed++)for(const side of ['US','BR']){
 const s=E.newGame(side,seed,{physicalEvents:true,confirmAiSteps:true,cuttingOut:true}),draw=paperDeck(seed^0x19b06);E.run(s);
 for(let n=0;!s.over&&n<1800;n++){
  const p=s.prompt,a=p.kind==='event'?draw(s):policy(s,p,'coast');
  if(p.kind==='event'){
   const f=s.calls.at(-2),key=f.proc+'-'+f.pc;
   if(!report.natural[key]){save(key,s);report.natural[key]={seed,side,n,purpose:p.purpose,answer:a};}
  }
  const before=plain(s),oldIntel=plain(s.intelligence),logStart=s.log.length;E.act(s,a);
  for(const sd of ['US','BR']){
   if(!report.sameSideIntelligenceReplacement&&oldIntel[sd]&&s.intelligence[sd]&&oldIntel[sd].card!==s.intelligence[sd].card){
    report.sameSideIntelligenceReplacement={seed,side,n,sd,old:oldIntel[sd],new:s.intelligence[sd],answer:a};save('intelligence-replacement-before',before);save('intelligence-replacement-after',s);
   }
  }
  const used=s.log.slice(logStart).find(r=>r.text.startsWith('Intelligence (Event #')&&r.text.includes('returns to the Event deck'));
  if(used&&!report.natural['intelligence-return']){
   const id=+used.text.match(/Event #(\d+)/)[1];save('intelligence-return-before',before);save('intelligence-return-after',s);
   report.natural['intelligence-return']={seed,side,n,answer:a,card:id,text:used.text,inDrawPile:s.deck.event.includes(id),held:Object.values(s.intelligence).some(it=>it?.card===id)};
  }
 }
}
report.corruptions=[];
for(const [name,mutate] of [
 ['coastal-raidEvent',s=>delete s.calls.at(-2).L.raidForce],
 ['encounter-reactionEvent',s=>delete s.calls.at(-2).L.reactionLines],
 ['coastal-asBattleEvent',s=>delete s.calls.at(-2).L.cur]
]){
 if(!report.natural[name])continue;
 const original=JSON.parse(fs.readFileSync(path.join(out,name+'.json'))).state,s=plain(original);mutate(s);
 let accepted=false,error=null,continued=false;
 try{E.checkSaveState(s);accepted=true;E.act(s,report.natural[name].answer);continued=true;}catch(e){error=e.message;}
 report.corruptions.push({name,accepted,continued,error});save('corrupt-'+name,(()=>{const a=plain(original);mutate(a);return a;})());
}
fs.writeFileSync(path.join(out,'probes.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
