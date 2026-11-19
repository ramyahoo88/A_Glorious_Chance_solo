/* ============================================================================
   E Coastal Action Phase: Cutting-Out (optional), Raids, Army Support,
   Harbor Encounters (12), Land Battles (13)
   ========================================================================== */
const LB_RESULTS = [
  { id: 'AF', label: 'Attacker Feat of Arms', att: 3 },
  { id: 'AM', label: 'Attacker Major Success', att: 2 },
  { id: 'AS', label: 'Attacker Success', att: 1 },
  { id: 'DR', label: 'Draw', att: 0 },
  { id: 'DS', label: 'Defender Success', att: -1 },
  { id: 'DM', label: 'Defender Major Success', att: -2 },
];
// Player Aid VII (Land Battle Table) lives in data_aids.js (lbLookup). Option manualLandBattle asks instead.

function homeportOfZone(s, side, z) {
  if (z === homeZone(side)) return 'home';
  if (z === TEMP_HOMEPORT_ZONE[side] && usingTempHomeport(s, side)) return 'temp';
  return null;
}

// Cutting-Out targets: enemy ships in the Deployable or Make Ready areas of the Homeport in that zone [OA2]
function cuttingOutTargets(s, side, z) {
  const other = OTHER[side], port = homeportOfZone(s, other, z);
  return port ? sideShips(s, other).filter(sh => (sh.box === 'deployable' || sh.box === 'makeReady') && sh.port === port) : [];
}

