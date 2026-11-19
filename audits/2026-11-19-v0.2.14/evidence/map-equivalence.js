const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=process.argv[2],{ctx,x}=require(path.join(repo,'audits/2026-11-19-v0.2.13/evidence/campaign/load'))(repo);
vm.runInContext(fs.readFileSync(path.join(repo,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(repo,'src/ui_table.js'),'utf8'),ctx);
const E=x('({newGame,run,act,playTableAction,checkSaveState})');
const {policy}=require(path.join(repo,'audits/2026-11-19-v0.2.13/evidence/campaign/policy'));
const plain=s=>{const {tableReport,...r}=s;return JSON.stringify(r)};
const count={games:0,actions:0,transitions:0,roundTrips:0,groupedNotices:0};
for(let i=0;i<24;i++)for(const human of ['US','BR']){
 const s=E.newGame(human,969000+i,{groupUpdates:i%2===0,confirmAiSteps:true,cuttingOut:i%3===0});E.run(s);const direct=JSON.parse(JSON.stringify(s));let n=0;
 while(!s.over){
  const answer=policy(s,s.prompt,['fleet','coast','screen','blockade'][i%4]);E.playTableAction(s,answer);E.act(direct,answer);
  for(const notice of s.tableReport.notices){const p=direct.prompt;assert.equal(p.title,notice.title);E.act(direct,p.kind==='info'?'ok':p.options.filter(o=>!o.disabled)[0].id);count.groupedNotices++;}
  assert.equal(plain(s),plain(direct),'Map cannot change game, hidden decks, RNG, log or result');
  if(n%11===0){const saved=E.checkSaveState(JSON.parse(JSON.stringify(s)));assert.equal(JSON.stringify(saved),JSON.stringify(s));count.roundTrips++;}
  count.actions++;count.transitions+=s.tableReport.map.moves.length;n++;assert(n<1500);
 }
 count.games++;
}
const report={count,passed:true,seeds:'969000–969023, both campaigns',policies:['fleet','coast','screen','blockade']};
fs.writeFileSync(path.join(repo,'audits/2026-11-19-v0.2.14/evidence/equivalence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
