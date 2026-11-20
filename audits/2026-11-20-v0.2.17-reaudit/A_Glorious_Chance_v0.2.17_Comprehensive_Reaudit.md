# A Glorious Chance v0.2.17 - comprehensive re-audit

20 November 2026. Audited main: `4980c08b807c9fef8b307354b2984677effbafd2`.

**Verdict: normal campaign play passes the tested scenarios; a small recovery patch is recommended.** Two additional findings are confirmed: one Medium damaged-save validation gap and one Low physical-deck Undo instruction defect. The original v0.2.16 findings are fixed in their recorded cases, and the new Deck status panel passes. No new combat, scoring, deployment or Event-resolution defect was reproduced in ordinary play.

The public app, repository build and independent rebuild match: **422,019 bytes**, SHA-256 `8623b7a73cacdda6eb9095871be9b8ec8fde62113ba86bb2a2910ce3000f18e4`. This report documents findings and recommendations; it does not change the app.

## Findings

| ID | Severity | Confirmed problem | Recommended correction |
| --- | --- | --- | --- |
| A01 | Medium | A pending coastal Event save missing the phase's side-order list still loads, resolves its card, then stalls when the phase advances. | Validate the coastal continuation through the next side, including its order and cursor, before replacing the open game. |
| A02 | Low | Repeated Undo across a turn reset forgets that the physical cards may already have been reshuffled. It then gives the ordinary return-to-top instruction for the previous turn's smaller pile. | Preserve physical-deck reconciliation information through intermediate non-Event checkpoints, reload and save transfer. |

## A01 - coastal save validation stops too early

**Source:** `src/ui.js:260` (pending coastal Event validation) and `src/engine_coastal.js:52` (side continuation).

The v0.2.17 validator checks the selected Raid force or Land Battle, the current side, and the Raid/Army Support queues. It does not validate `parent.L.order`, which the suspended coastal procedure still needs after the card and current mission resolve.

Starting with the original audit's valid `coastal-asBattleEvent.json`, remove only `calls[calls.length - 2].L.order`. The resulting save passes `checkSaveState` and loads through the real Load dialog. Entering **23** resolves the Niagara Land Battle normally. Pressing **Continue** on **Land Battle result** then produces:

`Cannot read properties of undefined (reading '2')`

The same single-field deletion from the valid Raid checkpoint also passes. Enter **27**, Continue, enter **13** at the next Raid draw, then Continue: the same error occurs. The immediate Event return works; the later phase continuation cannot read its missing order list.

**Impact and limit:** this requires a damaged or edited file. No normal save was observed losing this field. The failed Continue action rolls back, and Undo can reach the previously open campaign, but the damaged imported position has already replaced the current campaign and autosave. It cannot continue normally from the displayed result.

**Recommended fix:** validate the expected `[ai, human]` order, an integer side cursor consistent with the current side, and the remaining phase data that this saved caller will traverse. Do this before import changes the campaign, unfinished input, Undo history or autosave. Do not reconstruct missing progress silently. Keep the legitimate case where launched Troops survive after their supporting Force disappears in a Harbor Encounter.

**Acceptance checks:** reject both new damaged fixtures atomically; continue their unmodified originals through the end of the Coastal Action Phase; retain all six valid Event contexts and the existing missing-support control.

**Evidence:** `evidence/probes.js`, `evidence/probes.json`, both `coastal-*-missing-order.json` files, `evidence/browser/additional.json`, and `damaged-coastal-continuation.png`. The Land Battle case was reproduced through Chromium's real import, number-entry and Continue controls.

## A02 - several Undos lose the reshuffle boundary

**Source:** `src/ui.js:1422` (`recordEventUndo`), `src/ui.js:1433` (physical restoration message), and the Event-only restoration check at `src/ui.js:378`.

A natural U.S. campaign, seed **986000**, with individual notices and the coastal player policy reaches the first Event draw of **June II** after **26 actual browser actions**. The prompt tells the player to shuffle all **38** physical cards. If the player follows that instruction and then uses **Undo ten times**, the app returns to the last Event draw of June I: the U.S. Raid on York.

