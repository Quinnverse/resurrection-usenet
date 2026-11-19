# Resurrection V5 — acceptance report

Branch `feature/resurrection-v5-complete`, pushed to GitHub. Nothing was merged, deployed, published or submitted.
Final CI run: https://github.com/Quinnverse/resurrection-usenet/actions/runs/44466876584 (commit 701a5b6).

Status words:
- **COMPLETE**: built, and checked by an automated test that exercises it in the place it matters.
- **PARTIAL**: built, but part of the requirement is missing or below target.
- **NOT TESTED**: built, but nothing has checked it where it matters (a person, a speaker, a real GPU).
- **BLOCKED**: could not be done in this environment.

**Overall: PARTIAL.** Every automated check passes, including the whole game in real Chromium in both languages.
The game is not marked COMPLETE because nobody has played it (no blind playtest, no measured play time), the
estimated first-play time is at or just below the 35–45 minute target, and nobody has listened to the audio.

## What was run

| Check | Result |
|---|---|
| `npm test` (all suites; 32 V5 tests) | 229 / 229 pass, locally and in CI |
| `npm run test:v5-shell` (the real `main.js` and every render module in Node, fake DOM, bot plays the whole game through the shell's frame loop; EN with one set of choices, ZH with the other; tech page walkthrough) | pass locally and in CI: 0 shell errors, 0 missing translations, player never off screen in the follow camera, 10 album pictures with images, save at `end` reloads |
| **Real Chromium E2E** (`e2e/v5.spec.js`, SwiftShader WebGL, CI job "Browser end-to-end, V5 full game") | **9 / 9 pass** in run 44466876584 |
| – title, real keyboard walking, pause, settings, language switch | pass |
| – every one of the 20 beats loaded from its save through Continue (EN, plus ZH for 3 beats), real key and mouse input, screenshots, fps, heap, audio level, failed requests | pass: no console errors, no failed loads |
| – Tab on the pier in the real page | pass |
| – **the whole game, all seven chapters, EN** (bot inside the page, real shell/DOM/CSS/WebGL, recorded on video) | pass: credits with both role lines, 10 photos all with images, save = `end`, 0 stuck moments |
| – **the whole game, all seven chapters, ZH, other choices** | pass, same checks |
| – tech demo: Restore makes the 2004 canal crossable; the variant input is refused and leaves the 14-plank 1998 bridge | pass |
| – regression `/`, `/p3/`, `/p4/` | pass |
| Other CI jobs: npm test, container smoke, the main browser suite | pass |
| CI job "Browser end-to-end, P5 slice" | **fails**, and failed the same way before V5 work began (run on `design/resurrection-v5` f69fa3b and the last run on `p5-narrative-gameplay`). Not changed by V5. |
| Continue from every saved beat (Node shell, 2 × 20 saves) | all return to the same beat |
| Human blind playtest | **not done** (plan: `docs/V5-PLAYTEST-PLAN.md`) |

Evidence: `docs/v5-evidence/browser/` (72 real WebGL screenshots, perf and resource data). Full videos of both
playthroughs are in the run's artifact `resurrection-v5-evidence` (14-day retention). Software previews from earlier
work are in `docs/v5-evidence/software-preview/` and are labelled as such.

## Performance (CI, SwiftShader)

| Measure | Value | Note |
|---|---|---|
| Frame rate | 10–12 fps on every beat | SwiftShader renders on the CPU of a 2-core runner. This says nothing about real GPUs. The 30 fps target is **NOT TESTED** on real hardware. Automatic quality drop below 24 fps is implemented. |
| JS heap | 11–36 MB per beat | no growth across beats |
| Page load | 23 requests, 1.13 MB (Three.js is 676 KB of it), slowest request under 25 ms | local server |
| Failed requests, console errors | 0 | all tests |

## Play time

| | Value | Status |
|---|---|---|
| Automated playthrough (bot, virtual time) | 547 s (EN), 544 s (ZH) | measured; not human time |
| **Estimated first play** (`tools/v5-estimate.mjs`: reading time per line plus the bot's play time × 1.6–2.8) | **EN 28–37 min, middle 33 min; ZH 27–35 min, middle 31 min** | ESTIMATE, not measured |
| Per chapter (EN middle estimate) | 1: 4.2 · 2: 4.1 · 3: 5.8 · 4: 4.6 · 5: 3.4 · 6: 4.1 · 7: 6.4 min | ESTIMATE |
| 35–45 min target | the estimate reaches it only at the slow end | **PARTIAL / NOT TESTED** |

The length comes from activities, not waiting: no movement was slowed, no wait was lengthened, and every cutscene
already seen can be skipped. The model ignores optional exploration (looking at things, talking to Iris, the study,
the soda machine in 2004), so a curious player will take longer than it says. Only a playtest can settle this.

## Requirements

### Story

| Item | Status | Notes |
|---|---|---|
| Ch1 study → disk → town → Theo → bridge restore → pier with Tab → carving "E + J" with June (1998) → train chase; June's three lines exact | COMPLETE | |
| Ch2 photo dares, June's sketch of Elena, the tunnel, June asleep; "你就是风景"; playful/sincere | COMPLETE | June starts the dares and draws; she is not only photographed |
| Ch3 ride (ribbon gates, slipped chain, bell, no-hands), window, lens on the pulley, lamp, steering the beam to find June and the cottage, glide or stairs; "你可以不听我的呀。/ 可是我想听你的。" | COMPLETE | |
| Ch4 June's portfolio and her own ambition (animated films, the studio), drawing a boat, tuning, duet twice, sitting closer or not, the porch constellation, "再弹一次", 感我此言良久立 (白居易《琵琶行》 credited) | COMPLETE | No copyrighted songs used or named |
| Ch5 suitcase, soda machine, last photo, walk to the end of the platform, the news (June chose it herself), "你可以想我。/ 但不要把自己留在这里。", running beside the train; 2004: the same machine, camera and door give no answer | COMPLETE | |
| Ch6 2004: packing June's boxes (her twelve picture books, her Lisbon residency), the 1999 studio letter (the job she lost), the beach walk with the conversation; defend/admit and fix/forgive change words, not outcome; all required lines exact; "路上小心。"; no reconciliation | COMPLETE | Elena's responsibility stated in both branches ("The publisher asked." / "You answered.") |
| Ch7 drafts stay unsent (read one or close the folder); read the 1998 sign then restore the names; free Iris from her loop and untie her boat; restore the lamp (RESTORED) then the seasons (CREATED); Theo/Mara snow lines; the last light on the old pier; new pale planks (CREATED, present edition only); credits "Elena — Programming & Music / June — Art & Story" | COMPLETE | 1998 and 2004 snapshots are unchanged (tested) |
| Full bilingual script | COMPLETE | `docs/V5-SCRIPT.md` (generated from the game's data) |

### Gameplay and controls

| Item | Status | Notes |
|---|---|---|
| A distinct activity in every chapter | COMPLETE | see `docs/V5-IMPLEMENTATION.md` |
| June FSM INVITE → LEAD → WAIT → PLAY → COOPERATE → REACT → TRANSITION | COMPLETE | LEAD now used on the platform and the beach |
| Restore / Revive / Rewind / Recompose | COMPLETE | |
| Keyboard and mouse | COMPLETE in Chromium (real key events for walking, Esc, Tab, settings); the full playthrough feeds input through the shell's test hook |
| Key remapping, gamepad, touch | NOT TESTED | implemented |
| Feel of movement, camera, bike, beam, pen, tuning | NOT TESTED | needs people |
| Saves and Continue | COMPLETE | every beat in Chromium |

### Art and audio

| Item | Status | Notes |
|---|---|---|
| Scenes render in WebGL: study, town (1998, 2004, present, winter), station (three times), carriage (tunnel, cape lighthouse, kite), coast (day, dusk, night with stars, 2004), cottage (1998, 2004) | COMPLETE | real screenshots |
| Characters: smooth heads, eyes with irises and highlights, blinking, breathing, looking at the speaker, expressions, poses for every activity | PARTIAL | Clearly better than the first browser screenshots, still a simple low-poly style: no rigged faces, simple bodies, sometimes stiff close-ups |
| Unified art style, recognisable places, visible 1998/2004/present difference | PARTIAL | consistent and readable in the screenshots; not judged by anyone outside development |
| The first snow | PARTIAL | snow, white ground, roof caps and the winter theme are there; the effect is modest |
| Audio plays | COMPLETE (signal only) | In Chromium the AudioContext runs on every beat with output level RMS 0.003–0.019 and the expected theme per beat |
| Audio sounds good | **NOT TESTED** | nobody has listened; the sandbox and CI have no speakers |
| EN / 简体中文 | COMPLETE | both full playthroughs in the browser |

## Known issues

1. No human has played V5: fun, clarity, pacing and emotional effect are unverified.
2. Estimated time is 28–37 min (EN), around or below the 35–45 target; unmeasured.
3. Audio quality unheard.
4. Characters are stylised and simple; close-ups do not carry much facial acting.
5. 30 fps on real hardware not measured (CI uses a software GPU).
6. Gamepad, touch and key remapping not exercised.
7. The P5 browser job keeps failing; it was already failing before V5 and V5 does not touch P5.

## Release preparation checklist (not started; needs the owner)

- [ ] Blind playtest with 5–8 players (`docs/V5-PLAYTEST-PLAN.md`); measure time per chapter.
- [ ] Listen to every theme and effect on speakers and headphones; adjust levels.
- [ ] Check 30 fps on a low-end laptop GPU and a phone; tune quality presets.
- [ ] Test gamepad, touch and remapping by hand.
- [ ] Decide what to do about the failing P5 browser job.
- [ ] Review the credits, the poem attribution and the fixture labels.
- [ ] Merge, deploy and any submission: only with the owner's approval.

## Commits (after `origin/design/resurrection-v5` f69fa3b)

See `git log f69fa3b..feature/resurrection-v5-complete`. Main steps: 559ab2f core; f8ef92c shell; b3b5af9 browser spec;
9569711 chapter expansion; 79c0061 characters; 5152f8b `[hidden]` fix; 58d28d3 finale; 26fce89 visual fixes from real
screenshots; f565a4d faces and close-ups; 701a5b6 debug snapshot fix; then this report.
