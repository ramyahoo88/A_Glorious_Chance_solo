/* ============================================================================
   Encounter Cycle (Rule 11): Patrol Segment, Reaction Segment, Lake Zone
   Events, Command Decision, Struck Colors resolution.
   ========================================================================== */
function enc(s) { return s.encounter; }
function encIds(s, side, statuses) {
  const e = s.encounter; if (!e) return [];
  const st = statuses || ['in'];
  return Object.keys(e.ships).filter(id => e.side[id] === side && st.indexOf(e.ships[id]) >= 0 && s.ships[id]);
}
function belongsToEncounter(e, id) {
  return !!e.ships[id] && e.ships[id] !== 'out';
}
function encAdd(s, id, status) {
  const e = s.encounter;
  e.ships[id] = status || 'in';
  e.side[id] = s.ships[id].owner;
  if (s.flagship[e.side[id]] === id) { e.flagIn = e.flagIn || {}; e.flagIn[e.side[id]] = true; }
}
// Did the side's Flagship take part in the current Encounter? (flagIn is recorded as ships join; saves
// made before 0.2.2 have no record, so fall back to the ships present.)
function flagshipInEncounter(s, side) {
  const e = s.encounter; if (!e) return false;
  return !!((e.flagIn && e.flagIn[side]) || e.ships[s.flagship[side]]);
}
// Event cards 29/31: Intelligence is drawn in the Coastal Action Phase and applies next turn, to the next
// Encounter involving the enemy Flagship; that Encounter uses it up.
function consumeIntelligence(s) {
  if (!s.encounter) return;
  ['US', 'BR'].forEach(side => {
    const it = s.intelligence[side];
    if (it && s.turn === it.until && flagshipInEncounter(s, OTHER[side])) {
      s.intelligence[side] = null;
      log(s, `Intelligence (Event #${it.card}) has been used in this Encounter with the enemy Flagship – the card returns to the Event deck.`, 'event');
    }
  });
}
// Effects that last for one Encounter only end here: normal end, Harbor end, and before a Pursuit
// starts a new Encounter between the same forces.
function endEncounterEffects(s) {
  const e = s.encounter; if (!e) return;
  consumeIntelligence(s);
  if (s.zones[e.zone] && s.zones[e.zone].flags) delete s.zones[e.zone].flags.breeze;   // Event cards 37-38
}

