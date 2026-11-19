# A Glorious Chance Solo Companion — response to the v0.2.4 audit

Reviewed audit: "A Glorious Chance Solo — Independent release and rules audit", v0.2.4 (release commit `f15cdd3`; evidence pushed in `f504ac7`), findings W01–W03.
Result: v0.2.5, commit `aa6de34` on branch `release/v0.2.5` (not yet pushed). Built `dist/index.html`: 296,920 bytes, sha256 `8e6f43c6ca0c0a6586850ac3ce55657ec72c5e4184bc8f620b4590482658b2a6`. Two builds were byte-identical.

All three findings were confirmed and fixed. When this is pushed, GitHub Pages (`gh-pages`) will be updated to the same bytes.

Results of your scripts on the new source:
- `followup_rules.js --require-rules`: 9/9 pass (exit 0).
- `next_rules.js --require-rules`: still 28/28.
- `timing_campaigns.js`: 512 games, 19 aborted A.I. coastal missions. In every one, Available stayed at 0 and the marker was queued for F7. 0 re-embarks.

## W01 — withdrawn A.I. Troops re-embark the same turn: confirmed, fixed
- **Cause:** `abortCoastalMission` sent the A.I. side's markers straight back to its box (`returnAiTroops`), while yours waited in `troopsReturning`. That was inconsistent with F7 and rules note 23.
- **Fix:** both sides now add the markers to `troopsReturning` and clear the Force's count. The F7 routine added in 0.2.4 returns them once: yours become Available, and the A.I.'s go back to its pool as revealed Troops. The log line now says the markers "cannot land this turn and return at F7".
- **W01_B20:** after the withdrawal the A.I. has 0 Available and 1 due back. B20 takes its zero-Troops row and deploys nothing, so there is no Kingston battle. Tally shows British supply 1 and score 0. At Reset exactly one marker comes back.
- **W01_natural:** British Available stays at 0 and 1 is queued.
- **Your optional usability item is done:** Board → Tracks shows "N due back at F7" for each side whenever any are queued, using the existing count.
- **RULES_NOTES:** note 23 extended; new note 69.

## W02 — a surrender carried through Pursuit: confirmed, fixed under a project ruling
- **Ruling (the user's, 18 Nov 2026):** when Pursuit cancels a DW withdrawal, the ended Encounter settles its Struck Colors ships at once, as if the DW withdrawal had happened.
  - The pursued (Defending) side's struck ships are Captured.
  - The Attacker's struck ships are Rescued.
  - If the Attacker also withdrew (AW/DW), each struck ship rolls 1d6 as in LC5.3.
  - Reasoning: LC5.3 doesn't name this ending, and Pursuit should never make a capture less likely than the withdrawal it cancels.
- **Fix:** the Struck Colors part of `resolveEncounterEnd` is now `settleStruck(s, lines, pursued)`.
  - `finishRound` returns `pursued: c.def` with the Pursuit outcome. Older saves fall back to `s.combat.def`.
  - `afterCombat` settles the surrenders before the Disengaged ships return and before the new Encounter's Event is drawn. When anything was settled, a "Pursuit – a new Encounter" screen shows the result first.
  - The Disengagement recovery and the one-Encounter cleanup are unchanged.
- **W02_Pursuit_struck:** Beresford is captured by the Americans before Event 9. Passing or attacking at the second Command Decision now ends with the same owner (US) both times, in the engine and in real Chrome.
- **C02 control:** an ordinary DW still captures him at the end of the Encounter.
- **RULES_NOTES 68.**

## W03 — legacy Rake prompt: confirmed, fixed
- **Fix:** a new `upgradeLegacyPrompt(s)` runs from `checkSaveState` (file, pasted text and autosave "Continue it") and from `undo()`. It recognises a pending `combat/grRake` choice with no stored candidate.
  - It rolls the random ship once from the saved dice and stores it in the frame.
  - It renames the button.
  - It is the same draw v0.2.3 would have made after the choice, so the ship is the one that version would have hit.
  - Current saves are left untouched, and no dice are used for them.
- **W03_legacy_Rake.json:** the third button reads "Random ship: Royal George (A)" on load. The hits land on him, and the button still names him after Undo and after reload with "Continue it".
- **N07_N08 control:** unchanged.
- **RULES_NOTES 70.**

## Open questions (unchanged)
- Aid VII's two unassigned rolls (0 Long Gun / 3 Troops, 62–63).
- Package 8's choice of first Force.
- When the other used or negated Tactics return.
- W02's ruling is now recorded as a project ruling (note 68). Recheck it if a designer ruling turns up.

## How it was checked
- **Repository:**
  - `npm test`: unit 65, scenario 14, regression 116 (15 new), sim 100. 0 failures.
  - `tests/sim.js 400` and my audit sims (400 random + 400 manual-package games, invariant checks): no violations.
  - Each new defect assertion was run against v0.2.4, and all of them fail there:
    - **W01:** four assertions. B20's Kingston landing reproduces [−1 supply, −7 score].
    - **W02:** the second command gives BR (rescue) with Pass and US with Attack, exactly your finding.
    - **W03:** the button is anonymous.
  - The controls pass on both versions.
- **Your scripts on the new source:**
  - `followup_rules.js`: 9/9. `next_rules.js`: 28/28.
  - `edges.js`: 29. `map_checks.js`: no mismatches. `boundary_checks.js`: 23.
  - `recheck_engine.js`: all passing. `campaigns.js`: no stock changes.
  - `paper_checks.js`: only the documented Package 8 row.
  - `timing_campaigns.js`: as above.
- **Real Chrome** (Playwright, google-chrome; jsdom isn't available here), at 1300 px and 390 px:
  - Your W01_B20, W01_natural, W02 (both endings), C02, W03 and N07 control saves were loaded through Load → paste and played with the page's buttons.
  - The four legacy saves (0.2.0–0.2.3) load.
  - No page errors and no horizontal overflow.
  - The smoke runs and the full UI audits (undo, redo, save, reload) completed both campaigns with no issues.
- **Compatibility:**
  - 160 v0.2.4 mid-game saves (random points, both campaigns, Cutting-Out on and off, manual packages) pass the save check and finish in v0.2.5.
  - All 27 of your saves load. The isolated positions end cleanly with their Encounter.

## Not tested here
Android touch, home-screen installation and an offline launch from that shortcut remain device checks.
