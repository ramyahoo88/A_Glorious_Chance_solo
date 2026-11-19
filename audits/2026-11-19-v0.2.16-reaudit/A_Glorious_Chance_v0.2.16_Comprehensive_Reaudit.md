# A Glorious Chance v0.2.16 - comprehensive re-audit

19 November 2026. Audited main: `53656b345df49fefbddc2bc32e1a6a55a315c5a9`.

**Verdict: normal play passes the tested scenarios; a small corrective release is recommended.** Three findings are confirmed: one Medium save-validation defect and two Low physical-card instruction defects. No new combat, scoring, deployment or card-resolution defect was reproduced. This is an audit report, not an implementation of the proposed fixes.

The public app, repository build and independent rebuild agree: **413,864 bytes**, SHA-256 `eef9136a8220b8733f17403fce7f0c95aa3db83275fbd425d3bc5c4b7e8044e2`.

## Findings

| ID | Severity | Confirmed problem | Recommended correction |
| --- | --- | --- | --- |
| A01 | Medium | An incomplete save waiting for an Event card can load successfully, replace the current campaign and autosave, then stall when a valid number is entered. | Validate the suspended parent procedure and its required context before accepting the save. |
| A02 | Low | Used Intelligence says its card returns to the Event deck, but the card remains unavailable and the next real entry rejects it. | State exactly where to put the physical card and when it becomes drawable again. |
| A03 | Low | Undoing the first entry simultaneously says to return the card to the top and to shuffle the deck. Reload loses the return-to-top reminder. | Give one unambiguous physical restoration instruction and preserve it across reload. |

### A01 - accepted damaged saves stall at the new Event checkpoint

**Files:** `src/ui.js:261` and `:269`; `src/engine_coastal.js:99` and `:144`; `src/engine_encounter.js:244`.

The new validator checks the top `eventDraw` frame, its arguments, the prompt and the available-pile size. It verifies that other frames have object-shaped locals, but does not check the particular parent data needed when the entered card returns. Removing one of those fields from a real saved position leaves a save which passes validation:

| Real pending draw | Single removed field | Error after valid entry |
| --- | --- | --- |
| U.S. Raid on Kingston; seed 980000, U.S., June I; enter 27 | Parent `L.raidForce` | Cannot read properties of undefined (reading 'id') |
| Reaction Segment Weather Gage in South Lake; seed 980000, British, June I; enter 15 | Parent `L.reactionLines` | Cannot read properties of undefined (reading 'push') |
| U.S. Land Battle in Niagara; seed 980000, U.S.; enter 23 | Parent `L.cur` | Cannot read properties of undefined (reading 'forces') |

**Reproduction:** start a campaign; use Load / Load pasted text to import one of `evidence/corrupt-coastal-raidEvent.json`, `corrupt-encounter-reactionEvent.json` or `corrupt-coastal-asBattleEvent.json`; enter the corresponding number and select Use Event card. All three import through the real browser controls, close the load dialog, and fail on submission. Their valid originals are beside them.

The failure is caught: the attempted entry is rolled back, the card is not consumed, and Undo can recover the campaign that was open before import. However, the bad position has already replaced the open game and its current autosave; selecting another legal card cannot repair the missing context. This is a damaged-file recovery defect, **not evidence that ordinary app saves spontaneously lose these fields**. The 1,626 normal round trips and 18 entire saved continuations below passed.

**Fix:** validate each allowed caller and resume point of `eventDraw`, then its required saved context: existing Raid force and correct side, Reaction text array plus Encounter, and Land Battle zone/force list. Check the other three callers' Encounter/combat/PE context as well. Reject atomically with the current campaign, Undo history, unfinished input and autosave untouched. Add the three malformed fixtures as regressions, alongside valid fixtures that must still resume exactly.

### A02 - Intelligence removal gives a conflicting physical instruction

**File:** `src/engine_encounter.js:28`, especially the message at line 34.

