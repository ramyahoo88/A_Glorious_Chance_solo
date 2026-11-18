/* ============================================================================
   F Tally and Reset Phase
   ========================================================================== */
PROCS.tally = {
  start(s, f) {
    s.phase = 'tally'; s.stepLabel = 'F Tally and Reset';
    const lines = [];
    const say = (t) => { lines.push(t); };
    const vp0 = { US: s.vp.US, BR: s.vp.BR };
    /* F1 Destroyed / Captured ships */
    s.lossesThisTurn.forEach(L => {
      if (!L.by) return;
      const d = SHIP_BY_ID[defId(s.ships[L.id])];
      const n = L.how === 'sunk' ? d.vp[0] : d.vp[1];
      addVP(s, L.by, n, `${d.name} ${L.how === 'sunk' ? 'destroyed' : 'captured'} (${L.why})`);
      say(`F1: ${d.name} ${L.how === 'sunk' ? 'destroyed' : 'captured'} – ${vpTxt(L.by, n)}.`);
    });
    s.coastal.cutouts.filter(x => x.result === 'repulsed').forEach(x => { addVP(s, OTHER[x.side], 1, 'Cutting-Out party repulsed'); say(`F1: Cutting-Out repulsed – ${vpTxt(OTHER[x.side], 1)}.`); });
    /* F2 Lake Zone Control */
    ZONES.forEach(z => {
      const fullUS = shipsInZone(s, z, 'US').filter(isFull), fullBR = shipsInZone(s, z, 'BR').filter(isFull);
      if (fullUS.length && fullBR.length) { if (s.zones[z].control) say(`F2.1: ${ZONE_NAME[z]} becomes Contested.`); s.zones[z].control = null; }
      ['US', 'BR'].forEach(side => {
        const mine = side === 'US' ? fullUS : fullBR, theirs = side === 'US' ? fullBR : fullUS;
        if (sumBy(mine, sh => sh.steps) >= 5 && !theirs.length) { if (s.zones[z].control !== side) say(`F2.2: ${SIDE_NAME[side]} control of ${ZONE_NAME[z]}.`); s.zones[z].control = side; }
      });
    });
    // F2.3 invalid Blockade markers
    ZONES.forEach(z => {
      const b = s.zones[z].blockade; if (!b) return;
      if (!blockadeConditions(s, b, z)) { s.zones[z].blockade = null; say(`F2.3: the ${SIDE_NAME[b]} Blockade of ${ZONE_NAME[z]} is not maintained – removed.`); }
    });
    // F2.4 a Blockaded side loses all its Lake Control markers
    ['US', 'BR'].forEach(side => {
      const bz = [homeZone(side), TEMP_HOMEPORT_ZONE[side]].filter(z => s.zones[z].blockade === OTHER[side]);
      if (bz.length) ZONES.forEach(z => { if (s.zones[z].control === side) { s.zones[z].control = null; say(`F2.4: Blockaded ${SIDE_PL[side]} lose control of ${ZONE_NAME[z]}.`); } });
    });
    // F2.5 Lake Control VPs
    ['US', 'BR'].forEach(side => {
      const n = ZONES.filter(z => s.zones[z].control === side).length;
      if (n) { addVP(s, side, n, `Lake Control (${n} zone${n > 1 ? 's' : ''})`); say(`F2.5: ${SIDE_NAME[side]} Lake Control ${n} zone(s): ${vpTxt(side, n)}.`); }
    });
    /* F3 Land Battle effects */
    s.coastal.battles.forEach(b => {
      const other = OTHER[b.side];
      if (b.target === 'HOME' && (b.result === 'AM' || b.result === 'AF')) {
        const r = twoD6(s), t = r + (b.result === 'AF' ? 2 : 0);
        const row = SHIPYARD.find(x => t >= x.lo && t <= x.hi);
        say(`F3.1: Shipyard Damage vs ${SIDE_PL[other]} – 2d6 ${r}${b.result === 'AF' ? '+2' : ''} = ${t}: ${row.title}.`);
        changeCD(s, other, row.cd, 'Shipyard Damage');
        applyShipyard(s, other, b.side, row.eff, say);
      }
      if (b.target === 'NIA') {
        const val = LB_RESULTS.find(x => x.id === b.result).att;
        const dir = b.side === 'BR' ? 1 : -1;
        const before = s.niagara;
        s.niagara = Math.max(0, Math.min(6, s.niagara + dir * val));
        if (before !== s.niagara) say(`F3.2: Niagara Front ${NIAGARA_SPACES[before]} → ${NIAGARA_SPACES[s.niagara]}.`);
      }
    });
    if (s.turn === 7) {
      if (s.niagara === 6 && s.zones.NIA.control === 'BR' && !isBlockaded(s, 'BR')) { addVP(s, 'BR', 10, 'Army Victory on the Niagara Front'); say('F3.2.1: British Army Victory on the Niagara Front – −10 VP (British).'); }
      if (s.niagara === 0 && s.zones.NIA.control !== 'BR') { addVP(s, 'US', 10, 'Army Victory on the Niagara Front'); say('F3.2.1: American Army Victory on the Niagara Front – U.S. +10 VP.'); }
    }
    const h = s.human;
    if (s.troops[h].available > 0) { addVP(s, h, -s.troops[h].available, `${s.troops[h].available} untransported Troops marker(s)`); say(`F3.3: ${s.troops[h].available} untransported Troops marker(s) – you lose ${s.troops[h].available} VP (Game Score ${h === 'US' ? '−' : '+'}${s.troops[h].available}).`); }
    /* F4 Raid VPs */
    s.coastal.raids.forEach(r => {
      r.supplyOK = true;
      let vp = RAID_VP[r.zone];
      if (r.events.indexOf('localMilitia') >= 0) {
        const d = d6(s);
        if (d > r.guns) { vp = 0; r.supplyOK = false; say(`F4: Local Militia – 1d6 ${d} > ${r.guns} guns: the Raid on ${ZONE_NAME[r.zone]} scores nothing.`); }
        else say(`F4: Local Militia – 1d6 ${d} ≤ ${r.guns} guns: the raiders get through.`);
      }
      if (r.events.indexOf('suppliesMoved') >= 0) { vp = 0; r.supplyOK = false; }
      if (r.events.indexOf('suddenStorm') >= 0) { vp = RAID_VP[r.zone] === 2 ? 1 : 0; r.supplyOK = false; }
      if (vp) { addVP(s, r.side, vp, `Raid on the ${ZONE_NAME[r.zone]} coastline`); say(`F4: ${SIDE_SHORT[r.side]} Raid on ${ZONE_NAME[r.zone]} – ${vpTxt(r.side, vp)}.`); }
      else say(`F4: ${SIDE_SHORT[r.side]} Raid on ${ZONE_NAME[r.zone]} scores no VPs.`);
    });
    /* F5 Convoy Supply */
    [s.ai, s.human].forEach(side => convoySupply(s, side, say));
    // F5.3 other adjustments
    s.coastal.battles.forEach(b => {
      if (b.target === 'HOME' && ['AS', 'AM', 'AF'].indexOf(b.result) >= 0) { moveSupply(s, OTHER[b.side], -2, 'enemy Land Battle success vs Homeport'); say(`F5.3: Land Battle success vs the ${SIDE_NAME[OTHER[b.side]]} Homeport – their Convoy Supply −2.`); }
    });
    s.coastal.raids.forEach(r => {
      if (!r.supplyOK) return;
      const d = d6(s), need = r.events.indexOf('suppliesBurned') >= 0 ? 6 : 5;
      if (d >= need) { moveSupply(s, r.side, 1, 'Raid supplies'); moveSupply(s, OTHER[r.side], -1, 'Raid losses'); say(`F5.3: Raid on ${ZONE_NAME[r.zone]} – 1d6 ${d}: supplies seized (${SIDE_SHORT[r.side]} +1, ${SIDE_SHORT[OTHER[r.side]]} −1).`); }
      else say(`F5.3: Raid on ${ZONE_NAME[r.zone]} – 1d6 ${d}: no supplies seized.`);
    });
    // 5.4 Fall Offensive Supplied
    if (!s.fallOffensive) {
      const us = s.supply.US >= SUPPLY_MAX, br = s.supply.BR >= SUPPLY_MAX;
      if (us && br) { s.fallOffensive = 'both'; say('5.4: both sides reach Fall Offensive Supplied together – no VPs.'); }
      else if (us || br) { const side = us ? 'US' : 'BR'; s.fallOffensive = side; addVP(s, side, 5, 'Fall Offensive Supplied first'); say(`5.4: ${SIDE_NAME[side]} Fall Offensive Supplied first – ${vpTxt(side, 5)}.`); }
    }
    /* F6 Blockade checks */
    ['US', 'BR'].forEach(bl => {
      const vic = OTHER[bl];
      const zs = [homeZone(vic)].concat(usingTempHomeport(s, vic) ? [TEMP_HOMEPORT_ZONE[vic]] : []);
      zs.forEach(z => {
        if (s.zones[z].blockade === bl) return;
        if (blockadeConditions(s, bl, z)) {
          s.zones[z].blockade = bl;
          say(`F6: ${SIDE_NAME[bl]} BLOCKADE placed in ${ZONE_NAME[z]}!`);
          if (z === homeZone(vic)) {
            const iso = sideShips(s, vic).filter(sh => sh.box === 'lake' && sh.zone !== z);
            iso.forEach(sh => { sh.isolated = true; });
            if (iso.length) say(`Isolated ${SIDE_SHORT[vic]} ships (use ${TEMP_HOMEPORT_NAME[vic]}): ${iso.map(sh => shipName(s, sh.id)).join(', ')}.`);
          }
        }
      });
    });
    // 14.2 Dual Blockades
    ['US', 'BR'].forEach(bl => {
      const vic = OTHER[bl];
      if (s.zones[homeZone(vic)].blockade === bl && s.zones[TEMP_HOMEPORT_ZONE[vic]].blockade === bl) {
        const canBreak = canLaunchBreakout(s, vic);
        if (!canBreak) { say(`14.2: Dual Blockade – the ${SIDE_PL[vic]} cannot break out. ${bl === 'BR' ? 'British' : 'U.S.'} Decisive Victory!`); s.suddenDeath = bl; }
      }
    });
    f.L.lines = lines;
    f.L.vpDelta = { US: s.vp.US - vp0.US, BR: s.vp.BR - vp0.BR };
    return P(info(`Tally – ${TURN_NAMES[s.turn]}`, (lines.length ? lines.join('\n') : 'Nothing to score.') + `\n\nThis turn: U.S. ${f.L.vpDelta.US >= 0 ? '+' : ''}${f.L.vpDelta.US} VP, British ${f.L.vpDelta.BR >= 0 ? '−' : '+'}${Math.abs(f.L.vpDelta.BR)} VP. Game Score ${gameScore(s) >= 0 ? '+' : ''}${gameScore(s)}.`), 'reset');
  },
  reset(s, f) {
    const h = s.human, lines = [];
    // F7: ships return
    Object.values(s.ships).forEach(sh => {
      if (sh.box === 'lake' || sh.box === 'escortBox') {
        const fr = s.forces[sh.forceId];
        sh.forceId = null; sh.zone = null;
        if (sh.flags.heatedShot) { delete sh.flags.heatedShot; sh.box = 'ordinary'; sh.flags.damaged = true; sh.port = sh.isolated ? 'temp' : 'home'; return; }
        if (sh.flags.requisition) { delete sh.flags.requisition; sh.box = 'requisitioned'; sh.flags.reqUntil = s.turn + 2; return; }
        sh.port = sh.isolated ? 'temp' : 'home';
        sh.box = isFull(sh) ? 'deployable' : 'transit';
      }
      if (sh.box === 'transit' && isFull(sh)) sh.box = 'deployable';
      if (sh.box !== 'sunk' && sh.box !== 'outOfPlay') discardStepMarkers(sh);
      delete sh.flags.withdrawn; delete sh.flags.heatedShot; delete sh.flags.requisition;
    });
    // Troops
    const back = { US: 0, BR: 0 };
    Object.values(s.forces).forEach(fr => { if (fr.troops) { back[fr.side] += fr.troops; fr.troops = 0; } });
    s.troopsReturning = s.troopsReturning || { US: 0, BR: 0 };
    ['US', 'BR'].forEach(side => { back[side] += s.troopsReturning[side] || 0; s.troopsReturning[side] = 0; });
    ['US', 'BR'].forEach(side => {
      if (!back[side]) return;
      if (side === s.ai) { returnAiTroops(s, back[side]); lines.push(`${back[side]} unlaunched A.I. Troops marker(s) return to its pool.`); }
      else { s.troops[side].available += back[side]; lines.push(`${back[side]} unlaunched Troops marker(s) return – you have ${s.troops[side].available} Available.`); }
    });
    const nowAvail = s.troops[h].track.filter(sp => sp <= s.supply[h]);
    if (nowAvail.length) { s.troops[h].track = s.troops[h].track.filter(sp => sp > s.supply[h]); s.troops[h].available += nowAvail.length; lines.push(`${nowAvail.length} of your Troops marker(s) become Available.`); }
    const aiNow = s.aiTroops.track.filter(m => m.space <= s.supply[s.ai]);
    if (aiNow.length) { s.aiTroops.track = s.aiTroops.track.filter(m => m.space > s.supply[s.ai]); aiNow.forEach(m => s.aiTroops.box.push({ troops: m.troops, revealed: false })); lines.push(`${aiNow.length} “AI Troops?” marker(s) move to the AI Available Troops box (revealed next turn).`); }
    s.forces = {};
    // Convoys: Delay → Arrived (unless the Homeport is Blockaded)
    ['US', 'BR'].forEach(side => {
      s.pendingConvoy[side].forEach(p => { if (p.status === 'delayed' && !isBlockaded(s, side)) p.status = 'arrived'; });
    });
    // Lift isolation once the home Blockade is gone
    ['US', 'BR'].forEach(side => {
      if (!isBlockaded(s, side)) sideShips(s, side).forEach(sh => { if (sh.isolated) { sh.isolated = false; sh.port = 'home'; } });
    });
    // Intelligence expiry
    ['US', 'BR'].forEach(side => { const it = s.intelligence[side]; if (it && s.turn >= it.until) s.intelligence[side] = null; });
    // Decks
    s.targetRow = []; s.pe = [];
    const keep = [s.intelligence.US && s.intelligence.US.card, s.intelligence.BR && s.intelligence.BR.card].filter(Boolean);
    s.deck.event = shuffle(s, Object.keys(EVENTS).map(Number).filter(id => keep.indexOf(id) < 0));
    s.eventsDrawn = [];
    s.deck.tacA = shuffle(s, TACTICS.filter(t => t.deck === 'A').map(t => t.id));
    s.deck.tacD = shuffle(s, TACTICS.filter(t => t.deck === 'D').map(t => t.id));
    s.tacPlayed = [];
    ['US', 'BR'].forEach(side => { const fs = s.ships[s.flagship[side]]; if (!fs || fs.owner !== side || fs.box === 'sunk' || fs.box === 'outOfPlay') flagshipLost(s, side, null); });
    if (s.suddenDeath) { endGame(s, s.suddenDeath); return R(); }
    lines.forEach(l => log(s, l, 'info'));
    return P(info(`Reset – end of ${TURN_NAMES[s.turn]}`, (lines.length ? lines.join('\n') + '\n' : '') + `Return ships from the lake to their Homeport Displays (Reduced ships to In Transit), return Target, Event and Tactic cards to their decks and shuffle, and advance the Turn marker.`), '__ret');
  },
  __ret(s, f) { return R(); },
};

