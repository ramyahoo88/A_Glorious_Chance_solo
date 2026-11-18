# Rules notes and interpretations

These are the places where the rules are silent or ambiguous, or where the components disagree with the Living Rules, and what the app does. Each has a rule reference. Where an option exists, it is on the setup screen.

## Sources and conflicts
1. **Victory levels** follow the Living Rules 3.3.2 (−33 / −22 / −11 / ±10 / +11 / +22 / +33). The Player Aid VIII image in the VASSAL module still shows the older ±53 / ±32 / ±11 bands.
2. **Cutting-Out (optional OA2)** allows one Deployment per side per game, as in the Living Rules (A7) and the Playbook. Some Target Cards still say “maximum two”.
3. **A.I. American attack precondition (British campaign).** The British Living Rules LC1 text compares *Carronade + Defense* for the A.I. Americans. The Lake Combat Sequences of Play mat compares *Long Gun + Defense*, which matches the U.S. Breakout rule (14.3). The default is the mat; it can be switched on the setup screen.
4. **Hit Distribution Table** (Player Aid VI) is transcribed for 1–18 Engaged ships from the full table reproduced in the British Living Rulebook (p. 32); the U.S. rulebook's copy is cut off after column 12. Only Open Range can push the column past 18; then the position is picked uniformly. Hits on empty positions miss. The attacker's column in a Gunnery Round holds only the ships attacking in that Round: Reduced ships stay behind in the previous Round's zone and cannot be hit by return fire (Playbook p. 15).
5. **Adverse Wind** is applied as printed on all four cards: +2 to the human player's Reaction Checks in that zone. It reads like a misprint for −2 (Fair Wind gives the same +2), but the printed value is kept by player ruling (Nov 2026).

## Dice readings
6. The d10 is read **0–9** for the Lake Combat Table, Reaction Checks, the Convoy Scatter Table, Cutting-Out and Minor Damage. It is read **1–10** for Strike Checks (1–2 / 3–8 / 9–10), the Upgrade-limit roll (1 = 3 ships … 10 = 0) and the Close Action “roll ≤ CA difference” check. (The combat mat prints the Close Action check as “1d10 roll > ratio numerator hits”; the errata of 1 Dec 2023 says the mat is wrong and to follow LC7d, where a roll ≤ the difference hits.)

## Preparation Phase
7. **In Ordinary is reversible.** In A4 you choose which ships are laid up this turn, and previously laid-up ships can be recommissioned. The A.I. recommissions its laid-up ships each A4 and then applies the 30-point limit: Secondary ships go first, then the lowest capture VP, and never the Flagship. Ships placed In Ordinary in A5 to buy down Construction Delay count only in the turn they are placed.
8. **Flagships:** if a side's Flagship is not Deployable in A7, the highest capture-VP Deployable ship becomes Flagship (you can change yours in the A7 editor). The U.S. Flagship becomes the Pike automatically when she first becomes Deployable.
9. **British upgrades (British campaign 7.1/7.2):** the A2 roll limit applies to A-version ships in Deployable, and to those in Repairing that will finish repairs this turn. Captured Laker Schooners in the British In Transit area add +1 each and are then removed.
10. **U.S.-campaign Upgrade Checks (7.1)** are made only when British ships deploy for an Encounter, including the Homeport pool reacting and ships sortieing in a British Breakout Attack, using a 50/50 odd/even roll per A-version ship. Isolated ships never upgrade. Optional OA1 replaces this with one d10 roll per turn at the first Encounter.

## A.I. deployment
11. Deployment-table row = A.I. Troops in the Available box plus those embarked on A.I. Forces (capped at 3). Column = the Naval Balance band.
12. **Attack Convoy secondary missions.** In the U.S. campaign they trigger the Convoy procedure in both the Enemy Operations Phase (11.3.1 case 2) and a Lake-Action Encounter (as in the Playbook example, where your Escort Force can be found). In the British campaign they apply only in the Enemy Operations Phase, because British 9.1.2 says the Escort Convoy box Deploys only then; in a Lake-Action Encounter the card is a plain Patrol (player ruling, Nov 2026). In the Lake-Action case the Force that triggered the Encounter defends the Convoy along with your Escort Forces. If you have no Escort, the A.I. rolls on the Scatter Table and the Encounter ends.
13. An **Escort** card in a Lake-Action Encounter is a Patrol while the Sacket's Lake Zone holds a Blockade marker: both rulebooks' 9.1.2 allow Convoy Encounters only on turns when Sacket's is free of Blockade (the U.S. rulebook also names Sacket's, and the app follows it as printed). Otherwise it reveals the A.I. Convoy marker. If there is no Convoy, the card is a Patrol. If the deployment cell is blank, the Convoy is unescorted and your Force rolls on the Scatter Table (full-strength guns only). Otherwise it is an escorted-Convoy Encounter (Patrol Segment only) followed by a Scatter attack if the escort is beaten.
14. **Cutting-Out cards** deploy nothing when the optional rule is off.
15. The **British A.I. never uses Converted Laker Schooners** in Lake Combat, either attacking or defending.