PROCS.encounter = {
  start(s, f) {
    const A = f.A;
    s.encounter = { zone: A.zone, kind: A.kind, segment: 'patrol', peNum: A.peNum || null, ships: {}, side: {}, struckBy: {},
      convoySide: A.convoySide || null, breakoutSide: A.breakoutSide || null, wg: null, wgCard: null, withdrawn: { US: false, BR: false },
      humanForce: (A.humanForces || [])[0] || null, aiForce: (A.aiForces || [])[0] || null, firstAttack: true, log: [] };
    const e = s.encounter;
    if (A.kind === 'breakout') {
      const bs = A.breakoutSide, other = OTHER[bs], z = A.zone;
      const sortie = deployable(s, bs, 'home').map(sh => sh.id);
      // 7.1: British ships leaving port for an Encounter make Upgrade Checks (U.S. campaign)
      if (bs === 'BR' && s.human === 'US') upgradeChecksFor(s, sortie);
      const sf = newForce(s, bs, z, 'Patrol', sortie, { origin: 'breakout' });
      const blk = shipsInZone(s, z, other).map(sh => sh.id);
      sortie.forEach(id => encAdd(s, id)); blk.forEach(id => encAdd(s, id));
      if (bs === s.human) e.humanForce = sf.id; else e.aiForce = sf.id;
      const of = forcesInZone(s, z, other)[0]; if (of) { if (other === s.human) e.humanForce = of.id; else e.aiForce = of.id; }
      log(s, `BREAKOUT ATTACK at ${ZONE_NAME[z]}: ${sortie.map(id => shipName(s, id)).join(', ')} sortie against ${blk.map(id => shipName(s, id)).join(', ')}.`, 'combat');
    } else {
      (A.humanForces || []).forEach(fid => (s.forces[fid] ? s.forces[fid].ships : []).forEach(id => encAdd(s, id)));
      (A.aiForces || []).forEach(fid => (s.forces[fid] ? s.forces[fid].ships : []).forEach(id => encAdd(s, id)));
    }
    return G('event');
  },

  /* EN1.2 Lake Zone Event & Weather Gage ------------------------------------------ */
  event(s, f) {
    const e = s.encounter, z = e.zone;
    s.stepLabel = `Encounter ${e.peNum || ''} – Lake Zone Event & Weather Gage`;
    const newZoneEvent = !s.zones[z].event;
    // Card 30 permits Gale only during Lake Action, even when another phase
    // begins an Encounter at EN1.2 (such as a Breakout).
    const ev = drawEvent(s, `Encounter ${ZONE_NAME[z]} (Weather Gage${newZoneEvent ? ' + Lake Zone Event' : ''})`, newZoneEvent && s.phase === 'lake');
    f.L.ev = ev.id;
    let lines = [`Event Card #${ev.id}.`];
    if (newZoneEvent) {
      s.zones[z].event = ev.id;
      lines.push(`Lake Zone Event in ${ZONE_NAME[z]}: ${EVENT_TITLE[ev.lake]}${ev.lakeSide ? ' (' + SIDE_SHORT[ev.lakeSide] + ')' : ''} – ${EVENT_TEXT[ev.lake](ev.lakeSide)}`);
      log(s, `Lake Zone Event in ${ZONE_NAME[z]}: #${ev.id} ${EVENT_TITLE[ev.lake]}${ev.lakeSide ? ' (' + SIDE_SHORT[ev.lakeSide] + ')' : ''}.`, 'event');
      const res = applyLakeEvent(s, ev, z);
      if (res.text) lines.push(res.text);
      if (res.gale) { f.L.gale = true; return P(info('Gale!', lines.join('\n'), { eventCard: ev.id }), 'end'); }
    } else {
      lines.push(`(${ZONE_NAME[z]} already has its Lake Zone Event for this turn – ${EVENT_TITLE[EVENTS[s.zones[z].event].lake]}.)`);
    }
    if (e.kind === 'breakout') { e.wg = e.breakoutSide; lines.push(`Breakout: the ${SIDE_PL[e.breakoutSide]} start with the Weather Gage [14.3].`); }
    else { e.wg = ev.wg === 'A' ? 'US' : 'BR'; lines.push(`Starting Weather Gage: ${SIDE_NAME[e.wg]} (Combat Sequence ${ev.wg}).`); }
    e.wgCard = ev.id;
    log(s, `Weather Gage: ${SIDE_NAME[e.wg]}.`, 'event');
    if (!encIds(s, 'US').length || !encIds(s, 'BR').length) { lines.push('One side has no ships left in the Encounter – it ends.'); return P(info('Encounter', lines.join('\n'), { eventCard: ev.id }), 'end'); }
    return P(info(`Encounter ${e.peNum || ''} in ${ZONE_NAME[z]}`, lines.join('\n'), { eventCard: ev.id }), 'command');
  },

  /* EN1.3 Command Decision ---------------------------------------------------------- */
  command(s, f) {
    const e = s.encounter, h = s.human;
    if (!encIds(s, 'US').length || !encIds(s, 'BR').length) return G('end');
    s.stepLabel = `Encounter – Command Decision (${e.segment} segment)`;
    if (e.kind === 'breakout' && e.firstAttack) {
      e.firstAttack = false;
      if (e.wg === h) return C('combat', { attacker: h, segment: e.segment, decided: true }, 'afterCombat');
      const dec = aiAttackDecision(s, true);
      if (!dec.ships.length) return G('segEnd');
      return C('combat', { attacker: s.ai, segment: e.segment, decided: true, aiPlan: dec }, 'afterCombat');
    }
    if (e.wg === h) {
      return P(choice('Command Decision – you hold the Weather Gage', `${encSummary(s)}\nAttack (Lake Combat, Combat Sequence ${h === 'US' ? 'A' : 'B'}) or Pass (${e.segment === 'patrol' && e.kind !== 'convoy' ? 'Patrol Segment ends; go to the Reaction Segment' : 'the Encounter ends'})?`,
        [{ id: 'attack', label: 'Attack', primary: true }, { id: 'pass', label: 'Pass' }], { combatPreview: true }), 'commandHuman');
    }
    if (e.segment === 'patrol' && e.kind !== 'convoy') {
      return P(choice('Command Decision – the A.I. holds the Weather Gage', `${encSummary(s)}\nConfront (seek battle: if the A.I. doesn't attack, go on to the Reaction Segment) or Bypass (deny battle: if the A.I. doesn't attack, the Encounter ends)?`,
        [{ id: 'confront', label: 'Confront', primary: true }, { id: 'bypass', label: 'Bypass' }], { combatPreview: true }), 'commandAI');
    }
    // The A.I. makes its own attack check here. No player decision was offered.
    f.answer = null;
    return G('commandAI');
  },
  commandHuman(s, f) {
    const e = s.encounter;
    if (f.answer === 'attack') { e.firstAttack = false; return C('combat', { attacker: s.human, segment: e.segment }, 'afterCombat'); }
    log(s, `You Pass with the Weather Gage.`, 'player');
    e.lastEnd = 'pass';
    return G('segEnd');
  },
  commandAI(s, f) {
    const e = s.encounter;
    f.L.decision = f.answer;
    if (f.answer) log(s, `Command Decision: ${f.answer === 'confront' ? 'Confront' : 'Bypass'}.`, 'player');
    const dec = aiAttackDecision(s, false);
    f.L.dec = dec;
    if (dec.ships.length) {
      e.firstAttack = false;
      return P(info('The A.I. attacks!', `${dec.why}`), 'aiAttack');
    }
    log(s, `A.I. does not attack: ${dec.why}`, 'ai');
    e.lastEnd = 'pass';
    if (e.segment === 'patrol' && f.answer === 'confront') return P(info('The A.I. declines battle', `${dec.why}\nThe Patrol Segment ends; the Encounter continues to the Reaction Segment.`), 'segEnd');
    return P(info('The A.I. declines battle', `${dec.why}\nThe Encounter ends.`), 'end');
  },
  aiAttack(s, f) { return C('combat', { attacker: s.ai, segment: s.encounter.segment, aiPlan: f.L.dec }, 'afterCombat'); },
  afterCombat(s, f) {
    const e = s.encounter, r = f.ret || {};
    if (r.outcome === 'pursuit') {
      log(s, 'Pursuit! The withdrawal is cancelled and a new Encounter begins between the same forces.', 'combat');
      endEncounterEffects(s);   // the Encounter that just ended uses up its one-Encounter effects
      // That Encounter's surrenders are settled now, as if the DW withdrawal had happened (project ruling, note 68)
      const lines = [];
      settleStruck(s, lines, r.pursued || (s.combat ? s.combat.def : null));
      lines.forEach(l => log(s, l, 'combat'));
      // Disengaged ships were eligible to withdraw: their withdrawal is cancelled and they fight on (damage kept)
      const back = Object.keys(e.ships).filter(id => e.ships[id] === 'dis');
      back.forEach(id => { e.ships[id] = 'in'; });
      if (back.length) { const t = `Back in the new Encounter: ${back.map(id => shipName(s, id)).join(', ')}.`; log(s, t, 'combat'); lines.push(t); }
      e.flagIn = {};
      Object.keys(e.ships).forEach(id => { const sd = e.side[id]; if ((e.ships[id] === 'in' || e.ships[id] === 'dis') && s.flagship[sd] === id) e.flagIn[sd] = true; });
      e.segment = 'patrol';
      if (lines.some(l => /CAPTURED|rescued/.test(l))) return P(info('Pursuit – a new Encounter', `The Encounter that just ended settles its Struck Colors ships first:\n${lines.join('\n')}`), 'event');
      return G('event');
    }
    if (r.outcome === 'encounterEnd') return G(e.kind === 'convoy' ? 'convoyCheck' : 'end');
    return G('segEnd');
  },
  segEnd(s, f) {
    const e = s.encounter;
    if (e.kind === 'convoy') return G('convoyCheck');
    if (e.segment === 'patrol' && encIds(s, 'US').length && encIds(s, 'BR').length) { e.segment = 'reaction'; return G('reaction'); }
    return G('end');
  },

  /* EN2 Reaction Segment ---------------------------------------------------------------- */
  reaction(s, f) {
    const e = s.encounter;
    s.stepLabel = 'Encounter – Reaction Segment';
    const cands = humanReactionCandidates(s);
    f.L.hc = cands;
    f.L.hlines = [];
    if (!cands.length) return G('reactionAI');
    const items = [];
    cands.forEach(c => c.ships.forEach(id => items.push({ id, label: `${shipName(s, id)} – ${c.label} (DRM ${c.drm >= 0 ? '+' : ''}${c.drm})`, group: c.key })));
    return P({ kind: 'select', title: 'Reaction Segment – declare Reaction Checks', text: `Declare all your Reaction Checks at once [11.2.2]. Each group (Force or port) makes one 1d10 roll: 5–9 succeeds (after DRMs). Successful ships join the Encounter in ${ZONE_NAME[e.zone]}.`,
      items, min: 0, max: items.length, groups: cands.map(c => ({ key: c.key, label: c.label, drm: c.drm })) }, 'reaction2');
  },
  reaction2(s, f) {
    const e = s.encounter, sel = f.answer || [];
    const lines = [];
    f.L.hc.forEach(c => {
      const ships = c.ships.filter(id => sel.indexOf(id) >= 0);
      if (!ships.length) return;
      const r = d10(s), tot = r + c.drm;
      const ok = tot >= 5;
      lines.push(`${c.label}: d10 ${r}${c.drm ? (c.drm > 0 ? ' +' : ' ') + c.drm : ''} = ${tot} → ${ok ? 'SUCCESS' : 'fails'}`);
      if (ok) joinEncounter(s, ships, s.human);
    });
    lines.forEach(l => log(s, 'Reaction: ' + l, 'roll'));
    f.L.hlines = lines;
    return G('reactionAI');
  },
  reactionAI(s, f) {
    const e = s.encounter, ai = s.ai, z = e.zone;
    const lines = (f.L.hlines || []).map(l => 'You – ' + l);
    const zEv = s.zones[z].event ? EVENTS[s.zones[z].event] : null;
    const windAI = zEv && zEv.lake === 'fairWindAI' ? 2 : 0;
    const intel = intelligenceApplies(s, ai);
    // a. Deployed AI Forces (Patrol / Attack Convoy cards), same or adjacent zone
    Object.values(s.forces).filter(fr => fr.side === ai && fr.origin === 'targetCard' && (fr.mission === 'Patrol' || fr.mission === 'AttackConvoy') && fr.ships.length)
      .forEach(fr => {
        if (fr.ships.some(id => belongsToEncounter(e, id))) return;
        const dist = zoneDistance(fr.zone, z);
        if (dist > 1) return;
        const ships = fr.ships.filter(id => isFull(s.ships[id]));
        if (!ships.length) return;
        const drm = reactionDRM(dist, windAI, intel);
        const r = d10(s), ok = r + drm >= 5;
        lines.push(`A.I. ${forceLabel(s, fr)} (${ZONE_NAME[fr.zone]}): d10 ${r}${drm ? (drm > 0 ? ' +' : ' ') + drm : ''} → ${ok ? 'SUCCESS' : 'fails'}`);
        if (ok) joinEncounter(s, ships, ai);
      });
    // c. The AI Homeport pool: one roll, no modifiers unless an Event says so
    const pool = aiDeployablePool(s).map(sh => sh.id);
    if (pool.length) {
      let drm = windAI; if (intel) drm += 1;
      const r = d10(s), ok = r + drm >= 5;
      lines.push(`A.I. Homeport Deployable ships (${pool.length}): d10 ${r}${drm ? ' +' + drm : ''} → ${ok ? 'SUCCESS – all of them sortie' : 'fails'}`);
      if (ok) {
        if (s.human === 'US') upgradeChecksFor(s, pool);
        joinEncounter(s, pool, ai);
      }
    }
    lines.slice((f.L.hlines || []).length).forEach(l => log(s, 'Reaction: ' + l, 'roll'));
    // New Weather Gage draw for the Reaction Segment
    const ev = drawEvent(s, `Reaction Segment Weather Gage (${ZONE_NAME[z]})`, false);
    e.wg = ev.wg === 'A' ? 'US' : 'BR'; e.wgCard = ev.id;
    lines.push(`Reaction Segment Weather Gage: Event #${ev.id} → ${SIDE_NAME[e.wg]}.`);
    log(s, `Reaction Segment Weather Gage: ${SIDE_NAME[e.wg]} (Event #${ev.id}).`, 'event');
    return P(info('Reaction Segment', lines.join('\n') + '\n\n' + encSummary(s), { eventCard: ev.id }), 'command');
  },

  /* 11.3.2 escorted Convoy: after the Patrol Segment ------------------------------- */
  convoyCheck(s, f) {
    const e = s.encounter, cs = e.convoySide, att = OTHER[cs];
    const attShips = encIds(s, att).map(id => s.ships[id]).filter(isFull);
    const escortOk = encIds(s, cs).map(id => s.ships[id]).some(isFull);
    if (attShips.length && !escortOk) {
      const g = sumBy(attShips, guns);
      const res = scatterRoll(s, cs, g, `${SIDE_SHORT[att]} Force`);
      return P(info('The Convoy is attacked', `The escort has been defeated or driven off. ${SIDE_NAME[att]} full-strength ships (${g} guns) attack the Convoy: ${res.txt}.`), 'end');
    }
    log(s, 'The escort protects the Convoy.', 'combat');
    return G('end');
  },

  /* Encounter ends ---------------------------------------------------------------------- */
  end(s, f) {
    const e = s.encounter;
    const lines = resolveEncounterEnd(s);
    s.encounter = null; s.combat = null;
    if (!aiHasDeployable(s, 'lake')) {
      const rest = s.pe.filter(p => p.status === 'possible');
      if (rest.length) { rest.forEach(p => { p.status = 'discarded'; }); lines.push('No AI Deployable ships remain – remaining Possible Encounter markers are removed.'); }
    }
    return P(info('Encounter ended', lines.join('\n') || 'The Encounter ends.'), '__ret');
  },
  __ret(s, f) { return R({}); },
};

