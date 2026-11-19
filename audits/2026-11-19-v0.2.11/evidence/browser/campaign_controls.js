// Play unmodified shipped HTML using the actual DOM handlers, and record the visible controls.
const {fs,path,assert,out,launch,ev,st,button,change,start}=require('./page_helpers');
const {policy}=require('../campaign/policy');
const side=process.argv[3]||'BR', seed=Number(process.argv[4]||188007), style=process.argv[5]||'coast';
const r=t=>t.doc.querySelector('#proc');
const scoped=(root,selector)=>Array.from(root.querySelectorAll(selector));
const doButton=(t,actions,label)=>{
  actions.push({type:'button',label});
  button(t,label,r(t));
};
function runControls(t,p,answer) {
  const actions=[];
  if(p.kind==='info')doButton(t,actions,'Continue');
  else if(p.kind==='choice'){
    const option=p.options.find(o=>o.id===answer);
    assert(option,'No option for '+answer);
    if(p.tactic){
      actions.push({type:'tactic',label:option.label});
      scoped(r(t),'.optcard .t').find(e=>e.textContent===option.label).click();
    }else doButton(t,actions,option.label);
  }else if(p.kind==='select'){
    const checked=(p.initial||[]).slice();
    if(JSON.stringify(checked)!==JSON.stringify(answer)){
      if(checked.length)doButton(t,actions,'Clear');
      for(const id of answer){
        const label=p.items.find(x=>x.id===id).label;
        actions.push({type:'checkbox',label});
        scoped(r(t),'.sel-list label').find(e=>e.textContent===label).querySelector('input').click();
      }
    }
    doButton(t,actions,'Confirm');
  }else if(p.kind==='lineup'){
    assert.deepStrictEqual(answer.attackers,p.candidates);
    doButton(t,actions,'Attack with these ships');
  }else if(p.kind==='assign'){
    assert.equal(answer.flagship,p.flagship);
    answer.forces.forEach(({mission,zone,ships,troops},group)=>{
      doButton(t,actions,'+ Add Force');
      const box=()=>scoped(r(t),'.asg-force')[group];
      const select=(index,value)=>{
        const item=box().querySelectorAll('select')[index];
        if(item.value===value)return;
        const label=Array.from(item.options).find(op=>op.value===value).textContent;
        actions.push({type:'select',group,index,label});
        change(t,item,value);
      };
      select(0,mission);select(1,zone);
      for(const id of ships){
        const name=ev(t,`(function(){const sh=G_STATE.ships[${JSON.stringify(id)}], d=def(sh);return d.name+(d.ver?' '+d.ver:'')+(sh.port==='temp'?' (Isolated)':'');})()`);
        const chip=scoped(box(),'.asg-ship').find(e=>e.textContent===name);
        assert(chip);
        actions.push({type:'ship',group,label:name});
        chip.click();
      }
      if(mission==='ArmySupport'){
        const target=box().querySelector('input[type=number]');
        if(Number(target.value)!==troops){
          actions.push({type:'number',group,value:String(troops)});
          change(t,target,String(troops));
        }
      }
    });
    doButton(t,actions,'Confirm assignments');
  }else throw Error(p.kind);
  assert.equal(ev(t,'UI.err'),'');
  return actions;
}
(async()=>{
  const t=await launch();
  const group = [...t.doc.querySelectorAll('.setup label')].find(n => n.textContent.includes('Group routine'));
  if(process.argv[6] === 'group') group.querySelector('input').click();
  start(t,side,seed);
  const trace=[];let s=st(t), oldLogLength=s.log.length;
  while(!s.over&&trace.length<1500){
    const p=s.prompt,step=r(t).querySelector('.step').textContent, title=r(t).querySelector('.ptitle').textContent;
    const chosen=policy(s,p,style);
    const actions=runControls(t,p,chosen);s=st(t);
    const event=(s.log.slice(oldLogLength).filter(x=>/CAPTURED|Pursuit!|Coastal mission aborted|due back/.test(x.text))).map(x=>x.text);
    trace.push({step,title,kind:p.kind,actions,...(event.length?{resultLog:event}:{})});
    oldLogLength=s.log.length;
  }
  assert(s.over);assert.deepStrictEqual(t.errors,[]);
  const total=s.vpLog.reduce((n,row)=>n+(row.side==='US'?row.n:-row.n),0);assert.equal(total,s.result.score);
  const totals=trace.reduce((h,row)=>(h[row.kind]=(h[row.kind]||0)+1,h),{});
  const doc={side,seed,style,options:s.options,totals,steps:trace,final:{turn:s.turn,result:s.result,vp:s.vp,ledger:s.vpLog}};
  fs.writeFileSync(path.join(out,'controls-'+seed+'.json'),JSON.stringify(doc,null,2)+'\n');
  button(t,'Save');
  const save=t.doc.querySelector('#modal textarea').value;
  fs.writeFileSync(path.join(out,'checkpoints','game-over-'+seed+'.json'),save);
  console.log(JSON.stringify({side,seed,style,steps:trace.length,totals,score:total,level:s.result.level,vp:s.vp,pursuit:trace.filter(e=>e.title.startsWith('Pursuit')).length},null,2));
  t.dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