In a fresh U.S. campaign, seed **980001**, August I, Intelligence card **29** is used in an Encounter with the enemy Flagship. The log says the card returns to the Event deck. The handler clears the Intelligence marker but does not add 29 to the current draw pile. At the next actual draw, a U.S. Raid on York, entering 29 is disabled with the message that it is not in the draw pile. This was reproduced through actual browser controls, not only by calling validation directly.

The misleading message predates v0.2.16, but it now directs a player handling real cards. A player following it can contaminate the physical draw pile. The engine's protection correctly refuses the inconsistent entry.

**Fix:** under the retained card-pool policy, say to place the used Intelligence card with the used cards and return it at the next Event-deck reshuffle. Make the disappearance of the marker and physical-card disposition explicit together. Do not silently change draw probabilities to make the old sentence true. This is a confirmed instruction/model disagreement; this audit does not assert a newly verified exception on the Intelligence card itself.

**Evidence:** `intelligence-return-before.json`, `intelligence-return-after.json`, `browser/intelligence-return-refused.png`, and `browser/findings.json`.

### A03 - first-entry Undo mixes restoration with preparation

**Files:** `src/ui.js:113` and `:315`; `src/engine_core.js:106`.

Use the first natural draw in `evidence/turn-B2event.json`, enter **3**, then Undo. The restored prompt displays both:

- Return the entered Event card to the top of the physical draw pile.
- Shuffle your physical Event deck.

The first instruction would preserve the physical order; following the second changes it. The old preparation wording was saved before the first number was entered and is restored verbatim. The new restoration banner exists only in `UI.physicalNote`; reload / Continue it restores the exact game state but removes that banner, leaving only the shuffle instruction. The same design affects a first entry after a new-turn preparation.

**Fix:** distinguish restoring a physical pile from preparing one for the first time. When undoing an entry, show the exact card to return and suppress the contradictory preparation instruction. Keep any outstanding physical restoration notice with the saved presentation/checkpoint information until play proceeds, so reload and export/import do not lose it. Cover ordinary entry, first entry, Gale redraw and exhaustion/turn-reset boundaries without changing dice or applying the card twice.

**Evidence:** `browser/undo-first-entry.png` and `browser/findings.json`. No digital-state or RNG mismatch was found in this reproduction.

## Verification performed

| Area | Observed result |
| --- | --- |
| Repository regression suite | All existing engine tests and 200 smoke campaigns passed. The physical suite's 32,286 assertions and 64 paired campaigns passed. |
| DOM suite | All 11 historical suites and the 32 physical-entry checks passed. Historical suites deliberately use the documented automatic-Event compatibility fixture; the physical suite uses production HTML. |
| Fresh physical campaigns | **160** complete campaigns: seeds 977000-977015, both sides, fleet/coast/cautious/screen/blockade policies. Zero invariant failures. |
| Option combinations | **128** complete physical campaigns: seeds 978000-978063, both sides, all 64 combinations of the six existing engine switches, coastal policy. Zero invariant failures. Grouped pacing is separately checked in the browser. |
| Combined fresh coverage | **46,272 decisions; 9,928 physical entries; 1,626 saved round trips; 18 full saved continuations spanning 2,556 actions; 1,478 manual Force Packages; 329 manual Land Battles; 546 first-round forecast comparisons; 1,442 read-only preview checks.** |
| Independent checks | Troops conservation, force membership/ownership, ship steps, duplicate cards/sinkings, supply/track limits, Naval Balance, independent Tally VP components, ledger totals and final victory thresholds. Physical piles use a separate deterministic shuffle and assert availability rather than silently repairing a discrepancy. |
| Complete real-browser campaigns | Chromium 153.0.8010.0. U.S. seed 979001, fleet, 1440 px: **181 actions / 40 entries**, score 0 Draw. British seed 979002, coast, 390 px, grouped: **139 actions / 40 entries**, score +74 U.S. Decisive Victory. |
| Browser persistence/inspection | Across those campaigns: **12 pending-entry reloads, 10 exact Undo/replays, 10 Map inspections**, and a full-state comparison after every actual control. No page errors; final ledgers agree. |
| Targeted search | Additional seeds 980000-980063 on both sides supplied natural examples of all six draw contexts and Intelligence consumption; deliberately damaged copies supplied A01. These searches are not included in the 288 invariant-checked campaign total. |
| Published app | Live card requirement, invalid-number rejection, Gale/redraw, pending reload, Enter submission, Undo/replay, and actual download passed. Download matches the independent build. No horizontal overflow at 320/390/1024/1440 px. |
| Printed-data regressions | All 648 Hit Distribution cases, 70 Lake Combat cells, 60 Convoy Scatter cells, Naval Balance bands, and 20 Tactic records match the existing independently transcribed reference values. The three printed-data source files are unchanged from v0.2.15. |

