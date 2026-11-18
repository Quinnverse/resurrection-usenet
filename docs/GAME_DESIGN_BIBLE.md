# RESURRECTION — Game Design Bible V1.0
> Status: approved design baseline; gameplay implementation not yet verified.
> Companion: [Narrative Bible](./GAME_NARRATIVE_BIBLE.md)
> Scope: one complete 20–30 minute browser-playable chapter; desktop-first, mobile accessible.

## Design pillars
1. **Discover, don't follow dots:** guide motivation and navigation, not puzzle solutions.
2. **Evidence is progression:** learning changes what can be done; facts ≠ inferences ≠ unknowns.
3. **Repair has consequences:** world geometry, light, sound, NPC behavior persistently change.
4. **The medium matters:** USENET message structure and distributed copies are core mechanics, not decoration.
5. **Earn emotion through play:** first make the world fun and its makers human.

## Gameplay loop
Notice an anomaly → explore and gather evidence → compare surviving copies → form a hypothesis → operate a 3D restoration puzzle → witness persistent world/NPC changes → revise understanding.

## Existing implementation / migration boundary
P4 on `/p4/` has a study, archive and town, third-person Three.js camera, 1998/2004 variants, Theo and a lighthouse. Preserve those assets and routes. Develop a new `/p5/` preview or an explicitly isolated feature path; do not overwrite `/`, `/p3/`, `/p4/`, production saves or deployment. Audit existing code before making changes.

## Main quest tree
| ID | Quest | Core player action | Completion condition |
|---|---|---|---|
| M01 | Mother's Other Name | inspect photo, box, computer; correlate signature with skylark | identity supported by two independent clues |
| M02 | Enter the Old Internet | follow message IDs/replies to reconstruct *Last Light* attachment/build | build recovered with provenance |
| M03 | Lighthouse That Never Lit | talk to Theo; inspect mechanism; compare 1998/2004; restore component and logic; align lens | light visibly works, Theo state changes |
| M04 | The Second Author | trace mural/credit and 2004 change record; compare June's public reply | deliberate deletion proven, motives remain nuanced |
| M05 | Unsent Summer | find unsent draft; archive verified history; return to drawing | emotional closure, no forged reconciliation |

## Side quests (optional; must not block main story)
**S01 The Bakery's Last Recipe:** recover 1998 recipe and 2004 oven logic, interactively bake; bakery opens and reveals funny Elena/June banter.
**S02 The Painted-Over Mural:** compare layers/versions, align and restore verified June art; unlock optional credit-context evidence.
Each has discoverable trigger, multiple actions, world-state change and narrative reward; no fetch-only quest.

## Player guidance
First 30 seconds communicate **who Mara is, why she's here, what she seeks**. At 20s give “Find out who skylark was.” By 60s enable first meaningful inference.
HUD shows current story objective; J opens quest log; Tab evidence/provenance; H progressive hints; E interaction; WASD move; mouse camera; Esc settings. Mobile touch alternatives. Contextual environmental light/audio, not constant gold trails. Dialogue skippable and reviewable; skipped lines never lose evidence.

## Evidence system
Evidence record fields: id, source, message_id/build_ref, timestamp, claim, provenance, confidence category (VERIFIED/INFERRED/UNKNOWN), relationships, discovery state. No claim that a person's motive is VERIFIED merely from a file deletion. Wrong hypothesis offers informative counterevidence, not a dead end. Support save/reload and EN/ZH.

## USENET reconstruction contract
Real technical model: Message-ID, From, Date, Subject, References/In-Reply-To; dedupe, reply graph, attachments/build manifests, checksums, divergent distributed copies, source tracing. Use clearly fictional, correctly structured offline sample data; do not pretend they are authentic historical posts. The 3D archive and town are modern representations built from parsed data, not a claim that USENET itself hosted a 3D world.
Separate RESTORED (verified source), RECONSTRUCTED (derived executable world), and CREATED (new memorial material). Record provenance and uncertainty.

