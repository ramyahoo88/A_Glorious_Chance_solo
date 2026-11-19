# A Glorious Chance Solo v0.2.12

## Comprehensive re-audit - 19 November 2026

**Verdict: stable in the tested normal-play paths; two Low findings merit a small follow-up patch.** No Critical, High or Medium defect was confirmed. The previous v0.2.12 corrections pass. Fresh campaign, scoring, save-continuation, component and live-browser checks pass. The findings concern a misleading towing preview and acceptance of a deliberately damaged save, rather than a demonstrated error in an ordinary campaign's combat resolution.

This report audits the existing release. It does not implement these new recommendations or change the published app.

| ID | Severity | Confirmed finding |
| --- | --- | --- |
| A01 | Low | The lineup's untowed-schooner count does not account for Missed Signal, although the combat roll does. |
| A02 | Low | A save with missing or null procedure-frame locals imports successfully, then cannot advance. |

**Recommendation:** correct A01's preview and reject A02's incomplete frame before replacing the open game. Neither requires a rules or balance change. Two optional clarity/accessibility improvements are described below. There is no new publisher ruling to apply in this report.

## Release and source identity

| Item | Verified value |
| --- | --- |
| Repository | ramyahoo88/A_Glorious_Chance_solo |
| Audited main commit | `567e1b02cdb93dbfe979a35b04f17010816467e7` |
| Version | v0.2.12 |
| Shipped HTML | 376,291 bytes |
| SHA-256 | `d2ab3fa85b39cc6bb6d5a9c338edc8f0e7387d9ab578114e3ca61dc5049200bf` |
| Independent assembly | Exactly matches dist/index.html |
| Actual Chrome app download | Same bytes and hash as dist/index.html |

