const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=process.argv[2],out=path.join(root,'audits/2026-11-19-v0.2.14/evidence');
const {ctx,x}=require(path.join(root,'audits/2026-11-19-v0.2.13/evidence/campaign/load'))(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8')+"\nfunction sgn(n){return (n>0?'+':n<0?'−':'±')+Math.abs(n)}",ctx);
const E=x('({newGame,run,playTableAction})'),{policy}=require(path.join(root,'audits/2026-11-19-v0.2.13/evidence/campaign/policy'));
const seen={};let games=0;
for(let seed=968000;seed<968015;seed++)for(const side of ['US','BR']){
 const s=E.newGame(side,seed,{groupUpdates:seed%2===0,confirmAiSteps:true,cuttingOut:true});E.run(s);let steps=0;
 while(!s.over){
  const answer=policy(s,s.prompt,'coast'),before=JSON.stringify({state:s,undo:[]});
  E.playTableAction(s,answer);steps++;
  const moves=s.tableReport.map.moves;
  const types=[['ai-deploy',m=>m.side===s.ai&&m.from.box==='deployable'&&m.to.box==='lake'],['return',m=>m.from.box==='lake'&&m.to.box==='transit'],['capture',m=>m.captured],['zone-move',m=>['YOR','NOR','KIN','NIA','SOU','SAC'].includes(m.from.place)&&['YOR','NOR','KIN','NIA','SOU','SAC'].includes(m.to.place)&&m.from.place!==m.to.place]];
  for(const [kind,test] of types)if(!seen[kind]&&moves.some(test)){
   fs.writeFileSync(path.join(out,kind+'-before.json'),before);
   fs.writeFileSync(path.join(out,kind+'-after.json'),JSON.stringify({state:s,undo:[]}));
   seen[kind]={side,seed,steps,answer,title:JSON.parse(before).state.prompt.title,moves};
  }
  assert(steps<1500);
 }
 games++;if(Object.keys(seen).length===4)break;
}
fs.writeFileSync(path.join(out,'natural-fixtures.json'),JSON.stringify({games,cases:seen},null,2));
console.log(JSON.stringify({games,cases:Object.keys(seen)},null,2));
