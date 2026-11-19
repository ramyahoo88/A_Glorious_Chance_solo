/* Campaign map: public positions and the recorded action, with no simulation
   during rendering. The shoreline and zone divisions are schematic. */
const MAP_POINTS = {
  YOR: [185, 240], NOR: [485, 235], KIN: [790, 205],
  NIA: [185, 435], SOU: [485, 430], SAC: [790, 425],
  HOME_BR: [850, 65], HOME_US: [850, 575],
  TEMP_BR: [175, 65], TEMP_US: [485, 575],
  ESC_BR: [150, 535], ESC_US: [150, 590]
};
function mapSvg(tag, attrs, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
  for (const child of children.flat()) if (child != null) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
function recordedMapAction(s) {
  const r = s.tableReport?.map;
  if (!r || typeof r.title !== 'string' || !Array.isArray(r.moves)) return null;
  // A damaged optional display report must not prevent opening a campaign.
  return { title: r.title, turn: Number.isInteger(r.turn) ? r.turn : s.turn,
    moves: r.moves.filter(m => m && ['US', 'BR'].includes(m.side) && m.from && m.to &&
      typeof m.from.label === 'string' && typeof m.to.label === 'string' &&
      [m.from.place, m.to.place].every(p => p == null || (typeof p === 'string' && Object.hasOwn(MAP_POINTS, p))) &&
      Array.isArray(m.ships) && m.ships.length && m.ships.every(id => typeof id === 'string' && Object.hasOwn(s.ships, id))) };
}
function mapMoveText(s, move, index) {
  const side = SIDE_SHORT[move.side] + (move.side === s.ai ? ' A.I.' : ' (you)');
  const mission = MISSION_NAME[move.mission];
  return `${index + 1}. ${side}${move.captured ? ' · captured' : ''}: ${move.from.label} → ${move.to.label}` +
    (mission ? ' · ' + mission : '') + ' · ' + move.ships.map(id => shipName(s, id)).join(', ');
}
function mapZoneShips(s, z, side) {
  return Object.values(s.ships).filter(sh => ['lake', 'coast'].includes(sh.box) && sh.zone === z && sh.owner === side);
}
function mapPortShips(s, place) {
  return Object.values(s.ships).filter(sh => mapShipPosition(s, sh).place === place);
}
function openMapZone(s, z) {
  const body = el('div', { class: 'map-zone-details' }, el('h2', null, ZONE_NAME[z]), zoneView(s, z));
  const beached = Object.values(s.ships).filter(sh => sh.box === 'coast' && sh.zone === z);
  if (beached.length) body.appendChild(el('h3', null, 'Beached'), el('div', { class: 'ships' }, ...beached.map(sh => shipChip(s, sh.id))));
  openModal(body);
}
function openMapPort(s, place, label) {
  const ships = mapPortShips(s, place), body = el('div', null, el('h2', null, label));
  if (!ships.length) body.appendChild(el('p', null, 'No ships here.'));
  for (const box of BOXES) {
    const group = ships.filter(sh => sh.box === box);
    if (group.length) body.appendChild(el('h3', null, BOX_NAME[box]), el('div', { class: 'ships' }, ...group.map(sh => shipChip(s, sh.id))));
  }
  openModal(body);
}
function campaignMap(s, scope = 'board') {
  const wrap = el('div', { class: 'campaign-map' }), action = recordedMapAction(s);
  const head = el('div', { class: 'map-toolbar' },
    el('span', { class: 'map-key us' }, `● U.S.${s.ai === 'US' ? ' A.I.' : ' (you)'}`),
    el('span', { class: 'map-key br' }, `■ British${s.ai === 'BR' ? ' A.I.' : ' (you)'}`));
  if (scope === 'board') head.appendChild(el('button', { type: 'button', class: 'small', disabled: !action,
    onclick: () => openCampaignMap(s, true) }, 'Show last action'));
  wrap.appendChild(head);
  wrap.appendChild(el('p', { class: 'map-help muted' }, 'Tap a fleet or port to inspect its ships. Numbered arrows show moves in the last action.'));
  const stage = el('div', { class: 'map-stage', role: 'group', 'aria-label': 'Lake Ontario campaign map' });
  const svg = mapSvg('svg', { viewBox: '0 0 1000 640', preserveAspectRatio: 'none', class: 'map-water', 'aria-hidden': 'true' });
  const shore = 'M70 310 C62 230 130 174 250 160 C390 145 515 170 635 128 C740 90 818 108 870 134 L932 190 L913 285 L940 332 L886 387 C798 420 720 452 603 476 C420 506 255 520 159 473 C104 444 76 375 70 310Z';
  const defs = mapSvg('defs', null,
    mapSvg('clipPath', { id: 'lake-clip-' + scope }, mapSvg('path', { d: shore })));
  for (const side of ['US', 'BR']) defs.appendChild(mapSvg('marker', { id: 'map-arrow-' + side + '-' + scope,
    viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
    mapSvg('path', { d: 'M0 0 L10 5 L0 10Z', fill: side === 'US' ? '#2f5f9e' : '#a8322d' })));
  svg.appendChild(defs);
  svg.appendChild(mapSvg('rect', { width: 1000, height: 640, fill: '#ebe5ce' }));
  svg.appendChild(mapSvg('path', { d: shore, fill: '#cee5ed', stroke: '#608e9c', 'stroke-width': 3 }));
  const water = mapSvg('g', { 'clip-path': 'url(#lake-clip-' + scope + ')' });
  water.appendChild(mapSvg('path', { d: 'M340 100 L340 530 M650 90 L650 530 M40 335 L965 300', fill: 'none', stroke: '#749eac', 'stroke-width': 2, 'stroke-dasharray': '8 8' }));
  svg.appendChild(water);
  for (const [text, x, y] of [['UPPER CANADA', 470, 70], ['NEW YORK', 640, 555], ['LAKE ONTARIO', 490, 330]])
    svg.appendChild(mapSvg('text', { x, y, 'text-anchor': 'middle', class: 'map-geography' }, text));
  svg.appendChild(mapSvg('path', { d: 'M955 90 L955 40 M945 55 L955 40 L965 55', fill: 'none', stroke: '#526d70', 'stroke-width': 3 }));
  svg.appendChild(mapSvg('text', { x: 955, y: 28, 'text-anchor': 'middle', class: 'map-geography' }, 'N'));
  const touched = new Set(), badges = [];
  (action?.moves || []).forEach((move, i) => {
    const a = MAP_POINTS[move.from.place], b = MAP_POINTS[move.to.place];
    if (a) touched.add(move.from.place); if (b) touched.add(move.to.place);
    if (!a || !b || move.from.place === move.to.place) return;
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const halfHeight = place => ZONES.includes(place) ? 40 + ['US', 'BR'].filter(sd => mapZoneShips(s, place, sd).length).length * 26 : 32;
    const edge = (p, place, sign) => {
      const fraction = Math.min(dx ? 142 / Math.abs(dx) : Infinity, dy ? halfHeight(place) / Math.abs(dy) : Infinity);
      return [p[0] + sign * dx * fraction, p[1] + sign * dy * fraction];
    };
    let start, end, mid;
    if (ZONES.includes(move.from.place) && ZONES.includes(move.to.place) && Math.abs(dy) < 60) {
      // Sail around the fleet labels, keeping the route and arrowhead visible.
      const direction = a[1] < 320 ? 1 : -1;
      start = [a[0], a[1] + direction * halfHeight(move.from.place)];
      end = [b[0], b[1] + direction * halfHeight(move.to.place)];
      mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + direction * (180 + i % 3 * 16)];
    } else {
      start = edge(a, move.from.place, 1); end = edge(b, move.to.place, -1);
      const bend = (i % 3 - 1) * 28;
      mid = [(start[0] + end[0]) / 2 - dy / length * bend, (start[1] + end[1]) / 2 + dx / length * bend];
    }
    svg.appendChild(mapSvg('path', { d: `M${start} Q${mid} ${end}`, class: 'map-route ' + move.side,
      'data-move': i + 1, fill: 'none', stroke: move.side === 'US' ? '#2f5f9e' : '#a8322d',
      'stroke-width': 5, 'stroke-dasharray': move.side === 'US' ? '10 5' : 'none', 'marker-end': `url(#map-arrow-${move.side}-${scope})` }));
    const label = [start[0] / 4 + mid[0] / 2 + end[0] / 4, start[1] / 4 + mid[1] / 2 + end[1] / 4];
    badges.push(el('span', { class: 'map-route-badge', 'aria-hidden': 'true',
      style: { left: label[0] / 10 + '%', top: label[1] / 6.4 + '%' } }, String(i + 1)));
  });
  stage.appendChild(svg);
  badges.forEach(badge => stage.appendChild(badge));
  const position = (node, place) => {
    const [x, y] = MAP_POINTS[place]; node.style.left = x / 10 + '%'; node.style.top = y / 6.4 + '%';
    if (touched.has(place)) node.classList.add('map-moved');
    node.setAttribute('data-place', place); return node;
  };
  for (const z of ZONES) {
    const zone = s.zones[z], encounter = s.encounter?.zone === z;
    const node = el('div', { class: `map-zone${encounter ? ' map-encounter' : ''}${zone.control ? ' map-control-' + zone.control : ''}` });
    node.appendChild(el('button', { type: 'button', class: 'map-zone-name', onclick: () => openMapZone(s, z), 'aria-label': 'Inspect ' + ZONE_NAME[z] + ' zone' }, ZONE_NAME[z]));
    let fleets = 0;
    for (const side of ['US', 'BR']) {
      const ships = mapZoneShips(s, z, side); if (!ships.length) continue; fleets++;
      const missions = [...new Set(ships.map(sh => s.forces[sh.forceId]?.mission).filter(Boolean))].map(m => MISSION_NAME[m] || m);
      const name = SIDE_SHORT[side] + (side === s.ai ? ' A.I.' : '');
      const count = `${ships.length} ship${ships.length === 1 ? '' : 's'}`;
      node.appendChild(el('button', { type: 'button', class: 'map-fleet ' + side, onclick: () => openMapZone(s, z),
        'aria-label': `${name}: ${count} in ${ZONE_NAME[z]}${missions.length ? ' · ' + missions.join(', ') : ''}`,
        title: ships.map(sh => shipName(s, sh.id)).join(', ') },
        el('strong', null, `${side === 'US' ? '●' : '■'} ${name} · ${ships.length}`),
        el('span', { class: 'map-missions' }, missions.join(' · ') || 'Beached')));
    }
    if (!fleets) node.appendChild(el('span', { class: 'map-empty' }, 'No ships'));
    if (zone.blockade) node.appendChild(el('span', { class: 'map-zone-note' }, SIDE_SHORT[zone.blockade] + ' Blockade'));
    if (zone.control) node.appendChild(el('span', { class: 'map-zone-note' }, SIDE_SHORT[zone.control] + ' control'));
    if (encounter) node.appendChild(el('span', { class: 'map-zone-note' }, 'Encounter'));
    for (const side of ['US', 'BR']) if (s.convoyDeployed[side]?.zone === z)
      node.appendChild(el('span', { class: 'map-zone-note' }, SIDE_SHORT[side] + ' Convoy'));
    stage.appendChild(position(node, z));
  }
  for (const side of ['BR', 'US']) for (const kind of ['HOME', 'TEMP', 'ESC']) {
    const place = kind + '_' + side, ships = mapPortShips(s, place);
    if (kind === 'ESC' && !ships.length && !touched.has(place)) continue;
    const label = kind === 'HOME' ? HOMEPORT_NAME[side] : kind === 'TEMP' ? TEMP_HOMEPORT_NAME[side] : SIDE_SHORT[side] + ' Escort box';
    const ready = ships.filter(sh => sh.box === 'deployable').length;
    const node = el('button', { type: 'button', class: 'map-port ' + side + (kind === 'ESC' ? ' map-escort' : ''),
      onclick: () => openMapPort(s, place, label), 'aria-label': `Inspect ${label}: ${ships.length} ships${kind === 'ESC' ? '' : ', ' + ready + ' Deployable'}` },
      el('strong', null, (kind === 'ESC' ? '⚑ ' : '⚓ ') + label),
      el('span', null, `${ships.length} ship${ships.length === 1 ? '' : 's'}${kind === 'ESC' ? '' : ' · ' + ready + ' Deployable'}`));
    stage.appendChild(position(node, place));
  }
  wrap.appendChild(stage);
  wrap.appendChild(el('div', { class: 'map-caption muted' }, 'Schematic map · dashed blue routes: U.S. · solid red routes: British · gold outline: changed in the last action. Port totals include ships preparing, repairing and in transit.'));
  const summary = el('div', { class: 'map-action-summary', role: 'status' });
  summary.appendChild(el('strong', null, action ? `Last action · ${TURN_NAMES[Math.min(7, action.turn)]} · ${action.title}` : 'Movement appears after your next action.'));
  if (action) {
    if (!action.moves.length) summary.appendChild(el('div', null, 'No ship movement in this action.'));
    else summary.appendChild(el('ol', null, ...action.moves.map((m, i) => el('li', null, mapMoveText(s, m, i).replace(/^\d+\. /, '')))));
  }
  wrap.appendChild(summary);
  return wrap;
}
function openCampaignMap(s, lastAction = false) {
  const body = el('div', { class: 'map-dialog' }, el('h2', null, lastAction ? 'Last action' : 'Campaign map'), campaignMap(s, 'dialog'));
  if (lastAction) appendTableReport(body, s);
  openModal(body);
}
