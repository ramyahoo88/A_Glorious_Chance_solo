/* The tabletop recap uses only information already visible on the board.
   Keep the report beside its position so reload and Undo restore it together. */
const TABLE_PAUSE_LABEL = 'Show individual Target Card, Encounter check, deployment and convoy notices';
const TABLE_GROUP_LABEL = 'Group routine updates between decisions and play a sole legal Tactic automatically';

function publicBoard(s) {
  const board = new Map();
  const mark = (label, value) => board.set(label, String(value));
  mark('Turn', TURN_NAMES[Math.min(7, s.turn)]);
  mark('Naval Balance', s.nb);
  mark('Niagara Front', NIAGARA_SPACES[s.niagara]);
  for (const side of ['US', 'BR']) {
    const name = SIDE_SHORT[side];
    mark(name + ' VP', sgn(side === 'US' ? s.vp.US : -s.vp.BR));
    mark(name + ' Convoy Supply', s.supply[side]);
    mark(name + ' Construction Delay', s.cd[side]);
    if (s.flagship[side]) mark(name + ' Flagship', shipName(s, s.flagship[side]));
    mark(name + ' commander', leaderName(s, side) + (s.leader[side].wounded ? ' (wounded)' : ''));
    mark(name + ' Convoy on lake', s.convoyDeployed[side] ? ZONE_NAME[s.convoyDeployed[side].zone] : 'off map');
    for (const [turn, convoy] of Object.entries(s.convoys[side])) {
      if (side === s.ai && !convoy.revealed) continue;
      if (convoy.real || side === s.ai) {
        const result = { S: 'scattered', D: 'destroyed', C: 'captured' }[convoy.result];
        mark(name + ' Convoy marker, ' + TURN_NAMES[turn], result || (convoy.delay ? 'delayed' : convoy.real ? 'Convoy' : 'No Convoy'));
      }
    }
    for (const marker of s.pendingConvoy[side])
      mark(name + ' remaining convoy, ' + TURN_NAMES[marker.turn], marker.status === 'arrived' ? 'Arrived' : 'Delay');
    if (s.intelligence[side]) mark(name + ' Intelligence marker', 'Event #' + s.intelligence[side].card);
    mark(name + ' Troops due back at F7', (s.troopsReturning || {})[side] || 0);
  }
  mark('Your available Troops', s.troops[s.human].available);
  mark('Your Troops on Convoy Supply', s.troops[s.human].track.slice().sort((a, b) => a - b).join(', ') || 'none');
  mark('A.I. Troops in Available', aiTroopsInBox(s) + ' revealed, ' + s.aiTroops.box.filter(m => !m.revealed).length + ' face down');
  mark('A.I. markers on Convoy Supply', s.aiTroops.track.map(m => m.space).sort((a, b) => a - b).join(', ') || 'none');
  for (const z of ZONES) {
    const zone = s.zones[z];
    mark(ZONE_NAME[z] + ' control', SIDE_SHORT[zone.control] || 'none');
    mark(ZONE_NAME[z] + ' blockade', SIDE_SHORT[zone.blockade] || 'none');
    if (zone.event) mark(ZONE_NAME[z] + ' Event', '#' + zone.event + ' ' + EVENT_TITLE[EVENTS[zone.event].lake]);
  }
  for (const raid of s.coastal.raids) mark(SIDE_SHORT[raid.side] + ' Raid marker in ' + ZONE_NAME[raid.zone], 'placed');
  for (const battle of s.coastal.battles) mark(SIDE_SHORT[battle.side] + ' Land Battle at ' + ZONE_NAME[battle.zone],
    LB_RESULTS.find(r => r.id === battle.result).label);
  s.targetRow.forEach((slot, index) => {
    if (slot.removed) return;
    const card = TARGET_CARDS[slot.id];
    mark('Target Card ' + (index + 1), ZONE_NAME[card.zone] + (slot.revealed ? ' · ' + card.id + ' ' + MISSION_NAME[card.mission] : ' · face down'));
  });
  for (const pe of s.pe) {
    if (pe.status === 'possible' || pe.status === 'encounter')
      mark('PE' + pe.num, ZONE_NAME[pe.zone] + ' · ' + pe.forceId + (pe.status === 'encounter' ? ' · Encounter' : ''));
  }
  for (const f of Object.values(s.forces)) {
    if (f.troops) mark('Troops on ' + f.id, f.troops + ' · ' + ZONE_NAME[f.zone]);
    if (f.ended) mark('Encounter Ended on ' + f.id, ZONE_NAME[f.zone]);
  }
  for (const sh of Object.values(s.ships)) {
    const f = s.forces[sh.forceId];
    const pos = sh.box === 'lake' ? ZONE_NAME[sh.zone] + (f ? ' · ' + MISSION_NAME[f.mission] + ' ' + f.id : '')
      : BOX_NAME[sh.box] + (sh.port === 'temp' ? ' · ' + TEMP_HOMEPORT_NAME[sh.owner] : '');
    const face = sh.ver ? ' ' + sh.ver : '';
    mark(def(sh).name, SIDE_SHORT[sh.owner] + face + ' · ' + pos + ' · ' + sh.steps + (sh.steps === 1 ? ' step' : ' steps') +
      (sh.isolated ? ' · Isolated' : '') + (sh.delay ? ' · repair delay ' + sh.delay : ''));
  }
  return board;
}

