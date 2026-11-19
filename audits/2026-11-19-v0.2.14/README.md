# v0.2.14 — campaign map

19 November 2026. Adds the requested map showing ships, the A.I.'s current position, its missions and movement during play.

* The main board shows a schematic Lake Ontario shoreline, its six campaign zones, homeports, temporary homeports and occupied Escort boxes. U.S. and British fleets have counts, side/A.I. labels and missions. Tap a fleet or port for individual ships and their counter details. Port counts distinguish Deployable ships from ships preparing, repairing or in transit.
* Numbered arrows and gold endpoint outlines correspond to the **latest action**. **Show last action** opens a larger map, named ships, origins/destinations, missions and the existing written board-change report. Moves inside grouped updates remain in order. A sinking is recorded at its actual off-board destination rather than drawn as a voyage to a fictitious location.
* The toolbar's **Map** button makes it accessible during any prompt. Existing full zone lists remain under **All zone details**. The written instructions remain beside the map.
* The report travels with Save, autosave, reload and Undo. Older saves open normally and begin recording after the next action. An action with no movement says so and replaces older arrows. Manual corrections clear the previous report.
* Only public ship positions, deployed Forces and already visible convoy/zone information are used. The map does not read the contents of hidden markers, unrevealed Target Cards or future decks. The shoreline and zone divisions are schematic; game movement continues to follow its printed areas and instructions.

## Verification

* `npm test`: 861 existing assertions and 200 complete smoke campaigns passed.
* `npm run test:ui`: all ten DOM/control suites passed, including **59 new map assertions**. Covers natural A.I. deployment, withdrawal to port, capture and zone movement; route endpoints, numbered arrows, ship counts and missions; inspection without changing position/dice/draft/history/storage; hidden-information independence; old saves; exact movement reports after reload and Undo.
* **48 complete campaigns**, seeds 969000–969023 on both sides, four purposeful policies and both report paces: 5,226 decisions, 3,582 recorded transition groups, 1,231 grouped notices and 497 save round trips. After every action, complete gameplay state, hidden decks, RNG, log and final result match direct engine play. Only the presentation report is excluded from this comparison. This is a compatibility check, not a new balance estimate.
* Independent Python assembly reproduces `dist/index.html` exactly: **393,345 bytes**, SHA-256 **`db68717460b572426639d7a656d3f206eb8f2d459f59c3cc3d4b312fdf40e8d9`**.

The four natural before/after positions were found in an 18-campaign diagnostic search beginning at seed 968000. The search is separate from the 48 complete equivalence checks. The fixtures and their exact actions are in `evidence/natural-fixtures.json`.

## Reproduce

```sh
node tools/build.js
npm test
# NODE_PATH must contain jsdom 26.1.0.
npm run test:ui
node audits/2026-11-19-v0.2.14/evidence/map-equivalence.js "$PWD"
python audits/2026-11-19-v0.2.14/evidence/verify_release.py
```

Evidence scripts write results beside themselves. Run on a copy to preserve recorded bytes. The DOM tests read the original before/after fixtures and use the built page's actual controls. The equivalence check executes gameplay in an isolated JavaScript runtime; it is not a visual-browser test.
