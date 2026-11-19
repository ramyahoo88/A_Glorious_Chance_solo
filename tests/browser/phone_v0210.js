const legacyEventFixture = require('./legacy_events');
/* Exercises the built HTML, including normal A7 play. Run with NODE_PATH pointing
   to jsdom and an optional path to the built HTML, followed by --observe for a baseline. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = legacyEventFixture(fs.readFileSync(process.argv[2] || path.resolve(__dirname, '../../dist/index.html'), 'utf8'));
const results = [], errors = [];
const jsdomErrors = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
async function game(run, setup = true) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://phone-audit.invalid/', virtualConsole: jsdomErrors,
    beforeParse(w) { Object.defineProperty(w, 'innerWidth', { configurable: true, value: 375 }); } });
  const w = dom.window, d = w.document;
  const q = selector => d.querySelector(selector);
  const button = (name, root = d) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === name);
  function click(name, root = d) {
    const b = button(name, root); assert(b && !b.disabled, 'Enabled button: ' + name); b.focus(); b.click(); return b;
  }
  function change(control, value) {
    assert(control, 'Missing control for ' + value); control.focus(); control.value = value;
    control.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  function start() {
    change(q('.setup input[type=number]'), '280004'); click('Start campaign');
    click('June I (this turn)'); click('Confirm');
    assert(w.eval("G_STATE.prompt.kind === 'assign'"));
  }
  function load(data) {
    click('Load a saved game'); q('#modal textarea').value = JSON.stringify(data); click('Load pasted text', q('#modal'));
  }
  try {
    await new Promise(resolve => w.addEventListener('load', resolve));
    if (setup) start();
    return await run({ w, d, q, button, click, change, load, ev: code => w.eval(code), snap: () => w.eval('JSON.stringify([G_STATE, UNDO, UI.local])') });
  } finally { w.close(); }
}
async function test(name, fn, setup) {
  try { const detail = await game(fn, setup); results.push({ name, pass: true, detail }); }
  catch (e) { results.push({ name, pass: false, error: e.message }); }
}
(async () => {
  await test('A7 changing the flagship as the last input applies the displayed choice', async a => {
    a.click('+ Add Force'); a.q('.asg-ship').click();
    const pick = a.q('#proc select'), original = pick.value;
    const chosen = [...pick.options].find(o => o.value !== original).value;
    a.change(pick, chosen); a.click('Confirm assignments');
    assert.equal(a.ev('G_STATE.flagship.US'), chosen);
    return { original, chosen, seed: 280004 };
  });

  await test('The same flagship transfer also works before a later ship selection', async a => {
    a.click('+ Add Force');
    const pick = a.q('#proc select'); a.change(pick,'oneida');
    a.q('.asg-ship').click(); a.click('Confirm assignments'); assert.equal(a.ev('G_STATE.flagship.US'),'oneida');
    return { seed:280004, inputOrder:['flagship','ship','confirm'] };
  });

  await test('An empty A7 warns before confirmation and clears when ships will sail', async a => {
    assert.match(a.q('#proc').textContent,/No Forces assigned.*every ship in port/);
    a.click('+ Add Force'); a.q('.asg-ship').click();
    assert.doesNotMatch(a.q('#proc').textContent,/No Forces assigned/);
    return { seed:280004, assigned:1 };
  });

  await test('Homeport and A7 ship details work without changing the draft, RNG or Undo', async a => {
    const board = a.q('button.ship[aria-label="Inspect Madison"]'); assert(board, 'Homeport Madison has a details control');
    const before = a.snap(); board.focus(); board.click();
    assert.equal(a.q('#modal h3').textContent, 'Madison');
    const rows = [...a.d.querySelectorAll('#modal table tr')].map(r => [...r.cells].map(c => c.textContent));
    assert.deepEqual(rows, [['Face','Long Gun','Carronade','Close Action','Defense'],['Full','2','4','5','6'],['Reduced','1','2','2','3']]);
    a.click('Close', a.q('#modal')); assert.equal(a.d.activeElement, board); assert.equal(a.snap(), before);
    a.click('+ Add Force'); a.q('.asg-ship').click();
    const draft = a.snap(), opener = a.click('Inspect ships');
    a.change(a.q('#modal select'), 'asp'); assert.equal(a.q('#modal h3').textContent, 'Asp');
    a.click('Close', a.q('#modal')); assert.equal(a.d.activeElement, opener); assert.equal(a.snap(), draft);
    a.click('Confirm assignments'); const onLake = a.q('#lake button.ship');
    assert(onLake); onLake.click(); assert.match(a.q('#modal .ship-details').textContent, /Lake · .*Patrol/);
    return { inspected: ['homeport', 'A7 with one assigned', 'lake'], seed: 280004 };
  });

  await test('Selection and lineup changes preserve focus and scroll; tow has its own name', async a => {
    a.ev(`G_STATE.prompt = { id: 12340, kind:'select', min:0, items: Object.keys(G_STATE.ships).map(id=>({id,label:shipName(G_STATE,id)})) }; renderProc(G_STATE);`);
    const list = a.q('.sel-list'), pick = list.querySelectorAll('input')[8]; list.scrollTop = 80;
    pick.focus(); pick.click(); assert.equal(a.d.activeElement, a.q('.sel-list').querySelectorAll('input')[8]); assert.equal(a.q('.sel-list').scrollTop, 80);
    a.ev(`G_STATE.encounter={zone:'SAC',segment:'patrol',kind:'lake',ships:{madison:'in',asp:'in',wolfe:'in'},side:{madison:'US',asp:'US',wolfe:'BR'}};
      G_STATE.prompt={id:12341,kind:'lineup',title:'Test lineup',side:'US',candidates:['madison','asp'],defenders:['wolfe'],defaultTows:{}}; renderProc(G_STATE);`);
    const tow = a.q('[aria-label="Tow for Madison"]'); assert(tow); assert.equal(tow.closest('label'), null);
    a.change(tow,'asp'); assert.equal(a.d.activeElement.id, tow.id); assert.equal(a.ev('UI.local.tows.madison'),'asp');
    const select = a.q('#lineup-asp'); select.focus(); select.click(); assert.equal(a.d.activeElement.id,select.id);
    assert.deepEqual(JSON.parse(a.ev('JSON.stringify(UI.local.tows)')), {});
    return { scrollTop: 80, tow: 'Madison → Asp' };
  });

  await test('An empty first Round explains the skipped roll and does not display odds', async a => {
    a.ev(`G_STATE.encounter={zone:'SAC',segment:'patrol',kind:'lake',ships:{madison:'in',wolfe:'in'},side:{madison:'US',wolfe:'BR'}};
      G_STATE.zones.SAC.flags.missedSignal='madison';
      G_STATE.prompt={id:12342,kind:'lineup',title:'Test lineup',side:'US',candidates:['madison'],defenders:['wolfe'],defaultTows:{}}; renderProc(G_STATE);`);
    assert.match(a.q('#proc').textContent,/No combat roll in the first Round.*Madison/);
    assert.doesNotMatch(a.q('#proc').textContent,/First-Round Gunnery strength|No eligible Close Action/);
    a.ev("G_STATE.zones.SAC.flags.missedSignalUsed=true;renderProc(G_STATE)");
    assert.match(a.q('#proc').textContent,/First-Round Gunnery strength/);
    return { attacker: 'Madison', defender: 'Wolfe', encounter: "Sacket's" };
  });

  await test('A reserve appears once and has no line position when its battle column is empty', async a => {
    a.ev(`G_STATE.encounter={zone:'SAC',segment:'patrol',kind:'lake',ships:{madison:'in',wolfe:'in'},side:{madison:'US',wolfe:'BR'}};
      G_STATE.combat={att:'BR',def:'US',seq:'B',col:{US:[],BR:['wolfe']}};
      G_STATE.prompt={id:12343,kind:'info',title:'Test columns',options:[{id:'ok'}],combatView:true};renderProc(G_STATE);`);
    assert.match(a.q('#proc .colm.US').textContent,/In Force Assembly: Madison/);
    assert.equal(a.q('#proc .colm.US .pos'),null); assert(a.q('#proc .colm.BR .pos'));
    return { reserve: 'Madison', fighting: 'Wolfe' };
  });

  await test('A changed Weather Gage labels the completed formation and a retained Gage keeps the active roles', async a => {
    a.ev(`G_STATE.encounter={zone:'KIN',segment:'reaction',kind:'lake',wg:'US',ships:{madison:'in',wolfe:'in'},side:{madison:'US',wolfe:'BR'}};
      G_STATE.combat={att:'BR',def:'US',seq:'B',col:{US:['madison'],BR:['wolfe']}};
      G_STATE.prompt={id:12344,kind:'info',title:'Weather Gage changes!',options:[{id:'ok'}],combatView:true};renderProc(G_STATE);`);
    assert.match(a.q('#proc').textContent, /Weather Gage: American · Previous formation \(Sequence B\)/);
    assert.equal(a.q('#proc .colm.US > b').textContent, 'American – previous defender');
    assert.equal(a.q('#proc .colm.BR > b').textContent, 'British – previous attacker');
    a.ev("G_STATE.encounter.wg='BR';renderProc(G_STATE)");
    assert.match(a.q('#proc').textContent, /Weather Gage: British · Combat Sequence B/);
    assert.equal(a.q('#proc .colm.BR > b').textContent, 'British – attacking');
    assert.equal(a.q('#proc .colm.US > b').textContent, 'American – defending');
    a.ev("G_STATE.encounter.kind='harbor';G_STATE.encounter.wg=null;renderProc(G_STATE)");
    assert.doesNotMatch(a.q('#proc').textContent, /Previous formation|Combat Sequence/);
    return { previous: 'B', newGage: 'American', retainedGage: 'British', harbor: true };
  });

  // Read down the original printed columns of British Living Rules p. 32,
  // counting cells for positions 1, 2, ... . With one ship the result is automatic.
  const byColumn = [
    [36],[18,18],[12,12,12],[9,9,9,9],[7,7,8,7,7],[6,6,6,6,6,6],[5,5,5,6,5,5,5],
    [3,5,5,5,5,5,5,3],Array(9).fill(4),[2,4,4,4,4,4,4,4,4,2],[1,4,4,4,5,4,4,4,4,1,1],Array(12).fill(3),
    [1,3,3,3,3,3,3,3,3,3,3,3,2],[2,3,3,3,3,3,3,3,3,3,3,2,1,1],[2,2,2,2,2,2,4,4,4,2,2,2,2,2,2],
    [2,2,2,2,2,2,2,4,4,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,3,3,2,2,2,2,2,2,2,2],Array(18).fill(2)
  ];
  await test('Reference returns all 648 line positions and keeps the Close control reachable', async a => {
    const before = a.snap(), opener = a.click('Reference'), pick = a.q('#modal select');
    assert(pick,'Reference topic picker');
    a.change(pick,[...pick.options].find(o => o.textContent.includes('Hit Distribution')).value);
    const ships = a.q('.ref-topic select'); assert.equal(ships.options.length,18);
    for (const [i, counts] of byColumn.entries()) {
      a.change(ships, String(i+1)); const cells = [...a.d.querySelectorAll('.hit-lookup td')].map(cell => +cell.textContent);
      assert.deepEqual(cells, counts.flatMap((count, pos) => Array(count).fill(pos+1)), 'Ship column ' + (i+1));
    }
    assert.equal(a.w.getComputedStyle(a.q('#modal .inner > div')).position,'sticky');
    a.click('Close',a.q('#modal')); assert.equal(a.d.activeElement,opener); assert.equal(a.snap(),before);
    return { shipColumns: 18, redBluePairs: 648 };
  });

  await test('Lake zone placement follows the board at either width without another game action', async a => {
    const cells = [...a.d.querySelectorAll('#lake .zone')].map(z => z.style.gridArea);
    assert.deepEqual([...cells].sort(),['KIN','NIA','NOR','SAC','SOU','YOR']);
    const rules = [...a.d.styleSheets[0].cssRules];
    const wide = rules.find(r => r.selectorText === '#lake').style.getPropertyValue('grid-template-areas');
    const narrow = rules.filter(r => r.media && r.conditionText === '(max-width: 640px)').flatMap(r => [...r.cssRules])
      .find(r => r.selectorText === '#lake').style.getPropertyValue('grid-template-areas');
    assert.equal(wide,'"YOR NOR KIN" "NIA SOU SAC"'); assert.equal(narrow,'"YOR NIA" "NOR SOU" "KIN SAC"');
    return { wide, narrow };
  });

  await test('Only currently revealed cards appear in the lookup and face-up board tiles open', async a => {
    a.ev(`G_STATE.targetRow=[{id:'A1',revealed:false},{id:'A2',revealed:true,removed:true}];G_STATE.zones.SAC.event=1;renderBoard(G_STATE);`);
    const publicTile = a.q('.tcard.rev'), hiddenTile = a.q('.tcard.back'); assert.equal(hiddenTile.tagName,'DIV');
    assert(!hiddenTile.outerHTML.includes('A1')); assert.equal(publicTile.tagName,'BUTTON'); assert.match(publicTile.textContent,/Removed/);
    publicTile.click(); assert.match(a.q('#modal .tgt').textContent,/Target Card A2/); a.click('Close',a.q('#modal'));
    const event = a.q('#lake button.tag.ev'); assert(event); event.click(); assert.match(a.q('#modal .evcard').textContent,/Event #1/); a.click('Close',a.q('#modal'));
    const before = a.snap(); a.click('Reference'); const pick = a.q('#modal select'); a.change(pick,[...pick.options].find(o=>o.textContent==='Revealed cards').value);
    const menu = a.q('.ref-topic select'); assert.equal(menu.options.length,2); assert(!menu.textContent.includes('A1'));
    a.change(menu,'1'); assert.match(a.q('#modal .evcard').textContent,/Event #1/); a.click('Close',a.q('#modal')); assert.equal(a.snap(),before);
    return { hidden: 'A1', revealed: ['A2','Event #1'] };
  });

  await test('Editing a custom package threshold survives a hand tick without altering saved preferences', async a => {
    a.ev(`G_STATE.prompt={id:12344,kind:'select',title:'Package #4',pkg:4,items:['madison','oneida','asp','hamilton'].map(id=>({id,label:id}))};renderProc(G_STATE)`);
    const type = a.q('#proc .banner select'), n = a.q('#proc .banner input[type=number]'), remember = a.q('#proc .banner input[type=checkbox]');
    a.change(type,'ships'); a.change(n,'2'); remember.click(); a.q('.sel-list input').click();
    assert.equal(a.q('#proc .banner select').value,'ships'); assert.equal(a.q('#proc .banner input[type=number]').value,'2');
    assert.equal(a.q('#proc .banner input[type=checkbox]').checked,false);
    a.click('Auto-fill'); assert.equal(a.ev('UI.local.sel.length'),2);
    assert.equal(a.w.localStorage.getItem('agc_pkg_memory_v1'),null);
    return { criterion:'ships', threshold:2, remember:false };
  });

  const f = process.argv.find(arg => arg.startsWith('--package='));
  if (f) await test('Printed suggestion for B35 selects a legal union and Patrol split without rolling', async a => {
    a.load(JSON.parse(fs.readFileSync(f.slice('--package='.length))));
    const selection = () => JSON.parse(a.ev('JSON.stringify(UI.local.sel)'));
    const before = a.ev('JSON.stringify([G_STATE,UNDO])');
    a.click('Use suggested ships'); assert.equal(selection().length,13); assert(selection().includes('pike')); assert(!selection().includes('lady'));
    assert.equal(a.ev('JSON.stringify([G_STATE,UNDO])'),before); assert.equal(a.d.activeElement.textContent,'Use suggested ships');
    a.click('Confirm'); const rng = a.ev('G_STATE.rng');
    a.click('Use suggested ships'); assert.equal(selection().length,12); assert(!selection().includes('pike'));
    assert.match(a.q('#proc .banner').textContent,/Patrol: 22 Long Gun.*Army Support: 9 Close Action/);
    assert.equal(a.ev('G_STATE.rng'),rng); assert(!a.button('Confirm',a.q('#proc')).disabled);
    return { seed:871004, card:'B35', union:13, patrol:12, support:'Pike' };
  }, false);
  if (errors.length) results.push({ name: 'DOM runtime errors', pass:false, errors });
  const failures = results.filter(r=>!r.pass).length;
  console.log(JSON.stringify({ resultCount:results.length, failures, results },null,2));
  if (failures && !process.argv.includes('--observe')) process.exitCode=1;
})().catch(e=>{ console.error(e); process.exitCode=1; });
