const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium:pw}=require('playwright'),chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname,dir=path.dirname(out),drive=require('./ui-driver');
const audit=path.join(root,'audits/2026-11-19-v0.2.16-reaudit/evidence'),{policy}=require('../campaign/policy');
const read=(name,source=audit)=>JSON.parse(fs.readFileSync(path.join(source,name+'.json'))).state;
const state=p=>p.evaluate('JSON.parse(JSON.stringify(G_STATE))'),plain=s=>JSON.parse(JSON.stringify(s));
const game=s=>{const x=plain(s);delete x.eventRestore;return x;};
async function load(p,s){await p.locator('#hdr').getByRole('button',{name:'Load',exact:true}).click();await p.locator('#modal textarea').fill(JSON.stringify({state:s,undo:[]}));await p.getByRole('button',{name:'Load pasted text',exact:true}).click();}
async function use(p,n){await p.getByLabel('Event card number',{exact:true}).fill(String(n));await p.getByRole('button',{name:'Use Event card',exact:true}).click();}
const undo=p=>p.locator('#hdr').getByRole('button',{name:'↶ Undo',exact:true}).click();
(async()=>{
 const live=!!process.env.AGC_URL,browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,...(live&&process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
 const p=await browser.newPage({viewport:{width:390,height:1000},ignoreHTTPSErrors:live}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
 const url=process.env.AGC_URL||'file://'+path.join(root,'dist/index.html');await p.goto(url);await p.getByRole('button',{name:'Start campaign',exact:true}).click();
 const report={url,browser:await browser.version(),damagedImports:[],undoCases:[],widths:[]};
 await load(p,read('turn-B2event'));await p.getByLabel('Event card number',{exact:true}).fill('3');
 for(const name of ['corrupt-coastal-raidEvent','corrupt-encounter-reactionEvent','corrupt-coastal-asBattleEvent']){
  const before=await p.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
  await load(p,read(name));assert((await p.locator('#modal .err').textContent()).includes('pending Event'));
  assert.equal(await p.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})'),before);
  report.damagedImports.push({name,refusedAtomically:true});await p.keyboard.press('Escape');
 }
 const first=read('turn-B2event'),ordinary=read('coastal-raidEvent'),gale=plain(first),empty=plain(first),boundary=read('turn-reset-before',dir);
 gale.deck.event=[30,3,4];gale.prompt.remaining=3;empty.deck.event=[30];empty.prompt.remaining=1;empty.eventCardsPrepared=true;
 const resetAnswer=JSON.parse(fs.readFileSync(path.join(dir,'turn-reset-meta.json'))).answer;
 for(const [name,fixture,answer,reshuffled] of [['first',first,3,false],['ordinary',ordinary,27,false],['Gale',gale,30,false],['exhaustion',empty,30,true],['turn reset',boundary,resetAnswer,true]]){
  await load(p,fixture);const before=await state(p);await use(p,answer);const after=await state(p);await undo(p);const restored=await state(p);
  assert.deepEqual(game(restored),before);assert.deepEqual(restored.eventRestore,{cards:[answer],reshuffled});
  const text=await p.locator('#proc>.banner').textContent();assert(text.includes('#'+answer));assert(!(await p.locator('#proc>.ptext').textContent()).includes('Shuffle your physical Event deck'));
  if(name==='first')await p.locator('#proc').screenshot({path:path.join(out,live?'live-undo.png':'undo-first-entry.png')});
  await p.reload();await p.getByRole('button',{name:'Continue it',exact:true}).click();assert.deepEqual(await state(p),restored);assert.equal(await p.locator('#proc>.banner').textContent(),text);
  await p.locator('#hdr').getByRole('button',{name:'Save',exact:true}).click();const exported=await p.locator('#modal textarea').inputValue();await p.keyboard.press('Escape');
  await load(p,JSON.parse(exported).state);assert.deepEqual(await state(p),restored);
  await use(p,answer);assert.deepEqual(await state(p),after);report.undoCases.push({name,reloadAndTransfer:true,exactReplay:true,reshuffled});
 }
 await load(p,gale);await use(p,30);await use(p,3);await undo(p);await undo(p);assert.deepEqual((await state(p)).eventRestore.cards,[30,3]);report.consecutiveUndos=true;
 await load(p,ordinary);await p.getByLabel('Event card number',{exact:true}).fill('27');
 const snap=await p.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
 await p.getByRole('button',{name:'Deck status',exact:true}).click();const numbers=await p.locator('#modal .event-deck-numbers').first().textContent();assert.equal(numbers,ordinary.deck.event.slice().sort((a,b)=>a-b).join(', '));
 await p.locator('#modal .inner').screenshot({path:path.join(out,live?'live-deck-status.png':'deck-status-390.png')});
 for(const width of [320,390,1024,1440]){await p.setViewportSize({width,height:1000});const overflow=await p.evaluate('document.documentElement.scrollWidth>innerWidth');assert(!overflow);report.widths.push({width,overflow});}
 await p.keyboard.press('Escape');assert.equal(await p.getByLabel('Event card number',{exact:true}).inputValue(),'27');assert(await p.getByRole('button',{name:'Deck status',exact:true}).evaluate(b=>b===document.activeElement));
 assert.equal(await p.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})'),snap);report.deckStatus={sorted:true,readOnly:true,draftAndFocusRetained:true};
 await load(p,read('intelligence-return-before'));await p.locator('#proc').getByRole('button',{name:'Continue',exact:true}).click();let s=await state(p);assert(s.log.at(-1).text.includes('place the card with the used Event cards'));
 const turn=s.turn;while(s.prompt.kind!=='event'&&!s.over&&s.turn===turn){await drive(p,s,policy(s,s.prompt,'coast'));s=await state(p);}
 assert.equal(s.prompt.kind,'event');await p.getByLabel('Event card number',{exact:true}).fill('29');assert(await p.getByRole('button',{name:'Use Event card',exact:true}).isDisabled());report.intelligenceDisposition=true;
 await p.locator('#hdr').getByRole('button',{name:'Reference',exact:true}).click();await p.locator('#modal label select').selectOption({label:'Offline app'});
 const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Download app (.html)',exact:true}).click()]);const bytes=fs.readFileSync(await download.path());assert(bytes.equals(fs.readFileSync(path.join(root,'dist/index.html'))));report.download={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(path.join(out,live?'live-focused.json':'focused.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
