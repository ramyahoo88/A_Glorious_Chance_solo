const legacyEventFixture = require('./legacy_events');
/* Claude v0.2.8 M6/M7/L12 follow-up, actual shipped HTML in jsdom.
   node tests/browser/persistence_followup_v029.js [repo] [--require-fixed]
*/
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const repo=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const html=legacyEventFixture(fs.readFileSync(path.join(repo,'dist/index.html'),'utf8')),strict=process.argv.includes('--require-fixed');
const results=[],fixture=n=>fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8');
function check(name,ok,detail){results.push({name,pass:!!ok,detail});}
async function launch(saved){
 const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://persistence-followup.invalid/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){if(saved)w.localStorage.setItem('agc_solo_companion_v1',saved)}});await new Promise(r=>dom.window.addEventListener('load',r));
 const w=dom.window,d=w.document,read=c=>w.eval(c),state=()=>JSON.parse(read('JSON.stringify(G_STATE)')),json=()=>read('JSON.stringify(G_STATE)'),stored=()=>w.localStorage.getItem('agc_solo_companion_v1');
 function button(text,scope=d){const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'No button '+text);assert(!b.disabled,'Disabled '+text);b.click();return b;}
 function change(el,v){assert(el);el.value=String(v);el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 function start(seed){change(d.querySelector('input[type=number]'),seed);button('Start campaign');}
 function load(text){const header=[...d.querySelectorAll('#hdr button')].find(b=>b.textContent==='Load'||b.textContent==='Load game');assert(header);header.click();change(d.querySelector('#modal textarea'),text);button('Load pasted text',d.querySelector('#modal'));}
 function ship(id){button('Adjust');const selects=d.querySelectorAll('#modal select');change(selects[0],id);return {box:selects[1],steps:d.querySelector('#modal input[min="0"]'),owner:selects[2]};}
 function vp(side,v){button('Adjust');const label=[...d.querySelectorAll('#modal label')].find(l=>l.textContent.startsWith(side==='US'?'U.S. VP':'British VP'));change(label.querySelector('input'),v);button('Set',label);button('Close',d.querySelector('#modal'));}
 return {dom,w,d,read,state,json,stored,button,change,start,load,ship,vp,errors};
}
(async()=>{
 // Setup-screen Load must retain the unopened browser game and its existing history.
 const a=await launch();a.start(292001);const a0=a.json();a.button('June I (this turn)');const a1=a.json(),ah=a.read('JSON.stringify(UNDO)'),astore=a.stored();a.dom.window.close();
 const b=await launch();b.start(292002);const incoming=b.read('saveText()');b.dom.window.close();
 const t=await launch(astore);t.load(incoming);
 check('M6 setup import loads chosen game',t.state().seed===292002);
 check('M6 setup import preserves prior game plus history',t.read('UNDO.length')===JSON.parse(ah).length+1);
 const re=await launch(t.stored());re.button('Continue it');
 if(re.read('UNDO.length')){re.button('↶ Undo');check('M6 Undo after import and reload restores prior game',re.json()===a1);check('M6 prior Undo history survives',re.read('JSON.stringify(UNDO)')===ah);if(re.read('UNDO.length')){re.button('↶ Undo');check('M6 previous decision can still be undone',re.json()===a0);}else check('M6 previous decision can still be undone',false);}
 else{check('M6 Undo after import and reload restores prior game',false);check('M6 prior Undo history survives',false);check('M6 previous decision can still be undone',false);}
 t.dom.window.close();re.dom.window.close();
 const bad=await launch(astore);bad.load('{"state":{"human":"US"}}');check('M6 damaged setup import preserves stored bytes and setup',bad.json()==='null'&&bad.stored()===astore&&bad.read('UNDO.length')===0);bad.dom.window.close();
 const resume=await launch(astore);resume.button('Continue it');check('M6 ordinary Continue does not duplicate the retained game in Undo',resume.json()===a1&&resume.read('JSON.stringify(UNDO)')===ah);resume.dom.window.close();
 // Exact supplied M7 position. Only changing steps must leave location and Force intact.
 const m=await launch();m.load(fixture('adjust-madison-on-lake.json'));const before=m.json(),s0=m.state(),mad=s0.ships.madison,force=JSON.stringify(s0.forces[mad.forceId]);
 let fields=m.ship('madison');check('M7 adjustment initially says keep current Lake box',fields.box.value===''&&fields.box.textContent.includes('Keep current box (Lake)'));
 m.change(fields.steps,2);m.button('Apply',m.d.querySelector('#modal'));m.button('Close',m.d.querySelector('#modal'));let s=m.state(),changed=m.json();
 check('M7 steps-only edit preserves lake zone and Force',s.ships.madison.steps===2&&s.ships.madison.box==='lake'&&s.ships.madison.zone===mad.zone&&s.ships.madison.forceId===mad.forceId&&JSON.stringify(s.forces[mad.forceId])===force,s.ships.madison);
 const mr=await launch(m.stored());mr.button('Continue it');check('M7 location-preserving adjustment survives reload',mr.json()===changed);mr.button('↶ Undo');check('M7 Undo restores exact pre-adjustment state',mr.json()===before);mr.dom.window.close();
 m.button('↶ Undo');fields=m.ship('madison');const undo=m.read('JSON.stringify(UNDO)'),saved=m.stored();m.change(fields.owner,'BR');m.button('Apply',m.d.querySelector('#modal'));
 check('M7 deployed owner change needs an explicit destination and is atomic',m.json()===before&&m.read('JSON.stringify(UNDO)')===undo&&m.stored()===saved&&/destination box/.test(m.d.querySelector('#modal .err')?.textContent||''));
 const select=m.d.querySelectorAll('#modal select');m.change(select[1],'makeReady');m.button('Apply',m.d.querySelector('#modal'));m.button('Close',m.d.querySelector('#modal'));s=m.state();
 check('M7 explicit owner and box change removes ship from old Force',s.ships.madison.owner==='BR'&&s.ships.madison.box==='makeReady'&&s.ships.madison.zone===null&&s.ships.madison.forceId===null&&!s.forces[mad.forceId]?.ships.includes('madison'));
 m.button('↶ Undo');check('M7 explicit move remains exactly undoable',m.json()===before);m.dom.window.close();
 // Manual VP correction must contribute a signed entry to the same ledger as normal scoring.
 const v=await launch();v.load(fixture('adjust-vp-before-final-turn.json'));const original=v.json(),start=v.state();v.vp('US',start.vp.US+3);let p=v.state();
 const ledger=x=>x.vpLog.reduce((n,row)=>n+(row.side==='US'?row.n:-row.n),0);
 check('L12 U.S. VP correction adds one +3 manual ledger entry',p.vp.US===start.vp.US+3&&p.vpLog.length===start.vpLog.length+1&&p.vpLog.at(-1).side==='US'&&p.vpLog.at(-1).n===3&&p.vpLog.at(-1).why==='Manual adjustment');
 v.vp('BR',start.vp.BR+2);p=v.state();check('L12 British correction has negative game-score effect',ledger(p)===p.vp.US-p.vp.BR&&p.vpLog.at(-1).side==='BR'&&p.vpLog.at(-1).n===2);
 v.button('↶ Undo');v.button('↶ Undo');check('L12 both adjustments Undo to original exact state',v.json()===original);v.vp('US',start.vp.US+3);
 // End-game calculation is tested directly from the corrected real campaign position. This is an engine assertion, not a full campaign claim.
 v.read('endGame(G_STATE); autosave(); render();');p=v.state();check('L12 final ledger, result and header agree after correction and normal CD deductions',ledger(p)===p.result.score&&p.result.score===p.vp.US-p.vp.BR&&v.d.querySelector('#proc').textContent.includes('Final Game Score: '+v.read('sgn(G_STATE.result.score)')));
 const final=await launch(v.stored());final.button('Review it');check('L12 corrected final game reloads exactly',final.json()===v.json());final.dom.window.close();v.dom.window.close();
 const done=await launch();done.load(fixture('adjust-completed-game.json'));const doneBefore=done.json(),old=done.state();done.vp('US',old.vp.US+3);p=done.state();
 check('L12 correction made after Game Over updates cached final result and ledger',p.result.score===old.result.score+3&&ledger(p)===p.result.score&&p.result.level===done.read('victoryLevel(gameScore(G_STATE))'));
 done.button('↶ Undo');check('L12 postgame correction Undo restores exact final result',done.json()===doneBefore);done.dom.window.close();
 const failures=results.filter(r=>!r.pass);console.log(JSON.stringify({checks:results.length,failures:failures.length,results},null,2));if(strict&&failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