function blockadeConditions(s, bl, z) {
  const vic = OTHER[bl];
  if (s.zones[z].control !== bl) return false;
  if (shipsInZone(s, z, bl).filter(sh => isFull(sh) && isMain(sh)).length < 4) return false;
  if (shipsInZone(s, z, vic).length) return false;
  return true;
}

function convoySupply(s, side, say) {
  const blk = isBlockaded(s, side);
  // earlier delayed Convoys that have since arrived
  s.pendingConvoy[side] = s.pendingConvoy[side].filter(p => {
    if (p.status === 'arrived' && !blk) { moveSupply(s, side, 2, 'delayed Convoy arrives'); say(`F5: a delayed ${SIDE_SHORT[side]} Convoy arrives – +2 Convoy Supply.`); return false; }
    return true;
  });
  const c = s.convoys[side][s.turn];
  if (!c) return;
  if (!c.revealed) { c.revealed = true; say(`F5: the AI Convoy marker for ${TURN_NAMES[s.turn]} is revealed – ${c.real ? 'Convoy' : 'No Convoy'}.`); }
  if (!c.real) return;
  if (c.result === 'C') { moveSupply(s, OTHER[side], 1, 'Convoy captured'); say(`F5: the ${SIDE_SHORT[side]} Convoy was captured – no advance; ${SIDE_SHORT[OTHER[side]]} +1 Convoy Supply.`); return; }
  if (c.result === 'D') { say(`F5: the ${SIDE_SHORT[side]} Convoy was destroyed – no advance.`); return; }
  // A Scattered Convoy is delayed, not lost: it takes a Convoy Delay marker and arrives later (Living Playbook p.16-17)
  if (c.result === 'S') { s.pendingConvoy[side].push({ status: 'delayed', turn: s.turn }); say(`F5: the ${SIDE_SHORT[side]} Convoy scattered – no advance this turn; it takes a Convoy Delay marker and arrives later.`); return; }
  if (blk) { s.pendingConvoy[side].push({ status: 'delayed', turn: s.turn }); say(`F5: the ${SIDE_SHORT[side]} Homeport is Blockaded – the Convoy receives a Convoy Delay marker.`); return; }
  if (c.delay) { s.pendingConvoy[side].push({ status: 'delayed', turn: s.turn }); say(`F5: the ${SIDE_SHORT[side]} Convoy is delayed – no advance this turn (arrives later).`); return; }
  moveSupply(s, side, 2, 'Convoy arrives'); say(`F5: the ${SIDE_SHORT[side]} Convoy arrives – +2 Convoy Supply.`);
}

