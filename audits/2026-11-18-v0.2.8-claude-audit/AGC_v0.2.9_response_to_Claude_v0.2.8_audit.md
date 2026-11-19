# Response to Claude's independent v0.2.8 audit

18 November 2026. Claude's report was posted at `fc0aed0` while the comprehensive audit was still in progress. Its findings were independently checked and incorporated **before** v0.2.9 was published at `6dc43ca1dc9fd195dcffed67155767514bc11582`. The completed audit and evidence were added at `5b4249d`.

**Result:** five confirmed Medium findings, all 16 Low items, the confirmed text defect within M4, and the applicable Harbor effects in Q-B are already addressed in v0.2.9. M3 and the substantive M4 calculation remain disputed interpretations, with the current behavior explicitly documented. They were not silently treated as established defects.

This response reconciles the two reports. It introduces no new gameplay changes, does not create another app version, and does not change historical-save recovery. The user's priority remains fresh games and saves created during current play.

## Medium findings

| Claude ID | Disposition in v0.2.9 | Independent finding and regression evidence |
|---|---|---|
| M1 — Missed Signal attack decision | Fixed. The actual-odds test excludes the absent ship on either side, including its tow participation. The separate printed weapon-plus-Defense comparison remains on the Forces. | F12; `tests/regression_v029_combat_followup.js`: below-threshold attack, reverse legal attack, spent-event and tower controls. |
| M2 — later American A.I. rounds | Fixed. Gunnery and Close Action use the legal attack subset. Later rounds preserve surviving existing tow pairs instead of silently making new ones. Omitted ships remain Engaged for subsequent defense. | F04; `regression_v029_combat.js` and `regression_v029_combat_followup.js`. |
| M3 — Pursuit versus optional human withdrawal | Behavior reproduced; defect classification disputed. Existing card-specific interpretation retained. See the detailed explanation below. | Q01; RULES_NOTES 87; ordinary W, no-eligible-defender and Pursuit-boundary controls. |
| M4 — OA1 recalculation | Confirmed stale-column text fixed. The literal A6 calculation is retained pending an authoritative ruling; the alternative calculation is not established by the source. | F17 / Q02; RULES_NOTES 82; `regression_v029_deploy.js`, natural U.S. seed 3 and OA1-off neighbor. |
| M5 — keyboard/background advancement | Fixed. Dialogs block game shortcuts; buttons retain native Enter/Space, text fields retain editing shortcuts, repeated key events do not advance play. | F10; `tests/browser/ui_v029.js` plus native Chrome checks. |
| M6 — setup overwrite | Fixed. Starting over asks before replacing a retained save. Loading from setup preserves the retained campaign and its Undo history as the predecessor. Cancel and bad imports preserve saved bytes. | F22; `tests/browser/persistence_v029.js` and `persistence_followup_v029.js`, plus native Chrome. |
| M7 — Adjust moves lake ships | Fixed. A steps-only correction keeps the current location and Force. Ownership changes require an explicit compatible destination, or are rejected before changing the game. | F23; `persistence_followup_v029.js`, plus the supplied lake position in native Chrome. |

### Why M3 remains an open ruling

Generic LC5 lets a human decline a W result. A05's more specific trigger is a DW result with enemy ships **eligible** to withdraw. The card does not expressly make a prior election to withdraw a prerequisite. Therefore the two readings are:

1. Current: eligible DW triggers Pursuit, cancelling the withdrawal and starting the next Encounter.
2. Claude's proposed alternative: first offer W, and trigger Pursuit only if the defender elects it.

The reported capture behavior is real, but does not by itself prove the second reading overrides the first. The existing interpretation and the user's separate adopted ruling about settling struck ships at the Pursuit boundary are preserved. A designer clarification or an explicit chosen variant could change this deliberately; passing tests cannot settle the text dispute.

### Why M4 is not changed to the proposed calculation

OA1 refers back to recalculating as in A6, which counts currently Deployable ships. That literal method excludes ships already assigned to the lake. The rule's stated American advantage supports questioning the result, but does not establish that the total should instead be the old A6 value adjusted only for refitting British ships.

In the natural U.S. seed 3 example, the retained calculation is −62; the alternative is +32 and changes whether A8 deploys. The final app now correctly names the applied column. Changing the method would change a rule interpretation, rather than merely correcting the independently confirmed presentation defect.

## All Low findings