## Encounters and Lake Combat
16. **Line of battle:** A.I. columns are Flagship first, then by capture VP, then Close Action. Your defending column uses the same order. When attacking you choose the ships and tows, and the default tows the strongest-gunned schooners.
17. **A.I. attack choice:** all full-strength ships attack. The A.I. Americans tow schooners with every “T” ship. If the attack fails its threshold because of untowed schooners (1.5:1), the A.I. retries without them at 1:1. The first attack of an A.I. Breakout is not subject to the preconditions, because the Breakout decision was already made.
18. **The untowed-schooner DRM roll** (1d6) is made every Gunnery Round of a U.S. attack. It is skipped in Harbor Encounters and under Sweep Up & Fire.
19. **Tactics** last for the current Combat Sequence; when the Weather Gage changes hands, a new sequence starts and new Tactics are drawn. One-shot Tactics (Surprise, First Shot, Rake, Escape, Pursuit, Defender Outmaneuver) are used once. Defender Rake rolls each Attacker hit on the 2-ship column.
20. **Minor Damage** is used automatically (for you or the A.I.) on the first hit the protected side takes in a Gunnery Round in that zone.
21. **Missed Signal:** the randomly chosen ship sits out the first combat round her side fights in that zone, then joins the end of her column.
22. **Leader casualties:** the Leader is captured only if the Flagship is captured in Melee, or Strikes/sinks while no other friendly ship remains Engaged. Otherwise a lost Flagship just shifts the flag to the best remaining ship. Gale or Explosion sinking the Flagship kills the Leader. You are offered a flag transfer when your Flagship is Reduced. The A.I. transfers only when it is attacking and the transfer keeps its Command DRM.
23. **Withdrawal:** the whole Force withdraws (LC5): its Engaged ships, ships hit by the W result that pass their Disengagement Check, and ships that Disengaged earlier in the Encounter. Ships that just failed their check, and ships that “Fight On”, stay Engaged. Coastal missions of withdrawing Forces abort, and their Troops return to the Available box in F7.
24. **Pursuit** cancels the Defender's withdrawal and starts a new Encounter (a new Weather Gage draw; the zone's Lake Event stays in force).
25. **Reaction Segment** happens when the Patrol Segment ends with both sides still having Engaged ships. Your homeport-to-zone distance counts the port as one zone (11.2.3). **Intelligence** (Event cards 29/31) gives +1 and cancels the negative distance DRM while keeping positive ones such as Fair Wind. It is used up by the first Encounter that involves the enemy Flagship, whether or not anyone makes a Reaction Check; otherwise it lapses at the end of the next turn.
26. **Struck Colors:** if exactly one side withdrew or was eliminated, its struck ships are captured and the other side's are rescued. Otherwise each struck ship rolls 1d6 (1–3 captured).
27. **Sickness** lowers only Close Action Strength. **Haze** removes Long Guns in the first Gunnery Round 1 fought in that zone each turn.
28. **Gale:** losses from the Gale (sunk or captured on the beach) score no VPs, because they have a non-combat cause.

## Coastal and Tally
29. **Heated Shot:** the damaged ship goes to In Ordinary in F7, to Repairing in the next A3, and is Deployable the turn after. **Requisition:** the ship is out of play for the whole next turn.
30. **Harbor Encounter** defenders are the Deployable and In Transit ships at the targeted port. Defenders that strike are not captured, and Reduced defenders move to In Transit.
31. **Lake Control** counts the Steps of full-strength warships (≥5) with no full-strength enemy warships in the zone.
32. **Convoys:** a Convoy that is delayed (Convoy Delay event, Blockade, or a passed Breakout) gives no advance that turn. It arrives (+2) in the next F5 that finds the Homeport free of Blockade. When the A.I. stays blockaded in Step D, its marker for the turn receives a Convoy Delay. **Unmaintained Blockade:** if no blockading ships are on station outside the blockaded Homeport in Step D, no Breakout is needed (14.3 note), the marker lapses in F2.3 and that side's Convoy runs on schedule (player ruling, Nov 2026).
33. **Dual Blockade sudden death (14.2)** triggers when the blockaded side does not meet the Breakout requirements: for you, enemy ships on station and at least one full-strength ship in your home port; for the A.I., the 14.3 comparison (Carronade for the British, Long Gun for the Americans, in port vs the blockaders).
34. **Naval Balance** excludes ships in a Blockaded original Homeport (14.1.2) but includes Deployable Isolated ships (14.1.1).

