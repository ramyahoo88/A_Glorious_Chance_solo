const assert=require('assert/strict');
module.exports=async function drive(pg,s,answer){
 const p=s.prompt,r=pg.locator('#proc'),button=name=>r.getByRole('button',{name,exact:true});
 if(p.kind==='event'){await r.getByLabel('Event card number',{exact:true}).fill(String(answer));await button('Use Event card').click();}
 else if(p.kind==='info')await button('Continue').click();
 else if(p.kind==='choice'){
  const op=p.options.find(o=>o.id===answer);assert(op);
  if(p.tactic)await r.locator('button.optcard').filter({has:pg.locator('.t',{hasText:op.label})}).click();
  else await button(op.label).click();
 }else if(p.kind==='select'){
  const initial=p.initial||[];
  if(JSON.stringify(initial)!==JSON.stringify(answer)){
   if(initial.length)await button('Clear').click();
   for(const id of answer){const item=p.items.find(o=>o.id===id);await r.getByRole('checkbox',{name:item.label,exact:true}).check();}
  }
  await button('Confirm').click();
 }else if(p.kind==='lineup'){
  assert.deepEqual(answer.attackers,p.candidates);assert.deepEqual(answer.tows,p.defaultTows||{});
  await button('Attack with these ships').click();
 }else if(p.kind==='assign'){
  if(answer.flagship!==p.flagship)await r.getByLabel('Flagship',{exact:true}).selectOption(answer.flagship);
  for(let i=0;i<answer.forces.length;i++){
   const f=answer.forces[i];await button('+ Add Force').click();
   await r.getByLabel(`Force ${i+1} mission`,{exact:true}).selectOption(f.mission);
   await r.getByLabel(`Force ${i+1} zone`,{exact:true}).selectOption(f.zone);
   for(const id of f.ships)await r.locator(`#asg-${i}-${id}`).click();
   if(f.mission==='ArmySupport'){
    await r.getByLabel(`Force ${i+1} Troops`,{exact:true}).fill(String(f.troops));
    await r.getByLabel(`Force ${i+1} Troops`,{exact:true}).press('Tab');
   }
  }
  await button('Confirm assignments').click();
 }else throw Error('Unhandled prompt '+p.kind);
 assert.equal(await pg.evaluate('UI.err'),'');
};
