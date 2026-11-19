// Natural campaign search; all choices come from the visible-information policy.
const fs=require('fs'),path=require('path');
const repo=path.resolve(process.argv[2]), {x}=require('../campaign/load')(repo);
const E=x('({newGame,run,act,def,aiAttackDecision,combatVals,missedSignalShip,buildColumn,towedInRound,sideStrength,curVals})');
const {policy}=require('../campaign/policy');
const out=__dirname, found={};let games=0, decisions=0;
function save(key,s,answer,extra){if(found[key])return;const file=key+'.json';fs.writeFileSync(path.join(out,file),JSON.stringify({state:s,undo:[]}));found[key]={file,human:s.human,seed:s.seed,turn:s.turn,style,prompt:s.prompt.title,answer,...extra};}
let style;
for(let seed=961000;seed<961400&&Object.keys(found).length<4;seed++)for(const human of ['US','BR'])for(style of ['fleet','screen','coast']){
 const s=E.newGame(human,seed,{cuttingOut:true});E.run(s);let n=0;
 while(!s.over&&n++<1000){
  const p=s.prompt,answer=policy(s,p,style);decisions++;
  if(p.kind==='lineup'&&p.side==='US'){
   const ms=E.missedSignalShip(s), t=p.defaultTows||{};
   if(ms&&t[ms])save('missed-tower',s,answer,{missed:ms,tows:t});
   const col=E.buildColumn(s,answer.attackers,answer.tows,'US').filter(id=>id!==ms);
   const towed=E.towedInRound({tows:answer.tows},col);
   const displayed=answer.attackers.filter(id=>E.def(s.ships[id]).cls&&!Object.values(answer.tows).includes(id)).length;
   const actual=col.filter(id=>E.def(s.ships[id]).cls&&!towed.includes(id)).length;
   if(displayed!==actual)save('tow-preview',s,answer,{missed:ms,tows:t,displayed,actual});
  }
  if(s.encounter){
   const zero=Object.keys(s.encounter.ships).filter(id=>s.encounter.ships[id]==='in'&&s.ships[id].steps===0&&E.curVals(s.ships[id]).slice(0,4).some(Boolean));
   if(zero.length)save('zero-strength-chip',s,answer,{ships:zero,printed:zero.map(id=>E.curVals(s.ships[id]).slice(0,4)),effective:zero.map(id=>E.combatVals(s,s.ships[id]))});
   const plan=E.aiAttackDecision(s,false);
   if(!plan.ships.length&&zero.some(id=>s.ships[id].owner===human)&&/fails: must be greater/.test(plan.why)){
    const copy=JSON.parse(JSON.stringify(s));
    // Diagnostic removes zero-strength defenders only for the *printed* comparison.
    const side=s.ai, basis=side==='BR'?'car':s.options.usAiPrecondition==='carronade'?'car':'lg';
    const count=ids=>ids.filter(id=>s.ships[id].steps>0).reduce((n,id)=>{const v=E.curVals(s.ships[id]);return n+v[basis==='car'?1:0]+v[3];},0);
    const a=Object.keys(s.encounter.ships).filter(id=>s.encounter.ships[id]==='in'&&s.ships[id].owner===side&&s.ships[id].steps===E.def(s.ships[id]).full[4]&&!(side==='BR'&&E.def(s.ships[id]).cls));
    const d=Object.keys(s.encounter.ships).filter(id=>s.encounter.ships[id]==='in'&&s.ships[id].owner===human);
    if(count(a)>count(d))save('zero-precondition',s,answer,{zero,plan,zeroAwarePrinted:[count(a),count(d)]});
   }
  }
  E.act(s,answer);
 }
 games++;
}
fs.writeFileSync(path.join(out,'probe-results.json'),JSON.stringify({games,decisions,found},null,2));console.log(JSON.stringify({games,decisions,found},null,2));
