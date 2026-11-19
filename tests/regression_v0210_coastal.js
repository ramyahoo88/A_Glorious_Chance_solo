// E3/E6 coastal sequencing, F7 and Dual Blockade. Optional argument selects the checkout under test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const sources = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine;
const context = vm.createContext({ console });
const run = code => vm.runInContext(code, context);
run(sources.map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n;\n') + '\ninstallResume();');
let passed = 0, failed = 0;
function check(name, query, expected) {
  try {
    assert.deepEqual(JSON.parse(run(`JSON.stringify(${query})`)), expected);
    passed++;
  } catch (error) { failed++; console.error(`FAIL ${name}\n${error.message}`); }
}
run(`
function coastStart(human, seed) {
  const s = newGame(human, seed);
  s.turn = 5; s.lossesThisTurn = []; s.troopsReturning = { US: 0, BR: 0 };
  s.calls = [{ proc: 'turn', pc: 'F', A: {}, L: {} }, { proc: 'coastal', pc: 'start', A: {}, L: {} }];
  return s;
}
function nextCards(s, cards) { s.deck.event = cards.concat(s.deck.event.filter(id => !cards.includes(id))); }
function through(s, title) {
  let count = 0;
  while (!s.over && s.prompt.kind === 'info' && !s.prompt.title.startsWith(title)) {
    if (++count > 25) throw new Error('Expected ' + title);
    act(s, 'ok');
  }
  return s;
}
function support(s, side, zone, ships, troops) { return newForce(s, side, zone, 'ArmySupport', ships, { troops }); }
function twoTargets(reverse, defender) {
  const s = coastStart('BR', 210316);
  s.troops.BR.track = [8]; s.troops.BR.available = 0;
  const zones = reverse ? ['SAC','NIA'] : ['NIA','SAC'];
  zones.forEach(z => support(s,'BR',z,[z === 'NIA' ? 'wolfe' : 'rg'],1));
  deployable(s,'US').forEach(sh => {sh.box = 'makeReady';});
  if (defender) s.ships.oneida.box='deployable';
  newForce(s,'BR','SOU','Raid',['moira']); nextCards(s,[1,2,3]); s.rng=57;
  run(s); return s;
}
function firstAfterRaid(s) { act(s, 'ok'); return s; }
const coastalLog = s => s.log.map(entry => entry.text);
const rollLog = s => coastalLog(s).filter(t => /^Harbor Gunnery Round|^Land Battle vs/.test(t));
const both = firstAfterRaid(twoTargets(false, true));
const bothAtFirst = JSON.stringify(both);
`);
check('all launches precede any Land Battle even when Niagara was assigned first',
  '[both.prompt.title, both.coastal.battles.length, Object.values(both.forces).filter(f=>f.mission==="ArmySupport").map(f=>[f.troops,f.launched])]',
  ['Harbor Encounter',0,[[0,1],[0,1]]]);
run(`const bothClone = JSON.parse(bothAtFirst); through(both,'Tally'); through(bothClone,'Tally');`);
check('reloading the first Harbor prompt consumes each launch, round and Land Battle once',
  'JSON.stringify(both)===JSON.stringify(bothClone)',true);
check('Harbor uses the first available combat die and both land battles use their later dice',
  'rollLog(both).map(t => t.includes("d10 7 → D1W") ? "Harbor 7" : t.includes("d10 6 → D3W") ? "Harbor 6" : t.split(" ").at(-1))',
  ['Harbor 7','Harbor 6','43.','25.']);
check('both targets receive their own launched Troops and surviving supporting guns',
  'both.coastal.battles.map(b=>[b.zone,b.troops,b.lg,b.roll,b.result])', [['NIA',1,2,43,'AS'],['SAC',1,1,25,'DR']]);
run(`const reversed = firstAfterRaid(twoTargets(true, true)); through(reversed,'Tally');
const unopposed = firstAfterRaid(twoTargets(false, false)); through(unopposed,'Tally');`);
check('reversing the initial Force order still resolves Harbor before either Land Battle',
  'rollLog(reversed).map(t=>t.startsWith("Harbor")?"H":"L")',['H','H','L','L']);
check('undefended port consumes no Harbor combat dice; the original order remains for the battles',
  '[rollLog(unopposed).filter(t=>t.startsWith("Harbor")).length,unopposed.coastal.battles.map(b=>b.zone)]',[0,['NIA','SAC']]);
run(`const oneZone = coastStart('BR',210316);
oneZone.troops.BR.track=[8];oneZone.troops.BR.available=0;
support(oneZone,'BR','NIA',['wolfe'],1);support(oneZone,'BR','NIA',['rg'],1);
nextCards(oneZone,[1]);run(oneZone);through(oneZone,'Tally');`);
check('two Forces landing at one target combine into one battle and draw one Event',
  '[oneZone.coastal.battles.map(b=>[b.zone,b.troops,b.lg]),oneZone.eventsDrawn.length]', [[['NIA',2,3]],1]);

run(`function blockade(available, human='BR') {
  const s = coastStart(human,210143);
  s.ships.sss.owner='US';
  for(const sh of sideShips(s,'BR')) {sh.box='repairing';sh.steps=def(sh).red[4];}
  s.ships.beres.isolated=true;s.ships.beres.port='temp';
  s.ships.wolfe.box=human==='BR'?'transit':'deployable';s.ships.wolfe.steps=human==='BR'&&!available?2:3;
  if (human==='US'){s.ships.rg.box='transit';s.ships.rg.steps=available?3:2;}
  newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam']);
  newForce(s,'US','YOR','Patrol',['pike','sylph','conquest']); newForce(s,'US','YOR','Raid',['sss']);
  s.zones.KIN.control='US';s.zones.KIN.blockade='US';s.zones.YOR.control='US';
  addVP(s,'BR',25,'Earlier campaign scoring');s.flagship.BR='wolfe';nextCards(s,[1]);run(s);return s;
}
function resolveReset(s) {through(s,'Tally');act(s,'ok');return s;}
const blockCan=resolveReset(blockade(true)), blockCannot=resolveReset(blockade(false));
const aiCan=resolveReset(blockade(true,'US'));
const tied=blockade(true,'US'); tied.ships.rg.box='repairing';tied.ships.rg.steps=2;
tied.ships.moira.box='transit';tied.ships.moira.steps=2;resolveReset(tied);
const isolated=blockade(true);isolated.ships.wolfe.isolated=true;isolated.ships.wolfe.port='temp';resolveReset(isolated);
const single=blockade(false);single.ships.sss.steps=1;resolveReset(single);
const september=blockade(false);september.turn=7;resolveReset(september);
`);
check('a full-strength home In Transit ship prevents premature decisive defeat',
  '[blockCan.over, blockCan.ships.wolfe.box,blockCan.zones.YOR.blockade]',[false,'deployable','US']);
check('a Reduced home In Transit ship cannot prevent Dual Blockade',
  '[blockCannot.over,blockCannot.result.forced,blockCannot.result.score,blockCannot.ships.wolfe.box]',[true,'US',-21,'transit']);
check('the A.I. compares the actual on-station seven Carronades against its eight at the port after F7',
  '[aiCan.over,aiCan.ships.rg.box]',[false,'deployable']);
check('equal strength at the end of F7 still fails the strict A.I. comparison',
  '[tied.over,tied.result.forced]',[true,'US']);
check('a full ship at the temporary port cannot break out of Kingston',
  '[isolated.over, isolated.result.forced, isolated.ships.wolfe.port]',[true,'US','temp']);
check('three full Main Ships at York cannot complete the second Blockade',
  '[single.over,single.zones.KIN.blockade,single.zones.YOR.blockade]',[false,'US',null]);
check('a genuine Dual Blockade still outranks ordinary September II scoring',
  '[september.result.forced,september.result.score<0]', ['US',true]);

run(`function hotShot(event, steps, isolated) {
  const s=coastStart('BR',210723);s.troops.BR.track=[7,8];s.troops.BR.available=0;
  support(s,'BR','NIA',['wolfe','rg'],1);s.ships.wolfe.steps=steps;
  if (isolated){s.ships.wolfe.isolated=true;s.ships.wolfe.port='temp';s.zones.KIN.blockade='US';
    newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam']);s.zones.KIN.control='US';}
  newForce(s,'BR','SOU','Raid',['moira']);nextCards(s,[1,event]);s.rng=7;run(s);return resolveReset(s);
}
const heatedLast=hotShot(23,1,false), heatedZero=hotShot(24,0,true), heatedFull=hotShot(23,3,false), plain=hotShot(1,1,false);
`);
check('Heated Shot on Last Step Wolfe retains the Damage marker and discards her Last Step at F7',
  '[heatedLast.ships.wolfe.box,heatedLast.ships.wolfe.steps,heatedLast.ships.wolfe.flags]', ['ordinary',2,{damaged:true}]);
check('Heated Shot also removes No Steps on the Reduced face and returns an isolated ship to its own port',
  '[heatedZero.ships.wolfe.box,heatedZero.ships.wolfe.steps,heatedZero.ships.wolfe.port]',['ordinary',2,'temp']);
check('an undamaged full ship hit by Heated Shot retains her face and receives the Damage marker',
  '[heatedFull.ships.wolfe.box,heatedFull.ships.wolfe.steps,heatedFull.ships.wolfe.flags.damaged]', ['ordinary',3,true]);
check('without Heated Shot a Reduced ship returns to In Transit with its printed Reduced steps',
  '[plain.ships.wolfe.box,plain.ships.wolfe.steps]',['transit',2]);
run(`function tempAttack(side) {
 const s=coastStart(side,210414);const enemy=OTHER[side];
 const isolated=s.ships[enemy==='US'?'oneida':'beres'];isolated.port='temp';isolated.isolated=true;isolated.box='repairing';
 s.zones[homeZone(enemy)].blockade=side;s.troops[side].available=0;s.troops[side].track=[7,8];
 support(s,side,TEMP_HOMEPORT_ZONE[enemy],[side==='BR'?'wolfe':'madison'],1);nextCards(s,[1]);run(s);return s;
}
const charlotte=tempAttack('BR'), york=tempAttack('US');`);
check('British land battle names the targeted temporary homeport Charlotte',
  'charlotte.prompt.text.includes("Land Battle vs Charlotte:")',true);
check('American land battle names the targeted temporary homeport York',
  'york.prompt.text.includes("Land Battle vs York:")',true);
check('the status advances from Harbor to the land battle actually on screen',
  '((s)=>{through(s,"Land Battle result"); return s.stepLabel;})(JSON.parse(bothAtFirst))','E6.3 Your Land Battles');
run(`function harborFlags(human, cursor, adjacent=true) {
 const s=coastStart(human,210512);deployable(s,'US').forEach(sh=>{sh.box='makeReady';});
 s.ships.madison.box='deployable';s.ships.oneida.box='deployable';
 support(s,'BR','SAC',adjacent?['wolfe','rg']:['wolfe'],1);s.rng=cursor;run(s);act(s,'ok');return s;
}
const transfer=harborFlags('BR',6), accept=JSON.parse(JSON.stringify(transfer)), decline=JSON.parse(JSON.stringify(transfer));
if(accept.prompt.options.some(o=>o.id==='rg')) act(accept,'rg');
if(decline.prompt.options.some(o=>o.id==='stay')) act(decline,'stay');
const reloaded=JSON.parse(JSON.stringify(transfer));if(reloaded.prompt.options.some(o=>o.id==='rg'))act(reloaded,'rg');
const simultaneous=harborFlags('US',67);if(simultaneous.prompt.options.some(o=>o.id==='oneida'))act(simultaneous,'oneida');
const wounded=harborFlags('BR',4), alone=harborFlags('BR',6,false);
`);
check('an unhurt commodore whose Harbor flagship was Reduced gets the adjacent full ship as a choice',
  '[transfer.prompt.title,transfer.prompt.options.map(o=>o.id)]',['Transfer the flag?',['stay','rg']]);
check('accepting transfers Yeo on 2d6 2; reloading the pending decision is exact',
  '[accept.flagship.BR,accept.prompt.text.includes("2d6 2"),JSON.stringify(reloaded)===JSON.stringify(accept)]',['rg',true,true]);
check('declining leaves the flag and RNG untouched',
  '[decline.flagship.BR,decline.rng===transfer.rng]',['wolfe',true]);
check('wounded leaders cannot attempt transfer and a lone ship has no destination',
  '[wounded.leader.BR.wounded,wounded.prompt.title,alone.prompt.title]',[true,'Harbor Encounter','Harbor Encounter']);
check('simultaneous damage permits the human defender to transfer before the A.I. attacker restores its own command',
  '[simultaneous.flagship.US,simultaneous.flagship.BR,simultaneous.prompt.text.includes("2d6 5"),simultaneous.prompt.text.includes("2d6 8")]',['oneida','rg',true,true]);
console.log(`${passed} coastal/tally assertions passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
