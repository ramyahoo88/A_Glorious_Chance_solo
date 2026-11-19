const legacyEventFixture = require('./legacy_events');
/* Shipped controls, the end-of-game shortcut, and the single-Undo boundary for grouped updates. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const html = legacyEventFixture(fs.readFileSync(path.join(repo, 'dist/index.html'), 'utf8'));
(async () => {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const dom = new JSDOM(html, { url: 'https://game.invalid/', runScripts: 'dangerously', virtualConsole: vc });
  await new Promise(resolve => dom.window.addEventListener('load', resolve));
  const w = dom.window, d = w.document, q = s => d.querySelector(s);
  const raw = () => w.eval('JSON.stringify(G_STATE)');
  const click = (name, root = d) => {
    const b = [...root.querySelectorAll('button')].find(x => x.textContent === name);
    assert(b && !b.disabled, name); b.click();
  };
  const key = (e, k, fields = {}) => e.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...fields }));
  const seed = q('.setup input[type=number]'); seed.value = 280004; seed.dispatchEvent(new w.Event('change'));
  [...d.querySelectorAll('.setup label')].find(n => n.textContent.includes('Group routine')).querySelector('input').click();
  click('Start campaign'); click('June I (this turn)'); click('Confirm');
  assert.match(q('#proc').textContent, /No Forces assigned/);
  click('+ Add Force'); q('.asg-ship:not(:disabled)').click();
  assert.doesNotMatch(q('#proc').textContent, /No Forces assigned/);
  const previous = raw(), depth = w.eval('UNDO.length');
  click('Confirm assignments');
  assert.equal(w.eval('UNDO.length'), depth + 1);
  const after = raw(), report = JSON.parse(after).tableReport;
  assert(report.notices.length > 0 && report.changes.some(x => x.includes('Patrol')));
  const disclosure = q('#proc .table-recap summary');
  assert(disclosure); key(disclosure, ' '); assert.equal(raw(), after);
  click('Save'); const exported = q('#modal textarea').value; click('Close', q('#modal'));
  assert.deepEqual(JSON.parse(exported).state.tableReport, report);
  click('↶ Undo'); assert.equal(raw(), previous);
  click('+ Add Force'); q('.asg-ship:not(:disabled)').click();
  click('Confirm assignments'); assert.equal(raw(), after);
  const visible = w.eval('JSON.stringify([...publicBoard(G_STATE)])');
  const hidden = w.eval(`(() => {
    const copy = JSON.parse(JSON.stringify(G_STATE));
    copy.aiTroops.track.forEach(m => m.troops = !m.troops);
    copy.aiTroops.box.filter(m => !m.revealed).forEach(m => m.troops = !m.troops);
    Object.values(copy.convoys[copy.ai]).filter(c => !c.revealed).forEach(c => c.real = !c.real);
    for (const slot of copy.targetRow.filter(c => !c.revealed)) {
      const back = TARGET_CARDS[slot.id];
      const other = Object.values(TARGET_CARDS).find(c => c.id !== back.id && c.zone === back.zone && c.deck === back.deck);
      if (other) slot.id = other.id;
    }
    copy.deck.event.reverse(); copy.deck.target.reverse();
    return JSON.stringify([...publicBoard(copy)]);
  })()`);
  assert.equal(visible, hidden);
  // The same seeded board is made terminal under 14.2. Control-Z should still
  // be able to restore the last decision even though there is no next prompt.
  w.eval("UNDO.push(JSON.stringify(G_STATE)); G_STATE.vp.BR=25; endGame(G_STATE,'US'); render()");
  assert.match(q('#hdr').textContent, /U.S. Decisive Victory \(Dual Blockade\)/);
  assert.doesNotMatch(q('#hdr').textContent, /British Victory/);
  key(d.body, 'z', { ctrlKey: true }); assert.equal(raw(), after);
  assert.deepEqual(errors, []); dom.window.close();
  console.log('Tabletop controls: grouped reports, public information, exact Undo/replay, native summary keys, empty orders, and forced victory passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
