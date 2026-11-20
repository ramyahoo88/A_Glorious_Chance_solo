// Additional audit probes. No production code is modified.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||'.'),out=__dirname;
const {ctx,x}=require('./campaign/load')(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8'),ctx);
const E=x('({newGame,run,playTableAction,checkSaveState,recordEventUndo,eventRestoreText,eventDrawText})');
const plain=s=>JSON.parse(JSON.stringify(s)),save=(name,value)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
const old=path.join(root,'audits/2026-11-19-v0.2.16-reaudit/evidence');
const read=name=>JSON.parse(fs.readFileSync(path.join(old,name+'.json'))).state;
const {policy}=require('./campaign/policy');const deck=require('./campaign/paper-deck');
const report={damagedCallers:[],multiUndo:null};
for(const fixture of ['coastal-raidEvent','coastal-asBattleEvent'])for(const field of ['order']){
 const s=read(fixture);delete s.calls.at(-2).L[field];const name=fixture+'-missing-'+field;
 let accepted=false,error=null,trace=[];
 try{E.checkSaveState(s);accepted=true;}catch(e){error=e.message;}
 if(accepted){save(name,{state:s,undo:[]});for(let i=0;i<20&&!s.over;i++){
   const p=s.prompt,answer=p.kind==='event'?(i===0?(fixture==='coastal-raidEvent'?27:23):s.deck.event.find(n=>n!==30)):policy(s,p,'coast');
   try{E.playTableAction(s,answer);trace.push({title:p.title,answer,next:s.prompt?.title});}
   catch(e){error=e.message;trace.push({title:p.title,answer,error});break;}
 }}
 report.damagedCallers.push({fixture,field,accepted,error,trace});
}
// Natural first Event of the second turn, with normal individual notices.
// The player follows its instruction to shuffle, then presses Undo repeatedly.
{
 const seed=986000,s=E.newGame('US',seed,{...x('defaultOptions()'),physicalEvents:true,confirmAiSteps:true,groupUpdates:false});
 const draw=deck(seed^0x19b06),history=[],trace=[];E.run(s);
 while(!(s.turn===1&&s.prompt.kind==='event')){
  assert(trace.length<400&&!s.over);const p=s.prompt,a=p.kind==='event'?draw(s):policy(s,p,'coast');
  history.push(JSON.stringify(s));trace.push({turn:s.turn,title:p.title,kind:p.kind,answer:a});E.playTableAction(s,a);
 }
 save('multi-undo-start',{state:s,undo:history.slice(-60)});save('multi-undo-play-trace',trace);
 let current=plain(s),steps=[];for(let i=history.length-1;i>=0;i--){
  const restored=E.checkSaveState(JSON.parse(history[i]));E.recordEventUndo(current,restored);
  steps.push({turn:restored.turn,title:restored.prompt.title,kind:restored.prompt.kind,eventRestore:restored.eventRestore||null});current=restored;
  if(current.prompt.kind==='event')break;
 }
 assert.equal(current.turn,0);assert(current.eventRestore);
 report.multiUndo={seed,startTurn:s.turn,startRemaining:s.deck.event.length,startText:E.eventDrawText(s,s.prompt.purpose,s.calls.at(-1).L.gale,false),undos:steps.length,steps,restoredRemaining:current.deck.event.length,note:current.eventRestore,text:E.eventRestoreText(current),lastEntry:trace.filter(t=>t.kind==='event').at(-1)};
 save('multi-undo-restored',{state:current,undo:[]});
}
save('probes',report);console.log(JSON.stringify(report,null,2));
