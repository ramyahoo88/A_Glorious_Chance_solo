const fs=require('fs'),path=require('path'),assert=require('assert');
const H=require('../browser/page_helpers');
const {launch,loadText,st,ev,button,start}=H;
(async()=>{
const result=[];
for(const name of ['missed-tower','tow-preview','zero-strength-chip','zero-precondition']){
 const t=await launch(),raw=fs.readFileSync(path.join(__dirname,name+'.json'),'utf8');start(t,'US',966003);loadText(t,raw);
 const s=st(t),p=s.prompt,display=t.doc.querySelector('#proc').textContent;
 let details;
 if(p.kind==='lineup'){
  const reference=ev(t,`(()=>{const p=G_STATE.prompt,ms=missedSignalShip(G_STATE),a=buildColumn(G_STATE,p.candidates,p.defaultTows,p.side).filter(id=>id!==ms),t=towedInRound({tows:p.defaultTows},a);return {ms,actual:a.filter(id=>isCLS(G_STATE.ships[id])&&!t.includes(id)).length};})()`);
  const line=[...t.doc.querySelectorAll('#proc .muted')].map(n=>n.textContent).find(x=>/untowed/.test(x));
  details={line,reference};
 }else details={ships:Object.keys(s.encounter.ships).filter(id=>s.ships[id].steps===0&&s.encounter.ships[id]==='in'),display};
 result.push({name,details});t.w.close();
}
fs.writeFileSync(path.join(__dirname,'render-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.map(x=>({name:x.name,details:x.details.line?x.details:{ships:x.details.ships}})),null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
