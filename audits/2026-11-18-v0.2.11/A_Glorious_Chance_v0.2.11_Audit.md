# A Glorious Chance
## Solo Companion release audit

**18 November 2026 · v0.2.9 reviewed · v0.2.10 rules fixes · v0.2.11 final release**

**Release v0.2.11 for tabletop play under the documented interpretations.** Upgrade from v0.2.9. A legal Breakout could lose several ships to an ineligible Gale. A genuine game also exposed an invalid manual two-Force deployment. Near-identical endgames showed that an early victory could depend on a ship the app had yet to return. Each correction has a replay and a neighboring control.

**Publisher and edition.** Gina Willis’s two solitaire campaigns from Legion Wargames. Rules and publisher errata take precedence over shorthand on the player aids where they conflict. The owner’s standing project interpretations are recorded in RULES_NOTES.md. This review concentrated on fresh games and saves made during play. Constructed positions exercise rare boundaries.

| Release identity | Verified result |
| --- | --- |
| Baseline | main 1c0edd236297b31db6a10ba34e8617bdde096734; application release 6dc43ca1dc9fd195dcffed67155767514bc11582 |
| Baseline HTML | 324,911 bytes. SHA-256 ffa43b5dd90a5540c2757cb6701d8742e8a1eff8beba51a6ec27d4b1f7c815c4 |
| Gameplay release | v0.2.10 at db76199d8e845616d44fda05014380503f253b8e. 367,279 bytes. SHA-256 9ae1d6e213219019682c37ef5ed59f276ef637686912c8308ac8219185c45afc. |
| Final application | v0.2.11 at 696f1d2a272973696c59e3ba7b82dc83479003b0 on the release branch. GitHub Pages deployment 2176fdcf871831951e2b03da4c3abb5f292e2b2b. |
| Final HTML | 367,635 bytes. SHA-256 18b5ecf165f322f344bbd3df7e1bf4b0d1a9d9b747780beb8640213fa675d05e |
| Release proof | Shipped dist/index.html, a separate rebuild of the committed sources, gh-pages:index.html and the HTTP download were compared as bytes. The byte comparisons passed for v0.2.9, v0.2.10 and v0.2.11. |

