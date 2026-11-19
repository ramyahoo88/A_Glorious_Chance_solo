// Deliberately damaged saves, separate from natural campaign evidence.
const fs=require('fs'),path=require('path');
const {launch,start,loadText,st,ev,button}=require('../browser/page_helpers');
(async()=>{
 const original=await launch();start(original,'BR',966001);const natural=st(original);original.w.close();
 const cases=[['missing-frame-locals',s=>{delete s.calls[0].L;}],['null-frame-locals',s=>{s.calls[0].L=null;}],['unknown-event',s=>{s.deck.event[0]=999;}],['valid-control',s=>{}]];
 const results=[];
 for(const [name,mutate] of cases){
  const damaged=JSON.parse(JSON.stringify(natural));mutate(damaged);
  const t=await launch();start(t,'US',966002);const before=ev(t,'JSON.stringify(G_STATE)'),disk=t.w.localStorage.getItem('agc_solo_companion_v1');
  const raw=JSON.stringify({state:damaged,undo:[]});fs.writeFileSync(path.join(__dirname,name+'.json'),raw);loadText(t,raw);
  const accepted=st(t).seed===966001,importError=t.doc.querySelector('#modal .err')?.textContent||'';
  let actionError='',preservedOnFailedAction=null;
  if(accepted){const loaded=ev(t,'JSON.stringify(G_STATE)');button(t,'June I (this turn)',t.doc.querySelector('#proc'));actionError=ev(t,'UI.err');preservedOnFailedAction=loaded===ev(t,'JSON.stringify(G_STATE)');}
  results.push({name,accepted,importError,actionError,preservedOnFailedAction,rejectedImportPreserved:!accepted&&before===ev(t,'JSON.stringify(G_STATE)')&&disk===t.w.localStorage.getItem('agc_solo_companion_v1'),errors:t.errors});t.w.close();
 }
 fs.writeFileSync(path.join(__dirname,'import-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
