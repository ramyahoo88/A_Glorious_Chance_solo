const fs=require('fs'),path=require('path');
const repo=path.resolve(process.argv[2]);
const {x}=require('./campaign/load')(repo), E=x('({newGame,run,act,def})');
const {policy}=require('./campaign/policy');
const out=path.join(__dirname,'targeted');fs.mkdirSync(out,{recursive:true});
const found={}, observations=[];
function save(key,s,details){if(found[key])return;found[key]={human:s.human,seed:s.seed,turn:s.turn,title:s.prompt?.title,...details};fs.writeFileSync(path.join(out,key+'.json'),JSON.stringify(s,null,2));}
for(let seed=920000;seed<920100;seed++)for(const side of ['US','BR'])for(const style of ['fleet','coast','screen']){
 const s=E.newGame(side,seed,{cuttingOut:true,groupUpdates:false});E.run(s);let n=0;
 while(!s.over&&n++<500){
  const p=s.prompt;
  if(p.title==='Command Decision – you hold the Weather Gage')save('command',s,{style});
  if(p.tactic&&p.title.includes('Attacker'))save('tactics',s,{style});
  if(p.title==='Gunnery Round results')save('gunnery',s,{style});
  if(p.kind==='lineup')save('lineup',s,{style});
  if(p.kind==='info'&&s.calls.some(f=>f.proc==='encounter'&&f.pc==='command'))save('encounter',s,{style});
  const before=JSON.stringify(s), log=s.log.length, seq=s.leader.US.seq,flags={...s.flagship},lost=s.lossesThisTurn.length;
  E.act(s,policy(s,p,style));
  const added=s.log.slice(log).map(l=>l.text);
  if(added.some(t=>/Convoy Scatter.*, 0 guns\)/.test(t)))save('zero-guns-before',JSON.parse(before),{style,after:added});
  if(s.leader.US.seq-seq>=2)save('double-leader-before',JSON.parse(before),{style,after:added});
  const melee=s.lossesThisTurn.slice(lost).find(l=>l.why==='Melee'&&flags[l.owner]===l.id);
  if(melee)save('melee-loser-before',JSON.parse(before),{style,ship:melee.id,owner:melee.owner,after:added});
 }
 if(n>=500)throw Error('did not end');
}
fs.writeFileSync(path.join(out,'natural-metadata.json'),JSON.stringify(found,null,2));console.log(JSON.stringify(found,null,2));
