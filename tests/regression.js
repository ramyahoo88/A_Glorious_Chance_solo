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

// ===== v0.2.2: findings from the independent audit of v0.2.1 (G01–G10) =====
const sayNull = `function(){}`;

// G01 – a Scattered Convoy is delayed, not lost (Living Playbook p.16-17)
X(`var s=newGame('US',1); ${base} s.supply.US=1; s.turn=0; s.convoys.US[0]={real:true,revealed:true,delay:false,deployed:true,result:'S'}; s.convoys.US[1]={real:false,revealed:true};
   convoySupply(s,'US',${sayNull}); var g1a=s.supply.US; s.pendingConvoy.US.forEach(p=>{ if(p.status==='delayed' && !isBlockaded(s,'US')) p.status='arrived'; });
   s.turn=1; convoySupply(s,'US',${sayNull});`);
eq('G01 Scattered Convoy: no advance that turn, +2 the next', X(`[g1a, s.supply.US, s.pendingConvoy.US.length]`), [1, 3, 0]);
X(`var s=newGame('US',1); ${base} s.supply.US=1; s.turn=0; s.convoys.US[0]={real:true,revealed:true,result:'D'}; convoySupply(s,'US',${sayNull});`);
eq('G01 Destroyed Convoy stays lost', X(`[s.supply.US, s.pendingConvoy.US.length]`), [1, 0]);

// G02 – return fire on the attacker only hits ships attacking in this Round (Reduced Wolfe stays behind)
let g2wolfe = 0, g2rg = 0, g2col = 0;
for (let seed = 1; seed <= 30; seed++) {
  X(`var s=newGame('BR',${seed}); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','rg']); newForce(s,'US','NOR','Patrol',['pike']); s.ships.wolfe.steps=2;
     ${enc('NOR', ['wolfe', 'rg', 'pike'])}
     s.combat={att:'BR',def:'US',seq:'B',pos:1,segment:'patrol',col:{BR:['wolfe','rg'],US:['pike']},tows:{},tac:{att:null,def:null},gr:1,newSeq:false,roundAttackers:['rg']};
     s.log=[]; s.calls=[{proc:'combat',pc:'grApply',A:{},L:{st:'GR2',txt:'test',res:{aHits:1,dHits:0}}}]; run(s);`);
  if (X(`s.ships.wolfe.steps`) !== 2) g2wolfe++;
  if (X(`s.ships.rg.steps`) < 3) g2rg++;
  if (X(`s.log.some(l=>l.text.indexOf('hit distribution (1-ship column')>=0)`)) g2col++;
}
eq('G02 Reduced Wolfe (not attacking) never hit; Royal George always hit; 1-ship column', [g2wolfe, g2rg, g2col], [0, 30, 30]);

// G03 – printed Hit Distribution columns 13-18 (British Living Rulebook p.32)
eq('G03 13 ships, roll 12 → #2', X(`hitPosition(13,1,2)`), 2);
eq('G03 13 ships, roll 11 → #1; 66 → #13', X(`[hitPosition(13,1,1),hitPosition(13,6,6)]`), [1, 13]);
eq('G03 14 ships, rolls 65/66 → #13/#14', X(`[hitPosition(14,6,5),hitPosition(14,6,6)]`), [13, 14]);
eq('G03 15 ships, roll 31 → #7 (four-roll block)', X(`hitPosition(15,3,1)`), 7);
eq('G03 18 ships, rolls 11/12/66 → #1/#1/#18', X(`[hitPosition(18,1,1),hitPosition(18,1,2),hitPosition(18,6,6)]`), [1, 1, 18]);

