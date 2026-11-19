const legacyEventFixture = require('./legacy_events');
// Actual shipped controls in jsdom; visual layout is checked separately.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '../..'), key = 'agc_solo_companion_v1';
const html = legacyEventFixture(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'));
const fixtures = path.join(root, 'audits/2026-11-19-v0.2.14/evidence');
const cases = JSON.parse(fs.readFileSync(path.join(fixtures, 'natural-fixtures.json'))).cases;
const fixture = name => JSON.parse(fs.readFileSync(path.join(fixtures, name + '.json'))).state;
let passed = 0; const errors = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
async function page(saved) {
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://map-test.invalid/', runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w) { if (saved) w.localStorage.setItem(key, saved); } });
  const w = dom.window, d = w.document; await new Promise(r => w.addEventListener('load', r));
  const x = code => w.eval(code), state = () => JSON.parse(x('JSON.stringify(G_STATE)'));
  const click = (name, scope = d) => { const b = [...scope.querySelectorAll('button')].find(e => e.textContent === name); assert(b && !b.disabled, name); b.click(); };
  const snap = () => JSON.stringify({ state: state(), undo: x('JSON.stringify(UNDO)'), draft: x('JSON.stringify(UI.local)'), disk: w.localStorage.getItem(key) });
  const load = s => {
    click(state() ? 'Load' : 'Load a saved game');
    const ta = d.querySelector('#modal textarea'); ta.value = JSON.stringify({ state: s, undo: [] });
    ta.dispatchEvent(new w.Event('input', { bubbles: true })); click('Load pasted text');
  };
  return { w, d, x, state, click, snap, load };
}
(async () => {
  for (const [name, record] of Object.entries(cases)) {
    const p = await page(); p.load(fixture(name + '-before'));
    const before = p.state(), prompt = before.prompt;
    p.click(prompt.kind === 'info' ? 'Continue' : prompt.options.find(o => o.id === record.answer).label, p.d.querySelector('#proc'));
    const after = p.state(), expected = fixture(name + '-after');
    check(name + ': natural action records every exact transition', after.tableReport.map, expected.tableReport.map);
    check(name + ': movement display preserves actual score and dice', [after.vp, after.rng, after.log], [expected.vp, expected.rng, expected.log]);
    const routes = after.tableReport.map.moves.filter(m => m.from.place && m.to.place && m.from.place !== m.to.place).length;
    check(name + ': numbered arrows match geographic transitions', p.d.querySelectorAll('#board .map-route').length, routes);
    check(name + ': each route has a readable number badge', p.d.querySelectorAll('#board .map-route-badge').length, routes);
    const unchanged = p.snap(); p.x('renderBoard(G_STATE)');
    check(name + ': repainting is read-only', p.snap(), unchanged);
    p.click('Show last action');
    check(name + ': last action opens with ship names and endpoints', p.d.querySelector('#modal .map-action-summary').textContent.includes(after.tableReport.map.moves[0].from.label), true);
    check(name + ': opening the report is read-only', p.snap(), unchanged); p.click('Close');
    const disk = p.w.localStorage.getItem(key), reload = await page(disk); reload.click('Continue it');
    check(name + ': reload keeps exact movement report', reload.state().tableReport, after.tableReport);
    check(name + ': reload restores route count', reload.d.querySelectorAll('#board .map-route').length, routes); reload.w.close();
    p.click('↶ Undo'); check(name + ': Undo restores the exact prior map action', p.state(), before);
    p.w.close();
  }
  {
    const p = await page(); p.load(fixture('ai-deploy-after'));
    const source = p.state(), snap = p.snap();
    for (const z of ['YOR', 'NOR', 'KIN', 'NIA', 'SOU', 'SAC']) {
      for (const side of ['US', 'BR']) {
        const expected = Object.values(source.ships).filter(sh => sh.box === 'lake' && sh.zone === z && sh.owner === side).length;
        const fleet = p.d.querySelector(`#board [data-place="${z}"] .map-fleet.${side}`);
        check(z + ' ' + side + ': fleet count matches the public ships', fleet ? Number(fleet.querySelector('strong').textContent.match(/· (\d+)/)[1]) : 0, expected);
      }
    }
    const ai = p.d.querySelector('#board .map-fleet.' + source.ai); assert(ai);
    check('A.I. fleets identify their public mission', ai.textContent.includes('A.I.') && !!ai.querySelector('.map-missions').textContent, true);
    ai.click(); check('Fleet opens inspectable ship chips', p.d.querySelectorAll('#modal .ship').length > 0, true); p.click('Close');
    p.d.querySelector('#board [data-place="HOME_BR"]').click();
    check('Port inspection distinguishes Deployable from preparing ships', !!p.d.querySelector('#modal h3'), true); p.click('Close');
    p.click('Map'); check('Header Map opens the same interactive map', !!p.d.querySelector('#modal .campaign-map'), true); p.click('Close');
    check('Map, fleet and port inspection do not change the game', p.snap(), snap);
    const original = p.x("campaignMap(G_STATE,'privacy').outerHTML");
    const altered = p.x(`(() => {
      const s = JSON.parse(JSON.stringify(G_STATE));
      s.aiTroops.track.forEach(m => m.troops = !m.troops);
      s.aiTroops.box.filter(m => !m.revealed).forEach(m => m.troops = !m.troops);
      Object.values(s.convoys[s.ai]).filter(c => !c.revealed).forEach(c => c.real = !c.real);
      s.deck.event.reverse(); s.deck.target.reverse(); s.deck.tacA.reverse(); s.deck.tacD.reverse();
      for (const c of s.targetRow.filter(c => !c.revealed)) c.id = 'A999';
      return campaignMap(s,'privacy').outerHTML;
    })()`);
    check('Hidden markers, unrevealed orders and future decks cannot affect the map', altered, original);
    p.w.close();
  }
  {
    const p = await page(); const old = fixture('ai-deploy-before'); delete old.tableReport; p.load(old);
    check('Older saves open without invented past routes', p.d.querySelectorAll('#board .map-route').length, 0);
    check('Older saves explain when movement becomes available', p.d.querySelector('#board .map-action-summary').textContent, 'Movement appears after your next action.');
    const malformed = fixture('ai-deploy-after');
    malformed.tableReport.map.moves.push({ side: 'US', from: {label:'Bad',place:'__proto__'}, to:{label:'Bad',place:'SAC'}, ships:['constructor'] });
    p.load(malformed); check('Damaged optional report entries do not break a valid position', p.d.querySelector('#modal').classList.contains('open'), false);
    // An information-only action replaces the movement, so arrows never imply
    // that an older voyage happened on the just-completed step.
    const before = p.state(); assert.equal(before.prompt.kind, 'info'); p.click('Continue', p.d.querySelector('#proc'));
    check('The current action always replaces its predecessor', p.state().tableReport.map.title, before.prompt.title);
    p.w.close();
  }
  check('No DOM or control errors', errors, []);
  console.log(`v0.2.14 campaign map: ${passed} assertions passed.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
