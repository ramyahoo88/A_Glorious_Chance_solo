const legacyEventFixture = require('./legacy_events');
/* UI regression checks against the shipped HTML. Requires jsdom via NODE_PATH.
   node tests/browser/ui_v029.js [repo] [--require-fixed]
   Event dispatch verifies our handlers; native keyboard activation and layout
   must also be checked in a real browser. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const strict = process.argv.includes('--require-fixed');
const html = legacyEventFixture(fs.readFileSync(path.join(repo, 'dist/index.html'), 'utf8'));
const results = [], errors = [];
function check(name, ok, detail) { results.push({ name, pass: !!ok, detail }); }
async function launch() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  vc.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM(html, { url: 'https://ui-audit.invalid/', runScripts: 'dangerously', virtualConsole: vc });
  await new Promise(r => dom.window.addEventListener('load', r));
  const w = dom.window, d = w.document;
  const state = () => w.eval('JSON.stringify(G_STATE)');
  const button = (label, scope = d) => { const b = [...scope.querySelectorAll('button')].find(x => x.textContent === label); assert(b, label); assert(!b.disabled, label); b.click(); return b; };
  const key = (node, value, extra = {}) => { const e = new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra }); node.dispatchEvent(e); return e; };
  const seed = d.querySelector('input[type=number]'); seed.value = '190901'; seed.dispatchEvent(new w.Event('change', { bubbles: true }));
  button('Start campaign'); button('June I (this turn)'); button('Confirm');
  return { dom, w, d, state, button, key };
}
(async () => {
  const a = await launch();
  a.button('+ Add Force');
  let chip = a.d.querySelector('.asg-ship');
  check('Assignment ships have native keyboard controls', chip.tagName === 'BUTTON', chip.tagName);
  chip.focus(); chip.click();
  const selected = a.d.querySelector('.asg-ship.on');
  check('Selected assignment ship is announced and keeps focus', selected.getAttribute('aria-pressed') === 'true' && a.d.activeElement === selected, { pressed: selected.getAttribute('aria-pressed'), focused: a.d.activeElement === selected });
  a.button('+ Add Force');
  const taken = a.d.querySelectorAll('.asg-force')[1].querySelector('.asg-ship.taken');
  check('Ship assigned to another force is disabled', !!taken.disabled, { tag: taken.tagName, disabled: !!taken.disabled });
  a.dom.window.close();

  for (const keyName of ['Enter', ' ']) {
    const t = await launch(); t.button('Confirm assignments');
    assert.equal(t.w.eval('G_STATE.prompt.title'), 'A10 Target Cards drawn');
    const before = t.state();
    const save = [...t.d.querySelectorAll('#hdr button')].find(x => x.textContent === 'Save');
    save.focus();
    const ev = t.key(save, keyName);
    check(`${JSON.stringify(keyName)} on Save does not advance the game`, t.state() === before && !ev.defaultPrevented, { prevented: ev.defaultPrevented, prompt: t.w.eval('G_STATE.prompt.title') });
    t.dom.window.close();
  }

  const t = await launch(); t.button('Confirm assignments');
  let before = t.state();
  const saveButton = [...t.d.querySelectorAll('#hdr button')].find(x => x.textContent === 'Save'); saveButton.focus(); saveButton.click();
  const modal = t.d.querySelector('#modal'), close = [...modal.querySelectorAll('button')].find(x => x.textContent === 'Close');
  const dialog = modal.querySelector('[role=dialog]');
  check('Modal has an accessible name and initial focus', !!dialog && dialog.getAttribute('aria-modal') === 'true' && !!t.d.getElementById(dialog.getAttribute('aria-labelledby')) && t.d.activeElement === close, { role: !!dialog, focused: t.d.activeElement === close });
  check('Modal makes background controls inert', t.d.querySelector('#hdr').hasAttribute('inert') && t.d.querySelector('#app').hasAttribute('inert'));
  close.focus(); let ev = t.key(close, 'Enter');
  check('Enter in modal leaves game and default button activation alone', t.state() === before && !ev.defaultPrevented, { prevented: ev.defaultPrevented, prompt: t.w.eval('G_STATE.prompt.title') });
  const beforeUndo = t.state(); t.key(close, 'z', { ctrlKey: true });
  check('Undo shortcut does not change game behind modal', t.state() === beforeUndo);
  const last = [...modal.querySelectorAll('button')].at(-1);
  last.focus(); t.key(last, 'Tab');
  check('Modal Tab wraps to first control', t.d.activeElement === close);
  close.focus(); t.key(close, 'Tab', { shiftKey: true });
  check('Modal Shift+Tab wraps to last visible control', t.d.activeElement === last);
  t.key(last, 'Escape');
  check('Escape closes modal and restores focus', !modal.classList.contains('open') && t.d.activeElement === saveButton && !t.d.querySelector('#hdr').hasAttribute('inert') && !t.d.querySelector('#app').hasAttribute('inert'));
  t.dom.window.close();

  const k = await launch(); k.button('Confirm assignments');
  const undoTarget = k.w.eval('UNDO[UNDO.length-1]');
  k.button('Reference'); k.button('Close', k.d.querySelector('#modal'));
  const ref = [...k.d.querySelectorAll('#hdr button')].find(x => x.textContent === 'Reference'); ref.focus(); k.key(ref, 'z', { ctrlKey: true });
  check('Game Undo shortcut works on a button after closing Reference', k.state() === undoTarget);
  k.dom.window.close();

  const u = await launch(); u.button('Confirm assignments'); before = u.state();
  u.key(u.d.body, 'Enter');
  check('Page Enter still advances an information prompt', u.state() !== before);
  before = u.state(); u.key(u.d.body, ' ', { repeat: true });
  check('Held key does not skip another prompt', u.state() === before);
  u.dom.window.close();

  // A rendering-only prompt provides a small deterministic keyboard fixture.
  const v = await launch();
  v.w.eval("G_STATE.log=Array.from({length:405},(_,i)=>({turn:0,kind:i%2?'roll':'player',text:'UI log fixture '+i}));renderBoard(G_STATE);");
  const logState = v.state(), logUndo = v.w.eval('JSON.stringify(UNDO)');
  check('Default log cap is disclosed', v.d.querySelectorAll('#log > div').length === 400 && (v.d.querySelector('#log-count')?.textContent || '').includes('400 of 405'));
  const toggle = [...v.d.querySelectorAll('button')].find(x => x.textContent === 'Show full log');
  if (toggle) toggle.click();
  check('Full log reveals earlier entries', v.d.querySelectorAll('#log > div').length === 405 && v.d.querySelector('#log').textContent.includes('UI log fixture 0'));
  const filter = v.d.querySelector('#log-filter') || v.d.querySelector('#board select'); filter.value = 'roll'; filter.dispatchEvent(new v.w.Event('change', { bubbles: true }));
  check('Log filter reports the matching count', v.d.querySelectorAll('#log > div').length === 202 && (v.d.querySelector('#log-count')?.textContent || '').includes('202 of 202') && !!filter.getAttribute('aria-label'));
  check('Log controls leave game, dice and Undo unchanged', v.state() === logState && v.w.eval('JSON.stringify(UNDO)') === logUndo);
  v.w.eval("G_STATE.prompt={id:990,kind:'choice',title:'Tactic keyboard fixture',tactic:true,options:[{id:'A_firstshot',label:'First Shot',desc:'Read the card before choosing.',color:'white'}]}; renderProc(G_STATE);");
  const tactic = v.d.querySelector('#proc .optcard');
  check('Tactic choices have native keyboard controls', tactic.tagName === 'BUTTON' && tactic.type === 'button', tactic.tagName);
  v.dom.window.close();
  check('No script or console errors during UI checks', errors.length === 0, errors);
  console.log(JSON.stringify({ repo, checks: results.length, passed: results.filter(x => x.pass).length, results }, null, 2));
  if (strict && results.some(x => !x.pass)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