// G04 – Intelligence benefits one Encounter with the enemy Flagship, then is used up
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['rg']); ${enc('NOR', ['oneida', 'rg'])}
   var g4a=intelligenceApplies(s,'US'); resolveEncounterEnd(s); s.encounter=null; var g4b=!!s.intelligence.US;`);
eq('G04 Encounter without the enemy Flagship: not used, still held', X(`[g4a, g4b]`), [false, true]);
X(`newForce(s,'BR','YOR','Patrol',['wolfe']); newForce(s,'US','YOR','Patrol',['madison']); ${enc('YOR', ['wolfe', 'madison'])}
   var g4c=intelligenceApplies(s,'US'); resolveEncounterEnd(s); s.encounter=null;
   newForce(s,'BR','SOU','Patrol',['moira']); newForce(s,'US','SOU','Patrol',['tompkins']); s.flagship.BR='moira'; ${enc('SOU', ['moira', 'tompkins'])}`);
eq('G04 used in the Encounter with Wolfe, gone for the next', X(`[g4c, s.intelligence.US, intelligenceApplies(s,'US')]`), [true, null, false]);

// G05 – Intelligence cancels the negative distance DRM but keeps Fair Wind
eq('G05 reactionDRM(distance 2, wind +2, Intelligence) = +3', X(`reactionDRM(2,2,true)`), 3);
eq('G05 without Intelligence = 0; same zone with Intelligence = +2', X(`[reactionDRM(2,2,false), reactionDRM(0,0,true), reactionDRM(1,0,true)]`), [0, 2, 1]);
X(`var s=newGame('BR',1); s.turn=2; ${base} s.intelligence.BR={card:29,until:2}; s.flagship.US='oneida'; s.zones.NOR.event=8;
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   var g5=humanReactionCandidates(s).find(c=>c.key==='home');`);
eq('G05 Kingston ships reacting into North Lake with Fair Wind + Intelligence: DRM', X(`g5 && g5.drm`), 3);

// G07 – a Reduced Flagship that has just Disengaged can still shift the flag (Playbook p.19)
X(`var s=newGame('BR',1); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','rg']); newForce(s,'US','NOR','Patrol',['madison']);
   ${enc('NOR', ['wolfe', 'rg', 'madison'])} s.ships.wolfe.steps=2; s.encounter.ships.wolfe='dis';
   s.combat={att:'US',def:'BR',seq:'A',pos:0,col:{BR:['wolfe','rg'],US:['madison']},tows:{},tac:{att:null,def:null},gr:1};`);
eq('G07 just-Disengaged Flagship may transfer to adjacent Royal George', X(`flagTransferOptions(s,'BR')`), ['rg']);
X(`s.leader.BR.wounded=true;`);
eq('G07 …but not if the Leader is wounded', X(`flagTransferOptions(s,'BR')`), []);

// G08 – Troops are whole markers
X(`var s=newGame('BR',2); s.turn=1; ${base} s.troops.BR.available=2; var pa=buildAssignPrompt(s);`);
eq('G08 1.5 Troops refused', X(`validateAssignment(s,pa,{flagship:'wolfe',forces:[{zone:'NIA',mission:'ArmySupport',ships:['wolfe'],troops:1.5}]})`), 'Troops must be a whole number of markers');
eq('G08 2 Troops accepted', X(`validateAssignment(s,pa,{flagship:'wolfe',forces:[{zone:'NIA',mission:'ArmySupport',ships:['wolfe'],troops:2}]})`), null);
eq('G08 Land Battle lookup survives a stray fraction', X(`lbLookup(0,1.5,0,35).troops`), 1);

// G09 – a W result still lets a human Force whose ships have all Disengaged withdraw
X(`var s=newGame('US',1); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['oneida', 'wolfe'])} s.ships.oneida.steps=1; s.encounter.ships.oneida='dis';
   s.combat={att:'BR',def:'US',seq:'B',pos:1,col:{BR:['wolfe'],US:[]},tows:{},tac:{att:null,def:null},gr:1};
   s.calls=[{proc:'combat',pc:'withdraw',A:{},L:{wQueue:['US'],lines:['test'],failedDis:{US:[],BR:[]},hit:{US:['oneida'],BR:[]}}}]; run(s);`);
eq('G09 Withdrawal choice offered', X(`s.prompt && s.prompt.title`), 'Withdrawal result against you');
X(`act(s,'withdraw'); resolveEncounterEnd(s);`);
eq('G09 …and Oneida goes to In Transit', X(`s.ships.oneida.box`), 'transit');

// G10 – the lineup preview and the first Round use the same ships (Missed Signal)
X(`var s=newGame('US',1); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['madison','oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['madison', 'oneida', 'wolfe'])} s.zones.NOR.flags.missedSignal='madison';`);
eq('G10 Missed Signal ship known before the attack', X(`missedSignalShip(s)`), 'madison');
X(`s.combat={att:'US',def:'BR',seq:'A',pos:0,segment:'patrol',col:{US:[],BR:[]},tows:{},tac:{att:null,def:null},gr:0,newSeq:false,roundAttackers:[]};
   s.calls=[{proc:'combat',pc:'assemble2',A:{},L:{},answer:{attackers:['madison','oneida'],tows:{}}}]; run(s);`);
eq('G10 …and she is the one left out of the first Round', X(`[s.combat.col.US, s.combat.sitting && s.combat.sitting.id, missedSignalShip(s)]`), [['oneida'], 'madison', null]);

// ===== v0.2.3: re-audit of v0.2.2 (R01 save validation, R02 Intelligence lifetime) =====
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8'), ctx);   // checkSaveState
const refused = code => X(`(function(){ try { checkSaveState(${code}); return 'accepted'; } catch (e) { return 'refused'; } })()`);
X(`var g=newGame('US',181123); run(g); var __n=0; while(g.prompt && g.prompt.kind==='info' && __n++<20) act(g,'ok'); var gtxt=JSON.stringify(g);`);
eq('R01 a valid mid-game save is accepted', refused(`JSON.parse(gtxt)`), 'accepted');
eq('R01 unknown procedure step refused', refused(`(function(){ var x=JSON.parse(gtxt); x.calls[x.calls.length-1].pc='__audit_missing_handler__'; return x; })()`), 'refused');
eq('R01 Madison with 999 steps refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.madison.steps=999; return x; })()`), 'refused');
eq('R01 Convoy Supply 13 refused', refused(`(function(){ var x=JSON.parse(gtxt); x.supply.US=13; return x; })()`), 'refused');
eq('R01 unknown ship box refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.oneida.box='attic'; return x; })()`), 'refused');
eq('R01 unknown ship refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.nautilus=Object.assign({},x.ships.oneida,{id:'nautilus'}); return x; })()`), 'refused');
eq('R01 fractional VP refused', refused(`(function(){ var x=JSON.parse(gtxt); x.vp.US=1.5; return x; })()`), 'refused');

// R02a – Pursuit starts a new Encounter: the one that just ended uses up Intelligence first
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   s.zones.NOR.flags.breeze=true; var r2a=intelligenceApplies(s,'US');
   s.calls=[{proc:'encounter',pc:'afterCombat',A:{zone:'NOR',kind:'normal'},L:{},ret:{outcome:'pursuit'}}]; run(s);`);
eq('R02a Intelligence used by the pursued Encounter; Breeze ended; new Encounter under way', X(`[r2a, s.intelligence.US, !!s.zones.NOR.flags.breeze, !!s.encounter]`), [true, null, false, true]);
// R02b – an Encounter saved by 0.2.1 (no flagIn record) still uses Intelligence up
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   delete s.encounter.flagIn; var old=JSON.parse(JSON.stringify(s)); old.calls=[]; old.prompt=null; checkSaveState(old); var mig=old.encounter.flagIn;
   resolveEncounterEnd(s);`);
eq('R02b old save: flag record rebuilt on load, and Intelligence used at the end', X(`[mig && mig.BR, s.intelligence.US]`), [true, null]);
// R02c – drawn this turn (Coastal Action Phase): neither applies to nor is used by an Encounter until next turn
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:3};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   var r2c=intelligenceApplies(s,'US'); resolveEncounterEnd(s);`);
eq('R02c same-turn Encounter: not applied, still held for next turn', X(`[r2c, s.intelligence.US && s.intelligence.US.until]`), [false, 3]);

// ===== v0.2.4: follow-up audit of v0.2.3 (N01–N11) =====
// Board helpers (positions modelled on the auditor's evidence saves; dice states are fixed seeds)
X(`
function fresh(side, seed) { const s = newGame(side, seed); s.turn = 2; s.phase = 'lake'; s.calls = []; s.prompt = null; s.lossesThisTurn = []; s.troopsReturning = { US: 0, BR: 0 }; return s; }
function waitAt(s, proc, pc, A, L) { s.calls = [{ proc, pc, A: A || {}, L: L || {} }]; s.prompt = info('Test position', 'Continue.'); }
function stageCombat(s, zone, us, br, att) {
  att = att || 'US';
  const u = newForce(s, 'US', zone, 'Patrol', us), b = newForce(s, 'BR', zone, 'Patrol', br);
  s.encounter = { zone, kind: 'normal', segment: 'patrol', ships: {}, side: {}, struckBy: {}, withdrawn: { BR: false, US: false },
    humanForce: (s.human === 'US' ? u : b).id, aiForce: (s.ai === 'US' ? u : b).id, wg: att, wgCard: 8, firstAttack: false };
  us.concat(br).forEach(id => encAdd(s, id));
  s.zones[zone].event = 8; s.deck.event = [9].concat(s.deck.event.filter(n => n !== 8 && n !== 9));
  s.combat = { att, def: OTHER[att], seq: att === 'US' ? 'A' : 'B', pos: 0, segment: 'patrol', col: { US: us.slice(), BR: br.slice() }, tows: {}, tac: { att: null, def: null }, gr: 0, roundAttackers: [], newSeq: false };
}
function afterCombatCaller(s) { s.calls.unshift({ proc: 'encounter', pc: 'afterCombat', A: {}, L: {} }); }
function playUntil(s, stop) {
  for (let i = 0; i < 40; i++) {
    if (stop(s)) return true;
    const p = s.prompt; if (!p) return false;
    let a = 'ok';
    if (p.kind === 'choice') a = (p.options.find(o => o.primary) || p.options[0]).id;
    else if (p.kind === 'select') a = p.initial || [];
    else if (p.kind === 'lineup') a = { attackers: p.candidates, tows: p.defaultTows || {} };
    act(s, a);
  }
  return false;
}
function convoyBoard(card, pool, mission, spy) {
  const s = fresh('BR', 182301); s.options.cuttingOut = true;
  const fr = newForce(s, 'BR', 'SAC', mission || 'Patrol', ['wolfe']);
  if (mission === 'CuttingOut') s.cuttingOutUsed.BR = true;
  sideShips(s, 'US').forEach(sh => { if (sh.box === 'deployable' && pool.indexOf(sh.id) < 0) sh.box = 'ordinary'; });
  s.nb = 0; s.nbBand = 3; s.aiTroops.box = [];
  s.convoys.US[2] = { real: true, revealed: false, delay: false, deployed: false, result: null };
  s.convoys.US[3] = { real: false, revealed: false, delay: false, deployed: false, result: null };
  s.targetRow = [{ id: card, revealed: false, enc: false, removed: false }];
  s.pe = [{ num: 1, idx: 0, zone: 'SAC', forceId: fr.id, status: 'possible' }];
  const first = spy === false ? 22 : 8; s.deck.event = [first].concat(s.deck.event.filter(id => id !== first));
  waitAt(s, 'turn', 'B2'); s.rng = 1; return s;
}
function galeBoard(human) {
  const s = fresh(human, 182311);
  const b = newForce(s, 'BR', 'NIA', 'ArmySupport', ['wolfe'], { troops: 1 }), u = newForce(s, 'US', 'NIA', 'Patrol', ['oneida']);
  if (human === 'BR') { s.troops.BR.available = 0; s.troops.BR.track = [7, 8]; }
  else { s.aiTroops.track = [{ space: 7, troops: true }, { space: 8, troops: true }]; s.aiTroops.box = []; }
  s.deck.event = [30].concat(s.deck.event.filter(n => n !== 30)); s.rng = 4;
  waitAt(s, 'encounter', 'start', { zone: 'NIA', kind: 'normal', humanForces: [human === 'BR' ? b.id : u.id], aiForces: [human === 'BR' ? u.id : b.id] });
  s.calls.unshift({ proc: 'turn', pc: 'E', A: {}, L: {} }); return s;
}
`);

// N11 – Troops on a Force that a Gale wipes out come back at F7 (both campaigns)
for (const human of ['BR', 'US']) {
  X(`var s = galeBoard('${human}'); act(s, 'ok'); var galeTxt = s.prompt.text; playUntil(s, q => q.prompt && /^Reset/.test(q.prompt.title));`);
  ok(`N11 ${human === 'BR' ? 'human' : 'A.I.'} Gale wipes out the Troops' Force`, X(`!Object.values(s.forces).some(f => f.troops) && s.ships.wolfe.box !== 'lake'`), X('galeTxt').slice(0, 80));
  eq(`N11 ${human === 'BR' ? 'human' : 'A.I.'} unlaunched Troops return at F7`, X(human === 'BR' ? `s.troops.BR.available` : `s.aiTroops.box.filter(t => t.troops).length`), 1);
}
X(`var s = galeBoard('BR'); waitAt(s, 'tally', 'reset'); act(s, 'ok');`);
eq('N11 control: Troops still on a Force at F7 return', X(`s.troops.BR.available`), 1);
ok('N11 the Reset screen reports the returned Troops', X(`/1 unlaunched Troops marker\\(s\\) return/.test(s.prompt.text)`));

// N02 – a confirmed Encounter with no U.S. deployment ends your Force's Encounter: no Cutting-Out capture
for (const spy of [true, false]) {
  X(`var s = convoyBoard('B40', ['madison'], 'CuttingOut', ${spy}); s.rng = 2; act(s, 'ok');
     playUntil(s, q => q.prompt && /^Tally/.test(q.prompt.title));
     var marker = { pe: s.pe[0].status, ended: !!(s.forces.F1 && s.forces.F1.ended) };
     var vp = s.vpLog.filter(v => v.side === 'BR' && /Madison captured/.test(v.why)).reduce((a, v) => a + v.n, 0);`);
  if (spy) {
    eq('N02 confirmed Encounter, no deployment → Encounter Ended', X(`marker`), { pe: 'ended', ended: true });
    eq('N02 … and the Cutting-Out mission aborts (no capture)', X(`[s.ships.madison.owner, vp]`), ['US', 0]);
  } else {
    eq('N02 control: false alarm leaves the Force free', X(`marker`), { pe: 'discarded', ended: false });
    eq('N02 control: false alarm → Cutting-Out goes ahead', X(`[s.ships.madison.owner, vp]`), ['BR', 32]);
  }
}

// N01 – the A.I. U.S. Convoy whose escort package cannot be filled sails unescorted: Scatter Table roll
for (const [name, card, pool] of [['N01 unfilled package (B2, Oneida only)', 'B2', ['oneida']], ['N01 control: blank cell (B15)', 'B15', ['oneida']]]) {
  X(`var s = convoyBoard('${card}', ${JSON.stringify(pool)}); act(s, 'ok'); var msg = s.prompt.text;
     playUntil(s, q => q.prompt && /^Tally/.test(q.prompt.title)); var c = s.convoys.US[2];`);
  ok(`${name}: the Convoy is found unescorted`, X(`/unescorted|no A\\.I\\. warships/.test(msg) && /Convoy Scatter Table/.test(msg)`), X('msg').split('\n')[1]);
  eq(`${name}: Scatter Table result (d10 6 → Destroyed, supply stays 1)`, X(`[c.result, s.supply.US]`), ['D', 1]);
}
X(`var s = convoyBoard('B2', ['lady', 'growler']); act(s, 'ok');`);
eq('N01 control: a filled package escorts the Convoy', X(`Object.values(s.forces).find(f => f.side === 'US').ships.slice().sort()`), ['growler', 'lady']);

// N10 – Cutting-Out cannot be assigned against a port with no ships to cut out
for (const box of [null, 'makeReady', 'deployable']) {
  X(`var s = fresh('BR', 182309); s.phase = 'prep'; s.options.cuttingOut = true;
     sideShips(s, 'US').forEach(sh => { if (sh.box === 'deployable' || sh.box === 'makeReady') sh.box = 'ordinary'; });
     ${box ? `s.ships.oneida.box = '${box}';` : ''} waitAt(s, 'turn', 'A7'); act(s, 'ok');
     var p = s.prompt, err = validateAnswer(s, p, { flagship: p.flagship, forces: [{ mission: 'CuttingOut', zone: 'SAC', ships: ['wolfe'], troops: 0 }] });`);
  if (box) eq(`N10 control: Oneida in ${box} → Cutting-Out allowed`, X(`err`), null);
  else { ok('N10 empty port → Cutting-Out refused', X(`err !== null && !p.missions.CuttingOut`), X('err')); eq('N10 … and the once-per-game mission is not spent', X(`!!s.cuttingOutUsed.BR`), false); }
}

// N04 – Pursuit needs a Defender ship eligible to withdraw; Disengaged ships come back for the new Encounter
for (const mode of ['dis', 'failed']) {
  X(`var s = fresh('US', 182304); stageCombat(s, 'NOR', ['oneida'], ['moira']);
     s.combat.tac.att = { id: 'A_pursuit', used: false, negated: false }; s.deck.tacA = s.deck.tacA.filter(id => id !== 'A_pursuit'); s.tacPlayed = ['A_pursuit'];
     waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); s.rng = ${mode === 'dis' ? 15 : 12};
     act(s, 'ok'); var round = s.prompt.text; act(s, 'ok');
     var started = s.log.some(l => /Pursuit/.test(l.text) && /new Encounter/.test(l.text));`);
  ok(`N04 ${mode}: the roll is D1W`, X(`/→ D1W/.test(round)`), X('round').split('\n')[0]);
  if (mode === 'dis') {
    eq('N04 Moira passed her check → Pursuit: new Encounter with Moira back in', X(`[started, s.encounter && s.encounter.ships.moira]`), [true, 'in']);
    ok('N04 … and the new Encounter goes on (not ended for lack of ships)', X(`!/no ships left/.test(s.prompt.text)`));
  } else {
    eq('N04 Moira failed her check → nothing withdraws, Pursuit not used', X(`[started, s.combat ? s.combat.tac.att.used : null]`), [false, false]);
  }
}

// N05 – a tow counts only while the towing ship attacks in the Round
for (const [name, active] of [['N05 Madison Disengaged → Tompkins rolls as untowed', false], ['N05 control: Madison attacking → tow active', true]]) {
  X(`var s = fresh('US', 182305); stageCombat(s, 'NOR', ['madison', 'tompkins'], ['moira']);
     s.combat.col.US = ${active} ? ['madison', 'tompkins'] : ['tompkins'];
     if (!${active}) { s.encounter.ships.madison = 'dis'; s.ships.madison.steps = 2; }
     s.combat.pos = 2; s.combat.gr = 1; s.combat.tows = { madison: 'tompkins' };
     waitAt(s, 'combat', 'grDecide', {}, { st: 'GR2' });
     s.prompt = choice('Gunnery Round 2', 'Attack?', [{ id: 'attack', label: 'Attack', primary: true }, { id: 'pass', label: 'Pass' }]);
     afterCombatCaller(s); s.rng = 45; act(s, 'attack');
     var line = s.log.map(l => l.text).find(t => /^Gunnery Round 2:/.test(t)) || '';`);
  ok(name, X(`/untowed Laker/.test(line)`) === !active, X('line').slice(0, 160));
}

// N03 – Shipyard Damage 8–9 flips ships on the stocks only when there is more than one
for (const [name, ids, side, want] of [['N03 lone hull (Melville) stays full', ['melville'], 'BR', [2]], ['N03 control: two hulls (Pike, Sylph) both flipped', ['pike', 'sylph'], 'US', [2, 2]]]) {
  X(`var s = fresh('${side === 'BR' ? 'US' : 'BR'}', 182303); var ids = ${JSON.stringify(ids)};
     sideShips(s, '${side}').forEach(sh => { if (sh.box === 'construction' && ids.indexOf(sh.id) < 0) sh.box = 'makeReady'; });
     s.coastal = { raids: [], battles: [{ side: OTHER['${side}'], target: 'HOME', zone: homeZone('${side}'), result: 'AM' }], cutouts: [] }; s.phase = 'tally';
     var cd0 = s.cd['${side}']; waitAt(s, 'tally', 'start'); s.rng = 4; act(s, 'ok');`);
  ok(`${name}: 2d6 roll 8`, X(`/Shipyard Damage vs .* – 2d6 8 = 8/.test(s.prompt.text)`), X(`s.prompt.text`).split('\n')[0]);
  eq(`${name}`, X(`ids.map(i => s.ships[i].steps)`), want);
  eq(`${name}: +2 Construction Delay`, X(`s.cd['${side}'] - cd0`), 2);
}

// N06 – Last Step markers are discarded on withdrawal and at F7: back to the printed Reduced face
X(`var s = fresh('BR', 182306); stageCombat(s, 'NOR', ['oneida'], ['rg', 'moira'], 'US');
   s.ships.rg.steps = 1; s.encounter.ships.rg = 'dis'; s.combat.col.BR = ['moira'];
   waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); s.rng = 15; act(s, 'ok'); act(s, 'withdraw');`);
eq('N06 withdrawn Royal George (Last Step) → In Transit on her 2-step Reduced face', X(`[s.ships.rg.box, s.ships.rg.steps]`), ['transit', 2]);
X(`var s = fresh('BR', 182306); newForce(s, 'BR', 'NOR', 'Patrol', ['rg']); s.ships.rg.steps = 1; s.phase = 'tally'; waitAt(s, 'tally', 'reset'); act(s, 'ok');`);
eq('N06 Royal George (Last Step) returning at F7 → 2 steps', X(`[s.ships.rg.box, s.ships.rg.steps]`), ['transit', 2]);
X(`var s = fresh('BR', 182306); newForce(s, 'BR', 'NOR', 'Patrol', ['julia']); s.ships.julia.steps = 0; s.phase = 'tally'; waitAt(s, 'tally', 'reset'); act(s, 'ok');`);
eq('N06 control: a one-step ship keeps her zero-step Reduced face', X(`s.ships.julia.steps`), 0);

// N07 / N08 – Rake: the random ship is named before the choice; the used card goes back to its deck at once
X(`var s = fresh('US', 182307); stageCombat(s, 'NOR', ['madison', 'oneida'], ['wolfe', 'rg', 'moira']);
   s.combat.tac.att = { id: 'A_rake', negated: false, used: false }; s.deck.tacA = s.deck.tacA.filter(id => id !== 'A_rake'); s.tacPlayed = ['A_rake'];
   s.rng = 42; waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); act(s, 'ok');
   var opts = s.prompt.options.map(o => o.label), saved = JSON.stringify(s);`);
ok('N07 the random option names its ship before you choose', X(`/^Random ship: /.test(opts[2])`), X('opts.join(" / ")'));
const rnd = X(`opts[2].replace('Random ship: ', '')`);
X(`act(s, 'random'); var hitLine = s.log.map(l => l.text).find(t => /^Rake:/.test(t));`);
eq('N07 choosing it hits that same ship', X('hitLine'), `Rake: all hits on ${rnd}.`);
X(`var s2 = JSON.parse(saved); act(s2, 'random');`);
eq('N07 the named ship survives a save/reload', X(`s2.log.map(l => l.text).find(t => /^Rake:/.test(t))`), `Rake: all hits on ${rnd}.`);
eq('N08 used Attacker Rake is back in its deck once, off the played pile', X(`[s.deck.tacA.filter(id => id === 'A_rake').length, s.tacPlayed.indexOf('A_rake')]`), [1, -1]);
eq('N08 … and is not returned twice', X(`(spendRake(s, s.combat), s.deck.tacA.filter(id => id === 'A_rake').length)`), 1);

// N09 – Command Decision odds use the first Round's ships (Missed Signal)
for (const missed of [true, false]) {
  X(`var s = fresh('US', 182310); stageCombat(s, 'NOR', ['madison', 'oneida'], ['wolfe']); s.combat = null;
     if (${missed}) { s.zones.NOR.flags.missedSignal = 'madison'; s.zones.NOR.event = 13; s.encounter.wgCard = 13; }
     waitAt(s, 'encounter', 'command'); act(s, 'ok');
     var preview = s.prompt.text.split('\\n').find(a => a.startsWith('Odds if you attack')); act(s, 'attack');
     var first = ${missed} ? s.prompt.candidates.filter(i => i !== 'madison') : s.prompt.candidates;
     var str = sideStrength(s, first, 'US', false);`);
  ok(`N09 ${missed ? 'Missed Signal' : 'control: no Missed Signal'} – Command Decision matches the first Round`, X(`preview.includes('ships: ' + fmt(str) + ' vs 8')`), X('preview'));
}

// ===== v0.2.5: audit of v0.2.4 (W01–W03) =====
// W01 – Troops on an aborted coastal mission wait for F7: they cannot embark again the same turn
X(`
function markerBoard() {
  const s = fresh('BR', 185301); stageCombat(s, 'NIA', ['madison'], ['wolfe'], 'BR');
  const fr = s.forces[s.encounter.aiForce]; fr.mission = 'ArmySupport'; fr.troops = 1;
  s.aiTroops.box = []; s.aiTroops.track = [{ space: 7, troops: true }, { space: 8, troops: true }];
  s.nb = 0; s.nbBand = 3;
  s.targetRow = [{ id: 'B16', enc: true, removed: false, revealed: true }, { id: 'B20', enc: false, removed: false, revealed: false }];
  waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s);
  s.calls.unshift({ proc: 'turn', pc: 'B2done', A: {}, L: { pe: 1 } });
  s.pe = [{ num: 1, idx: 0, zone: 'NIA', forceId: s.encounter.humanForce, status: 'encounter' }];
  s.encounter.peNum = 1; s.rng = 1; return s;
}
var s = markerBoard(); act(s, 'ok'); var w01round = s.prompt.text, w01 = [aiTroopsInBox(s), s.troopsReturning.US];
playUntil(s, q => q.prompt && /^Tally/.test(q.prompt.title));
var w01launch = s.log.some(l => /Troops launched in Kingston/.test(l.text)), w01tally = [s.supply.BR, gameScore(s)];
playUntil(s, q => q.prompt && /^Reset/.test(q.prompt.title)); var w01reset = [aiTroopsInBox(s), s.troopsReturning.US];`);
ok('W01 Madison withdraws from Niagara (D1W, passes Disengagement)', X(`/D1W/.test(w01round) && s.ships.madison.box !== 'lake'`), X('w01round').split('\n')[0]);
eq('W01 the withdrawn marker is not Available – it waits for F7', X('w01'), [0, 1]);
eq('W01 … so B20 deploys no second Troops force: no Kingston landing', X('w01launch'), false);
eq('W01 … British supply 1, score 0', X('w01tally'), [1, 0]);
eq('W01 the marker comes back once at F7', X('w01reset'), [1, 0]);
X(`var s = markerBoard(); s.forces[s.encounter.aiForce].mission = 'Patrol'; s.forces[s.encounter.aiForce].troops = 0; s.aiTroops.box = [{ troops: true, revealed: true }]; act(s, 'ok');`);
eq('W01 control: a marker already in the box stays Available', X('[aiTroopsInBox(s), s.troopsReturning.US]'), [1, 0]);

// W02 – Pursuit settles the old Encounter's Struck Colors ships before the new Encounter (ruling: as if DW happened)
for (const pursue of [true, false]) {
  X(`var s = fresh('US', 182304); stageCombat(s, 'NOR', ['oneida'], ['moira']);
     if (${pursue}) { s.combat.tac.att = { id: 'A_pursuit', used: false, negated: false }; s.deck.tacA = s.deck.tacA.filter(id => id !== 'A_pursuit'); s.tacPlayed = ['A_pursuit']; }
     addShipToForce(s, 'beres', s.encounter.aiForce); encAdd(s, 'beres', 'struck'); s.ships.beres.steps = 0; s.encounter.struckBy.beres = 'US';
     waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); s.calls.unshift({ proc: 'turn', pc: 'B2done', A: {}, L: { pe: 1 } });
     s.pe = [{ num: 1, idx: 0, zone: 'NOR', forceId: s.encounter.humanForce, status: 'encounter' }]; s.encounter.peNum = 1; s.rng = 15;
     act(s, 'ok'); var w02round = s.prompt.text; act(s, 'ok');
     var w02 = { pending: s.encounter ? s.encounter.ships.beres : null, owner: s.ships.beres.owner, title: s.prompt.title };`);
  ok(`W02 ${pursue ? 'Pursuit' : 'control: ordinary withdrawal'} – the round is D1W`, X(`/→ D1W/.test(w02round)`), X('w02round').split('\n')[0]);
  if (pursue) {
    eq('W02 Pursuit: Beresford is settled before the new Encounter draws its Event – Captured', X(`[w02.pending, w02.owner, /^Pursuit/.test(w02.title)]`), ['done', 'US', true]);
    // the auditor's two endings: Pass the first command, no Reactions, then Pass or Attack the second command
    X(`var outs = ['pass', 'attack'].map(order => { const b = JSON.parse(JSON.stringify(s)); let n = 0, seen = [];
       for (let i = 0; i < 80 && b.encounter && b.prompt; i++) { const p = b.prompt; let a = 'ok';
         if (p.kind === 'choice' && p.options.some(o => o.id === 'attack') && p.options.some(o => o.id === 'pass')) { n++; a = n === 1 ? 'pass' : order; seen.push(a); }
         else if (p.kind === 'choice') a = (p.options.find(o => o.primary) || p.options[0]).id;
         else if (p.kind === 'select') a = [];
         else if (p.kind === 'lineup') a = { attackers: p.candidates, tows: p.defaultTows || {} };
         act(b, a); }
       return [seen.join('/'), b.ships.beres.owner]; });`);
    eq('W02 … and the second command (Pass or Attack) cannot change his owner', X('outs'), [['pass/pass', 'US'], ['pass/attack', 'US']]);
  } else {
    eq('W02 control: ordinary DW captures him at the end of the Encounter', X(`w02.owner`), 'US');
  }
}

// W03 – a v0.2.3 save waiting at the Rake choice is upgraded: the random ship is rolled from the saved dice and named
X(`var s = fresh('US', 182307); stageCombat(s, 'NOR', ['madison', 'oneida'], ['wolfe', 'rg', 'moira']);
   s.combat.tac.att = { id: 'A_rake', negated: false, used: false }; s.deck.tacA = s.deck.tacA.filter(id => id !== 'A_rake'); s.tacPlayed = ['A_rake'];
   s.rng = 42; waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); act(s, 'ok');
   var named = s.prompt.options[2].label;
   // what v0.2.3 saved at this moment: no rolled ship, anonymous button, dice not yet used for it
   var legacy = JSON.parse(JSON.stringify(s)); var lf = legacy.calls[legacy.calls.length - 1]; delete lf.L.rakeRandom;
   legacy.prompt.options[2].label = 'A random ship'; legacy.rng = s.__rngBefore !== undefined ? s.__rngBefore : legacy.rng;`);
X(`var s0 = fresh('US', 182307); stageCombat(s0, 'NOR', ['madison', 'oneida'], ['wolfe', 'rg', 'moira']);
   s0.combat.tac.att = { id: 'A_rake', negated: false, used: false }; s0.deck.tacA = s0.deck.tacA.filter(id => id !== 'A_rake'); s0.tacPlayed = ['A_rake'];
   s0.rng = 42; waitAt(s0, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s0);
   var colD0 = null; var origPick = pick; var rngBeforePick = null;
   pick = function (st, arr) { if (rngBeforePick === null && st === s0) rngBeforePick = st.rng; return origPick(st, arr); };
   act(s0, 'ok'); pick = origPick; legacy.rng = rngBeforePick;
   var up = checkSaveState(JSON.parse(JSON.stringify(legacy))); var upLabel = up.prompt.options[2].label;
   var again = checkSaveState(JSON.parse(JSON.stringify(legacy))).prompt.options[2].label;
   act(up, 'random'); var upHit = up.log.map(l => l.text).find(t => /^Rake:/.test(t));`);
eq('W03 an older save at the Rake choice now names the random ship', X('upLabel'), X('named'));
eq('W03 … the same ship every time it is loaded', X('again'), X('upLabel'));
eq('W03 … and the hits land on it', X('upHit'), `Rake: all hits on ${X('named').replace('Random ship: ', '')}.`);
eq('W03 control: a current save is left as it is', X(`(function(){ const c = JSON.parse(JSON.stringify(s)); const r0 = c.rng; upgradeLegacyPrompt(c); return [c.rng === r0, c.prompt.options[2].label]; })()`), [true, X('named')]);

// ===== v0.2.6: audit of v0.2.5 (L01, L02) – saves made by v0.2.4 inside the two windows =====
// The v0.2.4 behaviour is recreated by swapping in its code for one step, then the save goes through checkSaveState.
X(`
var v025abort = abortCoastalMission, v025settle = settleStruck;
function v024abort(s, fr) { if (!fr) return; if (fr.troops) { if (fr.side === s.ai) returnAiTroops(s, fr.troops); else s.troopsReturning[fr.side] += fr.troops;
  log(s, SIDE_SHORT[fr.side] + ' Coastal mission aborted – ' + fr.troops + ' Troops marker(s) remain available for future use.', 'info'); fr.troops = 0; } fr.aborted = true; }
function asV024(fn) { abortCoastalMission = v024abort; settleStruck = function (s, lines, pursued, only) { if (pursued === undefined || only) return v025settle(s, lines, pursued, only); };
  try { fn(); } finally { abortCoastalMission = v025abort; settleStruck = v025settle; } }
function asSaved024(s) { const c = JSON.parse(JSON.stringify(s)); delete c.build; return c; }   // v0.2.4 wrote no build stamp
function legacyL01() { const s = markerBoard(); asV024(() => act(s, 'ok')); return asSaved024(s); }
`);
X(`var l01 = legacyL01(); var l01raw = [aiTroopsInBox(l01), l01.troopsReturning.US];
   var up = checkSaveState(JSON.parse(JSON.stringify(l01))); var l01notes = (UI.loadNotes || []).slice(); var l01up = [aiTroopsInBox(up), up.troopsReturning.US];
   var t0 = up.turn; playUntil(up, q => q.prompt && /^Tally/.test(q.prompt.title));
   var l01play = [up.log.some(l => /Troops launched in Kingston/.test(l.text)), up.supply.BR, gameScore(up)];
   var again = checkSaveState(JSON.parse(JSON.stringify(checkSaveState(JSON.parse(JSON.stringify(l01))))));`);
eq('L01 the recreated v0.2.4 save has the marker back in Available', X('l01raw'), [1, 0]);
eq('L01 loading it moves the marker to the F7 queue', X('l01up'), [0, 1]);
ok('L01 … and says so', X(`l01notes.length === 1 && /return at F7/.test(l01notes[0])`), X('l01notes.join(" | ")'));
eq('L01 … so B20 deploys nothing: no Kingston landing, supply 1, score 0', X('l01play'), [false, 1, 0]);
eq('L01 loading the upgraded save again changes nothing', X('[aiTroopsInBox(again), again.troopsReturning.US, (UI.loadNotes || []).length]'), [0, 1, 0]);
X(`var sail = legacyL01(); delete sail.migrated; playUntil(sail, q => q.log.some(l => /AI Deploys to .*Carrying/.test(l.text)));
   var sailed = sail.log.some(l => /AI Deploys to .*Carrying/.test(l.text)); sail = asSaved024(sail); var b0 = JSON.stringify([sail.aiTroops, sail.troopsReturning, sail.forces]);
   var sup = checkSaveState(JSON.parse(JSON.stringify(sail))); var sailNotes = (sup.recovery || (UI.loadNotes || [])).slice();`);
ok('L01 control: once the A.I. has sailed with the marker, the load only warns', X(`sailed && sailNotes.length === 1 && /load a save from before the withdrawal/.test(sailNotes[0]) && JSON.stringify([sup.aiTroops, sup.troopsReturning, sup.forces]) === b0`), X('sailNotes.join(" | ")'));
X(`var pre = markerBoard(); var preUp = checkSaveState(JSON.parse(JSON.stringify(pre)));`);
eq('L01 control: a save from before the withdrawal is left alone', X('[(UI.loadNotes || []).length, aiTroopsInBox(preUp), preUp.troopsReturning.US]'), [0, 0, 0]);

X(`
function w02Board() {
  const s = fresh('US', 182304); stageCombat(s, 'NOR', ['oneida'], ['moira']);
  s.combat.tac.att = { id: 'A_pursuit', used: false, negated: false }; s.deck.tacA = s.deck.tacA.filter(id => id !== 'A_pursuit'); s.tacPlayed = ['A_pursuit'];
  addShipToForce(s, 'beres', s.encounter.aiForce); encAdd(s, 'beres', 'struck'); s.ships.beres.steps = 0; s.encounter.struckBy.beres = 'US';
  waitAt(s, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(s); s.calls.unshift({ proc: 'turn', pc: 'B2done', A: {}, L: { pe: 1 } });
  s.pe = [{ num: 1, idx: 0, zone: 'NOR', forceId: s.encounter.humanForce, status: 'encounter' }]; s.encounter.peNum = 1; s.rng = 15; return s;
}
var l02 = w02Board(); asV024(() => { act(l02, 'ok'); act(l02, 'ok'); }); l02 = asSaved024(l02);
`);
eq('L02 the recreated v0.2.4 save still holds Beresford Struck in the new Encounter', X('[l02.encounter.ships.beres, l02.ships.beres.owner]'), ['struck', 'BR']);
X(`var outs = ['pass', 'attack'].map(order => { const b = checkSaveState(JSON.parse(JSON.stringify(l02))); const n0 = (UI.loadNotes || []).slice(); let n = 0;
     for (let i = 0; i < 80 && b.encounter && b.prompt; i++) { const p = b.prompt; let a = 'ok';
       if (p.kind === 'choice' && p.options.some(o => o.id === 'attack') && p.options.some(o => o.id === 'pass')) { n++; a = n === 1 ? 'pass' : order; }
       else if (p.kind === 'choice') a = (p.options.find(o => o.primary) || p.options[0]).id; else if (p.kind === 'select') a = []; else if (p.kind === 'lineup') a = { attackers: p.candidates, tows: p.defaultTows || {} };
       act(b, a); }
     return [n0.length, b.ships.beres.owner, b.log.filter(l => /Beresford is CAPTURED/.test(l.text)).length]; });`);
eq('L02 loading it settles Beresford first (Captured); Pass or Attack later gives the same owner, once', X('outs'), [[1, 'US', 1], [1, 'US', 1]]);
X(`var fresh2 = w02Board(); act(fresh2, 'ok'); act(fresh2, 'ok'); var f2 = checkSaveState(JSON.parse(JSON.stringify(fresh2)));`);
eq('L02 control: a v0.2.5 save after Pursuit is left alone', X('[(UI.loadNotes || []).length, f2.log.filter(l => /Beresford is CAPTURED/.test(l.text)).length]'), [0, 1]);
X(`var nw = JSON.parse(JSON.stringify(l02)); nw.encounter.ships.moira = 'struck'; nw.log.push({ turn: nw.turn, phase: nw.phase, text: 'Earl of Moira (A) Strike Check 5 – STRIKES COLORS.', kind: 'combat' });
   var nwUp = checkSaveState(nw);`);
eq('L02 control: a ship that struck in the new Encounter stays undecided', X('[nwUp.encounter.ships.moira, nwUp.encounter.ships.beres]'), ['struck', 'done']);

// ===== v0.2.7: audit of v0.2.6 (F01–F04) – positions from the auditor's evidence (tests/fixtures/audit-v0.2.6) =====
const fx = name => JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'audit-v0.2.6', name), 'utf8')).state);
const loadFx = name => X(`(function(){ var raw = ${fx(name)}; var s = checkSaveState(JSON.parse(JSON.stringify(raw))); return { notes: (UI.loadNotes || []).slice(),
  recovery: (s.recovery || []).slice(),
  same: (function(){ var a = JSON.parse(JSON.stringify(s)), b = JSON.parse(JSON.stringify(raw)); [a, b].forEach(o => { delete o.build; delete o.migrated; delete o.recovery; if (o.encounter && o.encounter.flagIn && !Object.keys(o.encounter.flagIn).length) delete o.encounter.flagIn; }); return JSON.stringify(a) === JSON.stringify(b); })(),
  enc: s.encounter ? s.encounter.ships : null, owner: id => s.ships[id].owner, box: aiTroopsInBox(s), due: (s.troopsReturning || {})[s.ai] || 0, ships: s.ships }; })()`);
