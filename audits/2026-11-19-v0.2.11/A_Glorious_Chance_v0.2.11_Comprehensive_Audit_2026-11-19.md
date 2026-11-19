# A Glorious Chance Solo v0.2.11

## Comprehensive follow-up audit · 19 November 2026

**Verdict — recommend a small corrective patch.** The release build and broad campaign checks pass. This audit confirms **one Medium and two Low defects**, plus **two new rules questions**. The Medium defect concerns optional ship corrections during an Encounter. Ordinary campaigns did not stall in the fresh test matrix. No Critical or High defect was confirmed within this scope.

This is an audit of the existing release. The accompanying evidence reproduces its behavior and records recommended corrections. It does not contain a gameplay patch or a new release.

| ID | Severity | Confirmed finding |
| --- | --- | --- |
| A01 | Medium | Adjust can move a ship off the lake while leaving it in the active Encounter and attacking column. |
| A02 | Low | Import accepts an unknown Event-card ID, then play stops when that card is drawn. |
| A03 | Low | A flagship that loses a Melee skips its required Leader Casualty Check. |

**Recommended order.** Guard or reconcile active ship corrections first. Validate saved card references before committing an import. Restore the losing flagship's Melee casualty roll while preserving the identity of the leader being resolved. Record rulings for the two timing and zero-gun questions below before changing those behaviors.

## Release identity and sources

| Item | Verified value |
| --- | --- |
| Repository | `ramyahoo88/A_Glorious_Chance_solo` |
| Audited main commit | `fe636b21e2ee0027c611acd873ebea89189ed057` |
| App version | v0.2.11 |
| Shipped HTML | `dist/index.html`, 367,635 bytes |
| HTML SHA-256 | `18b5ecf165f322f344bbd3df7e1bf4b0d1a9d9b747780beb8640213fa675d05e` |
| Independent rebuild | Byte-identical to the checked-in HTML |
| Public response | Same byte count and SHA-256 as the independent rebuild |

Public app — <https://ramyahoo88.github.io/A_Glorious_Chance_solo/>

Rules were downloaded afresh from the publisher's support materials. The source manifest in the evidence records their SHA-256 hashes.

