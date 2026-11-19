// Original audit fixtures, exercised through visible controls in Chromium.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,source=path.join(root,'audits/2026-11-19-v0.2.14-reaudit/evidence'),drive=require('./ui-driver');
const state=pg=>pg.evaluate('JSON.parse(JSON.stringify(G_STATE))');
async function load(pg,file){
 await pg.locator('#hdr').getByRole('button',{name:/^Load( game)?$/}).click();await pg.locator('#modal textarea').fill(fs.readFileSync(file,'utf8'));
 await pg.getByRole('button',{name:'Load pasted text',exact:true}).click();assert.equal(await pg.locator('#modal.open').count(),0);
}
const frames=pg=>pg.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
(async()=>{
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const pg=await browser.newPage({viewport:{width:390,height:900}}),errors=[];pg.on('pageerror',e=>errors.push(e.message));pg.setDefaultTimeout(10000);
 const url=process.env.AGC_URL||'file://'+path.join(root,'dist/index.html');await pg.goto(url);await pg.locator('.setup input[type=number]').fill('973000');await pg.getByRole('button',{name:'Start campaign',exact:true}).click();
 const initial=await state(pg),ports=[];
 for(const sd of ['US','BR']){
  await pg.locator('#board [data-place="HOME_'+sd+'"]').click();const n=Object.values(initial.ships).filter(sh=>sh.owner===sd&&['deployable','makeReady','repairing','construction','ordinary','transit'].includes(sh.box)).length;
  assert.equal(await pg.locator('#modal .ship').count(),n);ports.push({side:sd,ships:n});
  await pg.locator('#modal .ship').first().click();await pg.getByRole('button',{name:'Back to port',exact:true}).click();assert.equal(await pg.locator('#modal .ship').count(),n);
  if(sd==='US')await pg.locator('#modal .inner').screenshot({path:path.join(out,'port-fixed-390.png')});
  await pg.getByRole('button',{name:'Back to map',exact:true}).click();
 }
 assert.deepEqual(await state(pg),initial);
 await load(pg,path.join(source,'crowded.json'));const snapshot=await pg.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
 await pg.locator('#hdr').getByRole('button',{name:'Map',exact:true}).click();
 await pg.locator('#modal .inner').evaluate(e=>e.scrollTop=100);
 const mapScroll=await pg.locator('#modal .inner').evaluate(e=>e.scrollTop);
 const fleet=pg.locator('#modal [data-place="YOR"] .map-fleet').first();await fleet.click();
 const ship=pg.locator('#modal .ship').last();await ship.click();
 await pg.getByRole('button',{name:'Back to fleet',exact:true}).click();
 assert(await pg.evaluate('document.activeElement.classList.contains("ship")'));
 await pg.getByRole('button',{name:'Back to map',exact:true}).click();
 assert(await pg.evaluate('document.activeElement.classList.contains("map-fleet")'));
 assert.equal(await pg.locator('#modal .inner').evaluate(e=>e.scrollTop),mapScroll);
 await pg.keyboard.press('Tab');assert(await pg.evaluate('!!document.activeElement.closest("#modal")'));
 await pg.keyboard.press('Escape');assert.equal(await pg.locator('#modal.open').count(),0);
 assert.equal(await pg.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})'),snapshot);
 // A closed inspector must not invent Back links on a new root ship dialog.
 await pg.locator('#board .ports .ship').first().click();assert.equal(await pg.getByRole('button',{name:/^Back to (fleet|port)$/}).count(),0);await pg.keyboard.press('Escape');
 await load(pg,path.join(source,'intermediate-omitted-before.json'));const before=await state(pg),meta=JSON.parse(fs.readFileSync(path.join(source,'map-audit.json'))).examples['intermediate-omitted'];
 await drive(pg,before,meta.answer);const after=await state(pg),moves=after.tableReport.map.moves.filter(m=>m.ships.includes('oneida'));
 assert.deepEqual(moves.map(m=>[m.from.place,m.to.place,m.mission]),[['HOME_US','NIA','ArmySupport'],['NIA','YOR','Patrol']]);
 await pg.locator('#board').getByRole('button',{name:'Show last action',exact:true}).click();
 await pg.locator('#modal .map-action-summary').screenshot({path:path.join(out,'ordered-oneida-moves.png')});await pg.keyboard.press('Escape');
 await pg.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();assert.deepEqual(await state(pg),before);await drive(pg,before,meta.answer);assert.deepEqual(await state(pg),after);
 await pg.reload();await pg.getByRole('button',{name:'Continue it',exact:true}).click();assert.deepEqual(await state(pg),after);
 // Test the original desktop overflow and a zoom-like larger font.
 const widths=[];
 for(const width of [1001,1024,1100,1150,1280]){
  await pg.setViewportSize({width,height:900});await frames(pg);
  const result=await pg.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tracks:[...document.querySelectorAll('.trk')].map(e=>e.getBoundingClientRect().right)}));
  assert(result.scroll<=width);assert(result.tracks.every(x=>x<=width));widths.push(result);
 }
 await pg.setViewportSize({width:390,height:900});await pg.evaluate('document.documentElement.style.fontSize="20px"');await frames(pg);
 const fontOverflow=await pg.evaluate('document.documentElement.scrollWidth>innerWidth');assert(!fontOverflow);
 await pg.locator('#hdr').getByRole('button',{name:'Reference',exact:true}).click();
 await pg.locator('#modal label select').selectOption({label:'Offline app'});
 const [file]=await Promise.all([pg.waitForEvent('download'),pg.getByRole('button',{name:'Download app (.html)',exact:true}).click()]);
 const bytes=fs.readFileSync(await file.path()),release=fs.readFileSync(path.join(root,'dist/index.html'));assert(bytes.equals(release));
 const report={url,browser:await browser.version(),ports,backNavigation:{scrollRestored:true,focusRestored:true,escapeWorks:true},orderedMoves:moves,widths,fontOverflow,download:{name:file.suggestedFilename(),bytes:bytes.length,sha256:require('crypto').createHash('sha256').update(bytes).digest('hex')},errors};
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,process.env.AGC_URL?'live-focused.json':'focused.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