// F01 – a surrender in the current Encounter of a v0.2.6 game is never treated as an older one
for (const [file, id, own] of [['F01_fresh_pending_withdrawal.json', 'wolfe', 'BR'], ['F01_fresh_pending_flag_transfer.json', 'growler', 'US']]) {
  const r = loadFx(file);
  eq(`F01 ${file}: ${id} stays pending with his own side, nothing changed, no notice`, [r.enc[id], r.ships[id].owner, r.same, r.notes.length], ['struck', own, true, 0]);
}
X(`var cur = newGame('BR', 191347); run(cur); act(cur, cur.prompt.kind === 'info' ? 'ok' : (cur.prompt.options ? cur.prompt.options[0].id : 'ok'));`);
eq('F01 saves written by this version carry the build stamp', X('cur.build'), X('APP_VERSION'));
X(`var stamped = JSON.parse(JSON.stringify(l02)); stamped.build = APP_VERSION; var stUp = checkSaveState(stamped);`);
eq('F01 … and a stamped save is never upgraded (even with an old-looking surrender)', X('[stUp.encounter.ships.beres, (UI.loadNotes || []).length]'), ['struck', 0]);
// F02 – an old Pursuit surrender is settled from the sides at the Pursuit boundary, whatever happened next
{
  const a = loadFx('F02_just_after_Asp_pursuit.json'), b = loadFx('F02_after_Melville_sinks.json');
  eq('F02 save just after the Pursuit: Asp captured by the British', [a.enc.asp, a.ships.asp.owner], ['done', 'BR']);
  eq('F02 save after Lord Melville sinks: the same – Asp captured by the British', [b.enc.asp, b.ships.asp.owner], ['done', 'BR']);
  eq('F02 … while Julia, who struck in the new Encounter, stays pending', b.enc.julia, 'struck');
}
// F03 – a deployment already being picked with the inflated Troops row cannot be rebuilt: warn, leave the save as it is
{
  const r = loadFx('E01_old_B35_at_package_picker.json');
  ok('F03 B35 picker save: warns and points to a save from before the withdrawal', r.recovery.length === 1 && /load a save from before the withdrawal/.test(r.recovery[0]), r.recovery.join(' | '));
  eq('F03 … and changes nothing (markers, deployment, dice)', [r.same, r.box, r.due], [true, 2, 0]);
}
// F04 – the warning also appears when the old save is opened at Tally
{
  const r = loadFx('E02_old_after_Kingston_Tally.json');
  ok('F04 Tally save after the illegal Kingston landing: warns', r.recovery.length === 1 && /Tally has scored/.test(r.recovery[0]), r.recovery.join(' | '));
  eq('F04 … and keeps the scored turn as saved', r.same, true);
  const q = loadFx('L01_old_already_sailed.json');
  ok('F04 control: the already-sailed save still warns', q.recovery.length === 1 && q.same, q.recovery.join(' | '));
}

