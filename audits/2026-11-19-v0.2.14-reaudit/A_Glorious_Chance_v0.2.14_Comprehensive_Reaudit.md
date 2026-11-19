# A Glorious Chance v0.2.14 - comprehensive re-audit

19 November 2026. Audited `main` at `c8073ddd7d639b0f0c68b64f6d319a711c5c2bea`.

**Verdict: gameplay and persistence checks pass; recommend a small corrective release for four display defects (one Medium, three Low).** No Critical or High defect was confirmed. The map records and displays the correct final ship positions, but port inspection is incomplete, some intermediate movements are omitted, and route readability still has edge cases. This audit does not change or publish application code.

The live app, independently assembled release, and actual **Download app (.html)** output are identical: **394,415 bytes**, SHA-256 **`e8ad1b71f9a30710de520dec11c640b064e53768b3f7d3d52b8cdaa99a650f4e`**. The game engine and card/table data are unchanged from v0.2.13; the engine source difference is its version stamp.

## Confirmed findings

| ID | Severity | Finding | Consequence |
| --- | --- | --- | --- |
| A01 | Medium | Port dialogs omit every ship | The map advertises ship inspection, but clicking an occupied port shows only box headings. |
| A02 | Low | A single automatic sequence can omit an intermediate move | The report can show a direct voyage that skips a deployment and subsequent displacement. Final position and gameplay remain correct. |
| A03 | Low | Route labels and arrowheads can still overlap other map content | Shared routes hide number badges; crowded zone labels and wrapped port labels cover arrowheads. |
| A04 | Low | Tracks overflow at narrow desktop widths | At a 1,024 px viewport, the page extends to 1,057 px and the rightmost British supply spaces fall offscreen. |

### A01 - occupied port inspection has headings but no ships

**Reproduction:** start a new U.S. campaign, seed **973000**, then tap **Sacket's Harbor** on the map. The port says **16 ships, 14 Deployable**. The dialog contains `Deployable` and `Construction` headings and **zero ship buttons**. Kingston similarly reports six ships and displays none. The real Chromium reproduction and a separate DOM reproduction agree.

**Cause:** `src/ui_map.js:49` calls `body.appendChild(heading, shipGrid)`. DOM `appendChild` accepts only one node, so the ship grid is constructed and discarded. The same mistake appears in the optional beached-ship branch at line 41. The normal port bug is directly reproduced; no separate naturally reached beached case is claimed.

**Recommended correction:** append both nodes with `append`, or append each independently. Cover homeports, temporary ports and Escort boxes. Require the number of inspectable ship chips to match the displayed port total; check at least two occupied boxes. The current map test checks only for a heading, which misses this failure.

**Workaround:** the existing full homeport lists on the main board still expose the ships.

Evidence: `evidence/browser/findings.json`, `evidence/browser/empty-port-390.png`, `evidence/browser/findings.js`.

### A02 - intermediate moves collapse into the final destination

**Natural reproduction:** load `evidence/intermediate-omitted-before.json`, a U.S. campaign at seed **971000**, with individual AI notices disabled. It is the **A7 Assign your ships** decision before action 38. Use the recorded assignment in `evidence/map-audit.json`: Oneida and Madison undertake Army Support at Niagara, with the remaining selected ships patrolling Kingston.

The actual sequence is:

1. Oneida deploys from Sacket's Harbor to **Niagara** on Army Support.
2. The British deploy at Niagara.
3. **Separated Ships (U.S.), Event #11**, displaces Oneida from **Niagara to York**, as a new Patrol Force.

The resulting map report instead gives Oneida a single **Sacket's Harbor -> York, Patrol** move. Niagara is absent from Oneida's recorded route. This is reproduced through the shipped assignment controls in Chromium; the game log separately records the displacement. The final York position is correct.

**Cause:** `src/ui_table.js:119-122` takes a snapshot around the complete `act()` call. That call can execute several procedure handlers before it produces a new prompt. The map therefore retains transitions between prompts, while intermediate steps inside one call can be lost. Grouping multiple calls preserves their order but does not recover these internal steps.

