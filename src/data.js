/* ============================================================================
   A Glorious Chance – Solo Companion :: static game data
   Sources: Living Rulebooks (U.S. Solo 13 Apr 2024, British Solo 7 Aug 2024),
   Living Playbook (6 Aug 2024), and the published VASSAL module v1.0 artwork
   (ship counters, map tables, Event/Tactic/Target cards).
   ========================================================================== */

const ZONES = ['YOR', 'NOR', 'KIN', 'NIA', 'SOU', 'SAC'];
const ZONE_NAME = { YOR: 'York', NOR: 'North Lake', KIN: 'Kingston', NIA: 'Niagara', SOU: 'South Lake', SAC: "Sacket's" };
// 3 x 2 grid (north row / south row) – adjacency is side-to-side only [2.2.1]
const ZONE_POS = { YOR: [0, 0], NOR: [1, 0], KIN: [2, 0], NIA: [0, 1], SOU: [1, 1], SAC: [2, 1] };
// Clockwise ring: York -> North Lake -> Kingston -> Sacket's -> South Lake -> Niagara -> York
const CLOCKWISE = ['YOR', 'NOR', 'KIN', 'SAC', 'SOU', 'NIA'];
// Coastline control is fixed [2.2.2]; Niagara coast is contested
const COAST_OWNER = { YOR: 'BR', NOR: 'BR', KIN: 'BR', SAC: 'US', SOU: 'US', NIA: null };
const HOMEPORT_ZONE = { US: 'SAC', BR: 'KIN' };
const TEMP_HOMEPORT_ZONE = { US: 'SOU', BR: 'YOR' }; // Charlotte / York
const HOMEPORT_NAME = { US: "Sacket's Harbor", BR: 'Kingston Harbour' };
const TEMP_HOMEPORT_NAME = { US: 'Charlotte', BR: 'York' };
const SIDE_NAME = { US: 'American', BR: 'British' };
const SIDE_PL = { US: 'Americans', BR: 'British' };
const SIDE_SHORT = { US: 'U.S.', BR: 'British' };
const OTHER = { US: 'BR', BR: 'US' };

function zoneDistance(a, b) {
  const pa = ZONE_POS[a], pb = ZONE_POS[b];
  return Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]);
}
function zonesAdjacent(a, b) { return zoneDistance(a, b) === 1; }
function clockwiseOf(z) { const i = CLOCKWISE.indexOf(z); return CLOCKWISE[(i + 1) % 6]; }
function counterClockwiseOf(z) { const i = CLOCKWISE.indexOf(z); return CLOCKWISE[(i + 5) % 6]; }

const TURN_NAMES = ['June I', 'June II', 'July I', 'July II', 'August I', 'August II', 'September I', 'September II'];
const MONTHS = ['June', 'July', 'August', 'September'];

/* ---------------------------------------------------------------------------
   Ships. full/red = [Long Gun, Carronade, Close Action, Defense, Steps]
   vp = [if Destroyed, if Captured]  (VP summary printed on the map)
   ------------------------------------------------------------------------ */
