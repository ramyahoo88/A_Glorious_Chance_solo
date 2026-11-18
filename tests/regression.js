// Regression tests for the v0.2.1 rules fixes (audit of v0.2.0, Nov 2026). node tests/regression.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'files.json'))).engine;
const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();';
const ctx = { console, Math, JSON, Object, Array, String, Number, Error };
vm.createContext(ctx); vm.runInContext(src, ctx);
const X = e => vm.runInContext(e, ctx);
let pass = 0, fail = 0;
const eq = (n, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; console.log('FAIL', n, JSON.stringify(g), 'want', JSON.stringify(w)); } };
const ok = (n, cond, info) => eq(n + (info ? ` (${info})` : ''), !!cond, true);
const base = `s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0}; s.coastal={raids:[],battles:[],cutouts:[]}; s.targetRow=[]; s.pe=[]; s.convoyDeployed={US:null,BR:null}; s.eventsDrawn=[]; s.turnFlags={};`;
const drain = n => X(`run(${n}); var __g=0; while(${n}.prompt && __g++<80){ if(${n}.prompt.kind==='info') act(${n},'ok'); else break; }`);
const enc = (zone, ids) => `s.encounter={zone:'${zone}',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},log:[]}; ${JSON.stringify(ids)}.forEach(id=>encAdd(s,id));`;

// F1 – 7.1 Upgrade Checks when the A.I. British break out (U.S. campaign); none under OA1
let up = 0, upOA1 = 0;
for (let seed = 1; seed <= 40; seed++) {
  for (const oa1 of [false, true]) {
    X(`var s=newGame('US',${seed},{oa1Upgrades:${oa1}}); s.turn=2; ${base} s.zones.KIN.blockade='US'; s.zones.KIN.control='US';
       newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam','conquest']);
       s.calls=[{proc:'encounter',pc:'start',A:{zone:'KIN',kind:'breakout',breakoutSide:'BR',startAt:'event'},L:{}}]; run(s);`);
    const n = X(`['wolfe','rg','moira','beres'].filter(id=>s.ships[id].ver==='B').length`);
    if (oa1) upOA1 += n; else up += n;
  }
}
ok('F1 breakout Upgrade Checks happen', up > 40 && up < 120, `${up} of 160`);
eq('F1 no breakout Upgrade Checks under OA1', upOA1, 0);

// F2 – a Withdrawal takes ships that Disengaged in an earlier round
X(`var s=newGame('US',3); s.turn=2; ${base}
   newForce(s,'BR','NOR','Patrol',['wolfe','rg','moira']); newForce(s,'US','NOR','Patrol',['madison','oneida']);
   ${enc('NOR', ['wolfe', 'rg', 'moira', 'madison', 'oneida'])}
   s.ships.moira.steps=1; s.encounter.ships.moira='dis'; s.ships.rg.steps=2;
   doWithdrawal(s,'BR',['rg'],['rg']); resolveEncounterEnd(s);`);
eq('F2 earlier-Disengaged ship withdraws', X(`[s.ships.moira.box, s.ships.moira.zone]`), ['transit', null]);
eq('F2 ship that just failed its check stays', X(`[s.ships.rg.box, s.ships.rg.zone]`), ['lake', 'NOR']);
eq('F2 Engaged ship withdraws', X(`s.ships.wolfe.box`), 'transit');

// F3 – the human attacker gets the largest number of 2:1 matchups
X(`var s=newGame('BR',4); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','sss']); newForce(s,'US','NOR','Patrol',['tompkins','oneida']);
   ${enc('NOR', ['wolfe', 'sss', 'tompkins', 'oneida'])}`);
eq('F3 Wolfe(8)+Sir Sidney Smith(4) vs Tompkins(2)+Oneida(3)', X(`closeActionMatchups(s,['wolfe','sss'],['tompkins','oneida'],false).map(p=>p.join('-')).sort()`), ['sss-tompkins', 'wolfe-oneida']);
eq('F3 A.I. still picks by capture VP first (LC7c)', X(`closeActionMatchups(s,['wolfe','sss'],['tompkins','oneida'],true).map(p=>p.join('-'))`), ['wolfe-oneida', 'sss-tompkins']);

// F4 – 5.1 sudden death counts only ships that will really be Deployable on Sept II
const sd = (setup) => { X(`var s=newGame('US',5); s.turn=6; ${base} Object.values(s.ships).forEach(sh=>{ if(sh.owner==='BR'){ sh.box='sunk'; sh.zone=null; } }); ${setup} s.calls=[{proc:'turn',pc:'next',A:{},L:{}}]; run(s);`); return !!X('s.over'); };
eq('F4 Reduced ship In Transit only → game ends', sd(`s.ships.sss.box='transit'; s.ships.sss.steps=1;`), true);
eq('F4 repair-delayed ship only → game ends', sd(`s.ships.sss.box='repairing'; s.ships.sss.steps=1; s.ships.sss.delay=1;`), true);
eq('F4 ship repairing without delay → game continues', sd(`s.ships.sss.box='repairing'; s.ships.sss.steps=1;`), false);
eq('F4 laid-up ship (A.I. recommissions) → game continues', sd(`s.ships.sss.box='ordinary';`), false);
eq('F4 full-strength ship In Transit → game continues', sd(`s.ships.sss.box='transit';`), false);