The observational harness records **28 affected actions across 128 paired campaigns and 12,381 actions**. These are test-sample counts, not an estimate of a human player's frequency. The map-on state still matches the direct engine after every action.

**Recommended correction:** capture public movement events at completed movement/procedure boundaries and preserve their order through automatic sequences, grouped notices, saves and Undo. Keep the recorder observational. Add a test that checks the actual path and mission changes, as well as the final game state. Do not invent intermediate moves from only the final position.

Evidence: `evidence/map-audit.js`, `evidence/map-audit.json`, before/after save pair, `evidence/browser/missing-intermediate-move.png` and `findings.json`.

### A03 - route collision handling does not cover common shared or crowded paths

Two naturally reached examples establish this finding:

* **Shared route:** seed **971000**, first A7 assignment, sends a Patrol and an Escort separately from Sacket's Harbor to Sacket's zone. Their badges **2 and 3 overlap**, on desktop and phone, with badge 3 partly covering badge 2. At 390 px the badge rectangles overlap by about **272 square pixels** on the board. The route text remains correct.
* **Crowded destination:** British campaign seed **971012**, after action 59, has York showing both fleets, their missions, control, blockade, Encounter and Convoy. The Escort-box-to-York arrow ends **under the York panel**. A withdrawal example also has its Kingston Harbour arrowhead hidden by the wrapped phone port label.

**Cause:** `src/ui_map.js:86-101` estimates label size from a fixed height and the number of factions. It does not account for wrapped text or the extra status rows. Badge positions at lines 106-108 use route midpoints without collision checking; the small three-value bend repeats across routes.

**Recommended correction:** clip routes against the actual rendered bounds of labels, including wrapped port text and all zone notes. Allocate sufficient spacing for multiple paths sharing endpoints, and place badges clear of other badges and map labels. Check the board and expanded map after viewport changes. The written movement list should stay available.

The visual sweep covers **70 layouts**: five natural positions, seven widths (320, 360, 390, 412, 768, 1,024 and 1,440 px), in both board and dialog views. It found hidden arrow endpoints in 30 layouts and badge collisions in 14. These are repeated renderings of selected fixtures, not independent game occurrences. Screenshots were inspected to confirm the geometric findings.

Evidence: `evidence/browser/map-layout.js`, `map-layout.json`, `shared-routes-after-390.png`, `crowded-390.png`, and desktop/withdrawal screenshots.

### A04 - the two-column Tracks panel is too wide near the desktop breakpoint

**Reproduction:** load `evidence/crowded.json` at **1,024 x 900 px**, then inspect the Tracks panel. The viewport is 1,024 px, while the document is **1,057 px** wide. The British Convoy Supply row extends to x=1,057.125; spaces **11 and 12** start beyond the visible right edge. This also occurs in the other four layout fixtures at 1,024 px.

**Cause:** `src/style.css:99` gives Tracks two `1fr` columns with intrinsic minimum widths; its 14 supply spaces consume 236 px per row. The main layout still has two columns just above its 1,000 px breakpoint, leaving insufficient room. The existing small-screen Tracks breakpoint does not cover this narrower desktop panel. This CSS predates the map release.

**Recommended correction:** make Tracks respond to its available panel width, or switch it to one column across the affected desktop range. Preserve the full supply scale and test immediately above and below the main-layout breakpoint. Avoid merely hiding the overflow.

Evidence: `evidence/browser/overflow.json`; the layout sweep also records document overflow.

## Quality-of-life recommendation

**Q01 - return to the previous map view after inspection.** From **Map**, selecting a fleet replaces the map with its zone details. Selecting a ship replaces those details; **Close** then returns all the way to the main board. Add **Back to map** / **Back to fleet**, or a small modal navigation stack, and preserve the map's scroll position and keyboard focus. This is an optional navigation improvement, separate from the four defects. No game state changed while reproducing it.

## Verification performed

