# A Glorious Chance – Solo Companion

An offline, single-file HTML companion for **A Glorious Chance: The Naval Struggle for Lake Ontario in the War of 1812** (Legion Wargames, design by Gina Willis). It runs both solitaire campaigns:

* **U.S. Solo Campaign:** you are Cdre. Chauncey and the app runs the A.I. British squadron.
* **British Solo Campaign:** you are Cdre. Yeo and the app runs the A.I. American squadron.

Open `dist/index.html` in any modern browser. It needs no install and no network. The game autosaves in the browser (`localStorage`). **Save** (download or copy the save text) and **Load** (file or pasted text) move a game between devices.

You still play on your physical map with your counters. The app tells you what to move, and it draws and reads every card for you.

## What the app does for you

| Area | Automated |
|---|---|
| Setup | Shuffles all decks, hides the A.I. Convoy markers (one real per month) and the 8 “AI Troops?” markers (3 Troops / 5 dummies), and rolls your 3 Troops markers onto your Convoy Supply Track using the 8-ship column of the Hit Distribution Table. |
| Preparation (A1–A10) | Convoy scheduling prompt, Make Ready → Deployable, repairs with delay markers, In Ordinary and the 30-point limit (your choice, A.I. automatic), construction and Construction Delay (A.I. buy-downs automatic), Naval Balance, Flagships (Pike auto-flag), the A7 assignment editor with every mission/zone/troop-capacity rule enforced, A.I. Troops reveal, Target Card removal symbols (final turn, hourglass) and the draw, including the Blockade left-shift. |
| Lake Action (B) | Possible Encounter numbering from the card row (you choose which Force gets the first marker when you have several in a zone), Encounter Checks (spyglass, Gale redraw), revealing the Target Card, the deployment-table lookup (Naval Balance × A.I. Troops), mission conditions and secondary missions, U.S.-campaign Upgrade Checks (7.1 or optional OA1), A.I. Troops embarkation, and Convoy encounters (Escort / Attack Convoy, Convoy Scatter Table). |
| Encounters | Lake Zone Events, all 25 event effects (Gale, Separated Ships, Missed Signal, Haze, Rainy Squalls, Sickness, Minor Damage, Commanding Breeze, winds, Construction/Convoy Delay, Extra Men), the Weather Gage, Command Decision (Confront/Bypass, Attack/Pass), A.I. attack preconditions with towing logic for the A.I. Americans, and Reaction Segments (your declarations with DRMs pre-computed; A.I. Forces and Homeport pool rolled automatically). |
| Lake Combat | Force assembly and towing, all 20 Tactic cards (draw 4/5, dummies, side-only cards, Weather Gage symbol invalidation, color-bar cancellation, Repel vs Grapple, Mutual Support), gunnery formulas, odds column, column shifts and DRMs, the Lake Combat Table, First Shot re-rolls, Hit Distribution Table, Minor Damage, Leader Casualty Checks, flag transfer, Disengagement (Fast ships, Escape), Strike Checks, withdrawals (optional for you), Pursuit, Rake, Outmaneuver gaps and subgroups, Open Range, Weather Gage rechecks and sequence switches, Close Action matchups (A.I. target priority), Melee and the Pike exception, and Struck Colors capture/rescue at the end. |
| Enemy Operations (C) | Row editing, revealing the cards, A.I. deployments, Attack Convoy, and the British-campaign “fewer than two ships” stop. |
| Breakout (D) | Your choice, and the A.I. decision (Carronade or Long Gun comparison) plus the Breakout Encounter (rerolls End results). |
| Coastal (E) | Cutting-Out (optional), Raids and Coastal Events, troop launches, Harbor Encounters (two Gunnery Rounds, shore batteries, no disengagement/withdrawal), and Land Battles (Player Aid VII) with every Coastal Event effect. |
| Tally (F) | Ship VPs, Lake Control, Blockade removal and placement, Isolated ships, Shipyard Damage, Niagara Front, Army Victory, the untransported-Troops penalty, Raid VPs, Convoy Supply (delays, arrivals, scatter/destroy/capture, raids, Fall Offensive bonus), the reset, sudden death, and final victory with Construction Delay deducted. |

Every die roll and table lookup is written to the **Log**. **Undo** restores the state before your last click, dice included. **Adjust** lets you correct any track or ship by hand. **Reference** shows the Lake Combat Table, the Convoy Scatter Table, the ship roster and the key checks.

## Player Aids V and VII

Both are encoded from the printed 2023 player aids (`src/data_aids.js`):

* **Player Aid V (American A.I. Force Packages, British campaign).** The app picks the ships itself, following 5.3.1: Main Ships first, then Secondary Ships, the fewest ships that meet the requirement, ties broken by random draw. Packages that can't be met deploy nothing. Package #8 deploys two Forces and rolls 1d6 for which one is in the Encounter. The Army Support footnote (4 Close Action per Troops marker) is applied.
* **Player Aid VII (Land Battle Table).** The app finds the column (Long Gun band × Troops, with Coastal Event column shifts), rolls 11–66 and applies the result.

To use your own judgment instead (5.3.1 allows it), turn on *Pick Force Package ships myself* or *Read the Land Battle Table myself* on the setup screen or under Settings.

## Data sources

* Ship values, VP values, the Lake Combat Table, the Convoy Scatter Table, the Shipyard Damage Table, the Convoy Supply Track triggers, the Naval Balance bands and card counts, all 104 Target Cards (zone, missions, conditions, removal symbols, and the full 4×7 deployment tables), all 38 Event Cards and all 20 Tactic Cards come from the published **VASSAL module v1.0** artwork. They were cross-checked against the rulebook examples (see `tests/unit.js`).
* Player Aids V and VII come from photos of the printed aids. The Hit Distribution Table (Player Aid VI) was read from the reproduction in the U.S. Living Rulebook (p. 32) for 1–12 ships. For 13+ engaged ships the app picks a position uniformly.
* Rules come from the **Living Rulebooks** (U.S. 13 Apr 2024, British 7 Aug 2024), the **Living Playbook** (6 Aug 2024) and the April 2024 errata. Interpretations are listed in `RULES_NOTES.md`.

## Project layout

```
src/        engine (rng, data, state, engine_*.js, assign.js) + ui.js, main.js, style.css
tools/      build.js (→ dist/index.html), bundle_engine.js (engine for Node tests), files.json (source order)
tests/      unit.js (tables & rule arithmetic), scenario.js (tally/blockade/convoy), regression.js (audit fixes),
            sim.js (thousands of random full games, invariants),
            trace.js (print a full game log), browser/smoke.py (Playwright click-through)
dist/       index.html (the app) – single self-contained file
```

Build and test:

```
node tools/build.js          # writes dist/index.html
node tests/unit.js           # data + arithmetic tests
node tests/scenario.js       # tally, blockade and convoy scenarios
node tests/regression.js     # rules fixes from the 0.2.0 audit
node tests/sim.js 200        # 400 random complete games (both campaigns) with invariant checks
node tests/trace.js BR 42    # print the log of one simulated British-campaign game
python3 tests/browser/smoke.py US 400   # headless browser click-through (needs Playwright + Chrome)
```

This is an unofficial fan aid for owners of the game. All game content belongs to Legion Wargames.
