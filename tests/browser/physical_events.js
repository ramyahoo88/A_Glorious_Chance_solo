// Unmodified shipped HTML: real physical-card entry and its DOM handlers.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const dir=path.join(root,'audits/2026-11-19-v0.2.14-reaudit/evidence'),key='agc_solo_companion_v1';
const base=JSON.parse(fs.readFileSync(path.join(dir,'intermediate-omitted-before.json'))).state;
const answer=JSON.parse(fs.readFileSync(path.join(dir,'map-audit.json'))).examples['intermediate-omitted'].answer;
let assertions=0;const errors=[];const check=(a,b,msg)=>{assert.deepEqual(a,b,msg);assertions++;};
async function page(saved){
 const dom=new JSDOM(html,{url:'https://event-entry.invalid/',runScripts:'dangerously',virtualConsole:new VirtualConsole().on('jsdomError',e=>errors.push(e.message)),beforeParse(w){if(saved)w.localStorage.setItem(key,saved);}});
 const w=dom.window,d=w.document;await new Promise(r=>w.addEventListener('load',r));
 const x=c=>w.eval(c),state=()=>JSON.parse(x('JSON.stringify(G_STATE)'));
 const click=(name,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===name);assert(b&&!b.disabled,name);b.click();};
 const load=s=>{click(state()?'Load':'Load game');d.querySelector('#modal textarea').value=JSON.stringify({state:s,undo:[]});click('Load pasted text');};
 const type=value=>{const inp=d.querySelector('#event-card-number');assert(inp);inp.value=value;inp.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const snap=()=>x('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
 return {dom,w,d,x,state,click,load,type,snap};
}
(async()=>{
 const p=await page();check(p.d.body.textContent.includes('physical Event deck is required'),true,'setup names the physical requirement');p.click('Start campaign');check(p.state().options.physicalEvents,true,'new campaigns require physical cards');
 const s=JSON.parse(JSON.stringify(base));s.deck.event=[30,1,2];p.load(s);
 check(p.state().options.physicalEvents,true,'old saves switch to physical draws');p.x('doAct('+JSON.stringify(answer)+')');
 check(p.state().prompt.kind,'event','game stops at first needed draw');check(p.d.querySelectorAll('#event-card-number').length,1,'single numeric input');
 check(p.d.querySelector('.event-entry label').htmlFor,'event-card-number','input has an accessible label');check(p.d.querySelector('.event-entry button').disabled,true,'blank cannot advance');
 const unchanged=p.x('saveText()');
 for(const value of ['0','39','1.5']){p.type(value);check(p.d.querySelector('.event-entry button').disabled,true,'invalid entry '+value);p.d.querySelector('form.event-entry').dispatchEvent(new p.w.Event('submit',{cancelable:true}));check(p.x('saveText()'),unchanged,'invalid form submission changes no state');}
 p.type('30');check(p.d.querySelector('.event-entry button').disabled,false,'Gale can be entered');p.click('Use Event card');
 check(p.state().prompt.kind,'event','illegal Gale requires a second physical draw');check(p.state().prompt.text.includes('Discard Event #30'),true,'redraw tells player to discard Gale');check(p.d.querySelector('#event-card-number').value,'','Gale number does not carry into next input');
 check(p.state().deck.event.includes(30),false,'Gale leaves the pile');p.type('30');check(p.d.querySelector('.event-entry button').disabled,true,'same Gale cannot be entered twice');
 const pending=p.state(),disk=p.w.localStorage.getItem(key),r=await page(disk);r.click('Continue it');check(r.state(),pending,'reload keeps pending redraw and procedure stack');r.w.close();
 p.type('1');const before=p.state();p.click('Use Event card');const after=p.state();check(after.eventsDrawn.at(-1).id,1,'entered number determines the actual card');
 p.click('↶ Undo');const restored=p.state();delete restored.eventRestore;check(restored,before,'Undo restores exact gameplay before entry');check(p.d.querySelector('#proc').textContent.includes('Return the Event card'),true,'Undo explains physical pile repair');
 p.type('1');p.click('Use Event card');check(p.state(),after,'re-entry resumes identically, including dice');
 // Inspecting the map while a number is typed must preserve the unfinished entry.
 p.load(pending);p.type('2');const stable=p.snap();p.click('Map');p.click('Close');check(p.snap(),stable,'map inspection preserves pending draft, RNG, Undo and disk');
 p.click('Settings');check([...p.d.querySelectorAll('#modal input[type=checkbox]')].some(e=>/Event/.test(e.parentElement.textContent)),false,'no automatic Event checkbox');p.click('Close');
  p.click('Adjust');check(p.d.querySelector('#modal').textContent.includes('An Event draw is pending'),true,'pending draw explains correction lock');check(p.d.querySelectorAll('#modal input, #modal select').length,0,'corrections cannot invalidate a suspended draw');p.click('Close');
 // A malformed pending entry is refused before replacing the live campaign.
 const invalid=JSON.parse(JSON.stringify(pending));invalid.prompt.remaining++;
 p.click('Load');const prior=p.x('saveText()');p.d.querySelector('#modal textarea').value=JSON.stringify({state:invalid,undo:[]});p.click('Load pasted text');
 check(p.x('saveText()'),prior,'damaged pending draw cannot replace current game');check(p.d.querySelector('#modal').textContent.includes('pending physical Event draw'),true,'damaged entry has a specific explanation');p.click('Close');
 // Grouping stops too; there is no sole-option auto-answer for physical entry.
 const grouped=JSON.parse(JSON.stringify(base));grouped.options.groupUpdates=true;p.load(grouped);p.x('doAct('+JSON.stringify(answer)+')');check(p.state().prompt.kind,'event','grouped pace still requires a physical card');
 p.w.close();check(errors,[],'no DOM/control errors');console.log(`Physical Event entry: ${assertions} DOM assertions passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