| Claude ID | Implemented result | Independent finding / evidence |
|---|---|---|
| L1 — upgrade before impossible Army Support | Reject insufficient transport capacity before the upgrade/OA1 roll; preserve the later check after a valid refit removes ships. | F15; `regression_v029_deploy.js`. |
| L2 — PE placement and transfers | Every legal balanced initial order is selectable; displaced-marker transfers permit each remaining friendly Force in the original zone. Sole choices stay automatic. | F16; all six three-Force orders, repeated cycles, transfer and save/RNG controls. |
| L3 — requisitioned damaged ships | Normal Step-marker/port cleanup occurs; a Reduced ship returns through normal repair after its missing turn. The card's unspecified return box is documented as an interpretation. | F18; `regression_v029_coastal.js`. |
| L4 — flag transfer after Close Action | Offer the existing eligible transfer and casualty check after Close Action and before a new column replaces the old one. It is an opportunity, not a guaranteed surviving leader/bonus. | F13; `regression_v029_combat_followup.js`. |
| L5 — A.I. subset preview | Show the legal attack plan and its real first-round participants, or explicitly show that the A.I. would Pass. | F05; `regression_v029_preview.js`. |
| L6 — omitted Missed Signal ship | Consume the Event on its first eligible round even if the player leaves that ship out; ineligible ships do not consume it early. | F14; `regression_v029_combat_followup.js`. |
| L7 — Rainy Squalls preview | Command and lineup show Close Action strengths/matchups for the affected Patrol Segment; Reaction keeps its Gunnery preview. | F21; `regression_v029_preview.js`, `tests/browser/ui_followup_v029.js`. |
| L8 — manual Land Battle wording | Name the final printed Long Gun/Troops column after shifts; no negative-left instruction. | F19; `regression_v029_coastal.js`, native Chrome roll 64 case. |
| L9 — empty Harbor announcement | Trigger and battle setup share the same legal defender filter. | F20; `regression_v029_coastal.js`. |
| L10 — offscreen next prompt | Reveal the new prompt when outside the unobscured viewport; leave already-visible instructions in place. | F25; DOM geometry controls and real Chrome at 340 CSS pixels. |
| L11 — keyboard ship/Tactic choices | Native focusable buttons, selected/disabled states, and preserved ship-button focus. | F11; `ui_v029.js`, native Enter/Space checks. |
| L12 — VP adjustments missing from ledger | Record the signed delta through addVP; also refresh completed score/tier without deducting Construction Delay twice or overwriting a forced ending. | F24; `persistence_followup_v029.js`. |
| L13 — zero displayed as one | Show the proposal's actual zero and its validation error; a legal nonzero value can then be entered. | F26; `ui_followup_v029.js`, native Chrome. |
| L14 — Auto-fill not minimal/repeatable | Reuse the Main-first minimum-subset selection with a copied RNG cursor. Repeated proposals are stable and inspecting them spends no game dice. | F27; `ui_followup_v029.js`, independent minimality and supplied Package4 fixtures. |
| L15 — inaccessible old log entries | Full-log toggle, matching-entry counts and accessible filter. | `ui_v029.js`; a natural 425-entry log checked in Chrome. |
| L16 — crowded dialog rows | Settings and Adjust labels/fields occupy separate rows. | `ui_followup_v029.js`, final browser review. |

## Open rules questions

| Claude question | Disposition |
|---|---|
| Q-A — OA1 | Calculation remains an explicit question; misleading column text fixed. |
| Q-B — Harbor zone Events | Resolved card by card, not as a blanket all-or-none option. Pending Haze and Missed Signal apply to qualifying Harbor combat and are consumed once. The independent Haze witness is **14 versus 10**, correcting the report's suggested 14.5. Rule12's explicit two-Gunnery-Round Harbor procedure remains under Rainy Squalls. If Missed Signal makes an entire first round unfought, that round uses no dice and Haze remains pending; this narrow combined-event timing is explicitly labeled an interpretation. See F28 / RULES_NOTES 84 and 36 coastal regression assertions. |
| Q-C — Rainy Squalls in later Encounters | Unresolved; no silent lifetime change. |
| Q-D — Tactic lifetime | Unresolved interaction between general and card-specific wording; existing interpretation retained. |
| Q-E — Defender Rake timing | Unresolved whether the human may deliberately hold it for a later eligible round; retained. The definite spent **Attacker** Rake target leak is separately fixed as F02. |
| Q-F — Land Battle 62–63 | Still unassigned in the printed zero-LG/three-Troops column; existing Attacker Success interpretation retained. |
| Q-G — Package8/lookahead and Tactic recycling | Retained as documented questions; no invented priority or timing rule. |

## Optional usability and release housekeeping

The smaller dialog improvements were included: Escape, contained focus, focus return and keyboard shortcuts. Other implemented improvements include visible version, full logs, seed/checkpoint save filenames, clearer Intelligence timing and the preview/input changes above.

The remaining suggestions in Claude's section 6 are **not all implemented**. Batched phases/false alarms, a per-screen physical-counter change list, touch detail panels, broader Adjust/Reference coverage, automatic single-card selection, an empty-assignment confirmation, further wording changes, draft protection on backdrop dismissal and storage/history optimization are proposals rather than confirmed rule corrections. They should be evaluated as a separate usability change set, with tabletop/touch testing. The existing A.I.-pause option remains available; default prompts were not removed because players use them to mirror the physical board. Claude's workload figures are attributed to its scripted sample, not adopted as independently measured human play times.

Release housekeeping R1/R2 is separate from game correctness. The app is pinned by the immutable code commit and `release/v0.2.9`, and the public HTML was verified byte for byte. This response does not create GitHub tags/Releases or claim to update/unpublish the old external claude.ai artifact. The README's canonical play link is the current GitHub Pages site; the stale v0.2.4 artifact should not be used.

## Verification and release verdict

The final v0.2.9 source and build checked in the comprehensive audit are unchanged. Its recorded results are 423 engine assertions, 101 DOM checks, 200 smoke games, 768 campaign executions and 128 intensive current-save campaigns. Two complete native-Chrome games exactly match their independent replayed final states. The committed separate rebuild and public file were identical: 324,911 bytes; SHA-256 `ffa43b5dd90a5540c2757cb6701d8742e8a1eff8beba51a6ec27d4b1f7c815c4`.

This follow-up checked the fetched GitHub head, relevant source, finding dispositions and the recorded final evidence. It did not rerun or re-count those simulations as new independent trials. Full reproductions, source lines, saves, before/after assertions and coverage limits are in the [comprehensive audit and evidence](../2026-11-18-v0.2.9/README.md).

**Verdict: the confirmed fixes Claude requested are already published in v0.2.9. No additional gameplay patch is necessary for those findings.** The disputed rulings and optional usability proposals above remain explicitly open; real phone hardware, other browsers and physical tabletop usability remain coverage gaps.