// Rainy Squalls changes a Patrol Segment's first Round to Close Action. Rule 12
// Harbor Encounters instead have their own explicit two-Gunnery-Round limit.
function rainySquallsActive(s) {
  const e = s.encounter;
  return !!(e && e.kind !== 'harbor' && e.segment === 'patrol' && s.zones[e.zone].flags.rainy);
}
function closeActionPreviewText(s, attackers, defenders, aiAttacking) {
  const describe = ids => ids.map(id => `${shipName(s, id)} CA ${combatVals(s, s.ships[id])[2]}`).join(', ') || 'none';
  const pairs = closeActionMatchups(s, attackers, defenders, aiAttacking);
  const matchups = pairs.map(([a, d]) => `${shipName(s, a)} vs ${shipName(s, d)}`).join('; ');
  return `Attackers: ${describe(attackers)}. Defenders: ${describe(defenders)}. ${pairs.length ? `Close Action matchups: ${matchups}` : 'No eligible Close Action matchup at 2:1 or better'}.`;
}
function missedRoundPreview(s, attackers, defenders) {
  const ms = missedSignalShip(s);
  if (!ms || !attackers.length || !defenders.length) return '';
  if ((attackers.length === 1 && attackers[0] === ms) || (defenders.length === 1 && defenders[0] === ms)) {
    return `No combat roll in the first Round: ${shipName(s, ms)} sits out under Missed Signal`;
  }
  return '';
}
function encSummary(s) {
  const e = s.encounter;
  const side = sd => encIds(s, sd).map(id => { const sh = s.ships[id]; return `${shipName(s, id)}${isReduced(sh) ? ' (Reduced)' : ''}`; }).join(', ') || '—';
  const h = s.human, ai = s.ai, noLG = hazeActive(s);
  // First-Round odds exactly as the line of battle will compute them: same defenders, Missed Signal and Haze
  const ms = missedSignalShip(s);
  const notMs = id => id !== ms;
  const hFull = encIds(s, h).filter(id => isFull(s.ships[id]));
  const odds = (att, attIds, defIds) => { const a = sideStrength(s, attIds, att, noLG), d = sideStrength(s, defIds, att, noLG); return `${fmt(a)} vs ${fmt(d)} = ${d ? fmt(a / d) : '∞'}:1 (${CRT_COLS[crtColumnForRatio(d ? a / d : 99)]})`; };
  // Use the same selected ships as the A.I. decision: it can omit untowed
  // schooners to satisfy its attack threshold. This query spends no dice.
  const aiPlan = aiAttackDecision(s, e.kind === 'breakout' && e.firstAttack && e.wg === ai);
  const roundOdds = (att, ids) => {
    const defenders = defendingIds(s, OTHER[att]);
    return missedRoundPreview(s, ids, defenders) || odds(att, ids.filter(notMs), defenders.filter(notMs));
  };
  if (rainySquallsActive(s)) {
    const preview = (att, ids, tows) => missedRoundPreview(s, ids, defendingIds(s, OTHER[att])) || closeActionPreviewText(s,
      buildColumn(s, ids, tows, att).filter(notMs), buildColumn(s, defendingIds(s, OTHER[att]), {}, OTHER[att]).filter(notMs), att === ai);
    return `${ZONE_NAME[e.zone]} – U.S.: ${side('US')}\nBritish: ${side('BR')}\nRainy Squalls: no Gunnery — straight to Close Action.\n` +
      `If you attack with all full-strength ships: ${preview(h, hFull, defaultTows(s, hFull))}\n` +
      `If the A.I. attacks: ${aiPlan.ships.length ? preview(ai, aiPlan.ships, aiPlan.tows) : 'the A.I. would Pass (attack preconditions not met).'}` +
      `${ms ? `\nMissed Signal: ${shipName(s, ms)} sits out the first Round.` : ''}`;
  }
  return `${ZONE_NAME[e.zone]} – U.S.: ${side('US')}\nBritish: ${side('BR')}\n` +
    `Odds if you attack with all full-strength ships: ${hFull.length ? roundOdds(h, hFull) : 'no full-strength ships'}.\n` +
    `Odds if the A.I. attacks: ${aiPlan.ships.length ? roundOdds(ai, aiPlan.ships) : 'the A.I. would Pass (attack preconditions not met)'}.` +
    `${ms ? `\nBoth are first-Round odds: ${shipName(s, ms)} missed the signal and sits out the first Round.` : ''}${noLG ? ' (Haze: no Long Guns in the first Gunnery Round 1 here.)' : ''}`;
}

