/* ============================================================================
   Player Aid V (American A.I. Force Packages [5.3]) and Player Aid VII
   (Land Battle Table) – transcribed from the printed 2023 player aids.
   ========================================================================== */
const FORCE_PACKAGE_TEXT = {
  1: 'All Main Ships; Deploy as a single Force.',
  2: '28 points of Long Gun strength; Deploy as a single Force.',
  3: '22 points of Long Gun strength; Deploy as a single Force.',
  4: '16 points of Long Gun strength; Deploy as a single Force.',
  5: '18 points of Long Gun strength; Deploy as a single Force.',
  6: '20 points of Long Gun strength; Deploy as a single Force.',
  7: 'All Main Ships + all Secondary ships that have a Long Gun and/or Close Action strength. Deploy as a single Force.',
  8: '1st Force: Main ships totaling 8 points of Close Action strength, on an Army Support mission transporting Troops. 2nd Force: any other remaining Main or Secondary ships totaling 22 points of Long Gun strength, in the same Lake Zone, with a Patrol mission. Roll 1d6 for which Force is in an Encounter with the British: odd = Army Support Force, even = Patrol Force.',
  9: 'USS Lady of the Lake and one Secondary ship with 0 Close Action Strength and the lowest Long Gun Strength available. If Lady of the Lake is not available, two Secondary Ships that each have 0 Close Action strength and the lowest Long Gun strengths available. Deploy as a single Force.',
  10: 'Two Secondary Ships, selected at random. Deploy as a single Force.',
  11: "Five steps' worth of Secondary Ships, selected at random. Deploy as a single Force.",
};
const FORCE_PACKAGE_FOOTNOTE = 'If the Force’s mission is Army Support, it Deploys only if it has 4 or more Close Action points; it transports the most Troops markers it can legally carry, at 4 Close Action points per A.I. Troops marker [11.1.2].';
const PKG_LG_NEED = { 2: 28, 3: 22, 4: 16, 5: 18, 6: 20 };

/* Land Battle Table (Player Aid VII). Columns: Long Gun band (0 | 1-6 | 7-15 | 16-24 | 25+) × Troops (1-3).
   Each entry lists the 11-66 ranges for [DM, DS, DR, AS, AM, AF]; null = no such result.
   Note: the printed 0 LG / 3 Troops column reads "35-61" for Attacker Success and "64-65" for Attacker
   Major Success, leaving 62-63 unassigned. The app reads Attacker Success as 35-63 (following the
   65 / 64 / 63 progression across that band). */
const LB_BANDS = ['0', '1 to 6', '7 to 15', '16 to 24', '25+'];
const LB_ORDER = ['DM', 'DS', 'DR', 'AS', 'AM', 'AF'];
const LB_TABLE = [
  [ // 0
    [[11, 14], [15, 23], [24, 43], [44, 65], [66, 66], null],
    [[11, 13], [14, 23], [24, 41], [42, 64], [65, 66], null],
    [[11, 12], [13, 21], [22, 34], [35, 63], [64, 65], [66, 66]],
  ],
  [ // 1 to 6
    [[11, 11], [12, 16], [21, 34], [35, 62], [63, 66], null],
    [null, [11, 14], [15, 31], [32, 61], [62, 66], null],
    [null, [11, 13], [14, 26], [31, 56], [61, 64], [65, 66]],
  ],
  [ // 7 to 15
    [[11, 11], [12, 13], [14, 31], [32, 55], [56, 66], null],
    [null, [11, 12], [13, 26], [27, 54], [55, 66], null],
    [null, [11, 11], [12, 24], [25, 53], [54, 63], [64, 66]],
  ],
  [ // 16 to 24
    [[11, 11], [12, 12], [13, 24], [25, 52], [53, 66], null],
    [null, [11, 11], [12, 22], [23, 51], [52, 66], null],
    [null, [11, 11], [12, 21], [22, 46], [51, 62], [63, 66]],
  ],
  [ // 25+
    [null, [11, 11], [12, 16], [21, 44], [45, 66], null],
    [null, [11, 11], [12, 15], [16, 35], [36, 66], null],
    [null, [11, 11], [12, 14], [15, 33], [34, 61], [62, 66]],
  ],
];
function lbBand(lgTotal) { return lgTotal <= 0 ? 0 : lgTotal <= 6 ? 1 : lgTotal <= 15 ? 2 : lgTotal <= 24 ? 3 : 4; }
function lbLookup(lgTotal, troops, shift, d66v) {
  const band0 = lbBand(lgTotal);
  const band = Math.max(0, Math.min(4, band0 + (shift || 0)));
  const t = Math.max(1, Math.min(3, Math.floor(Number(troops)) || 1));
  const col = LB_TABLE[band][t - 1];
  let res = null;
  col.forEach((rg, i) => { if (rg && d66v >= rg[0] && d66v <= rg[1]) res = LB_ORDER[i]; });
  return { result: res, band, band0, troops: t, colLabel: `${LB_BANDS[band]} Long Gun / ${t} Troops` };
}
