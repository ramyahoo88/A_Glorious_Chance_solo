# A Glorious Chance Solo Companion — independent rules, release and usability audit of v0.2.8

18 November 2026 · Release commit `ffd7317` (main `67f161f` adds audit documents only) · Auditor: Claude, with four parallel area auditors whose findings I reproduced myself before including them.

**Verdict: hold sign-off for a short v0.2.9 patch.**
- **What passes:**
  - The release is byte-reproducible.
  - Every earlier audit fix holds, including its nearby cases.
  - The printed tables and cards match.
  - Scoring, save, Undo and reload all check out across thousands of games.
- **What doesn't:** seven Medium findings change play or put games at risk.
  - Three are A.I. combat decisions that break printed rules or the app's own previews.
  - Three are interface hazards, one of which can silently destroy a game in progress.
  - One is an OA1 reading that needs a ruling.
- **Also found:** 16 Low findings, 7 open rulings and a quality-of-life list.

Priorities are in "Fixes I would prioritise" at the end.

---

## 1. What was reviewed

| Item | Version / source |
|---|---|
| App | `dist/index.html` 308,978 bytes, sha256 `386ef169acf1f508e1fe4eca3fff028f55d6ca86089170c1bd51601268ee9793`, title "A Glorious Chance – Solo Companion v0.2.8" |
| British Solo Living Rulebook | 7 Aug 2024 (46 pp) |
| U.S. Solo Living Rulebook | 13 Apr 2024 (46 pp) |
| Living Playbook | 6 Aug 2024 (20 pp), incl. OA1/OA2 |
| Errata & clarifications | rev. 13 Apr 2024 |
| Player aids | photographs of the 2023 aids (V, VI, VII), Homeport Displays, maps |
| Components | VASSAL v1.0 module images: 104 Target cards, 40 Tactic cards, 38 Event cards, mats and maps |
| Project rulings | RULES_NOTES 1–73, including the user's rulings (unmaintained Blockade → Convoy on time; blockaded A.I. ships may deploy anywhere; British-campaign Attack British Convoy only in Enemy Operations; Adverse Wind +2 as printed; Pursuit settles surrenders as if DW happened) |

- **How expected behaviour was established:** from the printed pages first, then compared with the code.
  - Text extractions were used for searching only.
  - Wherever a table or diagram decides timing or priority, the rendered page was checked.
  - Every printed column of the Lake Combat Table, Hit Distribution Table (1–18), Player Aid V and Player Aid VII, and every Target-card cell, was checked.

## 2. Release verification — passes

- **Rebuild:** a separate clone at `ffd7317` rebuilt with `node tools/build.js` (Node 22.23.5). It is byte-identical (`cmp`) to:
  - the release commit's `dist/index.html`;
  - GitHub `main` (`67f161f`);
  - the `gh-pages` branch (`ef31610`).
  All four copies have the sha256 above.
- **Self-contained:** the page has no external `src`/`href` resources and no URLs, so it runs offline.
- **Public page:** it reads v0.2.8. Gap: the public HTTP response could not be fetched byte-for-byte from this environment, but the branch it serves matches.
- **Release hygiene (Low):**
  - **R1 — no version tags or GitHub Releases** exist (`git ls-remote --tags` is empty). Releases are identified only by branch heads.
  - **R2 — the old claude.ai page is public and still serves v0.2.4**, with every defect since fixed. The README no longer links it, but anyone who has the link plays v0.2.4.
  - **Fix:** create tags/Releases v0.2.4–v0.2.8 on GitHub, and update or unpublish the claude.ai page.

## 3. Findings — Medium

### M1 · A.I. attack decision counts the Missed Signal ship (defect, both campaigns)
- **Player impact:**
  - The A.I. attacks below its printed threshold, or declines an attack that meets it.
  - The Command Decision line "Odds if the A.I. attacks" says one thing and the A.I. does another.
- **Expected:**
  - LC1: the A.I. attacks only at ≥1:1 (1.5:1 with untowed schooners, 2:1 if all schooners).
  - Missed Signal (Events 6/13/29/35): the ship sits out the first Round.
  - Note 67 (the v0.2.4 N09 fix): previews use the first Round's ships. The A.I. decision was not brought into line. This is a nearby case of that fix.
