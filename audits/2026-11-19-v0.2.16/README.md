# v0.2.16 - physical Event card entry

19 November 2026. Implements the requested physical Event-deck dependency.

Whenever an Event draw is needed, the app stops at **Draw an Event card**, names the check being resolved, and asks for the printed **Event card number (1-38)**. Draw the top card from your physical deck, enter its number and choose **Use Event card** (or press Enter). The app then applies that card's spyglass, Lake/Coastal event, Weather Gage and Tactic-symbol information as appropriate. Target and Tactic draws remain automatic.

The normal interface has no automatic-Event option. Starting, importing, continuing or undoing into an older campaign enables physical draws; an Event already applied in an older save is not applied again. The next required draw uses the physical-entry procedure. The first prompt explains how to prepare the physical pile from the unused cards in that save. Keep the physical piles with the saved campaign.

## Behavior

* All six draw contexts are covered: Possible Encounter checks, Encounter Lake Event / Weather Gage draws, Reaction Segment Weather Gage, combat Weather Gage rechecks, Raids and Land Battles. A reused Lake Zone Event still requires the appropriate new Weather Gage card.
* Each draw has a serializable procedure frame. Entering a card or loading a pending entry does not replay previously completed Reaction dice, deployments or other procedure work.
* Blank, out-of-range, fractional, already-used and held-Intelligence numbers are refused. Only the entered card leaves the available pile. No future card is selected for the player.
* Gale outside its permitted Lake Action use is consumed and followed by a separate physical-entry prompt. The old number is cleared. A legal Gale goes to the existing Gale resolution.
* New-turn preparation and pile exhaustion prompt the player to shuffle the appropriate physical cards. Held Intelligence cards remain excluded. The app retains the established card-pool and expiry rules.
* Grouped updates always stop for card entry. Entered cards and their purpose are written to the log.
* Save, autosave, reload and Undo retain the pending entry, available cards and procedure locals. After undoing an entry, a reminder tells the player to return the physical card and restore prior piles if a reshuffle was undone.
* Adjust is paused while a card is requested so a manual correction cannot invalidate a suspended Raid, Reaction or other check. Enter the card or use Undo before correcting the position.
* Setup and Settings explain the physical requirement. Other card draws, combat calculation, AI play, maps and scoring retain their existing behavior.

## Verification

| Check | Result |
| --- | --- |
| Existing engine regressions | All **861 assertions** and **200 smoke campaigns** passed. |
| Physical Event engine suite | **32,286 assertions**, including **64 paired complete campaigns**, seeds 975000-975031 on both sides and four purposeful policies. **7,131 ordinary decisions**, **1,866 entered Event cards** and **1,866 exact saved-entry continuations** passed. All six draw contexts were reached, including **44 Gale redraws**. |
| Paired comparison | The automatic reference records its exact card transcript, including discarded Gales. The physical path enters that transcript and matches all gameplay, dice, cards, results and effective logs after each ordinary decision. Only extra input-prompt counters, physical-entry log lines, preparation state and unused return-value slots are excluded from comparison. No Reaction reroll or other replay was observed. |
| Input / persistence cases | Invalid numbers, duplicate availability, held cards, legal and illegal Gale, exhaustion with Intelligence, pending-entry save validation, exact reload and Undo/replay passed. |
| DOM controls | **32 assertions on the unmodified production HTML** passed: numeric label/input, disabled invalid submissions, Gale clearing/redraw, legacy import, pending reload, Undo instructions, preserved map draft, grouped pacing and pending-correction lock. |
| Historical UI regressions | All **11 previous suites** passed using the explicit automatic-Event compatibility fixture described below. Their historical fixed click sequences do not claim to cover the new physical flow. |
| Complete real-browser play | Chromium 153.0.8010.0, unmodified HTML: U.S. seed **976001**, fleet policy, 1,440 px, **124 actions / 24 entries**, final **-16 British Marginal Victory**. British seed **976002**, coastal policy, 390 px, grouped, **144 actions / 40 entries**, final **0 Draw**. |
| Browser continuation | Every real control matches a separate native reference state. Across both campaigns, **10 reloads while a card was pending**, **8 card-entry Undo/replays**, **8 map-inspection checks**, invalid input checks and final ledger totals passed, with no page errors. The physical test piles use an independent shuffle; human policies do not inspect their order. |
| Focused browser / download | Original A7 fixture reaches number entry. Invalid 39 is refused; Gale asks for another card; pending redraw survives reload; Enter submits once; Undo/replay is exact. No horizontal overflow at 320, 390, 1,024 or 1,440 px. Actual app download matches the independently rebuilt release. |

Independent assembly and downloaded app: **413,864 bytes**, SHA-256 **`eef9136a8220b8733f17403fce7f0c95aa3db83275fbd425d3bc5c4b7e8044e2`**.

These are implementation/regression checks, not a balance study or physical-device playtest. Browser evidence and screenshots are under `evidence/browser/`; raw results are under `evidence/results/`.

## Compatibility and test architecture

The core resolver retains its automatic draw path for engine-only simulations and historical regression positions. The app's `enablePhysicalEvents` function always enables the physical path; no player-facing fallback is offered, including on imported saves.

`tests/browser/legacy_events.js` adapts only the HTML loaded by the older DOM regression suites to retain their original automatic-Event click sequence. It does not change the distributed app. The new physical DOM suite and all new browser runs use the actual, unmodified distributed HTML. The engine comparison separately verifies that adding the saved Event procedure preserves the established rule resolution for the same card transcript.

The new entry procedure uses native call/return steps. It does not interrupt and replay a partially executed action to obtain a number. Reaction rolls and the selected Raid are retained while the child Event procedure waits for input.

## Reproduce

```sh
node tools/build.js
npm test
# jsdom 26.1.0 must be on NODE_PATH.
npm run test:ui
AGC_EVIDENCE_OUT="$PWD/audits/2026-11-19-v0.2.16/evidence" node tests/physical_events.js .
node tests/browser/physical_events.js
python audits/2026-11-19-v0.2.16/evidence/verify_release.py
# Browser runs need Playwright and @sparticuz/chromium 153.0.0.
node audits/2026-11-19-v0.2.16/evidence/browser/campaigns.js .
node audits/2026-11-19-v0.2.16/evidence/browser/focused.js .
```

Run evidence-generating commands on a copy to retain the recorded bytes. Set `AGC_URL` on the focused browser run to check the published page in an isolated context.

## Live publication

Release `3711963c1de4b64eb3e1b64dc01804cac87234bc` is on `main`; `gh-pages` is `7e46fb865c85b7d0dfd0b6947302d2522efa78dd`. [GitHub Pages deployment 44622181678](https://github.com/ramyahoo88/A_Glorious_Chance_solo/actions/runs/44622181678) completed successfully.

The bare [public URL](https://ramyahoo88.github.io/A_Glorious_Chance_solo/) serves exactly the tested release. The focused Chromium run against the public page passed physical-entry enforcement, rejection of 39, Gale discard/redraw, pending-entry reload, Enter submission, exact Undo/replay and the 320/390/1024/1440 px checks, with no page errors. The actual live app download is also byte-identical to the independently rebuilt 413,864-byte release. `evidence/browser/live-focused.json` and `evidence/results/live-build.json` contain the results; the browser context was isolated from existing user storage.
