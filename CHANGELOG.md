# Changelog

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
