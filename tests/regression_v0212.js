// Replay the reported natural positions, then isolate casualty and convoy boundaries.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const order = JSON.parse(fs.readFileSync(path.join(root, 'tools/files.json'))).engine.concat('ui.js');
const source = order.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n');
const ctx = vm.createContext({ console, Date });
const x = code => vm.runInContext(code, ctx);
x(source + '\n;installResume();');
const E = x('({newGame, newForce, encAdd, act, checkSaveState, PROCS, applyHits, scatterRoll, convoySupply, beginLeaderResult, endLeaderResult, leaderAlive, commandDRMAvailable, originalLeaderOk, flagTransferOptions})');
const copy = o => JSON.parse(JSON.stringify(o));
let passed = 0;
function check(name, actual, expected) { assert.deepEqual(copy(actual), expected, name); passed++; }
const fixtures = path.join(root, 'audits/2026-11-19-v0.2.11/evidence/targeted');
const read = name => JSON.parse(fs.readFileSync(path.join(fixtures, name + '.json')));
const replayResults = {};
for (const [name, answer] of [['melee-loser-before', 'ok'], ['double-leader-before', 'attack'], ['zero-guns-before', 'ok']]) {
  const s = E.checkSaveState(read(name)), re = E.checkSaveState(copy(s)), n = s.log.length;
  E.act(s, answer); E.act(re, answer);
  check(name + ' exact restored continuation', s, copy(re));
  replayResults[name] = { leader: copy(s.leader), rng: s.rng, lines: s.log.slice(n).map(l => l.text) };
  if (name === 'melee-loser-before') {
    check('Natural Melee checks losing Chauncey with +2', replayResults[name].lines.some(t => /Chauncey\): 2d6 4\+2/.test(t)), true);
    check('Both original leaders removed once', [s.leader.US.seq, s.leader.BR.seq], [1, 1]);
  } else if (name === 'double-leader-before') {
    check('Three simultaneous hits remove only Chauncey', s.leader.US.seq, 1);
    check('Sinclair is never checked or captured in the same result', replayResults[name].lines.some(t => /\(Capt. Sinclair\)|Sinclair is (KILLED|CAPTURED)/.test(t)), false);
    check('No deferred replacement leaks past the result', 'leaderResult' in s, false);
  } else {
    check('Zero-gun natural Convoy has no attack result', s.convoys.US[s.turn].result, null);
    check('No scatter roll appears in the natural replay', replayResults[name].lines.some(t => /Scatter Table/.test(t)), false);
  }
}

const originals = x('({d6, d10, d10r, twoD6})');
function dice(spec) {
  const used = [];
  for (const name of Object.keys(originals)) {
    const queue = (spec[name] || []).slice();
    ctx[name] = () => { assert(queue.length, 'Unexpected ' + name); const value = queue.shift(); used.push([name, value]); return value; };
  }
  return used;
}
function board(us = ['fairam'], br = ['rg']) {
  const s = E.newGame('US', 951119);
  s.turn = 4; s.phase = 'lake'; s.lossesThisTurn = [];
  E.newForce(s, 'US', 'NOR', 'Patrol', us); E.newForce(s, 'BR', 'NOR', 'Patrol', br);
  s.encounter = { zone: 'NOR', kind: 'normal', segment: 'patrol', ships: {}, side: {}, flagIn: {}, withdrawn: {US:false,BR:false} };
  us.concat(br).forEach(id => E.encAdd(s, id));
  s.combat = { att: 'BR', def: 'US', col: { US: us, BR: br }, tows: {}, tac: { att:null,def:null }, pos:0 };
  s.flagship.US = us[0]; s.flagship.BR = br[0]; s.ships.rg.ver = 'B';
  return s;
}
// Unscripted newGame consumes its normal initialization dice; stub only after setup.
function resetDice() { Object.assign(ctx, originals); }
for (const test of [
  {label:'both flags, surviving loser captured', winner:true, loser:true, rolls:[6,6], checks:2},
  {label:'losing commander killed before capture', winner:false, loser:true, rolls:[9], checks:1},
  {label:'winning commander alone', winner:true, loser:false, rolls:[6], checks:1},
  {label:'no participating flagships', winner:false, loser:false, rolls:[], checks:0},
  {label:'Grapple adds two to U.S. loser', winner:false, loser:true, rolls:[7], checks:1, grapple:true},
]) {
  resetDice(); const s = board();
  if (!test.winner) s.flagship.BR = 'wolfe';
  if (!test.loser) s.flagship.US = 'madison';
  s.combat.grapple = !!test.grapple;
  const rolls = dice({d10r:[10], d6:test.grapple?[6,5,1]:[6,1], twoD6:test.rolls});
  const f = { answer:'attack', L:{caAtt:['rg']} };
  E.PROCS.combat.ca2(s, f);
  check(test.label + ': casualty rolls', rolls.filter(r=>r[0]==='twoD6').length, test.checks);
  check(test.label + ': ship captured', s.ships.fairam.owner, 'BR');
  if (test.loser) {
    check(test.label + ': original leader removed while successor waits', [s.leader.US.seq,E.leaderAlive(s,'US')], [0,false]);
    check(test.label + ': losing +2 / Grapple +4', f.L.lines.some(t=>t.includes('Chauncey') && t.includes(test.grapple?'+4':'+2')), true);
  }
  E.PROCS.combat.roundResults(s,f);
  check(test.label + ': one succession', s.leader.US.seq, test.loser?1:0);
  check(test.label + ': closed result context', 'leaderResult' in s, false);
}
resetDice(); {
  const s=board(); s.ships.rg.ver='A';
  const f={answer:'attack',L:{caAtt:['rg']}};
  const used=dice({d10r:[10],d6:[1,6]});
  E.PROCS.combat.ca2(s,f);
  check('No-result Melee makes no casualty checks', used.map(r=>r[0]), ['d10r','d6','d6']);
  check('No-result Melee leaves both leaders', [s.leader.US.seq,s.leader.BR.seq], [0,0]);
  check('No-result Melee log',f.L.lines.some(t=>t.includes('boarders repelled')),true);
  E.PROCS.combat.roundResults(s,f);
}

