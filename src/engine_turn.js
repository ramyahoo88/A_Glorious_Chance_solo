/* ============================================================================
   Turn procedure: Preparation (A), Lake Action (B), Enemy Operations (C),
   Breakout (D) and hand-off to Coastal (E) / Tally (F).
   ========================================================================== */
PROCS.turn = {
  start(s, f) {
    s.phase = 'prep';
    s.turnFlags = { aiCutOutThisTurn: false };
    s.eventsDrawn = []; s.pe = []; s.peNext = 1; s.targetRow = [];
    s.coastal = { raids: [], battles: [], cutouts: [] };
    s.convoyDeployed = { US: null, BR: null };
    s.lossesThisTurn = [];
    s.troopsReturning = { US: 0, BR: 0 };
    ZONES.forEach(z => { s.zones[z].event = null; s.zones[z].flags = {}; });
    ['US', 'BR'].forEach(side => { if (s.leader[side].wounded) { s.leader[side].wounded = false; log(s, `${leaderName(s, side)} returns to duty.`, 'info'); } });
    log(s, `===== ${TURN_NAMES[s.turn]} =====`, 'turn');
    // 5.1 Last turn sudden death: AI with no ships eligible to be Deployable
    return G('A1');
  },

  /* A1 Schedule Convoy ------------------------------------------------------------ */
  A1(s, f) {
    s.stepLabel = 'A1 Schedule Convoy';
    const h = s.human, m = Math.floor(s.turn / 2);
    if (s.turn % 2 === 0 && !s.convoys[h][m * 2] && !s.convoys[h][m * 2 + 1]) {
      return P(choice('A1 Schedule your Convoy', `Choose the turn your ${MONTHS[m]} supply Convoy runs. Place the ${MONTHS[m]} Convoy marker on that Turn Track space.`,
        [{ id: 'I', label: `${MONTHS[m]} I (this turn)`, primary: true }, { id: 'II', label: `${MONTHS[m]} II (next turn)` }]), 'A1b');
    }
    return G('A2');
  },
  A1b(s, f) {
    const h = s.human, m = Math.floor(s.turn / 2);
    const t = m * 2 + (f.answer === 'I' ? 0 : 1);
    s.convoys[h][t] = { real: true, revealed: true, delay: false, deployed: false, result: null };
    s.convoys[h][t === m * 2 ? m * 2 + 1 : m * 2] = { real: false, revealed: true };
    log(s, `Your ${MONTHS[m]} Convoy is scheduled for ${TURN_NAMES[t]}.`, 'player');
    return G('A2');
  },

  /* A2 New ships / upgrades ready ----------------------------------------------- */
  A2(s, f) {
    s.stepLabel = 'A2 New Ships Ready';
    const msgs = [];
    Object.values(s.ships).forEach(sh => {
      if (sh.box === 'makeReady') {
        if (sh.flags.upgrading && sh.ver === 'A') { sh.ver = 'B'; sh.steps = def(sh).full[4]; msgs.push(`${def(sh).name} completes her refit and joins as the “B” version`); }
        delete sh.flags.upgrading;
        sh.box = 'deployable';
        msgs.push(`${shipName(s, sh.id)} moves from Make Ready to Deployable`);
        if (sh.id === 'pike' && sh.owner === 'US') { s.flagship.US = 'pike'; msgs.push('USS Gen. Pike becomes the U.S. Flagship [LC5.1]'); }
      }
      if (sh.box === 'requisitioned' && sh.flags.reqUntil != null && s.turn >= sh.flags.reqUntil) {
        sh.box = 'deployable'; delete sh.flags.reqUntil; msgs.push(`${shipName(s, sh.id)} returns from Army requisition`);
      }
    });
    msgs.forEach(m => log(s, m, 'ship'));
    if (s.human === 'BR') return G('A2up');
    return G('A3');
  },
  // British Solo 7.1: roll for the maximum number of "A" ships that may go to Make Ready to upgrade
  A2up(s, f) {
    const cand = sideShips(s, 'BR').filter(sh => sh.ver === 'A' && !sh.isolated && (sh.box === 'deployable' || (sh.box === 'repairing' && !sh.delay)));
    const strip = sideShips(s, 'BR').filter(sh => sh.box === 'transit' && isCLS(sh));
    if (!cand.length) { return G('A3'); }
    const r = d10r(s);
    let n = upgradeLimit(r) + strip.length;
    f.L.upN = n;
    log(s, `Upgrade roll 1d10 = ${r} → up to ${upgradeLimit(r)} “A” ships${strip.length ? ` +${strip.length} for stripped captured Laker Schooners` : ''} may go to Make Ready.`, 'roll');
    if (!n) return G('A3');
    return P({ kind: 'select', title: 'A2 British Ship Upgrades', text: `Rolled ${r}: you may place up to ${n} “A” version ship(s) in Make Ready. They return next turn as their upgraded “B” version (7.1). Ships in Make Ready are not Deployable this turn.`,
      items: cand.map(sh => ({ id: sh.id, label: shipName(s, sh.id) + (sh.box === 'repairing' ? ' (finishing repairs)' : '') })), min: 0, max: n }, 'A2up2');
  },
  A2up2(s, f) {
    (f.answer || []).forEach(id => { const sh = s.ships[id]; sh.box = 'makeReady'; sh.steps = def(sh).full[4]; sh.flags.upgrading = true; log(s, `${shipName(s, id)} goes to Make Ready for upgrade.`, 'player'); });
    return G('A3');
  },

  /* A3 Repairs ----------------------------------------------------------------------- */
  A3(s, f) {
    s.stepLabel = 'A3 Repairs';
    const msgs = [];
    Object.values(s.ships).forEach(sh => {
      if (sh.box === 'repairing') {
        if (sh.delay > 0) { sh.delay--; msgs.push(`${shipName(s, sh.id)} stays in Repairing (delay marker removed)`); }
        else {
          sh.steps = def(sh).full[4];
          if (sh.flags.builtDamaged) { delete sh.flags.builtDamaged; sh.box = 'makeReady'; msgs.push(`${shipName(s, sh.id)} repaired – to Make Ready`); }
          else { sh.box = 'deployable'; msgs.push(`${shipName(s, sh.id)} repaired – Deployable`); }
        }
      }
    });
    Object.values(s.ships).forEach(sh => {
      if (sh.box === 'transit') {
        if (sh.owner === 'BR' && isCLS(sh)) { sh.box = 'outOfPlay'; msgs.push(`Captured ${def(sh).name} is stripped by the British and removed from play`); }
        else if (isReduced(sh)) { sh.box = 'repairing'; msgs.push(`${shipName(s, sh.id)} In Transit → Repairing`); }
        else { sh.box = 'deployable'; }
      }
      if (sh.box === 'ordinary' && sh.flags.damaged) { delete sh.flags.damaged; sh.box = 'repairing'; msgs.push(`${shipName(s, sh.id)} (Heated Shot damage) In Ordinary → Repairing`); }
    });
    msgs.forEach(m => log(s, m, 'ship'));
    return G('A4');
  },

  /* A4 In Ordinary / 30-point squadron limit ------------------------------------------ */
  A4(s, f) {
    s.stepLabel = 'A4 In Ordinary';
    // A.I.: re-activate laid-up ships, then enforce the 30 Close Action limit
    aiSquadronLimit(s);
    const h = s.human;
    const pool = sideShips(s, h).filter(sh => (sh.box === 'deployable' || (sh.box === 'ordinary' && !sh.flags.damaged)));
    if (!pool.length) return G('A5');
    const total = sumBy(pool.filter(sh => sh.box === 'deployable'), ca);
    return P({ kind: 'select', title: 'A4 In Ordinary? (30-point limit)', validate: 'squadron30',
      text: `Select the ships to keep In Ordinary this turn (laid up, not Deployable). Your Deployable squadron may total at most 30 Close Action points [5.2]. Current Deployable total: ${total}.`,
      items: pool.map(sh => ({ id: sh.id, label: `${shipName(s, sh.id)} – CA ${ca(sh)}`, ca: ca(sh) })),
      initial: pool.filter(sh => sh.box === 'ordinary').map(sh => sh.id), min: 0, max: pool.length }, 'A4b');
  },
  A4b(s, f) {
    const sel = f.answer || [];
    sideShips(s, s.human).forEach(sh => {
      if (sh.box === 'ordinary' && !sh.flags.damaged && sel.indexOf(sh.id) < 0) { sh.box = 'deployable'; log(s, `${shipName(s, sh.id)} recommissioned from In Ordinary.`, 'player'); }
      else if (sh.box === 'deployable' && sel.indexOf(sh.id) >= 0) { sh.box = 'ordinary'; log(s, `${shipName(s, sh.id)} placed In Ordinary.`, 'player'); }
    });
    return G('A5');
  },

  /* A5 Naval Construction ---------------------------------------------------------- */
  A5(s, f) {
    s.stepLabel = 'A5 Naval Construction';
    Object.keys(CONSTRUCTION_TRIGGERS).forEach(id => {
      const t = CONSTRUCTION_TRIGGERS[id], sh = s.ships[id];
      if (!sh || sh.box !== 'construction') return;
      if (s.supply[t.side] >= t.space) {
        if (s.cd[t.side] > 0) { log(s, `${def(sh).name} is ready to launch but ${SIDE_SHORT[t.side]} Construction Delay is ${s.cd[t.side]} – she stays in Construction.`, 'ship'); return; }
        if (isReduced(sh)) { sh.box = 'repairing'; sh.flags.builtDamaged = true; log(s, `${def(sh).name} is launched damaged (Shipyard Damage) – to Repairing.`, 'ship'); }
        else { sh.box = 'makeReady'; log(s, `${def(sh).name} launched – Construction → Make Ready (Deployable next turn).`, 'ship'); }
      }
    });
    changeCD(s, 'US', -1, 'free reduction A5'); changeCD(s, 'BR', -1, 'free reduction A5');
    aiConstructionDelayPurchase(s);
    if (s.cd[s.human] > 0) {
      const pool = deployable(s, s.human).filter(sh => ca(sh) > 0);
      if (pool.length) return P({ kind: 'select', title: 'A5 Buy down Construction Delay?',
        text: `Your Construction Delay is ${s.cd[s.human]}. Optionally place more ships In Ordinary: every 2 Close Action points placed In Ordinary lowers Construction Delay by 1 [8.1].`,
        items: pool.map(sh => ({ id: sh.id, label: `${shipName(s, sh.id)} – CA ${ca(sh)}` })), min: 0, max: pool.length }, 'A5b');
    }
    return G('A6');
  },
  A5b(s, f) {
    const sel = (f.answer || []).map(id => s.ships[id]);
    if (sel.length) {
      const pts = sumBy(sel, ca);
      sel.forEach(sh => { sh.box = 'ordinary'; });
      log(s, `Placed In Ordinary: ${sel.map(sh => shipName(s, sh.id)).join(', ')} (${pts} CA).`, 'player');
      changeCD(s, s.human, -Math.floor(pts / 2), 'ships placed In Ordinary');
    }
    return G('A6');
  },

  /* A6 Naval Balance ----------------------------------------------------------------- */
  A6(s, f) {
    s.stepLabel = 'A6 Naval Balance';
    if (s.turn > 0) { s.nb = computeNavalBalance(s); s.nbBand = navalBalanceBand(s.nb); }
    log(s, `Naval Balance ${s.nb >= 0 ? '+' : ''}${s.nb} → band “${NB_LABELS[s.nbBand]}” (${NB_CARDS[s.human][s.nbBand]} Target Cards).`, 'track');
    return G('A7');
  },

  /* A7 Assign ships ------------------------------------------------------------------- */
  A7(s, f) {
    s.stepLabel = 'A7 Assign Ships';
    s.phase = 'prep';
    // Flagships [LC5.1]
    ['US', 'BR'].forEach(side => {
      const fs = s.ships[s.flagship[side]];
      if (side === 'US' && s.ships.pike.owner === 'US' && s.ships.pike.box === 'deployable' && s.flagship.US !== 'pike' && !s.turnFlags.pikeFlagDone) { s.flagship.US = 'pike'; s.turnFlags.pikeFlagDone = true; }
      if (!fs || fs.owner !== side || fs.box !== 'deployable') {
        const cand = deployable(s, side).sort((a, b) => vpCapture(b) - vpCapture(a) || ca(b) - ca(a));
        if (cand.length) { s.flagship[side] = cand[0].id; log(s, `New ${SIDE_SHORT[side]} Flagship: ${shipName(s, cand[0].id)}.`, 'ship'); }
      }
    });
    return P(buildAssignPrompt(s), 'A7b');
  },
  A7b(s, f) {
    applyAssignment(s, f.answer);
    return G('A8');
  },

  /* A8 reveal AI Troops ------------------------------------------------------------- */
  A8(s, f) {
    s.stepLabel = 'A8 AI Troops';
    let rev = 0, dum = 0;
    s.aiTroops.box = s.aiTroops.box.filter(m => {
      if (!m.revealed) { m.revealed = true; if (m.troops) rev++; else { dum++; return false; } }
      return true;
    });
    if (rev || dum) log(s, `A8: revealed AI Troops markers – ${rev} Troops, ${dum} dummy (discarded).`, 'ai');
    log(s, `AI Available Troops this turn: ${aiTroopsInBox(s)}.`, 'ai');
    return G('A9');
  },

  /* A9 / A10 Target Cards ---------------------------------------------------------- */
  A9(s, f) {
    s.stepLabel = 'A9-A10 Target Cards';
    const deckId = s.human === 'US' ? 'A' : 'B';
    let ids = Object.keys(TARGET_CARDS).filter(k => TARGET_CARDS[k].deck === deckId);
    const removed = [];
    if (s.turn === 7) { const r = ids.filter(k => TARGET_CARDS[k].lastTurn); removed.push(`${r.length} final-turn cards`); ids = ids.filter(k => !TARGET_CARDS[k].lastTurn); }
    if (usingTempHomeport(s, s.ai)) { const r = ids.filter(k => TARGET_CARDS[k].isolated); removed.push(`${r.length} hourglass cards (AI Isolated ships)`); ids = ids.filter(k => !TARGET_CARDS[k].isolated); }
    s.deck.target = shuffle(s, ids);
    const n = NB_CARDS[s.human][s.nbBand];
    let row = s.deck.target.slice(0, n);
    s.deck.target = s.deck.target.slice(n);
    // Blockaded AI Homeport: AI homeport-zone cards to the left; search for one if none
    if (isBlockaded(s, s.ai)) {
      const hz = homeZone(s.ai);
      let hzCards = row.filter(k => TARGET_CARDS[k].zone === hz);
      if (!hzCards.length) {
        const fromDeck = s.deck.target.find(k => TARGET_CARDS[k].zone === hz);
        if (fromDeck) { s.deck.target = s.deck.target.filter(k => k !== fromDeck); hzCards = [fromDeck]; row = [fromDeck].concat(row); }
      }
      row = hzCards.concat(row.filter(k => TARGET_CARDS[k].zone !== hz));
    }
    s.targetRow = row.map(id => ({ id, revealed: false, removed: false, enc: false }));
    log(s, `Drew ${n} Target Cards${removed.length ? ' (removed ' + removed.join(', ') + ')' : ''}. Row backs (left→right): ${s.targetRow.map(c => ZONE_NAME[TARGET_CARDS[c.id].zone]).join(' · ')}.`, 'ai');
    return aiPause(s, 'A10 Target Cards drawn', `Lay out ${n} Target Cards face down, left to right, showing these zones:\n${s.targetRow.map((c, i) => `${i + 1}. ${ZONE_NAME[TARGET_CARDS[c.id].zone]}`).join('\n')}`, 'B1');
  },

  /* B Lake Action ---------------------------------------------------------------------- */
  B1(s, f) {
    s.phase = 'lake'; s.stepLabel = 'B1 Possible Encounters';
    // Number Possible Encounters by row order
    f.L.zoneCounters = {};
    f.L.pending = [];
    s.targetRow.forEach((c, idx) => {
      const z = TARGET_CARDS[c.id].zone;
      if (forcesInZone(s, z, s.human).length) f.L.pending.push({ idx, zone: z });
    });
    f.L.zonesNeedingChoice = [...new Set(f.L.pending.map(p => p.zone))].filter(z => forcesInZone(s, z, s.human).length > 1);
    f.L.firstForce = {};
    return G('B1choose');
  },
  B1choose(s, f) {
    const z = f.L.zonesNeedingChoice.shift();
    if (!z) return G('B1place');
    f.L.curZone = z;
    const fs = forcesInZone(s, z, s.human);
    return P(choice(`B1 Possible Encounters in ${ZONE_NAME[z]}`, `${f.L.pending.filter(p => p.zone === z).length} Possible Encounter marker(s) fall in ${ZONE_NAME[z]}, where you have ${fs.length} Forces. Choose the Force that receives the first marker; further markers rotate evenly through your other Forces there [10.1.2].`,
      fs.map(x => ({ id: x.id, label: forceLabel(s, x) }))), 'B1choose2');
  },
  B1choose2(s, f) { f.L.firstForce[f.L.curZone] = f.answer; return G('B1choose'); },
  B1place(s, f) {
    const rot = {};
    f.L.pending.forEach(p => {
      let fs = forcesInZone(s, p.zone, s.human);
      if (f.L.firstForce[p.zone]) { const i = fs.findIndex(x => x.id === f.L.firstForce[p.zone]); fs = fs.slice(i).concat(fs.slice(0, i)); }
      rot[p.zone] = rot[p.zone] || 0;
      const force = fs[rot[p.zone] % fs.length]; rot[p.zone]++;
      s.pe.push({ num: s.peNext++, zone: p.zone, forceId: force.id, idx: p.idx, status: 'possible' });
    });
    if (!s.pe.length) { log(s, 'B1: no Possible Encounters this turn.', 'ai'); return G('C1'); }
    log(s, `B1: Possible Encounters – ${s.pe.map(p => `PE${p.num} ${ZONE_NAME[p.zone]} (card ${p.idx + 1})`).join(', ')}.`, 'ai');
    return aiPause(s, 'B1 Possible Encounters', `Place Possible Encounter markers:\n${s.pe.map(p => `PE${p.num} on your ${forceLabel(s, s.forces[p.forceId])} in ${ZONE_NAME[p.zone]}`).join('\n')}`, 'B2');
  },
  B2(s, f) {
    s.stepLabel = 'B2 Encounter Checks';
    const pe = s.pe.find(p => p.status === 'possible');
    if (!pe) return G('C1');
    if (!aiHasDeployable(s, 'lake')) {
      s.pe.filter(p => p.status === 'possible').forEach(p => { p.status = 'discarded'; });
      log(s, 'No AI Deployable ships remain – remaining Possible Encounter markers removed.', 'ai');
      return G('C1');
    }
    let force = s.forces[pe.forceId];
    if (!force || force.zone !== pe.zone || !force.ships.length || force.side !== s.human) {
      // 11.1.3: transfer the marker to another of your Forces still in the zone, if any
      const other = forcesInZone(s, pe.zone, s.human)[0];
      if (!other) { pe.status = 'discarded'; log(s, `PE${pe.num}: you have no Force left in ${ZONE_NAME[pe.zone]} – marker discarded.`, 'ai'); return G('B2'); }
      pe.forceId = other.id; force = other;
      log(s, `PE${pe.num} transferred to your ${forceLabel(s, other)}.`, 'ai');
    }
    const ev = drawEvent(s, `Encounter Check PE${pe.num}`, false);
    if (!ev.spy) {
      pe.status = 'discarded';
      log(s, `PE${pe.num} ${ZONE_NAME[pe.zone]}: Event #${ev.id} – no spyglass, false alarm.`, 'event');
      return aiPause(s, `Encounter Check PE${pe.num}`, `Event Card #${ev.id} (${EVENT_TITLE[ev.lake]}): no man-with-spyglass – false alarm. Remove PE${pe.num}.`, 'B2', { eventCard: ev.id });
    }
    pe.status = 'encounter';
    s.targetRow[pe.idx].revealed = true; s.targetRow[pe.idx].enc = true;
    log(s, `PE${pe.num} ${ZONE_NAME[pe.zone]}: Event #${ev.id} shows the spyglass – ENCOUNTER ${pe.num}! Target Card ${s.targetRow[pe.idx].id} revealed.`, 'event');
    f.L.pe = pe.num;
    return C('aiDeploy', { cardIdx: pe.idx, zone: pe.zone, phase: 'lake', encounter: true, humanForceId: pe.forceId, peNum: pe.num }, 'B2after');
  },
  B2after(s, f) {
    const pe = s.pe.find(p => p.num === f.L.pe);
    const res = f.ret;
    if (!res || res.none || res.convoyHandled) {
      // A confirmed Encounter with no A.I. deployment (or an unescorted Convoy) still ends your Force's
      // Encounter: it gets an Encounter Ended marker, so a Cutting-Out or other mission cannot go on
      pe.status = 'ended';
      const hf = s.forces[pe.forceId];
      if (hf && hf.side === s.human) hf.ended = true;
      return G('B2');
    }
    return C('encounter', { zone: pe.zone, kind: res.convoy ? 'convoy' : 'normal', convoySide: res.convoy || null, peNum: pe.num, humanForces: res.escortForces || [pe.forceId], aiForces: res.forces, startAt: 'event' }, 'B2done');
  },
  B2done(s, f) {
    const pe = s.pe.find(p => p.num === f.L.pe);
    pe.status = 'ended';
    return G('B2');
  },

  /* C Enemy Operations ------------------------------------------------------------- */
  C1(s, f) {
    s.phase = 'enemy'; s.stepLabel = 'C Enemy Operations';
    if (!aiHasDeployable(s)) {
      log(s, 'C1: the AI has no Deployable ships – no Enemy Operations.', 'ai');
      s.targetRow.forEach(c => { c.removed = true; });
      return G('D1');
    }
    // C2 edit the row
    s.targetRow.forEach(c => {
      if (c.enc) c.removed = true;
      else if (shipsInZone(s, TARGET_CARDS[c.id].zone, s.human).length) c.removed = true;
    });
    const left = s.targetRow.filter(c => !c.removed);
    if (!left.length) { log(s, 'C2: no Target Cards remain – no Enemy Operations.', 'ai'); return G('D1'); }
    left.forEach(c => { c.revealed = true; });
    log(s, `C3: revealed ${left.map(c => c.id + ' ' + ZONE_NAME[TARGET_CARDS[c.id].zone] + ' ' + MISSION_NAME[TARGET_CARDS[c.id].mission]).join('; ')}.`, 'ai');
    f.L.queue = s.targetRow.map((c, i) => i).filter(i => !s.targetRow[i].removed);
    return aiPause(s, 'C Enemy Operations', `Remove the Target Cards for Encounters and for zones containing your ships. Reveal the rest (left → right):\n${left.map(c => `${c.id}: ${ZONE_NAME[TARGET_CARDS[c.id].zone]} – ${MISSION_NAME[TARGET_CARDS[c.id].mission]}${TARGET_CARDS[c.id].secondary ? ' (' + MISSION_NAME[TARGET_CARDS[c.id].secondary] + ')' : ''}`).join('\n')}`, 'C4');
  },
  C4(s, f) {
    if (!f.L.queue.length) return G('D1');
    if (!aiHasDeployable(s)) return G('D1');
    if (s.human === 'BR' && aiDeployablePool(s).length < 2) { log(s, 'Enemy Operations end: fewer than two AI Deployable ships remain.', 'ai'); return G('D1'); }
    const idx = f.L.queue.shift();
    const c = s.targetRow[idx];
    return C('aiDeploy', { cardIdx: idx, zone: TARGET_CARDS[c.id].zone, phase: 'enemy', encounter: false }, 'C4b');
  },
  C4b(s, f) { return G('C4'); },

  /* D Breakout Attacks ------------------------------------------------------------- */
  D1(s, f) {
    s.phase = 'breakout'; s.stepLabel = 'D Breakout Attacks';
    const h = s.human, ai = s.ai;
    f.L.done = f.L.done || {};
    if (isBlockaded(s, h) && !f.L.done.h) {
      f.L.done.h = true;
      const blockaders = shipsInZone(s, homeZone(h), ai);
      const mine = deployable(s, h, 'home');
      if (!blockaders.length) {
        // 14.3 note: an unmaintained Blockade lapses in F2.3, so no Breakout is needed and the Convoy is not delayed
        log(s, 'D: no enemy ships are on station outside your Homeport – the Blockade will lapse in F2.3 and your Convoy runs on schedule.', 'player');
        return G('D1');
      }
      if (mine.some(isFull)) {
        return P(choice('D Breakout Attack?', `Your Homeport is Blockaded by ${blockaders.map(sh => shipName(s, sh.id)).join(', ')}. Launch a Breakout Attack with your ships in port (you start with the Weather Gage), or Pass?`,
          [{ id: 'attack', label: 'Breakout Attack', primary: true }, { id: 'pass', label: 'Pass' }]), 'D1h');
      }
      f.answer = 'pass'; return G('D1h');
    }
    if (isBlockaded(s, ai) && !f.L.done.ai) {
      f.L.done.ai = true;
      const bc = aiBreakoutCheck(s, ai);
      if (!bc.blockaders.length) {
        log(s, 'D: none of your ships are on station outside the AI Homeport – the Blockade will lapse in F2.3 and the AI Convoy is not delayed.', 'ai');
        return G('D1');
      }
      if (bc.ok) {
        log(s, `AI Breakout check: ${bc.label} ${bc.a} vs your ${bc.b} – the AI breaks out!`, 'ai');
        return C('encounter', { zone: homeZone(ai), kind: 'breakout', breakoutSide: ai, startAt: 'event' }, 'D1');
      }
      log(s, `AI Breakout check: ${bc.label} ${bc.a} vs your ${bc.b} – the AI stays in port; the Blockade continues.`, 'ai');
      const c = s.convoys[ai][s.turn]; if (c) { c.delay = true; }
      return G('D1');
    }
    return G('E');
  },
  D1h(s, f) {
    if (f.answer === 'attack') return C('encounter', { zone: homeZone(s.human), kind: 'breakout', breakoutSide: s.human, startAt: 'event' }, 'D1');
    const c = s.convoys[s.human][s.turn];
    if (c && c.real) { c.delay = true; log(s, 'You pass; your Convoy scheduled this turn receives a Convoy Delay marker.', 'player'); }
    return G('D1');
  },
  E(s, f) { return C('coastal', {}, 'F'); },
  F(s, f) { return C('tally', {}, 'next'); },
  next(s, f) {
    if (s.over) return R();
    s.turn++;
    if (s.turn > 7) { endGame(s); return R(); }
    // 5.1 Last-turn sudden death
    if (s.turn === 7 && !sideShips(s, s.ai).some(sh => aiShipDeployableNextTurn(s, sh, s.turn))) {
      log(s, 'Sudden death (5.1): the AI has no ships eligible to be Deployable on the last turn – the game ends.', 'turn');
      endGame(s); return R();
    }
    return G('start');
  },
};