function applyShipyard(s, vic, att, eff, say) {
  const repairing = sideShips(s, vic).filter(sh => sh.box === 'repairing');
  const cons = sideShips(s, vic).filter(sh => sh.box === 'construction').sort((a, b) => vpCapture(b) - vpCapture(a));
  if (eff === 'repairDelay' && repairing.length) { const sh = pick(s, repairing); sh.delay = (sh.delay || 0) + 2; say(`${shipName(s, sh.id)}'s repairs are delayed.`); }
  if (eff === 'reduceOneConstruction' && cons.length) { const sh = cons[0]; sh.steps = def(sh).full[4] - 1; say(`${def(sh).name} is damaged on the stocks.`); }
  // 8–9: flip the ships on the stocks only if there is more than one (Homeport Display table)
  if (eff === 'reduceAllConstruction' && cons.length > 1) cons.forEach(sh => { sh.steps = def(sh).full[4] - 1; say(`${def(sh).name} is damaged on the stocks.`); });
  if (eff === 'reduceAllConstruction' && cons.length === 1) say(`Only one ship is under construction (${def(cons[0]).name}) – this row flips ships only when there is more than one.`);
  if (eff === 'destroyOneConstruction' && cons.length) { const sh = cons[0]; destroyOnStocks(s, sh, att, say); }
  if (eff === 'destroyAllConstruction') cons.forEach(sh => destroyOnStocks(s, sh, att, say));
}
function destroyOnStocks(s, sh, att, say) {
  sh.box = 'sunk';
  const n = def(sh).vp[0];
  addVP(s, att, n, `${def(sh).name} destroyed on the stocks`);
  say(`${def(sh).name} is burned on the stocks – ${vpTxt(att, n)}.`);
}

function vpTxt(side, n) { return side === 'US' ? `+${n} VP (U.S.)` : `−${n} VP (British)`; }
