# A Glorious Chance Solo
## Comprehensive audit and v0.2.9 release
**18 November 2026 · Fresh games, rules, player controls and quality of life**

**Verdict: hold v0.2.8; release v0.2.9 under the documented rule interpretations.** This audit confirmed 28 groups of defects and implemented their smallest practical fixes. All confirmed findings in this report are fixed. The most serious affected simultaneous repair/upgrades, repeated Rake damage and scoring, later A.I. attack composition, and saves created through Adjust.

The review covers both solo campaigns from setup through final scoring. It also independently checked Claude's newly posted v0.2.8 audit, retained that document in the repository, and distinguished its confirmed findings from unresolved interpretations. Finding IDs F01–F28 are local to this report; they do not reuse the meaning of IDs in earlier audits.

The user stated there are no prior saves. Historical migration code was therefore left unchanged. Save tests concern positions produced during current play, malformed imports, Undo, reload and autosave. Older-format fixtures serve as reproducible legal board positions, not as an audit of historical repair algorithms.

| Release | Immutable code commit | Shipped HTML |
|---|---|---|
| Reviewed baseline | `ffd7317bf3c41b45d8ad8443073d1e5c47d17c34` | 308,978 bytes; rebuilt identically |
| Corrected release | `6dc43ca1dc9fd195dcffed67155767514bc11582` | 324,911 bytes; rebuilt identically |

**Final SHA-256:** `ffa43b5dd90a5540c2757cb6701d8742e8a1eff8beba51a6ec27d4b1f7c815c4`

The unmodified builder ran from committed source in a separate temporary directory; `cmp` returned 0 against the committed `dist/index.html`. The public site returned HTTP 200 with the exact same bytes and hash. Native Chrome showed v0.2.9 and completed both reference campaigns through the live controls. Main and release/v0.2.9 contain the code commit above; Pages was updated at `6a8ac8c553577a724e97b4f17103a64e5e221777`.

