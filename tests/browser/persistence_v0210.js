/* Exercise the shipped page and its controls. NODE_PATH must provide jsdom.
   node tests/browser/persistence_v0210.js [repository or HTML file] [--require-fixed] */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');

const target = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const html = fs.readFileSync(fs.statSync(target).isDirectory() ? path.join(target, 'dist/index.html') : target, 'utf8');
const key = 'agc_solo_companion_v1';
const results = [];
const windows = [];
function check(name, pass, observed) { results.push({ name, pass: !!pass, observed }); }
async function group(name, test) {
  try { await test(); }
  catch (e) { check(name + ' could finish', false, e.message); }
  finally { while (windows.length) windows.pop().close(); }
}
async function page(raw) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://agc-test.invalid/', runScripts: 'dangerously', virtualConsole,
    beforeParse(w) { if (raw !== undefined) w.localStorage.setItem(key, raw); }
  });
  const w = dom.window, d = w.document;
  windows.push(w);
  await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
  const modal = d.querySelector('#modal');
  const evaluate = code => w.eval(code);
  const json = () => evaluate('JSON.stringify(G_STATE)');
  const state = () => JSON.parse(json());
  const history = () => JSON.parse(evaluate('JSON.stringify(UNDO)'));
  const stored = () => w.localStorage.getItem(key);
  const find = (text, scope = d) => [...scope.querySelectorAll('button')].find(b => b.textContent === text);
  const click = (text, scope = d) => { const b = find(text, scope); assert(b && !b.disabled, 'Button unavailable: ' + text); b.click(); };
  const change = (field, value) => {
    assert(field); field.value = String(value);
    field.dispatchEvent(new w.Event('input', { bubbles: true }));
    field.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const enter = seed => { change(d.querySelector('.setup input[type=number]'), seed); click('Start campaign'); };
  const paste = text => { change(modal.querySelector('textarea'), text); click('Load pasted text', modal); };
  const field = name => [...modal.querySelectorAll('label')].find(l => l.textContent.startsWith(name));
  const correction = (name, value) => { const label = field(name); change(label.querySelector('input'), value); click('Set', label); };
  const error = () => modal.querySelector('.err')?.textContent || '';
  return { w, d, modal, json, state, history, stored, find, click, change, enter, paste, field, correction, error, errors };
}
function firstChoice(p) { const first = p.d.querySelector('#proc .opts button:not([disabled])'); assert(first); first.click(); }
function advance(p) {
  const pr = p.state().prompt, proc = p.d.querySelector('#proc');
  if (pr.kind === 'info') p.click('Continue', proc);
  else if (pr.kind === 'choice') {
    const option = pr.options.find(o => !o.disabled); assert(option);
    const buttons = [...proc.querySelectorAll('.opts button, .optcard')].filter(b => !b.disabled);
    const chosen = buttons.find(b => b.textContent === option.label || b.querySelector('.t')?.textContent === option.label);
    assert(chosen, pr.title); chosen.click();
  } else if (pr.kind === 'select') p.click('Confirm', proc);
  else if (pr.kind === 'assign') {
    p.click('Confirm assignments', proc);
    if (p.modal.classList.contains('open')) { const confirm = p.modal.querySelector('.primary'); assert(confirm); confirm.click(); }
  } else { const b = proc.querySelector('button.primary:not([disabled])'); assert(b, pr.title); b.click(); }
}
function installReader(p) {
  const reads = [];
  p.w.FileReader = class { readAsText(file) { this.file = file; reads.push(this); } };
  return {
    choose(name) {
      const input = p.modal.querySelector('input[type=file]');
      Object.defineProperty(input, 'files', { configurable: true, value: [new p.w.File(['{}'], name + '.json')] });
      input.dispatchEvent(new p.w.Event('change', { bubbles: true }));
      return reads.at(-1);
    },
    finish(reader, text) { reader.result = text; reader.onload(); }
  };
}
function supplyCounts(p) {
  const s = p.state(), t = s.troops[s.human];
  return { stock: t.available + t.track.length, available: t.available, track: t.track };
}
function capStorage(p, limit) {
  p.w.cap = limit;
  p.w.eval("window.persistRaw = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (v.length > window.cap) throw new DOMException('test quota', 'QuotaExceededError'); window.persistRaw.call(this, k, v); };");
}