function routineAnswer(s) {
  const p = s.prompt, f = topFrame(s);
  if (!p || !f || s.over) return null;
  if (p.kind === 'choice' && p.tactic) {
    const legal = p.options.filter(o => !o.disabled);
    return legal.length === 1 ? { answer: legal[0].id, title: p.title, text: legal[0].label } : null;
  }
  if (p.kind !== 'info') return null;
  const routine = (f.proc === 'turn' && ['B1', 'B2', 'C4'].includes(f.pc)) ||
    (f.proc === 'aiDeploy' && f.A.phase === 'enemy' && f.pc === 'done') ||
    (f.proc === 'tally' && ['reset', '__ret'].includes(f.pc));
  return routine ? { answer: 'ok', title: p.title, text: p.text } : null;
}

// Public ship positions, independent of cards, hidden markers and future orders.
// Port boxes stay explicit: In Transit does not mean the ship is Deployable.
function mapShipPosition(s, sh) {
  const mission = s.forces[sh.forceId]?.mission || '';
  let place = null, label = BOX_NAME[sh.box] || sh.box;
  if ((sh.box === 'lake' || sh.box === 'coast') && ZONES.includes(sh.zone)) {
    place = sh.zone; label = ZONE_NAME[sh.zone] + (sh.box === 'coast' ? ' · Beached' : '');
  } else if (sh.box === 'escortBox') {
    place = 'ESC_' + sh.owner; label = SIDE_SHORT[sh.owner] + ' Escort Convoy box';
  } else if (['deployable', 'makeReady', 'repairing', 'construction', 'ordinary', 'transit'].includes(sh.box)) {
    const temp = sh.port === 'temp' && ['deployable', 'transit'].includes(sh.box);
    place = (temp ? 'TEMP_' : 'HOME_') + sh.owner;
    label = (temp ? TEMP_HOMEPORT_NAME[sh.owner] : HOMEPORT_NAME[sh.owner]) + ' · ' + BOX_NAME[sh.box];
  }
  return { place, label, box: sh.box, owner: sh.owner, mission };
}
function mapShipSnapshot(s) {
  return Object.fromEntries(Object.values(s.ships).map(sh => [sh.id, mapShipPosition(s, sh)]));
}
function mapShipChanges(before, s) {
  const groups = new Map();
  for (const sh of Object.values(s.ships)) {
    const from = before[sh.id], to = mapShipPosition(s, sh);
    if (!from || (from.place === to.place && from.box === to.box && from.owner === to.owner && from.mission === to.mission)) continue;
    const mission = to.mission || from.mission;
    const key = JSON.stringify([from, to, mission]);
    if (!groups.has(key)) groups.set(key, { from, to, side: to.owner, mission, captured: from.owner !== to.owner, ships: [] });
    groups.get(key).ships.push(sh.id);
  }
  return [...groups.values()];
}

function playTableAction(s, answer) {
  let before = publicBoard(s);
  const notices = [], changes = [], moves = [];
  const map = { title: s.prompt?.title || 'Action', turn: s.turn, phase: s.phase, moves };
  function advance(value) {
    const positions = mapShipSnapshot(s);
    act(s, value);
    moves.push(...mapShipChanges(positions, s));
    const after = publicBoard(s);
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(key) !== after.get(key))
        changes.push(key + ': ' + (before.get(key) ?? 'off board') + ' → ' + (after.get(key) ?? 'off board'));
    }
    before = after;
  }
  advance(answer);
  while (s.options.groupUpdates) {
    const next = routineAnswer(s);
    if (!next) break;
    if (notices.length >= 128) throw new Error('Could not finish grouping routine reports.');
    notices.push({ title: next.title, text: next.text });
    advance(next.answer);
  }
  // Every action replaces the recap, including an action with no movement.
  // Grouped steps retain each transition rather than only the net displacement.
  s.tableReport = { changes, notices, map };
}

function appendTableReport(container, s) {
  const r = s.tableReport;
  if (!r || !Array.isArray(r.changes) || !Array.isArray(r.notices)) return;
  const count = r.changes.length, grouped = r.notices.length;
  if (!count && !grouped) return;
  const summary = [count && (count + ' board change' + (count === 1 ? '' : 's')),
    grouped && (grouped + ' grouped update' + (grouped === 1 ? '' : 's'))].filter(Boolean).join(' · ');
  const details = el('details', { class: 'table-recap' }, el('summary', null, summary));
  if (count) details.appendChild(el('ul', null, ...r.changes.filter(v => typeof v === 'string').map(v => el('li', null, v))));
  for (const notice of r.notices) {
    if (notice && typeof notice.title === 'string' && typeof notice.text === 'string')
      details.appendChild(el('div', null, el('strong', null, notice.title), el('div', { class: 'ptext' }, notice.text)));
  }
  container.appendChild(details);
}