- **Reproduction:** `agents/B_encounter_combat/saves/F1a_AI_missed_signal_attacks_below_1to1.json` (U.S. campaign, seed 101). Press Continue.
  - The preview says 0.59:1.
  - The A.I. logs "preconditions met … odds 1.41:1".
  - It then fights "Gunnery Round 1: British 6.5 vs U.S. 11 = 0.59:1".
  - The reverse case is `F1b_…`: your Pike missed the signal, the preview shows 6.5:1, and the A.I. declines at "0.81:1".
- **Frequency:** every A.I. Round fought below LC1 outside Breakouts in 4,000 policy campaigns came from this (24 Rounds). It flips 13 of 241 A.I. decisions taken with a Missed Signal pending.
- **Source:** `src/engine_combat.js:25–67` (`aiAttackDecision`), against `:132–138` and `engine_encounter.js:268–276`.
- **Fix:** exclude `missedSignalShip(s)` from both sides in the odds test. Keep the printed Carronade/Long Gun + Defense comparison on whole Forces.

### M2 · A.I. Americans pass the Round-2 test without untowed schooners, then fire with them (defect, British campaign)
- **Player impact:** the A.I. fights Gunnery Round 2 below LC1 and adds the untowed-schooner DRM roll it had excluded.
- **Expected:** LC6 a (Round 2 must meet LC1), with note 17's fallback of attacking without untowed schooners.
- **Reproduction:** `agents/B_encounter_combat/saves/F2_natural_AI_US_before_Gunnery_Round_2.json` (natural, seed 138).
  - The plan says "A.I. attacks without its untowed Laker Schooners … 1.08:1".
  - The log then shows "Gunnery Round 2: U.S. 17 vs British 13 = 1.31:1 … [0 untowed Laker Schooners (1, d6 3)]" (needs 1.5:1).
- **Source:** `engine_combat.js:207–214` (test) and `:260` (Round uses the whole column). The test also re-derives tows instead of using the Round's `c.tows`.
- **Fix:** fight the Round with `plan.ships` and evaluate with `c.tows`.

### M3 · A.I. Pursuit cancels a withdrawal you were never offered (defect, both campaigns)
- **Player impact:** when the A.I. attacks with Pursuit and rolls D#W, the optional-withdrawal choice is skipped. Note 68 then captures your struck ships, even though you might have chosen to fight on.
- **Frequency:** 112 times in 2,000 campaigns, 57 of them with an immediate capture.
- **Expected:**
  - LC5: a W result is optional for the human player. The prompt itself says so.
  - Card A05 cancels the opponent's withdrawal. If you choose to fight on, there is no withdrawal to cancel and the Encounter continues.
  - This is about the order of steps, not the user's Pursuit ruling.
- **Reproduction:** `agents/B_encounter_combat/saves/F3_AI_pursuit_vs_your_optional_withdrawal.json` (U.S. campaign, seed 8).
  - After "D1W", the next screen is "Pursuit – a new Encounter: Fair American is CAPTURED by the British".
  - Control (same roll, no Pursuit): "Withdrawal result against you" is offered.
- **Source:** `engine_combat.js:363–370` runs before the human prompt at `:371–375`.
- **Fix:** for the human Defender, ask first. Apply Pursuit only if you choose to withdraw; otherwise the card stays unused.

### M4 · OA1: the recalculated Naval Balance leaves out every U.S. ship at sea (ambiguous ruling, Medium impact; plus a Low text defect)
- **Player impact (U.S. campaign with OA1):** the first deploying Encounter of a turn usually upgrades ships.
  - The app then recomputes the balance from ships still in Deployable areas. All your A7-assigned ships drop out.
  - The balance swings sharply to the British (e.g. 0 → −62). That column then decides this card and every later card that turn.
- **The printed text:** Playbook p. 6, OA1: "recalculate the Naval Balance [as you did in Step A6], then recheck the Target Card".
  - **Literal reading (the app):** apply the A6 method now, so only ships in Deployable areas count.
  - **Purposive reading (recommended):** only the upgrading British ships leave the total. The expected value is the A6 value plus their capture VP. The rule is introduced as one that "gives an advantage to the American side", while the literal reading usually makes the British deploy more.
