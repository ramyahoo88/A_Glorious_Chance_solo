// Run against this checkout or an earlier release: node tests/regression_v0210_combat.js [checkout] [fixture-directory]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const output = process.argv[3];
const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine.concat('ui.js');
const source = files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n');
const E = vm.runInNewContext(source + `\ninstallResume(); ({
  newGame, newForce, encAdd, run, act, info, checkSaveState, PROCS, EVENTS, tacticValid, towedInRound,
  aiPlanFor, aiAttackDecision, humanReactionCandidates, encSummary, applyLakeEvent, OTHER
});`, { console, Date });
const copy = x => JSON.parse(JSON.stringify(x));
let passed = 0, failed = 0;
function test(name, actual, expected) {
  try { assert.deepStrictEqual(copy(actual), expected); passed++; }
  catch (err) { failed++; console.error('FAIL ' + name, '\n actual:', actual, '\n expected:', expected); }
}
function save(name, s) {
  E.checkSaveState(copy(s));
  if (output) fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify({ state: s, undo: [] }) + '\n');
}
function board(human, us, br, att, seed = 1) {
  const s = E.newGame(human, seed);
  s.turn = 2; s.phase = 'lake'; s.rng = seed; s.lossesThisTurn = []; s.troopsReturning = { US: 0, BR: 0 };
  const u = E.newForce(s, 'US', 'NOR', 'Patrol', us);
  const b = E.newForce(s, 'BR', 'NOR', 'Patrol', br);
  s.encounter = { zone: 'NOR', kind: 'normal', segment: 'patrol', ships: {}, side: {}, flagIn: {},
    struckBy: {}, withdrawn: { US: false, BR: false }, humanForce: (human === 'US' ? u : b).id,
    aiForce: (human === 'US' ? b : u).id, wg: att, wgCard: 8, firstAttack: false };
  us.concat(br).forEach(id => E.encAdd(s, id));
  s.zones.NOR.event = 8;
  s.deck.event = s.deck.event.filter(id => id !== 8);
  s.combat = { att, def: E.OTHER[att], seq: att === 'US' ? 'A' : 'B', pos: 0, segment: 'patrol',
    col: { US: us.slice(), BR: br.slice() }, tows: {}, tac: { att: null, def: null }, gr: 0, roundAttackers: [] };
  s.calls = []; s.prompt = null;
  return s;
}
function pause(s, proc, pc, L = {}) {
  s.calls = [{ proc: 'turn', pc: 'E', L: {} }];
  if (proc === 'combat') s.calls.push({ proc: 'encounter', pc: 'afterCombat', A: {}, L: {} });
  s.calls.push({ proc, pc, A: {}, L });
  s.prompt = Object.assign({ id: 1 }, E.info('Audit position', 'Continue to resolve the position.'));
  s.promptSeq = 1;
}
function topEvent(s, id) { s.deck.event = [id].concat(s.deck.event.filter(n => n !== id)); }
function card(id) { return { id, used: false, negated: false }; }
function allLog(s) { return s.log.map(l => l.text).join('\n'); }

// LC5.1. Decisions on one side cannot suppress the other's transfer and casualty check.
const flags = board('US', ['madison', 'oneida'], ['wolfe', 'rg'], 'BR');
flags.ships.wolfe.steps--; flags.ships.madison.steps--;
pause(flags, 'combat', 'flagTransfer', { lines: ['Both flagships have just been Reduced.'] });
E.act(flags, 'ok');
save('C01-simultaneous-flags', flags);
for (const answer of ['stay', 'oneida']) {
  const s = copy(flags);
  E.act(s, answer);
  test('flag transfer after human ' + answer, [s.flagship.US, s.flagship.BR, s.leader.BR.wounded, s.prompt.title],
    answer === 'stay' ? ['madison', 'rg', false, 'Gunnery Round results'] : ['oneida', 'wolfe', true, 'Gunnery Round results']);
  test('one British transfer roll after ' + answer, (s.prompt.text.match(/Yeo (shifts|tries)/g) || []).length, 1);
}
const wounded = copy(flags); wounded.leader.BR.wounded = true; E.act(wounded, 'stay');
test('wounded British leader cannot transfer', wounded.flagship.BR, 'wolfe');