// ===== v0.2.8: audit of v0.2.7 (N01–N03, O01) – positions in tests/fixtures/audit-v0.2.7 =====
const fx7 = name => JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'audit-v0.2.7', name), 'utf8')).state);
const open7 = (name, again) => X(`(function(){ var raw = ${fx7(name)}; var s = checkSaveState(JSON.parse(JSON.stringify(raw)));
  var first = (s.recovery || []).slice(); var notes = (UI.loadNotes || []).slice();
  var s2 = checkSaveState(JSON.parse(JSON.stringify(s)));                       // export and open again
  var strip = o => { o = JSON.parse(JSON.stringify(o)); ['build', 'migrated', 'recovery'].forEach(k => delete o[k]); if (o.encounter && o.encounter.flagIn && !Object.keys(o.encounter.flagIn).length) delete o.encounter.flagIn; return JSON.stringify(o); };
  return { first: first, notes: notes, reopen: (s2.recovery || []).slice(), same: strip(s) === strip(raw), build: s2.build }; })()`);
// N01 – damage already applied by 0.2.6's own repair is flagged (and the game left as saved)
for (const [file, re] of [['V026_saved_after_wrong_Wolfe_repair.json', /changed by version 0\.2\.6.*Wolfe struck in the current Encounter/],
  ['V026_saved_after_wrong_Asp_repair.json', /changed by version 0\.2\.6.*Asp struck before the Pursuit and should have been captured by the British/],
  ['V026_saved_after_wrong_B35_repair.json', /changed by version 0\.2\.6.*already chosen a deployment row/]]) {
  const r = open7(file);
  ok(`N01 ${file}: flagged`, r.first.length === 1 && re.test(r.first[0]), r.first.join(' | '));
  eq(`N01 ${file}: … left as saved, and the notice is still there after export and reopening`, [r.same, r.reopen.length], [true, 1]);
}
X(`var good = checkSaveState(JSON.parse(JSON.stringify(${fx('F02_just_after_Asp_pursuit.json')}))); var good2 = checkSaveState(JSON.parse(JSON.stringify(good)));`);
eq('N01 control: a correct repair (Asp captured at the boundary) is not flagged, then or on reopening', X('[(good.recovery || []).length, (good2.recovery || []).length, good2.ships.asp.owner]'), [0, 0, 'BR']);
// N02 – unresolved-recovery notices stay with the board
for (const file of ['V027_saved_after_E01_old_B35_at_package_picker.json', 'V027_saved_after_E02_old_after_Kingston_Tally.json']) {
  const r = open7(file);
  eq(`N02 ${file} (exported by 0.2.7 after its notice): notice back, kept on reopening, nothing changed`, [r.first.length, r.reopen.length, r.same], [1, 1, true]);
}
{
  X(`var e01 = checkSaveState(JSON.parse(JSON.stringify(${fx('E01_old_B35_at_package_picker.json')}))); var e01again = checkSaveState(JSON.parse(JSON.stringify(e01)));
     var ack = JSON.parse(JSON.stringify(e01again)); delete ack.recovery; var ackAgain = checkSaveState(ack);`);
  eq('N02 E01: the notice survives export and reopening', X('[(e01.recovery || []).length, (e01again.recovery || []).length]'), [1, 1]);
  eq('N02 … until the player acknowledges it', X('(ackAgain.recovery || []).length'), 0);
  X(`var played = JSON.parse(JSON.stringify(e01again)); act(played, played.prompt.kind === 'select' ? (played.prompt.initial || []) : 'ok');`);
  eq('N02 … and playing on keeps it on the board', X('(played.recovery || []).length'), 1);
}
// N03 – a state restored by Undo is stamped like a load
{
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'audit-v0.2.7', 'V024_autosave_with_pre_F7_undo.json'), 'utf8'));
  X(`var __r = render, __a = autosave; render = function () {}; autosave = function () {};
     G_STATE = checkSaveState(JSON.parse(JSON.stringify(${JSON.stringify(raw.state)}))); UNDO = ${JSON.stringify(raw.undo)}.slice();
     undo(); var undone = { build: G_STATE.build, due: G_STATE.troopsReturning[G_STATE.ai], exported: JSON.parse(saveText()).state.build };
     render = __r; autosave = __a;`);
  eq('N03 Undo onto an old snapshot: repaired (1 due at F7) and stamped – also in the exported save', X('[undone.due, undone.build, undone.exported]'), [1, X('APP_VERSION'), X('APP_VERSION')]);
}
// O01 – zero Defense shows ∞:1 in the applied round, as in the previews
X(`var z = fresh('BR', 191073); stageCombat(z, 'SAC', ['asp'], ['rg'], 'BR'); z.ships.asp.steps = 0; z.encounter.ships.asp = 'in';
   waitAt(z, 'combat', 'grRoll', {}, { st: 'GR1' }); afterCombatCaller(z); act(z, 'ok'); var zline = z.log.map(l => l.text).find(t => /^Gunnery Round 1:/.test(t)) || '';`);
ok('O01 Gunnery Round against zero Defense reads ∞:1 (column 3:1+)', X(`/ vs U\\.S\\. 0 = ∞:1 → column 3:1\\+/.test(zline)`), X('zline').slice(0, 120));

console.log(`regression tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
