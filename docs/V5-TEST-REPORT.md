# Resurrection V5 — acceptance report

Branch `feature/resurrection-v5-complete`, local commits only. Nothing was pushed, merged, deployed or submitted.
Date: 2026-11-18.

Status words:
- **COMPLETE**: built, and checked by an automated test that exercises it.
- **PARTIAL**: built, but part of the requirement is missing or below target.
- **NOT TESTED**: built, but nothing has checked it where it matters (a browser, a person, a speaker).
- **BLOCKED**: could not be done in this environment.

## What was actually run

| Check | Result |
|---|---|
| `npm test` (all suites, includes `test/v5-core.test.mjs`, 32 V5 tests) | 229 / 229 pass |
| Headless playthrough on the game core, both choice sets, plus the variant archive | all seven chapters, credits reached, 0 stuck moments, about 260 s of game time |
| `npm run test:v5-shell`: the real browser shell `main.js`, all render modules, HUD and saves, run in Node with a fake DOM and a stand-in for WebGL, the bot playing through the shell's own frame loop | EN and ZH (other choices) complete. 0 shell exceptions, 0 non-finite cameras, 0 missing translations, 0 frames with the player off screen in the follow camera, 0 prompts not shown. Credits contain both role lines and the unsent-letter line. 4 photos with thumbnails in the album. Save at `end` reloads. |
| Continue from the save written at each of the 15 beats (EN and ZH runs, 30 loads) | every load returns to the same beat and plays 4 s without error |
| Tech page walkthrough in the same harness | loads; Restore makes the 2004 path exist; variant refuses the restore and leaves a 14-plank 1998 bridge with no path; walkthrough reaches each section at 0:00 / 0:25 / 0:55 / 1:20 / 1:45 / 2:20 / 2:45 |
| Server routes `/`, `/p3/`, `/p4/`, `/p5/`, `/v5/`, `/v5/tech`, `/v5/data/*`; `..` traversal | all 200; traversal 403/404; CSP `script-src 'self'` served |
| Software previews of 59 frames from the shell's own camera | `docs/v5-evidence/software-preview/` (approximate renderer, not a browser) |
| `e2e/v5.spec.js` in Chromium | **NOT RUN**: no browser in the sandbox; CI not triggered because pushing V5 was not authorised |
| Human blind playtest | **NOT DONE** |

Bugs found and fixed by the shell harness and the previews: events raised when a dialogue ended (the archive rebuild
screen, the memory card, carrying the window, fades) were pushed into a stale list and never reached the shell; the
camera swung across the map after each beat and respawn instead of cutting; close-ups showed the back of Elena's head
because she did not turn to the person she was talking to; in the train's first-person aim, Elena's own body filled the
photo; June faced the window while talking.

## Requirements

### Story (seven chapters)