function joinEncounter(s, ids, side) {
  const e = s.encounter;
  const target = side === s.human ? e.humanForce : e.aiForce;
  let tf = target && s.forces[target];
  if (!tf || tf.zone !== e.zone) {
    const any = Object.keys(e.ships).find(id => e.side[id] === side && s.ships[id].forceId && s.forces[s.ships[id].forceId]);
    tf = any ? s.forces[s.ships[any].forceId] : newForce(s, side, e.zone, 'Patrol', [], { origin: side === s.ai ? 'targetCard' : 'reaction' });
    if (side === s.human) e.humanForce = tf.id; else e.aiForce = tf.id;
  }
  ids.forEach(id => {
    const sh = s.ships[id];
    sh.port = sh.port || 'home';
    addShipToForce(s, id, tf.id);
    sh.zone = e.zone;
    encAdd(s, id, 'in');
  });
}

function upgradeChecksFor(s, ids) {
  const msgs = [];
  ids.forEach(id => {
    const sh = s.ships[id];
    if (sh.owner === 'BR' && sh.ver === 'A' && !sh.isolated && !s.options.oa1Upgrades) {
      const r = d6(s);
      if (r % 2 === 0) { sh.ver = 'B'; msgs.push(`${def(sh).name}: “B”`); } else msgs.push(`${def(sh).name}: “A”`);
    }
  });
  if (msgs.length) log(s, `Upgrade Checks: ${msgs.join(', ')}.`, 'ai');
}

