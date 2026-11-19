# v0.2.13 — re-audit corrections and verification

19 November 2026. Implements both Low findings and the two usability recommendations from the [v0.2.12 comprehensive re-audit](../2026-11-19-v0.2.12-reaudit/).

| Audit item | Released behavior | Verification |
| --- | --- | --- |
| A01: untowed-schooner preview | Build the actual first-Round column, omit the ship under Missed Signal, then count only adjacent participating tow pairs. | Both original natural saves now show 8 untowed schooners. Missing tower, missing schooner, spent Event, cleared tow, deselecting either ship, normal tow, fully towed pair and Rainy Squalls controls pass. Accepting the natural missing-tower lineup yields the same 8-schooner count in the actual combat result. Rendering preserves game, dice, draft, Undo and autosave. |
| A02: incomplete procedure locals | Each saved frame must contain a non-null, non-array object for its locals. Missing data is refused rather than filled with an empty object. | Original missing/null files and missing/null/array/string/number locals at all three stack depths are rejected before replacing the game, dice, draft, Undo or autosave. Setup import preserves the existing saved campaign. Valid empty locals at A1 and populated mid-combat locals still import and continue. |
| Q01: explicit No Steps badge | An Engaged zero-step ship displays **No Steps – combat strengths 0**. Its accessible name includes the same warning; printed counter strengths remain visible. | Original Sir Sidney Smith position shows the warning and printed Reduced values. Disengaged, Struck Colors, sunk, withdrawn and nonzero-step controls do not display the Engaged warning. Inspect remains read-only. |
| Q02: ship-correction labels | Adjust gives each ship, destination box, steps and owner control a distinct accessible name. | All four fields can be located by name. Encounter explanation and atomic refusal still work; legal corrections apply and Undo restores the position. |

This patch changes display and save validation. It does not change combat rules, dice or scoring. The original audit and its evidence remain intact.

## Validation

* `npm test`: **861 assertions**, followed by **200 completed smoke campaigns**, no failures.
* `npm run test:ui`: all **nine DOM/control suites** passed, including the prior 118 v0.2.12 checks and **69 new assertions** in `tests/browser/fixes_v0213.js`.
* **128 option-grid campaigns** (seeds 967000–967063, both sides): every combination of the six tested options per side, **16,619 decisions**, no failures. Includes **594 exact save continuations**, **527 preview-purity checks**, and **eight full saved-game continuations** with 762 further actions.
* Independent Python assembly reproduced the shipped HTML exactly: **376,755 bytes**, SHA-256 **`60403a5fa01557db61b64ef0de3b52d01103fa92a8f7783e40a10814bdafd412`**.

These are focused patch-verification runs. They do not add a new balance study or repeat the previous audit's full campaign matrix. DOM emulation is not visual browser testing.

## Reproduce

```sh
node tools/build.js
npm test
# NODE_PATH must contain jsdom 26.1.0; the app itself has no dependency.
npm run test:ui
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.13/evidence/campaign/sweep.js . 967000 64 options
python audits/2026-11-19-v0.2.13/evidence/verify_release.py
```

The sweep writes results beside its script. Run it on a copy to preserve the recorded evidence. Test output, seed results and the independent build check are in `evidence/`. The focused test reads the original re-audit fixtures directly.
