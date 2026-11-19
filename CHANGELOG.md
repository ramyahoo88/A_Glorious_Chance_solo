# Changelog

## 0.2.11 – 2026-11-18

* When a Weather Gage change hands the next combat decision to the other side, the combat display identifies the previous formation, attacker and defender until the new formation is chosen.

## 0.2.10 – 2026-11-18

* Apply Gale only in Lake Action. Split a single eligible Force on Separated Ships and let the displaced Patrol react.
* Draw the LC6 Event under Defender Outmaneuver, resolve both sides' flag transfers including Harbor, and honor Missed Signal and actual tow adjacency.
* Validate all eleven manual Force Packages, including both stacks of package 8. Construction purchases now require an affordable reduction.
* Launch Troops at every target before Harbor combat and land battles. Check Dual Blockades after ship returns and use the adjudicated victory in the header. The final-turn check distinguishes full and Reduced requisition returns.
* Apply the flagship actually selected at A7. Improve ship selection, phone layout, face-up card inspection, displayed odds and the Reference lookup for all 18 hit-distribution columns.
* Add an optional grouped pace with a record of public counter moves. Improve save recovery, Undo retention, manual corrections and full-log export.


## 0.2.9 – 2026-11-18
Fresh-game rules, persistence and usability fixes from the comprehensive audit (RULES_NOTES 74–88).
* British ships completing repairs can upgrade immediately in A2 (7.2); ordinary refits still take a turn.
* Rake targets expire before the next Gunnery Round, preventing a sunk ship from being hit and scored again.
* Escape adds its withdrawal even when the combat result is END.
* Later A.I. attacks use the ships and tows selected by the rechecked attack conditions. Command odds preview that actual selection and explicitly say when the A.I. would Pass.
* A10 correctly counts and explains an extra homeport Target Card required by a Blockade.
* Adjust refuses invalid ship steps before changing the position, history or autosave. An unfinished save with no pending procedure is refused. Load and Settings show autosave failures immediately.
* Dialogs keep keyboard focus, support Escape and block game shortcuts behind them. Ship and Tactic choices are keyboard buttons; the header shows the app version.
* The Log can show every entry. Save filenames include the seed and checkpoint; starting over protects an existing autosave with a replacement confirmation.
* Intelligence reminders explicitly state that the event applies next turn only.
* Missed Signal now affects A.I. attack odds and is spent on the first eligible round even if the player omits its ship. Flag transfers are offered after Close Action and before a new attacking sequence. Later rounds keep their surviving original tow pairs.
* Each eligible Possible Encounter recipient is selectable; impossible Army Support deployments make no upgrade roll. OA1 explains the actual recalculated column; its existing interpretation is retained.
* Requisitioned ships discard step markers, retain their appropriate port and return through repair when Reduced. Harbor battles apply pending Haze and Missed Signal; a lone absent participant skips only the first round.
* Rainy Squalls previews Close Action. Manual Land Battles name the final printed column; empty British harbor forces do not generate a battle prompt.
* Setup imports retain the saved campaign for Undo. Steps-only corrections leave ships on the lake, and VP adjustments enter the ledger and update completed results.
* New prompts reveal themselves when offscreen, Troops inputs display actual zero, manual Auto-fill selects the minimum legal subset without consuming dice, and dialog fields occupy separate rows.
* Adds 191 focused engine assertions and 101 DOM checks. Existing regression assertions remain intact; one synthetic save fixture now includes its required pending procedure.
* Historical-save migration behavior is unchanged; this audit prioritizes new games and saves made during current play.

## 0.2.8 – 2026-11-18
Save-recovery fixes from the audit of 0.2.7 (RULES_NOTES 73).
* Saves already changed by 0.2.6's faulty repair (an early capture such as Wolfe's, a wrongly rescued Asp, Troops queued after the A.I. used them) are now recognised and flagged with a notice to load an earlier save; the game is left as saved.
* "Load an earlier save" notices now stay on the board – through autosave, export, reload and Undo – until you load another game or choose to keep playing the position.
* A game restored by Undo is stamped with the current version, so its saves carry it.
* Gunnery Rounds against zero Defense now read ∞:1, as the previews do (same 3:1+ column).
* 14 new regression checks, using the auditor's positions as fixtures.