The restored digital pile contains **34** cards. Its reminder says to return **#2** to the top, keep the other cards in their previous order, and not shuffle. It does not tell the player to separate the four cards that are used at this earlier checkpoint or rebuild the previous pile. The saved metadata incorrectly records `reshuffled: false`; reload preserves that message.

**Why:** the turn reset is crossed while restoring an ordinary information screen. `recordEventUndo` immediately returns for a non-Event prompt and retains no boundary information there. By the time the earlier Event prompt is reached, both adjacent states are again in June I, so the turn comparison cannot detect the earlier reshuffle. The existing test covers a grouped action crossing the boundary in one Undo; this reproduction crosses it through several normal checkpoints.

**Impact and limit:** digital state and RNG restore correctly. This is a physical-card reconciliation defect when the user has followed the new-turn shuffle instruction and then rewinds into the preceding turn. The 38-card physical pile no longer matches the 34-card restored pile. Deck status exposes the correct membership, but the displayed instruction does not direct the player to use it.

**Recommended fix:** carry a pending deck-reconciliation record through non-Event Undo positions and subsequent Undos. If a rewind crosses a reset, keep the rebuild-piles instruction until the physical deck has been reconciled. Preserve it through reload and save transfer, and avoid asserting that the previous order survives a shuffle. This can use the existing Deck status lists without adding a routine confirmation to every draw.

**Acceptance checks:** replay the supplied natural trace, Undo through all ten checkpoints, and verify that the earlier draw explicitly directs the player to restore its 34-card pile. Repeat with reload or save transfer during the intermediate checkpoints, and retain the existing first-entry, ordinary, Gale, exhaustion and grouped-boundary tests.

**Evidence:** `multi-undo-play-trace.json`, `multi-undo-start.json` (natural autosave plus Undo history), `multi-undo-restored.json`, `evidence/browser/additional.json`, and `multi-undo-lost-boundary.png`. `browser/additional.js` plays the trace through real controls from setup; it does not inject the restored state.

## Verification performed

| Area | Result |
| --- | --- |
| Existing regression suite | Passed all engine suites and 200 smoke campaigns. Physical Event suite: 32,287 assertions, 64 paired complete campaigns and 1,866 exact pending-entry continuations. The 303 v0.2.17 assertions passed, including 210 valid card continuations across all six callers. |
| DOM controls | All 11 historical suites, 32 physical-entry checks and 81 v0.2.17 checks passed. Historical suites retain their documented automatic-Event test fixture; the physical and recovery suites use production HTML. |
| Fresh physical campaigns | 160 completed: seeds 983000-983015, both sides, fleet/coast/cautious/screen/blockade policies. No invariant failures. |
| Fresh option combinations | 128 completed: seeds 984000-984063, both sides, all 64 combinations of six engine switches, coastal policy. No invariant failures. |
| Combined fresh coverage | 46,384 decisions; 9,857 physical entries; 11,200 exact saved continuations; 18 whole saved continuations spanning 2,462 actions; 1,497 manual Force Packages; 345 manual Land Battles; 575 first-round forecast comparisons; 1,498 read-only preview checks. |
| Independent invariants | Troops conservation, force membership/ownership, ship steps, duplicate cards/sinkings, track limits, Naval Balance, Tally VP components, ledger sums and victory thresholds. An independent physical deck asserts membership at every draw instead of repairing disagreements. |
| Full Chromium U.S. game | Seed 985001, fleet, 1440 px, individual notices: 169 actions, 39 entries, final score 0 (Draw). |
| Full Chromium British game | Seed 985002, coast, 390 px, grouped: 154 actions, 50 entries, final score +69 (U.S. Decisive Victory). |
| Browser persistence | Across those games: 14 pending-entry reloads, 10 exact Undo/replays, 11 Map inspections and 11 Deck status inspections. Every control matched the native reference; final VP ledgers agreed. No page errors. |
| Original fixes on live site | All three original malformed saves rejected atomically. First-entry, ordinary, Gale, exhaustion and grouped turn-reset Undo retain instructions through reload/Save transfer and replay exactly. Consecutive Event Undos, Intelligence disposition and Deck status pass. |
| Map and responsive layouts | 84 cases: six saved map positions, seven widths (320/360/390/412/768/1024/1440 px), inline and expanded map. No document overflow, label/badge collisions or hidden route endpoints in those cases. State unchanged by inspection. |
| Printed-data regressions | 648 Hit Distribution cases, 70 Lake Combat cells, 60 Convoy Scatter cells plus gun-band endpoints, Naval Balance bands, and 20 Tactic records match the existing independent transcriptions. |
| Release and download | Independent rebuild and bare public URL match. The live Download app control produces the same bytes and hash. Live focused layouts pass at 320/390/1024/1440 px. |