- [British Living Rulebook, 7 August 2024](https://www.legionwargames.com/docs/AGC_Living_Rulebook_British_Solo_as_of_7aug2024.pdf), especially LC5.1 on printed pages 34–35 and 11.3.1–11.3.2 on pages 40–41.
- [U.S. Living Rulebook, 13 April 2024](https://www.legionwargames.com/docs/AGC_Living_Rulebook_US_Solo_as_of_13apr2024.pdf), including the corresponding leader and convoy procedures.
- [Living Playbook, 6 August 2024](https://www.legionwargames.com/docs/AGC_Living_Playbook_as_of_6Aug2024.pdf).
- [Errata and clarifications, 13 April 2024](https://www.legionwargames.com/docs/AGC_errata_and_clarifications_rev_13Apr2024.pdf).
- [Previous comprehensive audit and its component transcriptions](../2026-11-18-v0.2.11/). The current printed-table and Tactic-field checks reuse these independent transcriptions. They are reruns, not a claim that every physical card image was newly transcribed.

## What passed

| Check | Fresh result |
| --- | --- |
| Repository engine suite | 794 assertions passed, followed by 200 completed smoke campaigns with no failures |
| Repository UI suite | All seven DOM suites passed, including persistence, phone controls and grouped updates |
| Main campaign matrix | 1,600 of 1,600 completed, seeds 920000–920159, both sides and five policies |
| Option matrix | 128 of 128 completed, seeds 943000–943063, every combination of six settings for both sides |
| Independent end-of-turn scoring | 13,820 Tallies reconstructed across the two matrices, all matched |
| Save portability | 7,936 serialized round trips and 108 full cross-runtime continuations passed |
| Combat previews | 3,367 first-round calculations matched; 7,645 purity checks found no state or RNG change |
| Grouped versus individual pace | 160 paired campaigns, 13,687 exact state comparisons, all matched |
| Setup and deployment | 256 fresh setups and 5,632 package-selection checks passed against an independent oracle |
| Printed table regressions | 648 hit-distribution cells, 70 combat results, 60 convoy results and Naval Balance band boundaries matched |
| Tactic metadata | All 20 cards matched the retained independent transcription of deck, symbol, color, restriction and dummy status |
| Actual Chromium campaigns | U.S. seed 941119 and British seed 941120 completed through the public app's controls; full exported final states matched the DOM-control reference runs |

The campaign policies pursued concentrated fleet combat, coastal missions, cautious avoidance, separate screening Forces and blockades. The main matrix drew all 38 Event cards and encountered all 16 non-dummy Tactics. Its manual Land Battle cases reached all 15 table columns. These are observed coverage measures, not proof of every possible card interaction or estimates of human win rates.

The grouped-presentation comparison checked the entire serialized state, including hidden decks, logs and RNG, with only the presentation report excluded. Grouping removed 8,161 routine confirmations across these campaigns and automatically played 115 sole legal Tactics without changing the underlying game.

## A01 · Medium · A ship moved out of play can still attack

**Natural position.** U.S. campaign, seed 920000, fleet policy, June I, Command Decision in Sacket's. The importable file is `evidence/targeted/command.json`.

**Reproduce through the public app.** Load the position, open Adjust, select Oneida, set its box to Out of Play and Apply. Close Adjust and choose Attack. Oneida remains selected in the attacking lineup. Confirming the lineup places it in the combat column even though its saved box is still `outOfPlay`.

**Expected.** A correction must either be refused while an Encounter depends on that ship, or reconcile the Encounter, cached choices, column and pending procedure before play resumes. A removed ship must not remain an eligible attacker.

**Observed.** The edit succeeds with no warning. `ships.oneida.box` becomes `outOfPlay`, but `encounter.ships.oneida` remains `in`. Oneida remains in `prompt.candidates` and then in `combat.col.US`. The first-round preview still includes its 4.5 points of U.S. gunnery strength, displaying 31.5 rather than 27. In this particular position both strengths remain in the highest odds column. The evidence establishes incorrect participation and strength, not a changed final campaign result for this example.

The same edit is accepted at the Tactics choice and at a Gunnery Round results notice. At Tactics the next roll still uses 31.5 strength. The adjacent lineup-screen control correctly refuses the edit and explains why. This isolates the missing protection to other active combat windows. The public Chromium app reproduced the Command Decision case.

**Cause.** `src/ui.js`, the ship Apply handler around lines 1058–1090, protects `select` and `lineup` prompts but not `choice` or `info` prompts. Moving the ship removes it from its Force, while Encounter membership and cached combat lists survive. `encIds` in `src/engine_encounter.js` reads those memberships without checking the ship's current box.

**Recommended correction.** Extend the existing protection to any active Encounter or pending procedure that relies on the edited ship, including ships entering through a cached A.I. attack plan. Continue allowing unrelated hull and ordinary track corrections. A more permissive editor would need explicit reconciliation of all dependent state. Do not fix only the visible lineup.

**Acceptance checks.** Cover Command Decision, the A.I. attack notice, Tactics, round-result notices and the existing lineup guard. Check moving, transferring ownership and changing strength, plus a nearby unrelated construction hull. A rejected edit must preserve the draft, history, autosave and RNG. An allowed reconciled edit must exclude the ship from later attacks and hit allocation.

**Workaround.** Undo to a point before the affected Encounter opens, then make the ship correction.

## A02 · Low · An invalid Event reference passes the import check

**Controlled damaged-file case.** `evidence/targeted/unknown-event-save.json` is a natural saved position with exactly one intentional corruption. The next Event ID, `deck.event[0]`, was replaced with `999`. This is a robustness test. No ordinary exported save in the campaign matrix developed that corruption.

**Expected.** Import should identify the invalid card reference and preserve the current game, history and autosave.

**Observed.** Load accepts the file and replaces the current game. Five choices complete, then the next Event draw produces `Cannot read properties of undefined (reading 'id')`. The game's error handling contains the exception, but the imported position cannot continue through that draw as intended. The prior game remains reachable through Undo history, which limits the severity. This is not evidence of permanent loss of a valid save.

**Cause.** `checkSaveState` in `src/ui.js` validates the outer deck object but not the identities in its piles. `drawEvent` in `src/engine_core.js` retrieves `EVENTS[id]` without validating the reference.

**Recommended correction.** Check that each pile is an array and every entry names a card valid for that pile. Apply equivalent checks to pending card references. Preserve legitimate empty piles and the distinct dummy IDs. Reject the import before committing it, with a message naming the damaged field. Do not demand one complete deck across all piles because cards may legitimately be drawn, displayed or retained elsewhere.

**Acceptance checks.** Unknown Event, wrong-deck Tactic and unknown Target IDs are rejected without replacing a valid game. Valid exhausted piles, held Intelligence cards, mid-Tactics saves and older supported exports still load. Existing interrupted-import and storage-quota tests should remain green.

## A03 · Low · The losing flagship omits its Melee casualty roll

**Natural position.** U.S. campaign, seed 920016, fleet policy, August I. Load `evidence/targeted/melee-loser-before.json` at Weather Gage recheck and Continue. Royal George captures the American flagship Fair American in Melee.

**Rule.** LC5.1 requires a casualty check for each flagship participating in a resolved Melee. The winner uses +1 and the loser uses +2. The capture procedure separately handles a surviving leader. This was checked in the rendered British rulebook, printed pages 34–35, and the corresponding U.S. text.

**Observed.** The winning British flagship makes its check, and Yeo dies on 12+1. The losing American flagship makes no check. Chauncey is immediately marked captured and Sinclair takes command. The natural replay's log contains the British check and no American check.

**Cause.** `src/engine_combat.js`, `ca2`, around lines 627–633, calls `leaderCheck` for the winner only, then passes a capture fate for the losing flagship directly to `captureShip`.

**Impact.** In this example the original losing commander leaves play either way, so the immediate replacement is the same. The required dice are omitted and the recorded fate is always capture. Adding the roll also changes the subsequent seeded dice stream. No claim is made that this alone changes balance or the tier of this particular campaign.

**Recommended correction.** Resolve the losing flagship's check with its appropriate modifiers before capture, and resolve death or capture of that same leader once. Avoid accidentally applying the capture to a newly installed successor. Pair this work with a clear resolution of Q01 below.

**Acceptance checks.** Include winner-only, loser-only and both-flagship Melees; a no-result Melee; the U.S. Grapple modifier; and a save/reload immediately before resolution. Confirm the casualty log, RNG advancement and one succession per resolved leader.

## Two new rules questions

These observations are reproducible, but the cited materials do not settle every relevant timing or zero-strength boundary clearly enough to label the implementation wrong.

### Q01 · Can one simultaneous hit result remove successive commanders?

In U.S. seed 920023, screen policy, August II, load `double-leader-before.json` and choose Attack. Madison takes three hits in one Gunnery Round result. The first casualty check kills Chauncey, the second kills Sinclair, and the third checks a generic leader. Madison then sinks, and the generic leader is recorded captured. The U.S. succession state advances from 0 to 2 in that single result.

The code replaces a killed leader immediately and `leaderAlive` always returns true. LC5.1 specifies per-hit checks, succession and capture of a still-living leader, but gives no explicit boundary for installing the successor within one simultaneous damage result.

**Recommendation for a recorded ruling.** Resolve the fate of the leader present at the start of the result, then install the successor after that result is finished. If the project instead intends immediate succession between individual hits, document that explicitly. Add tests for multiple hits, last-step sinking or striking, and flag transfer after the casualty. This audit does not choose a timing rule on the publisher's behalf.

### Q02 · What happens when an unescorted convoy meets zero eligible guns?

In British seed 920011, fleet policy, August II, load `zero-guns-before.json` and Continue. A reduced Royal George finds an unescorted American convoy. The app excludes its guns, obtains zero, consumes a d10 roll and assigns Convoy Scatters. The convoy's supply arrival is delayed.

Rule 11.3.1 excludes reduced ships' guns, while the printed Scatter table starts at one gun. The explicit full-strength attacker condition in 11.3.2 concerns escorted convoys. The unescorted zero-gun boundary is not assigned a table row.

**Recommendation for a recorded ruling.** Require at least one eligible gun before resolving a convoy attack, leaving the convoy unaffected otherwise. If a different zero-gun convention is intended, state it in the reference notes. Test zero, one and 21 guns, plus an escort reduced during combat. The current unconditional scatter comes from `scatterRoll` in `src/engine_deploy.js`, around lines 471–476.

The earlier report's standing questions remain open, including Pursuit and optional withdrawal, OA1 recalculation, Rainy Squalls timing, Tactic recycling and Defender Rake, the two unassigned Aid VII rolls, Package 8 selection conventions, construction eligibility and the Harbor edge cases. This audit found no new publisher ruling resolving them.

## Browser and quality-of-life review

The public Chromium app completed **272 recorded campaign prompts** across the two fresh games. The U.S. run used grouped updates; the British run used individual updates. The final exported game states, including logs, RNG and scoring ledgers, exactly matched runs of the same controls in the shipped HTML under DOM emulation.

| Campaign | Seed | Final score | Result |
| --- | --- | --- | --- |
| U.S. player, grouped updates | 941119 | -23 | British Victory |
| British player, individual updates | 941120 | +8 | Draw |

An actual U.S. combat stop was saved, advanced and undone. The restored state matched exactly. Reloading the page and choosing Continue it also restored that state exactly. Save download and pasted import worked. The existing browser position was backed up before testing and restored afterward.

The controls remained usable through assignments, target allocation, combat, coastal resolution and scoring. The final ledger and grouped-report controls were visually inspected. The live browser independently reproduced A01. The local Chromium executable could not start because the execution environment denied a socket operation, so the browser checks used the cloud Chromium session. The seed field required real keyboard input in this automation environment; a synthetic fill did not trigger its change handler. That tooling behavior is not counted as an application defect.

Two optional improvements would help everyday use without adding rules administration.

1. Add **Download app (.html)** on the setup or reference screen. The in-game Save control exports a position. A separately named app download would make the offline-copy workflow easier to discover.
2. Add a **text search across the full log**, alongside the existing category filter. Searching a ship name, card number or phase would make long combat histories and manual-correction review quicker.

The more important usability improvement is part of A01's fix. Explain a blocked ship correction before the player spends time changing its fields, using the same clear guidance already shown at lineup and reaction decisions.

## Evidence and limits

The ZIP contains the scripts, seed matrices, complete test logs, importable natural positions, controlled damaged save, actual browser exports and screenshots. Its `README.md` gives replay commands and distinguishes natural positions from synthetic corruption. `manifest.json` hashes every evidence file. `source-manifest.json` identifies the audited build and publisher documents.

The broad sweep and scoring checks reuse the prior audit harness with new seeds. Their checks are independent of the production scoring routines where described, but do not establish independent correctness of every preceding rules decision. In particular, scoring reconstruction accepts the resulting Lake Control markers; separate boundary tests check their placement. Scripted play is useful for coverage and reproducibility, not human difficulty or strategy balance.

No new physical-phone session, Safari or Firefox run, screen-reader session, or timed tabletop counter-moving test was performed. The phone-specific DOM suites passed, but those do not constitute a fresh mobile visual audit. Actual offline browser behavior was not newly measured. The single-file app ran in DOM emulation, and its public and rebuilt bytes matched.

**Release recommendation.** Prepare a patch for A01–A03 and document the two new rulings. Until then, avoid active-Encounter ship corrections and retain an earlier valid save. The ordinary campaign, scoring, save-continuation and release checks support the current build's stability within the tested scope.
