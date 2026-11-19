const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,drive=require('./ui-driver');
const get=pg=>pg.evaluate('JSON.parse(JSON.stringify(G_STATE))');
async function load(pg,state){
 await pg.locator('#hdr').getByRole('button',{name:/^Load( game)?$/}).click();
 await pg.locator('#modal textarea').fill(JSON.stringify({state,undo:[]}));
 await pg.getByRole('button',{name:'Load pasted text',exact:true}).click();
 assert.equal(await pg.locator('#modal.open').count(),0);
}
(async()=>{
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const pg=await browser.newPage({viewport:{width:390,height:1000}}),errors=[];pg.on('pageerror',e=>errors.push(e.message));pg.setDefaultTimeout(10000);
 await pg.goto('file://'+path.join(root,'dist/index.html'));
 await pg.locator('.setup input[type=number]').fill('973000');await pg.getByRole('button',{name:'Start campaign',exact:true}).click();
 const s=await get(pg),original=JSON.stringify(s),ports=[];
 for(const side of ['US','BR']){
  const b=pg.locator(`#board [data-place="HOME_${side}"]`);const countText=await b.textContent();await b.click();
  ports.push({side,countText,shipButtons:await pg.locator('#modal .ship').count(),dialog:await pg.locator('#modal').textContent()});
  if(side==='US')await pg.locator('#modal .inner').screenshot({path:path.join(out,'empty-port-390.png')});
  await pg.getByRole('button',{name:'Close',exact:true}).click();assert.equal(JSON.stringify(await get(pg)),original);
 }
 assert(ports.every(p=>p.shipButtons===0),'Reproduces A01 missing ships');
 const base=JSON.parse(fs.readFileSync(path.join(out,'..','intermediate-omitted-before.json'))).state;
 const meta=JSON.parse(fs.readFileSync(path.join(out,'..','map-audit.json'))).examples['intermediate-omitted'];
 await load(pg,base);await drive(pg,base,meta.answer);const after=await get(pg);
 const expected=JSON.parse(fs.readFileSync(path.join(out,'..','intermediate-omitted-after.json'))).state;assert.deepEqual(after,expected);
 const oneida=after.tableReport.map.moves.filter(m=>m.ships.includes('oneida'));
 assert(oneida.some(m=>m.from.place==='HOME_US'&&m.to.place==='YOR'));
 assert(!oneida.some(m=>m.from.place==='NIA'));
 await pg.locator('#board').getByRole('button',{name:'Show last action',exact:true}).click();
 const summary=await pg.locator('#modal .map-action-summary').textContent();
 await pg.locator('#modal .map-action-summary').screenshot({path:path.join(out,'missing-intermediate-move.png')});
 await pg.getByRole('button',{name:'Close',exact:true}).click();
 // Optional usability observation: inspecting a fleet/ship replaces the parent dialog.
 await pg.locator('#hdr').getByRole('button',{name:'Map',exact:true}).click();
 await pg.locator('#modal .map-fleet').first().click();
 const zoneTitle=await pg.locator('#modal h2').textContent();await pg.locator('#modal .ship').first().click();
 await pg.getByRole('button',{name:'Close',exact:true}).click();
 const closedToBoard=await pg.locator('#modal.open').count()===0;
 assert.deepEqual(await get(pg),after);
 // Rendering variants must not expose a different deck order or face-down marker.
 const privacy=await pg.evaluate(`(() => {
  const s=JSON.parse(JSON.stringify(G_STATE));
  const before=campaignMap(s,'privacy').outerHTML;
  s.aiTroops.track.forEach(m=>m.troops=!m.troops);s.aiTroops.box.filter(m=>!m.revealed).forEach(m=>m.troops=!m.troops);
  Object.values(s.convoys[s.ai]).filter(c=>!c.revealed).forEach(c=>c.real=!c.real);
  Object.values(s.deck).forEach(p=>p.reverse());
  s.targetRow.filter(c=>!c.revealed).forEach(c=>c.id='UNKNOWN_HIDDEN_CARD');
  return campaignMap(s,'privacy').outerHTML===before;
 })()`);assert(privacy);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'findings.json'),JSON.stringify({browser:await browser.version(),ports,omitted:{metadata:meta,oneida,summary,log:after.log.slice(-12)},q01:{zoneTitle,closedToBoard},privacy,errors},null,2));
 console.log(JSON.stringify({ports,omissionReproducedThroughControls:true,privacy,closedToBoard,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