// LC6/D06 overrides the winner, but the new card's symbols are read by LC3.
const wind = board('BR', ['pike'], ['wolfe', 'rg'], 'US', 71);
wind.combat.pos = 1; wind.combat.tac.def = card('D_outmaneuver');
topEvent(wind, 13); pause(wind, 'combat', 'wg');
save('C02-outmaneuver-check', wind);
const ordinary = copy(wind);
const skipped = copy(wind);
E.act(wind, 'ok');
test('D06 consumes and shows Event 13, but Britain wins its American flag',
  [wind.encounter.wg, wind.encounter.wgCard, wind.prompt.eventCard || null, wind.deck.event.includes(13)],
  ['BR', 13, 13, false]);
test('the new diamond forbids Grapple on the new British attack', (() => {
  wind.combat.att = 'BR'; wind.combat.def = 'US';
  return E.tacticValid(wind, 'A_grapple', 'BR');
})(), false);
ordinary.combat.tac.def.negated = true; E.act(ordinary, 'ok');
test('negated D06 draws the same card and uses its printed American flag', [ordinary.encounter.wg, ordinary.encounter.wgCard], ['US', 13]);
skipped.combat.tac.att = card('A_sweep'); skipped.combat.tac.def = null;
const skipResult = E.PROCS.combat.wg(skipped, { L: {} });
test('an expressly skipped WG check draws no card', [skipped.deck.event[0], skipped.combat.pos, skipResult.goto], [13, 2, 'next']);

// Cards 6/13/29/35 and LC2: place the absentee last. The declared pair must
// still be adjacent in the actual Round 2 line to count as a tow.
function towRound(otherShip, seed) {
  const us = ['madison', 'tompkins'].concat(otherShip ? ['oneida'] : []);
  const s = board('US', us, ['wolfe', 'rg'], 'US', seed);
  s.zones.NOR.event = 13; s.zones.NOR.flags.missedSignal = 'tompkins';
  E.PROCS.combat.assemble2(s, { A: {}, L: {}, answer: { attackers: us, tows: {madison:'tompkins'} } });
  E.PROCS.combat.finishRound(s, { L: {} });
  s.combat.pos = 2; s.combat.gr = 1;
  pause(s, 'combat', 'grOut', { st: 'GR2' });
  return s;
}
const tow = towRound(true, 7); save('C03-rear-schooner', tow);
test('the absent schooner actually returned to the rear', tow.combat.col.US, ['madison', 'oneida', 'tompkins']);
test('an intervening attacking Oneida breaks the previous tow', E.towedInRound(tow.combat, tow.combat.col.US), []);
E.act(tow, 'ok');
test('Round 2 actually applies the newly untowed schooner penalty',
  allLog(tow).includes('1 untowed Laker Schooner: d6 1, DRM -1'), true);
const zero = towRound(true, 1); E.act(zero,'ok');
test('a zero DRM does not claim there were zero schooners',
  allLog(zero).includes('1 untowed Laker Schooner: d6 4, DRM 0'), true);
const two = board('US',['tompkins','fairam'],['moira'],'US',7);
pause(two,'combat','grOut',{st:'GR1'}); E.act(two,'ok');
test('two untowed schooners on a 1 give minus two', allLog(two).includes('2 untowed Laker Schooners: d6 1, DRM -2'), true);
const adjacent = towRound(false, 1); E.act(adjacent, 'ok');
test('without Oneida the original pair is adjacent and avoids that d6', /Gunnery Round 2:.*untowed/.test(allLog(adjacent)), false);