[Public app](https://ramyahoo88.github.io/A_Glorious_Chance_solo/). [Audited source](https://github.com/ramyahoo88/A_Glorious_Chance_solo/tree/567e1b02cdb93dbfe979a35b04f17010816467e7).

The [publisher support page](https://www.legionwargames.com/legion_AGC_GS.html) was checked again. It still links the British Living Rules dated 7 August 2024, U.S. Living Rules dated 13 April 2024, Living Playbook dated 6 August 2024 and 13 April 2024 errata. The page's April labels omit the digit 1; the linked filenames identify 13 April. This review reused the retained publisher PDFs and independent component transcriptions from the earlier audit. The evidence manifest records their source URLs and hashes; this is not a claim that all component artwork was newly transcribed.

Rules evidence includes British LC4.2 for untowed-schooner penalties and LC5.3 for zero-step ships. Published rules, recorded project interpretations and optional interface recommendations remain separate. The standing questions in RULES_NOTES 87-88 remain unresolved; this audit does not silently replace those conventions.

## Validation results

| Check | Result |
| --- | --- |
| Repository engine suite | 861 assertions passed; 200 smoke campaigns completed without failure |
| Repository interface suite | All eight DOM/control suites passed, including 118 v0.2.12 checks |
| Fresh main matrix | 1,600/1,600 completed; seeds 960000-960159; both sides; five policies |
| Option matrix | 128/128 completed; seeds 962000-962063; all 64 combinations of six settings for each side |
| Main + option decisions | 220,617; no checked invariant failure |
| Independent Tally reconstruction | 13,820 turn scores matched |
| Saved continuations | 7,963 serialized checkpoints; 108 separately instantiated full continuations to game end; all matched |
| First-round strength previews | 3,396 comparisons matched; this check does not cover the separate untowed-count label in A01 |
| Preview purity | 7,770 checks found no state or RNG change |
| Grouped vs individual pace | 160 paired campaigns, seeds 963000-963079; 13,686 exact state comparisons passed |
| Setup/package oracle | 256 setups and 5,632 full-strength package selections passed |
| Component regressions | 648 Hit Distribution cells, 70 combat results, 60 convoy results, Naval Balance boundaries and 20 Tactic metadata records matched |
| Live Chrome campaign | British seed 965119; 118 prompts; +7 Draw; complete state, log and RNG matched the DOM-control reference |
| Live reload/download | Exact saved-state reload; clean app download matches the release bytes |

The five main policies seek concentrated fleet combat, coastal operations, cautious avoidance, screening with separate Forces and blockades. They choose from human-visible information. Hidden state is inspected for post-action invariants, not to improve their decisions. All 38 Event IDs and all 16 non-dummy Tactics appeared in the main run; manual Land Battles reached all 15 table columns.

The option run varies Cutting-Out, OA1, manual packages, manual Land Battles, individual notices and the American A.I. precondition interpretation. The separate paired run covers grouped presentation. Grouping removed 8,163 routine confirmations and automatically selected 144 sole legal Tactics while preserving the complete game state, apart from its presentation report.

Scoring reconstruction independently totals losses, control awards, land effects, raids, untransported Troops and Fall Offensive awards using the resolved board and displayed rolls. It is not an independent proof of every preceding rules decision. These policies and sample counts do not measure human win rates, difficulty or optimal strategy.

## A01 - Low: Missed Signal makes the towing preview misleading

**Natural reproduction.** Load `evidence/targeted/missed-tower.json`: U.S. seed 961377, fleet policy, July II, at "Lake Combat - choose your attacking ships." Madison is towing Gov. Tompkins in the selected lineup, but Madison must sit out the first Round under Missed Signal.

The lineup says **7 untowed Laker Schooners**, with the -2 threshold at half of seven. After accepting the lineup, choosing Pursuit and continuing, the actual Gunnery result correctly uses **8 untowed Laker Schooners**. In this natural roll, d6=2 gives -2 either way. A d6=4 would distinguish the displayed seven-ship threshold from the actual eight-ship threshold, so the error can mislead a decision even though this example's roll is resolved correctly.

**Cause.** `src/ui.js`, renderLineup, counts every selected schooner and treats all entries in the proposed tow map as effective. Later in that function the strength preview correctly removes Missed Signal. `src/engine_combat.js` instead uses the actual Round attackers and adjacent surviving tow pairs when counting untowed schooners. The two displayed forecasts therefore use different participation sets.

A nearby natural control, `tow-preview.json` (U.S. 961019, fleet, June II), sidelines Growler itself. The label counts nine untowed schooners while only eight participate. Both directions of the mismatch are reproduced by `targeted/render-checks.js`.

**Smallest correction.** Derive the label from the same first-Round column used for combat: remove the Missed Signal ship, retain only valid adjacent towing pairs, then count the remaining untowed schooners. Show the resulting integer die ranges when helpful. Preserve the pure-preview behavior: no dice, state, log or Undo changes while editing the lineup.

**Acceptance checks.** Cover a missing tower, a missing schooner, the Event already spent, a user removing either member of a tow, and an ordinary unaffected lineup. Check the number and penalty thresholds, not only the strength ratio. The live app reproduced the 7-versus-8 mismatch; the supplied screenshots and exported combat stop record it.

## A02 - Low: incomplete procedure data is accepted on import

**Controlled damaged-save reproduction.** Start from the valid British seed 966001 at A1 and delete `state.calls[0].L`. The resulting `missing-frame-locals.json` is explicitly a damaged test file, not a natural game failure. Import it over another campaign and choose "June I (this turn)."

The import succeeds. The next action stops with **Cannot set properties of undefined (setting 'upN')**. Setting that same field to null also imports, then produces the corresponding null error. `targeted/import-checks.js` reproduces both cases through the shipped page's controls.

**Cause.** `src/ui.js`, checkSaveState, verifies that the procedure and continuation handler exist, but its optional test of frame locals allows missing and null `L`. The runner then reaches British A2up and writes `f.L.upN`. Every frame in a normal running save has an object for its locals. Accepting an incomplete frame therefore installs a game that cannot continue.

**Impact and safeguards.** The failed action rolls back to the imported position without consuming its dice. Undo successfully restores the campaign that was open before import; this was also verified in live Chrome. There is no confirmed loss of a valid campaign and no such failure in the natural campaign matrix. The defect is that an invalid file is accepted and autosaved instead of being refused at the import boundary.

**Smallest correction.** Require each saved frame's `L` to be a non-null, non-array object before committing the import. Do not silently replace missing locals with an empty object: later procedures may require values that were already computed. Check procedure-specific required locals where practical while preserving explicitly supported older-save migrations.

**Acceptance checks.** Reject missing, null and array locals without changing the open game, autosave or Undo history. Accept a valid empty locals object at the initial A1 stop and valid populated locals in mid-combat. The valid A1 control advanced normally. The earlier unknown-Event corruption was still refused before replacement, confirming that the v0.2.12 card validation fix remains effective.

## Previous corrections and reviewed leads

The focused engine and interface suites recheck Encounter-wide Adjust locks, malformed card references, winning and losing Flagship Melee checks, deferred commander succession, zero-gun Convoy handling, offline download and log search. All passed. The original natural combat and convoy replay outputs are retained again as `evidence/natural-replays.json`.

The broad runs include saved continuations and preview-purity checks, not only final scores. The live download also independently confirms the follow-up correction that excludes injected browser overlays from exported HTML.

A diagnostic search scanned 2,268 additional seeded policy cases to obtain the natural display positions. These searches are reported separately from the invariant-checked campaign matrix. One apparent zero-step A.I. precondition discrepancy was excluded: the saved position is a first Breakout attack, where the actual procedure waives the precondition. Calling the helper with the waiver disabled did not represent the real decision. `candidate-disposition.json` records the rejection of that lead; it is not a confirmed rules finding or a requested gameplay change.

## Optional usability improvements

**Q01 - Make No Steps explicit.** In the natural British seed 961000, coast policy, July II, Sir Sidney Smith loses both steps and gets Fight On. The result text correctly states that her combat strengths are zero. Her chip still shows the printed Reduced values `0-1-2-0`, accompanied by two empty step dots. The ship-details table is explicitly labeled "Printed counter strengths."

Keep that printed reference, but add a conspicuous **No Steps - combat strengths 0** badge while a ship remains Engaged at zero steps. This reduces the need to reconcile the chip with an earlier result message. It is a clarity recommendation; the tested combat calculation correctly returns four zero strengths. `zero-strength-chip.json` preserves the natural example.

**Q02 - Label all ship-correction fields.** Adjust's ship, destination box, steps and owner controls rely on nearby visual text rather than associated labels. Give each an explicit accessible name. Retain the Encounter-lock explanation and safe rejection behavior. This should make keyboard and assistive-technology use clearer without adding another confirmation or changing play. No screen-reader session was conducted in this audit.

## Live browser verification and limits

British seed 965119 was played through the public app's actual controls with grouped updates. The 118 prompts covered assignments, upgrades, combat, coastal actions and scoring. Final gross points were U.S. 39 and British 32, yielding +7 Draw. Recomputing the exported VP ledger gave the same result. The complete final state, including the full log, hidden decks and RNG cursor, matched the DOM-control reference exactly.

Reload and Review restored that final save byte for byte. The actual app download contained 376,291 bytes and matched the independent rebuild and release hash. A01 and A02 were separately reproduced on the public app. The pre-existing user campaign and all 60 available Undo steps were restored after testing; its private contents are excluded from the evidence.

This audit adds one full live British campaign; it does not claim a new full U.S. browser campaign. Both sides were exercised by the engine and DOM suites. No new physical-phone, Firefox, Safari, screen-reader, network-disconnected browser or timed tabletop-counter session was performed. The downloadable single-file build was exercised by the DOM suites, but a real browser opened with networking disabled was not measured here.

**Release assessment.** The evidence supports continuing to use v0.2.12 within the stated scope. A short follow-up patch for A01-A02 is advisable. The optional display/accessibility recommendations can accompany it. No new balancing adjustment or rules redesign is justified by this audit.

## Evidence and reproduction

The accompanying ZIP contains scripts, importable positions, test output, seed matrices, browser exports and screenshots. The evidence README gives exact commands and distinguishes natural positions, deliberate corruption and a rejected diagnostic lead. `evidence/manifest.json` hashes the evidence files. The application source and release bytes were not changed by this audit.
