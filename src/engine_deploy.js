/* ============================================================================
   AI Deployment from a revealed Target Card (EN1.1 / C4-C5) and Convoy attacks
   ========================================================================== */
/* ---- Player Aid V: automatic American A.I. Force Package selection [5.3.1] ----
   Main Ships first, then Secondary Ships as needed; the smallest number of ships that meets the
   requirement; ties broken by random draw (seeded game RNG). Long Gun = printed value. */
function combos(arr, k, cb) {
  const n = arr.length, idx = [];
  const rec = (start, depth) => {
    if (depth === k) { cb(idx.map(i => arr[i])); return; }
    for (let i = start; i <= n - (k - depth); i++) { idx[depth] = i; rec(i + 1, depth + 1); }
  };
  if (k <= n) rec(0, 0);
}
// Smallest set of ships whose value sums to at least `need` – random choice among all minimal sets
function minSubset(s, ships, val, need) {
  if (need <= 0) return [];
  const sorted = ships.slice().sort((a, b) => val(b) - val(a));
  let tot = 0, k = 0;
  for (const sh of sorted) { if (tot >= need) break; tot += val(sh); k++; }
  if (tot < need) return null;
  const found = [];
  combos(ships, k, c => { if (sumBy(c, val) >= need) found.push(c); });
  return found.length ? found[rint(s, found.length)] : null;
}
function lowestBy(s, ships, val, n) {
  const keyed = ships.map(sh => [val(sh), rngNext(s), sh]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return keyed.slice(0, n).map(x => x[2]);
}
function mainsFirst(s, pool, val, need) {
  const mains = pool.filter(isMain), secs = pool.filter(sh => !isMain(sh));
  const mTot = sumBy(mains, val);
  if (mTot >= need) return minSubset(s, mains, val, need);
  const rest = minSubset(s, secs, val, need - mTot);
  return rest ? mains.concat(rest) : null;
}
function names(s, ships) { return ships.map(sh => def(sh).name + (def(sh).ver ? ' ' + def(sh).ver : '')).join(', '); }
function forcePackageSelect(s, pkg, pool) {
  const mains = pool.filter(isMain), secs = pool.filter(sh => !isMain(sh));
  const fail = why => ({ ok: false, why });
  const ok = (ships, extra) => Object.assign({ ok: true, ships: ships.map(sh => sh.id) }, extra || {});
  switch (pkg) {
    case 1:
      if (!mains.length) return fail('no Main Ships are Deployable');
      return ok(mains, { text: `All Main Ships: ${names(s, mains)}.` });
    case 2: case 3: case 4: case 5: case 6: {
      const need = PKG_LG_NEED[pkg];
      const sel = mainsFirst(s, pool, lg, need);
      if (!sel) return fail(`only ${sumBy(pool, lg)} Long Gun points are Deployable (needs ${need})`);
      return ok(sel, { text: `${need} Long Gun needed → ${names(s, sel)} (Long Gun ${sumBy(sel, lg)}).` });
    }
    case 7: {
      const sel = mains.concat(secs.filter(sh => lg(sh) > 0 || ca(sh) > 0));
      if (!sel.length) return fail('no qualifying ships are Deployable');
      return ok(sel, { text: `All Main Ships + Secondary ships with Long Gun or Close Action: ${names(s, sel)}.` });
    }
    case 8: {
      if (aiTroopsInBox(s) < 1) return fail('no A.I. Troops are Available for the Army Support Force');
      const f1 = minSubset(s, mains, ca, 8);
      if (!f1) return fail(`Main ships total only ${sumBy(mains, ca)} Close Action points (needs 8)`);
      const rest = pool.filter(sh => f1.indexOf(sh) < 0);
      const f2 = mainsFirst(s, rest, lg, 22);
      if (!f2) return fail(`the remaining ships total only ${sumBy(rest, lg)} Long Gun points (2nd Force needs 22)`);
      return ok(f1, { ships2: f2.map(sh => sh.id), text: `1st Force (Army Support, Close Action ${sumBy(f1, ca)}): ${names(s, f1)}.
2nd Force (Patrol, Long Gun ${sumBy(f2, lg)}): ${names(s, f2)}.` });
    }
    case 9: {
      const lady = secs.find(sh => sh.id === 'lady');
      const zeroCA = secs.filter(sh => ca(sh) === 0 && sh.id !== 'lady');
      if (lady) {
        if (!zeroCA.length) return fail('no other Secondary ship with 0 Close Action is Deployable');
        const other = lowestBy(s, zeroCA, lg, 1);
        return ok([lady].concat(other), { text: `Lady of the Lake + lowest-Long Gun 0-Close Action Secondary: ${names(s, [lady].concat(other))}.` });
      }
      if (zeroCA.length < 2) return fail('fewer than two Secondary ships with 0 Close Action are Deployable');
      const two = lowestBy(s, zeroCA, lg, 2);
      return ok(two, { text: `Lady of the Lake unavailable – two lowest-Long Gun 0-Close Action Secondaries: ${names(s, two)}.` });
    }
    case 10: {
      if (secs.length < 2) return fail('fewer than two Secondary ships are Deployable');
      const two = shuffle(s, secs).slice(0, 2);
      return ok(two, { text: `Two random Secondary ships: ${names(s, two)}.` });
    }
    case 11: {
      if (sumBy(secs, sh => sh.steps) < 5) return fail(`Secondary ships total only ${sumBy(secs, sh => sh.steps)} steps (needs 5)`);
      const out = []; let st = 0;
      for (const sh of shuffle(s, secs)) { if (st >= 5) break; out.push(sh); st += sh.steps; }
      return ok(out, { text: `Five steps of random Secondary ships: ${names(s, out)} (${st} steps).` });
    }
  }
  return fail('unknown package');
}
function cardCell(s, card) {
  const row = Math.min(3, aiTroopsAvailable(s));
  const col = s.nbBand;
  const v = card.grid[row][col];
  return { row, col, v: card.deck === 'A' ? (v === '1' || v === 1 ? 1 : 0) : (v || 0) };
}

// Work out the AI Force's effective mission for a revealed card (null = no Deployment)
function effectiveMission(s, card, phase) {
  const ai = s.ai, h = s.human;
  let m = card.mission, why = '';
  const sec = () => { m = card.secondary; };
  switch (card.cond) {
    case 'raidOncePerZone':
      if (forcesInZone(s, card.zone, ai).some(f => f.mission === 'Raid')) { sec(); why = 'an AI Raid is already in this zone'; }
      break;
    case 'escortNeedsConvoy': {
      // 9.1.2 (both rulebooks): enemy Convoys can be Encountered only on a turn when the Sacket's Lake Zone
      // is free of Blockade.
      if (phase === 'lake' && s.zones.SAC.blockade) { sec(); why = "the Sacket's Lake Zone is under Blockade, so no Convoy can be Encountered"; break; }
      const c = s.convoys[ai][s.turn];
      if (!c || !c.real || s.convoyDeployed[ai]) { sec(); why = !c || !c.real ? 'no AI Convoy this turn' : 'the AI Convoy already Deployed'; }
      if (c && !c.revealed) { c.revealed = true; log(s, `AI Convoy marker for ${TURN_NAMES[s.turn]} revealed: ${c.real ? 'Convoy' : 'No Convoy'}.`, 'ai'); }
      break;
    }
    case 'attackConvoyIfRunning': {
      const c = s.convoys[h][s.turn];
      // British campaign 9.1.2 / 11.3.1 case 2: the Escort Convoy box Deploys only in an Enemy Operations
      // Phase, so in a Lake Action Encounter the card is a plain Patrol (player ruling, Nov 2026).
      if (h === 'BR' && phase !== 'enemy') break;
      if (c && c.real && !s.convoyDeployed[h]) { sec(); why = 'your Convoy is running this turn'; }
      break;
    }
    case 'cuttingOutLimit':
      if (!s.options.cuttingOut) { m = null; why = 'Cutting-Out optional rule not in use'; }
      else if (s.cuttingOutUsed[ai]) { m = null; why = 'the AI already used its Cutting-Out mission'; }
      break;
    case 'secondaryIfUSTempHomeport':
    case 'secondaryIfBRTempHomeport': {
      const side = card.cond === 'secondaryIfUSTempHomeport' ? 'US' : 'BR';
      if (usingTempHomeport(s, side)) {
        m = 'CuttingOut'; why = `${TEMP_HOMEPORT_NAME[side]} is in use as a Temporary Homeport`;
        if (!s.options.cuttingOut || s.cuttingOutUsed[ai]) { m = null; why += ', but Cutting-Out is not available'; }
      }
      break;
    }
    case 'notIfNiagaraFortGeorge':
      if (s.niagara === 6) { m = null; why = 'the Niagara Front marker is in Fort George'; }
      break;
    case 'notIfNiagaraBurlington':
      if (s.niagara === 0) { m = null; why = 'the Niagara Front marker is in Burlington Heights'; }
      break;
    case 'onlyIfPikeOrSylphUnbuilt': {
      const unbuilt = ['pike', 'sylph'].some(id => s.ships[id].owner === 'US' && (s.ships[id].box === 'construction' || s.ships[id].box === 'repairing'));
      if (!unbuilt) { m = null; why = 'neither Pike nor Sylph is in Construction or Repairing'; }
      break;
    }
  }
  if (m === 'Escort' && phase === 'lake') {
    // handled by convoy procedure
  }
  if (m === 'ArmySupport' && aiTroopsInBox(s) < 1) { m = null; why = 'no AI Troops are Available'; }
  return { mission: m, why };
}

PROCS.aiDeploy = {
  start(s, f) {
    const A = f.A, rowCard = s.targetRow[A.cardIdx], card = TARGET_CARDS[rowCard.id];
    rowCard.revealed = true;
    f.L.card = card.id;
    const em = effectiveMission(s, card, A.phase);
    f.L.mission = em.mission; f.L.why = em.why;
    const cell = cardCell(s, card);
    f.L.cell = cell;
    const head = `Target Card ${card.id}: ${ZONE_NAME[card.zone]} – ${MISSION_NAME[card.mission]}${card.secondary ? ' (' + MISSION_NAME[card.secondary] + ')' : ''}.`;
    const cellTxt = `Deployment table: Troops ${cell.row} row × Naval Balance “${NB_CARD_LABELS[cell.col]}” column → ${card.deck === 'A' ? (cell.v ? 'ship icon' : 'blank') : (cell.v ? 'Force Package #' + cell.v : 'blank')}.`;
    f.L.head = head; f.L.cellTxt = cellTxt;
    if (!em.mission) {
      log(s, `${head} No Deployment: ${em.why}.`, 'ai');
      return R({ none: true, text: head + ' No Deployment – ' + em.why + '.' });
    }
    // Escort card during Lake Action: Convoy encounter procedure [11.3.1 case 1]
    if (card.mission === 'Escort' && em.mission === 'Escort' && A.phase === 'lake' && A.encounter) {
      return G('convoyEscort');
    }
    if (!cell.v) {
      log(s, `${head} ${cellTxt} No AI Deployment.`, 'ai');
      return A.encounter ? aiPauseR(s, `Encounter – no enemy`, `${head}\n${cellTxt}\nNo AI ships Deploy. The Encounter ends.`, { none: true }, { targetCard: card.id }) : R({ none: true });
    }
    return G('pick');
  },
  pick(s, f) {
    const card = TARGET_CARDS[f.L.card];
    const pool = aiDeployablePool(s, f.A.phase);
    if (!pool.length) { log(s, `${f.L.head} – no AI Deployable ships remain.`, 'ai'); return R({ none: true }); }
    if (card.deck === 'A') {
      // U.S. campaign: all British Deployable ships deploy as a single Force [5.3]
      f.L.ships = pool.map(sh => sh.id);
      return G('upgrade');
    }
    // British campaign: U.S. Force Package (Player Aid V)
    const pkg = f.L.cell.v;
    f.L.pkg = pkg;
    if (!s.options.manualPackages) {
      const res = forcePackageSelect(s, pkg, pool);
      if (!res.ok) {
        const txt = `${f.L.head}\n${f.L.cellTxt}\nForce Package #${pkg}: ${FORCE_PACKAGE_TEXT[pkg]}\nRequirements not met – ${res.why}. No Deployment.`;
        log(s, txt.replace(/\n/g, ' '), 'ai');
        return f.A.encounter ? aiPauseR(s, `Encounter ${f.A.peNum || ''} – no enemy`, txt, { none: true }, { targetCard: card.id }) : (s.options.confirmAiSteps ? aiPauseR(s, 'AI Deployment', txt, { none: true }, { targetCard: card.id }) : R({ none: true }));
      }
      f.L.ships = res.ships; f.L.ships2 = res.ships2 || null;
      f.L.pkgTxt = `Force Package #${pkg}: ${res.text}`;
      return G('upgrade');
    }
    return P({ kind: 'select', title: `AI Force Package #${pkg}`, pkg,
      text: `${f.L.head}\n${f.L.cellTxt}\nPackage #${pkg}: ${FORCE_PACKAGE_TEXT[pkg]}\nSelect the American ships that meet it (Main Ships first, then Secondary; fewest ships that meet the requirement; Long Gun = printed value) [5.3.1]. Select none if the package's requirements cannot be met.` +
        (f.L.mission === 'ArmySupport' ? '\nArmy Support: the Force must have at least 4 Close Action points to carry a Troops marker.' : ''),
      items: pool.map(sh => ({ id: sh.id, label: `${shipName(s, sh.id)} – LG ${lg(sh)} / Car ${car(sh)} / CA ${ca(sh)} / Def ${dfn(sh)} · ${isMain(sh) ? 'Main' : 'Secondary'} · ${guns(sh)} guns` })),
      min: 0, max: pool.length, allowSplit: pkg === 8, targetCard: card.id }, 'pickB');
  },
  pickB(s, f) {
    f.L.ships = f.answer || [];
    if (!f.L.ships.length) { log(s, `${f.L.head} Force Package requirements not met – no Deployment.`, 'ai'); return R({ none: true }); }
    if (f.L.cell.v === 8 && f.L.ships.length > 1) {
      return P({ kind: 'select', title: 'Force Package #8 – second stack', text: 'Package #8 deploys as two Forces. Select the ships that form the second stack (the rest form the first).',
        items: f.L.ships.map(id => ({ id, label: shipName(s, id) })), min: 0, max: f.L.ships.length - 1 }, 'pickB2');
    }
    return G('upgrade');
  },
  pickB2(s, f) {
    f.L.ships2 = f.answer || [];
    f.L.ships = f.L.ships.filter(id => f.L.ships2.indexOf(id) < 0);
    return G('upgrade');
  },
  upgrade(s, f) {
    const A = f.A;
    // Rule 7.1 Upgrade Checks (U.S. campaign) when ships deploy for an Encounter
    if (s.human === 'US' && A.encounter) {
      if (s.options.oa1Upgrades) {
        if (!s.turnFlags.oa1Done) {
          s.turnFlags.oa1Done = true;
          const aShips = f.L.ships.map(id => s.ships[id]).filter(sh => sh.ver === 'A' && !sh.isolated);
          if (aShips.length) {
            const r = d10r(s), n = Math.min(upgradeLimit(r), aShips.length);
            const chosen = shuffle(s, aShips).slice(0, n);
            chosen.forEach(sh => { sh.box = 'makeReady'; sh.flags.upgrading = true; });
            f.L.ships = f.L.ships.filter(id => chosen.every(c => c.id !== id));
            log(s, `OA1 upgrade roll ${r}: ${chosen.length ? chosen.map(sh => def(sh).name).join(', ') + ' go to Make Ready to upgrade' : 'no upgrades'}.`, 'ai');
            if (chosen.length) {
              s.nb = computeNavalBalance(s); s.nbBand = navalBalanceBand(s.nb);
              const cell = cardCell(s, TARGET_CARDS[f.L.card]);
              if (!cell.v || !f.L.ships.length) { log(s, `Naval Balance now ${s.nb}: the card no longer Deploys ships.`, 'ai'); return R({ none: true }); }
            }
          }
        }
      } else {
        const msgs = [];
        f.L.ships.forEach(id => {
          const sh = s.ships[id];
          if (sh.ver === 'A' && sh.owner === 'BR' && !sh.isolated) {
            const r = d6(s);
            if (r % 2 === 0) { sh.ver = 'B'; msgs.push(`${def(sh).name}: roll ${r} – “B” version!`); }
            else msgs.push(`${def(sh).name}: roll ${r} – still “A”`);
          }
        });
        if (msgs.length) log(s, `Upgrade Checks [7.1]: ${msgs.join('; ')}.`, 'ai');
      }
    }
    return G('place');
  },
  place(s, f) {
    const A = f.A, card = TARGET_CARDS[f.L.card];
    let mission = f.L.mission;
    if (f.L.pkg === 8 && f.L.ships2 && f.L.ships2.length && mission !== 'Escort') mission = 'ArmySupport';
    let troops = 0;
    if (mission === 'ArmySupport') {
      const cap = troopCapacity(s, f.L.ships);
      troops = Math.min(cap, aiTroopsInBox(s));
      if (troops < 1) { log(s, `${f.L.head} The Force cannot carry Troops (needs 4 Close Action per Troops marker) – no Deployment.`, 'ai'); return R({ none: true }); }
      takeAiTroops(s, troops);
    }
    if (mission === 'CuttingOut') { s.cuttingOutUsed[s.ai] = true; }
    const force = newForce(s, s.ai, card.zone, mission, f.L.ships, { origin: 'targetCard', cardId: card.id, troops, deployPhase: A.phase });
    f.L.force = force.id;
    let f2txt = '';
    if (f.L.ships2 && f.L.ships2.length) {
      const f2 = newForce(s, s.ai, card.zone, 'Patrol', f.L.ships2, { origin: 'targetCard', cardId: card.id, deployPhase: A.phase });
      f.L.force2 = f2.id;
      f2txt = `\nSecond Force (Patrol mission):\n${f2.ships.map(id => '• ' + shipName(s, id)).join('\n')}`;
      if (A.encounter) {
        const r = d6(s);
        f.L.encForce = r % 2 ? force.id : f2.id;
        f2txt += `\nPackage #8 roll 1d6 = ${r} (${r % 2 ? 'odd' : 'even'}): the Encounter is with the ${r % 2 ? 'Army Support' : 'Patrol'} Force.`;
      }
    }
    const txt = `${f.L.head}\n${f.L.cellTxt}${f.L.pkgTxt ? '\n' + f.L.pkgTxt : ''}\nAI Deploys to ${ZONE_NAME[card.zone]} with ${/^[AEIOU]/.test(MISSION_NAME[mission]) ? 'an' : 'a'} ${MISSION_NAME[mission]} mission${f.L.why ? ' (' + f.L.why + ')' : ''}:\n${force.ships.map(id => '• ' + shipName(s, id)).join('\n')}${troops ? `\nCarrying ${troops} Troops marker(s).` : ''}${f2txt}`;
    log(s, txt.replace(/\n/g, ' '), 'ai');
    // Attack Convoy secondary mission [9.1.2, 11.3.1 case 2]
    if (mission === 'AttackConvoy') {
      return P(info(A.phase === 'lake' ? `Encounter ${A.peNum}: enemy sighted` : 'AI Deployment', txt + '\nThe A.I. goes after your Convoy!', { targetCard: card.id }), 'attackConvoy');
    }
    if (A.phase === 'enemy' && s.options.confirmAiSteps) return P(info('AI Deployment', txt, { targetCard: card.id }), 'done');
    if (A.phase === 'lake' && s.options.confirmAiSteps) return P(info(`Encounter ${A.peNum}: enemy sighted`, txt, { targetCard: card.id }), 'done');
    return G('done');
  },
  done(s, f) {
    const forces = f.L.encForce ? [f.L.encForce] : [f.L.force].concat(f.L.force2 ? [f.L.force2] : []);
    return R({ forces, convoy: f.L.convoyEscort ? s.ai : null });
  },

  /* Lake Action Escort card: AI convoy [11.3.1 case 1] */
  convoyEscort(s, f) {
    const ai = s.ai, h = s.human, A = f.A, card = TARGET_CARDS[f.L.card];
    const zone = ai === 'BR' ? card.zone : 'SAC';
    s.convoyDeployed[ai] = { zone };
    const c = s.convoys[ai][s.turn]; c.deployed = true;
    const hf = s.forces[A.humanForceId];
    if (!f.L.cell.v) {
      const g = sumBy(forceShips(s, hf).filter(isFull), guns);
      const res = scatterRoll(s, ai, g, `your ${forceLabel(s, hf)}`);
      const txt = `${f.L.head}\nThe AI ${MONTHS[Math.floor(s.turn / 2)]} Convoy is found in ${ZONE_NAME[zone]} – unescorted!\nConvoy Scatter Table: ${g} guns, ${res.txt}.`;
      return aiPauseR(s, 'Convoy found!', txt, { convoyHandled: true }, { targetCard: card.id });
    }
    f.L.mission = 'Escort';
    f.L.convoyEscort = true;
    return G('pick');
  },
  attackConvoy(s, f) {
    const h = s.human, card = TARGET_CARDS[f.L.card], A = f.A;
    const zone = h === 'US' ? 'SAC' : card.zone;
    s.convoyDeployed[h] = { zone };
    s.convoys[h][s.turn].deployed = true;
    const aiForce = s.forces[f.L.force];
    let escort;
    if (h === 'US') escort = forcesInZone(s, 'SAC', 'US').filter(x => x.mission === 'Escort');
    else {
      const ships = shipsIn(s, 'BR', 'escortBox');
      escort = ships.length ? [newForce(s, 'BR', zone, 'Escort', ships.map(sh => sh.id), { origin: 'escortBox' })] : [];
    }
    // In the Lake Action Phase the Force that triggered the Encounter defends the Convoy too
    if (A.phase === 'lake' && A.humanForceId && s.forces[A.humanForceId] && escort.length && escort.every(x => x.id !== A.humanForceId)) escort.push(s.forces[A.humanForceId]);
    if (aiForce.zone !== zone) { aiForce.zone = zone; forceShips(s, aiForce).forEach(sh => { sh.zone = zone; }); }
    const escortShips = escort.reduce((a, x) => a.concat(x.ships), []);
    if (!escortShips.length) {
      const g = sumBy(forceShips(s, aiForce).filter(isFull), guns);
      const res = scatterRoll(s, h, g, 'the AI Force');
      return aiPauseR(s, 'Your Convoy is attacked!', `Your Convoy deploys to ${ZONE_NAME[zone]} without an escort.\nConvoy Scatter Table: AI Force ${g} guns, ${res.txt}.`, A.phase === 'lake' ? { convoyHandled: true } : { forces: [aiForce.id] });
    }
    log(s, `Your escorted Convoy is attacked in ${ZONE_NAME[zone]}.`, 'ai');
    if (A.phase === 'lake') return R({ forces: [aiForce.id], convoy: h, escortForces: escort.map(x => x.id) });
    return C('encounter', { zone, kind: 'convoy', convoySide: h, humanForces: escort.map(x => x.id), aiForces: [aiForce.id], startAt: 'event' }, 'done');
  },
};
// Convoy encounter after an escorted AI convoy: aiDeploy returns forces, B2after runs the encounter with kind convoy
function scatterRoll(s, convoySide, gunsN, attackerTxt) {
  const row = SCATTER_ROWS.findIndex(r => gunsN >= r[0] && gunsN <= r[1]);
  const r = d10(s);
  let res = row < 0 ? 'S' : SCATTER[row][r];
  if (gunsN <= 0) res = 'S';
  const c = s.convoys[convoySide][s.turn];
  if (c) c.result = res;
  const word = { S: 'Convoy Scatters', D: 'Convoy Destroyed', C: 'Convoy Captured' }[res];
  log(s, `Convoy Scatter Table vs ${SIDE_SHORT[convoySide]} Convoy (${attackerTxt}, ${gunsN} guns): d10 ${r} → ${word}.`, 'roll');
  return { res, txt: `d10 = ${r} → ${word}` };
}
function aiPauseR(s, title, text, ret, extra) {
  if (!s.options.confirmAiSteps) return R(ret);
  // stash return value; generic resume handler returns it
  const f = topFrame(s);
  f.L.__ret = ret;
  return P(info(title, text, extra), '__resume');
}
// generic resume handler injected into every procedure table
function installResume() {
  Object.keys(PROCS).forEach(k => { PROCS[k].__resume = (s, f) => R(f.L.__ret); });
}
