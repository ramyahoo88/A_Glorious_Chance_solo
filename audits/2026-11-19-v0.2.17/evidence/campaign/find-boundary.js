const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||'.'),out=path.dirname(__dirname),{ctx,x}=require('./load')(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8'),ctx);
const E=x('({newGame,run,playTableAction,checkSaveState})'),{policy}=require('./policy'),paper=require('./paper-deck');
for(let seed=981000;seed<981064;seed++)for(const side of ['US','BR']){
 const s=E.newGame(side,seed,{physicalEvents:true,confirmAiSteps:false,groupUpdates:true,cuttingOut:true}),draw=paper(seed^0x19b06);E.run(s);
 for(let n=0;!s.over&&n<1800;n++){
  const answer=s.prompt.kind==='event'?draw(s):policy(s,s.prompt,'fleet'),before=JSON.parse(JSON.stringify(s));E.playTableAction(s,answer);
  if(before.prompt.kind==='event'&&s.turn!==before.turn){
   E.checkSaveState(before);assert.equal(s.turn,before.turn+1);
   for(const [name,state] of [['turn-reset-before',before],['turn-reset-after',s]])fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({state,undo:[]}));
   fs.writeFileSync(path.join(out,'turn-reset-meta.json'),JSON.stringify({seed,side,n,answer,from:before.turn,to:s.turn},null,2));console.log({seed,side,n,answer});process.exit(0);
  }
 }
}
throw Error('No grouped Event/turn boundary found');
