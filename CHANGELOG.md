# Changelog

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
