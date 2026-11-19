const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,dir=path.dirname(out);
const drive=require('./ui-driver'),{policy}=require('../campaign/policy');
const meta=JSON.parse(fs.readFileSync(path.join(dir,'probes.json')));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'))).state;
const state=p=>p.evaluate('JSON.parse(JSON.stringify(G_STATE))');
async function load(p,s){await p.locator('#hdr').getByRole('button',{name:'Load',exact:true}).click();await p.locator('#modal textarea').fill(JSON.stringify({state:s,undo:[]}));await p.getByRole('button',{name:'Load pasted text',exact:true}).click();}
async function use(p,n){await p.getByLabel('Event card number',{exact:true}).fill(String(n));await p.getByRole('button',{name:'Use Event card',exact:true}).click();}
(async()=>{
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const p=await browser.newPage({viewport:{width:390,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
 await p.goto('file://'+path.join(root,'dist/index.html'));await p.getByRole('button',{name:'Start campaign',exact:true}).click();
 const report={browser:await browser.version(),damagedImports:[]};
 for(const name of ['coastal-raidEvent','encounter-reactionEvent','coastal-asBattleEvent']){
  const prior=await state(p);await load(p,read('corrupt-'+name));
  const accepted=await state(p);assert.notDeepEqual(accepted,prior);assert.equal(accepted.prompt.kind,'event');
  await use(p,meta.natural[name].answer);assert.deepEqual(await state(p),accepted,'failed entry is rolled back');
  const error=await p.locator('#proc>.err').textContent();assert(error.includes('Cannot read properties'));
  report.damagedImports.push({name,accepted:true,error,entryRolledBack:true});
  if(name==='coastal-raidEvent')await p.locator('#proc').screenshot({path:path.join(out,'damaged-raid-save.png')});
  await p.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();assert.deepEqual(await state(p),prior,'Undo can return to position before the bad import');
 }
 // Fresh first-entry Undo: the persistent prompt still says to shuffle even
 // though the new banner says to return the entered card to the existing top.
 await load(p,read('turn-B2event'));
 const first=await state(p);assert(first.prompt.text.includes('Shuffle your physical Event deck'));
 await use(p,meta.natural['turn-B2event'].answer);await p.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();
 const text=await p.locator('#proc').textContent();assert(text.includes('Return the Event card'));assert(text.includes('Shuffle your physical Event deck'));
 await p.locator('#proc').screenshot({path:path.join(out,'undo-first-entry.png')});
 const restored=await state(p);await p.reload();await p.getByRole('button',{name:'Continue it',exact:true}).click();assert.deepEqual(await state(p),restored);
 const reloadedText=await p.locator('#proc').textContent();assert(!reloadedText.includes('Return the Event card'));
 report.firstEntryUndo={returnToTopReminder:true,alsoSaysShuffle:true,reminderSurvivesReload:false,gameStateSurvivesReload:true};
 // Real campaign Intelligence consumption: visible log and accepted cards disagree.
 await load(p,read('intelligence-return-before'));
 await p.locator('#proc').getByRole('button',{name:'Continue',exact:true}).click();
 const used=await state(p),id=meta.natural['intelligence-return'].card;
 assert(used.log.some(r=>r.text.includes('card returns to the Event deck')));assert(!used.deck.event.includes(id));assert(!Object.values(used.intelligence).some(it=>it?.card===id));
 // The card is also no longer in the held area of the public board recap.
 await p.getByLabel('Search the full game log',{exact:true}).fill('Intelligence');
 assert((await p.locator('#log').textContent()).includes('card returns to the Event deck'));
 let next=await state(p),steps=0;
 while(!next.over&&next.turn===used.turn&&next.prompt.kind!=='event'&&steps++<40){await drive(p,next,policy(next,next.prompt,'coast'));next=await state(p);}
 assert.equal(next.turn,used.turn);assert.equal(next.prompt.kind,'event');
 await p.getByLabel('Event card number',{exact:true}).fill(String(id));
 assert(await p.getByRole('button',{name:'Use Event card',exact:true}).isDisabled());
 const validation=await p.locator('#event-entry-message').textContent();assert(validation.includes('not in the draw pile'));
 await p.locator('#proc').screenshot({path:path.join(out,'intelligence-return-refused.png')});
 report.intelligence={card:id,message:meta.natural['intelligence-return'].text,inDrawPile:false,held:false,entryError:validation,actualNextDrawRejects:true};
 assert.deepEqual(errors,[]);report.unhandledPageErrors=errors;
 fs.writeFileSync(path.join(out,'findings.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