| Check | Result |
| --- | --- |
| Existing baseline | **861 engine assertions and 200 smoke campaigns passed**; all **10 DOM/control suites passed**, including 63 map checks. |
| Fresh primary campaigns | **640/640 completed**, seeds 970000-970063, both sides, five purposeful policies: fleet, coastal, cautious, screens and blockade. **81,823 decisions**, no invariant failure. |
| Option coverage | **128/128 completed**, seeds 972000-972063, both sides, all 64 combinations of the six tested options per side. **16,657 decisions**, no invariant failure. |
| Scoring and legal state | **6,144 Tallies** independently reconstructed; troop conservation, VP ledger, supply limits, ship steps/ownership, force membership and termination checked throughout the 768 campaigns. |
| Saves and combat preview | **3,549 exact saved-checkpoint continuations**, **48 complete save-to-end continuations**, **3,441 preview-purity checks**, and **1,505 first-round strength comparisons** passed. These continuations are not counted as extra independent games. |
| Map equivalence | **128 complete paired campaigns**, seeds 971000-971015, both sides and all four grouping/AI-notice combinations; **12,381 actions**, **9,708 movement groups**, **892 map-save checks**. Complete state, dice, decks, log and result match direct play after every action. |
| Complete browser games | Chromium **153.0.8010.0**, shipped unmodified HTML. U.S. seed **973001**, fleet policy, desktop: **110 actions**, final **-22, British Victory**. British seed **973002**, coastal policy, 390 px, grouped: **97 actions**, final **+15, U.S. Marginal Victory**. |
| Browser persistence | Both full browser games match the complete reference JSON after every action. Together: **6 Undo/replay checks**, **4 reloads**, **10 map/focus/Escape checks**, no page errors. Final scores agree with the full VP ledger. |
| Privacy and inspection | Hidden-marker/deck variants leave rendered map HTML unchanged. Opening the map, inspecting a fleet/ship, closing dialogs and changing viewport do not change the campaign. |
| Established printed-reference checks | All **648 Aid VI die/column combinations**, **70 Lake Combat cells**, **60 Convoy Scatter results** (both gun-band endpoints), Naval Balance boundaries and **20 Tactic card metadata records** match the previously transcribed reference values. |
| Release/download | Independent assembly, live HTTP response and actual browser app download all match the audited HTML exactly. |

The primary and option sweeps deliberately include different legal plans and conservative decisions. They are rules/regression checks, not optimal play or a balance measurement. No win-rate recommendation follows from them.

## Scope and limits

This pass reviewed the source changes, map geometry and reporting boundaries, persistence/hidden-information behavior, previous fixes, fresh complete campaigns and browser interaction. The fresh gameplay sweeps reuse the established audit's independently reconstructed scoring checks and public-information policies; the new movement audit separately observes procedure transitions.

The official publisher support page still lists the U.S. Living Rules, British Living Rules and Living Playbook editions used by this project. The PDF itself dates the U.S. revision **13 April 2024**, although the support link label says April 3. The full rulebook/artwork transcription was not repeated in this pass. Established printed-reference checks were rerun, and the documented project rulings in `RULES_NOTES.md` remain the model's assumptions. No new rules ruling is requested here.

Browser checks use isolated automated Chromium and CSS viewport sizes. They do not establish actual Android hardware, Safari, Firefox, screen-reader speech or physical tabletop usability. An existing automated map-equivalence test passed even though A01-A03 remained: it verifies gameplay preservation, not complete visual or movement-history fidelity.

Sources: [publisher support](https://www.legionwargames.com/legion_AGC_GS.html); [U.S. Living Rules](https://www.legionwargames.com/docs/AGC_Living_Rulebook_US_Solo_as_of_13apr2024.pdf); [audited commit](https://github.com/ramyahoo88/A_Glorious_Chance_solo/commit/c8073ddd7d639b0f0c68b64f6d319a711c5c2bea); `RULES_NOTES.md`; the v0.2.12 re-audit and v0.2.13/v0.2.14 verification directories in this repository.

## Recommended next release

Correct A01-A04 and add Q01. Prioritize the missing port ships, then ordered movement recording, route geometry and the narrow desktop Tracks layout. Re-run the focused fixtures and existing suites; no gameplay or difficulty adjustment is indicated by this audit.

[Reproduction instructions](evidence/README.md) accompany the scripts, importable before/after positions, raw measurements and screenshots.
