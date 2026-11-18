/* ============================================================================
   A7 Assign ships (human) – prompt, validation and application
   ========================================================================== */
function missionZones(s, side) {
  const other = OTHER[side];
  const tempOther = usingTempHomeport(s, other) ? [TEMP_HOMEPORT_ZONE[other]] : [];
  const m = { Patrol: ZONES.slice() };
  if (convoyRunning(s, side)) m.Escort = side === 'US' ? ['SAC'] : ['ESC'];
  m.Raid = RAID_ZONES[side].slice();
  if (s.options.cuttingOut && !s.cuttingOutUsed[side]) m.CuttingOut = [homeZone(other)].concat(tempOther);
  if (s.troops[side].available > 0) m.ArmySupport = ['NIA', homeZone(other)].concat(tempOther);
  return m;
}
function assignableShips(s, side) {
  return deployable(s, side).filter(sh => !(isBlockaded(s, side) && sh.port === 'home'));
}
function buildAssignPrompt(s) {
  const h = s.human;
  const ships = assignableShips(s, h);
  const blockedHome = isBlockaded(s, h) ? deployable(s, h, 'home') : [];
  return {
    kind: 'assign', title: 'A7 Assign your ships', side: h,
    text: `Compose Forces from your Deployable ships and give each a Lake Zone and a Mission. Unassigned ships stay in port (they may React to Encounters and defend Harbor Encounters).` +
      (blockedHome.length ? ` Your Homeport is Blockaded: ${blockedHome.map(sh => shipName(s, sh.id)).join(', ')} cannot be assigned.` : ''),
    ships: ships.map(sh => sh.id),
    missions: missionZones(s, h),
    troops: s.troops[h].available,
    flagship: deployable(s, h).some(sh => sh.id === s.flagship[h]) ? s.flagship[h] : (deployable(s, h)[0] || {}).id || null,
    flagshipOptions: deployable(s, h).map(sh => sh.id),
  };
}
function validateAssignment(s, p, a) {
  if (!a || !Array.isArray(a.forces)) return 'Bad assignment';
  const used = {};
  let troops = 0, raids = {}, asCount = 0, cut = 0;
  for (const fr of a.forces) {
    if (!fr.ships || !fr.ships.length) return 'Every Force needs at least one ship';
    if (!p.missions[fr.mission]) return `Mission ${fr.mission} is not available this turn`;
    if (p.missions[fr.mission].indexOf(fr.zone) < 0) return `${MISSION_NAME[fr.mission]} is not allowed in ${ZONE_NAME[fr.zone] || fr.zone}`;
    for (const id of fr.ships) { if (p.ships.indexOf(id) < 0) return 'Ship not available: ' + id; if (used[id]) return 'A ship is assigned twice'; used[id] = 1; }
    if (fr.mission === 'Raid') { if (raids[fr.zone]) return 'Only one Raid per Lake Zone per turn'; raids[fr.zone] = 1; }
    if (fr.mission === 'CuttingOut') cut++;
    const t = fr.troops || 0;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 0) return 'Troops must be a whole number of markers';
    if (fr.mission === 'ArmySupport') {
      asCount++;
      if (t < 1) return 'An Army Support Force must carry at least one Troops marker';
      if (t > troopCapacity(s, fr.ships)) return 'Not enough Close Action strength: 4 points per Troops marker';
    } else if (t) return 'Only Army Support Forces carry Troops';
    troops += t;
  }
  if (cut > 1) return 'Only one Cutting-Out mission per game';
  if (troops > p.troops) return 'Not enough Troops markers available';
  if (a.flagship && p.flagshipOptions.indexOf(a.flagship) < 0) return 'Flagship must be a Deployable ship';
  if (!a.flagship && p.flagshipOptions.length) return 'Choose a Flagship';
  return null;
}
function applyAssignment(s, a) {
  const h = s.human;
  if (a.flagship && a.flagship !== s.flagship[h]) { s.flagship[h] = a.flagship; log(s, `Your Flagship: ${shipName(s, a.flagship)}.`, 'player'); }
  a.forces.forEach(fr => {
    if (fr.mission === 'Escort' && fr.zone === 'ESC') {
      fr.ships.forEach(id => { s.ships[id].box = 'escortBox'; });
      log(s, `Escort Convoy box: ${fr.ships.map(id => shipName(s, id)).join(', ')}.`, 'player');
      return;
    }
    const f = newForce(s, h, fr.zone, fr.mission, fr.ships, { troops: fr.troops || 0, origin: 'prep' });
    if (fr.mission === 'CuttingOut') s.cuttingOutUsed[h] = true;
    s.troops[h].available -= (fr.troops || 0);
    log(s, `You assign ${forceLabel(s, f)} to ${ZONE_NAME[fr.zone]}.`, 'player');
  });
  if (!a.forces.length) log(s, 'You keep all your ships in port this turn.', 'player');
}

/* Lineup (attacking ships + tows) */
function validateLineup(s, p, a) {
  if (!a || !Array.isArray(a.attackers) || !a.attackers.length) return 'Select at least one attacking ship';
  if (a.attackers.some(id => p.candidates.indexOf(id) < 0)) return 'Invalid attacker';
  const tows = a.tows || {};
  const towed = {};
  for (const t of Object.keys(tows)) {
    const v = tows[t];
    if (a.attackers.indexOf(t) < 0 || a.attackers.indexOf(v) < 0) return 'Towing ships must both be in the attack';
    if (!canTow(s.ships[t])) return `${shipName(s, t)} cannot tow`;
    if (!isCLS(s.ships[v])) return 'Only Converted Laker Schooners are towed';
    if (towed[v]) return 'A schooner can only be towed once';
    towed[v] = 1;
  }
  return null;
}