// Single selected human attacker out for one Round of a multi-ship Force.
const lone = board('US', ['madison','oneida'], ['wolfe'], 'US', 51);
lone.zones.NOR.event = 13; lone.zones.NOR.flags.missedSignal = 'madison';
topEvent(lone, 9);
pause(lone, 'combat', 'assemble'); E.act(lone, 'ok');
save('C04-missed-only-attacker', lone);
E.act(lone, { attackers: ['madison'], tows: {} });
function driveTo(s, title) {
  for (let i = 0; i < 8 && s.prompt && s.prompt.title !== title; i++) {
    if (s.prompt.kind === 'info') E.act(s, 'ok');
    else if (s.prompt.tactic) E.act(s, s.prompt.options[0].id);
    else break;
  }
}
driveTo(lone, 'Missed Signal – no combat this Round');
test('selecting the absentee skips only Round 1', lone.prompt.title, 'Missed Signal – no combat this Round');
if (lone.prompt.title === 'Missed Signal – no combat this Round') E.act(lone, 'ok');
test('after the empty round the selected ship returns and WG is rechecked', [lone.prompt.title,lone.combat && lone.combat.col.US], ['Weather Gage recheck',['madison']]);
test('no actual Gunnery Round 1 roll', /Gunnery Round 1: U\.S\./.test(allLog(lone)), false);
const defender = board('BR', ['oneida','lady'], ['wolfe'], 'BR', 51);
defender.zones.NOR.flags.missedSignal = 'oneida'; defender.encounter.ships.lady = 'dis';
test('the sole defending absentee has no first-round combat odds', E.encSummary(defender).includes('No combat roll in the first Round: Oneida'), true);
E.PROCS.combat.assemble2(defender, { A:{}, L:{}, answer:{attackers:['wolfe'],tows:{}} });
pause(defender,'combat','next'); E.act(defender,'ok');
test('the only temporarily missing defender does not end the Encounter', defender.prompt.title, 'Missed Signal – no combat this Round');
const present = board('BR', ['oneida','lady'], ['wolfe'], 'BR', 51);
present.ships.oneida.steps = 0; present.encounter.ships.lady = 'dis';
test('a genuine zero-strength, engaged Fight On defender still gives infinite odds', E.encSummary(present).includes('∞:1'), true);

// LC1 strict printed comparison versus the independent odds threshold; LC4.2 count vs DRM.
const reasons = board('US', ['madison'], ['wolfe','rg'], 'BR');
reasons.zones.NOR.flags.missedSignal = 'wolfe';
const reason = E.aiAttackDecision(reasons, false);
test('passed printed comparison and failed odds are distinguished',
  [reason.ships.length,reason.why.includes('(passes)'),reason.why.includes('odds 0.59:1 (fails: needs 1:1)')], [0,true,true]);
const below = E.aiPlanFor(reasons, 'BR', ['rg'], ['madison'], false);
test('a failing printed comparison is identified', below.why.includes('(fails: must be greater)'), true);
const waived = E.aiPlanFor(reasons, 'BR', ['rg'], ['madison'], true);
test('the allowed Breakout waiver does not claim both checks passed', waived.why.includes('waived for this attack'), true);
present.ships.oneida.steps=0;
test('AI does not call a zero-strength defender 99:1', E.aiPlanFor(present, 'BR', ['wolfe'], ['oneida'], false).why.includes('odds ∞:1'), true);

// Separated Ships applies to one actual Force. Card 27 changes only the source
// and new Patrol, not a different coastal Force sharing this Encounter.
const singles = board('US', ['madison'], ['wolfe','moira'], 'US', 9);
E.newForce(singles,'BR','NOR','Patrol',['moira']);
const rng = singles.rng, unchanged = E.applyLakeEvent(singles,E.EVENTS[34],'NOR');
test('two singletons are individually ineligible and spend no RNG',
  [singles.ships.wolfe.zone,singles.ships.moira.zone,singles.rng,unchanged.text.includes('no effect')], ['NOR','NOR',rng,true]);
const split = board('US', ['madison','oneida','tompkins'], ['wolfe'], 'BR', 41);
const separate = E.newForce(split,'US','NOR','ArmySupport',['tompkins'],{troops:1});
E.applyLakeEvent(split,E.EVENTS[27],'NOR');
test('card 27 preserves the other Force, its mission and its troop', [separate.mission,separate.troops,split.ships.tompkins.zone], ['ArmySupport',1,'NOR']);
const moved = Object.keys(split.encounter.ships).filter(id => split.encounter.ships[id] === 'out');
const candidates = E.humanReactionCandidates(split);
test('the displaced human Patrol can declare a Reaction', candidates.some(c => c.ships.includes(moved[0])), true);
const ended = copy(split);
pause(ended,'encounter','end'); E.act(ended,'ok');
test('a displaced Patrol that never returned has no Encounter Ended marker', ended.forces[ended.ships[moved[0]].forceId].ended, false);
split.pe.push({forceId:split.ships[moved[0]].forceId,status:'possible'});
test('a different outstanding PE still excludes that Force', E.humanReactionCandidates(split).some(c => c.ships.includes(moved[0])), false);
const aiSplit = board('US',['oneida'],['rg','moira'],'US',41);
E.applyLakeEvent(aiSplit,E.EVENTS[34],'NOR');
const aiMoved = Object.keys(aiSplit.encounter.ships).find(id => aiSplit.encounter.ships[id] === 'out');
pause(aiSplit,'encounter','reactionAI',{hc:[],hlines:[]}); aiSplit.rng=1;
save('C05-displaced-AI-reaction',aiSplit); E.act(aiSplit,'ok');
test('the adjacent displaced AI Patrol can react back after 6 minus 1',
  [aiSplit.encounter.ships[aiMoved],aiSplit.ships[aiMoved].zone,aiSplit.prompt.text.includes('SUCCESS')], ['in','NOR',true]);