(async () => {
  let other, third;
  await group('Setup', async () => {
    const p = await page(); p.enter(621002); other = p.json();
    const q = await page(); q.enter(621003); third = q.json();
  });
  for (const bad of ['empty choice', 'all disabled', 'Continue lacks ok', 'impossible selection', 'fourth human marker', 'Niagara off track']) {
    await group(bad, async () => {
      const p = await page(); p.enter(621001); const before = p.json(), disk = p.stored(), incoming = JSON.parse(other);
      const pr = incoming.prompt;
      if (bad === 'empty choice') pr.options = [];
      if (bad === 'all disabled') pr.options.forEach(o => { o.disabled = true; });
      if (bad === 'Continue lacks ok') { pr.kind = 'info'; delete pr.options; }
      if (bad === 'impossible selection') Object.assign(pr, { kind: 'select', items: [], min: 1, max: 1 });
      if (bad === 'fourth human marker') incoming.troops[incoming.human].available++;
      if (bad === 'Niagara off track') incoming.niagara = 7;
      p.click('Load'); p.paste(JSON.stringify(incoming));
      check('Reject ' + bad + ' before replacing state, history or autosave', p.json() === before && !p.history().length && p.stored() === disk && !!p.error(), { seed: p.state().seed, error: p.error() });
    });
  }
  await group('Draft and file reads', async () => {
    const p = await page(); p.enter(621001); const before = p.json();
    p.click('Load'); p.change(p.modal.querySelector('textarea'), other); p.modal.click(); p.click('Load');
    check('Backdrop dismissal retains an unsubmitted paste on reopening', p.modal.querySelector('textarea').value === other && p.json() === before);
    p.change(p.modal.querySelector('textarea'), third);
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    p.click('Load'); check('Escape dismissal retains the latest edit', p.modal.querySelector('textarea').value === third && p.json() === before);
    const reader = installReader(p), a = reader.choose('A');
    p.click('Close', p.modal); firstChoice(p); const played = p.json(), disk = p.stored(); reader.finish(a, other);
    check('A closed file picker cannot overwrite a subsequent move', p.json() === played && p.stored() === disk, { seed: p.state().seed });
    p.click('Load'); const b = reader.choose('B'), c = reader.choose('C'); reader.finish(c, third); const loaded = p.json(); reader.finish(b, other);
    check('The latest file selection wins when reads finish in reverse order', p.json() === loaded && p.state().seed === 621003, { seed: p.state().seed });
    p.click('Load');
    check('Successful file import clears any pending paste', p.modal.querySelector('textarea').value === '');
    const d = reader.choose('D'); if (d.onerror) d.onerror();
    check('A failed file read offers retry or paste and retains the current game', p.state().seed === 621003 && /choose it again|paste/i.test(p.error()), p.error());
    const race = reader.choose('file'); p.change(p.modal.querySelector('textarea'), other); const unchanged = p.json(); reader.finish(race, third);
    check('Editing a pasted alternative cancels an outstanding file read', p.json() === unchanged && p.modal.classList.contains('open') && p.modal.querySelector('textarea').value === other);
  });
  await group('Autosave history', async () => {
    const p = await page(); p.enter(621001);
    const expected = [];
    for (let i = 0; i < 64; i++) { expected.push(p.json()); advance(p); assert(p.json() !== expected.at(-1), 'move did not advance at ' + i); }
    const stored = p.stored(), before = p.json(), newest = expected.slice(-60);
    check('Normal play retains the 60 newest exact in-memory decisions', JSON.stringify(p.history()) === JSON.stringify(newest),
      { seed: p.state().seed, actions: expected.length, finalResult: p.state().result });
    const re = await page(stored); re.click(p.state().over ? 'Review it' : 'Continue it');
    check('Reload retains all 60 exact position strings', JSON.stringify(re.history()) === JSON.stringify(newest) && re.json() === before,
      { recovered: re.history().length, autosaveUtf8Bytes: Buffer.byteLength(stored), raw60Utf8Bytes: Buffer.byteLength(JSON.stringify({ state: p.state(), undo: newest })) });
    let exact = 0;
    while (re.history().length && exact < 60) {
      re.click('↶ Undo');
      if (re.json() !== newest[newest.length - exact - 1]) break;
      exact++;
    }
    check('Every recovered Undo button restores that exact earlier game, including dice', exact === 60, { exact });
    capStorage(p, p.json().length * 4);
    p.click('Adjust'); p.correction('U.S. VP', p.state().vp.US + 1); p.click('Close', p.modal);
    const partial = await page(p.stored()); partial.click(p.state().over ? 'Review it' : 'Continue it');
    const count = partial.history().length;
    check('Intermediate quota retains the latest fitting Undo positions in order and discloses that depth',
      count > 0 && count < p.history().length && partial.json() === p.json() && JSON.stringify(partial.history()) === JSON.stringify(p.history().slice(-count)) &&
      p.d.querySelector('#hdr').textContent.includes('after reload: ' + count + '.'), { count, quotaChars: p.w.cap });
  });
  await group('Adjustment cap and quota', async () => {
    const p = await page(); p.enter(621001); p.click('Adjust');
    for (let v = 1; v <= 65; v++) p.correction('U.S. VP', v);
    check('65 accepted manual corrections honor the same 60-step limit', p.history().length === 60, p.history().length);
    p.click('Close', p.modal);
    const cap = p.json().length + 1500;
    capStorage(p, cap);
    firstChoice(p);
    const disk = p.stored(), current = p.json(), hdr = p.d.querySelector('#hdr').textContent;
    check('If space permits only the current state, the accepted move autosaves and the header explains reload depth', JSON.stringify(JSON.parse(disk).state) === current && /Undo steps available after reload: 0/.test(hdr) && p.history().length === 60, { header: hdr.match(/Autosaved.{0,85}|Not autosaved.{0,85}/)?.[0] });
    const recovered = await page(disk); recovered.click('Continue it');
    check('The quota-limited reload restores the latest move', recovered.json() === current && recovered.history().length === 0);
    p.w.cap = 5; advance(p);
    check('If even the current state cannot fit, the last successful copy survives and the header warns', p.stored() === disk && p.d.querySelector('#hdr').textContent.includes('Not autosaved'));
  });
  await group('Corrupt prior position', async () => {
    const p = await page(); p.enter(621001); const first = p.json(); firstChoice(p); const live = p.state();
    const re = await page(JSON.stringify({ state: live, undo: [first, '{corrupt'] })); re.click('Continue it'); re.click('↶ Undo');
    check('One Undo skips a damaged history entry and restores the nearest usable position', re.json() === first && re.history().length === 0 && /skipped/i.test(re.d.querySelector('#proc').textContent) && !re.errors.length, { seed: re.state()?.seed, errors: re.errors });
    const raw = '{truncated';
    const broken = await page(raw);
    check('Truncated autosave is disclosed at startup and preserved until explicit replacement', broken.stored() === raw && /could not be read/i.test(broken.d.querySelector('.setup').textContent));
    broken.click('Start campaign');
    check('Unreadable autosave still requires confirmation before replacement', broken.modal.classList.contains('open') && broken.stored() === raw);
  });
  await group('Manual tracks', async () => {
    const p = await page(); p.enter(621001); p.click('Adjust');
    for (const [name, value] of [['U.S. Convoy Supply', 13], ['British Convoy Supply', -2], ['U.S. Construction Delay', -1], ['Niagara Front', 7]]) {
      const before = p.json(), disk = p.stored(), depth = p.history().length;
      p.correction(name, value);
      check(name + ' refuses ' + value + ' without changing game, log, Undo or disk', before === p.json() && disk === p.stored() && depth === p.history().length && !!p.error(),
        { message: p.error(), lastLog: p.state().log.at(-1).text });
    }
    const sign = p.field('British VP').textContent;
    check('British VP input explains its sign in the Game Score', /positive.*reduce|subtract/i.test(sign), sign);
    p.correction('U.S. Convoy Supply', -1); p.correction('British Convoy Supply', 12);
    check('Both actual Convoy Supply endpoints remain editable', p.state().supply.US === -1 && p.state().supply.BR === 12);
    const before = p.json(), depth = p.history().length, disk = p.stored();
    p.click('Apply', p.modal);
    check('Unchanged ship Apply preserves state, Undo depth and autosave bytes', before === p.json() && depth === p.history().length && disk === p.stored());
  });
  await group('Physical markers and assignment draft', async () => {
    const p = await page(); p.enter(621001);
    for (let i = 0; i < 25 && p.state().prompt.kind !== 'assign'; i++) advance(p);
    assert.equal(p.state().prompt.kind, 'assign'); const start = p.json(), original = supplyCounts(p);
    p.click('Adjust'); const scalar = p.field('Your Available Troops'), tracked = original.track[0];
    if (scalar) p.correction('Your Available Troops', 4);
    else {
      const select = p.modal.querySelector('select[aria-label="Move one Troops marker"]'); p.change(select, tracked); p.click('Move marker', p.modal);
    }
    p.click('Close', p.modal); const changed = supplyCounts(p);
    check('A7 moves one named marker from track to Available and refreshes the legal Army Support preview',
      changed.stock === original.stock && changed.available === original.available + 1 && !changed.track.includes(tracked) && p.state().prompt.troops === changed.available && p.state().prompt.missions.ArmySupport,
      { original, changed, prompt: p.state().prompt.troops });
    p.click('↶ Undo');
    check('Undo restores both the A7 prompt and the physical marker distribution', p.json() === start);
    p.click('+ Add Force'); const draft = p.d.querySelector('#proc .asg-force')?.textContent, disk = p.stored(), depth = p.history().length;
    const broken = JSON.parse(other); broken.log = [null];
    p.click('Load'); p.paste(JSON.stringify(broken));
    const message = p.error(); p.click('Close', p.modal);
    check('A rejected import preserves a partly entered A7 Force as well as the game, Undo and disk',
      draft && p.d.querySelector('#proc .asg-force')?.textContent === draft && p.json() === start && p.stored() === disk && p.history().length === depth && message.length, message);
  });
  await group('Public board corrections', async () => {
    const p = await page(); p.enter(621001); const start = p.json();
    p.click('Adjust'); let zone = p.modal.querySelector('[aria-label="Lake Control zone"]');
    if (zone) {
      p.change(zone, 'NOR'); p.change(p.modal.querySelector('[aria-label="Lake Control owner"]'), 'BR'); p.click('Set Lake Control', p.modal);
      p.click('Close', p.modal);
      check('Preparation Lake Control correction changes one public marker and leaves dice/score intact',
        p.state().zones.NOR.control === 'BR' && p.state().rng === JSON.parse(start).rng && p.state().vp.BR === 0 && /Manual adjustment/.test(p.state().log.at(-1).text));
      p.click('↶ Undo'); check('Lake Control Undo restores the exact position', p.json() === start);
    } else { check('Preparation Lake Control correction is available', false); p.click('Close', p.modal); }
    const blocked = JSON.parse(start); blocked.zones.SAC.control = 'BR'; blocked.zones.SAC.blockade = 'BR';
    p.click('Load'); p.paste(JSON.stringify(blocked)); p.click('Adjust');
    zone = p.modal.querySelector('[aria-label="Lake Control zone"]'); const old = p.json(), disk = p.stored();
    if (zone) { p.change(zone, 'SAC'); p.change(p.modal.querySelector('[aria-label="Lake Control owner"]'), 'US'); p.click('Set Lake Control', p.modal); }
    check('Lake Control cannot invalidate an active Blockade marker', zone && /Blockade/.test(p.error()) && p.json() === old && p.stored() === disk);
    p.click('Close', p.modal); p.click('↶ Undo');
    for (let i = 0; i < 25 && p.state().prompt.kind !== 'assign'; i++) advance(p);
    const current = p.state(), oldJson = p.json(), pick = current.prompt.flagshipOptions.find(id => id !== current.flagship[current.human]);
    p.click('Adjust'); const flag = p.modal.querySelector('[aria-label="Eligible Flagship at A7"]');
    if (flag) {
      check('Flagship picker contains exactly the A7 eligible ships', JSON.stringify([...flag.options].map(o => o.value)) === JSON.stringify(current.prompt.flagshipOptions));
      p.change(flag, pick); p.click('Set Flagship', p.modal); p.click('Close', p.modal);
      const applied = p.state(), visibleFlag = p.d.querySelector('#proc select').value;
      check('Flagship correction updates both the board and the live A7 draft', applied.flagship[applied.human] === pick && applied.prompt.flagship === pick && visibleFlag === pick, pick);
      p.click('↶ Undo'); check('Flagship correction undoes exactly', p.json() === oldJson);
    } else check('Flagship correction is available at A7', false);
  });
  for (const situation of ['lineup', 'reaction']) {
    await group('Adjust during ' + situation, async () => {
      const p = await page(); p.enter(621001); p.click('Load');
      p.paste(fs.readFileSync(path.join(__dirname, 'fixtures', 'adjust-open-' + situation + '.json'), 'utf8'));
      const original = p.state(), pr = original.prompt, id = situation === 'lineup' ? pr.candidates[0] : pr.items[0].id;
      const box = p.d.querySelector('#proc input[type=checkbox]'); if (box) box.click();
      const selected = () => [...p.d.querySelectorAll('#proc input[type=checkbox]')].map(b => b.checked).join(',');
      const draft = selected(), before = p.json(), disk = p.stored(), oldUndo = p.history().length;
      p.click('Adjust');
      const [ship, destination] = p.modal.querySelectorAll('select');
      p.change(ship, id); p.change(destination, 'outOfPlay'); p.click('Apply', p.modal);
      const explanation = p.error(); p.click('Close', p.modal);
      check('Adjust during ' + situation + ' protects the named ship, draft, RNG, history and autosave',
        p.json() === before && p.stored() === disk && p.history().length === oldUndo && selected() === draft && /Undo/.test(explanation),
        { id, observedBox: p.state().ships[id].box, message: explanation });
      const spare = Object.values(original.ships).find(sh => !original.encounter?.ships[sh.id] && sh.box === 'construction' && sh.steps > 0);
      assert(spare, 'construction ship for adjacent control');
      p.click('Adjust'); p.change(p.modal.querySelector('select'), spare.id); p.change(p.modal.querySelector('input[min="0"]'), spare.steps - 1); p.click('Apply', p.modal);
      check('An unrelated construction hull can still be corrected during ' + situation, p.state().ships[spare.id].steps === spare.steps - 1, spare.id);
    });
  }
  await group('Portable chronological log', async () => {
    const p = await page(); p.enter(621001); const saved = fs.readFileSync(path.join(__dirname, 'fixtures', 'adjust-completed-game.json'), 'utf8');
    const long = JSON.parse(saved); long.state.log.push(...long.state.log.slice(0, 125)); // force the collapsed board's 400-entry boundary
    p.click('Load'); p.paste(JSON.stringify(long));
    const current = p.state(), before = p.json(), disk = p.stored(), history = p.history();
    const filter = p.d.querySelector('#log-filter'); p.change(filter, 'vp');
    let blob, filename;
    p.w.URL.createObjectURL = value => { blob = value; return 'blob:audit'; };
    p.w.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    p.click('Save'); const entry = p.find('Download game log (.txt)', p.modal);
    if (entry) entry.click();
    const text = blob ? await new Promise((resolve, reject) => { const r = new p.w.FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsText(blob); }) : '';
    const exported = text.split('\n').slice(2, -1);
    check('Portable text log includes every chronological record, including filtered and older entries',
      exported.length === current.log.length && current.log.every((item, i) => exported[i].endsWith(' · ' + item.text)) && filename.endsWith('-log.txt') && blob.type.startsWith('text/plain'),
      { downloaded: filename, emitted: exported.length, expected: current.log.length });
    check('Log export leaves game, RNG, history and autosave intact', p.json() === before && p.stored() === disk && JSON.stringify(history) === JSON.stringify(p.history()));
    delete p.w.URL.createObjectURL;
    if (entry) entry.click();
    const area = p.modal.querySelector('textarea');
    check('Unavailable log download offers the entire selected text for manual copy', !!text && area.value === text && area.style.display !== 'none' && area.selectionEnd === text.length);
  });
  const failures = results.filter(r => !r.pass);
  console.log(JSON.stringify({ title: html.match(/<title>([^<]+)/)?.[1], checks: results.length, failures: failures.length, results }, null, 2));
  if (process.argv.includes('--require-fixed') && failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