function intelligenceApplies(s, side) {
  const it = s.intelligence[side];
  if (!it || s.turn !== it.until) return false;
  return flagshipInEncounter(s, OTHER[side]);
}
// 11.2.3 Reaction DRM: distance (+1 same zone, −1 per zone away) plus wind. Intelligence cancels the
// negative distance DRM, keeps positive ones and adds +1 (Event cards 29/31).
function reactionDRM(dist, wind, intel) {
  let d = dist === 0 ? 1 : -dist;
  if (intel) d = Math.max(0, d);
  let w = wind; if (intel) w = Math.max(0, w);
  return d + w + (intel ? 1 : 0);
}

function humanReactionCandidates(s) {
  const e = s.encounter, h = s.human, z = e.zone;
  const zEv = s.zones[z].event ? EVENTS[s.zones[z].event] : null;
  const wind = zEv && (zEv.lake === 'fairWindHuman' || zEv.lake === 'adverseWind') ? 2 : 0;
  const intel = intelligenceApplies(s, h);
  const out = [];
  const mk = (key, label, ships, dist) => {
    const drm = reactionDRM(dist, wind, intel);
    out.push({ key, label, ships, drm });
  };
  if (!isBlockaded(s, h)) {
    const home = deployable(s, h, 'home').filter(isFull).map(sh => sh.id);
    if (home.length) mk('home', `${HOMEPORT_NAME[h]} (Deployable)`, home, zoneDistance(homeZone(h), z) + 1);
  }
  const temp = deployable(s, h, 'temp').filter(isFull).map(sh => sh.id);
  if (temp.length) mk('temp', `${TEMP_HOMEPORT_NAME[h]} (Isolated, Deployable)`, temp, zoneDistance(TEMP_HOMEPORT_ZONE[h], z) + 1);
  Object.values(s.forces).filter(fr => fr.side === h && fr.mission === 'Patrol' && fr.ships.length && zoneDistance(fr.zone, z) <= 1).forEach(fr => {
    if (fr.ships.some(id => belongsToEncounter(e, id))) return;
    if (s.pe.some(p => p.forceId === fr.id && p.status === 'possible')) return;
    const ships = fr.ships.filter(id => isFull(s.ships[id]));
    if (ships.length) mk(fr.id, `${forceLabel(s, fr)} in ${ZONE_NAME[fr.zone]}`, ships, zoneDistance(fr.zone, z));
  });
  return out;
}

