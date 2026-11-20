// Real browser controls: original corrupt imports, natural repeated Undo, and
// Reference inspection during non-Event checkpoints. AGC_URL also tests a live build.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const audit = path.join(root, 'audits/2026-11-20-v0.2.17-reaudit/evidence');
const old = path.join(root, 'audits/2026-11-19-v0.2.16-reaudit/evidence');
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json')));
const drive = require(path.join(audit, 'browser/ui-driver'));
const plain = s => JSON.parse(JSON.stringify(s));
const gameplay = s => { const copy = plain(s); delete copy.eventRestore; return copy; };
let checks = 0;
const check = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };

(async () => {
  let executablePath = process.env.CHROME_PATH || '/usr/bin/chromium', args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (!process.env.CHROME_PATH) {
    let shell;
    try { shell = require('@sparticuz/chromium').default; } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
    if (shell) { executablePath = await shell.executablePath(); args = shell.args; }
  }
  const browser = await chromium.launch({ executablePath, args, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const url = process.env.AGC_URL || 'file://' + path.join(root, 'dist/index.html');
    const key = 'agc_solo_companion_v1';
    const state = () => page.evaluate('JSON.parse(JSON.stringify(G_STATE))');
    const snap = () => page.evaluate('JSON.stringify({state:G_STATE,undo:UNDO,draft:UI.local,disk:localStorage.getItem(SAVE_KEY)})');
    const header = name => page.locator('#hdr').getByRole('button', { name, exact: true });
    const close = () => page.getByRole('button', { name: 'Close', exact: true }).click();
    async function load(s) {
      await header('Load').click();
      await page.locator('#modal textarea').fill(JSON.stringify({ state: s, undo: [] }));
      await page.getByRole('button', { name: 'Load pasted text', exact: true }).click();
    }
    async function reference() {
      const before = await snap();
      await header('Reference').click();
      await page.getByLabel('Reference topic', { exact: true }).selectOption({ label: 'Event deck status' });
      const s = await state();
      check(await page.locator('#modal .event-deck-numbers').first().textContent(), s.deck.event.slice().sort((a, b) => a - b).join(', '), 'Reference lists exact sorted remaining cards');
      check(await snap(), before, 'Reference changes no game, draft, Undo, RNG or autosave');
      await close();
    }
    await page.goto(url);
    await page.getByRole('button', { name: 'Start campaign', exact: true }).click();
    await load(read(old, 'turn-B2event').state);
    await page.getByLabel('Event card number', { exact: true }).fill('3');
    const rejectionCases = ['coastal-raidEvent', 'coastal-asBattleEvent'];
    for (const name of rejectionCases) {
      const before = await snap();
      await load(read(audit, name + '-missing-order').state);
      check(await snap(), before, name + ' damaged import is atomic, including unfinished entry');
      check((await page.locator('#modal .err').textContent()).includes('pending Event coastal phase'), true, 'damaged coastal continuation explained');
      await close();
    }
    for (const name of rejectionCases) {
      await load(read(old, name).state);
      let steps = 0, s = await state();
      while (s.phase === 'coastal') {
        assert(steps++ < 80);
        const answer = s.prompt.kind === 'event' ? s.deck.event.find(id => id !== 30) : 'ok';
        await drive(page, s, answer); s = await state();
      }
      check(await page.evaluate('UI.err'), '', name + ' valid import completes Coastal phase');
    }

    await page.evaluate('localStorage.clear()'); await page.reload();
    await page.locator('.setup input[type=number]').fill('986000');
    await page.getByRole('button', { name: 'Start campaign', exact: true }).click();
    const trace = read(audit, 'multi-undo-play-trace');
    for (const row of trace) {
      const s = await state(); check(s.prompt.title, row.title, 'natural trace ' + row.title);
      await drive(page, s, row.answer);
    }
    check((await state()).deck.event.length, 38, 'new turn asks to shuffle all 38 cards');
    const earlier = await page.evaluate('JSON.parse(UNDO[UNDO.length-10])');
    earlier.build = '0.2.18';
    for (let i = 1; i <= 10; i++) {
      await header('↶ Undo').click();
      const s = await state();
      check(!!s.eventRestore?.reshuffled, i >= 7, 'reset retained through Undo ' + i);
      if (i === 7 || i === 8) {
        check(s.prompt.kind, 'info', 'reconciliation survives at non-Event notice');
        await reference();
        if (i === 7) {
          await page.reload(); await page.getByRole('button', { name: 'Continue it', exact: true }).click();
          check(await state(), s, 'reload at intermediate notice retains boundary and history');
        } else {
          const exported = await page.evaluate('saveText()');
          const transfer = await page.context().newPage();
          await transfer.goto(url);
          // Clear the shared origin so setup imports this transferred checkpoint.
          await transfer.evaluate('localStorage.clear()'); await transfer.reload();
          await transfer.getByRole('button', { name: 'Load game', exact: true }).click();
          await transfer.locator('#modal textarea').fill(exported);
          await transfer.getByRole('button', { name: 'Load pasted text', exact: true }).click();
          check(await transfer.evaluate('JSON.parse(JSON.stringify(G_STATE))'), s, 'Save transfer retains intermediate reconciliation');
          await transfer.locator('#proc').getByRole('button', { name: 'Continue', exact: true }).click();
          check(await transfer.evaluate('G_STATE.eventRestore.reshuffled'), true, 'routine Continue after transfer retains reminder');
          await transfer.close();
        }
      }
    }
    const restored = await state();
    check(gameplay(restored), earlier, 'all earlier gameplay, cards, dice and map restored exactly');
    check(restored.eventRestore, { cards: [2], reshuffled: true }, 'exact returned card and reset recorded');
    const reminder = await page.locator('#proc>.banner').textContent();
    check(reminder.includes('draw pile (34 cards)'), true, 'rebuild instruction names 34-card pile');
    check(reminder.includes('Deck status in Reference'), true, 'rebuild instruction points to available control');
    check(reminder.includes('Do not shuffle'), false, 'no incorrect claim that order survives a reshuffle');
    await reference();
    await page.reload(); await page.getByRole('button', { name: 'Continue it', exact: true }).click();
    check(await page.locator('#proc>.banner').textContent(), reminder, 'final reminder survives reload');
    await drive(page, await state(), 2);
    check(await page.evaluate('Object.hasOwn(G_STATE,"eventRestore")'), false, 'accepted Event entry clears reminder');
    await reference();
    check(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'phone document fits');

    // The downloaded offline app must be the exact release, even after playing.
    await header('Reference').click();
    await page.getByLabel('Reference topic', { exact: true }).selectOption({ label: 'Offline app' });
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download app (.html)', exact: true }).click();
    const download = await pending;
    check(download.suggestedFilename(), 'A_Glorious_Chance_Solo_v0.2.18.html', 'offline download version');
    check(fs.readFileSync(await download.path(), 'utf8'), fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), 'offline download byte-identical to tested release');
    check(errors, [], 'no browser errors');
    const report = { browser: await browser.version(), url, assertions: checks, traceActions: trace.length, rejectionCases, undos: 10, restoredPile: 34, pageErrors: errors };
    if (process.env.AGC_BROWSER_REPORT) fs.writeFileSync(process.env.AGC_BROWSER_REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