## Player Aids V and VII
35. **Force Package selection (5.3.1):** Main Ships are used first. If they alone can meet the requirement, the app uses the fewest Main Ships that do. Otherwise it takes all Main Ships plus the fewest Secondary Ships that cover the rest. Among equally small sets, it picks at random using the seeded dice. (The Playbook example draws Secondary Ships at random until the target is reached. The rule's "smallest number of ships" governs here, so the result can differ by one ship.)
36. **Package #1** needs at least one Main Ship. **Package #7** leaves out Secondary ships with neither Long Gun nor Close Action (Asp, Lady of the Lake).
37. **Package #8** needs both Forces. The 1st Force is the fewest Main Ships totaling 8 Close Action, with an Army Support mission and as many Troops as it can carry. The 2nd Force is the fewest remaining ships (Main first) totaling 22 Long Gun, on Patrol. If either can't be met, or no A.I. Troops are Available, nothing Deploys. In a Lake Action Encounter, 1d6 picks which Force fights: odd = Army Support, even = Patrol. Both stay on the map. In Enemy Operations both simply Deploy.
38. **Package #9** takes the 0-Close Action Secondary with the lowest Long Gun, random among ties. **Package #11** draws Secondary ships at random until their steps total at least 5.
39. **Land Battle Table misprint:** in the printed 0 Long Gun / 3 Troops column, rolls 62–63 have no result (Attacker Success 35-61, Attacker Major Success 64-65). The app reads Attacker Success as 35–63, following the 65 / 64 / 63 progression of that band. All 14 other columns cover 11–66 exactly.
40. **Land Battle column shifts** (More Defenders −2) stop at the 0 Long Gun column. More than 3 Troops markers use the 3-Troops column.
41. **Stolen Supplies:** Player Aid VII says a successful Land Battle against a Homeport *advances the attacker's* Convoy Supply marker two spaces. The Living Rules F5.3 (2024) say the *defender's* marker *regresses* two spaces, and the errata (1 Oct 2023) deletes the player-aid paragraph. The app regresses the defender.

## Not automated
42. Optional Advanced rules beyond OA1 and OA2 are not implemented.

## Added in 0.2.1 (audit of 0.2.0)
43. **Close Action hit then Melee (LC7d):** a hit defender makes its Disengagement or Strike Check at once. If it is still Engaged afterwards (failed check, or “Fight On!”), the same two ships go to a Melee, using their current Close Action strengths. This follows the LC5 sidebar and the Playbook example (Wolfe vs Lady of the Lake). Gen. Pike still never Melees.
44. **Close Action matchups (LC7b), your attack:** the app makes the largest possible number of 2:1 matchups, giving the weakest free defender to each attacker from the weakest up. The A.I. still chooses by LC7c (capture VP, then guns, then lowest CA).
45. **Commanding Breeze** affects only the Encounter it was drawn for (cards 37–38), not later Encounters in that zone the same turn.
46. **Last-turn sudden death (5.1)** counts an A.I. ship as eligible if it will be Deployable on Sept. II: Deployable or Make Ready; Repairing with no delay marker (not a newly built damaged ship); In Transit at full strength; laid up and undamaged (the A.I. recommissions it); or back from Requisition.
47. **Blockaded A.I. ships in Lake Action** may Deploy for an Encounter in any zone (player ruling, Nov 2026); 14.1.2 bars them only from missions and the Enemy Operations Phase.
48. **Fast ships:** both rulebooks (LC5.2) and the errata (which answers exactly this question) say a full-strength “F” ship automatically passes her first Disengagement Check. The Playbook example has the Lady of the Lake roll; the app follows the rulebooks.
49. **Final-turn cards:** the British rulebook says 27 cards carry the final-turn symbol; 28 B-deck cards actually show it. The app removes the cards that show it.
50. **VP errata:** the errata's corrected Player Aid VIII text (“destroyed ±2 to ±32”) does not match the map's VP list; the app uses the map values.

## Added in 0.2.2 (independent audit of 0.2.1)
51. **Scattered Convoys** are delayed, not lost: no advance that turn, a Convoy Delay marker, and +2 at the next F5 with no enemy Blockade (Living Playbook p. 16–17). Destroyed and Captured Convoys are lost.
52. **Flag transfer (LC5.1)** is also allowed when the Reduced Flagship has just Disengaged, while she is still in the column before the gap closes (Playbook p. 19). A wounded Leader cannot transfer.
53. **Withdrawal for your Force** is offered after a W result even when all your ships in the Encounter have Disengaged; accepting it sends them In Transit with the rest of the Force.
54. **Troops** are whole markers: fractional entries are refused in A7, in Adjust and in loaded saves.
55. **Lineup preview** shows the first Round exactly as it will be fought, including a Missed Signal ship sitting out and the A.I. British leaving Converted Laker Schooners out of the defending line.
56. **Loading a save** checks it first. A damaged, cut-off or incomplete save is refused with a message and the current game, its autosave and Undo history are left untouched. Saves from earlier versions are accepted; fields added later are filled with their starting values.
57. **Force Package 8 split (open question):** when several minimum-size first Forces are legal, the app takes the first one found and does not check ahead whether the rest can still form the second Force. The rules do not say which first Force to prefer.