/* Lake Zone Events --------------------------------------------------------------- */
function applyLakeEvent(s, ev, z) {
  const e = s.encounter, k = ev.lake, side = ev.lakeSide;
  const zf = s.zones[z].flags;
  const out = { text: '' };
  switch (k) {
    case 'constructionDelay': changeCD(s, side, 1, `Event #${ev.id}`); out.text = `${SIDE_SHORT[side]} Construction Delay is now ${s.cd[side]}.`; break;
    case 'extraMen': changeCD(s, side, -1, `Event #${ev.id}`); out.text = `${SIDE_SHORT[side]} Construction Delay is now ${s.cd[side]}.`; break;
    case 'convoyDelay': {
      const c = s.convoys[side][s.turn];
      if (c && c.real) { c.delay = true; c.eventDelay = true; out.text = `The ${SIDE_SHORT[side]} Convoy running this turn receives a Convoy Delay marker.`; }
      else out.text = `No ${SIDE_SHORT[side]} Convoy is running this turn – no effect.`;
      if (c && !c.real && side === s.ai && !c.revealed) { c.revealed = true; }
      break;
    }
    case 'sickness': zf.sickness = side; changeCD(s, side, 1, `Sickness Event #${ev.id}`); out.text = `${SIDE_SHORT[side]} ships in ${ZONE_NAME[z]} have −1 Close Action this turn${side === 'US' ? ' (−2 Gen. Pike)' : ''}.`; break;
    case 'minorDamage': zf.minorDamage = side; zf.minorDamageUsed = false; break;
    case 'haze': zf.haze = true; break;
    case 'rainySqualls': zf.rainy = true; break;
    case 'commandingBreeze': zf.breeze = true; break;
    case 'missedSignal': {
      const multi = forcesInZone(s, z, side).filter(fr => fr.ships.length > 1);
      const cand = multi.reduce((a, fr) => a.concat(fr.ships), []);
      if (cand.length) { const id = pick(s, cand); zf.missedSignal = id; out.text = `${shipName(s, id)} will miss the first Lake Combat Round her Force fights.`; }
      else out.text = 'No multi-ship Force – no effect.';
      break;
    }
    case 'separated': case 'separatedBoth': {
      // A Breakout can include several separate blockading Forces. The card
      // splits half of one Force and never combines ships from different Forces.
      const eligible = forcesInZone(s, z, side).filter(fr => fr.ships.filter(id => e.ships[id] === 'in').length > 1);
      if (eligible.length) {
        const fr = eligible.length === 1 ? eligible[0] : pick(s, eligible);
        const ids = fr.ships.filter(id => e.ships[id] === 'in');
        const moved = shuffle(s, ids).slice(0, Math.floor(ids.length / 2));
        const to = (k === 'separatedBoth' || side === 'US') ? clockwiseOf(z) : counterClockwiseOf(z);
        const nf = newForce(s, side, to, 'Patrol', [], { origin: side === s.ai ? 'targetCard' : 'displaced' });
        moved.forEach(id => { addShipToForce(s, id, nf.id); e.ships[id] = 'out'; });
        if (k === 'separatedBoth') {
          if (fr.mission !== 'Patrol') abortCoastalMission(s, fr);
          fr.mission = 'Patrol';
        }
        const selected = eligible.length > 1 ? `Randomly selected Force: ${ids.map(id => shipName(s, id)).join(', ')}. ` : '';
        out.text = selected + `${moved.map(id => shipName(s, id)).join(', ')} ${moved.length === 1 ? 'is' : 'are'} displaced to ${ZONE_NAME[to]} as a new Patrol Force.`;
        log(s, out.text, 'event');
        // PE markers on a displaced Force stay in the original zone (11.1.3) – ours are attached to the original Force.
      } else out.text = 'No participating Force has more than one ship – no effect.';
      break;
    }
    case 'gale': out.gale = true; out.text = resolveGale(s, z); break;
    default: break;
  }
  return out;
}

