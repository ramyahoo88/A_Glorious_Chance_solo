// Reproduce both v0.2.17 re-audit findings from its original saved positions.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const old = path.join(root, 'audits/2026-11-19-v0.2.16-reaudit/evidence');
const audit = path.join(root, 'audits/2026-11-20-v0.2.17-reaudit/evidence');
const { ctx, x } = require(path.join(audit, 'campaign/load'))(root);
vm.runInContext(fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8'), ctx);
const E = x('({checkSaveState,act,recordEventUndo,eventRestoreText,removeShipFromForce})');
const plain = s => JSON.parse(JSON.stringify(s));
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json')));
process.argv[2] ||= root; // The shared campaign policy loads this repository's engine.
const policy = require(path.join(audit, 'campaign/policy')).policy;
let checks = 0;
function check(a, b, label) { assert.deepEqual(plain(a), plain(b), label); checks++; }
function refuse(s, change, label) {
  change(s);
  assert.throws(() => E.checkSaveState(s), /damaged or incomplete/, label);
  checks++;
}

for (const name of ['coastal-raidEvent', 'coastal-asBattleEvent']) {
  const original = () => read(old, name).state;
  refuse(read(audit, name + '-missing-order').state, () => {}, name + ' original damaged fixture');
  for (const change of [
    s => delete s.calls.at(-2).L.order,
    s => s.calls.at(-2).L.order.reverse(),
    s => s.calls.at(-2).L.order.push('US'),
    s => delete s.calls.at(-2).L.si,
    s => s.calls.at(-2).L.si = '1',
    s => s.calls.at(-2).L.si = 2,
    s => s.calls.at(-2).L.si = 0,
    s => s.calls.at(-2).L.raids = {},
    s => s.calls.at(-2).L.as = [null],
    s => s.coastal.battles = null,
    s => s.phase = 'lake'
  ]) refuse(original(), change, name + ' continuation validation');

  // Resume both originals through every remaining coastal action, rather than
  // stopping at the immediate Event result that passed the previous validator.
  const direct = original(), restored = E.checkSaveState(plain(direct));
  let steps = 0;
  while (direct.phase === 'coastal') {
    assert(steps++ < 80, 'coastal phase completes');
    const answer = direct.prompt.kind === 'event' ? direct.deck.event.find(id => id !== 30) : policy(direct, direct.prompt, 'coast');
    E.act(direct, answer); E.act(restored, answer);
    check(restored, direct, name + ' complete coastal continuation ' + steps);
    E.checkSaveState(plain(restored));
  }
}
const battle = () => read(old, 'coastal-asBattleEvent').state;
for (const item of [null, {}, { z: 'NIA', forces: null, troops: 1 }, { z: 'bad', forces: ['F8'], troops: 1 },
  { z: 'KIN', forces: ['missing'] }, { z: 'KIN', forces: ['missing'], troops: -1 }]) {
  refuse(battle(), s => s.calls.at(-2).L.lz = [item], 'malformed queued Land Battle');
}
{
  const s = battle(), cur = s.calls.at(-2).L.cur;
  for (const fid of cur.forces) for (const id of [...s.forces[fid].ships]) {
    E.removeShipFromForce(s, id); s.ships[id].box = 'sunk'; s.ships[id].zone = null;
  }
  E.checkSaveState(s); E.act(s, 23); E.act(s, 'ok');
  check(s.phase !== 'coastal', true, 'launched Troops with no supporting Force finish the phase');
}

// Preserve a real reset boundary through all ten consecutive Undo positions.
const saved = read(audit, 'multi-undo-start');
let current = E.checkSaveState(plain(saved.state));
for (let i = 1; i <= 10; i++) {
  const original = JSON.parse(saved.undo.at(-i)), restored = E.checkSaveState(plain(original));
  E.recordEventUndo(current, restored);
  check(!!restored.eventRestore?.reshuffled, i >= 7, 'reset retained from its crossing at Undo ' + i);
  const gameplay = plain(restored); delete gameplay.eventRestore;
  check(gameplay, E.checkSaveState(plain(original)), 'Undo changes no gameplay ' + i);
  current = E.checkSaveState(plain(restored));
  check(current, restored, 'metadata survives round trip at every checkpoint ' + i);
  if (restored.eventRestore && restored.prompt.kind !== 'event') {
    const continued = plain(restored), without = plain(restored); delete without.eventRestore;
    E.act(continued, policy(continued, continued.prompt, 'coast'));
    E.act(without, policy(without, without.prompt, 'coast'));
    check(continued.eventRestore, restored.eventRestore, 'routine Continue retains reminder ' + i);
    delete continued.eventRestore;
    check(continued, without, 'reminder changes no continued dice or gameplay ' + i);
  }
}
check(current.prompt.kind, 'event', 'restored earlier Event draw');
check(current.deck.event.length, 34, 'restored 34-card pile');
check(current.eventRestore, { cards: [2], reshuffled: true }, 'return card and reset boundary both retained');
check(E.eventRestoreText(current).includes('draw pile (34 cards)'), true, 'instruction identifies exact earlier pile');
check(E.eventRestoreText(current).includes('Deck status in Reference'), true, 'reconciliation available at every checkpoint');
const after = plain(current); E.act(after, 2);
check(Object.hasOwn(after, 'eventRestore'), false, 'next accepted Event entry clears reminder');
console.log(`v0.2.18 coastal recovery and repeated Undo: ${checks} assertions passed.`);
