// Production HTML, original audit positions, and actual DOM event handlers.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'audits/2026-11-19-v0.2.16-reaudit/evidence');
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),key='agc_solo_companion_v1';
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'))).state;
const plain=s=>JSON.parse(JSON.stringify(s)),game=s=>{const x=plain(s);delete x.eventRestore;return x;};
let checks=0;const errors=[],check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
async function page(saved){
 const dom=new JSDOM(html,{url:'https://agc-v0217.invalid/',runScripts:'dangerously',virtualConsole:new VirtualConsole().on('jsdomError',e=>errors.push(e.message)),beforeParse(w){if(saved)w.localStorage.setItem(key,saved);}});
 const w=dom.window,d=w.document;await new Promise(r=>w.addEventListener('load',r));
 const x=c=>w.eval(c),state=()=>JSON.parse(x('JSON.stringify(G_STATE)'));
 const click=(name,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===name);assert(b&&!b.disabled,name);b.focus();b.click();return b;};
 const load=s=>{click(state()?'Load':'Load game');d.querySelector('#modal textarea').value=JSON.stringify({state:s,undo:[]});click('Load pasted text');};
 const type=n=>{const i=d.querySelector('#event-card-number');i.value=String(n);i.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const use=n=>{type(n);click('Use Event card');};
 const snap=()=>x('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
 return {w,d,x,state,click,load,type,use,snap};
}
(async()=>{
 const p=await page();p.click('Start campaign');p.load(read('turn-B2event'));p.type(3);
 for(const name of ['corrupt-coastal-raidEvent','corrupt-encounter-reactionEvent','corrupt-coastal-asBattleEvent']){
  const stable=p.snap();p.load(read(name));check(p.snap(),stable,name+' refuses atomically, including draft and autosave');
  check(p.d.querySelector('#modal .err').textContent.includes('pending Event'),true,'specific damaged-caller explanation');p.click('Close');
 }
 const meta=JSON.parse(fs.readFileSync(path.join(dir,'probes.json')));
 for(const name of ['turn-B2event','encounter-eventEntered','encounter-reactionEvent','combat-wgEvent','coastal-raidEvent','coastal-asBattleEvent']){
  p.load(read(name));p.use(meta.natural[name].answer);check(p.d.querySelector('#proc>.err').textContent,'',name+' valid save resumes');
 }
 // First entry, ordinary entry, Gale redraw, exhaustion and a new-turn pile.
 const first=read('turn-B2event'),ordinary=read('coastal-raidEvent'),gale=plain(first),empty=plain(first),nextTurn=plain(first);
 gale.deck.event=[30,3,4];gale.prompt.remaining=3;empty.deck.event=[30];empty.prompt.remaining=1;empty.eventCardsPrepared=true;
 nextTurn.turn=1;nextTurn.eventCardsPrepared=false;
 for(const [label,fixture,id,prep] of [['first',first,3,false],['ordinary',ordinary,27,false],['Gale',gale,30,true],['exhaustion',empty,30,true],['new turn',nextTurn,3,false]]){
  p.load(fixture);const before=p.state();p.use(id);const after=p.state();p.click('↶ Undo');const restored=p.state();
  check(game(restored),game(before),label+' Undo preserves all gameplay, log and dice');check(restored.eventRestore.cards,[id],label+' names exact returned card');
  check(p.d.querySelector('#proc .ptext').textContent.includes('Shuffle your physical Event deck'),false,label+' no repeated preparation');
  check(p.d.querySelector('#proc .ptext').textContent.includes('Prepare and shuffle'),false,label+' no conflicting partial-pile preparation');
  check(restored.eventRestore.reshuffled,label==='exhaustion',label+' identifies exhaustion boundary');
  const text=p.d.querySelector('#proc>.banner').textContent;check(text.includes('#'+id),true,label+' physical instruction contains card number');
  const disk=p.w.localStorage.getItem(key),r=await page(disk);r.click('Continue it');
  check(r.state(),restored,label+' reload preserves restoration metadata');check(r.d.querySelector('#proc>.banner').textContent,text,label+' reload preserves physical instructions');r.w.close();
  const exported=JSON.parse(p.x('saveText()'));p.load(exported.state);check(p.state(),restored,label+' exported restoration reloads');
  p.use(id);check(p.state(),after,label+' replay matches original continuation exactly');check('eventRestore' in p.state(),false,label+' replay clears restoration note');
 }
 // Undoing the redraw first, then Gale, tells the player the complete top order.
 p.load(gale);p.use(30);p.use(3);p.click('↶ Undo');p.click('↶ Undo');check(p.state().eventRestore.cards,[30,3],'consecutive Undos restore top-first order');
 check(p.d.querySelector('#proc>.banner').textContent.includes('#30, #3'),true,'ordered restoration is visible');
 // Deck inspection preserves state, typed number, Undo, RNG and autosave. Future
 // internal order and hidden Target/Convoy information must not enter its HTML.
 p.load(ordinary);p.type(27);const stable=p.snap();const trigger=p.click('Deck status');const content=p.d.querySelector('#modal .event-deck-status').innerHTML;
 const s=p.state(),held=Object.values(s.intelligence).filter(Boolean).map(it=>it.card);
 const sections=[...p.d.querySelectorAll('#modal h3')].map(h=>[h.textContent,h.nextElementSibling.textContent]);
 check(sections[0][1],s.deck.event.slice().sort((a,b)=>a-b).join(', '),'remaining numbers sorted');
 const used=Array.from({length:38},(_,i)=>i+1).filter(id=>!s.deck.event.includes(id)&&!held.includes(id));
 check(sections[1][1],used.length?used.join(', '):'None.','used cards agree with membership');check(sections.at(-1)[1].includes('entered for'),true,'last entered card has purpose');
 p.click('Close');check(p.d.activeElement,trigger,'deck dialog returns keyboard focus');check(p.snap(),stable,'inspection changes no campaign, draft, dice, history or disk');
 const reordered=plain(s);reordered.deck.event.reverse();reordered.deck.target.reverse();reordered.aiTroops.box.reverse();p.load(reordered);p.click('Deck status');
 check(p.d.querySelector('#modal .event-deck-status').innerHTML,content,'deck display cannot expose shuffled order or hidden data');p.click('Close');
 // Both Intelligence cards are publicly set aside, with a count and owner.
 const intel=plain(first);intel.intelligence={US:{card:29,until:1},BR:{card:31,until:1}};intel.deck.event=intel.deck.event.filter(id=>![29,31].includes(id));intel.prompt.remaining=intel.deck.event.length;
 p.load(intel);p.click('Deck status');const headings=[...p.d.querySelectorAll('#modal h3')];const h=headings.find(h=>h.textContent==='Held for Intelligence (2)');
 check(!!h,true,'held count shown');check(h.nextElementSibling.textContent.includes('#29 – American'),true,'American Intelligence shown');check(h.nextElementSibling.textContent.includes('#31 – British'),true,'British Intelligence shown');p.click('Close');
 // Original Intelligence use gives the new disposition and preserves the pile.
 p.load(read('intelligence-return-before'));const pile=p.state().deck.event;p.click('Continue',p.d.querySelector('#proc'));
 check(p.state().deck.event,pile,'consumed Intelligence does not re-enter current pile');check(p.state().log.at(-1).text.includes('next Event-deck reshuffle'),true,'correct return timing in real log');
 p.w.close();check(errors,[],'no DOM/control errors');console.log(`v0.2.17 recovery and deck status: ${checks} DOM assertions passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