[Play the verified public app](https://ramyahoo88.github.io/A_Glorious_Chance_solo/) · [Code changes](https://github.com/ramyahoo88/A_Glorious_Chance_solo/compare/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34...6dc43ca1dc9fd195dcffed67155767514bc11582)

---
## Authority and rendered components

Expected behavior came from the printed rules, card faces, table layouts and agreed project rulings before comparison with the implementation. Extracted text was a search aid: both printed columns, diagrams and table subcolumns were read in rendered form when they determined timing, priority or membership.

| Source | Version and inspection |
|---|---|
| British Living Rulebook | 7 August 2024; 46 pages. Setup, A–F sequence, repairs diagram, Encounter Cycle, Lake Combat, coastal actions and scoring. |
| U.S. Living Rulebook | 13 April 2024; 46 pages. Campaign-specific differences, upgrades, deployment and Force Packages. |
| Living Playbook | 6 August 2024; 20 pages. Examples, optional rules, including OA1 and the concurrent repair/upgrade example. |
| Errata and clarifications | 13 April 2024; all five rendered pages. |
| Cards and aids | VASSAL v1.0 artwork; all 104 Target Cards, 38 Event faces and 20 Tactic deck entries (16 active, four Dummy). User's 2023 photos of Aid V and Aid VII. |
| Project rulings | RULES_NOTES.md at baseline; final notes 74–88 document this release's fixes and retained uncertainties. |

The publisher's [support page](https://www.legionwargames.com/legion_AGC_GS.html) identifies the official materials. The evidence manifest records exact filenames, URLs where retrieved, sizes and SHA-256 hashes. It does not claim that a later unpublished designer ruling was obtained.

**Table evidence:** all 2,912 Target deployment cells agree; 179 weak OCR cells were checked visually. Hit Distribution covers all 18 columns × 36 rolls = 648, including the automatic one-ship column. Aid VII covers all 15 Long Gun/Troops columns × 36 rolls = 540: 538 printed results agree; two unassigned rolls are explicitly unresolved. Aid V packages 1–11 and its Army Support footnote were read. Map checks cover 70 Lake Combat cells, 60 Convoy Scatter cells, seven Naval Balance bands and 12 gun-band endpoints.

All Event and Tactic mapped fields agree with their faces. This verifies transcription, not every possible timing interaction. Focused tests address timing separately. The existing Adverse Wind +2 ruling, Blockade/Convoy timing, British Convoy phase restriction and Pursuit surrender settlement were retained. Both supported A.I. precondition interpretations and optional modes were exercised.

---
## Verification and its practical limits

| Verification | Result on final v0.2.9 |
|---|---|
| Repository engine assertions | 423 pass, including 191 new focused assertions; 200 random smoke campaigns complete. |
| Shipped HTML DOM handlers | 101 checks pass in jsdom, including keyboard structure, validation, history and simulated storage failure. |
| Campaign sweep | 768 complete; 98,902 prompts; 3,555 exact JSON next-action continuations; 3,449 pure previews; 1,215 independently computed human first-round strength matches. |
| Current-save sweep | 128 campaigns; 18,575 load/continue checkpoints; 786 render checks; all finish. |
| Prior independent regressions | 28 next-rule, 9 follow-up, 23 boundary, 11 new-boundary, 22 engine and 29 edge cases pass; map comparisons have no mismatch. |
| Native Chrome | Two complete campaigns and 23 recorded control checks pass on the public release. |

The 768-game sample uses seeds 610000–610127, both sides and three policies: concentrated fleet, coastal missions, and cautious play. Half the seeds form the matched baseline comparison; half are additional seeds. Options vary systematically. Ninety-six campaigns use manual options, resolving 1,367 package choices and 372 Land Battles against an independent table transcription. Five baseline campaigns failed on duplicate Rake sinkings; the corresponding final campaigns pass.

Assertions cover Troops conservation, legal ship steps and Force membership, bounded tracks, independent ledger totals and victory thresholds, executable prompts, exact restored next actions and preview purity. There were 158 Draws and two rule 5.1 early endings. Dual Blockade did not arise naturally; it is covered by focused boundary assertions.

Current-save comparisons normalize one harmless insertion: `encounter.flagIn={}` appeared 495 times. All other state and dice continuations matched. This is not a claim that every loaded JSON string is byte-identical. Actual build bytes and sampled exact game continuations are separate checks.

The policies do not use hidden cards or future RNG to choose moves. They are coverage heuristics, not competitive agents, human win-rate estimates or evidence of balance. Tests cannot enumerate every event, damage, Tactic and ordering combination. Storage refusal was simulated in jsdom; real Chrome covered ordinary storage and recovery.

---
## Direct play and quality of life

| Live Chrome campaign | Prompts / decisions | Final score, verified independently |
|---|---|---|
| U.S. 610100, coastal policy | 141 total; 101 information; 40 choices/forms | U.S. 24 − British 65 = −41; British Decisive Victory |
| British 610101, fleet policy | 144 total; 110 information; 34 choices/forms | U.S. 57 − British 8 = +49; U.S. Decisive Victory |

Both were started through setup and played through the shipped controls. Final exported states exactly match the independent DOM replay, including decks, RNG, ships, logs and ledger. Decisions and visible labels are recorded in the two controls traces; the exported finals are importable review positions.

Direct checks included Undo/replay, autosave/reload, actual downloaded-file import, pasted-text import, setup import Undo, native Enter/Space, modal shortcut isolation and focus wrapping, malformed-save rejection, repair/Rake/Escape positions, A.I. subset and Missed Signal odds, Harbor effects, manual Land column, Possible Encounter order, ship corrections, Tactic activation and a 425-entry log. At 340 CSS pixels using Chrome 400% zoom, the corrected prompt scrolls into view and the page has no horizontal overflow. A zero-Troops proposal visibly stays zero and cannot confirm. This is responsive desktop Chrome, not an Android-device claim.

**Implemented quality-of-life improvements:** visible version; keyboard ship/Tactic controls; dialog focus, Escape, focus return and clear outlines; full-log toggle and entry counts; save names with seed/checkpoint; separate dialog field rows; explicit next-turn-only Intelligence reminders; informative manual table columns; accurate zero inputs; repeatable minimum Auto-fill; and scrolling to an offscreen new prompt. Recovery and overwrite protection are correctness fixes, not optional suggestions.

**Administration:** the 768 campaigns contained 68,725 information/Continue prompts and 30,177 choices/forms. Mean totals ranged from 104.3 to 156.5 prompts per campaign. Default automatic tables need no manual rule-table lookup; the physical board still needs matching pieces and markers moved. No physical-play timing or actual counter-move count was measured. The existing skip-A.I.-confirmation option remains useful for players who do not need each movement notice.

**Optional, unimplemented suggestions:** touch-accessible ship detail panels; downloadable plain-text logs; wider keyboard focus-retention review; and a human-tested option to group routine end-of-turn notices. These need usability testing before changing the tabletop workflow. No full screen-reader, WCAG, Safari, Firefox, Add to Home Screen or offline-cache certification is claimed.


---

## Confirmed findings · F01–F02

### F01 · High · Repairing British ships lose an extra turn when upgraded

**Player impact:** A legally ready upgraded ship cannot sail; it can change missions, Naval Balance and the final score.

**Rule / expected behavior:** British Living Rules 7.2, p.23 left column; Living Playbook p.12 left column demonstrates Wolfe and Moira finishing repair and upgrade together.

**Exact reproduction:** Load rules-core/R01_finished_repairs_upgrade_BR_290101.json (British seed 290101, July I, Wolfe A in Repairing with no delay). Select Wolfe and Confirm at A2. A natural equivalent is R01_natural_BR_290301.json, August I after 71 legal prompts.

**Expected:** Wolfe becomes B, full-strength and Deployable immediately, within the rolled upgrade allowance.

**Observed in v0.2.8:** v0.2.8 leaves Wolfe A in Make Ready with upgrading=true until next turn. Reproduced in live Chrome.

**Source at baseline:** [src/engine_turn.js:62](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_turn.js#L62),70–74

**Smallest fix, implemented:** Finish the B upgrade immediately only for an undelayed Repairing ship; preserve ordinary refit's Make Ready delay. Explain both timings in the choice labels.

**Validation / nearby controls:** regression_v029_turn.js: immediate repairs versus ordinary refit, delay, isolation, decline and mixed limits.

### F02 · High · A spent Rake target survives into a later round

**Player impact:** Hits can sink an already sunk ship again and award its loss twice; this natural position adds seven American VP incorrectly.

**Rule / expected behavior:** Attacker Rake A06 is single-use; later rounds use normal Hit Distribution, including Open Range.

**Exact reproduction:** Load combat-coastal/R01_BR_291006_fleet_16.json (British 291006, June I, Niagara). The earlier Rake sank Earl of Moira. Continue from the Weather Gage prompt into Gunnery Round 2.

**Expected:** Moira stays sunk once. Hits use normal distribution against the remaining defenders.

**Observed in v0.2.8:** v0.2.8 applies three more hits to Moira, repeats her Strike Check and records a second sinking. Live Chrome reproduces it.

**Source at baseline:** [src/engine_combat.js:254](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L254),336–340

**Smallest fix, implemented:** Clear the per-round rakeTarget/rakeRandom frame values before a new roll. Do not alter the new round's own valid Rake choice.

**Validation / nearby controls:** regression_v029_combat.js: first use, later round, Open Range, Weather Gage switch, exact continuation after JSON roundtrip.

---

## Confirmed findings · F03–F04

### F03 · Medium · Escape's added withdrawal disappears on END

**Player impact:** The Force stays on the lake instead of receiving its permitted withdrawal choice before END finishes the Segment.

**Rule / expected behavior:** Defender Escape D02 adds DW to the next Lake Combat result; LC3c/g, LC5 optional human withdrawal. No END exception appears on the card.

**Exact reproduction:** Load combat-coastal/R02_US_292013_coast_77.json (U.S. 292013, August I, Kingston). Continue from Tactics; the saved dice produce d10=3 and END with Escape active.

**Expected:** Offer the human the added withdrawal; apply the answer, then end the Segment. END still ends it if withdrawal is declined.

**Observed in v0.2.8:** v0.2.8 announces that Escape withdraws the defender but jumps directly to the Segment end, without offering or applying it. Confirmed in live Chrome.

**Source at baseline:** [src/engine_combat.js:333](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L333)

**Smallest fix, implemented:** Process a Tactic-added W before completing an END result; retain the ordinary immediate-END path when no W exists.

**Validation / nearby controls:** regression_v029_combat.js: human accept/decline, A.I. withdrawal, plain END, ordinary Escape, matching-color cancellation.

### F04 · High · Later A.I. rounds ignore the legal attack selection

**Player impact:** An A.I. attack fires extra ships below its required odds and rolls an untowed-schooner die that the legal selection excluded.

**Rule / expected behavior:** LC1 and LC6a require the renewed attack to meet its preconditions; LC2 retains the engaged column and its tow relationships.

**Exact reproduction:** Load combat-coastal/R03_BR_293109_fleet_72.json (British 293109, July II, Kingston); Continue from Weather Gage. The legal renewed force is Madison, towed Tompkins and Oneida, without Fair American.

**Expected:** Fire the selected three ships at 18.5 versus 16.5; no untowed-schooner die is needed. In the original isolated fix this reaches d10=9, D3.

**Observed in v0.2.8:** v0.2.8 fires all four at 21.5 versus 16.5, below 1.5:1, rolls the extra d6 and reaches d10=5, D1. Close Action has the same ignored-selection pattern.

**Source at baseline:** [src/engine_combat.js:207–214](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L207),260,474–478

**Smallest fix, implemented:** Carry the legal plan into Gunnery/Close Action and return-hit eligibility; keep omitted ships Engaged. Later rounds preserve still-valid existing tow pairs rather than silently re-pairing the column.

**Validation / nearby controls:** regression_v029_combat.js and combat follow-up controls cover omitted schooners, surviving tow pairs, lost towers, return fire and later defense.

---

## Confirmed findings · F05–F06

### F05 · Medium · Command odds count ships the A.I. will omit

**Player impact:** The player chooses Confront/Bypass using an overstated attack; this is separate from an incorrect applied combat result.

**Rule / expected behavior:** Displayed first-round odds must describe the actual A.I. plan. The human all-full-strength preview is explicitly hypothetical.

**Exact reproduction:** Load campaign-validation/AI_preview_before_command_BR_612056_fleet.json (British 612056, August II, Niagara) and Continue. A.I. has Pike, Tompkins and Fair American; British Wolfe B and Royal GeorgeB defend.

**Expected:** A.I. preview 23 versus 18=1.28:1, matching Pike plus Tompkins after omitting Fair American.

**Observed in v0.2.8:** v0.2.8 previews26 versus 18=1.44:1, then attacks at 23 versus 18. Original preview confirmed in Chrome.

**Source at baseline:** [src/engine_encounter.js:272–276](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_encounter.js#L272)

**Smallest fix, implemented:** Use the pure A.I. attack plan for this preview; apply Missed Signal after selection and Haze as applicable. Explicitly show a Pass when no plan qualifies.

**Validation / nearby controls:** regression_v029_preview.js: subset/all-ships neighbors, first applied round, Missed Signal, Haze, Pass, Breakout waiver and no RNG/state mutation.

### F06 · Low · A10 announces the wrong number of Target Cards

**Player impact:** A physical-board player can lay out one too few cards despite the numbered list showing the correct extra card.

**Rule / expected behavior:** British A10, p.11 right column and diagram: add a homeport card when required by the Blockade and none was drawn.

**Exact reproduction:** Load rules-core/R02_blockade_extra_card_BR_290202.json: British July I, Sacket's blockaded, ordinary draw of 8 has no Sacket's card. Read A10 immediately: the saved prompt says 8 while listing 1–9. Continue moves past the evidence. Re-run regression_v029_turn.js to regenerate and compare the corrected prompt.

**Expected:** Announce9 and explain the extra Sacket's card.

**Observed in v0.2.8:** v0.2.8 says lay out 8 while displaying cards 1–9.

**Source at baseline:** [src/engine_turn.js:223–225](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_turn.js#L223)

**Smallest fix, implemented:** Report the actual row length and explain the forced added card in prompt and log.

**Validation / nearby controls:** regression_v029_turn.js: added card, already-drawn homeport, normal unblocked draw and left shift.

---

## Confirmed findings · F07–F08

### F07 · High · Adjust creates a save the app itself refuses

**Player impact:** A player can lose access to the browser's new autosave after an ordinary manual correction and reload.

**Rule / expected behavior:** Ship steps must be whole numbers from 0 through the printed full-step count; the existing importer already requires this.

**Exact reproduction:** Start U.S. 290001 at A1; Adjust→Wolfe→steps 1.5→Apply; reload and Continue it. current-saves/S01_adjust_fractional_steps.json preserves the result.

**Expected:** Reject the value before changing position, dice, Undo or autosave.

**Observed in v0.2.8:** v0.2.8 writes 1.5 and later refuses its own save for ship wolfe steps. Empty input becomes0; excess values are silently clamped. Chrome reproduced the fractional route using seed 190901 at A10.

**Source at baseline:** [src/ui.js:773–779](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L773)

**Smallest fix, implemented:** Validate nonempty whole steps in the selected ship's actual range before mutation; explain the error and expose the correct input maximum.

**Validation / nearby controls:** persistence_v029.js: fractions, empty, negative, excessive and nonfinite input leave all stored bytes/history unchanged; valid 0/1/3 reload and Undo exactly.

### F08 · Medium · An unfinished save with no procedure is accepted

**Player impact:** Import can replace a playable position and its autosave with a permanent Working screen.

**Rule / expected behavior:** An unfinished saved decision requires a procedure frame and a valid prompt; damaged imports must be refused atomically.

**Exact reproduction:** Use current-saves/S04_empty_stack.json, a deliberately damaged current save from seed 290004 with calls=[] and prompt=null. Import via file or pasted text.

**Expected:** Refuse it and retain current game, dice, Undo and stored bytes.

**Observed in v0.2.8:** v0.2.8 accepts it and cannot advance. This is a corruption-resilience test, not a state generated by ordinary game play.

**Source at baseline:** [src/ui.js:119](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L119)

**Smallest fix, implemented:** Require both a nonempty procedure stack and valid pending prompt for unfinished games; keep completed-game review valid.

**Validation / nearby controls:** persistence_v029.js: empty stack, null prompt, invalid procedure, excess steps/supply and finished-game neighbor.

---

## Confirmed findings · F09–F10

### F09 · Medium · Failed storage after Load or Settings has no immediate warning

**Player impact:** The displayed game can differ from the stored game without warning; a reload returns to the old position.

**Rule / expected behavior:** The app's Not autosaved notice must appear whenever a storage write fails.

**Exact reproduction:** In persistence_v029.js, store seed 290006, make Storage.setItem throw, then import valid 290005 using the normal modal handlers. Repeat using Settings.

**Expected:** Show Not autosaved immediately and retain the previous stored bytes.

**Observed in v0.2.8:** v0.2.8 sets its failure flag but has already rendered the header, leaving the warning hidden until another render. Storage denial was simulated in jsdom, not induced in real Chrome.

**Source at baseline:** [src/ui.js:143–149](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L143),737–741

**Smallest fix, implemented:** Refresh the header after the storage attempt in Load and Settings. Preserve exact Undo and old stored bytes.

**Validation / nearby controls:** persistence_v029.js: immediate visible warning, old autosave unchanged, exact Undo while storage remains unavailable.

### F10 · Medium · Keyboard shortcuts advance the game behind dialogs

**Player impact:** Reading or closing Save/Reference can roll dice, expose hidden cards and overwrite autosave without the player seeing the new prompt.

**Rule / expected behavior:** Native controls handle their own Enter/Space; dialogs block background game shortcuts.

**Exact reproduction:** U.S. 190901: choose June I convoy, Confirm In Ordinary, Confirm empty assignments to A10. Open Save, focus Close, press Enter. Also press Space in Reference or Ctrl+Z while it is open.

**Expected:** Activate/close the control while keeping game, RNG and history unchanged.

**Observed in v0.2.8:** v0.2.8 advances to C Enemy Operations while Save remains open. Live Chrome reproduced this; key-repeat can skip further prompts.

**Source at baseline:** [src/main.js:3–7](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/main.js#L3)

**Smallest fix, implemented:** Guard open dialogs, editable controls and repeat events; preserve native button Enter/Space and game Undo outside dialogs.

**Validation / nearby controls:** ui_v029.js plus native Chrome: modal keys, header buttons, document Enter neighbor, Ctrl+Z on a button, text-editor Undo.

---

## Confirmed findings · F11–F12

### F11 · Medium · Essential ship and Tactic choices cannot be reached by keyboard

**Player impact:** A keyboard-only player cannot assign ships at A7 or choose a combat Tactic.

**Rule / expected behavior:** Essential choices must be focusable and keyboard-activatable, with selected/unavailable state exposed.

**Exact reproduction:** At A7 add a Force and Tab through its controls; repeat at a Tactic choice. Baseline ships are spans and Tactics are click-only divs.

**Expected:** Tab reaches each available choice, Enter/Space activates it, and ship selection retains focus.

**Observed in v0.2.8:** v0.2.8 provides no tab stop or native keyboard activation for either choice.

**Source at baseline:** [src/ui.js:292](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L292),452–453

**Smallest fix, implemented:** Use native buttons, aria-pressed for ship selection and disabled for ships assigned elsewhere; restore ship-button focus after rendering.

**Validation / nearby controls:** ui_v029.js checks structure/state/focus; final Chrome checks native activation. No claim of a full screen-reader or accessibility certification.

### F12 · Medium · A.I. attack preconditions count a ship that missed the signal

**Player impact:** The A.I. can attack below the required odds or decline a legal attack; its explanation contradicts the first round.

**Rule / expected behavior:** LC1's actual attack odds use that Round's participants; Missed Signal excludes its selected ship from its first eligible Round. The separate printed weapon-plus-Defense comparison remains unchanged.

**Exact reproduction:** Focused legal position, not a natural whole-game seed trace. Load combat-coastal/claude-followup/F1a_AI_missed_signal_attacks_below_1to1.json (U.S. 101, July I, North Lake). Confront. Wolfe missed the signal; only Royal George can fire at Madison. F1b is the reverse case with the player's absent ship.

**Expected:** Do not attack at 6.5 versus 11=0.59:1. In the reverse case, do not count the absent defending ship against the attack's odds.

**Observed in v0.2.8:** v0.2.8's preview says 0.59:1 but its decision announces preconditions met at 1.41:1. Live Chrome confirms the decision mismatch.

**Source at baseline:** [src/engine_combat.js:25–67](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L25)

**Smallest fix, implemented:** Remove the pending Missed Signal ship from both sides' actual-odds calculation and from current tow participation; retain the separate whole-Force printed comparison.

**Validation / nearby controls:** regression_v029_combat_followup.js: below-threshold/reverse cases, spent/no-signal neighbors, tow availability and waived first attacks.

---

## Confirmed findings · F13–F14

### F13 · Low · Close Action omits a permitted flag transfer

**Player impact:** A surviving leader can lose the opportunity to retain a Command bonus for later combat.

**Rule / expected behavior:** LC5.1, British p.35 left: when a Flagship becomes Reduced, an uninjured leader may transfer to an adjacent full-strength ship; make the transfer casualty check. A.I. transfers automatically when useful.

**Exact reproduction:** Focused legal position, not a natural whole-game seed trace. Load combat-coastal/claude-followup/F4_flagship_reduced_in_close_action.json (British 6). Resolve the pending Close Action which reduces the Flagship while an adjacent full-strength ship remains.

**Expected:** Offer the human a transfer before leaving the relevant column, including when a later Sequence makes that side the attacker.

**Observed in v0.2.8:** v0.2.8 returns directly from Close Action without the transfer step. The original fixture's accepted transfer rolls2 d6=11 and kills Yeo; an independent controlled5 succeeds. A prompt is not a guarantee of successful transfer.

**Source at baseline:** [src/engine_combat.js:392–406](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L392),540–550,844–854

**Smallest fix, implemented:** Reuse the flag-transfer step after Close Action and before replacing the prior column for a new attacking Sequence/Reaction; retain eligibility and casualty checks.

**Validation / nearby controls:** regression_v029_combat_followup.js: offer, decline, successful/fatal transfer, A.I. benefit, adjacency and new-Sequence controls.

### F14 · Low · Leaving the Missed Signal ship out preserves the event too long

**Player impact:** The selected ship can incorrectly sit out a later defending round after its first eligible round already passed.

**Rule / expected behavior:** Missed Signal's card says the first Round the ship would have been eligible to join, rather than the first Round the player selects it.

**Exact reproduction:** Focused legal position, not a natural whole-game seed trace. Load combat-coastal/claude-followup/F6_missed_signal_ship_left_out_of_line.json (U.S. 31). Omit the otherwise eligible selected ship from the attack and confirm the lineup.

**Expected:** Spend Missed Signal at that first eligible Round even though the player leaves the ship out; keep the ship outside this attack normally.

**Observed in v0.2.8:** v0.2.8 marks the event used only when it physically removes the ship from a column, so this omitted ship can be excluded again later.

**Source at baseline:** [src/engine_combat.js:132–138](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_combat.js#L132)

**Smallest fix, implemented:** Test eligibility separately from selection; log consumption for an eligible ship left out of the attack.

**Validation / nearby controls:** regression_v029_combat_followup.js: omitted eligible ship, selected ship, ineligible ship and subsequent-round behavior.

---

## Confirmed findings · F15–F16

### F15 · Low · An impossible Army Support deployment still makes an upgrade check

**Player impact:** A ship can gain a permanent upgrade or lose a turn to refit without deploying; the impossible attempt can also consume OA1 and dice.

**Rule / expected behavior:** U.S.7.1 p.22 and OA1 apply when ships will deploy; EN1.1 p.12 excludes Army Support without capacity for one Troops marker.

**Exact reproduction:** Load rules-core/CLAUDE_L1_US182401_standard_Beresford_CA3.json: July I, Oneida Patrol in Sacket's, PE1/A26, Event 8 next, only Beresford A Deployable with3 CA. Continue. Use the matching OA1 fixture for the optional variant; saved RNG 1 gives ordinary d6=4 or OA1 roll 7.

**Expected:** No deployment, upgrade or upgrade die; Beresford remains A/Deployable and OA1 remains unused.

**Observed in v0.2.8:** v0.2.8 upgrades Beresford to B, or puts her in Make Ready under OA1, before discovering that the Force cannot carry Troops.

**Source at baseline:** [src/engine_deploy.js:188–191](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_deploy.js#L188),269–273

**Smallest fix, implemented:** Check capacity before entering the upgrade procedure. Retain the later check because a valid OA1 refit can remove enough ships to prevent the final deployment.

**Validation / nearby controls:** regression_v029_deploy.js:3 CA rejection versus exact4 CA ordinary/OA1 eligibility, and Patrol without a Troops-capacity requirement.

### F16 · Medium · Possible Encounter placement omits legal player choices

**Player impact:** A transport Force can be forced to face an Encounter that the player could legally give to a different Force.

**Rule / expected behavior:** 10.1.2, U.S. p.25 right/British p.26 left: choose subsequent recipients, one marker each before a second, distributing evenly. 11.1.3 transfers to another friendly Force remaining in the original zone.

**Exact reproduction:** Load rules-core/CLAUDE_L2_BR4401_before_B1.json: July I, Sacket's F1 Patrol(Wolfe/Royal George), F2 Army Support(Beresford/SSS, one Troops), F3 Raid(Moira), backs B2/B36/B37. Continue after loading, then choose F1 for PE1, then try F3 for PE2. The matching before_transfer fixture leaves F2/F3 after F1 moves to Niagara.

**Expected:** All six legal three-Force permutations are reachable. Transfer offers either remaining Force before drawing the Event.

**Observed in v0.2.8:** v0.2.8 offers only the first recipient and rotates, allowing1-2-3 / 2-3-1 / 3-1-2 only. Transfers silently pick F2 and draw Event 31.

**Source at baseline:** [src/engine_turn.js:247](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_turn.js#L247),250–258,273–279

**Smallest fix, implemented:** Prompt whenever initial recipients tie for the fewest markers; auto-assign sole choices. Transfers allow any remaining original-zone Force because that paragraph does not repeat the initial balancing restriction.

**Validation / nearby controls:** regression_v029_deploy.js:all six orders in both campaigns, second-cycle balance, zero/one/two transfer recipients, RNG purity and save continuation.

---

## Confirmed findings · F17–F18

### F17 · Low · OA1 reports the old Naval Balance column after recalculation

**Player impact:** A player following the printed Target Card can consult the wrong column even though the engine uses the recalculated one.

**Rule / expected behavior:** OA1, Playbook p.6: recheck the Target Card after recalculation; explanatory text must describe the applied cell.

**Exact reproduction:** Load rules-core/CLAUDE_M4_US3_natural_before_OA1.json and Continue. Natural U.S. 3 has OA1 enabled and all ships on Kingston Patrol. Event 4 confirms A8; OA1 roll 7 sends Wolfe to Make Ready.

**Expected:** Under the retained literal A6 interpretation, show the actual ≤−26 column corresponding to −62.

**Observed in v0.2.8:** v0.2.8 uses that column but still announces−15 to15 and retains the old frame cell. The different proposed+32 calculation is an unresolved rule interpretation, not this text finding.

**Source at baseline:** [src/engine_deploy.js:168](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_deploy.js#L168),243–245

**Smallest fix, implemented:** Refresh the stored cell and its formatted description after recalculation, and log the new lookup. Do not silently change the OA1 method.

**Validation / nearby controls:** regression_v029_deploy.js: natural seed 3, applied/stored/displayed column agreement and ordinary-upgrade neighbor with OA1 off.

### F18 · Medium · Requisition returns a damaged ship without normal repair

**Player impact:** A Reduced ship becomes assignable and counts as Deployable without repair; Step-marker and temporary-homeport handling also differs from normal F7 cleanup.

**Rule / expected behavior:** F7 and6/6.1, British pp.20–22 including repair diagram; Events26–28 remove the ship for the following turn and grant no free repair.

**Exact reproduction:** Load campaign-validation/Requisition_Tally_BR_81.json: British 81, July I, Reduced Beresford A with one step on Niagara Army Support. Continue through F7, decline upgrades and advance to August I without deploying her.

**Expected:** Discard Step markers and use the correct port at F7. After the required missing turn, a Reduced return goes through In Transit→Repairing→full-strength Deployable.

**Observed in v0.2.8:** v0.2.8 skips port/marker cleanup and returns the still-Reduced ship directly to Deployable.

**Source at baseline:** [src/engine_tally.js:136](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_tally.js#L136);[src/engine_turn.js:53](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_turn.js#L53)

**Smallest fix, implemented:** Perform normal F7 cleanup before the requisition exception; choose Deployable only for full-strength returns. The card does not specify a return box; using the ordinary damaged-ship cycle is the explicitly recorded interpretation.

**Validation / nearby controls:** regression_v029_coastal.js: isolated one-step Wolfe becomes two-step Reduced at the temporary port, completes repair on schedule, and a full-strength Moira returns Deployable.

---

## Confirmed findings · F19–F20

### F19 · Low · Manual Land Battle directions use a misleading negative-left shift

**Player impact:** A player can read the wrong band and enter Major Success instead of Success.

**Rule / expected behavior:** Aid VII and Event 36 More Defenders move the Long Gun band two columns left, clamped at zero, with the same Troops subcolumn.

**Exact reproduction:** Load campaign-validation/Manual_Land_Battle_before_E_BR_47.json and Continue: July I, Wolfe A/Royal George A/Moira A support one Troop at Niagara, Event 36, saved RNG 41 yields red6/blue4=64.

**Expected:** Use0 Long Gun/1 Troop; 64 gives Attacker Success.

**Observed in v0.2.8:** v0.2.8 says shifted−2 column(s)left, a double negative that obscures the actual column.

**Source at baseline:** [src/engine_coastal.js:164](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_coastal.js#L164)

**Smallest fix, implemented:** Compute and name the final printed column in both manual and automatic modes. Keep manual entry of the result.

**Validation / nearby controls:** regression_v029_coastal.js: printed column, roll 64, identical manual/automatic application and dice, plus no-shift control.

### F20 · Low · A noncombatant harbor produces an empty battle announcement

**Player impact:** The player receives an unnecessary Harbor Encounter prompt listing no defending ships; final resolution was already harmless.

**Rule / expected behavior:** Rule 12 requires combat-capable enemy port ships; project note 15 excludes captured Converted Laker Schooners from A.I. British combat.

**Exact reproduction:** Run the seed 46 board in regression_v029_coastal.js: British A.I. has only captured Julia, zero steps, In Transit at Kingston; U.S.Madison / Oneida launch one Troop there.

**Expected:** Proceed straight to the Land Battle without a Harbor announcement.

**Observed in v0.2.8:** v0.2.8's broader trigger enters the Harbor procedure, which then filters out its only defender.

**Source at baseline:** [src/engine_coastal.js:116](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_coastal.js#L116),198

**Smallest fix, implemented:** Share one defender-eligibility filter between the Harbor trigger and its setup.

**Validation / nearby controls:** regression_v029_coastal.js: empty captured-CLS pool, legal Reduced non-CLS defender and human-British exception.

---

## Confirmed findings · F21–F22

### F21 · Low · Rainy Squalls previews a Gunnery Round that will not occur

**Player impact:** The player selects an attack using irrelevant odds instead of the Close Action strengths and matchups.

**Rule / expected behavior:** Events19–21 retain LC1/LC2 and send Patrol combat directly to LC7, without Gunnery or Tactics; Reaction uses its ordinary sequence.

**Exact reproduction:** Load campaign-validation/Rainy_before_command_BR_280009.json and Continue: September I, Kingston, Wolfe B/Royal George B versus Madison/Fair American/Conquest/Pike. Inspect Command Decision and the human lineup.

**Expected:** Say no Gunnery and show applicable Close Action strengths/matchups from the selected lineup, excluding Missed Signal as applicable.

**Observed in v0.2.8:** v0.2.8 displays first-round Gunnery odds and a towing/Gunnery warning although that round is skipped.

**Source at baseline:** [src/engine_encounter.js:263–276](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_encounter.js#L263);[src/ui.js:356–364](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L356)

**Smallest fix, implemented:** Use shared pure Rainy/Close Action preview helpers in both screens, based on actual column order and the A.I. plan. Retain ordinary Gunnery previews for Reaction.

**Validation / nearby controls:** regression_v029_preview.js and ui_followup_v029.js: independent Wolfe CA 8 / Oneida CA 3 matchup, applied round, selected lineup, Reaction neighbor and state/dice/history purity.

### F22 · Medium · Setup can discard the retained campaign

**Player impact:** After reload, starting or loading another game can replace the only browser copy without a recovery position.

**Rule / expected behavior:** Starting over should require an explicit replacement; importing another game should retain the previous game's Undo history.

**Exact reproduction:** Start U.S. 292001, choose June I, reload. From setup load an exported U.S. 292002 initial position without first pressing Continue it. Also try Start campaign while a saved game is offered.

**Expected:** Load remains undoable back to292001 and its prior history; Start requires confirmation and Cancel preserves the retained bytes.

**Observed in v0.2.8:** v0.2.8 overwrites the retained autosave with no Undo entries. The in-game New game route already asked first.

**Source at baseline:** [src/ui.js:136–156](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L136),679

**Smallest fix, implemented:** Validate the retained autosave as the predecessor of a setup import; keep normal Continue unchanged. Confirm replacement only when Start would overwrite a saved game.

**Validation / nearby controls:** persistence_followup_v029.js and persistence_v029.js: Undo after import/reload, another Undo to earlier decision, bad imports, ordinary Continue, replacement Cancel/accept.

---

## Confirmed findings · F23–F24

### F23 · Medium · Changing ship steps silently moves the ship off the lake

**Player impact:** A simple correction removes a ship from its Force and can make a pending combat lineup illegal.

**Rule / expected behavior:** A steps-only adjustment must preserve location and Force. Ownership changes must not leave a ship in the opposing side's Force.

**Exact reproduction:** Load tests/browser/fixtures/adjust-madison-on-lake.json (U.S. 280004, A10, Kingston, ForceF3). Adjust→Madison→steps 2→Apply; leave other controls untouched.

**Expected:** Madison remains in Kingston in F3 with two steps.

**Observed in v0.2.8:** v0.2.8 moves Madison to Deployable and clears her zone and Force. Reproduced in live Chrome.

**Source at baseline:** [src/ui.js:768–777](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L768)

**Smallest fix, implemented:** Default to Keep current box; only an explicitly different destination changes position. A deployed ownership change requires an explicit off-lake destination, otherwise reject it before mutation.

**Validation / nearby controls:** persistence_followup_v029.js: steps/save/reload/Undo, refused owner-only edit, explicit new owner and destination, original Force membership.

### F24 · Low · Manual VP corrections disagree with the scoring ledger

**Player impact:** Game Over rows fail to add up to the displayed score; editing a finished game's VP also leaves its score and victory tier stale.

**Rule / expected behavior:** The ledger's signed total must equal U.S. VP minus British VP and the final result; Construction Delay must not be deducted twice.

**Exact reproduction:** Load tests/browser/fixtures/adjust-vp-before-final-turn.json (U.S. 280004, end of September I), set U.S.VP68→71. Alternatively load adjust-completed-game.json and add three U.S.VP.

**Expected:** A +3 manual-adjustment ledger row and a corresponding final score/tier update.

**Observed in v0.2.8:** v0.2.8 changes VP directly with no ledger row; a completed game's cached result does not change.

**Source at baseline:** [src/ui.js:758–759](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L758),265–268

**Smallest fix, implemented:** Record only the delta through addVP. Refresh a completed score and ordinary tier without re-running endGame; preserve a forced Dual Blockade result.

**Validation / nearby controls:** persistence_followup_v029.js: signed U.S./British adjustments, exact Undo, end-game deductions, completed review and result-tier update.

---

## Confirmed findings · F25–F26

### F25 · Low · The next prompt can stay above the narrow viewport

**Player impact:** The next action can be visible without its title or instructions, encouraging a click before the player reads the result.

**Rule / expected behavior:** Reveal a newly applied prompt when its title is outside the unobscured viewport; retain a visible title's position.

**Exact reproduction:** U.S. 280004: on a narrow viewport reach A7, make a long assignment, scroll to Confirm assignments and confirm. Claude's supplied 390 px screenshot puts the new title at −236px.

**Expected:** The new prompt starts in view.

**Observed in v0.2.8:** v0.2.8 resets the panel's scrollTop, but the narrow layout scrolls the whole document. Source and supplied before/after screenshot confirm the cause; final Chrome independently checks the corrected layout.

**Source at baseline:** [src/ui.js:47](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L47)

**Smallest fix, implemented:** After an action, scroll the procedure panel into view only if its title is above/below the visible area or behind the sticky header.

**Validation / nearby controls:** ui_followup_v029.js: three hidden-title and two visible-title geometry controls. These are mocked geometry, supplemented by native Chrome checks. The corrected public page also passed at 340 CSS pixels in Chrome at 400% zoom, without horizontal overflow. This is a responsive-layout test, not physical-phone testing.

### F26 · Low · The Troops input shows one while the proposal holds zero

**Player impact:** The displayed value contradicts the validation error and makes an Army Support assignment difficult to correct.

**Rule / expected behavior:** Render the actual proposal value; zero remains illegal for an Army Support mission.

**Exact reproduction:** Use ui-quality/D7_US280004_A7_with_3_Troops.json or a fresh A7 with three Available Troops. Add Army Support with Madison / Oneida, enter 0 Troops and leave the field.

**Expected:** Show 0 and the validation error; entering1 permits the legal assignment.

**Observed in v0.2.8:** v0.2.8 renders1 while retaining0 internally.

**Source at baseline:** [src/ui.js:442](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L442)

**Smallest fix, implemented:** Replace the truthiness fallback f.troops||1 with the held f.troops value.

**Validation / nearby controls:** ui_followup_v029.js checks displayed/held0, invalid confirmation and valid 1 neighbor without pre-confirmation game mutation.

---

## Confirmed findings · F27–F28

### F27 · Low · Manual Package Auto-fill proposes extra ships and unseeded changes

**Player impact:** The opt-in helper can exceed its own fewest-ships instruction; repeated clicks on the same saved position produce different suggestions.

**Rule / expected behavior:** 5.3.1 and project note 35: Main Ships first, then the fewest required Secondary Ships; inspecting a proposal must not consume game dice.

**Exact reproduction:** In the focused test, available Madison 2 LG and Oneida 1 LG are mains; Hamilton 1, Ontario 1 and Growler 2 are secondaries. Ask for 5 LG. A recorded Math.random ordering makes v0.2.8 pick Madison+Oneida+Hamilton+Ontario. The supplied British 280001 Package 4 fixture similarly selects 8 ships / 17 LG.

**Expected:** The minimal first position uses Madison+Oneida+Growler, three ships. The supplied Package 4 position needs 7 ships / 16 LG.

**Observed in v0.2.8:** v0.2.8 uses a separate greedy algorithm and unseeded Math.random. The recorded ordering is a counterexample, not a frequency estimate.

**Source at baseline:** [src/ui.js:374–388](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/ui.js#L374)

**Smallest fix, implemented:** Reuse the Main-first minimum-subset selector with a copied RNG cursor; explain repeatable ties. Actual game state/dice remain untouched until confirmation.

**Validation / nearby controls:** ui_followup_v029.js: independent minimality/tie examples, impossible pools, exact-count mode, repeated button clicks and exact game/RNG/history/autosave preservation.

### F28 · Medium · Pending Haze and Missed Signal are ignored in Harbor combat

**Player impact:** Harbor odds and hit recipients change, potentially reversing which side takes damage; one-use effects survive incorrectly.

**Rule / expected behavior:** Rule 12 uses a modified Encounter Cycle and does not exclude these events. Haze covers the zone's first qualifying Gunnery Round 1; Missed Signal excludes its ship from its first otherwise-eligible Lake Combat Round.

**Exact reproduction:** Load campaign-validation/Harbor_Haze_before_E_BR_71.json, Continue to Harbor, then Continue. Wolfe A/Royal George A attack Madison at Sacket's. Repeat with Harbor_MissedSignal_before_E_BR_71.json, Royal George selected; saved RNG 1 gives d10=6, +1Command=7.

**Expected:** Haze: 14 versus 10 instead of 15.5 versus 11, once. Missed Signal: Wolfe alone at 9 versus 11, and the saved result hits Wolfe; Royal George returns in Round 2.

**Observed in v0.2.8:** v0.2.8 always uses all ships and full Long Guns, producing 15.5 versus 11; the Missed Signal witness instead hits Madison.

**Source at baseline:** [src/engine_coastal.js:209–229](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/ffd7317bf3c41b45d8ad8443073d1e5c47d17c34/src/engine_coastal.js#L209)

**Smallest fix, implemented:** Apply and consume each pending effect within its scope, excluding the absent ship from strengths and hit allocation. Preserve the stored column for Round 2; if one side entirely sits out, skip only Round 1 without combat dice.

**Validation / nearby controls:** regression_v029_coastal.js: spent/no-event neighbors, Reduced values, ineligible attacker, no new Event/Tactic/WG draw, both rounds and sole-attacker/defender cases. An entirely unfought Round 1 leaves Haze pending; that narrow combined-event timing is disclosed as an interpretation.

---
## Unresolved rule interpretations

These are questions, not confirmed unfixed defects. Published v0.2.9 documents its interpretation so a designer's answer can be applied deliberately. No publisher/designer confirmation was obtained during this audit.

**Q01 · Pursuit versus optional human withdrawal.** A05 specifically triggers on a DW result and eligible withdrawing ships; LC5 generally lets the human decline W. Current play triggers Pursuit once eligibility is established, before asking for a human choice. Claude's alternative asks first and leaves Pursuit unused on a decline. The card-specific reading is defensible, so the alternative was not implemented as a defect fix. The choice can affect whether a new Encounter occurs and which struck ships become prizes. Fixture F3 in combat-coastal/claude-followup reproduces the boundary; project notes 24/62/68 and 87 state the retained treatment.

**Q02 · OA1 recalculation after A7.** Playbook p.6 says recalculate as A6, whose Deployable pool now excludes the human ships already sent to the lake. Current literal recalculation can differ sharply from adjusting the original A6 total only for the refit: seed U.S.3 gives −62 versus +32 in the two readings. This changes the Target Card column and possible deployment. The stale column announcement was fixed (F17); the underlying method was retained and labeled unresolved.

**Q03 · Unassigned Land Battle rolls.** In photographed Aid VII, zero Long Guns / three Troops has Attacker Success through 61 and Major Success from 64. Rolls 62–63 are not allocated. The app's existing Attacker Success interpretation remains; a designer should specify the intended row. These two cells are excluded from the claim of exact printed agreement.

**Q04 · Package 8's first Force.** A valid random 8-CA Main-ship first Force can leave fewer than 22 Long Guns for the second Force, although a different first Force would permit both. Does the player/bot need lookahead or may the package fail after the first selection? Evidence paper-results.json gives raw RNG1 failing and RNG7 succeeding on the same pool. No undocumented optimization was added.

**Q05 · Construction Delay and flagship.** Mandatory 8.1 buy-down can conflict with retaining a Deployable Flagship under LC5.1. The app preserves its flagship. Whether an available flag transfer should permit a further buy-down needs a ruling.

---
## Remaining interpretations and release decision

**Q06 · Rainy Squalls across Encounters.** Its transition after a Reaction Segment is clear locally; whether a later Encounter in the same zone remains affected needs clarification. This release fixes the current Patrol's Close Action preview and preserves normal Reaction Gunnery.

**Q07 · Defender Rake and Tactic lifetime.** The word “once” does not clearly settle whether the defender may intentionally save its Rake for a later eligible round. General LC3 timing and individual card Sequence wording also leave some recycling/lifetime questions. The definite spent Attacker Rake memory leak was fixed; a broad timing redesign was not made.

**Recorded implementation interpretations.** Requisition does not name a special return box; normal damaged-ship repair was applied (F18). Haze and Missed Signal apply to eligible Harbor combat, but the combined case where an entire first round is unfought leaves Haze pending (F28). Rule12's explicit two-Gunnery-Round Harbor procedure remains in force under Rainy Squalls. These narrow choices are documented, tested and open to a designer correction.

**Fix priority, now completed:** first prevent erroneous ship losses/scoring and broken saves (F01/F02/F04/F07); then legal choices, combat timing, preview agreement and current-game recovery; then instructions and control clarity. All 28 confirmed groups have reproducible evidence and regression coverage. Remaining priority is authoritative clarification of Q01–Q05, followed by physical-phone and real tabletop usability sessions. Those are follow-up work, not claims of completed coverage.

**Release verdict:** v0.2.9 passes this fresh-game rules, controls, persistence and release audit under the explicit interpretations above. The original v0.2.8 should be replaced. Evidence is the byte-identical committed rebuild/public file, 423 engine assertions, 101 DOM checks, 200 smoke games, 768 campaign executions, 128 intensive save campaigns, independent card/table checks, and two complete native-Chrome campaigns with exact final-state replay matches. There is no confirmed remaining release blocker within the tested scope.

**Important gaps:** no exhaustive combination proof, no competitive balance claim, no physical tabletop timing study, no actual phone hardware or non-Chromium browser coverage, and no historical-save migration audit. A rulebook ambiguity is not resolved merely because a test passes. Some fixtures intentionally edit the smallest relevant state; naturally reached witnesses and synthetic boundaries are distinguished in their lane reports.

---
## Reproduce and inspect the evidence

The accompanying evidence ZIP contains importable JSON, before/after observations, original test scripts, final logs, browser traces/screenshots, findings.json, source hashes and a README with exact commands. Full copyrighted rulebooks/card artwork are not republished. Acquire the named source versions to repeat the image-grid checks.

**Version pin:** check out `6dc43ca1dc9fd195dcffed67155767514bc11582` for the fix and `ffd7317bf3c41b45d8ad8443073d1e5c47d17c34` for the baseline. Every Source reference on the finding pages is pinned to the baseline. Test filenames refer to the final repository's tests directory unless an evidence subfolder is named. The baseline is expected to fail the new defect assertions.

**Build:** `python evidence/compare_release.py /path/to/checkout` runs the unchanged builder in a separate temporary path, verifies the shipped file is committed and compares bytes with cmp. It writes literal-build-results.json.

**Repository:** from the checkout run `npm test`. For DOM tests install jsdom 26.1.0 in a disposable tool directory, make it available through NODE_PATH and run `npm run test:ui`. Node v24.22.3 and Python 3.12.14 were used. DOM checks do not substitute for a real-browser test.

**Campaigns:** from evidence run `node campaign-validation/sweep.js /path/to/checkout 610000 64 final-matched`, then the same command with `610064 64 final-fresh`. Current-save sampling is in current-saves/roundtrip_current.js. Its README and top-level evidence README explain dependencies and arguments.

**Player reproduction:** open the matching release, Load a named JSON fixture, then follow that finding's steps. To reproduce the ordinary full games, use controls-610100.json and controls-610101.json from setup, with their recorded options and choices. The Chrome final files can be loaded for completed-game review. Assertions are preferable for deliberately invalid imports or controlled dice boundaries.

**Evidence navigation:** rules-core covers turn/deployment/events; combat-coastal covers Tactics, Rake, Escape and attack membership; campaign-validation covers fresh games, previews and coastal actions; current-saves covers Adjust/import/history; ui-quality covers controls/layout. Root result JSON covers printed tables and prior regression boundaries. browser-results.json records 23 live checks; browser-vs-replay.json records the exact full-state comparison; literal-build-results.json and public-release.json identify the verified HTML.

The separate lane notes preserve discovery detail and may call early local candidates “fixed” or “candidate”. The release verdict uses final-repo-tests.log, final-dom-tests.log, the final-matched/final-fresh campaign files, current-saves/final-roundtrip.log and the immutable commit above. Earlier development outputs are not additional independent successes.

**Final verdict: release v0.2.9 for fresh games under the documented interpretations.** All 28 confirmed groups are fixed; the rebuilt, shipped and public HTML agree byte for byte; focused rules checks, current-game recovery and complete live campaigns pass. Next priorities are the listed designer rulings and physical-device/tabletop usability checks, not further historical-save repair.