The two targeted findings above are additional probes, separate from the successful campaign totals. The malformed-save browser probe intentionally logs its caught error; ordinary browser campaigns and the original-fix/live checks report no page errors.

## Optional usability improvement

**Q01 - add Event deck status to Reference.** Reuse the existing read-only panel as a Reference topic so players can reconcile their cards immediately after loading or rewinding at any checkpoint. Keep the button beside Event entry as well. This adds no recurring play step and need not add another header button.

## Sources and limits

The publisher support page was checked again. Its currently linked U.S. and British Living Rulebooks were downloaded from the publisher's original domain after the linked mirror refused the downloads. Their bytes match the previously audited editions: U.S. 13 April 2024 and British 7 August 2024. The April 2024 errata was inspected again. Source URLs, retrieval results and hashes are recorded in `evidence/results/source-check.json`.

- Publisher support: https://www.legionwargames.com/legion_AGC_GS.html
- U.S. rules: https://www.legionwargames.com/docs/AGC_Living_Rulebook_US_Solo_as_of_13apr2024.pdf
- British rules: https://www.legionwargames.com/docs/AGC_Living_Rulebook_British_Solo_as_of_7aug2024.pdf
- Errata: https://www.legionwargames.com/docs/AGC_errata_and_clarifications_rev_13Apr2024.pdf

Review emphasized Event timing, Gale restrictions, coastal continuation, F7 card reset, Intelligence disposition and the existing project rulings in `RULES_NOTES.md`. The printed-data regressions reuse prior independent transcriptions; this audit did not freshly rescan all card artwork. The v0.2.17 source change is concentrated in Event recovery and its UI; deployment, combat and scoring also received regression and fresh-campaign checks.

The five player policies are purposeful legal heuristics using visible decisions. They are not optimized human players. The campaign outcomes demonstrate implementation coverage, not real-player win rates, balance or absence of all strategic exploits. Chromium 153.0.8010.0 was used; no physical tabletop, Android-device, Firefox or Safari test was performed.

## Reproduce

Run on a copy so the recorded evidence is preserved. Scripts accept the repository root as `.`. DOM tests require jsdom 26.1.0; browser scripts require Playwright and @sparticuz/chromium 153.0.0 on NODE_PATH.

```sh
npm test
npm run test:ui
python audits/2026-11-20-v0.2.17-reaudit/evidence/verify_release.py
AGC_POLICIES=fleet,coast,cautious,screen,blockade node audits/2026-11-20-v0.2.17-reaudit/evidence/campaign/sweep.js . 983000 16 fresh
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-20-v0.2.17-reaudit/evidence/campaign/sweep.js . 984000 64 options
node audits/2026-11-20-v0.2.17-reaudit/evidence/probes.js .
node audits/2026-11-20-v0.2.17-reaudit/evidence/browser/campaigns.js .
node audits/2026-11-20-v0.2.17-reaudit/evidence/browser/additional.js .
node audits/2026-11-20-v0.2.17-reaudit/evidence/browser/map-layout.js .
AGC_URL=https://ramyahoo88.github.io/A_Glorious_Chance_solo/ node audits/2026-11-20-v0.2.17-reaudit/evidence/browser/focused.js .
```

The evidence archive contains scripts, complete results, importable positions, browser traces and screenshots, plus a SHA-256 manifest. Some regression scripts deliberately reference the original audit fixtures already in this repository. No production file was changed during this audit.