function resolveGale(s, z) {
  const e = s.encounter;
  const to = clockwiseOf(z);
  const lines = [`Gale! The opposing Forces displace to ${ZONE_NAME[to]}.`];
  Object.keys(e.ships).forEach(id => {
    if (e.ships[id] !== 'in') return;
    const sh = s.ships[id], d = def(sh);
    const mod = (isCLS(sh) ? -1 : 0) + (d.type === 'Brig' || d.type === 'Corvette' ? 1 : 0);
    const r = d6(s), t = r + mod;
    if (t <= 1) { lines.push(`${shipName(s, id)}: ${r}${mod ? '(' + (mod > 0 ? '+' : '') + mod + ')' : ''} – SUNK`); sinkShip(s, id, null, 'Gale', 'killed'); e.ships[id] = 'out'; return; }
    if (t === 2) {
      let coast = COAST_OWNER[to];
      if (to === 'NIA') { const r2 = d6(s); coast = r2 % 2 ? OTHER[sh.owner] : sh.owner; }
      removeShipFromForce(s, id);
      if (coast === sh.owner) { sh.steps = def(sh).full[4] - 1; sh.box = 'transit'; sh.zone = null; lines.push(`${shipName(s, id)}: Beached on a friendly coast – Reduced, to In Transit`); }
      else {
        sh.steps = Math.max(0, def(sh).full[4] - 1);
        captureShip(s, id, OTHER[sh.owner], 'Beached (Gale)', true, 'captured');
        lines.push(`${def(sh).name}: Beached on an enemy coast – Captured`);
      }
      e.ships[id] = 'out';
      return;
    }
    removeShipFromForce(s, id); sh.box = 'transit'; sh.zone = null; e.ships[id] = 'out';
    lines.push(`${shipName(s, id)}: ${r} – rides out the gale (to In Transit, Deployable next turn)`);
  });
  lines.forEach(l => log(s, l, 'event'));
  return lines.join('\n');
}