## 0.2.7 – 2026-11-18
Save-upgrade fixes from the audit of 0.2.6 (RULES_NOTES 72).
* Reloading or undoing in a current game can no longer settle a surrender from the current Encounter early: saves now carry a build stamp and are never upgraded, and older saves need affirmative evidence (a Strike Check logged before the Pursuit) before a surrender is treated as old.
* An old Pursuit surrender is settled from the sides at the Pursuit boundary, so a later casualty cannot change who gets the ship.
* An old save whose A.I. already used the early-returned Troops – including a deployment being picked at that moment, or a turn already at Tally – is left as saved with a notice to load a save from before the withdrawal.
* 12 new regression checks, using the auditor's positions as fixtures.

## 0.2.6 – 2026-11-18
Save upgrades from the audit of 0.2.5 (RULES_NOTES 71).
* A save made by 0.2.4 after an A.I. withdrawal had put its Troops back in Available too early now moves them to the F7 queue on loading; if the A.I. already sailed with them, the app says so and asks for an earlier save.
* A save made by 0.2.4 after Pursuit with a surrender still undecided now settles it on loading (rules note 68), so a later command cannot change the owner.
* 11 new regression checks (paired with controls).

## 0.2.5 – 2026-11-18
Fixes from the audit of 0.2.4 (RULES_NOTES 23, 68–70).
* Troops on a withdrawn (aborted) A.I. coastal mission wait for F7 instead of becoming Available at once, so they can no longer embark on a second Force the same turn.
* Pursuit now settles the ended Encounter's Struck Colors ships before the new Encounter begins – as if the DW withdrawal had happened (project ruling) – so a later command cannot change who owns them.
* A save made by 0.2.3 while choosing a Rake target now names the random ship before you choose (also after Undo).
* Board → Tracks shows the Troops due back at F7 for each side.
* 15 new regression checks (paired with controls).

