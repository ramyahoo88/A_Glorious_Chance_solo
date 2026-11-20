const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,drive=require('./ui-driver');
const {policy}=require(path.join(root,'audits/2026-11-19-v0.2.16-reaudit/evidence/campaign/policy'));
const {ctx,x}=require(path.join(root,'audits/2026-11-19-v0.2.13/evidence/campaign/load'))(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8'),ctx);
const advance=x('playTableAction');
// Independent shuffle for the physical test deck. The human policy never sees
// this order; available IDs are only used to prepare/reset the paper pile.
const paperDeck=require('../campaign/paper-deck');
(async()=>{
 const report={games:[]};
 for(const [side,seed,style,width,group] of [['US',985001,'fleet',1440,false],['BR',985002,'coast',390,true]]){
  const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true}),context=await browser.newContext({viewport:{width,height:1000}}),pg=await context.newPage(),errors=[];
  report.browser=await browser.version();pg.on('pageerror',e=>errors.push(e.message));pg.setDefaultTimeout(10000);
  await pg.goto('file://'+path.join(root,'dist/index.html'));
  if(side==='BR')await pg.getByRole('button',{name:/^British Solo Campaign/}).click();
  await pg.locator('.setup input[type=number]').fill(String(seed));if(group)await pg.getByRole('checkbox',{name:/Group routine updates/}).check();
  await pg.getByRole('button',{name:'Start campaign',exact:true}).click();
  let s=await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),reference=JSON.parse(JSON.stringify(s)),n=0,entries=0,reloads=0,undos=0,inspections=0;
  const gameplay=s=>{const x=JSON.parse(JSON.stringify(s));delete x.eventRestore;return x;};
  const draw=paperDeck(seed^0x19a52),trace=[];assert(s.options.physicalEvents);
  while(!s.over){
   assert(n<1800);const p=s.prompt,answer=p.kind==='event'?draw(s):policy(s,p,style),before=JSON.stringify(s);
   if(p.kind==='event'){
    assert.equal(await pg.locator('#event-card-number').count(),1);assert(await pg.getByRole('button',{name:'Use Event card',exact:true}).isDisabled());
    if(entries%7===0){
     const unchanged=await pg.evaluate('saveText()');await pg.getByLabel('Event card number',{exact:true}).fill('39');assert(await pg.getByRole('button',{name:'Use Event card',exact:true}).isDisabled());assert.equal(await pg.evaluate('saveText()'),unchanged);
     await pg.reload();await pg.getByRole('button',{name:'Continue it',exact:true}).click();assert.deepEqual(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),s);reloads++;
    }
    if(entries%9===0){
     const snap=await pg.evaluate('saveText()');await pg.getByRole('button',{name:'Deck status',exact:true}).click();await pg.keyboard.press('Escape');assert.equal(await pg.evaluate('saveText()'),snap);await pg.locator('#hdr').getByRole('button',{name:'Map',exact:true}).click();await pg.keyboard.press('Escape');assert.equal(await pg.evaluate('saveText()'),snap);inspections++;
    }
    entries++;
   }
   await drive(pg,s,answer);advance(reference,answer);n++;s=await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))');assert.deepEqual(s,JSON.parse(JSON.stringify(reference)),'every real control matches native reference');
   if(p.kind==='event'&&entries%8===0){
    await pg.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();assert.deepEqual(gameplay(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))')),JSON.parse(before));assert((await pg.locator('#proc').textContent()).includes('Return the Event card'));
    await drive(pg,JSON.parse(before),answer);assert.deepEqual(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),s);undos++;
   }
   trace.push({n,kind:p.kind,title:p.title,purpose:p.purpose,answer});if(n%40===0)console.log(side,n,'entries',entries,s.prompt?.title);
  }
  assert.deepEqual(errors,[]);assert.equal(s.vpLog.reduce((n,r)=>n+(r.side==='US'?r.n:-r.n),0),s.result.score);
  await pg.locator('#proc').screenshot({path:path.join(out,'final-'+side+'.png')});
  const row={side,seed,style,width,group,actions:n,entries,reloads,undos,inspections,result:s.result,errors};report.games.push(row);
  fs.writeFileSync(path.join(out,'campaign-'+side+'.json'),JSON.stringify({...row,trace},null,2));fs.writeFileSync(path.join(out,'final-'+side+'.json'),JSON.stringify({state:s,undo:[]}));await browser.close();
 }
 fs.writeFileSync(path.join(out,'campaigns.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exit(1);});
