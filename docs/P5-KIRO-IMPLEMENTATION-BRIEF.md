# P5 implementation kickoff — Kiro execution contract

Branch: `p5-narrative-gameplay`. Read `docs/GAME_NARRATIVE_BIBLE.md` and `docs/GAME_DESIGN_BIBLE.md` in full before touching code. These are creative source-of-truth documents; existing P4 code is implementation reference, not narrative canon.

## One-pass execution
1. Inspect current Three.js P4 architecture, story/state/save/tests and record a concise mismatch matrix against the two bibles.
2. Complete `docs/P5-SCENE-BY-SCENE.md` with playable beats, actual bilingual dialogue, evidence placement, quest prerequisites, physical actions, failure/hint ladder, transitions, and cutscene shot list. Complete `docs/P5-QUEST-STATE-MACHINE.md` with quest IDs, state transition tables, provenance schema and save migration.
3. Implement isolated `/p5/` preserving `/`, `/p3/`, `/p4/`. Reuse P4 Three.js assets and improve gameplay, not map size.
4. Build a vertical slice with M01 identity deduction, M02 message graph / USENET recovery, M03 Theo and physically operable lighthouse. Ensure each is an actual player interaction with clear feedback, not a sequence of E prompts. Integrate main objective HUD, J quest log, Tab evidence log, H hints, EN/ZH, autosave.
5. Implement M04 provenance-based credit reveal and M05 unsent letter and ending; add optional S01 bakery and S02 mural if time permits without degrading the main path. Prioritize one complete emotional arc over extra content.
6. Run Node tests and real Chromium E2E on desktop and mobile; capture actual game screenshots and continuous playthrough; check old routes; report human-playtest gaps candidly.
7. Commit all work on the P5 branch, link commits and playable launch commands. Do not deploy Tencent, merge to main, overwrite production saves, pay for APIs or submit contest.

## Critical design invariants
- The archive is a modern visualization of fictional USENET-style data, not a ghost realm.
- Elena's intentional deletion is fact only after sufficient player-inspected evidence; her motive is not proven by the deletion alone.
- June has agency, authorship and a life independent of Elena.
- An unsent apology stays unsent; do not fake reconciliation.
- Restored historical content, executable reconstruction, and new memorial additions remain separately labeled.
- Player must know why they are investigating within 30 seconds, but should not be given puzzle answers via permanent waypoints.
- The lighthouse is an operated 3D puzzle, not a one-click restore.
- No new platformer or repetitive fetch quests.

## Deliverables
`docs/P5-SCENE-BY-SCENE.md`, `docs/P5-QUEST-STATE-MACHINE.md`, playable `/p5/`, bilingual content, tests, screenshots, known limitations, and git commits.