- **Reproduction:** `agents/A_prep_lake_deploy/F01_oa1_naval_balance.js`, which writes `F01_oa1_seed3_B1.json`. U.S. campaign, seed 3, OA1, all ships on a Kingston Patrol. Press Continue.
  - Event #4, card A8, OA1 d10 = 7, which upgrades Wolfe.
  - App result: −62, band ≤−26, ship icon, four ships deploy.
  - Purposive reading: +32, band ≥+26, A8 blank, no deployment.
  - The deploy / no-deploy outcome flips in seeds 6, 7 and 8 (`scripts/oa1_scan.js`).
- **Text defect (Low, either reading):** the deployment log still names the A6 column ("Naval Balance '−15 to 15' column") after the recalculation changed it.
- **Source:** `engine_deploy.js:232–247` (recalculation at `:243`); stale text from `f.L.cellTxt` (`:168`).
- **Fix:** rule on it and record a note. For the purposive reading: `s.nb += sumBy(chosen, vpCapture)`, then recompute the band, `f.L.cell` and `f.L.cellTxt`.

### M5 · Enter/Space on a focused button advances a Continue screen (defect, UI)
- **Player impact:**
  - Keyboard users can't press Undo, Save, Load, Reference, Adjust, Settings or New game while a Continue screen is showing. Enter advances the game instead.
  - A mouse user who opens Reference and presses Space to scroll advances the game behind the open dialog, revealing A.I. Target Cards and dice unseen.
- **Expected:** normal button behaviour, and no game actions while a dialog is open.
- **Reproduction:** `agents/D_ui_qol/scripts/repro_D1_keyboard.py`.
  - Set-up: U.S. campaign, seed 280004 → June I → Confirm → Confirm assignments → "A10 Target Cards drawn".
  - Reference + Space: the screen becomes "C Enemy Operations" behind the dialog (`shots/K02_reference_open_game_advanced_behind.png`).
  - Focus Undo + Enter: the game advances (Undo stack 3→4).
- **Source:** `src/main.js:3–7`. It exempts only INPUT/SELECT/TEXTAREA and never checks `#modal.open`; `preventDefault()` blocks the button.
- **Fix:** return early when `e.target.closest('button,a,input,select,textarea')` or the modal is open.

### M6 · Start screen: "Start campaign" / "Load a saved game" overwrite the game in progress with no confirmation (defect, UI, data loss)
- **Player impact:** after a reload the start screen shows "A game in progress was found… Continue it" next to a primary-styled Start campaign button. One click replaces the autosave, and the old campaign is gone; Undo is empty. In-game "New game" does ask first.
- **Reproduction:** `agents/D_ui_qol/scripts/persist_checks.py`; `shots/P01_setup_with_saved_game@*.png`.
- **Source:** `ui.js:65–70` (`startGame`) and `ui.js:679`. `commitLoaded` keeps the previous game only when `G_STATE` is set (`ui.js:140`), and on the start screen it is null.
- **Fix:** confirm when an unfinished autosave exists, or push it onto Undo as `commitLoaded` already does in-game.

### M7 · Adjust → Ships moves a ship on the lake to port (defect, UI)
- **Player impact:** changing only the steps or owner of a ship on the lake removes her from her Force and puts her in Deployable. Mid-combat this can lock the attack ("Madison cannot tow"). Undo recovers.
- **Reproduction:** load `agents/D_ui_qol/saves/D5_US280004_A10_Madison_on_lake.json` → Adjust → Ships → "Madison – Lake" (the box selector shows Deployable) → steps 2 → Apply. Madison is now Deployable, with no zone and no Force. Lineup case: `D5_US280004_lineup_Kingston.json`, `shots/ADJ4_*`.
- **Source:** `ui.js:768–777` (`boxSel` maps lake → deployable; Apply always removes the ship from her Force and clears her zone).
- **Fix:** add "keep current box"; change box, zone or Force only when the box actually changes.

## 4. Findings — Low

