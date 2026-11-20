/* Lookups read visible game state and the printed tables. They do not advance play. */
function openShipDetails(s, initial, choices) {
  const body = el('div', { class: 'ref ship-details' }, el('h2', null, 'Ship details'));
  const details = el('div');
  function show(id) {
    const sh = s.ships[id], d = def(sh);
    const force = sh.forceId && s.forces[sh.forceId];
    const location = [BOX_NAME[sh.box], sh.zone && ZONE_NAME[sh.zone], sh.port === 'temp' && 'Temporary Homeport',
      force && MISSION_NAME[force.mission]].filter(Boolean).join(' · ');
    const face = isFull(sh) ? 'Full' : 'Reduced';
    const traits = [d.main ? 'Main ship' : 'Secondary ship', d.cls && 'Converted Laker Schooner',
      d.T && 'Can tow at full strength', d.F && 'Fast at full strength',
      s.flagship[sh.owner] === id && 'Current flagship'].filter(Boolean);
    const table = el('table', null, el('caption', null, 'Printed counter strengths'),
      el('tr', null, ...['Face', 'Long Gun', 'Carronade', 'Close Action', 'Defense'].map(label => el('th', { scope: 'col' }, label))));
    [['Full', d.full], ['Reduced', d.red]].forEach(([name, values]) =>
      table.appendChild(el('tr', null, el('th', { scope: 'row' }, name), ...values.slice(0, 4).map(value => el('td', null, String(value))))));
    details.replaceChildren(el('h3', null, shipName(s, id)), el('p', null, `${SIDE_NAME[sh.owner]} · ${d.type} · ${d.guns} guns`),
      el('p', null, location), el('p', null, `${sh.steps} of ${d.full[4]} steps · ${face} face`), table,
      el('p', null, traits.join(' · ')), el('p', null, `Victory points if destroyed: ${d.vp[0]}. If captured: ${d.vp[1]}.`));
    if (sh.delay) details.appendChild(el('p', null, `Repair delay markers: ${sh.delay}.`));
  }
  if (choices && choices.length > 1) {
    const pick = el('select', null, ...choices.map(id => el('option', { value: id, selected: id === initial }, shipName(s, id))));
    pick.addEventListener('change', () => show(pick.value));
    body.appendChild(el('label', null, 'Ship ', pick));
  }
  const parent = $('modal').classList.contains('open') && $('modal').querySelector('.map-zone-details, .map-port-details');
  show(initial); body.appendChild(details); openModal(body, parent ? {
    backLabel: parent.classList.contains('map-port-details') ? 'Back to port' : 'Back to fleet'
  } : {});
}

function hitDistributionLookup() {
  const picker = el('select', null, ...Object.keys(HIT_DIST).map(n => el('option', { value: n, selected: n === '2' }, n)));
  const result = el('div');
  function show() {
    const n = Number(picker.value);
    const faces = [1, 2, 3, 4, 5, 6];
    const grid = el('table', { class: 'hit-lookup' }, el('caption', null, `Line position hit · ${n} ${n === 1 ? 'ship' : 'ships'}`),
      el('tr', null, el('th', { scope: 'col' }, 'Red ↓ / Blue →'), ...faces.map(blue => el('th', { scope: 'col' }, String(blue)))));
    for (const red of faces) grid.appendChild(el('tr', null, el('th', { scope: 'row' }, String(red)),
      ...faces.map(blue => el('td', null, String(hitPosition(n, red, blue))))));
    result.replaceChildren(grid);
  }
  picker.addEventListener('change', show); show();
  return el('div', null, el('p', null, 'Player Aid VI. Read the red die as tens and the blue die as units. Count the indicated position from the top.'),
    el('label', null, 'Total ships ', picker), result);
}

function revealedCardsLookup(s) {
  const cards = [];
  const add = (label, view) => cards.push({ label, view });
  if (s) {
    const targets = (s.targetRow || []).filter(c => c.revealed);
    (s.targetRow || []).forEach((c, i) => {
      if (c.revealed) add(`Target ${i + 1} · ${c.id}`, () => targetCardView(s, c.id));
    });
    if (s.prompt && s.prompt.targetCard && !targets.some(c => c.id === s.prompt.targetCard)) {
      const id = s.prompt.targetCard;
      add(`Current prompt · Target ${id}`, () => targetCardView(s, id));
    }
    ZONES.forEach(z => {
      const id = s.zones[z].event;
      if (id) add(`${ZONE_NAME[z]} · Event #${id}`, () => eventCardView(id));
    });
    if (s.prompt && s.prompt.eventCard) add(`Current prompt · Event #${s.prompt.eventCard}`, () => eventCardView(s.prompt.eventCard));
    if (s.encounter && s.encounter.wgCard) {
      const id = s.encounter.wgCard;
      add(`Weather Gage · Event #${id}`, () => eventCardView(id));
    }
    if (s.combat && s.combat.tac) ['att', 'def'].forEach(role => {
      const played = s.combat.tac[role];
      if (!played) return;
      const card = TACTIC_BY_ID[played.id];
      add(`${role === 'att' ? 'Attacker' : 'Defender'} · ${card.name}`, () => el('div', { class: 'optcard tac-' + card.color },
        el('b', null, card.name), el('p', null, card.text), played.negated ? 'Negated' : played.used ? 'Used' : ''));
    });
  }
  if (!cards.length) return el('p', null, 'No cards are currently showing.');
  const pick = el('select', null, ...cards.map((c, i) => el('option', { value: i }, c.label)));
  const current = el('div');
  const show = () => current.replaceChildren(cards[Number(pick.value)].view());
  pick.addEventListener('change', show); show();
  return el('div', null, el('label', null, 'Revealed card ', pick), current);
}

function openReferenceTopics(topics) {
  const pick = el('select', { 'aria-label': 'Reference topic' }, ...topics.map((t, i) => el('option', { value: i }, t.name)));
  const current = el('div');
  const show = () => {
    const t = topics[Number(pick.value)];
    current.replaceChildren(t.content);
  };
  pick.addEventListener('change', show); show();
  openModal(el('div', { class: 'ref' }, el('h2', null, 'Reference'), el('label', null, 'Reference topic ', pick), current));
}
