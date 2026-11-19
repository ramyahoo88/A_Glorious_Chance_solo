const legacyEventFixture = require('./legacy_events');
/* Current-game persistence and adjustment regressions, against shipped HTML.
   Requires jsdom, supplied through NODE_PATH. This checks DOM handlers, not layout.
   node tests/browser/persistence_v029.js [repo] [--require-fixed]
*/
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const strict = process.argv.includes('--require-fixed');
const html = legacyEventFixture(fs.readFileSync(path.join(repo, 'dist/index.html'), 'utf8'));
const results = [];
function check(name, ok, detail) { results.push({ name, pass: !!ok, detail }); }
async function launch(saved) {
  const vc = new VirtualConsole(), errors = [];
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://persistence-audit.invalid/', runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w) { if (saved) w.localStorage.setItem('agc_solo_companion_v1', saved); } });
  await new Promise(r => dom.window.addEventListener('load', r));
  const w = dom.window, d = w.document;
  const read = code => w.eval(code);
  const state = () => read('JSON.stringify(G_STATE)');
  const stored = () => w.localStorage.getItem('agc_solo_companion_v1');
  const button = (label, scope = d) => { const b = [...scope.querySelectorAll('button')].find(x => x.textContent === label); assert(b, label); assert(!b.disabled, label); b.click(); return b; };
  const change = (el, value) => { assert(el); el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const start = seed => { change(d.querySelector('input[type=number]'), String(seed)); button('Start campaign'); };
  const load = text => { button('Load'); change(d.querySelector('#modal textarea'), text); button('Load pasted text', d.querySelector('#modal')); };
  return { dom, w, d, read, state, stored, button, change, start, load, errors };
}
(async () => {
  for (const value of ['1.5', '', '-1', '99', '1e309']) {
    const t = await launch(); t.start(290001); const before = t.state(), beforeStore = t.stored(), beforeUndo = t.read('JSON.stringify(UNDO)');
    t.button('Adjust'); t.change(t.d.querySelector('#modal input[min="0"]'), value); t.button('Apply', t.d.querySelector('#modal'));
    check(`Invalid ship steps ${JSON.stringify(value)} leave state, dice, history and autosave unchanged`, t.state() === before && t.stored() === beforeStore && t.read('JSON.stringify(UNDO)') === beforeUndo,
      { steps: t.read('G_STATE.ships.wolfe.steps'), message: t.d.querySelector('#modal .err')?.textContent || '' });
    check(`Invalid ship steps ${JSON.stringify(value)} have an explanation`, /whole number/.test(t.d.querySelector('#modal .err')?.textContent || ''));
    t.dom.window.close();
  }
  const n = await launch(); n.start(290002); let before = n.state(), previousStore = n.stored(); n.button('Adjust');
  const vp = [...n.d.querySelectorAll('#modal label')].find(x => x.textContent.startsWith('U.S. VP'));
  n.change(vp.querySelector('input'), '2.5'); n.button('Set', vp);
  check('Fractional VP adjustment is atomic and explains the error', n.state() === before && n.stored() === previousStore && /whole number/.test(n.d.querySelector('#modal .err')?.textContent || ''));
  n.dom.window.close();

  for (const value of [0, 1, 3]) {
    const t = await launch(); t.start(290003);
    if (t.read('G_STATE.ships.wolfe.steps') === value) {
      t.button('Adjust'); t.change(t.d.querySelector('#modal input[min="0"]'), '2'); t.button('Apply', t.d.querySelector('#modal')); t.button('Close', t.d.querySelector('#modal'));
    }
    before = t.state(); t.button('Adjust');
    t.change(t.d.querySelector('#modal input[min="0"]'), String(value)); t.button('Apply', t.d.querySelector('#modal')); t.button('Close', t.d.querySelector('#modal'));
    const changed = t.state();
    check(`Valid ship steps ${value} apply`, t.read('G_STATE.ships.wolfe.steps') === value);
    const re = await launch(t.stored()); re.button('Continue it');
    check(`Valid ship steps ${value} survive current autosave reload`, re.state() === changed);
    re.button('↶ Undo'); check(`Valid ship steps ${value} Undo restores exact prior position after reload`, re.state() === before);
    t.dom.window.close(); re.dom.window.close();
  }
  // Every loaded malformed current state must leave the old state/history and stored bytes intact.
  for (const kind of ['emptyStack', 'nullPrompt', 'badPc', 'excessSteps', 'excessSupply']) {
    const t = await launch(); t.start(290004); t.button('June I (this turn)'); before = t.state(); previousStore = t.stored(); const previousUndo = t.read('JSON.stringify(UNDO)');
    const bad = JSON.parse(before);
    if (kind === 'emptyStack') { bad.calls = []; bad.prompt = null; }
    if (kind === 'nullPrompt') bad.prompt = null;
    if (kind === 'badPc') bad.calls.at(-1).pc = '__invalid_handler__';
    if (kind === 'excessSteps') bad.ships.wolfe.steps = 99;
    if (kind === 'excessSupply') bad.supply.US = 99;
    t.load(JSON.stringify({ state: bad, undo: [] }));
    check(`Current save ${kind} is refused atomically`, t.state() === before && t.stored() === previousStore && t.read('JSON.stringify(UNDO)') === previousUndo,
      { message: t.d.querySelector('#modal').textContent });
    t.dom.window.close();
  }
  const a = await launch(); a.start(290005); const incoming = a.read('saveText()'); a.dom.window.close();
  const b = await launch(); b.start(290006); before = b.state(); previousStore = b.stored();
  b.read("Storage.prototype.setItem = function () { throw new Error('simulated storage refusal'); }");
  b.load(incoming);
  check('Successful import immediately reports an autosave refusal', b.read('G_STATE.seed') === 290005 && b.d.querySelector('#hdr').textContent.includes('Not autosaved'));
  check('Failed autosave preserves previous stored game', b.stored() === previousStore);
  b.button('↶ Undo'); check('Import Undo still restores previous game when storage refuses writes', b.state() === before);
  b.dom.window.close();

  for (const label of [/Pause after each A\.I\. move|Show individual Target Card/, /Pick American Force Package ships myself/, /Read the Land Battle Table myself/]) {
    const settings = await launch(); settings.start(290011); previousStore = settings.stored();
    settings.read("Storage.prototype.setItem = function () { throw new Error('simulated storage refusal'); }");
    settings.button('Settings'); const field = [...settings.d.querySelectorAll('#modal label')].find(l => label.test(l.textContent)); field.querySelector('input').click();
    check(`Settings ${label} immediately reports storage refusal`, settings.d.querySelector('#hdr').textContent.includes('Not autosaved') && settings.stored() === previousStore);
    settings.dom.window.close();
  }

  const c = await launch(); c.start(290007); before = c.state(); c.button('June I (this turn)'); const prior = c.state(), priorUndo = c.read('JSON.stringify(UNDO)');
  c.load(incoming); c.button('↶ Undo'); check('Undo a current import restores previous state and its history', c.state() === prior && c.read('JSON.stringify(UNDO)') === priorUndo);
  c.button('↶ Undo'); check('Previous game remains undoable after undoing an import', c.state() === before);
  c.dom.window.close();

  const d = await launch(); d.start(290008); const original = d.stored(); d.dom.window.close();
  const setup = await launch(original); check('Reload setup does not write over autosave', setup.stored() === original && setup.state() === 'null');
  setup.change(setup.d.querySelector('input[type=number]'), '290009'); setup.button('Start campaign');
  const modalOpen = setup.d.querySelector('#modal').classList.contains('open');
  check('Replacing a saved game from setup asks first', modalOpen && setup.state() === 'null' && setup.stored() === original);
  if (modalOpen) {
    setup.button('Cancel', setup.d.querySelector('#modal')); check('Cancel replacement preserves saved position', setup.state() === 'null' && setup.stored() === original);
    setup.button('Start campaign'); setup.button('Start new campaign', setup.d.querySelector('#modal'));
    check('Confirmed replacement starts chosen seed and clears history', setup.read('G_STATE.seed') === 290009 && setup.read('UNDO.length') === 0 && setup.stored() !== original);
  } else { check('Cancel replacement preserves saved position', false, 'No replacement dialog'); check('Confirmed replacement starts chosen seed and clears history', false, 'No replacement dialog'); }
  setup.dom.window.close();

  const file = await launch(); file.start(290010); file.w.URL.createObjectURL = () => 'blob:audit'; let filename;
  file.w.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  file.button('Save'); file.button('Download .json', file.d.querySelector('#modal'));
  check('Save filename identifies side, turn, seed and decision', filename === 'agc-US-JuneI-seed290010-step1.json', filename);
  file.dom.window.close();
  const failures = results.filter(r => !r.pass);
  console.log(JSON.stringify({ checks: results.length, failures: failures.length, results }, null, 2));
  if (strict && failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