## 0.2.4 – 2026-11-18
Fixes from the follow-up audit of 0.2.3 (RULES_NOTES 4, 57–67).
* Troops on a Force lost to a Gale, sinking or capture are no longer lost: unlaunched Troops come back at F7, and the Reset screen says how many.
* A confirmed Encounter where the A.I. deploys nothing now marks your Force Encounter Ended, so a Cutting-Out mission aborts (a false alarm still doesn't).
* The A.I. Convoy sails unescorted, and you roll on the Convoy Scatter Table, when its escort package cannot be filled.
* Cutting-Out is offered only against a port with ships to cut out, so the once-per-game mission can't be spent on an empty port.
* Pursuit applies only if a Defender ship is eligible to withdraw after Hits and Disengagement Checks; Disengaged ships come back into the new Encounter.
* A schooner's tow counts only while its towing ship is attacking in that Round.
* Shipyard Damage 8–9 flips ships on the stocks only when there is more than one.
* Last Step / No Steps markers are discarded on withdrawal and at F7: Reduced ships go back to their printed Reduced face.
* Rake: you see the random ship before choosing, and a used Attacker Rake returns to its deck at once.
* Command Decision odds now match the first Round (Missed Signal).
* README and rules note 57 corrected.
* 42 new regression checks (paired with controls).

## 0.2.3 – 2026-11-18
Fixes from the re-audit of 0.2.2 (RULES_NOTES 25, 56).
* Save loading also checks procedure steps, ship boxes, step limits, Convoy Supply range and whole-number scores; a save that fails is refused and nothing changes.
* Loading is undoable: one Undo right after loading returns to the game you had open.
* Intelligence is used up by the pursued Encounter before a Pursuit starts a new one, and by an Encounter in a save made before 0.2.2.
* Intelligence applies only on the turn after it is drawn, as the card says.
* Commanding Breeze also ends when a Pursuit starts a new Encounter.
* 10 new regression checks.

## 0.2.2 – 2026-11-18
Fixes from an independent audit of 0.2.1 (RULES_NOTES 4, 25, 51–57).
* A Scattered Convoy is now delayed and arrives later (+2), instead of being lost.
* Gunnery: return fire hits only the ships attacking in that Round; Reduced ships left behind can no longer be hit.
* Hit Distribution columns 13–18 now use the printed table instead of an approximation.
* Intelligence is used up by its first Encounter with the enemy Flagship, and no longer cancels Fair Wind.
* A Flagship that has just Disengaged can still transfer the flag.
* A W result can be taken even when all your ships have Disengaged.
* Troops must be whole markers (A7, Adjust, loaded saves); the Land Battle lookup no longer stalls on a fraction.
* The attack preview now matches the first Round, including Missed Signal.
* Loading a damaged or incomplete save is refused and leaves the current game, autosave and Undo untouched.
* A finished game can be reopened from the start screen; a warning shows if the browser refuses to autosave.
* In-app Close Action reminder updated for the 0.2.1 hit-then-Melee rule.
* 22 new regression checks (tests/regression.js).

## 0.2.1 – 2026-11-18
Rules fixes from the audit of 0.2.0. Rule references are in RULES_NOTES 43–50 and the updated notes 5, 6, 10, 12, 13, 23, 32 and 33.
* Close Action: a defender that is hit and stays Engaged now goes on to a Melee, as in the Playbook example.
* Withdrawal now takes ships that Disengaged in earlier rounds, instead of leaving them alone on the lake.
* Close Action, your attack: every attacker that can be matched at 2:1 now attacks.
* U.S. campaign: British ships breaking out of Kingston now make 7.1 Upgrade Checks.
* Unmaintained Blockade: with no blockaders on station, no Convoy Delay is placed and the Convoy arrives on schedule (player ruling).
* British campaign: “Attack British Convoy” cards apply only in the Enemy Operations Phase (player ruling).
* Escort cards cannot find a Convoy while the Sacket's Lake Zone is Blockaded (9.1.2).
* Commanding Breeze now lasts only for its own Encounter.
* Last-turn sudden death (5.1) and Dual Blockade sudden death (14.2) now use the exact eligibility and Breakout tests.
* New `tests/regression.js` (27 checks) covering every fix.

## 0.2.0 – 2026-11-18
* Player Aid V (American A.I. Force Packages) is encoded. The British campaign now picks the American ships automatically, including Package #8's two Forces and the encounter roll.
* Player Aid VII (Land Battle Table) is encoded. Land Battles now resolve automatically, including Coastal Event column shifts.
* New options: *Pick Force Package ships myself* and *Read the Land Battle Table myself* (setup screen and Settings).
* The Reference panel now includes both player aids.
* 20 new unit tests. Every Land Battle column is checked to cover 11–66 exactly, and every package type is tested.
* RULES_NOTES records the Land Battle Table misprint and the Stolen Supplies conflict.

## 0.1.0 – 2026-11-18
First release.
* Both solo campaigns (U.S. and British) are playable end to end, from setup to victory determination.
* All 104 Target Cards, 38 Event Cards and 20 Tactic Cards are encoded from the VASSAL module, along with the ship counters, Lake Combat Table, Convoy Scatter Table, Shipyard Damage Table and Hit Distribution Table.
* The Lake Combat engine covers both Combat Sequences, the Tactics, Close Action, Melee, Leaders, Disengagement, Strike Checks and withdrawals.
* Encounters, Reactions, Convoys, Blockades, Breakouts, Harbor Encounters, Raids, Land Battles and the full Tally & Reset are implemented.
* Optional rules OA1 (British upgrades by roll) and OA2 (Cutting-Out) are included.
* Undo, autosave, save/load to file, manual Adjust panel, reference tables and a full dice log are available.
* Player Aid V (Force Packages) and Player Aid VII (Land Battle Table) are not available as data. The app guides you through them: auto-fill with per-package memory, and a one-click Land Battle result.
* Tests: 45 unit tests, 14 scenario tests, a 600-game random-play simulation with invariants, and a headless-browser click-through.