## Lighthouse: flagship puzzle
1. Theo reports the lamp fails; players inspect physically visible symptom.
2. Compare two build copies: 1998 retains original control rule/attribution; 2004 retains another functional component but lacks part of history.
3. Gather evidence for the needed combination; wrong combinations explain *why* (incompatible, missing, tampered).
4. Player physically fits component, adjusts lens/gear, aims beam at a readable target with 3D feedback.
5. The lighthouse turns on; beam sweeps over previously visited town landmarks; Theo changes behavior and dialogue.
6. New discovery: missing June credit was deliberately changed, prompting M04.
No single-click “Restore” success; no arbitrary trial-and-error solution.

## Other puzzles
M01 identity correlation; M02 message/reply chain; S01 oven interaction; S02 mural layer alignment; M04 timestamp/credit provenance; M05 distinguish historical archive from explicitly labeled creative continuation. For each implement: visible goal, available evidence, player action, success/failure feedback, hint ladder, recoverable state.

## Art bible
Stylized low-poly 3D with painterly textures, warm physically legible lighting, readable silhouettes and expressive camera staging. Real study: wood/amber/dust/lived-in clutter. Archive: deep blue/teal with amber structural clues; message references become paths, missing data becomes gaps. 1998 town: vibrant, playful, imperfect handmade geometry. 2004 town: tidier, cooler, missing personal traces; not merely grey filter. Camera must frame restoration and the lit lighthouse. Avoid clipping and occlusion; maintain performance.

## Audio bible
Study: clock, traffic, CRT fan. Archive: restrained pulses and spatial cues. 1998: sea/wind/birds/original cheerful motif. 2004: same motif missing layers. Restoration: mechanical sounds then theme layers returning. Deletion reveal: pull music back. Ending: simple reprise. Mute and volume controls; no unlicensed copyrighted music.

## UI and accessibility
Default English; full simplified Chinese parity. Adjustable text size if feasible, readable contrast, subtitles, reduced motion, input remapping where feasible, keyboard/mouse and touch support. Avoid dialogue walls, overly large mobile objective HUD, and important evidence locked behind skippable dialogue. Autosave on durable progress; confirmation before overwriting saves.

## Target player journey (not measured results)
| Elapsed | Player experience |
|---|---|
| 0–3 min | understand Mara, inspect study, identify skylark |
| 3–7 min | reconstruct and enter town, enjoy Theo |
| 7–13 min | compare versions and physically repair lighthouse |
| 13–18 min | uncover intentional credit removal |
| 18–23 min | evaluate evidence and unsent letter |
| 23–25 min | return to drawing, quiet closure |

## Test and acceptance
Automated: main quest completable; both side quests optional and completable; false hypotheses recover; version provenance consistent; physical lighthouse interaction; persistent NPC/world state; save migration; EN/ZH parity; mobile flow; old routes unchanged.
Human blind-play: 30s player can state identity/motivation; 3min discovers meaningful clue; 8min understands why copies differ; lighthouse solved by inference rather than button spam; player can separate deletion fact from motive speculation; ending prompts nuanced description of Elena. Log stalls, confusion, fun, emotional reaction. CI passing is not game quality passing.

## Competition framing and demo
Resurrection category: obsolete distributed discussion/archive tech is repurposed as a playable, provenance-aware 3D reconstruction. Show parsing, duplicate/conflict comparison, restoration and emotion in one real 3-minute capture. Kiro process evidence should be honest and reproducible. Verify official current rules/deadline before submission.

## Work breakdown / production gates
**Gate 0 (design):** scene-by-scene bilingual script, clue placement, state diagrams, hint ladders, art shot list, and technical data model; reconcile with existing P4.
**Gate 1 (playable core):** M01–M03 and one true 3D puzzle, not a clickable text demo.
**Gate 2 (story closure):** M04–M05, S01–S02, sound and polish.
**Gate 3 (human acceptance):** blind playtest and revise; package demo; no deployment without owner approval.
Stop feature expansion if core fun, guidance or emotion fail. No production deploy, no merge to main, no contest submission without explicit authorization.

## Creative risks
Moralizing, turning June into a plot device, reducing USENET to a skin, over-guiding, unearned sentimentality, uncontrolled scope. Prioritize player agency and a complete chapter.
