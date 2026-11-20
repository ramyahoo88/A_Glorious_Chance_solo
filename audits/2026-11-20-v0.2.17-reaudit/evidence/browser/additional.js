const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,dir=path.dirname(out),drive=require('./ui-driver');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'))),state=p=>p.evaluate('JSON.parse(JSON.stringify(G_STATE))');
async function load(p,s){await p.locator('#hdr').getByRole('button',{name:'Load',exact:true}).click();await p.locator('#modal textarea').fill(JSON.stringify({state:s,undo:[]}));await p.getByRole('button',{name:'Load pasted text',exact:true}).click();}
async function use(p,n){await p.getByLabel('Event card number',{exact:true}).fill(String(n));await p.getByRole('button',{name:'Use Event card',exact:true}).click();}
(async()=>{
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const p=await browser.newPage({viewport:{width:390,height:1000}}),errors=[],consoleErrors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 p.setDefaultTimeout(10000);await p.goto('file://'+path.join(root,'dist/index.html'));
 await p.locator('.setup input[type=number]').fill('986000');await p.getByRole('button',{name:'Start campaign',exact:true}).click();
 const trace=read('multi-undo-play-trace'),expected=read('probes').multiUndo;
 for(const row of trace){let s=await state(p);assert.equal(s.prompt.title,row.title);await drive(p,s,row.answer);}
 let s=await state(p);assert.equal(s.turn,1);assert.equal(s.prompt.kind,'event');assert.equal(s.deck.event.length,38);
 const startText=await p.locator('#proc .ptext').textContent();assert(startText.includes('Shuffle your physical Event deck'));
 const earlier=await p.evaluate('JSON.parse(UNDO[UNDO.length-10])');
 const steps=[];
 for(let i=0;i<expected.undos;i++){
  await p.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();s=await state(p);steps.push({turn:s.turn,kind:s.prompt.kind,title:s.prompt.title,note:s.eventRestore||null});
 }
 const actual=JSON.parse(JSON.stringify(s));delete actual.eventRestore;assert.deepEqual(actual,earlier,'all original gameplay, cards, RNG, log and map match the earlier checkpoint');
 assert.equal(s.turn,0);assert.equal(s.deck.event.length,34);assert.deepEqual(s.eventRestore,{cards:[2],reshuffled:false});
 const undoText=await p.locator('#proc>.banner').textContent();assert(undoText.includes('Do not shuffle'));assert(!undoText.includes('Deck status'));
 await p.locator('#proc').screenshot({path:path.join(out,'multi-undo-lost-boundary.png')});
 await p.getByRole('button',{name:'Deck status',exact:true}).click();const remainingHeading=await p.locator('#modal h3').first().textContent();assert.equal(remainingHeading,'Remaining in draw pile (34)');await p.keyboard.press('Escape');
 await p.reload();await p.getByRole('button',{name:'Continue it',exact:true}).click();assert.equal(await p.locator('#proc>.banner').textContent(),undoText);
 const report={browser:await browser.version(),multiUndo:{seed:986000,naturalActions:trace.length,startText,undos:steps,undoText,remainingHeading,exactGameplayRestoration:true,reloadPreservesIncorrectNote:true},damagedSave:{}};
 const fixture=read('coastal-asBattleEvent-missing-order').state;
 const before=await p.evaluate('saveText()');await load(p,fixture);assert.equal(await p.locator('#modal.open').count(),0);assert.notEqual(await p.evaluate('saveText()'),before);
 await use(p,23);assert.equal((await state(p)).prompt.title,'Land Battle result');const checkpoint=await p.evaluate('saveText()');
 await p.locator('#proc').getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await p.evaluate('saveText()'),checkpoint,'failed continuation rolls back attempted action');
 const message=await p.locator('#app .err').first().textContent();assert(message.includes("Cannot read properties of undefined (reading '2')"));
 await p.locator('#proc').screenshot({path:path.join(out,'damaged-coastal-continuation.png')});
 report.damagedSave={fixture:'coastal-asBattleEvent-missing-order.json',accepted:true,event23Resolved:true,continuationError:message,rolledBackFailedAction:true};
 assert.deepEqual(errors,[]);report.pageErrors=errors;report.expectedConsoleErrors=consoleErrors;
 fs.writeFileSync(path.join(out,'additional.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