/* ------------------------------------------------------------------------- */
// 14.1.2: Blockaded ships may not Deploy in an Enemy Operations Phase (nor react, by analogy with 11.2.1);
// they may still Deploy for a Lake Action Encounter (the A10 left-shift makes the blockaders' zone come first).
// 14.3: the Blockaded A.I. breaks out if its in-port Carronade (British) / Long Gun (U.S.) total
// exceeds that of the blockading ships.
function aiBreakoutCheck(s, ai) {
  const blockaders = shipsInZone(s, homeZone(ai), OTHER[ai]);
  const theirs = deployable(s, ai, 'home');
  const key = ai === 'BR' ? car : lg;
  const a = sumBy(theirs, key), b = sumBy(blockaders, key);
  return { ok: !!(theirs.length && blockaders.length && a > b), a, b, blockaders, label: ai === 'BR' ? 'Carronade' : 'Long Gun' };
}
// Whether a Blockaded side meets the requirements to launch a Breakout Attack (14.2 / 14.3)
function canLaunchBreakout(s, side) {
  if (side === s.ai) return aiBreakoutCheck(s, side).ok;
  return shipsInZone(s, homeZone(side), OTHER[side]).length > 0 && deployable(s, side, 'home').some(isFull);
}
// 5.1: will this A.I. ship be Deployable in next turn's Preparation Phase?
function aiShipDeployableNextTurn(s, sh, nextTurn) {
  switch (sh.box) {
    case 'deployable': case 'makeReady': return true;                    // A2: Make Ready → Deployable
    case 'repairing': return !sh.delay && !sh.flags.builtDamaged;         // A3.i (delayed / newly built go elsewhere)
    case 'transit': return isFull(sh);                                     // A3.ii: Reduced ships go to Repairing
    case 'ordinary': return !sh.flags.damaged;                             // A4: the A.I. recommissions laid-up ships
    case 'requisitioned': return sh.flags.reqUntil != null && nextTurn >= sh.flags.reqUntil;
    default: return false;
  }
}
function aiDeployablePool(s, phase) {
  const ai = s.ai;
  if (phase === 'lake') return deployable(s, ai);
  if (isBlockaded(s, ai)) return deployable(s, ai).filter(sh => sh.port === 'temp');
  return deployable(s, ai);
}
function aiHasDeployable(s, phase) { return aiDeployablePool(s, phase).length > 0; }