const multi = board('US',['madison','oneida','tompkins','fairam'],['wolfe'],'BR',41);
E.newForce(multi,'US','NOR','Raid',['tompkins','fairam']);
const selected=E.applyLakeEvent(multi,E.EVENTS[27],'NOR');
test('multiple eligible Forces select one and displace half of that Force',
  [Object.values(multi.encounter.ships).filter(x=>x==='out').length,selected.text.includes('Randomly selected Force:')],[1,true]);

// An AI decision in a Reaction Segment must not manufacture a human command.
const command = board('US',['madison'],['wolfe','rg'],'BR',10);
command.encounter.segment='reaction'; pause(command,'encounter','command'); E.act(command,'ok');
test('Reaction AI attack check does not log a human Bypass', allLog(command).includes('Command Decision: Bypass.'), false);
command.encounter.segment='patrol'; pause(command,'encounter','command'); E.act(command,'ok'); E.act(command,'bypass');
test('an actual human Bypass is still recorded', allLog(command).includes('Command Decision: Bypass.'), true);

const repeat = board('US',['madison'],['wolfe'],'BR',17);
Object.values(repeat.ships).filter(sh => sh.owner === 'US' && sh.box === 'deployable').forEach(sh => { sh.box = 'ordinary'; });
pause(repeat,'encounter','reaction',{hlines:['prior Encounter reaction roll']}); E.act(repeat,'ok');
test('a new Reaction without human candidates never replays an earlier roll',
  repeat.prompt.text.includes('prior Encounter reaction roll'), false);

// The current Encounter's result and the permanent history each need exactly
// one entry for a withdrawal, even if the Force contains several removals.
const withdraw = board('US',['oneida','tompkins'],['wolfe'],'BR',9);
pause(withdraw,'combat','withdraw',{wQueue:['US'], failedDis:{US:[],BR:[]}, hit:{US:[],BR:[]}, lines:['Withdrawal result.']});
E.act(withdraw,'ok'); save('C06-withdrawal-log',withdraw);
for (const [answer, pattern] of [['withdraw','ships withdraw to In Transit'],['stay','You ignore the Withdrawal result.']]) {
  const s=copy(withdraw); E.act(s,answer);
  test('one log entry for the decision ' + answer, s.log.filter(l => l.text.includes(pattern)).length, 1);
  test('the result screen still reports ' + answer, s.prompt.text.includes(pattern), true);
}

// 2.5.1 says to read Gale's own application on card 30. The card is expressly
// limited to the Lake Action Phase; other phases can also execute EN1.2.
for (const phase of ['lake','enemy','breakout']) {
  const s = board('US',['oneida'],['moira'],'BR',12);
  s.phase = phase; s.zones.NOR.event = null; topEvent(s,13); topEvent(s,30);
  pause(s,'encounter','event');
  if (phase === 'enemy') save('C07-gale-outside-lake',s);
  E.act(s,'ok');
  test('Gale applies at an initial Zone Event in ' + phase,
    [s.zones.NOR.event,s.prompt.title === 'Gale!',s.ships.oneida.zone === 'NOR'], phase === 'lake' ? [30,true,false] : [13,false,true]);
}
const established = board('US',['oneida'],['moira'],'BR',12);
topEvent(established,13); topEvent(established,30); pause(established,'encounter','event'); E.act(established,'ok');
test('a zone that already has a Lake Action Event redraws Gale too', [established.zones.NOR.event,established.encounter.wgCard], [8,13]);

console.log('v0.2.10 encounter/combat: ' + passed + ' passed, ' + failed + ' failed.');
if (failed) process.exitCode = 1;
