const legacyEventFixture = require('./legacy_events');
// Replays the original audit positions using the shipped controls. Real CSS
// geometry, browser focus and viewport resizing are checked by the browser run.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..'),html=legacyEventFixture(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'));
const fixtures=path.join(root,'audits/2026-11-19-v0.2.14-reaudit/evidence'),key='agc_solo_companion_v1';
const fixture=n=>JSON.parse(fs.readFileSync(path.join(fixtures,n+'.json'))).state;
let passed=0;const errors=[];
const check=(label,actual,want)=>{assert.deepEqual(actual,want,label);passed++;};
async function page(saved){
 const dom=new JSDOM(html,{url:'https://agc-0215.invalid/',runScripts:'dangerously',virtualConsole:new VirtualConsole().on('jsdomError',e=>errors.push(e.message)),beforeParse(w){if(saved)w.localStorage.setItem(key,saved);}});
 const w=dom.window,d=w.document;await new Promise(r=>w.addEventListener('load',r));
 const x=c=>w.eval(c),state=()=>JSON.parse(x('JSON.stringify(G_STATE)'));
 const click=(name,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===name);assert(b&&!b.disabled,name);b.focus();b.click();return b;};
 const load=s=>{click(state()?'Load':'Load game');d.querySelector('#modal textarea').value=JSON.stringify({state:s,undo:[]});click('Load pasted text');};
 const snap=()=>x('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
 return {w,d,x,state,click,load,snap};
}
(async()=>{
 {
  const p=await page();p.x('startGame("US",973000,{})');const s=p.state();
  const baseline=p.snap();
  for(const sd of ['US','BR']){
   p.d.querySelector(`#board [data-place="HOME_${sd}"]`).click();
   const expected=Object.values(s.ships).filter(sh=>sh.owner===sd&&['deployable','makeReady','repairing','construction','ordinary','transit'].includes(sh.box)&&sh.port!=='temp').map(sh=>sh.id);
   check(sd+': all occupied-port ships are inspectable',p.d.querySelectorAll('#modal .ship').length,expected.length);
   check(sd+': multiple port boxes retain their contents',p.d.querySelectorAll('#modal h3').length>=2,true);
   const first=p.d.querySelector('#modal .ship');first.focus();first.click();
   check(sd+': ship details have Back to port',!![...p.d.querySelectorAll('#modal button')].find(b=>b.textContent==='Back to port'),true);
   p.click('Back to port');check(sd+': return preserves focused ship',p.d.activeElement===first,true);
   check(sd+': return retains every ship',p.d.querySelectorAll('#modal .ship').length,expected.length);
   p.click('Back to map');check(sd+': board inspector returns to map',p.d.querySelector('#modal').classList.contains('open'),false);
  }
  check('Port inspection preserves position, draft, Undo, dice and autosave',p.snap(),baseline);
  const synthetic=p.state();synthetic.ships.madison.port='temp';synthetic.ships.oneida.box='escortBox';synthetic.ships.scourge.box='coast';synthetic.ships.scourge.zone='SAC';
  p.load(synthetic);
  for(const [place,n] of [['TEMP_US',1],['ESC_US',1]]){
   p.d.querySelector(`#board [data-place="${place}"]`).click();check(place+': ship rendered',p.d.querySelectorAll('#modal .ship').length,n);p.click('Close');
  }
  p.d.querySelector('#board [data-place="SAC"] .map-zone-name').click();
  check('Beached section retains its ship',p.d.querySelectorAll('#modal .ship').length,1);p.click('Close');
  p.load(fixture('crowded'));p.click('Map');const map=p.d.querySelector('#modal .inner');map.scrollTop=89;
  const fleet=p.d.querySelector('#modal .map-fleet');fleet.focus();fleet.click();
  const zone=p.d.querySelector('#modal .inner');zone.scrollTop=25;
  const ship=p.d.querySelector('#modal .ship');ship.focus();ship.click();p.click('Back to fleet');
  check('Back to fleet retains exact DOM and scroll',p.d.querySelector('#modal .inner')===zone&&zone.scrollTop===25,true);
  check('Back to fleet focuses the inspected ship',p.d.activeElement===ship,true);
  p.click('Back to map');check('Back to map restores exact map and scroll',p.d.querySelector('#modal .inner')===map&&map.scrollTop===89,true);
  check('Back to map focuses original fleet',p.d.activeElement===fleet,true);p.click('Close');
  check('Closing discards modal navigation history',p.x('UI.modalStack.length'),0);
  p.w.close();
 }
 {
  const p=await page();p.load(fixture('intermediate-omitted-before'));const before=p.state();
  const answer=JSON.parse(fs.readFileSync(path.join(fixtures,'map-audit.json'))).examples['intermediate-omitted'].answer;
  p.x('doAct('+JSON.stringify(answer)+')');const after=p.state(),old=fixture('intermediate-omitted-after');
  const game=s=>{const {build,tableReport,...g}=s;return g;};
  check('Original natural action preserves complete gameplay, hidden decks, dice and log',game(after),game(old));
  const route=after.tableReport.map.moves.filter(m=>m.ships.includes('oneida'));
  check('Oneida has both real voyages in order',route.map(m=>[m.from.place,m.to.place,m.mission]),[['HOME_US','NIA','ArmySupport'],['NIA','YOR','Patrol']]);
  check('Oneida starts second voyage as Army Support',route[1].from.mission,'ArmySupport');
  const stable=p.snap();p.click('Map');p.click('Close');check('New ordered report is read-only',p.snap(),stable);
  const reload=await page(p.w.localStorage.getItem(key));reload.click('Continue it');check('Reload retains full ordered report',reload.state().tableReport,after.tableReport);reload.w.close();
  p.click('↶ Undo');check('Undo restores old report and exact previous state',p.state(),before);
  p.x('doAct('+JSON.stringify(answer)+')');check('Replaying the action recreates all ordered moves',p.state(),after);
  // Grouping must preserve the same internal step as individual mode.
  const grouped=fixture('intermediate-omitted-before');grouped.options.groupUpdates=true;p.load(grouped);p.x('doAct('+JSON.stringify(answer)+')');
  check('Grouping also retains Niagara to York',p.state().tableReport.map.moves.some(m=>m.from.place==='NIA'&&m.to.place==='YOR'&&m.ships.includes('oneida')),true);
  p.w.close();
 }
 check('No DOM/control errors',errors,[]);console.log(`v0.2.15 audit fixes: ${passed} assertions passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