| # | Finding | Player impact | Expected | Reproduction | Source | Smallest fix |
|---|---|---|---|---|---|---|
| L1 | U.S. campaign: Upgrade Check (or OA1 roll) made for an Army Support Force that then can't carry Troops and doesn't deploy | Beresford gets a permanent "B" upgrade (or OA1 sends her to Make Ready) with no deployment | U.S. 7.1 "about to be placed"; EN1.1 "…or it does not Deploy" | `A_prep_lake_deploy/F02_beresford_A26*.json` (Event #8, d6 4) | `engine_deploy.js:188–191`, `228–262`, capacity test `269–273` | In `pick`, return no deployment for Army Support when `troopCapacity < 1` before `G('upgrade')` |
| L2 | B1: you choose only the first PE marker in a zone; the rest rotate | 3 of 6 legal orders unreachable with three Forces (e.g. keep the Troops Force out of Encounter 2) | 10.1.2: you may choose who receives subsequent markers, one each before any second | `A_prep_lake_deploy/F03_three_forces_B1.json` (no dice) | `engine_turn.js:238–259` (rotation `:257`); transfer `:276` | Ask whenever more than one Force ties for fewest markers; same for transfers |
| L3 | A Reduced ship taken by Requisition (Events 26–28) comes back Deployable without repair; markers not discarded; Isolated port not applied | Damaged ship assignable and counted in Naval Balance; Wolfe stays at 1 step | F7: Reduced ships to In Transit, discard markers, Isolated to Temporary Homeport; 6/6.1 repair | `C_coastal_tally/R1_requisition_reduced_at_Tally.json` (British, seed 81, July I, Event #26) + `assert_F1_requisition.js` | `engine_tally.js:136`; `engine_turn.js:52–53` | Set port and `discardStepMarkers` before the early return; on return use `isFull ? deployable : transit`; add a note (the card doesn't say where she returns) |
| L4 | Flagship Reduced in Close Action is never offered a flag transfer | +1 Command DRM lost for the Encounter (both sides) | LC5.1 "Transferring the Flag during Lake Combat" | `B_encounter_combat/saves/F4_flagship_reduced_in_close_action.json` (British, seed 6) | `engine_combat.js:392–406`, `545–551`, `844–854` | Run the flag-transfer step after Close Action and at a new Combat Sequence |
| L5 | "Odds if the A.I. attacks" counts untowed schooners the A.I. U.S. will leave behind | Preview 25 vs 18 = 1.39:1; actual 22 vs 18 = 1.22:1 | Note 67 (preview = first Round) | `B_encounter_combat/saves/F5_preview_vs_AI_US_attack_without_untowed.json` (seed 501) | `engine_encounter.js:272–276` | Build the A.I. line from `aiAttackDecision(s,false).ships` |
| L6 | Missed Signal not used up if you leave that ship out of your attack | She can later sit out a defending Round, untouchable; a lone-defender case ends the Encounter at once | Event card: the first Round she "would have been eligible to join" | `B_encounter_combat/saves/F6_missed_signal_ship_left_out_of_line.json` (U.S., seed 31) | `engine_combat.js:132–138` | Mark it used when she was eligible, selected or not |
| L7 | Under Rainy Squalls the Command Decision and lineup show Gunnery odds for a Round that is never fought | Misleading decision information | Events 19–21 go straight to Close Action; note 67 | `D_ui_qol/saves/Q_rainy_squalls_CD.json` (British, seed 280009) | `engine_encounter.js:262–276`, `ui.js:356–364` | Say "no Gunnery – straight to Close Action" and show the matchups |
| L8 | Manual Land Battle prompt: "shifted -2 column(s) left" | Double negative; read as two columns right, the attacker gets Major Success instead of Success | Player Aid VII column shift | `D_ui_qol/saves/LB_manual_more_defenders.json`; `C_coastal_tally/assert_F3_F4_text.js` | `engine_coastal.js:164` | Print the final column label (as automatic mode does) |
| L9 | Harbor Encounter announced with no defenders ("must fight the ships in port: .") when only captured Converted Laker Schooners are in Kingston | Confusing empty screen (outcome correct) | Note 15 (A.I. British never use them) | `C_coastal_tally/assert_F3_F4_text.js` (U.S., seed 46) | `engine_coastal.js:116–117` vs `:198` | Apply the same schooner filter at `:116` |
| L10 | Phones: the page stays scrolled down after an action, so the next title and text are off-screen | 28 occurrences in two 390 px games; in 8 the buttons were visible without the text | Read before you click | `D_ui_qol/scripts/scroll_repro.py`, `shots/SC1/SC2_*` | `ui.js:47` vs `style.css:169` | `scrollIntoView` on `#proc` after rendering when it is off-screen |
| L11 | Keyboard can't add ships to a Force (A7) or pick a Tactic card | Keyboard-only play impossible (WCAG 2.1.1) | Interactive controls are focusable | `D_ui_qol/runs/kbd_reach.json` | `ui.js:452–453`, `:291` | Render them as `<button>` |
| L12 | Adjust → VP edits are missing from the Game Over table | Table sums to +78 while "Final Game Score +81" | Ledger and total agree | `D_ui_qol/saves/ADJ_US280004_decision120.json`, `shots/ADJ2_*` | `ui.js:758–759` | Use `addVP(s, side, Δ, 'Manual adjustment')` |
| L13 | A7 Troops box shows "1" while the Force holds 0 | Contradicts the error beside it | Show the held value | `D_ui_qol/saves/D7_US280004_A7_with_3_Troops.json`, `shots/S02_*` | `ui.js:442` (`f.troops \|\| 1`) | `value: f.troops` |
| L14 | Manual Force Package Auto-fill can pick more than the fewest ships, using unseeded `Math.random` | Opt-in mode deploys an oversized A.I. Force (Package #5 over-selects in 85% of clicks); not reproducible from the save | Prompt says "fewest ships"; note 35; automatic mode | `D_ui_qol/saves/PK_manual_package_prompt.json` (British, seed 280001, #4) | `ui.js:374–388` (Secondary random order; `Math.random` at `:376`) | Sort Secondary ships largest-first; use the game RNG or a fixed order |
| L15 | Log panel shows only the newest 400 entries | June turns (and the setup Troops rolls the start screen points to) are unreachable late in a game | — | `D_ui_qol/runs/BR280009_fleet_1300_final_state.json` (476 entries) | `ui.js:580`; `UI.showLogAll` unused (`ui.js:7`) | Add a "show all" toggle |
| L16 | Settings/Adjust dialogs run controls together on one line | A checkbox or "Set" looks attached to the wrong field | — | `D_ui_qol/shots/DLG_*@1300.png`, `A_US_dialog_*@390.png` | `ui.js:739–765`, `style.css:162` | `#modal label { display:block }` |

## 5. Open rulings (questions, not defects)

| # | Question | Readings | Where |
|---|---|---|---|
| Q-A | OA1 recalculation (see M4) | literal A6 method vs only the upgrading British ships leave | Playbook p. 6 |
| Q-B | Do Lake Zone Events apply to Harbor Encounters? | Rule 12 runs "an Encounter Cycle with the following exceptions", none of which excludes Events. The app applies Minor Damage but ignores Haze and Missed Signal (Harbor Round 1 reads "15.5 vs 11"; with Haze it would be 14.5 vs 10). Choose: (a) all apply, or (b) none apply. | `engine_coastal.js:214`, `engine_combat.js:772`, `:258`; `C_coastal_tally/scripts/harbor_zone_events.js` |
| Q-C | Rainy Squalls after a Reaction Segment | The card says it "no longer applies" once there is a Reaction Segment. The app applies it again to later Encounters' Patrol Segments in that zone (seed 41): for the turn, or only that Reaction Segment? | `engine_combat.js:141`; `B_encounter_combat/check_ambiguous.js` |
| Q-D | Tactic lifetime: note 19 vs LC3 g | LC3 g: "remain valid until the next Weather Gage check"; the cards and note 19: the whole Combat Sequence | RULES_NOTES 19 |
| Q-E | Defender Rake (D07) timing | The app spends it automatically in Round 1; the card says "once in the current Combat Sequence", so a human Defender may want to keep it for Round 2 | `engine_combat.js:284–285`, `:302` |
| Q-F | Player Aid VII rolls 62–63 at 0 Long Gun / 3 Troops | unassigned in print; the app uses Attacker Success | (known) |
| Q-G | Package 8 first-Force choice; return timing of used or negated Tactics other than Rake | (known, notes 57/66) | |

Observations kept as notes, not findings:
- A human British Army Support Force may target South Lake when the Americans use Charlotte (mirrors the U.S. York rule; not listed in the British book).
- B12 deploys nothing when Cutting-Out is unavailable, following A43's printed clause.
- The British-campaign Enemy Operations stop when the A.I. has fewer than two ships; the rulebook gives this only as an example.

## 6. Quality of life (optional usability improvements)

**Workload.** I measured this over 256 games of the visible-information policy, at 4 policies × 64 seeds:

| Options | Screens per game | Continue-only screens | Share |
|---|---|---|---|
| Default (A.I.-step pauses on) | 142.7 | 104.2 | 73% |
| Pauses off | 92.3 | 53.8 | 58% |

- The option never changes a game: all 256 games gave identical scores, VP and dice with it on and off.
- **Most frequent Continue screens per game:** AI Deployment 13.4, Target Cards drawn 8.0, Encounter Check 7.9, Possible Encounters 7.3, Enemy Operations 5.8, Gunnery results 5.4, Tactics 4.5.
- **In the browser** (two representative games): up to 12–14 Continue screens in a row, and 8–11 runs of four or more per game.
- **Table lookups:** with default options the player does none. With the manual options, there is one Player Aid VII lookup per Land Battle and one Player Aid V selection per A.I. package (19 in one British game).
- **Board bookkeeping:** about 200–300 ship-counter moves or flips per game, plus 30 Force stacks, 30–48 encounter markers and 114–150 Target Card lays. Only 14% (U.S.) to 41% (British) of ship changes are named on a screen; the rest appear only on the board panel or in the log.

Suggestions:
1. Merge Tally and Reset. Group each phase's A.I. deployments onto one screen, and batch false-alarm Encounter Checks.
2. Add a "mirror on the map" list of counter changes to each screen, for example A3 box moves and the ship returns at Reset.
3. Rename "Pause after each A.I. move": turning it off also hides screens that matter to you ("Your Convoy is attacked!", "Encounter – no enemy").
4. Warn before confirming an A7 assignment with no Forces.
5. Show ship details on tap; the A7 chips and ship chips use hover-only tooltips, which phones can't show.
6. At 390 px:
   - raise small text (8.7–9.8 px) and low contrast (track numbers 2.85:1, past turns 2.03:1);
   - enlarge tap targets under 24 px (checkboxes, list rows, selects, Set buttons).
7. Dialogs:
   - add an Escape key and move focus into the dialog;
   - keep the Reference dialog's Close button reachable;
   - stop a backdrop tap from discarding pasted Load text.
8. Wording:
   - "American campaign" vs "U.S. Solo Campaign";
   - "0 untowed Laker Schooners (1, d6 3)" reads as zero schooners (the 0 is the DRM);
   - "(must be greater)" is printed even when only the odds failed;
   - Adjust takes British VP as positive while the header shows them negative;
   - a damaged autosave says "your current game was not changed" with no game open.
9. Reference: add the Hit Distribution Table and the Event/Tactic texts. Adjust: add the A.I. Troops, Troops due at F7, Lake control, Blockade, Leader, Flagship and Convoy markers.
10. Auto-select a Tactics prompt with a single valid card.
11. Autosave reaches 1.1–2.0 M characters by game end (≈38% of the browser quota for the origin). Only 25 of the 60 Undo steps survive a reload.

## 7. What was tested directly and passed

**Release:** rebuild and byte comparison (§2).

**Printed components:**
- **Target cards:** 2,912 Target-card cells across 104 cards, read independently from the VASSAL images, with 0 mismatches. 28 cards were also checked by eye cell by cell. All headers, removal symbols and card backs match.
- **Player Aid V:** packages #1–#11 with full, partial and empty pools, ties and the #8 split.
- **Naval Balance:** bands on both maps with 28 edge cases.
- **Lake Combat Table:** all 70 cells.
- **Hit Distribution:** columns 1–18 against British LR p. 32, 648 cases.
- **Odds columns:** all 14,400 half-point strength pairs, including exact boundaries.
- **Tactic and Event cards:** all 20 Tactic faces (5,328 validity cases, 62 negation pairs) and all 38 Event cards.
- **Convoy Scatter Table:** both maps.
- **Player Aid VII:** all 15 columns × 36 rolls (1,620 lookups), 0 mismatches apart from the known 62–63.

**Engine sweeps:** over 10,000 seeded games, using independent oracles that re-derive the results from the printed rules:
- 21,468 Gunnery Rounds, with the correct odds column;
- 8,561 Command Decision previews of your own attacks against your own first Round;
- 19,683 save → load → continue runs in mid-Encounter, with 0 differences;
- 3,840 Tallies and 1,920 Resets, each matching an independent F1–F7 model (VP, both supply tracks, Construction Delay, Niagara, Fall Offensive, Lake Control, Blockade, Troops conservation);
- 3,471 Raids, 363 Harbor Encounters and 1,681 Land Battles;
- 1,373 A.I. deployments with no invariant violations;
- a die-roll consistency check over 3,200 campaigns.

**Representative games (engine, independently summed):**

| Campaign | Seed | Policy | Screens | Ledger | Score and level |
|---|---|---|---|---|---|
| British | 191073 | fleet | 149 | U.S. 57 / British 32 | +25, U.S. Victory |
| U.S. | 187033 | fleet | 101 | U.S. 17 / British 21 | −4, Draw (the British Construction Delay of 1 was deducted correctly) |
| British | 188007 | coast | 181 | U.S. 32 / British 44 | −12, British Marginal Victory |
| U.S. | 185401 | coast | 105 | U.S. 34 / British 3 | +31, U.S. Victory |

The levels match the printed bands (3.3.2). Each turn's screens are in `engine/trace_out.json`.

**Shipped page in real Chrome** (Playwright, google-chrome):
- 10 complete campaigns through the real buttons at 1300×900, 800×1000 and 390×844. These covered both campaigns, both policies, and the optional rules OA1 and OA2.
- Final states were byte-identical to an engine replay of the same answers.
- 1,480 after-action checks of header and Tracks against state, with 0 mismatches.
- 290 Game Over rows summed to the displayed score in every game.
- 58 Command Decision/lineup previews matched the Round fought (the exceptions are L5 and L7).
- Undo, reload ("Continue it"), Save (download and copy), Load (file chooser and paste), finished-game Review and the recovery notice all restored the exact state, dice included.
- Damaged, cut-off and empty saves were refused with the game untouched.
- No page errors and no horizontal overflow.

**Boundaries:**
- exhausted Event deck (reshuffle) and Tactic decks;
- Convoy Supply at −1 and 12, Fall Offensive for one side and for both;
- Captured, Scattered and Arrived Convoys, including while Blockaded;
- every Raid edge, and Niagara moving both ways;
- every victory-level edge and tie, and the Construction Delay deduction;
- Dual Blockade against you and the case where it doesn't trigger, sudden death 5.1, September II scoring;
- Escape plus AW, Fight On at ∞ odds, Encounters ending by Pass or END, forced Weather Gage switches;
- Breakout END rerolls (0 of 300).

**Earlier fixes rechecked with a nearby case that should differ:**
- v0.2.4: N01–N11.
- v0.2.5: W01–W03.
- v0.2.6: L01/L02.
- v0.2.7: F01–F04.
- v0.2.8: N01–N03.

All hold. The nearby cases of N09 and N04 produced M1 and M3.

## 8. Fixes I would prioritise

1. **M3** (A.I. Pursuit pre-empting your optional withdrawal): the most frequent rules effect, with immediate captures in about 3% of campaigns.
2. **M6** (start screen overwrites the saved game), **M5** (keyboard advances the game or acts behind dialogs) and **M7** (Adjust moves lake ships): data-loss and hidden-information hazards.
3. **M1** and **M2** (A.I. LC1 decisions under Missed Signal and with untowed schooners), together with **L5** and **L7** so that every preview matches the Round fought.
4. **Rulings** on M4/OA1 and Q-B to Q-E, recorded in RULES_NOTES.
5. **Low items:** L1–L4, L6 and L8–L9 are rules or text fixes of a few lines each. L10–L16 are interface fixes.
6. **Release hygiene:** tags and Releases, and retire or update the public v0.2.4 claude.ai page.

## 9. Coverage gaps

- No real touch device, Safari or Firefox, and no screen reader.
- No offline launch from a home-screen shortcut.
- The public HTTP response was confirmed by title only from here; the `gh-pages` bytes match.
- The quality-of-life counts come from scripted visible-information policies, not human players.
- Not reached: the manual Package #8 two-stack picker in normal play; Separated Ships with two Forces of one side in the same Encounter; Dual Blockade with In-Transit ships about to become Deployable (needs eight full-strength Main ships on one side).

## Evidence

`AGC_v0.2.8_Claude_Audit_Evidence.zip` (next to this report) holds:
- the audit harness, play policy and the brief given to the area auditors;
- the release hashes and remote refs;
- my engine traces and quality-of-life counts;
- each area's scripts, importable saves (`{state, undo: []}`, loadable with the app's Load) and run outputs;
- the screenshots referenced above.

Scripts expect the repo at `/home/claude/a_glorious_chance_solo` and the harness at `/home/claude/audit028/harness.js`; edit those two paths to rerun elsewhere. `README.md` in the zip maps each finding to its files.
