/* Claude v0.2.8 audit follow-ups, tested independently through shipped HTML.
   NODE_PATH=/path/to/jsdom/node_modules node tests/browser/ui_followup_v029.js [repo] [--require-fixed]
   Geometry checks stub rectangles; real responsive scrolling is a browser check. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const html = fs.readFileSync(path.join(repo, 'dist/index.html'), 'utf8');
const checks = [], errors = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
async function launch() {
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, { url: 'https://followup-audit.invalid/', runScripts: 'dangerously', virtualConsole: vc });
  await new Promise(r => dom.window.addEventListener('load', r));
  const w = dom.window, d = w.document;
  const state = () => w.eval('JSON.stringify(G_STATE)'), undo = () => w.eval('JSON.stringify(UNDO)');
  function button(label, scope = d) { const b = [...scope.querySelectorAll('button')].find(x => x.textContent === label); assert(b && !b.disabled, label); b.click(); return b; }
  function change(e, value) { assert(e); e.value = value; e.dispatchEvent(new w.Event('change', { bubbles: true })); }
  change(d.querySelector('input[type=number]'), '280004'); button('Start campaign');
  return { dom, w, d, button, change, state, undo };
}
(async () => {
  // L13: real Adjust and assignment controls. The test adds available Troops,
  // then checks the input and validation agree before any decision is applied.
  const a = await launch(); a.button('Adjust');
  const troopLabel = [...a.d.querySelectorAll('#modal label')].find(x => x.textContent.startsWith('Your Available Troops'));
  a.change(troopLabel.querySelector('input'), '3'); a.button('Set', troopLabel); a.button('Close', a.d.querySelector('#modal'));
  a.button('June I (this turn)'); a.button('Confirm'); a.button('+ Add Force');
  a.change(a.d.querySelector('.asg-force select'), 'ArmySupport');
  for (const ship of ['Madison', 'Oneida']) [...a.d.querySelectorAll('.asg-ship')].find(x => x.textContent === ship).click();
  a.change(a.d.querySelector('.asg-force input[type=number]'), '0');
  check('L13 zero entered Troops remains visibly zero', a.d.querySelector('.asg-force input[type=number]').value === '0', { shown: a.d.querySelector('.asg-force input[type=number]').value, held: a.w.eval('UI.local.forces[0].troops') });
  check('L13 zero cannot be confirmed', [...a.d.querySelectorAll('#proc button')].find(x => x.textContent === 'Confirm assignments').disabled);
  a.change(a.d.querySelector('.asg-force input[type=number]'), '1');
  check('L13 nearby one Troops can be confirmed', a.d.querySelector('.asg-force input[type=number]').value === '1' && ![...a.d.querySelectorAll('#proc button')].find(x => x.textContent === 'Confirm assignments').disabled);
  a.dom.window.close();

  // L14: independent minimum of three ships: 2+1 from Main Ships, then one
  // 2-LG Secondary, not two 1-LG Secondaries. No production selection oracle.
  const p = await launch();
  const minimal = p.w.eval(`(() => { const rnd=Math.random; Math.random=()=>0; try {
    return pkgAutoFill(G_STATE, ['madison','oneida','hamilton','ontario','growler'], {type:'lg',n:5});
  } finally {Math.random=rnd;} })()`);
  check('L14 minimum Secondary count after Main Ships', minimal.length === 3 && minimal.includes('madison') && minimal.includes('oneida') && minimal.includes('growler'), [...minimal]);
  const deterministic = p.w.eval(`(() => { const rnd=Math.random; Math.random=()=>{throw new Error('unseeded random call');}; try {
    const s=G_STATE, before=JSON.stringify(s), pool=['madison','oneida','growler','julia'];
    const one=pkgAutoFill(s,pool,{type:'lg',n:5}), two=pkgAutoFill(s,pool,{type:'lg',n:5});
    return {one,two,unchanged:JSON.stringify(s)===before};
  } catch(e){return {error:e.message};} finally {Math.random=rnd;} })()`);
  check('L14 ties repeat without unseeded randomness or state changes', !deterministic.error && deterministic.unchanged && JSON.stringify(deterministic.one) === JSON.stringify(deterministic.two), JSON.parse(JSON.stringify(deterministic)));
  const boundaries = p.w.eval(`(() => {
    const s=G_STATE, pool=['madison','oneida','growler','julia'];
    return {empty:pkgAutoFill(s,[],{type:'lg',n:1}), impossible:pkgAutoFill(s,pool,{type:'lg',n:100}), mainsOnly:pkgAutoFill(s,pool,{type:'lg',n:3}), count:pkgAutoFill(s,pool,{type:'ships',n:3})};
  })()`);
  check('L14 exhausted and impossible pools produce no selection', !boundaries.empty.length && !boundaries.impossible.length);
  check('L14 Main Ships satisfy requirement without adding Secondaries', boundaries.mainsOnly.length === 2 && boundaries.mainsOnly.includes('madison') && boundaries.mainsOnly.includes('oneida'));
  check('L14 count mode remains exact and Main-first', boundaries.count.length === 3 && boundaries.count.includes('madison') && boundaries.count.includes('oneida'));
  p.w.eval(`G_STATE.prompt={id:990,kind:'select',pkg:4,title:'Package helper UI fixture',min:0,max:5,items:['madison','oneida','hamilton','ontario','growler'].map(id=>({id,label:shipName(G_STATE,id)}))};UI.local=null;renderProc(G_STATE);`);
  p.change(p.d.querySelector('#proc .banner input[type=number]'), '5');
  const before = p.state(), oldUndo = p.undo(), oldSave = p.w.localStorage.getItem('agc_solo_companion_v1');
  p.button('Auto-fill'); const firstPick = p.w.eval('JSON.stringify(UI.local.sel)'); p.button('Auto-fill');
  check('L14 actual Auto-fill controls repeat the minimum selection', p.w.eval('UI.local.sel.length') === 3 && p.w.eval('JSON.stringify(UI.local.sel)') === firstPick);
  check('L14 Auto-fill leaves game, RNG, Undo and autosave unchanged', p.state() === before && p.undo() === oldUndo && p.w.localStorage.getItem('agc_solo_companion_v1') === oldSave);
  p.dom.window.close();

  // L7: the first Round under Rainy Squalls is Close Action. Wolfe's 8 CA can
  // attack Oneida's 3 CA; the Reaction Segment is the nearby Gunnery control.
  const rain=await launch();
  rain.w.eval(`G_STATE=newGame('BR',280009);var rs=G_STATE;newForce(rs,'BR','NOR','Patrol',['wolfe']);newForce(rs,'US','NOR','Patrol',['oneida']);
    rs.encounter={zone:'NOR',kind:'normal',segment:'patrol',ships:{wolfe:'in',oneida:'in'},side:{wolfe:'BR',oneida:'US'},struckBy:{},wg:'BR',wgCard:19,withdrawn:{US:false,BR:false}};
    rs.zones.NOR.flags.rainy=true;rs.calls=[{proc:'combat',pc:'start',A:{attacker:'BR',segment:'patrol'},L:{}}];rs.prompt=null;run(rs);UI.local=null;render();`);
  const rainBefore=rain.state(),rainUndo=rain.undo(),rainText=rain.d.querySelector('#proc').textContent;
  check('L7 Rainy lineup describes actual Close Action instead of Gunnery odds', rainText.includes('Rainy Squalls: no Gunnery') && rainText.includes('Close Action matchups:') && rainText.includes('Wolfe (A) vs Oneida') && !rainText.includes('First-Round Gunnery strength'),rainText);
  rain.w.eval('renderProc(G_STATE)');
  check('L7 preview leaves game, RNG and Undo unchanged',rain.state()===rainBefore&&rain.undo()===rainUndo);
  rain.w.eval("G_STATE.encounter.segment='reaction';G_STATE.combat.segment='reaction';renderProc(G_STATE)");
  check('L7 Reaction lineup retains Gunnery preview',rain.d.querySelector('#proc').textContent.includes('First-Round Gunnery strength')&&!rain.d.querySelector('#proc').textContent.includes('Rainy Squalls: no Gunnery'));
  rain.dom.window.close();

  // L10: confirm an actual prompt while supplying known viewport rectangles.
  // Nearby visible-title controls prove the fix does not always jump the page.
  for (const c of [
    {name:'offscreen above', top:-236,bottom:-218,header:'static',expect:1},
    {name:'visible on phone',top:10,bottom:28,header:'static',expect:0},
    {name:'offscreen below',top:840,bottom:860,header:'static',expect:1},
    {name:'covered by sticky header',top:80,bottom:98,header:'sticky',expect:1},
    {name:'visible below sticky header',top:120,bottom:138,header:'sticky',expect:0}
  ]) {
    const t=await launch();t.button('June I (this turn)');t.button('Confirm');
    const calls=[];t.w.HTMLElement.prototype.scrollIntoView=function(opts){calls.push({id:this.id,opts});};
    const original=t.w.HTMLElement.prototype.getBoundingClientRect;
    t.w.HTMLElement.prototype.getBoundingClientRect=function(){
      if(this.matches('#proc .ptitle'))return {top:c.top,bottom:c.bottom,height:c.bottom-c.top};
      if(this.id==='hdr')return {top:0,bottom:100,height:100};
      return original.call(this);
    };
    t.d.querySelector('#hdr').style.position=c.header;t.w.innerHeight=844;
    t.button('Confirm assignments');
    check('L10 '+c.name,calls.length===c.expect && calls.every(x=>x.id==='proc'),calls);
    t.dom.window.close();
  }
  const f=await launch();f.button('Settings');
  check('L16 Settings labels occupy separate rows', [...f.d.querySelectorAll('#modal label')].every(x=>f.w.getComputedStyle(x).display==='block'));
  f.button('Close',f.d.querySelector('#modal'));f.button('Adjust');
  check('L16 Adjust numeric labels occupy separate rows', [...f.d.querySelectorAll('#modal label')].every(x=>f.w.getComputedStyle(x).display==='block'));
  f.dom.window.close();
  check('No script or console errors in follow-ups',errors.length===0,errors);
  console.log(JSON.stringify({repo,checks:checks.length,passed:checks.filter(x=>x.pass).length,results:checks},null,2));
  if(process.argv.includes('--require-fixed')&&checks.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
