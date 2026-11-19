// Actual shipped HTML and control handlers in jsdom; this is not a visual-browser test.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const dir=path.join(root,'audits/2026-11-19-v0.2.11/evidence/targeted');
const fixture=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json')));
const key='agc_solo_companion_v1';let passed=0;const errors=[];
function check(name,actual,expected){assert.deepEqual(actual,expected,name);passed++;}
async function page(source=html){
  const vc=new VirtualConsole().on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(source,{url:'https://agc-test.invalid/',runScripts:'dangerously',virtualConsole:vc});
  const w=dom.window,d=w.document;await new Promise(r=>w.addEventListener('load',r,{once:true}));
  const x=c=>w.eval(c),state=()=>JSON.parse(x('JSON.stringify(G_STATE)'));
  const click=(label,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===label);assert(b&&!b.disabled,label);b.click();};
  const change=(e,v)=>{assert(e);e.value=String(v);for(const type of ['input','change'])e.dispatchEvent(new w.Event(type,{bubbles:true}));};
  const snap=()=>JSON.stringify({s:state(),undo:x('JSON.stringify(UNDO)'),draft:x('JSON.stringify(UI.local)'),disk:w.localStorage.getItem(key)});
  const load=s=>{click(state()?'Load':'Load a saved game');change(d.querySelector('#modal textarea'),JSON.stringify(s));click('Load pasted text');};
  const select=v=>[...d.querySelectorAll('#modal select')].find(e=>[...e.options].some(o=>o.value===v));
  return{w,d,x,state,click,change,snap,load,select};
}
(async()=>{
  for(const name of ['encounter','command','lineup','tactics','gunnery']){
    const p=await page();p.load(fixture(name));
    for(const field of ['box','owner','steps']){
      const before=p.snap();p.click('Adjust');p.change(p.select('pike'),'oneida');
      check(name+': ship lock explained before editing',p.d.querySelector('#ship-correction-notice').textContent.includes('active Encounter'),true);
      if(field==='box')p.change(p.select('outOfPlay'),'outOfPlay');
      if(field==='owner'){p.change(p.select('outOfPlay'),'transit');p.change(p.select('BR'),'BR');}
      if(field==='steps')p.change(p.d.querySelector('#modal input[max="'+p.state().ships.oneida.steps+'"]'),p.state().ships.oneida.steps-1);
      p.click('Apply');
      check(name+': '+field+' blocked without changing game, draft, Undo or disk',p.snap(),before);
      check(name+': clear refusal',!!p.d.querySelector('#modal .err').textContent,true);
      p.click('Close');
    }
    p.click('Adjust');p.change(p.select('pike'),'pike');
    const before=p.state().ships.pike.steps;
    const row=p.select('pike').parentElement;p.change(row.querySelector('input'),before-1);p.click('Apply');
    check(name+': unrelated construction ship still adjustable',p.state().ships.pike.steps,before-1);
    const label=[...p.d.querySelectorAll('#modal label')].find(e=>e.textContent.startsWith('U.S. VP'));
    const vp=p.state().vp.US;p.change(label.querySelector('input'),vp+1);p.click('Set',label);
    check(name+': track corrections remain usable',p.state().vp.US,vp+1);
    p.w.close();
  }
  const mutations={
    'unknown Event':s=>s.deck.event[0]=999,
    'string Event':s=>s.deck.event[0]='1',
    'missing Event pile':s=>delete s.deck.event,
    'mistyped Target pile':s=>s.deck.target={},
    'unknown Target':s=>s.deck.target[0]='A999',
    'wrong-campaign Target':s=>s.deck.target[0]='B1',
    'unknown attacker Tactic':s=>s.deck.tacA[0]='A_no_such_card',
    'defender card in attacker pile':s=>s.deck.tacA[0]='D_escape',
    'attacker card in defender pile':s=>s.deck.tacD[0]='A_rake',
    'targetRow card':s=>s.targetRow[0].id='A999',
    'drawn Event':s=>s.eventsDrawn.push({id:999,purpose:'test'}),
    'zone Event':s=>s.zones.SAC.event=999,
    'Intelligence card':s=>s.intelligence.US={card:999,until:1},
    'Weather Gage card':s=>s.encounter.wgCard=999,
    'prompt Event':s=>s.prompt.eventCard=999,
    'prompt Target':s=>s.prompt.targetCard='B1',
    'Tactics choice':s=>s.prompt.options[0].id='D_escape',
    'current Tactic':s=>s.combat.tac.att={id:'D_escape',used:false},
    'pending Tactic draw':s=>s.calls.find(f=>f.proc==='combat').L.hDrawn[0]='D_escape',
    'Force origin card':s=>Object.values(s.forces)[0].cardId='A999',
    'pending casualty context':s=>s.leaderResult={US:'invalid'},
  };
  {
    const p=await page();p.load(fixture('command'));
    for(const [name,mutate] of Object.entries(mutations)){
      const bad=fixture('tactics');mutate(bad);const before=p.snap();p.load(bad);
      check(name+': import refused atomically',p.snap(),before);
      check(name+': useful damaged-save message',/damaged or incomplete/.test(p.d.querySelector('#modal .err').textContent),true);
      p.click('Close');
    }
    for(const name of ['encounter','command','lineup','tactics','gunnery']){
      p.load(fixture(name));check(name+': valid older save accepted',p.d.querySelector('#modal').classList.contains('open'),false);
    }
    const empty=fixture('command');for(const k of Object.keys(empty.deck))empty.deck[k]=[];
    empty.intelligence.US={card:13,until:1};p.load(empty);
    check('Valid empty piles and held Intelligence accepted',p.d.querySelector('#modal').classList.contains('open'),false);
    p.w.close();
  }
  {
    const p=await page();p.load(fixture('command'));
    // Place an unmistakable old entry before more than 400 newer entries.
    p.x("G_STATE.log=[{turn:0,phase:'enemy',kind:'combat',text:'Oneida Event #37 old match'},...Array.from({length:430},(_,i)=>({turn:1,phase:'lake',kind:'info',text:'New entry '+i}))];renderBoard(G_STATE)");
    const before=p.snap(),search=p.d.querySelector('#log-search');search.focus();p.change(search,'ONEIDA');
    check('Search finds entries beyond recent 400',p.d.querySelector('#log-count').textContent,'Showing 1 of 1 matching entries (newest first).');
    check('Search retains keyboard focus',p.d.activeElement===search,true);
    p.change(search,'#37');check('Card search returns old entry',p.d.querySelector('#log').textContent.includes('old match'),true);
    p.change(search,'enemy');check('Phase search works',p.d.querySelector('#log').textContent.includes('old match'),true);
    p.change(p.d.querySelector('#log-filter'),'vp');check('Category combines with search',p.d.querySelector('#log-count').textContent.includes('0 of 0'),true);
    p.change(p.d.querySelector('#log-filter'),'all');p.change(search,'');
    check('Clear search restores recent limit',p.d.querySelector('#log-count').textContent.includes('400 of 431'),true);
    p.click('Show full log');check('Full log still available',p.d.querySelector('#log-count').textContent.includes('431 of 431'),true);
    check('Searching leaves game, dice, draft, Undo and disk untouched',p.snap(),before);
    p.w.close();
  }
  {
    const p=await page();let blob,filename;
    p.w.URL.createObjectURL=b=>{blob=b;return'blob:test';};p.w.URL.revokeObjectURL=()=>{};
    p.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
    p.click('Download app (.html)');
    check('App download filename carries release',filename,'A_Glorious_Chance_Solo_v0.2.12.html');
    const text=await new Promise((res,rej)=>{const r=new p.w.FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(blob);});
    const re=await page(text);check('Downloaded HTML boots to clean setup',!!re.d.querySelector('.setup')&&re.state()===null,true);
    check('Downloaded HTML has no external script or stylesheet dependencies',re.d.querySelectorAll('script[src],link[rel=stylesheet]').length,0);
    p.load(fixture('command'));const before=p.snap();p.click('Reference');
    const topics=p.d.querySelector('#modal select');p.change(topics,[...topics.options].find(o=>o.textContent==='Offline app').value);
    p.click('Download app (.html)');const second=await new Promise(res=>{const r=new p.w.FileReader();r.onload=()=>res(r.result);r.readAsText(blob);});
    check('In-game download contains no current campaign or dialogs',second,text);
    check('App download leaves the open game intact',p.snap(),before);
    re.w.close();p.w.close();
  }
  check('No DOM script or control errors',errors,[]);
  console.log(`v0.2.12 UI/save/download/search: ${passed} assertions passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
