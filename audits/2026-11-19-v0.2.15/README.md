# v0.2.15 - map audit corrections

19 November 2026. Implements all four findings and the navigation recommendation from the [v0.2.14 comprehensive re-audit](../2026-11-19-v0.2.14-reaudit/).

| Item | Correction | Verification |
| --- | --- | --- |
| A01 - omitted port ships | Append both the box heading and its ship grid. The Beached branch is corrected too. | Original seed 973000 shows all 16 U.S. and six British ships, including both occupied boxes. Temporary-port, Escort-box and Beached controls pass. Ships open their printed details. |
| A02 - omitted intermediate movement | An optional, non-persistent observer runs after every completed procedure handler. The UI records only public ship changes, in order, including automatic steps before the next prompt. | Original Oneida case now records Sacket's Harbor -> Niagara (Army Support), then Niagara -> York (Patrol). Its full gameplay state matches the original audit position. All 128 paired campaigns preserve game state after every action and have **zero omitted procedure-boundary moves**, compared with 28 affected actions in the original audit. |
| A03 - hidden arrows / overlapping badges | A separate pixel-scale route layer uses the actual fleet/port rectangles. Paths go around labels; repeated routes use separate entrances and avoid used corridors. Badges stay clear of labels and other badges, with a short pointer when necessary. Resize observation updates the layout. | All five original natural fixtures plus a nine-route grouped action pass at seven widths, on both board and expanded map: **84 layouts**. No hidden arrow endpoints, empty routes, overlapping badges, badge/label overlaps or map-label collisions were detected; screenshots were also reviewed. |
| A04 - narrow desktop Tracks overflow | Tracks choose columns from the available panel width and retain all supply spaces; rows can wrap. | Original fixtures have no document overflow at 1,024 px. Focused checks at 1,001, 1,024, 1,100, 1,150 and 1,280 px keep every supply track inside the viewport. A 390 px viewport with larger text also fits. |
| Q01 - inspection navigation | Add Back to map, Back to fleet and Back to port. Retain the parent DOM, scroll position and focused control while inspecting. Close/Escape still closes the dialog. | Real browser and DOM tests cover map -> fleet -> ship -> fleet -> map and port -> ship -> port, parent scroll/focus, keyboard containment and Escape. Inspection preserves game state, draft, Undo, dice and autosave. |

No rule or difficulty adjustment is included. The observer does not choose moves, draw cards or use hidden markers; it is a temporary callback, never part of a save. Old saves retain their existing reports and begin recording the extra steps on the next action. Saving, reload and Undo preserve the report with the position.

## Validation

* `npm test`: **861 existing engine assertions and 200 smoke campaigns passed**.
* `npm run test:ui`: all **11 suites passed**, including the previous 63 map checks and **30 new focused assertions**.
* **128 paired map campaigns**, seeds 971000-971015, both sides and all four grouping/AI-notice combinations: **12,381 actions**, **9,740 movement groups**, **892 exact map-save checks**, no gameplay difference or omitted observed movement. The original sample had 9,708 movement groups; the newly recorded intermediate steps account for the increase.
* **128 fresh option-grid campaigns**, seeds 974000-974063, both sides: all 64 tested option combinations per side, **16,460 decisions**, **599 exact save continuations**, **eight full save-to-end continuations**, **524 preview-purity checks**, **256 first-round strength comparisons** and **1,024 independently reconstructed Tallies** passed.
* **Two complete Chromium campaigns through visible controls**: U.S. seed 973001, desktop, 110 actions, final -22 British Victory; British seed 973002, 390 px/grouped, 97 actions, final +15 U.S. Marginal Victory. Every action matches the complete reference state. Six Undo/replays, four reloads and ten map/focus checks pass; no page errors.
* **84 browser layouts** cover widths 320, 360, 390, 412, 768, 1,024 and 1,440 px. Resize checks use the actual observer and window events, not a manual layout call.
* Independent assembly and the actual browser app download match `dist/index.html`: **405,177 bytes**, SHA-256 **`943fab01a4be16d07d1d915b452167ddf6d03d2eaccd9d2ffd80689c0652e140`**.

These checks validate the corrections and compatibility. They do not add a new balance estimate or physical-device test. Automated Chromium is version 153.0.8010.0. The full original audit and fixtures are retained unchanged.

## Reproduce

Run evidence scripts on a copy when retaining the recorded bytes: they write results beside themselves.

```sh
node tools/build.js
npm test
# jsdom 26.1.0 must be on NODE_PATH.
npm run test:ui
node audits/2026-11-19-v0.2.15/evidence/map-audit.js .
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.15/evidence/campaign/sweep.js . 974000 64 options
python audits/2026-11-19-v0.2.15/evidence/verify_release.py
# Browser evidence additionally uses Playwright and @sparticuz/chromium 153.0.0.
node audits/2026-11-19-v0.2.15/evidence/browser/map-layout.js .
node audits/2026-11-19-v0.2.15/evidence/browser/focused.js .
node audits/2026-11-19-v0.2.15/evidence/browser/campaigns.js .
```

`tests/browser/fixes_v0215.js` and the focused browser script read the original re-audit saves directly. The map observer harness independently watches completed handlers and requires their geographic transitions to occur in the recorded history. State equivalence ignores only the presentation report. The focused browser script can also run against the published page with `AGC_URL` set to its URL; it uses an isolated context.

## Live publication

Release `e5b72a2a21b65866e3f3b57bebaeb4fcebf274ae` is on `main`; the published branch is `aa61f2ec9fd1b7b0219a7dd1fb9521fe0872ec08`. [GitHub Pages deployment 44610655926](https://github.com/ramyahoo88/A_Glorious_Chance_solo/actions/runs/44610655926) completed successfully.

The bare [public URL](https://ramyahoo88.github.io/A_Glorious_Chance_solo/) returns exactly the tested 405,177-byte release. The focused Chromium run was then repeated against that live page in an isolated browser context: both original port counts, ship details, Back navigation with scroll/focus restoration, Oneida's two ordered voyages, Undo/replay, reload, all tested Tracks widths, larger text and the actual downloaded app passed with no page errors. `evidence/browser/live-focused.json` and `evidence/results/live-build.json` record the results. These checks did not modify any existing user campaign or storage.
