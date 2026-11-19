/* ============================================================================
   Lake Combat (LC1-LC8): Force Assembly, Tactics, Gunnery Rounds, Weather Gage
   rechecks, Close Action / Melee, hits, Disengagement & Strike Checks, Leaders.
   ========================================================================== */
const SEQ_STEPS = { A: ['GR1', 'WG', 'GR2', 'WG', 'CA', 'END'], B: ['GR1', 'GR2', 'WG', 'CA', 'END'] };

function cmb(s) { return s.combat; }
function zoneFlags(s) { return s.zones[s.encounter.zone].flags; }
function combatVals(s, sh) {
  if (sh.steps <= 0) return [0, 0, 0, 0];
  const v = curVals(sh).slice();
  const zf = s.encounter ? zoneFlags(s) : {};
  if (zf.sickness && zf.sickness === sh.owner) v[2] = Math.max(0, v[2] - (sh.id === 'pike' ? 2 : 1));
  return v;
}
function shipGunneryStrength(s, sh, attSide, noLG) {
  const v = combatVals(s, sh);
  const L = noLG ? 0 : v[0];
  return attSide === 'BR' ? L / 2 + v[1] + v[3] : L + v[1] / 2 + v[3];
}
function sideStrength(s, ids, attSide, noLG) { return sumBy(ids.map(id => s.ships[id]), sh => shipGunneryStrength(s, sh, attSide, noLG)); }
function fmt(x) { return Math.round(x * 100) / 100; }

/* ---------- AI attack decision (LC1) ------------------------------------------------- */
function aiAttackDecision(s, waive) {
  const e = s.encounter, ai = s.ai, h = s.human;
  let cands = encIds(s, ai).filter(id => isFull(s.ships[id]));
  if (ai === 'BR') cands = cands.filter(id => !isCLS(s.ships[id]));
  const defenders = encIds(s, h);
  const plan = aiPlanFor(s, ai, cands, defenders, waive);
  return plan;
}
function aiPlanFor(s, ai, cands, defenders, waive, existingTows) {
  const noLG = hazeActive(s);
  const basis = ai === 'BR' ? 'car' : (s.options.usAiPrecondition === 'carronade' ? 'car' : 'lg');
  const printed = ids => sumBy(ids.map(id => s.ships[id]), sh => (basis === 'car' ? car(sh) : lg(sh)) + dfn(sh));
  // Missed Signal removes a ship from the first Round's combat strengths, not
  // from LC1's separate comparison of the Forces' printed weapon + Defense.
  const missed = missedSignalShip(s);
  const participating = ids => ids.filter(id => id !== missed);
  const odds = ids => { const d = sideStrength(s, participating(defenders), ai, noLG); const a = sideStrength(s, participating(ids), ai, noLG); return d <= 0 ? Infinity : a / d; };
  const showOdds = n => n === Infinity ? '∞' : fmt(n);
  const out = { ships: [], tows: {}, why: '' };
  if (!cands.length) { out.why = 'no full-strength ships able to attack'; return out; }
  if (!participating(cands).length) { out.why = 'Missed Signal leaves no ships able to attack this Round'; return out; }
  if (!defenders.length) { out.why = 'no defenders'; return out; }
  let tows = {};
  if (ai === 'US') {
    const active = participating(cands);
    if (existingTows) {
      // LC6 advances the existing column. Retain its surviving tow pairs;
      // silently reassigning a schooner would violate LC2's adjacent placement.
      Object.keys(existingTows).forEach(t => {
        const ship = existingTows[t];
        if (active.indexOf(t) >= 0 && active.indexOf(ship) >= 0 && canTow(s.ships[t])) tows[t] = ship;
      });
    } else {
      const towers = active.filter(id => canTow(s.ships[id]) && !isCLS(s.ships[id]));
      const cls = active.filter(id => isCLS(s.ships[id])).sort((a, b) => lg(s.ships[b]) - lg(s.ships[a]));
      towers.forEach((t, i) => { if (cls[i]) tows[t] = cls[i]; });
    }
  }
  const towed = Object.values(tows);
  const tryCfg = ids => {
    const active = participating(ids);
    const untowed = active.filter(id => isCLS(s.ships[id]) && towed.indexOf(id) < 0);
    const allCLS = active.every(id => isCLS(s.ships[id]));
    const thr = ai === 'US' ? (allCLS ? 2 : untowed.length ? 1.5 : 1) : 1;
    const o = odds(ids), pa = printed(ids), pd = printed(defenders);
    return { ok: waive || (o >= thr && pa > pd), o, thr, pa, pd };
  };
  const label = basis === 'car' ? 'Carronade + Defense' : 'Long Gun + Defense';
  let r = tryCfg(cands);
  if (r.ok) { out.ships = cands; out.tows = tows; out.why = `A.I. preconditions ${waive ? 'waived for this attack' : 'met'}: ${label} ${r.pa} vs ${r.pd}; odds ${showOdds(r.o)}:1 (${waive ? 'normally needs' : 'needs'} ${r.thr}:1).`; return out; }
  if (ai === 'US') {
    const reduced = cands.filter(id => id === missed || !isCLS(s.ships[id]) || towed.indexOf(id) >= 0);
    if (reduced.length && reduced.length < cands.length) {
      const r2 = tryCfg(reduced);
      if (r2.ok) { out.ships = reduced; out.tows = tows; out.why = `A.I. attacks without its untowed Laker Schooners: ${label} ${r2.pa} vs ${r2.pd}; odds ${showOdds(r2.o)}:1.`; return out; }
    }
  }
  out.why = `A.I. preconditions not met: ${label} ${r.pa} vs ${r.pd} (${r.pa > r.pd ? 'passes' : 'fails: must be greater'}); odds ${showOdds(r.o)}:1 (${r.o >= r.thr ? 'passes' : 'fails'}: needs ${r.thr}:1).`;
  return out;
}
function hazeActive(s) { const zf = s.encounter ? zoneFlags(s) : {}; return !!(zf.haze && !zf.hazeUsed); }

/* ---------- default line of battle ---------------------------------------------------- */
function lineOrder(s, ids, side) {
  const fl = s.flagship[side];
  return ids.slice().sort((a, b) => ((b === fl) - (a === fl)) || (vpCapture(s.ships[b]) - vpCapture(s.ships[a])) || (ca(s.ships[b]) - ca(s.ships[a])));
}
function buildColumn(s, ids, tows, side) {
  const towed = Object.values(tows || {});
  const order = lineOrder(s, ids.filter(id => towed.indexOf(id) < 0), side);
  const col = [];
  order.forEach(id => { col.push(id); const t = (tows || {})[id]; if (t && ids.indexOf(t) >= 0) col.push(t); });
  return col;
}
function colShips(c, side) { return (c.col[side] || []).filter(Boolean); }
// LC2 and LC4.2: the schooner must be directly behind its assigned tower in this Round's column.
function towedInRound(c, attackers) {
  const tows = c.tows || {};
  return Object.keys(tows).filter(t => {
    const i = attackers.indexOf(t);
    return i >= 0 && attackers[i + 1] === tows[t];
  }).map(t => tows[t]);
}
// Ships that defend in a Lake Combat (the A.I. British never put Converted Laker Schooners in the line)
function defendingIds(s, side) {
  const ids = encIds(s, side);
  return side === 'BR' && s.ai === 'BR' ? ids.filter(id => !isCLS(s.ships[id])) : ids;
}
// The ship a pending Missed Signal Event keeps out of the next first Round of combat in this zone (or null)
function missedSignalShip(s) {
  if (!s.encounter) return null;
  const zf = s.zones[s.encounter.zone].flags;
  return zf.missedSignal && !zf.missedSignalUsed && s.encounter.ships[zf.missedSignal] === 'in' ? zf.missedSignal : null;
}