**Playable site and publisher sources.** [GitHub Pages](https://ramyahoo88.github.io/A_Glorious_Chance_solo/) · [Legion Wargames game support](https://www.legionwargames.com/legion_AGC_GS.html)

**Claude’s v0.2.8 audit.** v0.2.9 had already addressed five Medium findings, all 16 Low items and the OA1 display wording. Its report recorded two disputed readings, human W under A05 Pursuit and the scope of the OA1 recalculation. I reran the existing combat, preview, deployment and UI regressions in this release. In particular, missed signals, Round 2 schooners, ordinary withdrawal, setup protection, modal shortcuts and a steps-only Adjust all have neighboring controls. The remaining rules questions are listed at the end. [Prior finding-by-finding response](https://github.com/ramyahoo88/A_Glorious_Chance_solo/blob/1c0edd236297b31db6a10ba34e8617bdde096734/audits/2026-11-18-v0.2.8-claude-audit/AGC_v0.2.9_response_to_Claude_v0.2.8_audit.md)

**Using this report.** Source lines for observed behavior refer to the pinned v0.2.9 tree. “Patched” and “candidate” line numbers refer to v0.2.10 unless v0.2.11 is specified. Source directories and save names appear in the evidence index. Save names refer to directories in the evidence ZIP. Import a JSON position with **Load → Choose file**. Raw autosave damage and interrupted file reads use the supplied assertions. Constructed positions isolate a rule edge; a seed identifies a natural campaign only when its policy or recorded actions are also supplied.

## What was tested

**Printed sources.** U.S. Solo Living Rulebook, 13 April 2024; British Solo Living Rulebook, 7 August 2024; Living Playbook, 6 August 2024; cumulative errata, 13 April 2024; the 2023 photographs of Aids V and VII supplied by the owner; and map, counters and card faces in the publisher-listed VASSAL module v1.0. We read the full rendered columns, diagrams and footnotes relevant to the findings. The source manifest gives a SHA-256 hash for each input. Historical component transcriptions were reused where indicated and compared afresh to this build.

| Physical component | Direct measurement |
| --- | --- |
| Target cards | Classified the original images for all 104 cards, all four Troops rows and all seven Naval Balance columns. All 2,912 deployment cells matched, with 179 low-confidence glyphs recorded separately for inspection. B35 and A25 were separately read from their full card faces. |
| Aid V and ships | All 11 package rows and the carrying-capacity footnote. Independent selection compared 5,632 automatic outcomes in eight pools. Two hundred fifty-six setups were checked. The coastal auditor compared both printed destroyed/captured VP columns for all 26 ship versions. |
| Aid VI | All 36 red/blue die pairs in 18 ship counts, including the automatic single-ship result. The new Reference lookup independently displayed all 648 expected results. |
| Aid VII | All 15 LG/Troops columns and six result rows. Of 540 possible die/column outcomes, all 538 printed assignments matched. At 0 LG and three Troops the sheet leaves 62 and 63 blank. The documented app ruling uses Attacker Success. The lower-right printed supply reminder and Living F5.3 disagree; the app applies the living text. |
| Maps and cards | All 70 Lake Combat entries, 60 Convoy Scatter entries and seven Naval Balance bands for both sides. Recompared the 38-face visual Event inventory across six fields and all 20 Tactics for deck, symbol, color, side restriction and dummy status. Replayed the timing of the changed cards separately. |

**Campaign evidence.** Five reproducible policies exercised both human sides. The corrected primary set finished 1,280 campaigns, made 163,141 legal prompt submissions, and independently reconstructed 10,231 Tallies. The sweep matched 2,448 actual first-round combat strengths to the preview. Its 859 manual Land Battles reached every printed column. It checked 5,895 next actions after restoration, then continued 80 midgames for 8,264 actions to exactly identical final states in a second engine instance. A separate 128-game pass covered all 64 combinations of six options. Earlier pilots are excluded. Final score changed in 165 paired campaigns and victory tier changed in 82. These figures describe these policies and seeds.

**Final rerun.** The last display clarification was shipped as v0.2.11. I reran all 1,280 primary campaigns. Every game row and all comparison counts matched v0.2.10. Both releases passed the repository engine and DOM suites.

**Boundaries.** The runs reached supply at both limits, empty human deployment pools, tied Naval Balance, four Dual Blockade endings and one September-I ending under 5.1. Controlled tests cover simultaneously reaching 12, both sides transferring flagships, the Weather Gage draw after Outmaneuver, interrupted imports, and a single full or Reduced ship in transit. The tests distinguish a genuine zero-strength participant from a ship absent for the Round.

## A representative campaign

**June I.** In American seed 710000, the coastal policy chose the June I Convoy, assigned Asp to raid Kingston, Growler to raid York and Oneida to Cutting-Out, with Madison leading a Kingston Patrol. The two raids rolled sixes for supplies. The U.S. blockaded Kingston and ended the turn ahead by two. By July II the capture of Asp gave Britain four VP and both turn-start blockades lapsed. In September II, control of two zones and raids on Kingston and York supplied the final four points.

The U.S. coastal campaign at seed 710000 ended 20 (U.S. Marginal Victory). `campaign/candidate-trace.json` contains every chosen action, the legal A7 forces, the displayed Tally, each VP award and the reconstructed point delta per turn. `campaign/candidate-midgame.json` resumes this campaign after 30 decisions.

| Turn | U.S./British supply at Tally | U.S./British Tally VP change | Net score |
| --- | --- | --- | --- |
| 1 | 5 / -1 | 4 / 2 | 2 |
| 2 | 6 / -1 | 5 / 1 | 6 |
| 3 | 8 / 1 | 4 / 2 | 8 |
| 4 | 9 / 0 | 2 / 6 | 4 |
| 5 | 11 / 0 | 5 / 2 | 7 |
| 6 | 11 / 0 | 4 / 4 | 7 |
| 7 | 12 / -1 | 9 / 0 | 16 |
| 8 | 12 / -1 | 4 / 0 | 20 |

Two further saved endings isolate score and timing. In zero-dual-dual-blockade.json (U.S. 710101), Continue through Tally awards the U.S. a §14.2 decisive victory at exactly zero VP. In last-turn-5-1-early.json (U.S. 710005), Continue from the end-of-September-I reset. The A.I. has no eligible ships for September II, so §5.1 ends the game at +38. These two positions came from the primary matrix.

## Deployment and construction

### D01 · Medium · The manual picker accepted illegal A.I. forces

**Player impact.** A player using manual American Force Packages could skip a mandatory deployment, fight a smaller force, or put the wrong ships into battle. The default automatic bot chose legal forces in the checks below.

**Rule.** British Solo §5.3.1, p.21 right column, and the photographed 2023 Player Aid V, both printed columns and footnote. Player judgment resolves eligible ship choices. Package 8 needs a first Force of Main ships with at least 8 Close Action carrying Troops on Army Support, and a separate Patrol of at least 22 Long Gun in the same zone. The Main-first, fewest-ships rule applies to each selection. A d6 selects Army Support on odd or Patrol on even. The British p.12 diagram uses the Naval Balance column and the row for Troops in the box plus Troops already embarked. The setup below uses the actual B35 face.

**Exact reproduction.** Load `Package8_BR_871004.json`. This is a natural British campaign after 48 ordinary answers, August I, first Encounter, Kingston, B35, Naval Balance +62, one revealed U.S. Troop. Verify that the printed one-Troop row and rightmost column show 8. On the initial screen confirm only General Pike. For a second independent reproduction load `Package8_second_BR_871004.json` and confirm either no Patrol ships or just General Pike. The intermediate save contains the legal 13-ship combined selection.

**Expected and observed.** Pike is the only single Main ship with at least 8 Close Action. Pike carries the one Troop. The Patrol contains Oneida, Madison, Gov. Tompkins, Fair American, Conquest, Growler, Hamilton, Julia, Ontario, Pert, Raven and Scourge for exactly 22 Long Gun. The preserved die is 1, placing the Army Support Force in the Encounter. On v0.2.9, Pike sailed alone in the first reproduction. In the second, an empty Patrol turned all 13 ships into a single Army Support Force. Selecting Pike for Patrol sent her 10 Long Gun into that Force and gave Army Support the other 12. The initial screen also allowed suppressing the entire deployment or padding the selection with surplus hulls.

**Implemented fix.** Apply Aid V legality at confirmation in both prompts, including class, minimum count, legal ties and Package 9 priorities. The new **Use suggested ships** button proposes the combined force or its Patrol without spending a die. The second prompt shows each hull's Long Gun and Close Action. The v0.2.9 source accepts the unchecked selections in `src/engine_deploy.js:218`, `:224` and `:233`. The patch validates in `src/engine_deploy.js:91`, `:319` and `:330`. The fallback for a position already open on one of these prompts is in `src/engine_core.js:63`.

**Adjust while the picker is open.** In the same first-stage save, open Adjust, select General Pike, set her box to Out of Play, press Apply and Close. On v0.2.9 Pike remained listed. Ticking her and pressing Confirm returned the ship to the lake. The shipped correction path accepted this change at `src/ui.js:848` and `:853`. The patch checks whether the decision depends on the ship at `src/ui.js:1058`, preserves the position and draft, and tells the player to finish the decision or use Undo before making the correction. Both legal package stages still work afterward. Reproduce with `adjust-package.js` and compare `adjust-before.json` with `adjust-after.json`.

**Nearby cases.** Selecting the legal Patrol assigned exactly one Troop and retained both Forces. An alternate raw cursor of 1 gives a d6 of 4 and encounters the Patrol instead. The same save survives Undo and replay. If a permitted first selection could leave fewer than 22 Long Gun, accepting no deployment preserves project note 57. Project note 38 also permits a final two-step Secondary to take Package 11 past five steps. No new ruling was made on either point.

### D02 · Medium · A Reduced requisition could create a spurious September II

**Player impact.** The human could play an extra turn, with another assignment, scoring and Convoy Supply cycle after the A.I. fleet was already unable to sail.

**Rule.** Both Solo rulebooks §5.1, p.21, end the game when the A.I. has no ship eligible for September II. Event 26's coastal half keeps the requisitioned ship out for the following turn. The normal A2 return and A3 repair procedure send a Reduced returning ship via In Transit to Repairing. See British p.9 right column, U.S. p.21 right column §6.1, and the v0.2.9 Requisition repair fix.

**Exact reproduction.** Load `SeptemberI_requisition_reduced.json` and press **Continue** at Reset. The constructed British position uses seed 871100 with two-step, Reduced Madison requisitioned until September II. All other American ships are out of action. V0.2.9 opened September II and offered British upgrades. Declining took Madison to Repairing. The patched game ends at the September I reset and scores the position as a draw, 0. Load `SeptemberI_requisition_full.json` to repeat with full-strength, three-step Madison returning on the same turn. Both versions properly continue and make her Deployable. Focused assertions also cover Wolfe in the U.S. campaign and a full ship due back too late.

**Implemented fix.** Require full strength as well as a due return in the §5.1 eligibility test, `src/engine_turn.js:444` in both baseline and patch. The normal return and repair logic at `:52` and `:99` supplies the comparison. This last-survivor situation was exercised with constructed boards.

### D03 · Low · A5 could lay up ships for no Construction Delay reduction

**Player impact.** A.I. or human ships could disappear from the deployable squadron for an entire turn with no effect on the shipyard. An unaffordable human purchase also added a pointless choice.

**Rule.** British p.10 A5, lower left, and §8.1, p.23 right. The equivalent U.S. A5 and §8.1 also charge two Close Action for each point bought. The free reduction is applied first. The A.I. must buy an affordable reduction and prefers Secondary ships. The human may decline.

**Exact reproduction.** Load `A5_one_CA_BR_871101.json` and confirm A4 with no ships laid up. The U.S. has Construction Delay 2, Lady of the Lake as a 0-CA flagship, and Hamilton as its only other Deployable ship at 1 CA. The free reduction leaves delay 1. V0.2.9 logs an A.I. purchase, places Hamilton In Ordinary and leaves delay 1. The patch keeps Hamilton Deployable and delay 1. Nothing in this example can fund two CA, even with a flag transfer. This is a constructed pool.

**Human reproduction.** Load `A5_human_two_CA_US_871101.json`, confirm A4, and select only Hamilton at A5. Hamilton and Fair American each have 1 CA. The baseline allowed Confirm, laid Hamilton up and left delay 1. The patch rejects the one-CA choice. Clearing it declines the purchase. Selecting both ships lays them up and reduces delay to 0. With just one eligible CA across the whole human squadron, the patch skips that purchase prompt entirely.

**Implemented fix.** Limit the A.I. target to the number of whole points affordable and require a real purchase when the human selects ships at A5. Original lines are `src/engine_turn.js:153`, `:162`, `:473` and `:477`. Patched lines are `:153`, `:476` and `:492`. Other checks cover three separate 1-CA ships buying one of two outstanding points, a single indivisible 3-CA ship buying one, no purchase after a sufficient free reduction, and Secondary-first selection. The question about voluntarily shifting the flagship to buy more remains open. A search of 2,000 seeded campaign starts, capped at 200 decisions each, found 44 candidate high-delay control positions and no natural one-CA-only reproduction.

## Lake combat and Encounters


### Combat C07 · High. An out-of-phase Gale sinks or captures entire fleets

**Smallest reproduction and baseline result.** Load `../campaign/baseline-gale-outside-lake.json` (British 710014, July I) and Continue from A.I. Deployment. Three blank Target deployments finish, then an American **Breakout** at Sacket's draws #30. Hamilton, Raven and Scourge sink, Royal George is captured and every participant leaves the Lake Zone. Staged `C07-gale-outside-lake.json` also exercises EN1.2 in Enemy Operations. Baseline `src/engine_encounter.js:73`.

**Expected result and implemented fix.** Card #30 restricts Gale to the Lake Action Phase. Rule 2.5.1 p.6 restricts its draw to EN1.2 and refers its application to the card. Require both the first Lake Zone Event there and phase B. In the campaign replay, #30 is set aside, #5 delays the British Convoy, both fleets remain in Sacket's, and the Americans take the initial Weather Gage. Correctly eligible Lake Action Gale still resolves. A Weather Gage-only draw still discards it.


### Combat C05a · High. Separated Ships can remove a ship from two single-ship Forces or cancel another Force's coastal mission

**Smallest reproduction and baseline result.** Import `../campaign/baseline-separated-different-distribution.json` (British 710037, September I) and Continue from A.I. Deployment. At the Sacket's Breakout, card #34 considers Wolfe and Moira together and sends Wolfe to Kingston. Each is a one-ship Force. In the focused card #27 test, Madison/Oneida in one Force and Tompkins on separate Army Support enter the same Encounter. Baseline also turns Tompkins into a Patrol and queues her Troop. Baseline `src/engine_encounter.js:399`.

**Expected result and implemented fix.** Cards #11, #14, #27 and #34 split half of one qualifying Force, rounded down. The two singleton Forces stay at Sacket's without a random draw. #27 changes the source and newly displaced Force to Patrol, preserving Tompkins's task and marker. Group candidates by their actual Force, move half of the selected Force only, and change missions on just that pair of Forces. **Interpretation** for two or more legitimately eligible Forces: the cards supply no tie-break. The candidate chooses one eligible Force at random and names its ships on screen.


### Combat C05b · Medium. The displaced Patrol cannot reinforce

**Smallest reproduction and baseline result.** In `C05-displaced-AI-reaction.json` click Continue. One adjacent British Patrol has an `out` entry because #34 displaced it. Baseline makes no check for it, even though eligible. A staged human test shows the equivalent Patrol missing from the declaration. If it never returns, the old board incorrectly gives it an Encounter Ended marker. Baseline `src/engine_encounter.js:205`, `:364`, `:507`.

**Expected result and implemented fix.** The cards say the displaced Patrol has no Encounter and may join one through a Reaction Check. Apply 11.2.1–11.2.4 normally, with only present members excluded. Seeded d10 6 minus one for distance succeeds, and the displaced ship joins at North. A real outstanding PE still excludes the human Force. Cleanup marks only involved ships' Forces.


### Combat C02 · Medium. Defender Outmaneuver uses the old Event and the wrong Tactic symbols

**Smallest reproduction and baseline result.** Import `../campaign/baseline-defender-outmaneuver.json` (U.S. 710000, June II, Kingston), at Gunnery Round results, then Continue. The Americans win, but #31 remains the current card, #13 stays atop the deck and no new Event is shown. For an explicit Tactic consequence in `C02-outmaneuver-check.json`, the unblocked old card admits Grapple for the new British attack. Baseline `src/engine_combat.js:510`.

**Expected result and implemented fix.** Both books' LC6 p.36 directs a fresh Event draw at a recheck. D06 determines who wins that check. LC3 compares Tactics with the current Event's symbols. Always draw for an actual check, then let active D06 set the winner. #13 replaces #31 in the campaign and #23 is now next. Its diamond bars Grapple in the focused control. A negated D06 uses the printed flag. Sweep's expressly skipped check still consumes no card.


### Combat C04 · Medium. A one-round Missed Signal can terminate a complete Segment or Encounter

**Smallest reproduction and baseline result.** Load `C04-missed-only-attacker.json` (U.S. 51). Leave Madison checked, uncheck Oneida, commit the lineup. She is the only selected attacker and has Missed Signal. Baseline starts a Reaction declaration immediately. In the mirrored setup, when the sole currently defending ship is absent, the baseline ends the entire Encounter. Baseline `src/engine_combat.js:190` and `:244`, preview `src/engine_encounter.js:275`.

**Expected result and implemented fix.** Events #6/13/29/35 remove the ship from its first otherwise eligible **Round**. She has neither withdrawn, Disengaged nor struck. Preserve the Encounter, resolve no shots, return the ship to her column after that Round, and move to the next printed Sequence space. In the save, pick the first offered Tactic if asked and Continue. Madison returns to the line and Sequence A reaches its Weather Gage check. **Timing interpretation**, following the existing isolated-Harbor ruling: when an entire side is absent only because of the Event, the otherwise empty Round elapses without a combat roll. A genuinely engaged zero-strength Fight On ship still participates and can be fired upon.


### Combat C03 · Medium. A schooner gets a tow through an intervening attacking ship

**Smallest reproduction and baseline result.** Load `C03-rear-schooner.json` and Continue. Madison was assigned to tow Gov. Tompkins. Missed Signal moved Tompkins to the rear behind Oneida. v0.2.9 treats Tompkins as towed again in Round 2, suppressing her DRM roll. Baseline `src/engine_combat.js:100` and `:491`.

**Expected result and implemented fix.** LC2 p.29 places the schooner directly behind her tower. LC4.2 uses the actual untowed count in the Round. Check declared tow succession in the participating column. With the saved seed 7 the newly required d6 is 1, for a −1 DRM. With no intervening ship an original adjacent pair still avoids the roll.


### Combat C01 · Medium. A human flag decision suppresses an independent A.I. flag transfer

**Smallest reproduction and baseline result.** Load `C01-simultaneous-flags.json`. North, both Madison and Wolfe are Reduced, each beside a full-strength friendly ship. Britain is attacking. Choose Stay aboard. Baseline leaves both flags aboard and never rolls for Yeo. Choosing Oneida also suppresses his check. Baseline `src/engine_combat.js:465` and `:479`.

**Expected result and implemented fix.** LC5.1, British p.35, requires a beneficial automatic A.I. transfer and a casualty check for each attempt. Resolve the human choice and then run the ordinary A.I. step exactly once. Staying aboard gives Yeo 2d6 = 5 and Royal George becomes flagship. Taking the U.S. transfer consumes the 5, then Yeo rolls 10 and is wounded aboard Wolfe. A previously wounded Yeo still gets no transfer.


## Confirmed presentation and log defects


### Combat Q-C1 · A.I. Pass rationale and odds. A player cannot identify which LC1 condition failed

**Exact reproduction, source and observed result.** Run the `reasons` position in `tests/regression_v0210_combat.js`. North, British Wolfe and Royal George vs Madison, Wolfe misses the signal. The old explanation places “must be greater” beside a passing printed comparison. In a waived Breakout it can claim failed preconditions were met. A genuine zero-strength defender produces “99:1” in the A.I. explanation. Baseline `src/engine_combat.js:41`, `:73`, `:81`.

**Expected behavior and smallest fix.** Label each comparison with its own result: printed condition passes, odds 0.59:1 fail the 1:1 threshold. Explicitly identify a waiver. Format a zero denominator with ∞ as on the combat results. These wording changes do not change the LC1 threshold.


### Combat Q-C2 · A zero modifier looks like zero ships

**Exact reproduction, source and observed result.** `towRound(true, 1)` in the regression, or a normal U.S. attack with one untowed schooner and d6 4. The v0.2.9 template prints “0 untowed Laker Schooners (1, d6 4)”. Baseline `src/engine_combat.js:345`.

**Expected behavior and smallest fix.** Display actual ship count, die, and modifier separately, e.g. “1 untowed Laker Schooner: d6 4, DRM 0”. The tests also exercise −1 and −2.


### Combat Q-C3 · The log attributes a Bypass to a human who was never asked, and an old Reaction roll can reappear

**Exact reproduction, source and observed result.** In the regression `command` position, let the A.I. make its Reaction-Segment decision. Baseline logs “Command Decision: Bypass.” In `repeat`, no human group is eligible for a later Reaction, but its panel repeats a line from the previous Reaction in the same Encounter frame. Baseline `src/engine_encounter.js:114`, `:173`, `:198`.

**Expected behavior and smallest fix.** Preserve the automatic A.I. check without creating a player answer. Clear displayed human rolls at each Reaction declaration. An actual player-selected Patrol Bypass is still recorded.


### Combat Q-C4 · A single withdrawal decision is logged twice

**Exact reproduction, source and observed result.** Load `C06-withdrawal-log.json` and choose Withdraw, then inspect the log. On a fresh import choose Ignore and compare. Both alternatives generate two entries for one action on v0.2.9. Baseline `src/engine_combat.js:455`, `:485`, `:973`.

**Expected behavior and smallest fix.** Append the result once when the Round's report is committed. The prompt still contains the result, and ignoring W remains a player-category log entry.

## Coastal actions and victory timing


### Coastal C01 · High. A legal two-target Army Support assignment can damage the wrong fleet

**Smallest position and exact player reproduction.** Load `C01-two-targets.json` (British 210316, August II, dice cursor 57). Wolfe has one Troops marker at Niagara, Royal George one outside Sacket’s, and Oneida defends. Click Continue after the South Lake Raid and continue through the two land battles.

**Rule and expected result.** Living Rules E3.1–3 or E6.1–3, pp.16–17, set the side’s step order. Launch at all eligible coasts, resolve Harbor combat, then draw and roll for land battles.

**v0.2.9 observed.** Niagara rolled 52 before Sacket’s launched. Royal George then took two hits on Harbor d10 1, retained one step and gave zero supporting Long Guns. Oneida stayed full.

**Implemented change and source.** Queue each landing and its Troops count before Harbor combat, then consume one combined Land Battle per coast. Harbor now rolls 7 and 6. Royal George stays full with one supporting Long Gun. Oneida strikes in her own harbor and goes In Transit. Baseline `src/engine_coastal.js:105`, candidate `src/engine_coastal.js:107`, assertion `tests/regression_v0210_coastal.js:51`.


### Coastal C02 · High. The wrong side can receive a Decisive Victory before the campaign is over

**Smallest position and exact player reproduction.** Load `C02-breakout-in-transit.json` (British 210143, August II). Four full U.S. Main Ships are on station at each port. Wolfe is full In Transit at Kingston. Continue past the York Raid and Tally. Repeat with `C02-comparison-in-transit.json` for the British A.I.

**Rule and expected result.** Living Rules 14.2, pp.42–43, assess whether a **turn ends** with the dual Blockade. F7 p.20 moves full In Transit ships to Deployable. 14.3 and agreed note 33 use the original port and the on-station force.

**v0.2.9 observed.** Declared a U.S. Decisive Victory, scores −21 with a human British or −23 with the A.I. British. The Reset then placed the eligible ship in Deployable.

**Implemented change and source.** Keep the blockading forces on record while resolving F7 and apply the existing breakout test to the resulting port. Human Wolfe can now attempt a Breakout. The A.I. now counts Wolfe and Royal George, eight Carronades to the Americans’ seven. `C02-forced-victory.json` changes Wolfe from three to two steps. The U.S. still wins decisively at −21. A tie of seven fails, and a full ship at the temporary port is ineligible. Baseline `src/engine_tally.js:116`, `src/engine_turn.js:433`, candidate `src/engine_tally.js:122` and `:177`, `src/engine_turn.js:432`, assertion `tests/regression_v0210_coastal.js:96`.


### Coastal C03 · Low. The board keeps a Last Step or No Steps marker after Heated Shot sends a ship In Ordinary

**Smallest position and exact player reproduction.** Load `C03-heated-shot.json` (British 210723, August II, dice cursor 7). Wolfe A is on one step at Niagara with a full Royal George. Continue from the Raid. Event 23 selects Wolfe. Continue through Tally and check the fleet at Reset.

**Rule and expected result.** Physical Event 23/24 assigns the Damage marker and directs the ship In Ordinary at F7. F7/6.1 discard battle Step markers. Wolfe’s printed Reduced counter has two steps.

**v0.2.9 observed.** Wolfe remained In Ordinary on one step until a later repair.

**Implemented change and source.** Preserve the special destination and Damage marker and run the common ship cleanup. Wolfe now has two steps, also when returning to her temporary port. Full-strength targets retain their face, and an ordinary Reduced ship still goes In Transit. Baseline/candidate `src/engine_tally.js:135`, assertion `tests/regression_v0210_coastal.js:120`.


### Coastal C04 · Low. The result and game log tell a player to mark the wrong coastal target on the physical board

**Smallest position and exact player reproduction.** Load `C04-temp-Charlotte.json` or `C04-temp-York.json` (210414). Click Continue once past the Raid. The Army Support Force is in South or York and its opponent has an active temporary port.

**Rule and expected result.** Living 9.1.4 permits these targets, 14.1.1 identifies Charlotte and York, and 13 records the attack on its targeted coast.

**v0.2.9 observed.** Printed “Land Battle vs Sacket’s Harbor” for Charlotte and “Land Battle vs Kingston Harbour” for York. Internal zone was correct.

**Implemented change and source.** Use the battle’s actual zone to select the original or temporary port name. Both files still roll 53 and give an Attacker Success. Baseline `src/engine_coastal.js:154`, candidate `src/engine_coastal.js:181`, assertion `tests/regression_v0210_coastal.js:135`.


### Coastal C05 · Low, usability. The tracker still says Harbor Encounter on the subsequent Land Battle decision/result

**Smallest position and exact player reproduction.** Load `C01-two-targets.json` and continue until the first land battle **after** Harbor. Read the step label and the prompt together.

**Rule and expected result.** The displayed step should agree with E3.3 or E6.3 after the Harbor Encounter is complete.

**v0.2.9 observed.** The board said `E Harbor Encounter` while showing a Land Battle.

**Implemented change and source.** Set the appropriate step at the Land Battle entry point. Here it reads `E6.3 Your Land Battles`. Baseline `src/engine_coastal.js:121` and `:208`, candidate `src/engine_coastal.js:149`, assertion `tests/regression_v0210_coastal.js:139`.


### Coastal C06 · Medium. Harbor skips a permitted transfer, forfeiting a surviving commodore’s next-round Command DRM and a legal choice available in ordinary combat

**Smallest position and exact player reproduction.** Load `C06-transfer-Yeo.json` (British 210512, dice cursor 6). Wolfe A and Royal George A attack Madison and Oneida. Continue once. Round 1 d10 5+1 gives A1. Distribution 14 hits Wolfe, who becomes Reduced. Yeo rolls 6 on his casualty check. Choose Royal George if offered. Repeat on `C06-simultaneous-transfers.json` (U.S. campaign, cursor 67), and choose Oneida.

**Rule and expected result.** LC5.1 p.35 allows a surviving leader on a newly Reduced Flagship to transfer to an adjacent full ship after a casualty check. Rule 12 p.41 uses the Lake Combat procedure with enumerated Harbor exceptions. A beneficial A.I. transfer is automatic.

**v0.2.9 observed.** Showed the round result with Continue as the only action. Wolfe retained the flag. When both flagships were reduced, both leaders stayed put.

**Implemented change and source.** Apply the shared transfer prompt, casualty roll, and beneficial-A.I. rule after both fleets take hits. British player rolls 2 and moves to Royal George. In the simultaneous case the U.S. player rolls 5 to Oneida and the British A.I. rolls 8 to Royal George. Staying consumes no extra roll. Wounded and lone-ship controls correctly skip the prompt. Baseline `src/engine_coastal.js:248`, candidate `src/engine_coastal.js:278`, `src/engine_combat.js:948`, assertion `tests/regression_v0210_coastal.js:153`.


### Nearby scoring and supply controls

- Simultaneous Fall Offensive Supply at 12 leaves both markers pinned and grants neither side VPs. A homeport success regresses the defender by two with a floor of −1.
- A current convoy arriving in the same turn an unmaintained blockade lapses advances immediately. A previous convoy still showing Delay waits through that F5, flips to Arrived at the unblocked F7 and advances at the next unblocked F5. Observed British supplies were 3, 3, 5. The engine follows pp.19/21. The baseline description at `RULES_NOTES.md:47` incorrectly says every delayed convoy scores at its first unblocked F5. The candidate corrects note 32 to name both stages.
- Shipyard Damage 8–9 leaves a lone Pike full, reduces Pike and Sylph when both are present, and actual destruction gives one VP entry per hull (20 and 14). A later F1 does not award those stock losses twice.
- Capturing Beresford, a repulsed Cutting-Out, control by five full U.S. Steps and two unlaunched British Troops returning at F7 give U.S. 11 VP, British 1 VP, two British markers Available and Beresford Reduced In Transit under U.S. ownership.
- Reversed Force assignment order, a harbor without defenders, combining two Army Support Forces on one coast, normal repair, isolated ships, late-game score precedence, both sides’ temporary ports, and exact serialization/resumption at a Harbor and optional transfer prompt have dedicated controls. The previously released 36 coastal assertions and the integrated 43 encounter/combat assertions also pass.

## Player controls and ship lookups


### UI01 · Medium. An A7 action can designate the wrong flagship, changing which ship carries the leader or supplies Command

**Reproduction.** Import `US_280004_A7.json`. Add a Force and select one ship. Change the flagship from Madison to Oneida as the **last** input. Confirm assignments and read the Flagships track.

**Expected and observed in v0.2.9.** A7 and LC5.1 permit the chosen Deployable ship to serve as flagship. The selector showed Oneida but Madison remained in command. Changing the flagship **before** a later ship selection correctly gave Oneida the flag on both builds.

**Source and repair.** `src/ui.js:455` updates the draft without changing the answer captured at `src/ui.js:491`. Build the answer from the current draft when the player confirms.


### UI02 · Low. A reserve gets a numbered position on the battle display. This can place a physical counter in the line despite its absence from combat

**Reproduction.** Use the assertion **A reserve appears once**. The British column contains Wolfe. Madison is still in Force Assembly and the American column is empty. Open the combat display.

**Expected and observed in v0.2.9.** LC2 assembles the line from participating ships. Madison appeared both as U.S. position 1 and under “In Force Assembly.” The corrected display gives only Wolfe a position.

**Source and repair.** `src/ui.js:536` substitutes all Encounter ships for any empty column. Use the active combat's column, including an empty one.


### UI03 · Low. A keyboard player loses their place after ticking a ship. A phone player can lose the scroll position in the inner list

**Reproduction.** Use the assertion **Selection and lineup changes preserve focus and scroll**. Scroll the ship list, focus its ninth checkbox and tick it. Repeat in a lineup and change Madison's tow to Asp.

**Expected and observed in v0.2.9.** The control being edited and its list position should persist while validation updates. Previously focus moved to the document body and the list was replaced. The new controls preserve focus and scroll. Unticking Asp removes its tow and retains focus on its checkbox.

**Source and repair.** `src/ui.js:332`, `src/ui.js:356`, `src/ui.js:369`. Restore the identified control and list scroll after draft updates. Give the tow selector its own label outside the checkbox label.


### UI04 · Low. A custom Force Package threshold silently resets during hand selection

**Reproduction.** In the manual picker, choose “Number of ships,” enter 2, clear “remember,” then tick one ship **before** pressing Auto-fill.

**Expected and observed in v0.2.9.** The pending threshold and preference should survive an edit to another field. The shipped picker returned to Long Gun, blank threshold, “remember” checked. The repaired picker keeps all three edits, selects two ships and leaves the preference unsaved.

**Source and repair.** `src/ui.js:422` and `src/ui.js:436`. Keep the form values in the prompt draft. Initialize a saved threshold once, before rendering.


### UI05 · Low. Rotating a device without advancing the game can scramble the arrangement of the six Lake Zones

**Reproduction.** Render a wide board, then narrow the viewport past 640 px without taking another action. Compare the western pair, York and Niagara.

**Expected and observed in v0.2.9.** The wide arrangement is York/North/Kingston above Niagara/South/Sacket's. The narrow view pairs York with Niagara, North with South, Kingston with Sacket's. The old CSS changed its column count, but JS selected its ordering only at the previous render, putting York beside North on the narrow layout.

**Source and repair.** `src/ui.js:579` and `src/style.css:184`. Give each zone a named CSS grid area and switch the full arrangement at the breakpoint. The regression checks all six named areas and both layouts from the shipped stylesheet.


Two related gameplay regressions are covered in the combat and deployment findings. With only Madison attacking Wolfe and Madison sitting out under Missed Signal, the old lineup showed 0 versus 8 and a 1:2− attack. The new lineup explicitly says that no combat roll occurs. Marking the Event spent restores the normal strength display. This exercises both branches of `src/ui.js:386` in the reviewed build.

For the manual deployment flow, load `../deploy/Package8_BR_871004.json`, British seed 871004, August I, B35. “Use suggested ships” selects 13 ships for the combined Force. Confirm and use it again. Patrol gets 12 ships with 22 Long Gun. Pike stays with Army Support with 9 Close Action. Both preview buttons preserve the game RNG. This is an independently exercised UI route for the Player Aid V, package 8 and §5.3.1 repair.

## Implemented quality-of-life improvements


### Inspect a ship while deciding where to assign it

**Old result.** `src/ui.js:236` exposed its full details only through a hover tooltip. The A7 ship buttons immediately changed the Force.

**Implemented behavior and direct check.** Select an on-board ship or use **Inspect ships** at A7. The dialog shows both faces, remaining steps, location, owner, ship traits, delay and VP values. Separate assignment buttons retain their normal action. Checked Madison's printed full 2/4/5/6 and reduced 1/2/2/3, A7 inspection of Asp, and a deployed ship in its zone. Draft, game, RNG and Undo stayed identical.


### Look up a hit, then continue play

**Old result.** `src/ui.js:759` offered one long Reference document without Player Aid VI. Close scrolled away with the content.

**Implemented behavior and direct check.** Reference has a topic selector and a persistent Close control. The Hit Distribution lookup accepts 1–18 ships and shows the 36 red/blue pairs per column. The focused test checks every displayed result against independently transcribed column counts, including the automatic one-ship result.


### Reread a card already on the table

**Old result.** Face-up Target tiles and Lake Event chips could not be opened using touch.

**Implemented behavior and direct check.** Tap a revealed Target or Lake Event, or use **Reference → Revealed cards**. The lookup also includes the current visible prompt, Weather Gage and played Tactics when applicable. A removed Target stays readable and has a visible status. The test opens removed Target A2 and Event #1 and checks that face-down A1 cannot be inspected or named.


### Read tracks or select an option at phone width

**Old result.** At the 14 px root size, track digits were 8.68 px. Static track digit contrast was 2.85:1 and white active Niagara text had 3.17:1 contrast on its gold background.

**Implemented behavior and direct check.** Narrow-screen track digits are 12 px. The corresponding color pairs measure 6.47:1 and 5.15:1. Primary buttons and labeled checkbox rows have a 44 px minimum height. Header buttons and selectors have a 36 px minimum.


### Catch accidental all-port assignments

**Old result.** An empty A7 looked ready to confirm without specifying the consequence.

**Implemented behavior and direct check.** At `US_280004_A7.json` the new inline message says every ship will stay in port. Adding a Force and a ship removes it. The regression checks both states.

## Saves, Undo and manual corrections


### P01 · High · Invalid save can replace a playable campaign with an unanswerable prompt

**Smallest position and exact reproduction.** Open seed 621001, then Load → paste `refused-empty-choice.json` → Load pasted text. Three nearby cases use all-disabled choices, an information prompt without its enabled `ok` option, and a selection whose minimum exceeds its item count.

**Expected and observed in v0.2.9.** The active game, Undo history and autosave should survive an invalid import. The page accepted all four. The empty/disabled choices could not advance. A Continue button without its option could not submit a valid answer.

**Source and smallest correction.** `src/ui.js:132` checked only the prompt kind. Check the actual option accepted by Continue, enabled choices, selection bounds and named validators before committing the import. Candidate `src/ui.js:210`.


### P02 · Medium · A late file read can undo a player's later decision or load the wrong game

**Smallest position and exact reproduction.** Open Load in seed 621001, choose a saved file from 621002, close before its read finishes, play the June I convoy choice, then let the read finish. Second case: choose files B and C in one dialog and finish C before B. The focused test supplies both exact completion orders.

**Expected and observed in v0.2.9.** Closing or replacing a selection should cancel that read. The dismissed read installed seed 621002 and replaced the later move. The superseded read also won when it finished last. A failed file read left the player without a message.

**Source and smallest correction.** `src/ui.js:214`. Only accept callbacks from the current open dialog and current file selection. A paste edit cancels the read. Surface read errors and allow retrying the same file. Candidate `src/ui.js:317`.


### P03 · Medium · Bad import discards a partially entered A7 Force

**Smallest position and exact reproduction.** Load `a7-US-621001.json`, click + Add Force, then Load. Paste a copy of `start-US-621001.json` with its first log entry replaced by null. Close the rejection.

**Expected and observed in v0.2.9.** The drafted Force should still be present. The committed board, RNG and autosave survived, but the draft vanished when rendering the incoming game failed.

**Source and smallest correction.** `src/ui.js:156` cleared local UI state before the render attempt. Restore the previous draft, prompt identity and message along with the committed state on failure. Candidate `src/ui.js:243`.


### P04 · Medium · Adjust creates or destroys real human Troops and leaves the A7 preview stale

**Smallest position and exact reproduction.** Load `a7-US-621001.json`. It has zero Available and real markers on 2, 4 and 8. Adjust → Your Available Troops → 4 → Set.

**Expected and observed in v0.2.9.** Setup §3.1 gives the player three real markers. The baseline reported four Available plus the three on track, and the A7 prompt still reported zero. The extra markers could affect the F3.3 penalty. The reverse edit could spend already committed markers.

**Source and smallest correction.** `src/ui.js:834`, `src/assign.js:31`, `src/assign.js:57`. Move a physical marker between a named supply space and Available, checking the open draft and rebuilding A7 from current availability. The candidate moves space 2 to Available, leaving two markers on 4 and 8, adding Army Support to the prompt. Undo restores the complete state. Candidate `src/ui.js:1086`. The loader now also rejects an off-track Niagara marker and a fourth human marker including embarked and F7-queued pieces.


### P05 · Low · Track correction logs a value different from the actual board

**Smallest position and exact reproduction.** Open Adjust in seed 621001. Set U.S. Convoy Supply to 13, British Supply to −2, Construction Delay to −1, or Niagara to 7.

**Expected and observed in v0.2.9.** A legal correction should be applied exactly. The baseline silently clipped each entry to 12, −1, 0 or 6 but recorded the submitted value as the change.

**Source and smallest correction.** `src/ui.js:821` and `src/ui.js:829`. Refuse each out-of-range input before logging, autosaving or taking an Undo. Values at both actual supply endpoints still apply. Candidate `src/ui.js:1007`.


### P06 · Medium · Reload loses recent Undo positions and storage pressure can leave the current move unsaved

**Smallest position and exact reproduction.** Start seed 621001, follow the first enabled choice, confirm default selections and keep the fleet in port. Play 64 actual decisions. Reload and open the browser's retained game. In a separate run, constrain storage so that the current state fits but the full Undo stack does not.

**Expected and observed in v0.2.9.** The application kept 60 ordinary steps in memory, persisted only 25, and allowed a sequence of 65 manual edits to grow to 65 in memory. Under quota, the last move was refused alongside the history, although the new position alone fit.

**Source and smallest correction.** `src/ui.js:30`, `src/ui.js:41`, `src/ui.js:821`. Reuse repeated records across stored snapshots, bound each in-memory route to 60, and on quota save the new position first and as much recent history as fits. Report the retained reload depth. Candidate `src/ui.js:32` and `src/ui.js:48`. Portable JSON retains its existing single-position format.


### P07 · Low · Damaged local Undo history breaks the control and a damaged wrapper is silent at setup

**Smallest position and exact reproduction.** In an isolated origin preload the local autosave key `agc_solo_companion_v1` with the UTF-8 text of `autosave-with-damaged-undo.json`. Continue it → Undo. In a second fresh origin, preload the key with `{truncated` and start the page. These are autosave envelopes. Pasting one as a portable save intentionally imports only its current position.

**Expected and observed in v0.2.9.** The baseline threw on the top history entry, although there was a usable preceding entry. The truncated wrapper looked like a fresh install, and Start could replace it without confirmation.

**Source and smallest correction.** `src/ui.js:33`, `src/ui.js:65`, `src/ui.js:713`. Validate each candidate on Undo, skip unreadable entries with feedback, and preserve the current position if none work. Distinguish absent storage from unreadable stored bytes at setup and require deliberate replacement. Candidate `src/ui.js:69`, `src/ui.js:113`.


### P08 · Medium · An open ship selection can outlive its eligible ships

**Smallest position and exact reproduction.** Load the British B35 Force Package #8 position in the deployment evidence. Open Adjust, move General Pike to Out of Play, close Adjust, and select Pike in the still-open package. Two adjacent saves shipped with the DOM regression cover the first listed American attacker in an active lineup and British Beresford in an active Reaction roster.

**Expected and observed in v0.2.9.** A ship removed from eligibility should cease to be a legal pick. The baseline kept Pike selectable and brought her back to the lake. The new printed package validator alone could strand the Patrol pick after the first confirmation. The old lineup and Reaction lists also retained ships that Adjust had moved away.

**Source and smallest correction.** The cached prompt was built at `src/engine_deploy.js:218`, `src/engine_encounter.js:178` or `src/engine_combat.js:157`; `src/ui.js:851` changed the ship without revising that decision. Refuse an edit affecting the open roster, keep the selection and dice, and tell the player to finish the decision or Undo first. Current source is `src/ui.js:1050`. Unrelated construction hulls and at-sea edits outside those selection windows remain editable.


## Quality of life implemented

- The Load dialog retains its unsubmitted text for the current page session through accidental backdrop or Escape dismissal. Clear pasted text and a successful load clear it. The v0.2.9 dialog created an empty textarea whenever it reopened (`src/ui.js:217`).
- Save offers a complete chronological plain-text log, including entries hidden by the board filter or its 400-entry default. The download name includes side, turn, seed and decision. A blocked download offers manual text selection. The test exported 430 records after applying the scoring filter and compared every line against the saved public log. A log export left the state, dice, Undo and autosave bytes unchanged.
- British VP input explains that positive British points reduce Game Score. Reapplying an unchanged ship or numeric value leaves the audit trail and Undo untouched. Accepted edits clear the previous game action's board recap after its Undo snapshot is saved.
- Preparation offers a public Lake Control correction before the Target row has been drawn. A zone with an active Blockade refuses a conflicting edit. At A7 the human Flagship picker includes only the ships in the actual assignment prompt and updates the current draft, with exact Undo.
- A free Blockade switch remains deferred. F2.3–F2.5 couple control and VP to existing blockade markers. F6 needs the correct zone, four full-strength Main Ships and no enemy deployed ships, and may isolate the opponent's ships. F7 can move those ships to a temporary Homeport or award victory. Historical eligibility may be gone by the time Preparation opens. A future correction would need to replay or reconcile those consequences. Hidden A.I. Troops and Convoys, launched or queued Troops, and Leader casualties continue to follow their own procedures.

## Victory display, Undo and table pace

### V01 · Medium · Two winners on the final screen

**Player impact.** The Game Score header could name the opposite winner from the final adjudication. **Rule.** Under 14.2 a qualifying Dual Blockade awards decisive victory regardless of score. **Reproduce.** Load `coastal/C02-forced-victory.json` and Continue from the Raid through Tally to Game Over. The constructed position ends on −21. In v0.2.9 the header says British Marginal Victory while the final panel awards the U.S. decisive victory. With full-strength Wolfe returning in `C02-breakout-in-transit.json`, the campaign should continue instead. **Fix.** At `src/ui.js:272` on v0.2.9, use the stored adjudicated level whenever the game is over. Continue showing the signed point total separately. The victory position and the continuing position were both exercised in public Chromium. The normal eight-turn campaigns retain their points-based headings.

### V02 · Low · Ctrl/Cmd-Z stopped working on Game Over

**Player impact and expected behavior.** A keyboard player should be able to undo the last move wherever the enabled Undo button permits it. **Reproduce.** Start with the same forced-victory save, complete the last move, close any dialog, focus the page and press Ctrl-Z or Cmd-Z. On v0.2.9 the game stayed over. Clicking Undo did restore the Tally. **Fix.** The early return at `src/main.js:5` excluded states with no pending prompt. Handle Undo before checking for a prompt. The patched button and shortcut both restore the prior position. An open dialog or text editor retains its native keyboard handling. Runnable regression: `tests/browser/tabletop_v0210.js`.

### Optional pace and board improvements

**Map updates.** Each applied action now offers an expandable list of public counter moves. It names the ship, old and new box or Force, steps and owner; it includes public supply, victory, flag, convoy, Troops, Encounter, control, blockade and card movements. The same Force identifier appears on the board. Face-down cards disclose only the printed back. Unrevealed A.I. Troops and Convoys stay hidden. Read-only lookups, closing the disclosure, Save, reload and Undo do not roll dice.

**Grouped updates.** Setup and Settings offer an opt-in grouped pace. Target Card layout, PE placement and false alarms, ordinary Enemy Operations deployments, Tally, Reset and a single legal Tactic can be acknowledged in the same action. The recap keeps the reports and intermediate board changes in order. Genuine choices, combat results and nonroutine events stay visible as individual prompts. A single Undo restores the preceding click. The separate individual-notices checkbox now names the types of messages that it controls.

**Measured effect.** With the same enabled individual notices, 160 paired games across seeds 891000–891079 produced 21,767 individual prompt submissions versus 13,548 grouped submissions. That is 8,219 fewer, or 51.4 per game (37.8%). Only 120 automatically submitted answers were sole legal Tactics. At all 13,548 player stops the board, log, dice cursor, hidden decks and remaining procedure stack matched after setting aside the display-only recap. The independent study of turning notices *off* is a different comparison: 47.8 fewer Continue prompts per game in its own matched sample. The savings should not be added.

**Board lookup.** A revealed Target Card now records and labels the row and column actually used, including the recalculated OA1 column. Before lookup the display identifies the current board lookup. This supports reviewing a card after the board has changed. The baseline had only a live recalculation in `src/ui.js:507`. The implementation stores the two coordinates in the Target Card slot in `src/engine_deploy.js:271` and displays them in `targetCardView`. It does not expose face-down fronts.

Run `node table/grouped_campaigns.js /path/to/checkout 80` from the evidence directory. The 160 pairs in this study are separate from the primary 1,280-campaign matrix. The measures count submitted prompts. One assignment can require several taps and physical counter moves.

## Public Chrome and release verification

The same canonical GitHub Pages URL served both builds during the audit. The HTTP response body, the Pages branch file, the committed distribution and the output of the separate build agreed byte for byte after publication. At the time of the two native Chromium games, the public title was **A Glorious Chance – Solo Companion v0.2.10**. The final v0.2.11 verification appears below. The release record includes the commit IDs, lengths and SHA-256 values.

### Two complete games through the public controls

| Human campaign and policy | Human-visible prompts from setup to scoring | Final result |
| --- | --- | --- |
| American, coast, seed 891119 | 92 submissions. Eight A7 assignments, two combat lineups, nine selections, 22 choices and 51 information prompts. | U.S. 29 VP, British 35 VP. Net −6, Draw. |
| British, screen, seed 891120 | 63 submissions. Eight A7 assignments, 13 selections, seven choices and 35 information prompts. | U.S. 19 VP, British 1 VP. Net +18, U.S. Marginal Victory. |

I started both campaigns on the public page with Group routine updates enabled. Each action used the visible ship, checkbox, select, Tactic or confirmation button. I checked each prompt title against the control transcript. In both cases the final Save export was byte-identical to the separately generated final export from the same decisions. The two transcripts and the final states are in the browser evidence directory.

**Undo, reload and file import.** In the American game I saved before the June I Tactic choice, made the choice and undid it. Save then reproduced the original 13,229 bytes. Replaying the choice and reloading the autosave both reproduced the 13,101 bytes after the choice. In the British game I saved at Encounter ended after submission 31. Both a browser reload and a file import through Load reproduced those bytes before the campaign continued to its final result. The page's portable Save exports contain the current game. A separate quota test checked all 60 retained local Undo positions.

### Old and corrected positions on the live page

- **British 871004, B35.** On v0.2.9 an empty combined selection was enabled and selecting only Pike went straight to an Encounter. On v0.2.10 both incomplete confirmations were disabled. Use suggested ships, Confirm, Use suggested ships, Confirm placed Pike on Army Support with one Troops marker. The second Force contained 12 other ships with 22 Long Gun. Undo returned to the second selection. The real exported position lists Forces F13 and F14 in Kingston.
- **July I Breakout, British 710014.** Continue at A.I. Deployment reached Gale on v0.2.9. The same Continue on v0.2.10 discarded it and displayed Event 5, Convoy Delay. **Kingston, U.S. 710000.** Continue after Round 2 showed Defender Outmaneuver with no new Event on v0.2.9. The revised page displayed Event 13 and awarded the Americans the Weather Gage. **British 710037.** I also opened the two-singleton position on each release. The campaign and combat replays record the before-and-after Force memberships.
- **Both flagships Reduced.** In the coastal transfer save, Continue from Harbor Round 1 and Transfer to Oneida gave Chauncey Oneida on 2d6 5 and Yeo Royal George on 2d6 8. The ordinary Lake Combat transfer prompt was also exercised. **American 280004, A7.** I selected Oneida, changed the flagship to Oneida last and confirmed. The visible Flagships track now retained Oneida.
- **Two nearly identical Dual Blockade positions.** The baseline awarded victory in both. The revised public page at −21 awarded U.S. decisive victory in both header and ending when no Breakout was possible. Ctrl-Z restored the preceding Tally. With full-strength Wolfe in transit, the same two Continue clicks reached Reset and recorded that the British meet the Breakout requirements after their ships return.
- **Phone-width layout in desktop Chromium.** At native 400% zoom the measured viewport was 337 CSS pixels wide, with no document-level horizontal overflow. I opened Oneida from the board, read both counter faces, closed the dialog and opened Reference. The 18-ship Hit Distribution topic displayed all six red-die rows and six blue-die columns. The modal also fit the 337-pixel document. This was a zoomed desktop viewport with a short visible height. Physical Android/iOS touch and screen reader behavior remain unmeasured.

The browser evidence includes the old and corrected victory screens, the second B35 selection, the narrow Reference view and the public Weather Gage result. It also includes the raw on-screen observations, byte comparisons, click transcripts and importable game exports. The browser console also emitted messages about sending metadata to its own extension. I verified results using board state, scores and exported bytes.

### Final display correction in v0.2.11

**V03 · Low · The last formation looked like the new formation.** In U.S. 710000 at Kingston, load campaign/baseline-defender-outmaneuver.json and Continue after Round 2. LC6 awards the Weather Gage and the other side makes its LC1 attack decision before a new lineup exists. The screenshot from v0.2.10 shows “Combat Sequence A begins” above “Combat Sequence B,” and labels Britain as attacking. Moving the counters at that point would confuse the previous line with the upcoming one. The behavior also exists at v0.2.9 src/ui.js:531. In v0.2.10 see src/ui.js:709 and :713. The v0.2.11 combat view at src/ui.js:709 and :713 names the previous formation and labels both previous roles while the new side decides. A retained British Gage keeps its active headings. Harbor keeps its ordinary roles. The new display test exercises all three cases. The natural replay also checks Undo, replay, Event 13 and the subsequent Attack or Pass choice.

**Final verification.** I repeated the shipped HTML checks and the 1,280-campaign matrix on v0.2.11. Every per-game outcome, independent tally, tested preview and coverage count matched v0.2.10. The U.S. and British games above were also replayed through the final HTML's DOM controls. Both entire control transcripts matched the native v0.2.10 games. Their exported states differed only in the two app version fields. The native screenshots in this evidence are from v0.2.9 and v0.2.10. I also loaded the downloaded public v0.2.11 HTML in the DOM runner and exercised Load, Continue and Undo on the handoff position. Its displayed observations matched the checked-in build. The files browser/v0211/before.json and after.json record the changed wording at the handoff and the next decision.

## Rulings, coverage gaps and release verdict

**Two implementation rulings in this patch.** Separated Ships splits one eligible Force, chosen at random if several qualify. The card identifies the Force in the singular and gives no tie priority. If Missed Signal leaves a side with no participant for the first Round, that Round elapses without combat dice. The absent ship can rejoin next Round. The replay suite tests both interpretations against nearby ordinary cases.

**Scope of optional manual corrections.** The patch implements real Troops transfers, eligible flag changes and a bounded Lake Control correction. A free Blockade switch, concealed A.I. marker editing and rewriting previous leadership results remain suggestions. The affected procedures can also isolate ships, reassign victory or expose a hidden marker. An unrestricted edit would need a defined way to reconcile those effects.

**Standing questions retained.** A05 Pursuit on an eligible defender withdrawal versus the human right to ignore W; literal A6 recalculation after an OA1 upgrade; Rainy Squalls in a later Encounter after Reaction; Tactic retention/recycling and Defender Rake’s optional timing; Aid VII’s two unassigned rolls; Package 8 first-Force lookahead; and whether the flagship must be excluded from a construction purchase. The package picker follows the recorded no-lookahead convention and preserves legitimate failed packages. None of these was resolved by a publisher ruling during this audit.

**Harbor questions.** Rule 12 does not clearly say whether a Reduced Harbor attacker that stays Engaged can absorb return hits in a later Round after it ceases contributing attack strength, or whether an attack on a temporary port can damage fixed shipyards or ships under repair at the original port. Target names, transfers and timing now follow the resolved parts of the rule. The two scope questions remain documented in coastal/README.md.

**Coverage limits.** Complex rules can interact outside the saved positions and tested policies. The campaign scoring check reads the resulting Lake Control markers, while separate rule-boundary tests check how markers are placed. The printed card-data checks verify individual fields and tables. They are distinct from exercising every possible card combination. The browser work used public Chromium at desktop width and at a measured 337 CSS pixels, plus DOM checks. Physical phones, Safari, Firefox, assistive-technology announcements, operating-system permission prompts and a timed session moving actual counters were outside this run. The deterministic campaign policies do not estimate human win rates.

**Release verdict.** Use the published v0.2.11 for fresh campaigns. Upgrade from v0.2.9 or v0.2.10. The first priorities were phase-correct Gale and Separated Ships, end-of-turn victory timing, legal manual deployments and correct command of flagships. The shipped file matches the independently rebuilt and publicly served bytes. The rule replays, independent Tallies, save comparisons and two complete native Chromium games on v0.2.10 support the gameplay changes. The final DOM replays and public-byte comparison verify the v0.2.11 presentation fix.