const SHIP_DEFS = [
  // British
  { id: 'wolfeA', base: 'wolfe', name: 'Wolfe', ver: 'A', side: 'BR', type: 'Corvette', guns: 22, main: 1, T: 1, F: 0, cls: 0, full: [2, 4, 8, 4, 3], red: [1, 2, 4, 2, 2], vp: [16, 32] },
  { id: 'wolfeB', base: 'wolfe', name: 'Wolfe', ver: 'B', side: 'BR', type: 'Corvette', guns: 22, main: 1, T: 1, F: 0, cls: 0, full: [3, 4, 8, 5, 3], red: [2, 2, 4, 2, 2], vp: [16, 32] },
  { id: 'rgA', base: 'rg', name: 'Royal George', ver: 'A', side: 'BR', type: 'Corvette', guns: 20, main: 1, T: 1, F: 0, cls: 0, full: [1, 4, 7, 2, 3], red: [0, 2, 4, 1, 2], vp: [14, 28] },
  { id: 'rgB', base: 'rg', name: 'Royal George', ver: 'B', side: 'BR', type: 'Corvette', guns: 20, main: 1, T: 1, F: 0, cls: 0, full: [2, 4, 7, 4, 3], red: [1, 2, 4, 2, 2], vp: [14, 28] },
  { id: 'moiraA', base: 'moira', name: 'Earl of Moira', ver: 'A', side: 'BR', type: 'Brig', guns: 18, main: 1, T: 0, F: 0, cls: 0, full: [0, 3, 4, 1, 2], red: [0, 2, 2, 0, 1], vp: [7, 14] },
  { id: 'moiraB', base: 'moira', name: 'Earl of Moira', ver: 'B', side: 'BR', type: 'Brig', guns: 18, main: 1, T: 0, F: 0, cls: 0, full: [1, 3, 4, 1, 2], red: [0, 2, 2, 0, 1], vp: [7, 14] },
  { id: 'beresA', base: 'beres', name: 'Lord Beresford', ver: 'A', side: 'BR', type: 'Schooner', guns: 12, main: 1, T: 0, F: 0, cls: 0, full: [0, 2, 3, 1, 2], red: [0, 1, 2, 0, 1], vp: [5, 10] },
  { id: 'beresB', base: 'beres', name: 'Lord Beresford', ver: 'B', side: 'BR', type: 'Schooner', guns: 9, main: 1, T: 0, F: 0, cls: 0, full: [2, 2, 3, 1, 2], red: [1, 1, 2, 0, 1], vp: [5, 10] },
  { id: 'melville', base: 'melville', name: 'Lord Melville', ver: '', side: 'BR', type: 'Brig', guns: 14, main: 1, T: 0, F: 0, cls: 0, full: [2, 3, 3, 1, 2], red: [1, 1, 2, 0, 1], vp: [6, 12] },
  { id: 'sss', base: 'sss', name: 'Sir Sidney Smith', ver: '', side: 'BR', type: 'Schooner', guns: 12, main: 1, T: 0, F: 0, cls: 0, full: [0, 2, 4, 1, 2], red: [0, 1, 2, 0, 1], vp: [5, 10] },
  // United States
  { id: 'pike', base: 'pike', name: 'General Pike', ver: '', side: 'US', type: 'Corvette', guns: 26, main: 1, T: 1, F: 0, cls: 0, full: [10, 0, 9, 9, 3], red: [5, 0, 4, 5, 2], vp: [20, 40] },
  { id: 'madison', base: 'madison', name: 'Madison', ver: '', side: 'US', type: 'Corvette', guns: 24, main: 1, T: 1, F: 0, cls: 0, full: [2, 4, 5, 6, 3], red: [1, 2, 2, 3, 2], vp: [16, 32] },
  { id: 'sylph', base: 'sylph', name: 'Sylph', ver: '', side: 'US', type: 'Schooner', guns: 10, main: 1, T: 1, F: 1, cls: 0, full: [6, 0, 3, 2, 3], red: [3, 0, 1, 1, 2], vp: [14, 28] },
  { id: 'oneida', base: 'oneida', name: 'Oneida', ver: '', side: 'US', type: 'Brig', guns: 18, main: 1, T: 0, F: 0, cls: 0, full: [1, 3, 3, 2, 2], red: [0, 2, 1, 1, 1], vp: [7, 14] },
  { id: 'tompkins', base: 'tompkins', name: 'Gov. Tompkins', ver: '', side: 'US', type: 'CLS', guns: 6, main: 1, T: 0, F: 0, cls: 1, full: [4, 0, 2, 0, 2], red: [2, 0, 1, 0, 1], vp: [4, 8] },
  { id: 'fairam', base: 'fairam', name: 'Fair American', ver: '', side: 'US', type: 'CLS', guns: 2, main: 1, T: 0, F: 0, cls: 1, full: [3, 0, 1, 0, 1], red: [0, 0, 0, 0, 0], vp: [4, 8] },
  { id: 'conquest', base: 'conquest', name: 'Conquest', ver: '', side: 'US', type: 'CLS', guns: 3, main: 1, T: 0, F: 0, cls: 1, full: [3, 0, 1, 0, 1], red: [0, 0, 0, 0, 0], vp: [4, 8] },
  { id: 'asp', base: 'asp', name: 'Asp', ver: '', side: 'US', type: 'CLS', guns: 2, main: 0, T: 0, F: 0, cls: 1, full: [0, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'growler', base: 'growler', name: 'Growler', ver: '', side: 'US', type: 'CLS', guns: 5, main: 0, T: 0, F: 0, cls: 1, full: [2, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'hamilton', base: 'hamilton', name: 'Hamilton', ver: '', side: 'US', type: 'CLS', guns: 9, main: 0, T: 0, F: 0, cls: 1, full: [1, 0, 1, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'julia', base: 'julia', name: 'Julia', ver: '', side: 'US', type: 'CLS', guns: 2, main: 0, T: 0, F: 0, cls: 1, full: [2, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'lady', base: 'lady', name: 'Lady of the Lake', ver: '', side: 'US', type: 'Schooner', guns: 1, main: 0, T: 0, F: 1, cls: 0, full: [0, 0, 0, 0, 2], red: [0, 0, 0, 0, 1], vp: [2, 4] },
  { id: 'ontario', base: 'ontario', name: 'Ontario', ver: '', side: 'US', type: 'CLS', guns: 2, main: 0, T: 0, F: 0, cls: 1, full: [1, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'pert', base: 'pert', name: 'Pert', ver: '', side: 'US', type: 'CLS', guns: 3, main: 0, T: 0, F: 0, cls: 1, full: [1, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'raven', base: 'raven', name: 'Raven', ver: '', side: 'US', type: 'CLS', guns: 1, main: 0, T: 0, F: 0, cls: 1, full: [1, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
  { id: 'scourge', base: 'scourge', name: 'Scourge', ver: '', side: 'US', type: 'CLS', guns: 10, main: 0, T: 0, F: 0, cls: 1, full: [1, 0, 0, 0, 1], red: [0, 0, 0, 0, 0], vp: [2, 4] },
];
const SHIP_BY_ID = {};
SHIP_DEFS.forEach(d => { SHIP_BY_ID[d.id] = d; });

/* Lake Combat Table (printed on both maps). Columns: 1:2 or less, 1:1.5, 1:1, 1.5:1, 2:1, 2.5:1, 3:1+ ; rows 1d10 0-9 */
const CRT_COLS = ['1:2-', '1:1.5', '1:1', '1.5:1', '2:1', '2.5:1', '3:1+'];
const CRT = [
  ['A6', 'A2W', 'A2', 'A1/D1', 'D1', 'D1W', 'D2'],
  ['A5', 'A2', 'A1W', 'D1', 'D1W', 'D2', 'D2W'],
  ['A4', 'A1W', 'A1', 'D1W', 'D2', 'D2W', 'D3'],
  ['A3', 'A1', 'End', 'D2', 'D2W', 'D3', 'A1/D3W'],
  ['A3', 'End', 'A1/D1', 'D2W', 'D3', 'A1/D3W', 'D4'],
  ['A2', 'A1/D1', 'D1', 'A1/D2', 'D3W', 'D4', 'D4W'],
  ['A1', 'D1', 'D1W', 'D3W', 'D4', 'D4W', 'A1/D5'],
  ['A1', 'D1W', 'A1/D2', 'D3', 'D4W', 'A1/D5', 'D6'],
  ['End', 'D2', 'A1/D2W', 'A1/D3W', 'D5', 'D5W', 'A1/D7'],
  ['A1/D1', 'D2W', 'D3', 'A1/D4', 'A1/D6', 'D6', 'D7'],
];
function crtColumnForRatio(r) {
  if (r < 2 / 3) return 0;
  if (r < 1) return 1;
  if (r < 1.5) return 2;
  if (r < 2) return 3;
  if (r < 2.5) return 4;
  if (r < 3) return 5;
  return 6;
}
function parseCrt(code) {
  const res = { aHits: 0, dHits: 0, aW: false, dW: false, end: false, code };
  if (code === 'End') { res.end = true; return res; }
  code.split('/').forEach(p => {
    const m = /^([AD])(\d+)(W?)$/.exec(p);
    if (!m) return;
    if (m[1] === 'A') { res.aHits = +m[2]; if (m[3]) res.aW = true; }
    else { res.dHits = +m[2]; if (m[3]) res.dW = true; }
  });
  return res;
}

/* Convoy Scatter Table (11.3) : rows by total guns, 1d10 0-9 */
const SCATTER_ROWS = [[1, 21], [22, 42], [43, 63], [64, 84], [85, 95], [96, 9999]];
const SCATTER = [
  'SSSSSSSDDD',
  'SSSSSSDDDC',
  'SSSSSDDDCC',
  'SSSSDDDCCC',
  'SSSDDDCCCC',
  'SSDDDCCCCC',
];

/* Lake Combat Gunnery Hit Distribution Table (Player Aid VI) – block sizes of
   the 36 results (11..66) per position, for 1..12 Engaged ships. Read from the
   table as reproduced in the rulebook example (p. 32). For 13+ ships the app
   picks a position uniformly (no column printed in the reproduced extract). */
const HIT_DIST = {
  1: [36], 2: [18, 18], 3: [12, 12, 12], 4: [9, 9, 9, 9], 5: [7, 7, 8, 7, 7], 6: [6, 6, 6, 6, 6, 6],
  7: [5, 5, 5, 6, 5, 5, 5], 8: [3, 5, 5, 5, 5, 5, 5, 3], 9: [4, 4, 4, 4, 4, 4, 4, 4, 4],
  10: [2, 4, 4, 4, 4, 4, 4, 4, 4, 2], 11: [1, 4, 4, 4, 5, 4, 4, 4, 4, 1, 1], 12: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
};
function d66Index(red, blue) { return (red - 1) * 6 + (blue - 1); } // 0..35
function hitPosition(nShips, red, blue) {
  const idx = d66Index(red, blue);
  const col = HIT_DIST[nShips];
  if (!col) return null;
  let acc = 0;
  for (let i = 0; i < col.length; i++) { acc += col[i]; if (idx < acc) return i + 1; }
  return col.length;
}

/* Naval Balance track bands and Target Cards drawn */
const NB_LABELS = ['≤ −70', '−69 to −26', '−25 to −16', '−15 to +15', '+16 to +25', '+26 to +59', '≥ +60'];
const NB_CARD_LABELS = ['≤-70', '≤-26', '≤-16', '-15 to 15', '≥16', '≥26', '≥60'];
function navalBalanceBand(v) {
  if (v <= -70) return 0;
  if (v <= -26) return 1;
  if (v <= -16) return 2;
  if (v <= 15) return 3;
  if (v <= 25) return 4;
  if (v <= 59) return 5;
  return 6;
}
const NB_CARDS = { US: [10, 10, 9, 8, 7, 6, 6], BR: [6, 6, 7, 8, 9, 10, 10] }; // keyed by the human side's campaign map

/* Convoy Supply Track */
const SUPPLY_MIN = -1, SUPPLY_MAX = 12;
const CONSTRUCTION_TRIGGERS = { melville: { side: 'BR', space: 4 }, pike: { side: 'US', space: 4 }, sylph: { side: 'US', space: 6 } };

/* Niagara Front: 0 = Burlington Heights (U.S. goal) … 6 = Fort George (British goal); start 3 */
const NIAGARA_SPACES = ['Burlington Heights', 'Stoney Creek', '40-mile Creek', '12-mile Creek', '10-mile Creek', '2-mile Creek', 'Fort George'];

/* Raids [F4] : VP to raider when Raid marker placed on that coastline */
const RAID_VP = { KIN: 2, YOR: 1, SAC: 2, SOU: 1 };
const RAID_ZONES = { US: ['KIN', 'YOR'], BR: ['SAC', 'SOU'] };

/* Shipyard Damage Table (2d6, +2 if Feat of Arms) */
const SHIPYARD = [
  { lo: 2, hi: 4, title: 'Docks and Facilities Burned', cd: 1, eff: 'none' },
  { lo: 5, hi: 5, title: 'Damage – Ship Under Repair', cd: 1, eff: 'repairDelay' },
  { lo: 6, hi: 7, title: 'Damage – One Ship Under Construction', cd: 1, eff: 'reduceOneConstruction' },
  { lo: 8, hi: 9, title: 'Damage – All Ships Under Construction', cd: 2, eff: 'reduceAllConstruction' },
  { lo: 10, hi: 11, title: 'Destroyed – One Ship Under Construction', cd: 2, eff: 'destroyOneConstruction' },
  { lo: 12, hi: 99, title: 'Destroyed – All Ships Under Construction', cd: 3, eff: 'destroyAllConstruction' },
];

/* Cutting-Out Table (Playbook p.7, optional rule) */
const CUTTING_OUT = [
  { lo: 0, hi: 2, key: 'repulsed', title: 'Repulsed!', text: 'The party is captured. Defender gains 1 VP.' },
  { lo: 3, hi: 6, key: 'discovered', title: 'Discovered!', text: 'A guard boat spots the party; mission aborted.' },
  { lo: 7, hi: 9, key: 'success', title: 'Success!', text: 'Defender ship captured (highest capture-VP ship in Deployable / Make Ready).' },
];

/* Upgrade limit table (British Solo 7.1 / Optional OA1) */
function upgradeLimit(d10) { if (d10 === 1) return 3; if (d10 <= 4) return 2; if (d10 <= 9) return 1; return 0; }

/* Victory levels (Living Rules 3.3.2) */
function victoryLevel(score) {
  if (score <= -33) return 'British Decisive Victory';
  if (score <= -22) return 'British Victory';
  if (score <= -11) return 'British Marginal Victory';
  if (score <= 10) return 'Draw';
  if (score <= 21) return 'U.S. Marginal Victory';
  if (score <= 32) return 'U.S. Victory';
  return 'U.S. Decisive Victory';
}

/* ---------------------------------------------------------------------------
   Event Cards (38). spy = man-with-spyglass (Encounter), wg = starting Weather
   Gage ('A' American / 'B' British), sym = Tactic-invalidating symbols.
   lake/coastal = effect keys, handled in engine.
   ------------------------------------------------------------------------ */
const SYM = { club: '♣', heart: '♥', diamond: '◆', arrow: '⬇', square: '■', star: '★', circle: '●' };
const EVENT_TEXT = {
  minorDamage: s => `If ${s === 'BR' ? 'a British' : 'an American'} ship suffers a hit in a Lake Combat Gunnery Round, roll 1d10; the hit applies only if the roll is greater than the ship's current Defense Strength. Usable once in this Lake Zone this turn.`,
  constructionDelay: s => `The pace of work has slackened at the ${SIDE_NAME[s]} shipyard. Increase the ${SIDE_SHORT[s]} Construction Delay by 1.`,
  convoyDelay: s => `If a ${SIDE_SHORT[s]} Convoy is running this turn, place a Convoy Delay marker on it (no advance in F5, may still regress; flips to Convoy Arrived in F7 if the Homeport is free of Blockade).`,
  missedSignal: s => `Select a Deployed ${SIDE_SHORT[s]} ship at random that is part of a multi-ship Force in this Lake Zone. The first time that Force enters Lake Combat this turn, the ship sits out the first Round it would have joined.`,
  sickness: s => `Reduce the Close Action Strength of every ${SIDE_SHORT[s]} ship deployed to this Lake Zone by 1 this turn${s === 'US' ? ' (2 for the USS Gen. Pike)' : ''}. Also increase the ${SIDE_SHORT[s]} Construction Delay by 1.`,
  fairWindHuman: () => `If the human player's Forces make Reaction Checks to reinforce Encounters in this Lake Zone this turn, apply a +2 DRM.`,
  fairWindAI: () => `If the A.I. side makes Reaction Checks to reinforce Encounters in this Lake Zone this turn, apply a +2 DRM.`,
  adverseWind: () => `If an Encounter in this Lake Zone proceeds to a Reaction Segment, apply a +2 DRM to all the human player's Reaction Check dierolls for Forces that try to reinforce an Encounter in this Lake Zone (as printed on the card).`,
  extraMen: s => `Reduce the ${SIDE_SHORT[s]} Construction Delay by 1.`,
  separated: s => `If the ${SIDE_SHORT[s]} Force in this Encounter has more than one ship, randomly select half its ships (round down) and displace them one Lake Zone ${s === 'US' ? 'clockwise' : 'counterclockwise'} as a new Force with a Patrol mission.`,
  separatedBoth: s => `If the ${SIDE_SHORT[s]} Force in this Encounter has more than one ship, randomly select half (round down) and displace them one Lake Zone clockwise. Both Forces' Mission is now Patrol.`,
  haze: () => `In the first Gunnery Round 1 in this Lake Zone, neither side counts Long Gun Strength.`,
  rainySqualls: () => `If Lake Combat occurs here during a Patrol Segment: after LC1–LC2 skip directly to the Close Action Round (all the attacker's full-strength ships may take part), determine hits, then end the Patrol Segment.`,
  gale: () => `Opposing Forces in this Encounter displace one zone clockwise. Roll 1d6 per ship: 1 = Sunk, 2 = Beached (−1 Converted Laker Schooner, +1 Brig/Corvette). Beached on friendly coast: Reduced, to friendly In Transit. On enemy coast: Reduced, Captured. Niagara: odd = enemy coast, even = friendly. Others to their Homeport In Transit at full strength.`,
  commandingBreeze: () => `Patrol Segment of this Encounter only: if the British attack, skip the Weather Gage recheck after Gunnery Round 2 and go directly to a Close Action Round.`,
  none: () => 'None.',
  localMilitia: () => `Raid only: In F4 roll 1d6; if it exceeds the raiding Force's total guns, the Raid scores no VPs and no supplies.`,
  suppliesBurned: () => `Raid only: in F5 the raider gets its 1-space Convoy Supply advance only on a 1d6 roll of 6.`,
  suppliesMoved: () => `Raid only: the raiding side gets no VPs and no Convoy Supply advance for this Raid.`,
  heatedShot: () => `Army Support only: a random ship of the Force is Damaged – it adds no Long Gun Strength to the Land Battle and goes to its Homeport's In Ordinary box in F7 (eligible for Repair).`,
  explosion: () => `Army Support only: a random ship of the Force is destroyed (defending side scores VPs). If the Flagship explodes, the Leader is killed.`,
  requisition: () => `Army Support only: the attacking Force's ship with the fewest guns (random among ties) is requisitioned – off the map and out of play next turn.`,
  intelligence: () => `For the next Encounter involving the enemy Flagship, all of the drawing side's Reaction Checks get +1 DRM and no negative DRMs. Void if no such Encounter by the end of next turn.`,
  suddenStorm: () => `Raid: no supplies; VPs: 1 VP for a 2-VP target, otherwise none. Army Support: an Attacker Major Success becomes a Success.`,
  moreDefenders: () => `Army Support only: −2 column shift on the attacker's Land Battle against this Coastal target.`,
};
const EVENT_TITLE = {
  minorDamage: 'Minor Damage', constructionDelay: 'Construction Delay', convoyDelay: 'Convoy Delay', missedSignal: 'Missed Signal',
  sickness: 'Sickness', fairWindHuman: 'Fair Wind', fairWindAI: 'Fair Wind', adverseWind: 'Adverse Wind', extraMen: 'Extra Men',
  separated: 'Separated Ships', separatedBoth: 'Separated Ships', haze: 'Haze', rainySqualls: 'Rainy Squalls', gale: 'Gale',
  commandingBreeze: 'Commanding Breeze', none: 'None', localMilitia: 'Local Militia', suppliesBurned: 'Supplies Burned',
  suppliesMoved: 'Supplies Moved', heatedShot: 'Heated Shot', explosion: 'Explosion', requisition: 'Requisition',
  intelligence: 'Intelligence', suddenStorm: 'Sudden Storm', moreDefenders: 'More Defenders',
};
// [id, spyglass, weatherGage, symbols, lakeEvent, lakeSide, coastalEvent]
const EVENT_RAW = [
  [1, 1, 'A', ['club', 'heart', 'star'], 'minorDamage', 'BR', 'none'],
  [2, 1, 'A', [], 'constructionDelay', 'US', 'none'],
  [3, 1, 'A', [], 'constructionDelay', 'BR', 'none'],
  [4, 1, 'A', [], 'constructionDelay', 'BR', 'none'],
  [5, 1, 'A', [], 'convoyDelay', 'BR', 'none'],
  [6, 1, 'A', ['heart', 'diamond'], 'missedSignal', 'BR', 'none'],
  [7, 1, 'A', ['club', 'diamond', 'square', 'circle'], 'sickness', 'US', 'none'],
  [8, 1, 'A', [], 'fairWindHuman', null, 'none'],
  [9, 1, 'A', [], 'extraMen', 'US', 'none'],
  [10, 1, 'A', [], 'extraMen', 'BR', 'none'],
  [11, 1, 'A', ['heart', 'diamond'], 'separated', 'US', 'none'],
  [12, 1, 'A', ['club', 'diamond', 'circle'], 'sickness', 'BR', 'none'],
  [13, 1, 'A', ['heart', 'diamond'], 'missedSignal', 'US', 'none'],
  [14, 1, 'A', ['heart', 'diamond'], 'separated', 'BR', 'none'],
  [15, 1, 'A', [], 'adverseWind', null, 'none'],
  [16, 1, 'A', ['club', 'heart', 'arrow', 'square', 'star'], 'haze', null, 'none'],
  [17, 1, 'A', ['club', 'heart', 'arrow', 'square', 'star'], 'haze', null, 'none'],
  [18, 1, 'A', [], 'adverseWind', null, 'none'],
  [19, 1, 'A', ['club', 'heart', 'diamond', 'arrow', 'square', 'star'], 'rainySqualls', null, 'none'],
  [20, 1, 'B', ['club', 'heart', 'diamond', 'arrow', 'square', 'star'], 'rainySqualls', null, 'localMilitia'],
  [21, 0, 'B', ['club', 'heart', 'diamond', 'arrow', 'square', 'star'], 'rainySqualls', null, 'suppliesBurned'],
  [22, 0, 'B', [], 'adverseWind', null, 'suppliesMoved'],
  [23, 0, 'B', ['club', 'heart', 'arrow', 'square', 'star'], 'haze', null, 'heatedShot'],
  [24, 0, 'B', [], 'adverseWind', null, 'heatedShot'],
  [25, 0, 'B', [], 'fairWindHuman', null, 'explosion'],
  [26, 0, 'B', ['club', 'diamond', 'square', 'circle'], 'sickness', 'US', 'requisition'],
  [27, 0, 'B', ['heart', 'diamond'], 'separatedBoth', 'US', 'requisition'],
  [28, 0, 'B', ['club', 'diamond', 'circle'], 'sickness', 'BR', 'requisition'],
  [29, 0, 'B', ['heart', 'diamond'], 'missedSignal', 'US', 'intelligence'],
  [30, 0, null, [], 'gale', null, 'gale'],
  [31, 0, 'B', [], 'fairWindAI', null, 'intelligence'],
  [32, 0, 'B', [], 'fairWindAI', null, 'suddenStorm'],
  [33, 0, 'B', ['club', 'heart', 'star'], 'minorDamage', 'US', 'suddenStorm'],
  [34, 0, 'B', ['heart', 'diamond'], 'separated', 'BR', 'suddenStorm'],
  [35, 0, 'B', ['heart', 'diamond'], 'missedSignal', 'BR', 'suddenStorm'],
  [36, 0, 'B', [], 'convoyDelay', 'US', 'moreDefenders'],
  [37, 0, 'B', [], 'commandingBreeze', null, 'moreDefenders'],
  [38, 0, 'B', [], 'commandingBreeze', null, 'moreDefenders'],
];
const EVENTS = {};
EVENT_RAW.forEach(r => { EVENTS[r[0]] = { id: r[0], spy: !!r[1], wg: r[2], sym: r[3], lake: r[4], lakeSide: r[5], coastal: r[6] }; });

/* ---------------------------------------------------------------------------
   Tactic Cards. deck A = Attacker, D = Defender. color: matching colors cancel.
   only: side restriction ('US'/'BR'). dummy: discarded on draw.
   ------------------------------------------------------------------------ */
const TACTICS = [
  { id: 'A_sweep', deck: 'A', name: 'Sweep Up & Fire', sym: 'square', color: 'white', only: 'US', text: 'U.S. only, when the attacking ships are ALL untowed Converted Laker Schooners. For the current Combat Sequence: ignore the untowed-schooner DRM penalty; ignore A# and AW results; after Gunnery Round 1 skip the Weather Gage recheck and go to Gunnery Round 2; ignore Commanding Breeze. Not valid against a British Force consisting solely of reflagged Laker Schooners.' },
  { id: 'A_surprise', deck: 'A', name: 'Surprise', sym: 'star', color: 'lavender', text: 'Patrol Segment only, once. Gunnery Round 1: the Attacker gets a +1 column shift.' },
  { id: 'A_rake', deck: 'A', name: 'Rake', sym: 'star', color: 'salmon', text: 'Once in the current Combat Sequence: on the next Defender Hit result the Attacker applies ALL the hits to one ship – the lead ship, the rear ship, or a random ship (A.I. picks the highest VP of the three options).' },
  { id: 'A_pursuit', deck: 'A', name: 'Pursuit', sym: 'arrow', color: 'yellow', text: 'Applies once if a DW result is rolled during the current Combat Sequence: the opposing withdrawal is cancelled and a new Encounter is conducted at once between the same forces.' },
  { id: 'A_outmaneuver', deck: 'A', name: 'Outmaneuver', sym: 'heart', color: 'salmon', text: 'Gunnery Round 1: gaps created in the Defender column stay open. Gunnery Round 2: the Attacker fires its full strength at one of the separated Defender subgroups.' },
  { id: 'A_grapple', deck: 'A', name: 'Grapple', sym: 'diamond', color: 'teal', only: 'BR', text: 'British only, when attacking (Sequence B). After Gunnery Round 2 skip the Weather Gage recheck and go to a Close Action Round: +2 DRM to Leader Casualty Checks on U.S. ships; in Melee British ships roll two d6 and use the higher.' },
  { id: 'A_firstshot', deck: 'A', name: 'First Shot', sym: 'club', color: 'lavender', text: 'This Gunnery Round only: the Attacker re-rolls once if the result included AW, or an A# calling for more hits than the D#.' },
  { id: 'A_dummy1', deck: 'A', name: 'Dummy', dummy: true, text: '' },
  { id: 'A_dummy2', deck: 'A', name: 'Dummy', dummy: true, text: '' },
  { id: 'A_rof', deck: 'A', name: 'Rate of Fire', sym: 'club', color: 'green', text: 'Every Gunnery Round of the current Combat Sequence: +1 DRM on the Lake Combat Table.' },
  { id: 'D_repel', deck: 'D', name: 'Repel', sym: 'circle', color: 'teal', only: 'US', text: 'Defending U.S. Force only, for the current Combat Sequence. Negates the Attacker Grapple Tactic.' },
  { id: 'D_rof', deck: 'D', name: 'Rate of Fire', sym: 'club', color: 'green', text: 'Every Gunnery Round of the current Combat Sequence: −1 DRM on the Lake Combat Table.' },
  { id: 'D_rake', deck: 'D', name: 'Rake', sym: 'heart', color: 'salmon', text: 'Once in the current Combat Sequence: the Attacker suffers −1 DRM; if the result includes an Attacker Hit, distribute on the "2 ships" column (ALL Attacker hits go to the No.1 or No.2 ship).' },
  { id: 'D_outmaneuver', deck: 'D', name: 'Outmaneuver', sym: 'heart', color: 'salmon', text: 'The Defender automatically wins the next Weather Gage check.' },
  { id: 'D_mutual', deck: 'D', name: 'Mutual Support', sym: 'diamond', color: 'lavender', text: 'For the current Combat Sequence. Negates Attacker Rake and Attacker Outmaneuver.' },
  { id: 'D_openrange', deck: 'D', name: 'Open Range', sym: 'square', color: 'white', only: 'BR', text: 'British defender only, for the current Combat Sequence: +5 column shift on the Gunnery Hit Distribution Table (hits landing on empty positions have no effect).' },
  { id: 'D_firstshot', deck: 'D', name: 'First Shot', sym: 'club', color: 'lavender', text: 'This Gunnery Round only: the Defender re-rolls once if the result included DW, or a D# calling for more hits than the A#.' },
  { id: 'D_escape', deck: 'D', name: 'Escape', sym: 'club', color: 'yellow', text: 'Add a "W" for the Defender to the next Lake Combat Table result; Defender ships hit in that round automatically pass their Disengagement Checks.' },
  { id: 'D_dummy1', deck: 'D', name: 'Dummy', dummy: true, text: '' },
  { id: 'D_dummy2', deck: 'D', name: 'Dummy', dummy: true, text: '' },
];
const TACTIC_BY_ID = {};
TACTICS.forEach(t => { TACTIC_BY_ID[t.id] = t; });

/* Target cards (generated) */
const TARGET_CARDS = {};
TARGET_CARDS_RAW.forEach(r => {
  TARGET_CARDS[r[0]] = { id: r[0], deck: r[0][0], zone: r[1], mission: r[2], secondary: r[3], cond: r[4], lastTurn: !!r[5], isolated: !!r[6], grid: r[7] };
});
const MISSION_NAME = { Patrol: 'Patrol', Escort: 'Escort', Raid: 'Raid', ArmySupport: 'Army Support', CuttingOut: 'Cutting-Out', AttackConvoy: 'Attack Convoy' };
const COND_TEXT = {
  notIfNiagaraFortGeorge: 'Does not Deploy if the Niagara Front marker is in Fort George.',
  notIfNiagaraBurlington: 'Does not Deploy if the Niagara Front marker is in Burlington Heights.',
  onlyIfPikeOrSylphUnbuilt: 'Does not Deploy unless USS Pike and/or USS Sylph are still in the Construction or Repairing area.',
  secondaryIfUSTempHomeport: 'Secondary (Cutting-Out) if the Americans are using Charlotte as a Temporary Homeport.',
  secondaryIfBRTempHomeport: 'Secondary (Cutting-Out) if the British are using York as a Temporary Homeport.',
  raidOncePerZone: 'Secondary Mission if an AI Force with a Raid mission has already Deployed to this Lake Zone.',
  escortNeedsConvoy: 'Secondary Mission if no AI Convoy is running this turn, or it already Deployed for a different Encounter.',
  attackConvoyIfRunning: 'Secondary (Attack Convoy) if an enemy Convoy is running this turn and has not already Deployed.',
  cuttingOutLimit: 'Does not Deploy if the AI has already used its Cutting-Out Deployment this game.',
};