/* ---------- Lake Combat procedure ----------------------------------------------------------- */
PROCS.combat = {
  start(s, f) {
    const A = f.A, e = s.encounter;
    const att = A.attacker;
    f.L.nextCombat = { att, def: OTHER[att], seq: att === 'US' ? 'A' : 'B', pos: 0, segment: A.segment, col: { US: [], BR: [] },
      tows: {}, tac: { att: null, def: null }, gr: 0, newSeq: false, plan: A.aiPlan || null, roundAttackers: [], log: [], openGaps: false, rainy: false };
    log(s, `LAKE COMBAT in ${ZONE_NAME[e.zone]} – ${SIDE_PL[att]} attack (Combat Sequence ${f.L.nextCombat.seq}).`, 'combat');
    return G('sequenceTransfer');
  },
  sequenceTransfer(s, f) {
    // A reduced defending Flagship can become the attacker on the next
    // Sequence/Reaction. Offer the transfer before replacing the old column,
    // while LC5.1's adjacent ships are still known.
    const side = f.L.nextCombat.att, opts = flagTransferOptions(s, side);
    if (opts.length && side === s.human) {
      return P(choice('Transfer the flag?', `Before the new Combat Sequence, ${leaderName(s, side)} may leave the Reduced ${shipName(s, s.flagship[side])} for an adjacent full-strength ship. A Leader Casualty Check is required.`,
        [{ id: 'stay', label: 'Stay aboard', primary: true }].concat(opts.map(id => ({ id, label: `Transfer to ${shipName(s, id)}` })))), 'sequenceTransfer2');
    }
    if (opts.length && side === s.ai && commandDRMAvailable(s, side)) {
      const lines = []; tryFlagTransfer(s, side, opts[0], lines); logLines(s, lines);
      return P(info('Flag transfer', lines.join('\n')), 'sequenceBegin');
    }
    return G('sequenceBegin');
  },
  sequenceTransfer2(s, f) {
    if (f.answer !== 'stay') {
      const lines = []; tryFlagTransfer(s, s.human, f.answer, lines); logLines(s, lines);
      return P(info('Flag transfer', lines.join('\n')), 'sequenceBegin');
    }
    return G('sequenceBegin');
  },
  sequenceBegin(s, f) {
    s.combat = f.L.nextCombat; f.L.nextCombat = null;
    return G('assemble');
  },
  assemble(s, f) {
    const c = cmb(s), e = s.encounter;
    if (c.att === s.human) {
      const cands = encIds(s, c.att).filter(id => isFull(s.ships[id]));
      if (!cands.length) return R({ outcome: 'segmentEnd' });
      return P({ kind: 'lineup', title: `Lake Combat – choose your attacking ships`, side: c.att,
        text: `Only full-strength ships may attack. ${c.att === 'US' && !(c.segment === 'patrol' && zoneFlags(s).rainy) ? 'Each ship with a “T” may tow one Converted Laker Schooner (towing avoids the untowed-schooner DRM penalty; untowed schooners in a U.S. attack risk −1/−2 DRM).' : ''}\nDefending: ${defendingIds(s, c.def).map(id => shipName(s, id)).join(', ')}.`,
        candidates: cands, defenders: defendingIds(s, c.def), defaultTows: defaultTows(s, cands) }, 'assemble2');
    }
    return G('assemble2');
  },
  assemble2(s, f) {
    const c = cmb(s), e = s.encounter, zf = zoneFlags(s);
    let attIds, tows;
    if (c.att === s.human) { attIds = f.answer.attackers; tows = f.answer.tows || {}; }
    else {
      const plan = c.plan || aiAttackDecision(s, false);
      attIds = plan.ships.filter(id => e.ships[id] === 'in'); tows = plan.tows || {};
    }
    c.tows = tows;
    c.col[c.att] = buildColumn(s, attIds, tows, c.att);
    c.col[c.def] = buildColumn(s, defendingIds(s, c.def), {}, c.def);
    // Missed Signal: the ship sits out the first Round her Force fights
    c.sitting = null;
    const ms = missedSignalShip(s);
    if (ms) {
      ['US', 'BR'].forEach(sd => { if (c.col[sd].indexOf(ms) >= 0) { c.sitting = { id: ms, side: sd }; c.col[sd] = c.col[sd].filter(x => x !== ms); } });
      // The Event is spent at the first Round the ship was otherwise eligible
      // to join, even if the human elected to leave it out of the attack.
      const sh = s.ships[ms], eligible = sh.owner === c.def ? defendingIds(s, c.def).indexOf(ms) >= 0 :
        isFull(sh) && !(sh.owner === 'BR' && s.ai === 'BR' && isCLS(sh));
      if (eligible) {
        zf.missedSignalUsed = true;
        log(s, c.sitting ? `Missed Signal: ${shipName(s, ms)} sits out this Round.` :
          `Missed Signal is used: ${shipName(s, ms)} was eligible for this Round but was left out of the attack.`, 'event');
      }
    }
    log(s, `Line of battle – ${SIDE_SHORT[c.att]} (attacking): ${c.col[c.att].map((id, i) => (i + 1) + '.' + shipName(s, id)).join(' ')}${Object.keys(tows).length ? ' [towing: ' + Object.keys(tows).map(t => def(s.ships[t]).name + '→' + def(s.ships[tows[t]]).name).join(', ') + ']' : ''}; ${SIDE_SHORT[c.def]} (defending): ${c.col[c.def].map((id, i) => (i + 1) + '.' + shipName(s, id)).join(' ')}.`, 'combat');
    if (!c.col[c.att].length && !(c.sitting && c.sitting.side === c.att)) return R({ outcome: 'segmentEnd' });
    if (c.segment === 'patrol' && zf.rainy) {
      c.rainy = true;
      c.pos = SEQ_STEPS[c.seq].indexOf('CA');
      log(s, 'Rainy Squalls: skip directly to the Close Action Round.', 'event');
      return G('next');
    }
    return G('tactics');
  },

  /* LC3 Tactics ------------------------------------------------------------------------- */
  tactics(s, f) {
    const c = cmb(s), h = s.human;
    const hDeck = c.att === h ? 'A' : 'D';
    const drawn = drawTactics(s, hDeck, 4);
    const valid = drawn.filter(id => tacticValid(s, id, h));
    f.L.hDrawn = drawn; f.L.hDeck = hDeck;
    if (!valid.length) { f.answer = null; log(s, `Your Tactics draw: ${drawn.map(id => TACTIC_BY_ID[id].name).join(', ')} – none valid.`, 'combat'); return G('tactics2'); }
    return P({ kind: 'choice', title: `LC3 Tactics – you are the ${c.att === h ? 'Attacker' : 'Defender'}`,
      text: `You drew: ${drawn.map(id => TACTIC_BY_ID[id].name).join(', ')}.\nInvalid (dummy / other side / matches a symbol on the Weather Gage card ${wgSymbolsText(s)}) are discarded. Select one valid Tactic to play.`,
      options: valid.map(id => ({ id, label: TACTIC_BY_ID[id].name, desc: TACTIC_BY_ID[id].text, color: TACTIC_BY_ID[id].color })), tactic: true }, 'tactics2');
  },
  tactics2(s, f) {
    const c = cmb(s), h = s.human, ai = s.ai;
    const hPick = f.answer || null;
    returnTactics(s, f.L.hDeck, f.L.hDrawn.filter(id => id !== hPick));
    const aDeck = c.att === ai ? 'A' : 'D';
    const aDrawn = drawTactics(s, aDeck, 5);
    const aValid = aDrawn.filter(id => tacticValid(s, id, ai));
    const aPick = aValid.length ? pick(s, aValid) : null;
    returnTactics(s, aDeck, aDrawn.filter(id => id !== aPick));
    const attPick = c.att === h ? hPick : aPick, defPick = c.att === h ? aPick : hPick;
    c.tac.att = attPick ? { id: attPick, used: false, negated: false } : null;
    c.tac.def = defPick ? { id: defPick, used: false, negated: false } : null;
    const lines = [];
    if (c.tac.att && c.tac.def) {
      const ta = TACTIC_BY_ID[c.tac.att.id], td = TACTIC_BY_ID[c.tac.def.id];
      if (ta.color && ta.color === td.color) { c.tac.att.negated = c.tac.def.negated = true; lines.push(`Matching color bars (${ta.color}) – both Tactics negate each other.`); }
      if (td.id === 'D_repel' && ta.id === 'A_grapple') { c.tac.att.negated = true; lines.push('Repel negates Grapple.'); }
      if (td.id === 'D_mutual' && (ta.id === 'A_rake' || ta.id === 'A_outmaneuver')) { c.tac.att.negated = true; lines.push(`Mutual Support negates ${ta.name}.`); }
    }
    const desc = (t, who) => t ? `${who}: ${TACTIC_BY_ID[t.id].name}${t.negated ? ' (negated)' : ''}` : `${who}: none`;
    lines.unshift(`A.I. drew ${aDrawn.map(id => TACTIC_BY_ID[id].name).join(', ')} → plays ${aPick ? TACTIC_BY_ID[aPick].name : 'nothing'}.`);
    lines.push(desc(c.tac.att, 'Attacker'), desc(c.tac.def, 'Defender'));
    lines.forEach(l => log(s, l, 'combat'));
    s.tacPlayed = (s.tacPlayed || []).concat([attPick, defPick].filter(Boolean));
    return P(info('Tactics', lines.join('\n'), { tacticsShown: [attPick, defPick].filter(Boolean) }), 'next');
  },

  /* Sequence dispatcher ------------------------------------------------------------------- */
  next(s, f) {
    const c = cmb(s);
    const st = SEQ_STEPS[c.seq][c.pos];
    s.stepLabel = `Lake Combat – Sequence ${c.seq}: ${({ GR1: 'Gunnery Round 1', GR2: 'Gunnery Round 2', WG: 'Weather Gage recheck', CA: 'Close Action Round', END: 'Segment ends' })[st]}`;
    // The missing ship is still in the Encounter. If it was the only ship on
    // that side of the first Round, there is no combat to resolve this Round.
    if (c.sitting && !colShips(c, c.sitting.side).length && colShips(c, OTHER[c.sitting.side]).length &&
        (st === 'GR1' || (st === 'CA' && c.rainy))) {
      if (st === 'GR1') c.gr++;
      const text = `${shipName(s, c.sitting.id)} sits out the only matchup on this side. No combat is rolled this Round. The ship rejoins the column when the Round ends.`;
      log(s, 'Missed Signal: ' + text, 'event');
      return P(info('Missed Signal – no combat this Round', text, { combatView: true }), 'finishRound');
    }
    if (!colShips(c, c.def).length || !encIds(s, c.def).length) return R({ outcome: 'encounterEnd' });
    if (!encIds(s, c.att).length) return R({ outcome: 'encounterEnd' });
    if (st === 'GR1' || st === 'GR2') return G('gr');
    if (st === 'WG') return G('wg');
    if (st === 'CA') return G('ca');
    return R({ outcome: 'segmentEnd' });
  },

  /* LC4 Gunnery Round --------------------------------------------------------------------- */
  gr(s, f) {
    const c = cmb(s);
    const st = SEQ_STEPS[c.seq][c.pos];
    f.L.st = st;
    f.L.roundPlan = null;
    const attackers = colShips(c, c.att).filter(id => isFull(s.ships[id]) && s.encounter.ships[id] === 'in');
    if (!attackers.length) { log(s, `${SIDE_SHORT[c.att]} has no full-strength ships left to attack – the Segment ends.`, 'combat'); return R({ outcome: 'segmentEnd' }); }
    const needDecision = st === 'GR2' || c.newSeq;
    c.newSeq = false;
    if (needDecision) {
      if (c.att === s.ai) {
        const plan = aiPlanFor(s, s.ai, attackers.filter(id => !(s.ai === 'BR' && isCLS(s.ships[id]))), colShips(c, c.def), false, c.tows);
        if (!plan.ships.length) { log(s, `A.I. passes: ${plan.why}`, 'ai'); s.encounter.lastEnd = 'pass'; return P(info('The A.I. breaks off', `${plan.why}\nThe current Segment ends.`), '__segEnd'); }
        // The plan may omit untowed schooners to meet LC1's lower 1:1 threshold.
        // Keep those ships Engaged, but do not fire or distribute return hits to
        // them in this Round. A later Weather Gage switch can use them to defend.
        f.L.roundPlan = plan;
      } else {
        return P(choice(`${st === 'GR2' ? 'Gunnery Round 2' : 'New Combat Sequence'} – attack or pass?`, `${combatSummary(s)}\nYou hold the Weather Gage. Attack again, or Pass (the current Segment ends)?`,
          [{ id: 'attack', label: 'Attack', primary: true }, { id: 'pass', label: 'Pass' }], { combatPreview: true }), 'grDecide');
      }
    }
    return G('grOut');
  },
  __segEnd(s, f) { return R({ outcome: 'segmentEnd' }); },
  grDecide(s, f) {
    if (f.answer === 'pass') { log(s, 'You Pass – the Segment ends.', 'player'); s.encounter.lastEnd = 'pass'; return R({ outcome: 'segmentEnd' }); }
    return G('grOut');
  },
  grOut(s, f) {
    // Attacker Outmaneuver in Gunnery Round 2: pick a separated Defender subgroup
    const c = cmb(s);
    if (f.L.st === 'GR2' && tacActive(c, 'att', 'A_outmaneuver')) {
      const groups = subgroups(c.col[c.def]);
      if (groups.length > 1) {
        if (c.att === s.human) {
          return P(choice('Outmaneuver – choose the Defender subgroup', `Your Outmaneuver Tactic lets you fire your full strength at one subgroup:`,
            groups.map((g, i) => ({ id: 'g' + i, label: g.map(id => shipName(s, id)).join(', ') }))), 'grOut2');
        }
        // AI: subgroup giving the best odds, then most VP
        let best = 0, bestScore = -1;
        groups.forEach((g, i) => { const sc = 1000 / Math.max(0.1, sideStrength(s, g, c.att)) + sumBy(g.map(id => s.ships[id]), vpCapture) / 1000; if (sc > bestScore) { bestScore = sc; best = i; } });
        f.answer = 'g' + best;
        return G('grOut2');
      }
    }
    f.L.subgroup = null;
    return G('grRoll');
  },
  grOut2(s, f) {
    const c = cmb(s);
    const groups = subgroups(c.col[c.def]);
    f.L.subgroup = groups[+String(f.answer).slice(1)] || null;
    if (f.L.subgroup) log(s, `Outmaneuver: the attack concentrates on ${f.L.subgroup.map(id => shipName(s, id)).join(', ')}.`, 'combat');
    return G('grRoll');
  },
  grRoll(s, f) {
    const c = cmb(s), e = s.encounter, zf = zoneFlags(s), st = f.L.st;
    // A06 applies to one Defender Hit result only. Frame locals survive later rounds
    // and Weather Gage switches, so never carry its target into a new roll.
    delete f.L.rakeTarget;
    delete f.L.rakeRandom;
    c.gr++;
    const isGR1 = st === 'GR1';
    const noLG = isGR1 && hazeActive(s);
    if (noLG) zf.hazeUsed = true;
    let attackers = colShips(c, c.att).filter(id => isFull(s.ships[id]));
    if (f.L.roundPlan) {
      const omitted = attackers.filter(id => f.L.roundPlan.ships.indexOf(id) < 0);
      attackers = attackers.filter(id => f.L.roundPlan.ships.indexOf(id) >= 0);
      c.tows = f.L.roundPlan.tows || {};
      log(s, f.L.roundPlan.why, 'ai');
      if (omitted.length) log(s, `A.I. ships sitting out this Gunnery Round (still Engaged): ${omitted.map(id => shipName(s, id)).join(', ')}. Attacking: ${attackers.map(id => shipName(s, id)).join(', ')}.`, 'ai');
    }
    c.roundAttackers = attackers.slice();
    const defenders = f.L.subgroup || colShips(c, c.def);
    const aStr = sideStrength(s, attackers, c.att, noLG), dStr = sideStrength(s, defenders, c.att, noLG);
    const ratio = dStr <= 0 ? 99 : aStr / dStr;
    let colIdx = crtColumnForRatio(ratio);
    const shifts = [], drms = [];
    if (tacActive(c, 'att', 'A_surprise') && isGR1 && c.segment === 'patrol') { colIdx++; shifts.push('+1 Surprise'); useTac(c, 'att'); }
    colIdx = Math.max(0, Math.min(6, colIdx));
    let drm = 0;
    const fl = s.flagship[c.att];
    if (attackers.indexOf(fl) >= 0 && commandDRMAvailable(s, c.att)) { drm++; drms.push(`+1 Command (${leaderName(s, c.att)})`); }
    if (c.att === 'US' && !tacActive(c, 'att', 'A_sweep')) {
      const towed = towedInRound(c, attackers);
      const untowed = attackers.filter(id => isCLS(s.ships[id]) && towed.indexOf(id) < 0);
      if (untowed.length) {
        const r = d6(s), n = untowed.length;
        const pen = r <= n / 2 ? -2 : r <= n ? -1 : 0;
        if (pen) { drm += pen; }
        drms.push(`${n} untowed Laker Schooner${n === 1 ? '' : 's'}: d6 ${r}, DRM ${pen}`);
      }
    }
    if (tacActive(c, 'att', 'A_rof')) { drm++; drms.push('+1 Rate of Fire'); }
    if (tacActive(c, 'def', 'D_rof')) { drm--; drms.push('−1 Defender Rate of Fire'); }
    const defRake = tacActive(c, 'def', 'D_rake') && !c.tac.def.used;
    if (defRake) { drm--; drms.push('−1 Defender Rake'); }
    const rollOnce = () => { const r = d10(s); const m = Math.max(0, Math.min(9, r + drm)); return { r, m, code: CRT[m][colIdx] }; };
    let roll = rollOnce();
    const rolls = [roll];
    const breakout = e.kind === 'breakout';
    let guard = 0;
    while (breakout && roll.code === 'End' && guard++ < 20) { roll = rollOnce(); rolls.push(roll); }
    let res = parseCrt(roll.code);
    // First Shot re-rolls
    if (tacActive(c, 'att', 'A_firstshot') && !c.tac.att.used && (res.aW || res.aHits > res.dHits)) { useTac(c, 'att'); roll = rollOnce(); rolls.push(roll); res = parseCrt(roll.code); }
    if (tacActive(c, 'def', 'D_firstshot') && !c.tac.def.used && (res.dW || res.dHits > res.aHits)) { useTac(c, 'def'); roll = rollOnce(); rolls.push(roll); res = parseCrt(roll.code); }
    while (breakout && res.end && guard++ < 40) { roll = rollOnce(); rolls.push(roll); res = parseCrt(roll.code); }
    if (tacActive(c, 'att', 'A_firstshot')) useTac(c, 'att');
    if (tacActive(c, 'def', 'D_firstshot')) useTac(c, 'def');
    const notes = [];
    if (tacActive(c, 'att', 'A_sweep')) { if (res.aHits || res.aW) notes.push('Sweep Up & Fire: Attacker hits/withdrawal ignored'); res.aHits = 0; res.aW = false; }
    if (tacActive(c, 'def', 'D_escape') && !c.tac.def.used) { res.dW = true; res.escape = true; useTac(c, 'def'); notes.push('Escape: Defender withdraws; hit Defenders automatically pass Disengagement'); }
    if (defRake) { c.tac.def.used = true; res.defRake = true; }
    const txt = `${st === 'GR1' ? 'Gunnery Round 1' : 'Gunnery Round 2'}: ${SIDE_SHORT[c.att]} ${fmt(aStr)} vs ${SIDE_SHORT[c.def]} ${fmt(dStr)}${noLG ? ' (Haze: no Long Guns)' : ''} = ${dStr <= 0 ? '∞' : fmt(ratio)}:1 → column ${CRT_COLS[colIdx]}${shifts.length ? ' (' + shifts.join(', ') + ')' : ''}. ` +
      `d10 ${rolls.map(x => x.r + (drm ? (drm > 0 ? '+' : '') + drm + '=' + x.m : '') + ' ' + x.code).join(', then ')}${drms.length ? ' [' + drms.join('; ') + ']' : ''} → ${roll.code}${notes.length ? ' (' + notes.join('; ') + ')' : ''}.`;
    log(s, txt, 'roll');
    f.L.res = res; f.L.txt = txt; f.L.defenders = defenders;
    // Attacker Rake: choose the target of ALL defender hits
    if (res.dHits && tacActive(c, 'att', 'A_rake') && !c.tac.att.used) {
      const colD = colShips(c, c.def);
      if (c.att === s.human) {
        // Card A06: the human may determine the random ship first, then choose the best of the three
        f.L.rakeRandom = pick(s, colD);
        return P(choice('Rake – where do the hits go?', `${txt}\nApply ALL ${res.dHits} hit(s) to one ship (the random ship has already been rolled):`,
          [{ id: 'lead', label: `Lead ship: ${shipName(s, colD[0])}` }, { id: 'rear', label: `Rear ship: ${shipName(s, colD[colD.length - 1])}` }, { id: 'random', label: `Random ship: ${shipName(s, f.L.rakeRandom)}` }]), 'grRake');
      }
      const opts = [colD[0], colD[colD.length - 1], pick(s, colD)];
      f.L.rakeTarget = opts.sort((a, b) => vpCapture(s.ships[b]) - vpCapture(s.ships[a]))[0];
      log(s, `A.I. Rake: all hits on ${shipName(s, f.L.rakeTarget)}.`, 'combat');
      spendRake(s, c);
    }
    return G('grApply');
  },
  grRake(s, f) {
    const c = cmb(s), colD = colShips(c, c.def);
    f.L.rakeTarget = f.answer === 'lead' ? colD[0] : f.answer === 'rear' ? colD[colD.length - 1] : (f.L.rakeRandom && colD.indexOf(f.L.rakeRandom) >= 0 ? f.L.rakeRandom : pick(s, colD));
    log(s, `Rake: all hits on ${shipName(s, f.L.rakeTarget)}.`, 'combat');
    spendRake(s, c);
    return G('grApply');
  },
  grApply(s, f) {
    const c = cmb(s), res = f.L.res;
    f.L.closeResult = false;
    const lines = [f.L.txt];
    if (res.end) {
      const ending = res.aW || res.dW ? 'END – the current Segment ends after applying the Tactic withdrawal.' : 'END – the current Segment ends immediately.';
      lines.push(ending); log(s, ending, 'combat'); f.L.outcome = 'segmentEnd';
      // Escape adds DW to the next result, including END. Apply that withdrawal
      // before ending the Segment; the human can still decline a W normally.
      if (!res.aW && !res.dW) return P(info('Gunnery result', lines.join('\n'), { combatView: true }), 'finishRound');
    }
    // distribute hits
    const dMap = {}, aMap = {};
    if (res.dHits) {
      if (f.L.rakeTarget) dMap[f.L.rakeTarget] = res.dHits;
      else distributeHits(s, c.col[c.def], res.dHits, dMap, lines, { openRange: c.def === 'BR' && tacActive(c, 'def', 'D_openrange'), subgroup: f.L.subgroup, side: c.def });
    }
    if (res.aHits) {
      // Only the ships attacking in this Gunnery Round are in the attacker's column for this Round; Reduced ships
      // stay behind in the previous Round zone (LC5 "column of ships for this Gunnery Round"; Playbook p.15).
      const attCol = c.col[c.att].filter(id => id && (c.roundAttackers || []).indexOf(id) >= 0);
      if (res.defRake) distributeHits(s, attCol, res.aHits, aMap, lines, { forceCol: 2, side: c.att });
      else distributeHits(s, attCol, res.aHits, aMap, lines, { side: c.att });
    }
    const ctx = { round: 'GR', escapeSide: res.escape ? c.def : null };
    beginLeaderResult(s);
    const rd = applyHits(s, c.def, dMap, ctx, lines);
    const ra = applyHits(s, c.att, aMap, ctx, lines);
    f.L.failedDis = { [c.def]: rd.stayed, [c.att]: ra.stayed };
    f.L.hit = { [c.def]: Object.keys(dMap), [c.att]: Object.keys(aMap) };
    f.L.lines = lines;
    f.L.wQueue = [];
    if (res.dW) f.L.wQueue.push(c.def);
    if (res.aW) f.L.wQueue.push(c.att);
    return G('withdraw');
  },
  withdraw(s, f) {
    const c = cmb(s);
    const side = f.L.wQueue.shift();
    if (!side) return G('flagTransfer');
    const eligible = withdrawEligible(s, side, f.L.failedDis[side]);
    // Pursuit (card A05): only if the Defender has ships eligible to withdraw after Hits and Disengagement Checks
    if (side === c.def && tacActive(c, 'att', 'A_pursuit') && !c.tac.att.used) {
      if (!eligible.length) { f.L.lines.push('Pursuit: no Defender ship is eligible to withdraw (every one failed Disengagement), so nothing withdraws and the card is not used.'); return G('withdraw'); }
      c.tac.att.used = true;
      f.L.lines.push('Pursuit! The Defender’s withdrawal is cancelled – a new Encounter follows between the same forces.');
      f.L.outcome = 'pursuit';
      return G('withdraw');
    }
    if (side === s.human) {
      if (!eligible.length) return G('withdraw');
      return P(choice('Withdrawal result against you', `${f.L.lines.join('\n')}\n\nThe result lets your Force Withdraw (optional for the human player). Withdraw to your Homeport's In Transit area (Coastal missions abort), or ignore the W and fight on at your own risk?`,
        [{ id: 'withdraw', label: 'Withdraw', primary: true }, { id: 'stay', label: 'Ignore – fight on' }], { combatView: true }), 'withdraw2');
    }
    f.answer = 'withdraw';
    f.L.wSide = side;
    return G('withdraw3');
  },
  withdraw2(s, f) {
    const c = cmb(s);
    if (f.answer === 'stay') { f.L.lines.push('You ignore the Withdrawal result.'); return G('withdraw'); }
    f.L.wSide = s.human;
    return G('withdraw3');
  },
  withdraw3(s, f) {
    const side = f.L.wSide;
    const lines = doWithdrawal(s, side, f.L.failedDis[side] || [], (f.L.hit || {})[side] || []);
    f.L.lines = f.L.lines.concat(lines);
    return G('withdraw');
  },
  flagTransfer(s, f) {
    const h = s.human;
    // Human: optional flag transfer when the Flagship is Reduced
    const opt = flagTransferOptions(s, h);
    if (opt.length) {
      return P(flagTransferPrompt(s, opt, f.L.lines), 'flagTransfer2');
    }
    return G('aiFlagTransfer');
  },
  flagTransfer2(s, f) {
    if (f.answer !== 'stay') tryFlagTransfer(s, s.human, f.answer, f.L.lines);
    return G('aiFlagTransfer');
  },
  aiFlagTransfer(s, f) {
    // Both sides may transfer in one Round, even when the human chose to stay.
    transferAiFlagIfBeneficial(s, f.L.lines);
    return G('roundResults');
  },
  roundResults(s, f) {
    endLeaderResult(s);
    const lines = f.L.closeResult ? f.L.lines : f.L.lines.slice(1);
    lines.forEach(l => log(s, l, l === 'You ignore the Withdrawal result.' ? 'player' : 'combat'));
    return P(info(f.L.closeResult ? 'Close Action Round' : 'Gunnery Round results', f.L.lines.join('\n'), { combatView: true }), f.L.closeResult ? 'caDone' : 'finishRound');
  },
  finishRound(s, f) {
    const c = cmb(s), e = s.encounter;
    tidyColumns(s);
    if (c.sitting) { const sd = c.sitting.side; if (e.ships[c.sitting.id] === 'in') c.col[sd].push(c.sitting.id); c.sitting = null; }
    const oc = f.L.outcome; f.L.outcome = null;
    if (oc === 'pursuit') return R({ outcome: 'pursuit', pursued: c.def });
    if (oc === 'segmentEnd') return R({ outcome: 'segmentEnd' });
    if (!encIds(s, 'US').length || !encIds(s, 'BR').length) return R({ outcome: 'encounterEnd' });
    if (!colShips(c, c.def).length) return R({ outcome: 'encounterEnd' });
    if (c.rainy) return R({ outcome: 'segmentEnd' });
    c.pos++;
    return G('next');
  },

  /* Weather Gage recheck ----------------------------------------------------------------- */
  wg(s, f, enteredEvent) {
    const c = cmb(s), e = s.encounter, zf = zoneFlags(s);
    const prevStep = SEQ_STEPS[c.seq][c.pos - 1];
    if (prevStep === 'GR1' && tacActive(c, 'att', 'A_sweep')) { log(s, 'Sweep Up & Fire: skip the Weather Gage recheck.', 'combat'); c.pos++; return G('next'); }
    if (prevStep === 'GR2' && c.att === 'BR' && tacActive(c, 'att', 'A_grapple')) { log(s, 'Grapple: skip the Weather Gage recheck and go to Close Action.', 'combat'); c.pos++; c.grapple = true; return G('next'); }
    if (prevStep === 'GR2' && c.att === 'BR' && c.segment === 'patrol' && zf.breeze && !tacActive(c, 'att', 'A_sweep')) { log(s, 'Commanding Breeze: skip the Weather Gage recheck and go to Close Action.', 'event'); c.pos++; return G('next'); }
    // D06 overrides the winner of the check. LC6 still draws the Event whose
    // symbols govern Tactics if a new Combat Sequence begins.
    if (s.options.physicalEvents && !enteredEvent) return C('eventDraw', { purpose: 'Weather Gage recheck', allowGale: false }, 'wgEvent');
    const ev = enteredEvent || drawEvent(s, 'Weather Gage recheck', false);
    e.wgCard = ev.id;
    let newWG = ev.wg === 'A' ? 'US' : 'BR';
    let txt = `Weather Gage recheck: Event #${ev.id} → ${SIDE_NAME[newWG]}.`;
    if (tacActive(c, 'def', 'D_outmaneuver') && !c.tac.def.used) {
      c.tac.def.used = true; newWG = c.def;
      txt = `Weather Gage recheck: Event #${ev.id}. Defender Outmaneuver gives the Weather Gage to the ${SIDE_PL[newWG]}.`;
    }
    log(s, txt, 'event');
    e.wg = newWG;
    if (newWG === c.att) { c.pos++; return P(info('Weather Gage recheck', txt + `\nThe ${SIDE_PL[c.att]} keep the Weather Gage – continue Combat Sequence ${c.seq}.`, { eventCard: ev.id, combatView: true }), 'next'); }
    // Weather Gage changes: start the other Combat Sequence
    const newAtt = newWG;
    f.L.newAtt = newAtt;
    return P(info('Weather Gage changes!', txt + `\nCombat Sequence ${newAtt === 'US' ? 'A' : 'B'} begins.`, { eventCard: ev.id, combatView: true }), 'wgSwitch');
  },
  wgEvent(s, f) { return PROCS.combat.wg(s, f, EVENTS[f.ret]); },
  wgSwitch(s, f) {
    const newAtt = f.L.newAtt, e = s.encounter;
    if (newAtt === s.ai) {
      const dec = aiAttackDecision(s, false);
      if (!dec.ships.length) { log(s, `A.I. passes: ${dec.why}`, 'ai'); e.lastEnd = 'pass'; return P(info('The A.I. does not attack', dec.why + '\nThe current Segment ends.'), '__segEnd'); }
      f.L.nextCombat = { att: newAtt, def: OTHER[newAtt], seq: newAtt === 'US' ? 'A' : 'B', pos: 0, segment: s.combat.segment, col: { US: [], BR: [] }, tows: {}, tac: { att: null, def: null }, gr: 0, newSeq: false, plan: dec, roundAttackers: [], openGaps: false };
      return G('sequenceTransfer');
    }
    return P(choice('You gain the Weather Gage', `${combatSummary(s)}\nStart Combat Sequence ${newAtt === 'US' ? 'A' : 'B'} as the attacker, or Pass (the current Segment ends)?`, [{ id: 'attack', label: 'Attack', primary: true }, { id: 'pass', label: 'Pass' }], { combatPreview: true }), 'wgSwitch2');
  },
  wgSwitch2(s, f) {
    if (f.answer === 'pass') { s.encounter.lastEnd = 'pass'; log(s, 'You Pass.', 'player'); return R({ outcome: 'segmentEnd' }); }
    const newAtt = s.human;
    f.L.nextCombat = { att: newAtt, def: OTHER[newAtt], seq: newAtt === 'US' ? 'A' : 'B', pos: 0, segment: s.combat.segment, col: { US: [], BR: [] }, tows: {}, tac: { att: null, def: null }, gr: 0, newSeq: false, plan: null, roundAttackers: [], openGaps: false };
    return G('sequenceTransfer');
  },

  /* LC7 Close Action Round -------------------------------------------------------------- */
  ca(s, f) {
    const c = cmb(s), e = s.encounter;
    let attackers = c.rainy ? colShips(c, c.att) : (c.roundAttackers.length ? c.roundAttackers : colShips(c, c.att));
    attackers = attackers.filter(id => e.ships[id] === 'in' && isFull(s.ships[id]));
    if (!attackers.length) { log(s, 'No full-strength attackers for Close Action – the Segment ends.', 'combat'); return R({ outcome: 'segmentEnd' }); }
    if (!c.rainy) {
      if (c.att === s.ai) {
        const plan = aiPlanFor(s, s.ai, attackers, colShips(c, c.def), false, c.tows);
        if (!plan.ships.length) { log(s, `A.I. passes before Close Action: ${plan.why}`, 'ai'); return P(info('The A.I. breaks off', plan.why + '\nThe Segment ends.'), '__segEnd'); }
        const omitted = attackers.filter(id => plan.ships.indexOf(id) < 0);
        attackers = plan.ships;
        c.tows = plan.tows || {};
        if (omitted.length) log(s, `A.I. ships sitting out Close Action (still Engaged): ${omitted.map(id => shipName(s, id)).join(', ')}.`, 'ai');
      } else if (!f.L.caAsked) {
        f.L.caAsked = true;
        f.L.caAtt = attackers;
        return P(choice('Close Action Round – attack or pass?', `${combatSummary(s)}\nClose in for a Close Action Round (single-ship matchups at 2:1 Close Action strength or better, possible Melee), or Pass (the Segment ends)?`,
          [{ id: 'attack', label: 'Close Action', primary: true }, { id: 'pass', label: 'Pass' }], { combatPreview: true }), 'ca2');
      }
    }
    f.L.caAtt = attackers;
    f.answer = 'attack';
    return G('ca2');
  },
  ca2(s, f) {
    const c = cmb(s), e = s.encounter;
    f.L.caAsked = false;
    if (f.answer === 'pass') { log(s, 'You Pass – the Segment ends.', 'player'); e.lastEnd = 'pass'; return R({ outcome: 'segmentEnd' }); }
    const attackers = f.L.caAtt;
    const defenders = colShips(c, c.def).filter(id => e.ships[id] === 'in');
    const pairs = closeActionMatchups(s, attackers, defenders, c.att === s.ai);
    const lines = [];
    if (!pairs.length) {
      lines.push('No attacker can be matched at 2:1 Close Action strength or better – the Segment ends.');
      log(s, lines[0], 'combat');
      return P(info('Close Action', lines.join('\n'), { combatView: true }), '__segEnd');
    }
    const grapple = c.att === 'BR' && (c.grapple || tacActive(c, 'att', 'A_grapple'));
    beginLeaderResult(s);
    pairs.forEach(([a, d]) => {
      const sa = s.ships[a], sd = s.ships[d];
      if (e.ships[a] !== 'in' || e.ships[d] !== 'in') return;
      const caA = combatVals(s, sa)[2], caD = combatVals(s, sd)[2];
      const diff = caA - caD;
      const r = d10r(s);
      let lead;
      if (r <= diff) {
        // LC7d: the defender loses a Step and makes its Disengagement or Strike Check now. If it is still
        // Engaged afterwards (failed Disengagement, or Fight On!), the same ships go on to a Melee
        // (LC5 sidebar; Playbook example of play, Wolfe vs Lady of the Lake).
        lines.push(`${shipName(s, a)} (CA ${caA}) vs ${shipName(s, d)} (CA ${caD}): d10 ${r} ≤ ${diff} – HIT`);
        applyHits(s, c.def, { [d]: 1 }, { round: 'CA', grapple }, lines);
        if (e.ships[a] !== 'in' || e.ships[d] !== 'in') return;
        if (a === 'pike' || d === 'pike') { lines.push(`${shipName(s, d)} is still Engaged, but Gen. Pike cannot Melee.`); return; }
        lead = `${shipName(s, d)} is still Engaged – the ships go to MELEE`;
      } else {
        if (a === 'pike' || d === 'pike') { lines.push(`${shipName(s, a)} vs ${shipName(s, d)}: d10 ${r} > ${diff} – no effect (Gen. Pike cannot Melee)`); return; }
        lead = `${shipName(s, a)} vs ${shipName(s, d)}: d10 ${r} > ${diff} – MELEE`;
      }
      const mA = combatVals(s, sa)[2], mD = combatVals(s, sd)[2];
      let ra = d6(s); if (grapple) { const r2 = d6(s); ra = Math.max(ra, r2); }
      const rd = d6(s);
      const ma = ra + mA, md = rd + mD;
      let txt = `${lead} ${ra}+${mA}=${ma} vs ${rd}+${mD}=${md}`;
      let winner = null, loser = null;
      if (ma >= 1.5 * md) { winner = a; loser = d; }
      else if (md >= 1.5 * ma) { winner = d; loser = a; }
      if (!winner) { lines.push(txt + ' – boarders repelled, no effect'); return; }
      txt += ` – ${shipName(s, loser)} is CAPTURED!`;
      lines.push(txt);
      // Leader Casualty Checks for Flagships in a Melee with a result
      const wSide = s.ships[winner].owner, lSide = s.ships[loser].owner;
      if (s.flagship[wSide] === winner) leaderCheck(s, wSide, 1, lines, grapple && wSide === 'US' ? 2 : 0);
      if (s.flagship[lSide] === loser) leaderCheck(s, lSide, 2, lines, grapple && lSide === 'US' ? 2 : 0);
      const lfate = s.flagship[lSide] === loser && leaderAlive(s, lSide) ? 'captured' : null;
      e.ships[loser] = 'cap';
      captureShip(s, loser, wSide, 'Melee', false, lfate);
    });
    c.pos++;
    f.L.lines = lines; f.L.closeResult = true;
    return G('flagTransfer');
  },
  caDone(s, f) {
    tidyColumns(s);
    const c = cmb(s);
    if (!encIds(s, 'US').length || !encIds(s, 'BR').length) return R({ outcome: 'encounterEnd' });
    if (c.rainy) return R({ outcome: 'segmentEnd' });
    return G('next');
  },
};

