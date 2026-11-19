# v0.2.17 - Event recovery and deck status

19 November 2026. Implements all three findings and Q01 from [the v0.2.16 re-audit](../2026-11-19-v0.2.16-reaudit/). Source baseline: `fe8aa45f994e390ae82589980bc0e027bd4deec7`.

## Corrections

| Finding | Result |
| --- | --- |
| A01 - incomplete Event saves | Validate the six allowed saved callers, their resume points and the necessary PE, Encounter, Reaction, combat, Raid or Land Battle data before accepting an import. The original three damaged fixtures are refused without changing the open campaign, typed number, Undo history or autosave. Valid saves resume with the same dice. A Land Battle still accepts the legitimate disappearance of supporting Forces after their Troops launch and a Harbor Encounter destroys their ships. |
| A02 - used Intelligence | The log now tells the player to remove the Intelligence marker, put the card with the used Event cards, and return it at the next Event-deck reshuffle. Card availability follows the existing rules. |
| A03 - Undo instructions | A saved `eventRestore` presentation record names the exact cards to return, in top-first order. The Event prompt suppresses preparation/shuffling instructions while that record is active. Reload and save transfer retain it; the next valid action clears it. Consecutive Undos preserve the full card order. Exhaustion and grouped turn-reset boundaries explain how to restore the previous pile if it has already been mixed. |
| Q01 - Deck status | A button beside number entry opens sorted remaining/used card numbers, both sides' held Intelligence cards, and the last entered card and purpose. It preserves the typed number, focus, dice, state, history and autosave. It never shows the internal shuffled order. |

The saved restoration record is presentation information. When comparing an Undo checkpoint with the previous state, tests exclude only that new record; the complete gameplay, cards, RNG, log, procedure frames and map report must match. Re-entering the card clears the record and reproduces the full original state exactly.

`eventDrawText` constructs the displayed physical instructions from the current checkpoint instead of reusing a saved preparation sentence after Undo. Existing saved Event prompts therefore receive the corrected display when opened. The required physical Event deck and automatic Target/Tactic draws retain their v0.2.16 behavior.

## Verification

| Check | Result |
| --- | --- |
| Engine regression suite | All existing tests and 200 smoke campaigns passed. Physical Event comparison: **32,287 assertions / 64 paired complete campaigns**, including all six consumers and **1,866** exact pending-entry continuations. |
| New recovery regressions | **303 assertions**, including **210** valid card continuations across the original six saved contexts; the three original malformed fixtures and further damaged-caller cases are refused. Intelligence disposition, legitimate missing support after Harbor, ordered multi-Undo and damaged restoration metadata are covered. |
| DOM controls | All 11 historical suites, the 32 physical-entry assertions and **81 new production-HTML assertions** passed. The older suites retain their documented test-only automatic-Event fixture. The physical and new recovery suites use unmodified release HTML. |
| Full option grid | **128 complete physical-card campaigns**, seeds 978000-978063, both sides, all 64 combinations of the six existing engine switches. **21,879 decisions**, **5,251 entries**, **5,854 exact saved continuations**, including every pending Event. **8 full saved continuations / 1,058 further actions** passed. No invariant failures. |
| Comparison with v0.2.16 audit | The 128 game records, decision counts, scores, ship-change counts, coverage and rule observations match. The stored whole-state hashes differ in 31 games because those hashes include the corrected Intelligence log sentence; raw hashes are retained and excluded from this record comparison. |
| Complete Chromium campaigns | U.S. seed **982001**, fleet, 1440 px: **166 actions / 28 entries**, final **-62 British Decisive Victory**. British seed **982002**, coast, 390 px, grouped: **159 actions / 49 entries**, final **-48 British Decisive Victory**. Actual controls match a native reference after every action; final VP ledgers agree. |
| Browser persistence and inspection | Across both full campaigns: **11 pending-entry reloads, 9 exact Undo/replays, 10 Map inspections and 10 Deck status inspections**. No page errors. |
| Original findings in Chromium | The three damaged saves are rejected atomically. First entry, ordinary entry, Gale redraw, exhaustion and an actual grouped turn-reset boundary all preserve Undo instructions through reload and Save/pasted transfer; replay is exact. Consecutive card Undos, Intelligence disposition and Deck status draft/focus restoration pass. |
| Responsive display and download | Focused browser checks find no horizontal overflow at **320/390/1024/1440 px**. Deck status and Undo screenshots were visually inspected. Actual Download app bytes match the independent rebuild. |

Independent release assembly: **422,019 bytes**, SHA-256 **`8623b7a73cacdda6eb9095871be9b8ec8fde62113ba86bb2a2910ce3000f18e4`**. Browser runtime: Chromium **153.0.8010.0**.

The campaign checks are implementation regressions, not a balance study or physical tabletop/device testing. The physical deck uses an independent deterministic shuffle and asserts its membership against the app rather than repairing disagreements. Human policies use visible decisions and never inspect its future order. Existing independent checks cover Troops/ship conservation, tracks, Naval Balance, Tally VP components and final thresholds.

## Reproduce

Run on a copy to preserve recorded evidence. DOM tests need jsdom 26.1.0; browser scripts need Playwright and @sparticuz/chromium 153.0.0 on NODE_PATH.

```sh
node tools/build.js
npm test
npm run test:ui
python audits/2026-11-19-v0.2.17/evidence/verify_release.py
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.17/evidence/campaign/sweep.js . 978000 64 options
node audits/2026-11-19-v0.2.17/evidence/campaign/find-boundary.js .
node audits/2026-11-19-v0.2.17/evidence/browser/campaigns.js .
node audits/2026-11-19-v0.2.17/evidence/browser/focused.js .
```

Use `AGC_URL=https://ramyahoo88.github.io/A_Glorious_Chance_solo/` for the focused browser script to check the live page. It creates an isolated context, uses the environment proxy when present and verifies the actual app download against the local release. No existing user browser storage is used.
