const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,{policy}=require('../campaign/policy'),drive=require('./ui-driver');
const {ctx,x}=require('../campaign/load')(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/ui_table.js'),'utf8'),ctx);
const advance=x('playTableAction');
(async()=>{
 const report={games:[]};
 for(const [side,seed,style,width,group] of [['US',973001,'fleet',1440,false],['BR',973002,'coast',390,true]]){
  if(process.env.AGC_SEATS && !process.env.AGC_SEATS.split(',').includes(side)){
   const {trace,...previous}=JSON.parse(fs.readFileSync(path.join(out,'campaign-'+side+'.json')));report.games.push(previous);continue;
  }
  const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});report.browser=await browser.version();
  const context=await browser.newContext({viewport:{width,height:1000}}),pg=await context.newPage(),errors=[];
  pg.on('pageerror',e=>errors.push(e.message));pg.setDefaultTimeout(10000);
  await pg.goto('file://'+path.join(root,'dist/index.html'));
  if(side==='BR')await pg.getByRole('button',{name:/^British Solo Campaign/}).click();
  await pg.locator('.setup input[type=number]').fill(String(seed));
  if(group)await pg.getByRole('checkbox',{name:/Group routine updates/}).check();
  await pg.getByRole('button',{name:'Start campaign',exact:true}).click();
  let s=await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),reference=JSON.parse(JSON.stringify(s)),n=0,roundTrips=0,undos=0,inspections=0;
  const trace=[];
  while(!s.over){
   assert(n<1500);const answer=policy(s,s.prompt,style),title=s.prompt.title,kind=s.prompt.kind,before=JSON.stringify(s);
   await drive(pg,s,answer);advance(reference,answer);n++;
   s=await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))');assert.deepEqual(s,JSON.parse(JSON.stringify(reference)),'Actual browser controls must match entire reference state');
   trace.push({n,title,kind,answer,moveGroups:s.tableReport.map.moves.length});
   if(n%19===0){
    const snap=await pg.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
    await pg.locator('#hdr').getByRole('button',{name:'Map',exact:true}).click();
    await pg.keyboard.press('Tab');assert(await pg.evaluate('!!document.activeElement.closest("#modal")'));
    await pg.keyboard.press('Escape');
    assert.equal(await pg.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})'),snap);inspections++;
   }
   if(n%31===0){
    await pg.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();
    assert.deepEqual(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),JSON.parse(before));
    await drive(pg,JSON.parse(before),answer);assert.deepEqual(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),s);undos++;
   }
   if(n%37===0){
    await pg.reload();await pg.getByRole('button',{name:'Continue it',exact:true}).click();
    assert.deepEqual(await pg.evaluate('JSON.parse(JSON.stringify(G_STATE))'),s);roundTrips++;
   }
   if(n%25===0)console.log(side,seed,n,s.prompt?.title);
  }
  assert.deepEqual(errors,[]);assert.equal(s.vpLog.reduce((n,r)=>n+(r.side==='US'?r.n:-r.n),0),s.result.score);
  await pg.locator('#proc').screenshot({path:path.join(out,'complete-'+side+'.png')});
  fs.writeFileSync(path.join(out,'campaign-'+side+'.json'),JSON.stringify({seed,side,style,width,group,steps:n,roundTrips,undos,inspections,result:s.result,errors,trace},null,2));
  fs.writeFileSync(path.join(out,'final-'+side+'.json'),JSON.stringify({state:s,undo:[]}));
  report.games.push({seed,side,style,width,group,steps:n,roundTrips,undos,inspections,result:s.result,errors});await browser.close();
 }
 fs.writeFileSync(path.join(out,'campaigns.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exit(1);});