PROCS.coastal = {
  start(s, f) {
    s.phase = 'coastal'; s.stepLabel = 'E Coastal Action Phase';
    f.L.order = [s.ai, s.human];   // A.I. side's missions first (E1-E3), then yours (E4-E6)
    f.L.si = 0;
    return G('side');
  },
  side(s, f) {
    const side = f.L.order[f.L.si];
    if (!side) return R();
    f.L.side = side;
    f.L.cut = Object.values(s.forces).filter(fr => fr.side === side && fr.mission === 'CuttingOut' && fr.ships.length).map(fr => fr.id);
    f.L.raids = Object.values(s.forces).filter(fr => fr.side === side && fr.mission === 'Raid' && fr.ships.length && RAID_ZONES[side].indexOf(fr.zone) >= 0).map(fr => fr.id);
    f.L.as = Object.values(s.forces).filter(fr => fr.side === side && fr.mission === 'ArmySupport' && fr.ships.length && fr.troops > 0).map(fr => fr.id);
    return G('cut');
  },
  /* E1/E4 Cutting-Out ----------------------------------------------------------------- */
  cut(s, f) {
    const fid = f.L.cut.shift();
    if (!fid) return G('raid');
    const fr = s.forces[fid], side = f.L.side, other = OTHER[side];
    if (!fr || !fr.ships.length) return G('cut');
    const port = homeportOfZone(s, other, fr.zone);
    const targets = cuttingOutTargets(s, side, fr.zone);
    let txt;
    if (fr.ended) txt = 'The Force has an Encounter Ended marker – the Cutting-Out mission aborts.';
    else if (!targets.length) txt = 'No enemy ships in the Deployable or Make Ready areas – the mission aborts.';
    else {
      const r = d10(s);
      const row = CUTTING_OUT.find(x => r >= x.lo && r <= x.hi);
      txt = `Cutting-Out Table: d10 ${r} → ${row.title} ${row.text}`;
      if (row.key === 'repulsed') s.coastal.cutouts.push({ side, result: 'repulsed' });
      if (row.key === 'success') {
        const tgt = targets.sort((a, b) => vpCapture(b) - vpCapture(a))[0];
        captureShip(s, tgt.id, side, 'Cutting-Out');
        tgt.box = 'lake'; tgt.zone = fr.zone; addShipToForce(s, tgt.id, fr.id);
        txt += ` ${def(tgt).name} is cut out and joins the ${SIDE_SHORT[side]} Force!`;
      }
    }
    log(s, `${SIDE_SHORT[side]} Cutting-Out in ${ZONE_NAME[fr.zone]}: ${txt}`, 'coastal');
    return P(info(`${SIDE_NAME[side]} Cutting-Out mission`, txt), 'cut');
  },
  /* E2/E5 Raids ----------------------------------------------------------------------------- */
  raid(s, f) {
    const fid = f.L.raids.shift();
    if (!fid) return G('as');
    const fr = s.forces[fid], side = f.L.side;
    if (!fr || !fr.ships.length) return G('raid');
    const ev = drawEvent(s, `${SIDE_SHORT[side]} Raid on ${ZONE_NAME[fr.zone]} coastline`, false);
    const lines = [`Coastal Event #${ev.id}: ${EVENT_TITLE[ev.coastal]}${ev.coastal !== 'none' ? ' – ' + EVENT_TEXT[ev.coastal]() : ''}`];
    const evs = [];
    if (['localMilitia', 'suppliesBurned', 'suppliesMoved', 'suddenStorm'].indexOf(ev.coastal) >= 0) evs.push(ev.coastal);
    if (ev.coastal === 'intelligence') grantIntelligence(s, side, ev.id, lines);
    const ok = fr.ships.length && forceShips(s, fr).some(isFull);
    if (ok) {
      s.coastal.raids.push({ side, zone: fr.zone, forceId: fid, guns: sumBy(forceShips(s, fr), guns), events: evs });
      lines.push(`The Raid marker is placed on the ${ZONE_NAME[fr.zone]} coastline (VPs and supplies in the Tally Phase).`);
    } else lines.push('The Force has no undamaged ship – no Raid.');
    lines.forEach(l => log(s, `${SIDE_SHORT[side]} Raid (${ZONE_NAME[fr.zone]}): ${l}`, 'coastal'));
    return P(info(`${SIDE_NAME[side]} Raid on ${ZONE_NAME[fr.zone]}`, lines.join('\n'), { eventCard: ev.id }), 'raid');
  },
  /* E3/E6 Army Support -------------------------------------------------------------------- */
  as(s, f) {
    const side = f.L.side, other = OTHER[side];
    // E3.1 Launch Troops from Forces with at least one undamaged ship in a legal zone
    const zonesLaunch = {};
    f.L.as.forEach(fid => {
      const fr = s.forces[fid];
      if (!fr || !fr.ships.length || !fr.troops) return;
      const legal = fr.zone === 'NIA' || homeportOfZone(s, other, fr.zone);
      if (!legal || !forceShips(s, fr).some(isFull)) return;
      zonesLaunch[fr.zone] = zonesLaunch[fr.zone] || [];
      zonesLaunch[fr.zone].push(fid);
    });
    f.L.lz = Object.keys(zonesLaunch).map(z => ({ z, forces: zonesLaunch[z] }));
    f.L.as = [];
    return G('asZone');
  },
  asZone(s, f) {
    const item = f.L.lz.shift();
    if (!item) { f.L.si++; return G('side'); }
    const side = f.L.side, other = OTHER[side];
    f.L.cur = item;
    let troops = 0;
    item.forces.forEach(fid => { const fr = s.forces[fid]; troops += fr.troops; fr.launched = fr.troops; fr.troops = 0; });
    f.L.troops = troops;
    log(s, `${SIDE_SHORT[side]} Troops launched in ${ZONE_NAME[item.z]}: ${troops}.`, 'coastal');
    const port = homeportOfZone(s, other, item.z);
    if (port) {
      const defenders = harborDefendingShips(s, other, port);
      if (defenders.length) return C('harbor', { zone: item.z, att: side, forces: item.forces, port }, 'asBattle');
    }
    return G('asBattle');
  },
  asBattle(s, f) {
    const side = f.L.side, other = OTHER[side], item = f.L.cur;
    const ships = item.forces.reduce((a, fid) => a.concat(s.forces[fid] ? s.forces[fid].ships : []), []);
    const target = item.z === 'NIA' ? 'NIA' : 'HOME';
    const ev = drawEvent(s, `${SIDE_SHORT[side]} Land Battle (${ZONE_NAME[item.z]})`, false);
    const lines = [`Coastal Event #${ev.id}: ${EVENT_TITLE[ev.coastal]}${ev.coastal !== 'none' ? ' – ' + EVENT_TEXT[ev.coastal]() : ''}`];
    let shift = 0, storm = false;
    if (ev.coastal === 'moreDefenders') shift -= 2;
    if (ev.coastal === 'suddenStorm') storm = true;
    if (ev.coastal === 'intelligence') grantIntelligence(s, side, ev.id, lines);
    let support = ships.slice();
    if (ev.coastal === 'heatedShot' && support.length) {
      const id = pick(s, support); s.ships[id].flags.heatedShot = true;
      lines.push(`Heated Shot: ${shipName(s, id)} is Damaged – no Long Guns in this battle; to In Ordinary in F7.`);
    }
    if (ev.coastal === 'explosion' && support.length) {
      const id = pick(s, support);
      lines.push(`Explosion! ${shipName(s, id)} blows up${s.flagship[side] === id ? ' – the Leader is killed' : ''}.`);
      sinkShip(s, id, other, 'Explosion', 'killed');
    }
    if (ev.coastal === 'requisition' && support.length) {
      const alive = support.filter(id => s.ships[id].box === 'lake');
      if (alive.length) {
        const minG = Math.min(...alive.map(id => guns(s.ships[id])));
        const id = pick(s, alive.filter(x => guns(s.ships[x]) === minG));
        s.ships[id].flags.requisition = true;
        lines.push(`Requisition: ${shipName(s, id)} is taken by the Army – out of play next turn.`);
      }
    }
    const sup = ships.map(id => s.ships[id]).filter(sh => sh.box === 'lake' && isFull(sh) && !sh.flags.heatedShot);
    const lgTot = sumBy(sup, lg);
    const r = d66(s);
    f.L.lb = { side, zone: item.z, target, troops: f.L.troops, lg: lgTot, shift, storm, roll: r.v, ev: ev.id };
    lines.push(`Land Battle vs ${target === 'NIA' ? 'the Niagara Front' : (other === 'US' ? HOMEPORT_NAME.US : HOMEPORT_NAME.BR)}: ${f.L.troops} Troops marker(s), supporting Long Gun Strength ${lgTot}${shift ? `, column shift ${shift}` : ''}. Dice (red/blue) 11-66: ${r.v}.`);
    lines.forEach(l => log(s, l, 'coastal'));
    f.L.lbLines = lines;
    const lk = lbLookup(lgTot, f.L.troops, shift, r.v);
    const lkTxt = `Land Battle Table: column “${lk.colLabel}”${lk.band !== lk.band0 ? ` (shifted from ${LB_BANDS[lk.band0]})` : ''}${f.L.troops > 3 ? ' (3 Troops is the highest column)' : ''}, roll ${r.v}.`;
    f.L.lbLines.push(lkTxt); log(s, lkTxt, 'roll');
    if (!s.options.manualLandBattle) {
      f.answer = lk.result;
      return G('asResult');
    }
    return P(choice(`Land Battle – read Player Aid VII`, lines.join('\n') + `\n\nOn Player Aid VII, use column “${lk.colLabel}” with ${Math.min(f.L.troops, 3)} Troops marker(s), row ${r.v}. Select the result:`,
      LB_RESULTS.map(x => ({ id: x.id, label: x.label })), { landBattle: f.L.lb }), 'asResult');
  },
  asResult(s, f) {
    const lb = f.L.lb;
    let res = f.answer;
    if (lb.storm && res === 'AM') { res = 'AS'; log(s, 'Sudden Storm: Attacker Major Success reduced to Success.', 'event'); }
    lb.result = res;
    s.coastal.battles.push(lb);
    const lbl = LB_RESULTS.find(x => x.id === res).label;
    log(s, `${SIDE_SHORT[lb.side]} Land Battle result: ${lbl}.`, 'coastal');
    return P(info('Land Battle result', `${f.L.lbLines.join('\n')}\nResult: ${lbl}${lb.storm && f.answer === 'AM' ? ' (Sudden Storm)' : ''}. Effects apply in the Tally & Reset Phase.`), 'asZone');
  },
};

