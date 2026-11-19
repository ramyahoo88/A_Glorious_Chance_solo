# v0.2.12 — audit corrections and verification

19 November 2026. Implements the [v0.2.11 comprehensive audit](../2026-11-19-v0.2.11/) after the owner's instruction to fix and publish its recommendations.

| Audit item | Released behavior | Verification |
| --- | --- | --- |
| A01: ship corrections during an Encounter | Participant box, owner and steps stay locked until the Encounter ends. Adjust explains the lock before editing; other ships and tracks remain adjustable. | Original Encounter, Command Decision, lineup, Tactics and round-result saves; rejected edits preserve game, dice, draft, Undo and autosave. Existing package/Reaction selection safeguards also pass. |
| A02: malformed saved card IDs | Import validates the four draw piles, current and drawn cards, pending Tactics, Intelligence, Weather Gage and stored deployment/Force references before replacing a game. | Unknown, mistyped, missing and wrong-deck references refused; valid older positions, empty piles and held cards accepted. |
| A03: missing losing-Flagship Melee check | Check the winner at +1 and loser at +2, with Grapple where applicable. Capture only the surviving original losing commander. | Natural seed 920016 plus winner-only, loser-only, both/neither Flagship, no-result, death, capture, Grapple and save/reload cases. |
| Q01: replacement commanders during one result | Starting commander takes that Round result's casualties; replacement waits until its withdrawal/flag-transfer decisions finish. No checks, capture or modifiers are applied to the successor within that result. | Natural seed 920023, multiple hits, sinking/striking, wounded survivors, pending-save continuation and later transfer. |
| Q02: zero eligible guns | No attack, no scatter result and no die roll. The Convoy arrives normally unless another rule delays it. | Natural seed 920011; zero/one/21-gun boundaries; +2 supply arrival; reduced escort and reduced attacker controls. |
| Offline app download | Setup and Reference → Offline app download clean, self-contained HTML. Save still exports a campaign. | Downloaded HTML boots independently; the in-game download is identical to the clean setup download and contains no current position. |
| Full-log search | Case-insensitive ship/card/turn/phase search combines with category filtering across the entire log. | Finds entries older than the recent 400, preserves typing focus and leaves game state/history/autosave unchanged. |

Q01 and Q02 are **project rulings**, recorded in RULES_NOTES 97–98 and the in-app Reference. They are not attributed to the publisher. Earlier unresolved rules interpretations remain open. Loading an older save does not reroll casualties already resolved by an earlier version.

## Validation

* `npm test`: **861 assertions**, all passed, followed by **200 complete smoke campaigns**, no failures.
* `npm run test:ui`: all **eight DOM/control suites** passed, including **117 new UI assertions**. These are DOM emulation checks, not a claim of visual browser coverage.
* **1,600 matched campaigns** (seeds 920000–920159, both campaigns, five purposeful policies): 203,567 decisions; no failures. Includes 7,344 checked save continuations and 100 separately instantiated full save-to-end continuations.
* **128 option-grid campaigns** (seeds 943000–943063, both campaigns): all 64 combinations of the six tested settings per side; 16,698 decisions; no failures. Includes 599 checked save continuations and eight full save-to-end continuations.
* Original natural positions are replayed in `evidence/natural-replays.json`. Engine regression coverage is in `tests/regression_v0212.js` (67 assertions).
* Independent Python assembly of the source files exactly reproduced the shipped HTML: **375,938 bytes**, SHA-256 **`01e2a45f80d5ca8ff67a12a2007ecd929469223ae79cb9e322a5c135127f5c25`**.

The matched correction run changes 209 final scores and 45 victory tiers out of 1,600. Corrected casualty checks and omitted zero-gun rolls change later seeded dice, so these counts are a regression comparison, not an estimate of the isolated balance effect.

## Reproduce

```sh
node tools/build.js
npm test
# NODE_PATH must contain jsdom 26.1.0; the app itself has no dependency.
npm run test:ui
node tests/regression_v0212.js audits/2026-11-19-v0.2.12/evidence/natural-replays.json
node audits/2026-11-19-v0.2.12/evidence/sweep.js . 920000 160 matched
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.12/evidence/sweep.js . 943000 64 options
```

The previous audit's report, PDF, evidence and importable positions remain unchanged. This folder records their correction, rather than rewriting the original findings.