function aiSquadronLimit(s) {
  ['US', 'BR'].forEach(side => {
    if (side === s.human) return;
    // recommission laid-up (undamaged) ships, then trim to 30 CA
    sideShips(s, side).forEach(sh => { if (sh.box === 'ordinary' && !sh.flags.damaged) sh.box = 'deployable'; });
    let pool = deployable(s, side);
    let total = sumBy(pool, ca);
    if (total <= 30) return;
    const order = pool.slice().sort((a, b) => (isMain(a) - isMain(b)) || (vpCapture(a) - vpCapture(b)) || (ca(a) - ca(b)));
    const out = [];
    for (const sh of order) { if (total <= 30) break; if (sh.id === s.flagship[side]) continue; if (ca(sh) <= 0) continue; sh.box = 'ordinary'; total -= ca(sh); out.push(shipName(s, sh.id)); }
    if (out.length) log(s, `AI 30-point limit: ${out.join(', ')} placed In Ordinary.`, 'ai');
  });
}
function aiConstructionDelayPurchase(s) {
  const side = s.ai;
  if (s.cd[side] <= 0) return;
  const need = s.cd[side] * 2;
  const pool = deployable(s, side).filter(sh => ca(sh) > 0 && sh.id !== s.flagship[side])
    .sort((a, b) => (isMain(a) - isMain(b)) || (ca(a) - ca(b)) || (vpCapture(a) - vpCapture(b)));
  let pts = 0; const out = [];
  for (const sh of pool) { if (pts >= need) break; sh.box = 'ordinary'; pts += ca(sh); out.push(shipName(s, sh.id)); }
  if (out.length) {
    log(s, `AI must buy down Construction Delay: ${out.join(', ')} placed In Ordinary (${pts} CA).`, 'ai');
    changeCD(s, side, -Math.floor(pts / 2), 'AI ships placed In Ordinary');
  }
}

SELECT_VALIDATORS.squadron30 = function (s, p, a) {
  const keep = p.items.filter(i => a.indexOf(i.id) < 0);
  const t = sumBy(keep, i => i.ca);
  if (t > 30) return `Deployable squadron would total ${t} Close Action points – the limit is 30. Place more ships In Ordinary.`;
  if (a.indexOf(s.flagship[s.human]) >= 0 && keep.length) return null;
  return null;
};

function endGame(s, forced) {
  s.phase = 'end'; s.stepLabel = 'Game Over';
  if (forced) {
    const score = gameScore(s);
    s.result = { score, level: forced === 'BR' ? 'British Decisive Victory (Dual Blockade)' : 'U.S. Decisive Victory (Dual Blockade)', forced };
  } else {
    ['US', 'BR'].forEach(side => { if (s.cd[side] > 0) addVP(s, side, -s.cd[side], 'final Construction Delay deducted'); });
    const score = gameScore(s);
    s.result = { score, level: victoryLevel(score) };
  }
  s.over = true;
  s.prompt = null;
  log(s, `GAME OVER – Game Score ${s.result.score >= 0 ? '+' : ''}${s.result.score}: ${s.result.level}.`, 'turn');
}