function grantIntelligence(s, side, cardId, lines) {
  s.intelligence[side] = { card: cardId, until: s.turn + 1 };
  s.deck.event = s.deck.event.filter(x => x !== cardId);
  lines.push(`Intelligence: next turn only, the ${SIDE_PL[side]} get +1 DRM on Reaction Checks (and no negative DRMs) in the first Encounter involving the enemy Flagship. That Encounter uses up Intelligence even if no Reaction Checks occur; unused Intelligence expires at the end of that turn.`);
}

/* Harbor Encounter (12): up to two Gunnery Rounds, no Weather Gage / Tactics,
   −1 column shift, no Disengagement or Withdrawal. */
function harborDefendingShips(s, side, port) {
  return sideShips(s, side).filter(sh => (sh.box === 'deployable' || sh.box === 'transit') && sh.port === port &&
    !(side === 'BR' && s.ai === 'BR' && isCLS(sh)));
}
PROCS.harbor = {
  start(s, f) {
    const A = f.A, att = A.att, dfs = OTHER[att];
    s.encounter = { zone: A.zone, kind: 'harbor', segment: 'patrol', ships: {}, side: {}, struckBy: {}, withdrawn: { US: false, BR: false }, harborDefender: dfs, wgCard: null, leaderFate: {} };
    const attShips = A.forces.reduce((a, fid) => a.concat(s.forces[fid] ? s.forces[fid].ships : []), []);
    const defShips = harborDefendingShips(s, dfs, A.port).map(sh => sh.id);
    attShips.forEach(id => encAdd(s, id)); defShips.forEach(id => encAdd(s, id));
    s.combat = { att, def: dfs, seq: att === 'US' ? 'A' : 'B', pos: 0, col: { US: [], BR: [] }, tows: {}, tac: { att: null, def: null }, gr: 0 };
    let atts = attShips.filter(id => isFull(s.ships[id]));
    if (att === 'BR' && s.ai === 'BR') atts = atts.filter(id => !isCLS(s.ships[id]));
    let defs = defShips.slice();
    if (dfs === 'BR' && s.ai === 'BR') defs = defs.filter(id => !isCLS(s.ships[id]));
    s.combat.col[att] = buildColumn(s, atts, {}, att);
    s.combat.col[dfs] = buildColumn(s, defs, {}, dfs);
    f.L.round = 0;
    const txt = `HARBOR ENCOUNTER at ${A.port === 'home' ? HOMEPORT_NAME[dfs] : TEMP_HOMEPORT_NAME[dfs]}: ${s.combat.col[att].map(id => shipName(s, id)).join(', ')} must fight the ships in port: ${s.combat.col[dfs].map(id => shipName(s, id)).join(', ')}. (Up to two Gunnery Rounds, −1 column for shore batteries, no Disengagement or Withdrawal.)`;
    log(s, txt, 'combat');
    s.stepLabel = 'E Harbor Encounter';
    return P(info('Harbor Encounter', txt, { combatView: true }), 'round');
  },
  round(s, f) {
    const c = s.combat, e = s.encounter;
    tidyColumns(s);
    let atts = colShips(c, c.att).filter(id => isFull(s.ships[id]));
    let defs = colShips(c, c.def);
    if (f.L.round >= 2 || !atts.length || !defs.length) return G('end');
    f.L.round++;
    const eventLines = [], zf = zoneFlags(s);
    // Rule 12 changes the sequence, not the scope of pending Lake Zone Events.
    // Missed Signal applies to the first Round the selected ship could join;
    // retain the original columns so the ship can return for Round 2.
    const ms = f.L.round === 1 ? missedSignalShip(s) : null;
    const sitsOut = ms && (atts.indexOf(ms) >= 0 || defs.indexOf(ms) >= 0) ? ms : null;
    if (sitsOut) {
      zf.missedSignalUsed = true;
      atts = atts.filter(id => id !== sitsOut); defs = defs.filter(id => id !== sitsOut);
      eventLines.push(`Missed Signal: ${shipName(s, sitsOut)} sits out Harbor Gunnery Round 1.`);
    }
    if (!atts.length || !defs.length) {
      eventLines.push('No opposing eligible ships remain in this Round — skip Gunnery Round 1. The ship returns for Round 2.');
      eventLines.forEach(l => log(s, l, 'combat'));
      return P(info('Harbor Encounter', eventLines.join('\n'), { combatView: true }), 'round');
    }
    const noLG = f.L.round === 1 && hazeActive(s);
    if (noLG) { zf.hazeUsed = true; eventLines.push('Haze: no Long Guns in Harbor Gunnery Round 1; the Haze now burns off.'); }
    const aStr = sideStrength(s, atts, c.att, noLG), dStr = sideStrength(s, defs, c.att, noLG);
    const ratio = dStr <= 0 ? 99 : aStr / dStr;
    let col = Math.max(0, crtColumnForRatio(ratio) - 1);
    let drm = 0; const drms = [];
    if (atts.indexOf(s.flagship[c.att]) >= 0 && commandDRMAvailable(s, c.att)) { drm++; drms.push('+1 Command'); }
    const r = d10(s), m = Math.max(0, Math.min(9, r + drm));
    const code = CRT[m][col];
    const res = parseCrt(code);
    const lines = eventLines.concat(`Harbor Gunnery Round ${f.L.round}: ${SIDE_SHORT[c.att]} ${fmt(aStr)} vs ${fmt(dStr)} = ${dStr <= 0 ? '∞' : fmt(ratio)}:1, −1 shore batteries → ${CRT_COLS[col]}; d10 ${r}${drm ? '+' + drm : ''} → ${code}${drms.length ? ' [' + drms.join(', ') + ']' : ''}. (W results ignored.)`);
    const dMap = {}, aMap = {};
    if (res.dHits) distributeHits(s, defs, res.dHits, dMap, lines, { side: c.def });
    if (res.aHits) distributeHits(s, c.col[c.att].filter(id => id !== sitsOut), res.aHits, aMap, lines, { side: c.att });
    applyHits(s, c.def, dMap, { round: 'GR' }, lines);
    applyHits(s, c.att, aMap, { round: 'GR' }, lines);
    lines.forEach(l => log(s, l, 'combat'));
    if (res.end) { lines.push('END – the Harbor Encounter ends.'); f.L.round = 2; }
    return P(info('Harbor Encounter', lines.join('\n'), { combatView: true }), 'round');
  },
  end(s, f) {
    const e = s.encounter, c = s.combat;
    const lines = [];
    Object.keys(e.ships).forEach(id => {
      const st = e.ships[id], sh = s.ships[id];
      if (st === 'struck') { captureShip(s, id, e.harborDefender, 'Struck Colors in a Harbor Encounter', false, (e.leaderFate || {})[id]); lines.push(`${def(sh).name} strikes and is captured by the defenders.`); }
      if (st === 'hstruck') { lines.push(`${shipName(s, id)} struck her colors in her own harbor – not captured.`); }
      if (sh && sh.owner === e.harborDefender && sh.box === 'deployable' && isReduced(sh)) sh.box = 'transit';
    });
    endEncounterEffects(s);
    s.encounter = null; s.combat = null;
    lines.forEach(l => log(s, l, 'combat'));
    return lines.length ? P(info('Harbor Encounter ends', lines.join('\n')), '__done') : R();
  },
  __done(s, f) { return R(); },
};