| Item | Status | Notes |
|---|---|---|
| Ch1 study → town → Theo → bridge restore → pier with 1998/2004 → memory → train chase; June's three lines | COMPLETE | Lines exact in ZH; played by the bot through the shell |
| Ch2 train photos, "你就是风景", photos kept in the save and shown in the final album | COMPLETE | Thumbnails are captured from the canvas in a browser; in Node only a placeholder image exists |
| Ch3 ride, window built and placed, lamp, cliff; "你可以不听我的呀。/ 可是我想听你的。"; the window is identical in 1998 and 2004 | COMPLETE | Window bytes checked equal across eras by a test |
| Ch4 duet from the archive melody, "再弹一次", 感我此言良久立 with credit to 白居易《琵琶行》 | COMPLETE | Credit in the subtitle and in the end credits. No copyrighted songs are used or named in the game |
| Ch5 parting at the station, "你可以想我。/ 但不要把自己留在这里。", years-later, alone on the bench | COMPLETE | |
| Ch6 2004 cottage, the five exchanges and "路上小心。", no reconciliation | COMPLETE | Lines match the narrative bible exactly |
| Ch7 present: restore June's credit, Iris's own ending, 1998/2004 unchanged, CREATED seasons, Theo/Mara snow lines, credits "Elena — Programming & Music / June — Art & Story", letters stay unsent | COMPLETE | ZH credits keep the English credit line with a Chinese gloss |
| Length 35–45 min | **PARTIAL** | Not measured with people. The script has 92 dialogue lines (about 3,300 English characters). Estimate: 14–18 min for a first play (reading time plus about 2–3× the bot's movement time). This is well below the target. Reaching it needs more written content: optional conversations, more of the archive readable in the study and the town, and longer chapters 3 and 6. |

### Systems and controls

| Item | Status | Notes |
|---|---|---|
| June FSM INVITE → LEAD → WAIT → PLAY → COOPERATE → REACT → TRANSITION | COMPLETE | core/companion.js; used in every chapter June is in |
| Restore / Revive / Rewind / Recompose | COMPLETE | See docs/V5-IMPLEMENTATION.md |
| Photo, bicycle, window building, music | COMPLETE (logic) / NOT TESTED (feel) | |
| WASD, mouse camera, Space jump, Shift sprint, E interact, Tab era switch, click actions, Esc pause | COMPLETE (logic) / NOT TESTED in a browser | The harness drives the game through the shell's input hook, not real key events. The browser spec has real key tests but has not run |
| Key remapping | NOT TESTED | Implemented in settings and stored |
| Gamepad | NOT TESTED | Standard mapping implemented; no pad available |
| Touch | NOT TESTED | |
| Skippable seen cutscenes; unseen cannot be skipped | COMPLETE | Core test |
| Autosave and Continue | COMPLETE | 30 continue loads in the harness; browser reload in the spec NOT RUN |
| Transparent HUD, no task cards, hints in character voice | COMPLETE (logic) / NOT TESTED visually | |

### USENET technology

| Item | Status | Notes |
|---|---|---|
| rnews spool and mbox parsing, folded headers, Message-ID, References, cancels per source, conflicts, missing parents | COMPLETE | |
| uuencode and MIME base64 attachments, type and size limits, CRC-32, SHA-256 | COMPLETE | Checksums tested against standard vectors |
| Manifests → scene graph → collision; provenance in the save, re-checked on load | COMPLETE | |
| Different input gives a different world (variant fixture) | COMPLETE | Game and tech page |
| All data labelled fictional | COMPLETE | Every record has `X-Fixture`; checked by a test |

### Art, audio, presentation

| Item | Status | Notes |
|---|---|---|
| 3D scenes: study, town (1998, 2004, present with seasons), station (three times of day), carriage, coast road and lighthouse, cottage (1998, 2004) | COMPLETE (built) / NOT TESTED (real look) | Only seen through the software previewer |
| Characters: Mara, Elena 17/23, June 17/23, Theo, Iris, with expressions and poses | COMPLETE (built) / NOT TESTED (real look) | Low-poly, procedural. Close-ups look simple; no facial animation beyond expression swaps |
| Original music and sound | NOT TESTED | Procedural Web Audio from `tune.ll`. Never heard: the sandbox has no audio output. Quality unknown |
| EN / 简体中文 | COMPLETE | Key parity tested; ZH lines checked against the bible |
| 30 fps, browsers, 320–1920 px layouts | NOT TESTED | |
| Recording / browser screenshots | BLOCKED | No browser. Software previews instead, labelled as such |

### Delivery

| Item | Status |
|---|---|
| Source, assets (procedural), script (core/i18n.js, core/game.js DIALOGS), audio (render/audio.js), archive and pipeline | COMPLETE |
| Tests: core, shell harness, browser spec | COMPLETE / COMPLETE / written, NOT RUN |
| Run instructions, controls, architecture | COMPLETE: docs/V5-IMPLEMENTATION.md |
| 3-minute demo script and page | COMPLETE: docs/V5-DEMO-SCRIPT.md, `/v5/tech` |
| Real browser E2E | BLOCKED (no browser; push not authorised) |
| Human blind playtest | NOT DONE: nobody has played V5. Whether it is fun, readable or moving is unverified |

## Commits on the branch (after `origin/design/resurrection-v5` f69fa3b)

- `58e2361` P5: over-the-shoulder anomaly shot (cherry-pick, P5 only)
- `559ab2f` V5 core: archive, parser, pipeline, physics, June, toys, seven-chapter simulation, EN/ZH, bot, tests
- `f8ef92c` V5 shell: Three.js scenes, cast, audio, main.js, routes, tech demo, Node shell harness, event fix
- `b3b5af9` V5: browser spec (not run), browser-v5 CI job, previews, camera and facing fixes
- the docs commit that adds this file

## Files added or changed

```
.github/workflows/test.yml          new browser-v5 job (shell harness + e2e/v5.spec.js); main browser job skips V5
.gitignore                          test-results/, playwright-report/
combined-server/server.js           /v5, /v5/tech, /v5/* routes
package.json                        test includes v5-core; new test:v5-shell
playwright.config.js                E2E_SKIP_V5
e2e/v5.spec.js                      browser acceptance (not run)
frontend/v5/index.html, main.js, tech.html, tech.js, package.json
frontend/v5/core/   usenet.js archive.js layout.js physics.js companion.js toys.js game.js i18n.js
frontend/v5/render/ kit.js study.js town.js scenes.js people.js people-p4.js audio.js
frontend/v5/data/   skylark-backup.spool mirror.oldnet.example.spool groups.archive.example.mbox
                    variant-missing-plank.spool edition-present.txt drafts-unsent.txt README.txt
test/v5-bot.mjs, test/v5-core.test.mjs
tools/v5-make-archive.mjs, v5-playthrough.mjs, v5-shell-run.mjs, v5-three-shim.mjs
docs/V5-IMPLEMENTATION.md, V5-DEMO-SCRIPT.md, V5-TEST-REPORT.md, v5-evidence/software-preview/
frontend/p5/js/main.js, world-town.js   (the cherry-picked P5 camera tweak only)
```