// F5 – 14.2 Dual Blockade uses the A.I. Breakout test (Carronade in port vs blockaders)
const dual = (inPort) => {
  X(`var s=newGame('US',21); s.turn=3; ${base} s.troops.US.available=0;
     Object.values(s.ships).forEach(sh=>{ if(sh.owner==='BR' && ${JSON.stringify(inPort)}.indexOf(sh.id)<0) sh.box='sunk'; });
     s.ships.sss.owner='US'; s.ships.sss.box='deployable'; s.ships.pike.box='deployable'; s.ships.sylph.box='deployable';
     newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam']); newForce(s,'US','YOR','Patrol',['pike','sylph','conquest','sss']);
     s.zones.KIN.control='US'; s.zones.YOR.control='US'; s.zones.KIN.blockade='US'; s.zones.YOR.blockade='US';
     s.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
  drain('s'); return X('s.suddenDeath || null');
};
eq('F5 Wolfe alone (Car 4 vs 7) → U.S. Decisive Victory', dual(['wolfe']), 'US');
eq('F5 Wolfe + Royal George (Car 8 vs 7) → game goes on', dual(['wolfe', 'rg']), null);

// F6 – Commanding Breeze affects only its own Encounter
X(`var s=newGame('US',22); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['madison']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['madison', 'wolfe'])} applyLakeEvent(s,EVENTS[37],'NOR'); var during=!!s.zones.NOR.flags.breeze; resolveEncounterEnd(s); s.encounter=null;`);
eq('F6 Breeze active during, gone after', X(`[during, !!s.zones.NOR.flags.breeze]`), [true, false]);

// F7 – Close Action (Wolfe CA 8 vs Oneida CA 3): a hit defender that stays Engaged goes on to a Melee; a Disengaged one does not
let stayedN = 0, meleeOk = 0, disN = 0, disMelee = 0, hits = 0;
for (let seed = 1; seed <= 400; seed++) {
  X(`var s=newGame('US',${seed}); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe']); newForce(s,'US','NOR','Patrol',['oneida','madison']);
     ${enc('NOR', ['wolfe', 'oneida', 'madison'])}
     s.combat={att:'BR',def:'US',seq:'B',pos:4,segment:'patrol',col:{US:['oneida','madison'],BR:['wolfe']},tows:{},tac:{att:null,def:null},gr:2,newSeq:false,roundAttackers:['wolfe'],openGaps:false};
     s.log=[]; s.calls=[{proc:'combat',pc:'ca2',A:{},L:{caAtt:['wolfe']},answer:'attack'}]; run(s); var L=s.log.map(x=>x.text);`);
  if (!X(`L.some(t=>/– HIT/.test(t))`)) continue;
  hits++;
  const st = X(`s.encounter.ships.oneida`), melee = X(`L.some(t=>/MELEE/.test(t))`);
  if (st === 'in' || st === 'cap') { stayedN++; if (melee) meleeOk++; }
  if (st === 'dis') { disN++; if (melee) disMelee++; }
}
ok('F7 sample has hits that stay Engaged', stayedN > 5 && disN > 5);
console.log(`  F7 sample: ${hits} hits, ${stayedN} stayed Engaged (all Meleed), ${disN} Disengaged`);
eq('F7 every hit-and-still-Engaged defender is Meleed', meleeOk, stayedN);
eq('F7 no Melee after a successful Disengagement', disMelee, 0);

// F8 – British campaign: "Attack British Convoy" only in Enemy Operations; U.S. campaign unchanged
X(`var s=newGame('BR',23); s.turn=0; ${base} s.convoys.BR[0]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.BR[1]={real:false,revealed:true};`);
eq('F8 British campaign, Lake Action', X(`effectiveMission(s,TARGET_CARDS['B21'],'lake').mission`), 'Patrol');
eq('F8 British campaign, Enemy Operations', X(`effectiveMission(s,TARGET_CARDS['B21'],'enemy').mission`), 'AttackConvoy');
X(`var s=newGame('US',23); s.turn=0; ${base} s.convoys.US[0]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[1]={real:false,revealed:true};`);
eq('F8 U.S. campaign, Lake Action unchanged', X(`effectiveMission(s,TARGET_CARDS['A31'],'lake').mission`), 'AttackConvoy');

// F9 – 9.1.2: no Convoy Encounter while the Sacket's Lake Zone is Blockaded
X(`var s=newGame('BR',24); s.turn=1; ${base} s.convoys.US[1]={real:true,revealed:false,delay:false,deployed:false,result:null};`);
eq('F9 Escort card, no Blockade', X(`effectiveMission(s,TARGET_CARDS['B2'],'lake').mission`), 'Escort');
X(`s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';`);
eq("F9 Escort card, Sacket's Blockaded", X(`effectiveMission(s,TARGET_CARDS['B2'],'lake').mission`), 'Patrol');

// R1 – unmaintained Blockade: no blockaders on station → the Convoy runs on schedule (player ruling)
X(`var s=newGame('US',11); s.turn=2; ${base} s.troops.US.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   s.convoys.US[2]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:true};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}];`); drain('s');
eq('R1 no blockaders: Blockade lapses, Convoy +2 this turn', X(`[s.zones.SAC.blockade, s.supply.US, s.pendingConvoy.US.length]`), [null, 3, 0]);
X(`var s=newGame('US',12); s.turn=2; ${base} s.troops.US.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   newForce(s,'BR','SAC','Patrol',['wolfe']);
   s.convoys.US[2]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:true};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}]; run(s);`);
eq('R1 blockader present: you are asked to break out', X(`s.prompt && s.prompt.title`), 'D Breakout Attack?');
X(`act(s,'pass');`);
eq('R1 …and passing delays the Convoy', X(`s.convoys.US[2].delay`), true);
X(`var s=newGame('BR',13); s.turn=2; ${base} s.troops.BR.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   s.convoys.US[2]={real:true,revealed:false,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:false};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}]; run(s);`);
eq('R1 A.I. side: no blockaders → A.I. Convoy not delayed', X(`!!s.convoys.US[2].delay`), false);

console.log(`regression tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