/* ---------- Tactic helpers ---------------------------------------------------------------- */
// A save from before 0.2.4 can be waiting at the Rake choice without a rolled random ship: roll it now from the
// saved dice (the same ship the older version would have picked) and name it on the button (card A06)
function upgradeLegacyPrompt(s) {
  const f = s && s.calls && topFrame(s), p = s && s.prompt;
  if (!f || f.proc !== 'combat' || f.pc !== 'grRake' || !p || p.kind !== 'choice' || !s.combat) return s;
  f.L = f.L || {};
  const colD = colShips(s.combat, s.combat.def);
  if (!colD.length) return s;
  if (!f.L.rakeRandom || colD.indexOf(f.L.rakeRandom) < 0) f.L.rakeRandom = pick(s, colD);
  const o = (p.options || []).find(x => x.id === 'random');
  if (o) o.label = `Random ship: ${shipName(s, f.L.rakeRandom)}`;
  return s;
}
// Saves from earlier versions caught in a window that the fixed rules no longer reach (audits of 0.2.4–0.2.6).
// Saves written by 0.2.7 or later carry s.build and are never touched. For older saves each repair needs
// affirmative evidence from the current turn's log and the pending procedure state; anything that cannot be
// rebuilt exactly is left as saved and reported, with a pointer to an earlier save.
function upgradeLegacy(s, notes) {
  notes = notes || [];
  if (!s || !s.calls) return s;
  upgradeLegacyPrompt(s);
  // 0.2.7 stamped a save even when it could only warn, and kept the warning off the board: such a save
  // (stamped 0.2.7 and touched by an upgrade) is checked again, for warnings only – nothing is changed
  const recheck = s.build === '0.2.7' && !!s.migrated;
  if (s.build && !recheck) return s;           // written by the corrected procedures
  // a position this version cannot put right is kept as saved, with a notice that stays on the board
  // (and in every save of it) until the player loads another game or acknowledges it
  const warn = text => { s.recovery = s.recovery || []; if (s.recovery.indexOf(text) < 0) s.recovery.push(text); if (notes.indexOf(text) < 0) notes.push(text); };
  const done = s.migrated || {};
  const mark = k => { s.migrated = Object.assign(done, { [k]: true }); };
  const turnLog = (s.log || []).map((l, i) => ({ l, i })).filter(x => x.l.turn === s.turn);
  const pendingLines = [].concat(...(s.calls || []).map(f => (f.L && Array.isArray(f.L.lines)) ? f.L.lines.filter(x => typeof x === 'string') : []));
  // L01 – before 0.2.5 a withdrawn A.I. coastal mission put its Troops straight back in the A.I. Available box
  const repairedTroops = turnLog.some(x => /^Older save upgraded: the A\.I\.'s \d+ withdrawn Troops marker/.test(x.l.text));
  if ((!done.aiTroopsF7 || (recheck && !repairedTroops)) && ['lake', 'enemy', 'breakout', 'coastal', 'tally'].indexOf(s.phase) >= 0) {
    const re = new RegExp('^' + SIDE_SHORT[s.ai].replace(/\./g, '\\.') + ' Coastal mission aborted – (\\d+) Troops marker\\(s\\) remain available for future use\\.');
    const hits = turnLog.filter(x => re.test(x.l.text));
    if (hits.length) {
      mark('aiTroopsF7');
      const n = hits.reduce((a, x) => a + Number(re.exec(x.l.text)[1]), 0);
      const first = hits[0].i;
      // was the A.I.'s Troops count used since then? any deployment lookup on a Troops row, a Force sailing
      // with Troops, a landing, or a deployment in progress whose row is already chosen
      const used = turnLog.some(x => x.i > first && (/Deployment table: Troops [1-9]\d* row/.test(x.l.text) || /AI Deploys to .*Carrying \d+ Troops/.test(x.l.text) || x.l.text.indexOf(SIDE_SHORT[s.ai] + ' Troops launched') === 0)) ||
        (s.calls || []).some(f => f.proc === 'aiDeploy' && f.L && f.L.cell && f.L.cell.row >= 1);
      const inBox = s.aiTroops.box.filter(m => m.revealed && m.troops).length;
      if (used || inBox < n) {
        warn(`This save comes from an earlier version that put ${n} withdrawn A.I. Troops marker(s) back in its Available box too early this turn, and the A.I. has already counted ${n > 1 ? 'them' : 'it'} for a deployment${s.phase === 'tally' ? ' that this Tally has scored' : ''}. That can't be undone safely here, so the game is left as saved: to replay this turn by the rules, load a save from before the withdrawal.`);
      } else if (s.phase === 'tally' || recheck) {
        // nothing used it and F7 has the same result either way: leave the box alone
      } else {
        for (let k = 0; k < n; k++) s.aiTroops.box.splice(s.aiTroops.box.findIndex(m => m.revealed && m.troops), 1);
        s.troopsReturning = s.troopsReturning || { US: 0, BR: 0 };
        s.troopsReturning[s.ai] = (s.troopsReturning[s.ai] || 0) + n;
        const t = `Older save upgraded: the A.I.'s ${n} withdrawn Troops marker(s) were back in its Available box too early – they now return at F7.`;
        log(s, t, 'info'); notes.push(t);
      }
    }
  }
  // L02 – before 0.2.5 a ship that Struck Colors before Pursuit stayed undecided into the new Encounter
  const e = s.encounter;
  if (e && e.ships && (!done.pursuitStruck || recheck)) {
    const pIdx = turnLog.filter(x => /^Pursuit! The withdrawal is cancelled and a new Encounter begins/.test(x.l.text)).map(x => x.i).pop();
    const pending = Object.keys(e.ships).filter(id => e.ships[id] === 'struck');
    if (pIdx !== undefined && pending.length) {
      const struckText = (txt, id) => shipLineRe(s, id, 'Strike Check .*STRIKES COLORS').test(txt);
      const combatSince = turnLog.some(x => x.i > pIdx && /^Gunnery Round [12]:/.test(x.l.text)) || pendingLines.length > 0 || (s.calls || []).some(f => f.proc === 'combat');
      const old = [], unsure = [];
      pending.forEach(id => {
        if (pendingLines.some(t => struckText(t, id)) || turnLog.some(x => x.i > pIdx && struckText(x.l.text, id))) return;   // struck in the new Encounter
        if (turnLog.some(x => x.i < pIdx && struckText(x.l.text, id)) || !combatSince) old.push(id); else unsure.push(id);
      });
      // the Encounter that ended at Pursuit: attacker and defender from its last Gunnery Round line
      const grRe = /^Gunnery Round [12]: (U\.S\.|British) .* vs (U\.S\.|British) /;
      const gr = turnLog.filter(x => x.i < pIdx && grRe.test(x.l.text)).pop();
      const pursued = gr ? (grRe.exec(gr.l.text)[2] === 'U.S.' ? 'US' : 'BR') : null;
      if (old.length && pursued && !recheck) {
        mark('pursuitStruck');
        const lines = [];
        settleStruck(s, lines, pursued, old, true);
        lines.forEach(l => log(s, l, 'combat'));
        notes.push(`Older save upgraded: the surrender${old.length > 1 ? 's' : ''} from before the Pursuit ${old.length > 1 ? 'are' : 'is'} settled now, as at the end of that Encounter (rules note 68): ${lines.join(' ')}`);
      }
      if (unsure.length || (old.length && !pursued)) {
        mark('pursuitStruck');
        const who = unsure.concat(pursued ? [] : old).map(id => shipName(s, id)).join(', ');
        warn(`This save comes from an earlier version and holds a surrender (${who}) that may date from before the Pursuit; the save doesn't show which Encounter it belongs to, so it is left as saved. To settle it by the rules, load a save from before the Pursuit.`);
      }
    }
  }
  // 0.2.6 repaired some of these on opening, and its own repair could go wrong. A save it wrote afterwards is
  // recognised by contradictions the corrected procedures can never produce; it can't be rolled back safely,
  // so it is flagged, not changed.
  damageFrom026(s, turnLog, pendingLines, warn);
  return s;
}
// A ship's own lines in the log, whoever owns her now ("Wolfe (B) Strike Check …", later "Wolfe (B) [U.S.]")
function shipLineRe(s, id, rest) { return new RegExp('^' + def(s.ships[id]).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: \\([A-Z]\\))?(?: \\[[^\\]]*\\])? ' + rest); }
function damageFrom026(s, turnLog, pendingLines, warn) {
  const e = s.encounter;
  const pursuitAt = turnLog.filter(x => /^Pursuit! The withdrawal is cancelled and a new Encounter begins/.test(x.l.text)).map(x => x.i);
  const grRe = /^Gunnery Round [12]: (U\.S\.|British) .* vs (U\.S\.|British) /;
  // (a) a surrender settled in the middle of its Encounter chain
  if (e && e.ships && pursuitAt.length) {
    Object.keys(e.ships).filter(id => e.ships[id] === 'done').forEach(id => {
      const full = def(s.ships[id]).name;
      const settleRe = shipLineRe(s, id, 'is (?:CAPTURED by the (?:Americans|British)\\.|rescued and returns home)'), strikeRe = shipLineRe(s, id, 'Strike Check .*STRIKES COLORS');
      const settle = turnLog.filter(x => settleRe.test(x.l.text)).pop();
      if (!settle) return;
      const pIdx = pursuitAt.filter(i => i < settle.i).pop();
      if (pIdx === undefined) return;
      const struck = txt => strikeRe.test(txt);
      const own = (e.side && e.side[id]) || null;
      const captured = /CAPTURED/.test(settle.l.text);
      let why = null;
      if (pendingLines.some(struck) || turnLog.some(x => x.i > pIdx && struck(x.l.text))) {
        why = `${full} struck in the current Encounter, but was already ${captured ? 'captured' : 'rescued'} before it ended (the printed rules settle it at the end of its own Encounter)`;
      } else if (own && turnLog.some(x => x.i < pIdx && struck(x.l.text))) {
        const gr = turnLog.filter(x => x.i < pIdx && grRe.test(x.l.text)).pop();
        if (gr) {
          const pursued = grRe.exec(gr.l.text)[2] === 'U.S.' ? 'US' : 'BR';
          if ((own === pursued) !== captured) why = `${full} struck before the Pursuit and should have been ${own === pursued ? 'captured by the ' + SIDE_PL[OTHER[own]] : 'rescued'} at that moment (rules note 68), but was ${captured ? 'captured' : 'rescued'} instead`;
        }
      }
      if (why) warn(`This save was changed by version 0.2.6 when it was opened: ${why}. That can't be put back safely here, so the game is left as saved: to play this turn by the rules, load the save from before 0.2.6 opened it.`);
    });
  }
  // (b) Troops moved to the F7 queue after the A.I. had already counted them
  const upgraded = turnLog.find(x => /^Older save upgraded: the A\.I\.'s \d+ withdrawn Troops marker/.test(x.l.text));
  if (upgraded) {
    const abortRe = new RegExp('^' + SIDE_SHORT[s.ai].replace(/\./g, '\\.') + ' Coastal mission aborted – \\d+ Troops marker\\(s\\) remain available');
    const first = turnLog.find(x => abortRe.test(x.l.text));
    const lookedUp = first && turnLog.some(x => x.i > first.i && x.i < upgraded.i && /Deployment table: Troops [1-9]\d* row/.test(x.l.text));
    const inFlight = (s.calls || []).some(f => f.proc === 'aiDeploy' && f.L && f.L.cell && f.L.cell.row > aiTroopsInBox(s));
    if (lookedUp || inFlight) warn(`This save was changed by version 0.2.6 when it was opened: it moved the A.I.'s early-returned Troops to the F7 queue after the A.I. had already chosen a deployment row with them${inFlight ? ' – the deployment on screen still uses that row' : ''}. That can't be put back safely here, so the game is left as saved: to play this turn by the rules, load a save from before the withdrawal.`);
  }
}
// Attacker Rake is single-use: once its hits are allocated the card goes back to its deck (Playbook p.19)
function spendRake(s, c) {
  const t = c.tac.att;
  t.used = true;
  if (t.returned) return;
  t.returned = true;
  const i = (s.tacPlayed || []).indexOf('A_rake');
  if (i >= 0) s.tacPlayed.splice(i, 1);
  if (s.deck.tacA.indexOf('A_rake') < 0) returnTactics(s, 'A', ['A_rake']);
}
function tacActive(c, who, id) { const t = c.tac[who]; return !!(t && t.id === id && !t.negated); }
function useTac(c, who) { if (c.tac[who]) c.tac[who].used = true; }
function wgSymbolsText(s) { const ev = EVENTS[s.encounter.wgCard]; return ev && ev.sym.length ? '(' + ev.sym.map(x => SYM[x]).join(' ') + ')' : '(no symbols)'; }
function tacticValid(s, id, side) {
  const t = TACTIC_BY_ID[id], c = s.combat;
  if (t.dummy) return false;
  if (t.only && t.only !== side) return false;
  const ev = EVENTS[s.encounter.wgCard];
  if (ev && ev.sym.indexOf(t.sym) >= 0) return false;
  const attacking = c.att === side;
  if (id === 'A_surprise' && c.segment !== 'patrol') return false;
  if (id === 'A_grapple' && !(side === 'BR' && attacking)) return false;
  if (id === 'D_repel' && !(side === 'US' && !attacking)) return false;
  if (id === 'D_openrange' && !(side === 'BR' && !attacking)) return false;
  if (id === 'A_sweep') {
    const ids = colShips(c, c.att);
    const towed = towedInRound(c, ids);
    if (!(side === 'US' && attacking && ids.length && ids.every(x => isCLS(s.ships[x]) && towed.indexOf(x) < 0))) return false;
    const defs = colShips(c, c.def);
    if (defs.length && defs.every(x => isCLS(s.ships[x]))) return false;
  }
  return true;
}
function defaultTows(s, ids) {
  const tows = {};
  const towers = ids.filter(id => canTow(s.ships[id]) && !isCLS(s.ships[id]));
  const cls = ids.filter(id => isCLS(s.ships[id])).sort((a, b) => lg(s.ships[b]) - lg(s.ships[a]));
  towers.forEach((t, i) => { if (cls[i]) tows[t] = cls[i]; });
  return tows;
}
function subgroups(col) {
  const out = []; let cur = [];
  col.forEach(x => { if (x) cur.push(x); else if (cur.length) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}

/* ---------- Hit distribution ----------------------------------------------------------------- */
function distributeHits(s, col, n, map, lines, opt) {
  const ships = opt.subgroup || col; // may contain nulls (gaps)
  const N = opt.forceCol || ships.length;
  const colN = opt.openRange ? N + 5 : N;
  const rolls = [];
  let allTarget = null;
  for (let i = 0; i < n; i++) {
    const r = d66(s);
    let pos;
    if (HIT_DIST[colN]) pos = hitPosition(colN, r.red, r.blue);
    else pos = 1 + Math.floor(((r.red - 1) * 6 + (r.blue - 1)) * colN / 36);
    let id = ships[pos - 1] || null;
    if (opt.allToOne) { if (!allTarget) allTarget = id || ships.find(Boolean); id = allTarget; }
    rolls.push(`${r.v}→#${pos}${id ? ' ' + def(s.ships[id]).name : ' (empty – no effect)'}`);
    if (id) map[id] = (map[id] || 0) + 1;
  }
  lines.push(`${SIDE_SHORT[opt.side]} hit distribution (${colN}-ship column${opt.openRange ? ', Open Range +5' : ''}${opt.forceCol ? ', Defender Rake' : ''}): ${rolls.join(', ')}.`);
}

/* ---------- Apply hits: Leader, Disengagement and Strike Checks ------------------------------ */
function applyHits(s, side, map, ctx, lines) {
  const e = s.encounter, out = { stayed: [], hit: [] };
  const ids = Object.keys(map);
  if (!ids.length) return out;
  const ownResult = beginLeaderResult(s);
  const zf = e ? s.zones[e.zone].flags : {};
  const harbor = e && e.kind === 'harbor';
  const struckSoFar = () => Object.keys(e.ships).filter(id => e.ships[id] === 'struck' && e.side[id] === side).length;
  const pendingStrike = [];
  ids.forEach(id => {
    const sh = s.ships[id];
    let k = map[id];
    // Minor Damage Lake Zone Event (Gunnery Rounds)
    if (ctx.round === 'GR' && zf.minorDamage === sh.owner && !zf.minorDamageUsed) {
      zf.minorDamageUsed = true;
      const r = d10(s);
      if (r > dfn(sh)) lines.push(`Minor Damage check for ${shipName(s, id)}: d10 ${r} > Defense ${dfn(sh)} – the hit applies.`);
      else { k--; lines.push(`Minor Damage check for ${shipName(s, id)}: d10 ${r} ≤ Defense ${dfn(sh)} – one hit is ignored!`); }
    }
    if (k <= 0) return;
    out.hit.push(id);
    const full = def(sh).full[4], before = sh.steps;
    const wasFull = before >= full;
    // Leader Casualty Check for every hit on the Flagship (before Strike Checks)
    if (s.flagship[sh.owner] === id && leaderAlive(s, sh.owner)) {
      for (let i = 0; i < k; i++) leaderCheck(s, sh.owner, ctx.round === 'CA' ? 1 : 0, lines, ctx.grapple && sh.owner === 'US' ? 2 : 0);
    }
    const after = before - k;
    if (before <= 0 || after <= 0) {
      sh.steps = 0;
      const extra = before <= 0 ? k : k - before;
      pendingStrike.push({ id, extra });
      lines.push(`${shipName(s, id)} takes ${k} hit(s) and loses her last Step${extra ? ` (+${extra} for hits on a zero-step ship)` : ''}.`);
      return;
    }
    sh.steps = after;
    lines.push(`${shipName(s, id)} takes ${k} hit(s)${wasFull ? ' and is flipped to her Reduced side' : ''} – ${after} Step(s) left${after === 1 && full === 3 ? ' (Last Step)' : ''}.`);
    if (harbor) return;
    // Disengagement Checks
    if (ctx.escapeSide === side) { e.ships[id] = 'dis'; lines.push(`${shipName(s, id)} automatically Disengages (Escape).`); return; }
    let checks = k;
    if (isFast(sh) && wasFull) {
      if (k === 1) { e.ships[id] = 'dis'; lines.push(`${shipName(s, id)} (Fast) automatically passes her first Disengagement Check – Disengaged.`); return; }
      checks = k - 1;
    }
    let dis = false; const rr = [];
    for (let i = 0; i < checks && !dis; i++) {
      const mod = -struckSoFar(); const r = d6(s); rr.push(r + (mod ? `${mod}` : ''));
      if (r + mod <= 3) dis = true;
    }
    if (dis) { e.ships[id] = 'dis'; lines.push(`${shipName(s, id)} Disengagement Check ${rr.join(', ')} – DISENGAGED.`); }
    else { out.stayed.push(id); lines.push(`${shipName(s, id)} Disengagement Check ${rr.join(', ')} – fails, remains Engaged.`); }
  });
  // Strike Checks
  pendingStrike.forEach(({ id, extra }) => {
    const sh = s.ships[id];
    let mod = extra;
    if (s.flagship[sh.owner] === id && originalLeaderOk(s, sh.owner)) mod -= 1;
    const r = d10r(s), t = r + mod;
    const lone = !encIds(s, sh.owner).filter(x => x !== id).length;
    const lfate = s.flagship[sh.owner] === id && lone && leaderAlive(s, sh.owner) ? 'captured' : null;
    if (t <= 2) { lines.push(`${shipName(s, id)} Strike Check ${r}${mod ? (mod > 0 ? '+' : '') + mod : ''} – FIGHT ON! She refuses to strike (strengths now 0).`); out.stayed.push(id); }
    else if (t <= 8) {
      if (harbor && e.harborDefender === sh.owner) { lines.push(`${shipName(s, id)} Strike Check ${r}${mod ? (mod > 0 ? '+' : '') + mod : ''} – Strikes Colors (in her own harbor: not captured).`); e.ships[id] = 'hstruck'; }
      else { lines.push(`${shipName(s, id)} Strike Check ${r}${mod ? (mod > 0 ? '+' : '') + mod : ''} – STRIKES COLORS.`); e.ships[id] = 'struck'; e.leaderFate = e.leaderFate || {}; if (lfate) e.leaderFate[id] = lfate; }
    } else {
      lines.push(`${shipName(s, id)} Strike Check ${r}${mod ? (mod > 0 ? '+' : '') + mod : ''} – SINKS!`);
      e.ships[id] = 'sunk';
      sinkShip(s, id, OTHER[sh.owner], 'Lake Combat', lfate);
    }
  });
  if (ownResult) endLeaderResult(s);
  return out;
}
function leaderAlive(s, side) { return !(s.leaderResult && s.leaderResult[side]); }
function leaderCheck(s, side, drm, lines, extra) {
  if (!leaderAlive(s, side)) return null;
  const tot = drm + (extra || 0);
  const r = twoD6(s), t = r + tot;
  let res = 'no effect';
  if (t >= 11) res = 'KILLED';
  else if (t === 10) res = 'wounded';
  lines.push(`Leader Casualty Check (${leaderName(s, side)}): 2d6 ${r}${tot ? '+' + tot : ''} – ${res}.`);
  if (t >= 11) leaderCasualty(s, side, 'killed');
  else if (t === 10) leaderCasualty(s, side, 'wounded');
  return res;
}
function flagTransferOptions(s, side) {
  const c = s.combat; if (!c) return [];
  const fl = s.flagship[side];
  const sh = s.ships[fl];
  // The Flagship may be Engaged or have just Disengaged (it is still in the column until the gap closes): Playbook p.19
  if (!sh || !isReduced(sh) || ['in', 'dis'].indexOf(s.encounter.ships[fl]) < 0) return [];
  const L = s.leader[side]; if (L.wounded || !leaderAlive(s, side)) return [];
  const col = c.col[side] || []; const i = col.indexOf(fl);
  if (i < 0) return [];
  return [col[i - 1], col[i + 1]].filter(id => id && isFull(s.ships[id]) && s.encounter.ships[id] === 'in');
}
function flagTransferPrompt(s, options, lines) {
  const h = s.human;
  return choice('Transfer the flag?', `${lines.join('\n')}\n\nYour Flagship ${shipName(s, s.flagship[h])} is Reduced. ${leaderName(s, h)} may try to shift his flag to an adjacent full-strength ship (he must pass a Leader Casualty Check).`,
    [{ id: 'stay', label: 'Stay aboard', primary: true }].concat(options.map(id => ({ id, label: `Transfer to ${shipName(s, id)}` }))), { combatView: true });
}
function transferAiFlagIfBeneficial(s, lines) {
  const ai = s.ai;
  if (s.combat.att !== ai || !commandDRMAvailable(s, ai)) return;
  const options = flagTransferOptions(s, ai);
  if (options.length) tryFlagTransfer(s, ai, options[0], lines);
}
function tryFlagTransfer(s, side, to, lines) {
  const r = twoD6(s);
  if (r >= 11) { lines.push(`${leaderName(s, side)} tries to shift his flag – 2d6 ${r}: KILLED in the attempt!`); leaderCasualty(s, side, 'killed'); return; }
  if (r === 10) { lines.push(`${leaderName(s, side)} tries to shift his flag – 2d6 ${r}: wounded, the transfer fails.`); leaderCasualty(s, side, 'wounded'); return; }
  s.flagship[side] = to;
  lines.push(`${leaderName(s, side)} shifts his flag to ${shipName(s, to)} (2d6 ${r}).`);
  log(s, `${SIDE_SHORT[side]} flag transferred to ${shipName(s, to)}.`, 'combat');
}

/* ---------- Withdrawal ------------------------------------------------------------------------ */
// Ships that leave with a Withdrawal: everything still in the Encounter or Disengaged, except ships that just failed a Disengagement Check [LC5 W c–d]
function withdrawEligible(s, side, stayed) { return encIds(s, side, ['in', 'dis']).filter(id => (stayed || []).indexOf(id) < 0); }
function doWithdrawal(s, side, stayed, hitNow) {
  const e = s.encounter, lines = [];
  // LC5 W d.: the whole Force withdraws – Engaged ships, ships hit by this W result that passed their
  // Disengagement Check, and ships that Disengaged earlier in the Encounter. Only ships that just failed
  // a Disengagement Check (or fought on) stay.
  const leaving = withdrawEligible(s, side, stayed);
  const forcesHit = {};
  leaving.forEach(id => {
    const sh = s.ships[id];
    if (sh.forceId) forcesHit[sh.forceId] = true;
  });
  Object.keys(forcesHit).forEach(fid => { const fr = s.forces[fid]; if (fr && (fr.mission === 'ArmySupport' || fr.mission === 'Raid' || fr.mission === 'CuttingOut')) { abortCoastalMission(s, fr); fr.mission = 'Patrol'; } });
  leaving.forEach(id => {
    const sh = s.ships[id];
    removeShipFromForce(s, id);
    sh.box = 'transit'; sh.zone = null; sh.flags.withdrawn = true;
    discardStepMarkers(sh);
    e.ships[id] = 'wd';
  });
  if (leaving.length) lines.push(`${SIDE_NAME[side]} ships withdraw to In Transit: ${leaving.map(id => shipName(s, id)).join(', ')}.`);
  if (stayed.length) lines.push(`Still Engaged (failed Disengagement): ${stayed.map(id => shipName(s, id)).join(', ')}.`);
  if (!encIds(s, side).length) e.withdrawn[side] = true;
  // Blockade lifted if the blockading side no longer has 4 full-strength Main ships [LC5 W e.]
  const z = e.zone; const bl = s.zones[z].blockade;
  if (bl && bl === side) {
    const mains = shipsInZone(s, z, side).filter(sh => isFull(sh) && isMain(sh)).length;
    if (mains < 4) { s.zones[z].blockade = null; lines.push(`The Blockade of ${ZONE_NAME[z]} is lifted.`); }
  }
  return lines;
}

/* ---------- Columns ------------------------------------------------------------------------- */
function tidyColumns(s) {
  const c = s.combat, e = s.encounter;
  if (!c) return;
  ['US', 'BR'].forEach(sd => {
    const keepGaps = sd === c.def && tacActive(c, 'att', 'A_outmaneuver') && c.gr <= 1;
    c.col[sd] = c.col[sd].map(id => (id && e.ships[id] === 'in') ? id : (keepGaps ? null : undefined)).filter(x => x !== undefined);
    while (c.col[sd].length && c.col[sd][0] === null) c.col[sd].shift();
    while (c.col[sd].length && c.col[sd][c.col[sd].length - 1] === null) c.col[sd].pop();
  });
}

/* ---------- Close Action matchups ----------------------------------------------------------- */
function closeActionMatchups(s, attackers, defenders, aiAttacking) {
  const caOf = id => combatVals(s, s.ships[id])[2];
  const free = defenders.slice();
  const pairs = [];
  if (aiAttacking) {
    // LC7c: the A.I. picks, strongest attacker first, by capture VP, then guns, then lowest CA.
    const atts = attackers.slice().sort((a, b) => caOf(b) - caOf(a));
    atts.forEach(a => {
      const ca_ = caOf(a);
      const ok = free.filter(d => ca_ > 0 && ca_ >= 2 * caOf(d));
      if (!ok.length) return;
      const best = ok.sort((x, y) => (vpCapture(s.ships[y]) - vpCapture(s.ships[x])) || (guns(s.ships[y]) - guns(s.ships[x])) || (caOf(x) - caOf(y)))[0];
      pairs.push([a, best]);
      free.splice(free.indexOf(best), 1);
    });
    return pairs;
  }
  // LC7b, human attacker: every attacker that can be matched at 2:1 attacks ("the most advantageous
  // matchups possible"). Each attacker can take any defender up to half its CA, so the eligible sets are
  // nested; taking attackers weakest-first and giving each the weakest free defender it can reach
  // matches the largest possible number of ships, against the weakest defenders.
  const atts = attackers.filter(a => caOf(a) > 0).sort((a, b) => caOf(a) - caOf(b));
  atts.forEach(a => {
    const ca_ = caOf(a);
    const ok = free.filter(d => ca_ >= 2 * caOf(d));
    if (!ok.length) return;
    const best = ok.sort((x, y) => (caOf(x) - caOf(y)) || (vpCapture(s.ships[y]) - vpCapture(s.ships[x])))[0];
    pairs.push([a, best]);
    free.splice(free.indexOf(best), 1);
  });
  // Present the strongest attacker first, as before.
  return pairs.sort((p, q) => caOf(q[0]) - caOf(p[0]));
}

function combatSummary(s) {
  const c = s.combat, e = s.encounter;
  const sd = side => (c && c.col[side] && c.col[side].length ? c.col[side].filter(Boolean) : encIds(s, side)).map(id => { const sh = s.ships[id]; return `${shipName(s, id)}${isReduced(sh) ? ` (Reduced, ${sh.steps} step${sh.steps === 1 ? '' : 's'})` : ''}`; }).join(', ');
  return `${ZONE_NAME[e.zone]} – U.S.: ${sd('US') || '—'}\nBritish: ${sd('BR') || '—'}`;
}

function logLines(s, lines) { lines.forEach(l => { if (l) log(s, l, 'combat'); }); }