/* Ship fates --------------------------------------------------------------------- */
function sinkShip(s, id, bySide, why, leaderFate) {
  const sh = s.ships[id];
  removeShipFromForce(s, id);
  sh.box = 'sunk'; sh.zone = null;
  s.lossesThisTurn.push({ id, owner: sh.owner, how: 'sunk', by: bySide, why });
  if (s.flagship[sh.owner] === id) flagshipLost(s, sh.owner, leaderFate || null);
}
function captureShip(s, id, bySide, why, noVP, leaderFate) {
  const sh = s.ships[id];
  const owner = sh.owner;
  removeShipFromForce(s, id);
  s.lossesThisTurn.push({ id, owner, how: 'captured', by: noVP ? null : bySide, why });
  sh.owner = bySide; sh.box = 'transit'; sh.zone = null; sh.port = 'home'; sh.isolated = false;
  if (s.flagship[owner] === id) flagshipLost(s, owner, leaderFate || null);
  if (sh.steps >= def(sh).full[4]) sh.steps = def(sh).full[4] - 1;
  sh.steps = Math.max(0, sh.steps);
  sh.flags.reflagged = true;
}
// The Flagship is gone. leaderFate: 'killed' | 'captured' | null (leader shifts his flag)
function flagshipLost(s, side, leaderFate) {
  const L = s.leader[side];
  if (leaderFate === 'captured' || leaderFate === 'killed') leaderCasualty(s, side, leaderFate);
  const cand = sideShips(s, side).filter(sh => (sh.box === 'deployable' || sh.box === 'lake') && sh.id !== s.flagship[side]).sort((a, b) => (isFull(b) - isFull(a)) || vpCapture(b) - vpCapture(a));
  if (cand.length) { s.flagship[side] = cand[0].id; log(s, `${SIDE_SHORT[side]} flag shifts to ${shipName(s, cand[0].id)}.`, 'info'); }
}
function leaderCasualty(s, side, how) {
  const L = s.leader[side];
  const before = leaderName(s, side);
  if (how === 'wounded') { L.wounded = true; log(s, `${before} is WOUNDED (no Command DRM; returns next turn).`, 'combat'); return; }
  if (side === 'BR') L.seq = 1; else L.seq = Math.min(2, L.seq + 1);
  L.wounded = false;
  log(s, `${before} is ${how.toUpperCase()}! Command passes to ${leaderName(s, side)}.`, 'combat');
}
function abortCoastalMission(s, fr) {
  if (!fr) return;
  if (fr.troops) {
    // Unlaunched: they go back at F7 (both sides), so they cannot embark again this turn [LC5 W; F7]
    s.troopsReturning = s.troopsReturning || { US: 0, BR: 0 };
    s.troopsReturning[fr.side] = (s.troopsReturning[fr.side] || 0) + fr.troops;
    log(s, `${SIDE_SHORT[fr.side]} Coastal mission aborted – ${fr.troops} Troops marker(s) cannot land this turn and return at F7.`, 'info');
    fr.troops = 0;
  }
  fr.aborted = true;
}

/* Encounter end: Struck Colors fates, Disengaged ships return ---------------------- */
function resolveEncounterEnd(s) {
  const e = s.encounter, lines = [];
  if (!e) return lines;
  endEncounterEffects(s);
  settleStruck(s, lines);
  Object.keys(e.ships).forEach(id => { if (e.ships[id] === 'dis') e.ships[id] = 'in'; });
  // mark forces as having had their Encounter
  Object.keys(e.ships).filter(id => belongsToEncounter(e, id)).forEach(id => {
    const fr = s.forces[s.ships[id].forceId];
    if (fr) fr.ended = true;
  });
  lines.forEach(l => log(s, l, 'combat'));
  return lines;
}
// Capture or Rescue of every ship that Struck Colors in the Encounter that is ending [LC5.3].
// pursued: the side whose DW withdrawal Pursuit cancelled – it counts as having withdrawn (project ruling).
// atBoundary: settle from the sides' status at the Pursuit boundary (an older save repaired later), where only
// the pursued side had withdrawn – later casualties in the new Encounter must not change the result.
function settleStruck(s, lines, pursued, only, atBoundary) {
  const e = s.encounter;
  const gone = side => !encIds(s, side, ['in', 'dis']).length;
  const out = atBoundary ? (side => side === pursued) : (side => gone(side) || e.withdrawn[side] || side === pursued);
  const struck = Object.keys(e.ships).filter(id => e.ships[id] === 'struck' && (!only || only.indexOf(id) >= 0));
  struck.forEach(id => {
    const own = e.side[id], other = OTHER[own];
    let fate;
    if (out(own) && !out(other)) fate = 'captured';
    else if (out(other) && !out(own)) fate = 'rescued';
    else { const r = d6(s); fate = r <= 3 ? 'captured' : 'rescued'; lines.push(`${shipName(s, id)} Struck Colors – 1d6 ${r}`); }
    if (fate === 'captured') {
      captureShip(s, id, other, 'Struck Colors', false, (e.leaderFate || {})[id] || null);
      lines.push(`${def(s.ships[id]).name} is CAPTURED by the ${SIDE_PL[other]}.`);
    } else {
      lines.push(`${shipName(s, id)} is rescued and returns home (Reduced).`);
      const sh = s.ships[id];
      removeShipFromForce(s, id); sh.box = 'transit'; sh.zone = null;
    }
    e.ships[id] = 'done';
  });
}