// A dead commander cannot supply the original-leader Strike DRM or transfer.
for (const strike of [5,10]) {
  resetDice(); const s=board(['madison'],['rg']); const lines=[];
  dice({twoD6:[11],d10r:[strike]});
  E.beginLeaderResult(s); E.applyHits(s,'US',{madison:3},{round:'GR'},lines);
  check('Only starting leader checked, Strike '+strike,lines.filter(t=>t.startsWith('Leader Casualty Check')).length,1);
  check('Killed original supplies no Strike DRM, Strike '+strike,lines.some(t=>t.includes('Strike Check '+strike+' –')),true);
  check('Dead original never scheduled for later capture, Strike '+strike,!!s.encounter.leaderFate?.madison,false);
  check('Successor still waits through Strike, '+strike,s.leader.US.seq,0);
  E.endLeaderResult(s);check('One replacement after Strike '+strike,s.leader.US.seq,1);
}
resetDice(); {
  const s=board(['madison','oneida'],['rg']), lines=[];
  dice({twoD6:[11],d6:[6]});
  E.beginLeaderResult(s); E.applyHits(s,'US',{madison:1},{round:'GR'},lines);
  check('No post-casualty transfer in this result',E.flagTransferOptions(s,'US'),[]);
  check('No command/Strike DRM while commander is dead',[E.commandDRMAvailable(s,'US'),E.originalLeaderOk(s,'US')],[false,false]);
  // Pause at a genuine procedure continuation; export/import keeps deferred succession.
  s.calls=[{proc:'combat',pc:'withdraw2',A:{},L:{lines,wQueue:[],failedDis:{US:[],BR:[]},hit:{}}}];
  s.prompt={kind:'choice',title:'Withdrawal result against you',options:[{id:'stay',label:'Ignore – fight on'}]};
  resetDice();
  const saved=E.checkSaveState(copy(s));
  check('Pending successor survives save/load',saved.leaderResult,{US:'killed'});
  E.act(saved,'stay');
  check('Loaded Withdrawal completes replacement once',[saved.leader.US.seq,!!saved.leaderResult],[1,false]);
  check('Replacement can use a later transfer opportunity',E.flagTransferOptions(saved,'US'),['oneida']);
}
resetDice(); {
  const s=board(['madison'],['rg']), lines=[];
  dice({twoD6:[6,10,6],d10r:[2]});
  E.applyHits(s,'US',{madison:3},{round:'GR'},lines);
  check('Living commander takes every per-hit check',lines.filter(t=>t.startsWith('Leader Casualty Check')).length,3);
  check('Wounded original stays wounded without succession',[s.leader.US.seq,s.leader.US.wounded],[0,true]);
}
for (const n of [0,1,21]) {
  resetDice(); const s=E.newGame('BR',951120);s.convoys.US[0]={real:true,result:null}; const rng=s.rng;
  const used=dice({d10:n?[0]:[]}); const result=E.scatterRoll(s,'US',n,'test force');
  check(n+' guns: die count',used.length,n?1:0);
  check(n+' guns: printed row result at d10 0',result.res,n===0?null:'S');
  if(!n){
    check('Zero guns preserves RNG',s.rng,rng);
    E.convoySupply(s,'US',()=>{});
    check('Unaffected convoy arrives for +2 supply',[s.supply.US,s.pendingConvoy.US.length],[3,0]);
  }
}
resetDice();
{
  const s=board(['madison'],['rg']); s.encounter.convoySide='US';
  s.convoys.US[s.turn]={real:true,result:null};
  s.ships.madison.steps--; // the escort has been reduced during combat
  const rng=s.rng; s.ships.rg.steps--;
  check('No full-strength attacker after escort battle',E.PROCS.encounter.convoyCheck(s,{}),{goto:'end'});
  check('Reduced attackers neither roll nor scatter',[s.rng,s.convoys.US[s.turn].result],[rng,null]);
  s.ships.rg.steps=3; // full B-version Royal George can attack the reduced escort
  const used=dice({d10:[0]});E.PROCS.encounter.convoyCheck(s,{});
  check('A surviving full-strength attacker makes the printed scatter roll',used,[['d10',0]]);
}
resetDice();
if (process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(replayResults,null,2)+'\n');
console.log(`v0.2.12 combat/convoy: ${passed} assertions passed.`);
