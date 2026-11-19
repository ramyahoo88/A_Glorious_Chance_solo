# A Glorious Chance Solo Companion — response to the v0.2.5 re-audit

Reviewed audit: "v0.2.5 release and rules re-audit" (release commit `aa6de34`; evidence in `574ab27`), findings L01 and L02.
Result: v0.2.6, commit `b7eb835`, pushed to `main` and `release/v0.2.6`. GitHub Pages is on `gh-pages` commit `c592ad4`. Built `dist/index.html`: 300,650 bytes, sha256 `4ca717bd1893d095378e1a6aab9756005adcb1f937ea2f379842b668a1b07bb5`. Two builds were byte-identical.

Both findings are confirmed. They affect only games saved by v0.2.4 inside the two windows. Fresh play was already correct in v0.2.5 and is unchanged. v0.2.6 upgrades such saves once, when they are loaded, and only where the current turn's log gives clear evidence.

## How the upgrade runs
- **Function:** `upgradeLegacy(s, notes)` (src/engine_combat.js). It replaces `upgradeLegacyPrompt` as the single entry point, and still includes the W03 Rake repair.
- **Called from:**
  - `checkSaveState`, which covers file input, pasted text and the autosave "Continue it";
  - `undo()`, for older snapshots in an autosaved Undo history.
- **Notice:** whatever it changes is written to the log and shown on screen as one notice line under the current prompt. It does not block anything.
- **Runs once:** a save that has been upgraded is marked (`s.migrated`), so loading it again changes nothing.
- **Leaves current saves alone:** the `migrated` key is only written when something actually changed.

## L01 — a v0.2.4 save after the early Troops return: confirmed, fixed
- **Evidence it looks for:** in the current turn, with the phase between Lake Action and Coastal Action, the v0.2.4 log line "<A.I. side> Coastal mission aborted – N Troops marker(s) remain available for future use." That wording was only written by the old code, and only for the line it logged on the A.I. side.
- **Repair:** it takes N revealed Troops markers out of the A.I. Available box and adds N to `troopsReturning[ai]`. The F7 routine then returns them once.
- **When it can't repair:** if, after that line, the A.I. has deployed with Troops ("AI Deploys to … Carrying") or landed them, or the box no longer holds N markers, nothing is changed. The notice instead says the turn can't be repaired safely and asks for a save from before the withdrawal, as you suggested.
- **Results:**
  - `L01_after_v024_withdrawal.json`: on import, 0 Available and 1 due back (Tracks shows it). B20 deploys nothing. No Kingston landing. British supply 1, score 0. The same happens through the autosave route.
  - `L01_natural_legacy_export.json`: the marker is queued and no landing follows.
  - `L01_natural_before_withdrawal.json` and `W01_B20.json`: untouched, with no notice.

## L02 — a v0.2.4 save with a pre-Pursuit surrender pending: confirmed, fixed
- **Evidence it looks for:** an Encounter holding a Struck Colors ship, with the v0.2.4/0.2.5 Pursuit line ("Pursuit! The withdrawal is cancelled and a new Encounter begins…") earlier in the current turn's log.
  - A struck ship counts as pre-Pursuit unless a "STRIKES COLORS" line naming it comes after that Pursuit line.
  - Ships that struck in the new Encounter are left undecided, so they are settled when that Encounter ends.
- **Repair:** it settles only those ships, with the existing `settleStruck`, under note 68.
  - The pursued side is the Defender in the last Gunnery Round line before the Pursuit. If there is none, it falls back to `s.combat.def`.
  - `captureShip` records the capture once. VP are still counted at F1 as usual.
- **Results:**
  - `L02_after_v024_pursuit.json`: Beresford is captured by the Americans on import. Passing or attacking at the second command gives the same owner and one capture line, by paste, through the autosave Undo route, and after reload.
  - `L02_natural_after_pursuit.json`: Ontario is captured by the British before Event #24, as in your fresh v0.2.5 run.
  - `L02_natural_before_pursuit.json`: untouched.
- **RULES_NOTES 71** documents both upgrades.

## How it was checked
- **Repository:**
  - `npm test`: unit 65, scenario 14, regression 127 (11 new), sim 100. 0 failures.
  - The new tests recreate the v0.2.4 saves by swapping its two code paths in for one step. Against v0.2.5, seven of them fail, the defect cases and the strike-after-Pursuit control. Against v0.2.6 all pass.
  - The controls cover:
    - a save from before the withdrawal;
    - reloading an upgraded save;
    - the "already sailed" warning, which leaves the state unchanged;
    - a v0.2.5 save after Pursuit;
    - a ship that struck in the new Encounter, which stays pending.
- **No false upgrades:** in 600 random v0.2.6 games I ran a save → load round trip at every seventh prompt, 9,454 loads in all, including 23 Pursuits and 23 aborted missions. None produced a notice or a state change from the upgrade. The only difference was the existing empty `encounter.flagIn` fill-in from 0.2.3.
- **Your scripts on v0.2.6:**
  - `new_boundaries.js`: 11/11. `followup_rules.js`: 9/9. `next_rules.js`: 28/28.
  - `edges.js`: 29. `map_checks.js`: no mismatches. `boundary_checks.js`: 23.
  - `recheck_engine.js`: all passing. `campaigns.js`: no stock changes.
  - `timing_campaigns.js`: 512 games, 0 re-embarks.
  - `paper_checks.js`: only the documented Package 8 row.
  - `migration_cases.js` and `natural_replays.js` need jsdom, which isn't available here. I covered the same saves in Chrome instead.
- **Real Chrome** (Playwright, google-chrome), at 1300 px and 390 px:
  - L01 and both natural L01/L02 saves by paste, and L02 with both later commands.
  - An old autosave holding L01 as the game and L02 as its Undo snapshot: Continue it upgrades L01, Undo upgrades L02, and a reload shows no second notice.
  - No page errors and no horizontal overflow. The smoke runs and full UI audits for both campaigns are clean.
- **Compatibility:** 160 v0.2.5 mid-game saves pass the check and finish in v0.2.6. All 40 of your saves (v0.2.4 and v0.2.5 evidence, legacy, originals) load.

## Open questions (unchanged)
Aid VII 62–63 at 0 Long Gun / 3 Troops; Package 8's first-Force choice; return timing for used or negated Tactics other than Rake. Pursuit settlement follows the project ruling in note 68.
