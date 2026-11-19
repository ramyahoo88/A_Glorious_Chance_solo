// Shipped HTML and real control handlers in jsdom; not a visual-browser test.
// These fixtures preserve the audit's original natural and damaged positions.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const fixtures = path.join(root, 'audits/2026-11-19-v0.2.12-reaudit/evidence/targeted');
const fixture = name => {
  const raw = JSON.parse(fs.readFileSync(path.join(fixtures, name + '.json')));
  return raw.state || raw;
};
const key = 'agc_solo_companion_v1', errors = [];
let passed = 0;
function check(name, actual, expected) { assert.deepEqual(actual, expected, name); passed++; }
async function page(saved) {
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://agc-test.invalid/', runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w) { if (saved) w.localStorage.setItem(key, saved); } });
  const w = dom.window, d = w.document;
  await new Promise(r => w.addEventListener('load', r, { once: true }));
  const x = code => w.eval(code), state = () => JSON.parse(x('JSON.stringify(G_STATE)'));
  const click = (label, scope = d) => {
    const b = [...scope.querySelectorAll('button')].find(b => b.textContent === label);
    assert(b && !b.disabled, label); b.click();
  };
  const change = (e, v) => {
    assert(e); e.value = String(v);
    for (const type of ['input', 'change']) e.dispatchEvent(new w.Event(type, { bubbles: true }));
  };
  const snap = () => JSON.stringify({ state: state(), undo: x('JSON.stringify(UNDO)'),
    draft: x('JSON.stringify(UI.local)'), disk: w.localStorage.getItem(key) });
  const load = s => {
    click(state() ? 'Load' : 'Load a saved game');
    change(d.querySelector('#modal textarea'), JSON.stringify({ state: s, undo: [] }));
    click('Load pasted text');
  };
  return { w, d, x, state, click, change, snap, load };
}
function untowed(p) {
  const text = p.d.querySelector('#proc').textContent;
  const m = text.match(/(\d+) untowed Laker Schooner/);
  return m ? Number(m[1]) : text.includes('No untowed Laker Schooners') ? 0 : null;
}
(async () => {
  {
    const p = await page();
    for (const [name, n] of [['missed-tower', 8], ['tow-preview', 8]]) {
      p.load(fixture(name));
      check(name + ': preview counts the actual first-round schooners', untowed(p), n);
      check(name + ': corrected threshold', p.d.querySelector('#proc').textContent.includes('≤ 4 gives −2'), true);
      const before = p.snap();
      p.x('renderProc(G_STATE); renderBoard(G_STATE);');
      check(name + ': preview does not change position, dice, draft, Undo or disk', p.snap(), before);
    }
    p.load(fixture('missed-tower'));
    p.click('Attack with these ships');
    const pursuit = [...p.d.querySelectorAll('#proc .optcard')].find(b => b.textContent.startsWith('Pursuit'));
    assert(pursuit, 'Pursuit Tactic'); pursuit.click(); p.click('Continue');
    check('Natural missing-tower combat result agrees with preview', /8 untowed Laker Schooners: d6/.test(p.d.querySelector('#proc').textContent), true);
    p.load(fixture('tow-preview'));
    const normal = fixture('missed-tower');
    normal.zones[normal.encounter.zone].flags.missedSignalUsed = true;
    p.load(normal);
    check('Spent Missed Signal leaves the ordinary tow intact', untowed(p), 7);
    const noEvent = fixture('missed-tower');
    delete noEvent.zones[noEvent.encounter.zone].flags.missedSignal;
    p.load(noEvent);
    check('Normal adjacent tow excludes its schooner', untowed(p), 7);
    p.d.querySelector('#lineup-madison').click();
    check('Deselecting the tower leaves its schooner untowed', untowed(p), 8);
    p.d.querySelector('#lineup-madison').click();
    p.change(p.d.querySelector('#lineup-tow-madison'), 'tompkins');
    p.d.querySelector('#lineup-tompkins').click();
    check('Deselecting the schooner removes it from the preview', untowed(p), 7);
    p.load(fixture('missed-tower'));
    p.change(p.d.querySelector('#lineup-tow-madison'), '');
    check('Clearing a sitting-out tower\'s tow leaves the same eight participants', untowed(p), 8);
    const rainy = fixture('missed-tower');
    rainy.zones[rainy.encounter.zone].flags.rainy = true;
    p.load(rainy);
    check('Rainy Squalls omits the Gunnery-only penalty preview', untowed(p), null);
    p.load(noEvent);
    for (const cb of [...p.d.querySelectorAll('#proc input[type=checkbox]')]) {
      if (cb.checked && cb.isConnected) cb.click();
    }
    // Every selection rebuilds its controls; clear the remaining checked inputs.
    while (p.d.querySelector('#proc input[type=checkbox]:checked')) p.d.querySelector('#proc input[type=checkbox]:checked').click();
    p.d.querySelector('#lineup-madison').click(); p.d.querySelector('#lineup-tompkins').click();
    p.change(p.d.querySelector('#lineup-tow-madison'), 'tompkins');
    check('A fully towed attacking pair has no penalty', untowed(p), 0);
    p.w.close();
  }
  {
    const p = await page(); p.load(fixture('valid-control'));
    p.click('June I (this turn)');
    check('A valid initial empty locals object imports and advances', p.x('UI.err'), '');
    for (const name of ['missed-tower', 'tow-preview', 'zero-strength-chip']) {
      p.load(fixture(name));
      check(name + ': valid populated locals accepted', p.d.querySelector('#modal').classList.contains('open'), false);
    }
    const mutations = [
      ['missing', f => delete f.L], ['null', f => f.L = null], ['array', f => f.L = []],
      ['string', f => f.L = 'damaged'], ['number', f => f.L = 1]
    ];
    for (const depth of [0, 1, 2]) for (const [name, mutate] of mutations) {
      const s = fixture('missed-tower'); mutate(s.calls[depth]); const before = p.snap();
      p.load(s);
      check(name + ' locals at depth ' + depth + ': import refused atomically', p.snap(), before);
      check(name + ' locals at depth ' + depth + ': useful explanation', /damaged or incomplete \(procedure locals\)/.test(p.d.querySelector('#modal .err').textContent), true);
      p.click('Close');
    }
    for (const name of ['missing-frame-locals', 'null-frame-locals']) {
      const before = p.snap(); p.load(fixture(name));
      check(name + ': original audit file rejected without replacing the game', p.snap(), before); p.click('Close');
    }
    const before = p.snap(); p.load(fixture('unknown-event'));
    check('Existing unknown-Event validation remains atomic', p.snap(), before); p.click('Close');
    p.w.close();
    const saved = JSON.stringify({ state: fixture('valid-control'), undo: [] });
    const setup = await page(saved), setupBefore = setup.snap();
    setup.load(fixture('missing-frame-locals'));
    check('Setup import refuses missing locals and preserves the existing autosave', setup.snap(), setupBefore);
    setup.w.close();
  }
  {
    const p = await page(); p.load(fixture('zero-strength-chip'));
    const chip = [...p.d.querySelectorAll('button.ship')].find(c => c.getAttribute('aria-label').startsWith('Inspect Sir Sidney Smith'));
    assert(chip);
    check('Natural zero-step ship displays the warning', chip.querySelector('.no-steps').textContent, 'No Steps – combat strengths 0');
    check('Zero-step warning is included in the accessible name', chip.getAttribute('aria-label').includes('No Steps – combat strengths 0'), true);
    check('Printed Reduced strength remains visible as a reference', chip.querySelector('.st').textContent.includes('0·1·2·0'), true);
    const before = p.snap(); chip.click();
    check('Details keep the printed-strength caption', p.d.querySelector('#modal caption').textContent, 'Printed counter strengths');
    check('Inspecting the zero-step ship is read-only', p.snap(), before); p.click('Close');
    for (const status of ['dis', 'struck', 'sunk', 'wd']) {
      const s = fixture('zero-strength-chip'); s.encounter.ships.sss = status; p.load(s);
      check(status + ': disengaged or removed ship has no engaged warning', p.d.querySelectorAll('.ship .no-steps').length, 0);
    }
    const restored = fixture('zero-strength-chip'); restored.ships.sss.steps = 1; p.load(restored);
    check('A ship with a step remaining has no No Steps warning', p.d.querySelectorAll('.ship .no-steps').length, 0);
    p.w.close();
  }
  {
    const p = await page(); p.load(fixture('missed-tower')); const before = p.snap(); p.click('Adjust');
    const controls = ['Ship to correct', 'Destination box', 'Ship steps', 'Ship owner'].map(name => p.d.querySelector(`#modal [aria-label="${name}"]`));
    check('All four ship-correction fields have distinct accessible names', controls.every(Boolean), true);
    p.change(controls[0], 'madison');
    check('Selecting a locked ship explains the Encounter guard', /active Encounter/.test(p.d.querySelector('#ship-correction-notice').textContent), true);
    p.change(controls[1], 'outOfPlay'); p.click('Apply');
    check('Named fields retain the safe Encounter rejection', p.snap(), before);
    check('Refusal still explains the locked lineup', /lineup|Encounter/.test(p.d.querySelector('#modal .err').textContent), true);
    p.click('Close'); p.load(fixture('valid-control')); p.click('Adjust');
    p.change(p.d.querySelector('[aria-label="Ship to correct"]'), 'madison');
    const steps = p.state().ships.madison.steps;
    p.change(p.d.querySelector('[aria-label="Ship steps"]'), steps - 1); p.click('Apply'); p.click('Close');
    check('A legal steps correction still applies', p.state().ships.madison.steps, steps - 1);
    p.click('↶ Undo'); check('A legal correction is still undoable', p.state().ships.madison.steps, steps);
    p.w.close();
  }
  check('No DOM or control errors', errors, []);
  console.log(`v0.2.13 audit fixes: ${passed} assertions passed.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