All six Event consumers were reviewed: Possible Encounter checks, Encounter Weather Gage/Lake Events, Reaction Weather Gage, combat rechecks, Raids and Land Battles. The saved child procedure preserves already-resolved Reaction dice and Raid selection. Entry validation, used/held-card rejection, Gale legality/redraw, legacy activation and grouping stops passed the existing focused tests and the new complete physical runs.

The same-side Intelligence replacement observed in `probes.json` is **not a fourth finding**: the captured example replaces an unused effect for the current turn with one for the next turn.

## One optional usability improvement

**Q01 - a Deck status button next to number entry.** Show the public, sorted card numbers remaining, already used and held for Intelligence, plus the last entered number and purpose. This would help reconcile real cards after loading an older save or discovering a misplaced card. Show no shuffled order and add no recurring confirmation step. This is a convenience recommendation, not a rules defect.

## Sources, scope and limits

The publisher's [support page](https://www.legionwargames.com/legion_AGC_GS.html) was checked. Both currently linked Living Rulebooks were downloaded afresh: U.S. 13 April 2024 and British 7 August 2024. Their hashes match the project's prior audited copies; the displayed support-page date for the U.S. file differs from its filename. The current April 2024 errata was also inspected. Review emphasized Event timing (2.5/2.5.1, EN1.2, Reaction/LC6, E2/E3/E5/E6), end-turn card reset and the documented project rulings in `RULES_NOTES.md`.

- [U.S. Living Rules](https://www.legionwargames.com/docs/AGC_Living_Rulebook_US_Solo_as_of_13apr2024.pdf)
- [British Living Rules](https://www.legionwargames.com/docs/AGC_Living_Rulebook_British_Solo_as_of_7aug2024.pdf)
- [April 2024 errata](https://khybergames.com/legionwargames/docs/AGC_errata_and_clarifications_rev_13Apr2024.pdf)
- [Audited commit](https://github.com/ramyahoo88/A_Glorious_Chance_solo/commit/53656b345df49fefbddc2bc32e1a6a55a315c5a9)

This is implementation, rules-regression and usability evidence, not a balance study, a physical tabletop playtest, or an Android-device test. The purposeful policies are heuristics, not optimal players. Browser comparisons share the engine rules; separate invariants and Tally checks provide independent coverage, not a wholly independent implementation. Printed-table comparisons reused existing reference transcriptions; all 38 Event illustrations were not freshly rescanned. A new download of the official VASSAL module was unavailable in this environment, so A02 is carefully limited to its reproduced internal contradiction. Tests did not inspect or modify an existing user's browser storage.

## Reproduction

See `README.md` for commands and dependencies. `evidence/results/summary.json` pins source hashes; `evidence/results/rules-sources.json` pins the two rulebooks. `evidence/browser/` contains actual-control traces, screenshots and final campaign saves. The evidence ZIP contains the report and all audit scripts/fixtures. Run evidence-generating scripts on a copy to preserve the recorded originals.
