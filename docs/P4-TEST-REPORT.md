# P4 test report

**Automated tests passing does not mean the game experience passes.** Everything below comes from a scripted player in headless Chromium on a GitHub Actions runner. No person has played this build yet. The open questions are listed under "Not verified".

## What was run

| Suite | Where | Result |
|---|---|---|
| `npm test` (Node, includes `test/p4-core.test.mjs`) | local sandbox and CI | 169/169 |
| `e2e/p4.spec.js` (Chromium, WebGL through SwiftShader) | CI, browser job | see table below |
| `e2e/investigation.spec.js`, `e2e/p3.spec.js` (older versions) | CI, same job | all pass: `/` and `/p3/` unchanged |
| Container smoke | CI | pass |

CI run: [actions/runs/44312661947](https://github.com/Quinnverse/resurrection-usenet/actions/runs/44312661947) on commit `45dc303`. All three jobs passed; the browser job ran 28 tests (21 older-version tests and 7 P4 tests) in 21.1 minutes.

### Browser tests

| Test | What the scripted player does | Result |
|---|---|---|
| English, keyboard and mouse | Title, intro, study tutorial (move, look with mouse drag, inspect), KEEP box, photo, computer, archive plaza, skylark's post, gate, Summer Town, Theo, both copies, a wrong restore attempt from the 2004 copy, the correct restore from 1998, Theo lights the lamp, the ending, Continue, reload and resume | pass (10.1 min) |
| Simplified Chinese | Language switch on the title screen, intro skip, study start in Chinese, then a save at the town entrance and the whole town chapter to the Chinese ending | pass (4.8 min) |
| Phone (Pixel 5 size, touch only) | Touch stick and hand button are visible and at least 64 px; no horizontal overflow; finds skylark in the archive and walks through the gate | pass (1.0 min) |
| Autosave and New Game | Walks, waits for the 4 s autosave, reloads, cancels New Game (save kept), continues at the same spot | pass |
| Reduced motion and settings | OS reduced-motion: lines appear whole; sound off and volume 40 survive a reload | pass |
| Tampered save | A save that claims the ending without the restore is repaired to the restore step | pass |
| Older versions | `/`, `/p3/` and `/api/health` still respond | pass |

The scripted player moves only with ordinary input: held W A S D keys steered relative to the camera, mouse drags, pointer events on the touch stick and hand button, E to use. It reads `window.P4Debug.snapshot()` (read-only) to know where it is, the way a person looks at the screen. When a prompt has not appeared at the end of a route, it steps toward the object until it does.

### Times from the English run (automated, not human)

| Milestone | Seconds after pressing Start |
|---|---|
| Objective on screen | 16.6 |
| First discovery (KEEP box read, computer wakes) | 61.4 |
| Archive reached | 103.6 |
| Summer Town reached | 163.4 |
| Lamp restored | 487.0 |
| Lamp lit | 522.6 |
| Ending shown | 551.8 |
| Whole test, including reload and resume | 585.3 |

The test asserts the objective is visible within 30 s and the first discovery happens within 180 s. Most of the time between Summer Town and the restore is the bot walking at about 11 fps and pausing for screenshots: it visits both kiosks, walks to the lighthouse, makes the deliberate wrong attempt from the 2004 copy, and walks back to the 1998 kiosk.

These are bot times on a slow software renderer (about 11 fps, see below), including screenshot pauses. They show the order and that nothing blocks. They say nothing about how long a person needs to understand the goal.

### Frame rate

CI has no GPU. Chromium renders WebGL with SwiftShader on the CPU. The game's adaptive quality stepped down from full quality to 0.75 pixel ratio with shadows refreshed every 4th frame within the first seconds. The play scenes then held 10–16 fps (the record lists the measured value at every step). Real GPUs were not measured; on them the game should stay at full quality, but that is untested.

## Evidence

- Key screenshots (real Chromium frames from the CI run): [`docs/p4-evidence/`](p4-evidence/), listed in [`docs/P4-SCREENSHOTS.md`](P4-SCREENSHOTS.md).
- Operation record: [`docs/P4-PLAYTHROUGH.md`](P4-PLAYTHROUGH.md), a timestamped list of every recorded action with a frame for each (`docs/p4-evidence/record/`).
- Video: Playwright records every browser test. The videos are in the CI artifact `resurrection-browser-evidence` of the run above (`test-results/p4-*/video.webm`), downloadable from the run page on GitHub. They could not be downloaded inside this sandbox, so they were not reviewed here.

## Problems found in real Chromium and fixed

Problems found in the first CI runs, before the passing run:

- The title screen overlay covered the settings buttons, so the language could not be switched before starting.
- On touch devices the stick and hand button only appeared after touching the 3D view.
- Archive post panels faced Mara, not the camera, so posts behind the camera showed mirrored text. The central ring text also showed mirrored through its back.
- The town's first view looked through the back of the dark arrival gate. The spawn point moved forward so the plaza is the first thing seen.
- A palm trunk and a lamp post stood between the camera and Theo on the promenade.
- When the lamp was restored and lit, the camera framed the middle of the tower, so the lamp and beam were off screen. Both moments now cut to a fixed view that shows the whole lighthouse.
- The copy banner said "Copy" twice.
- Test-route issues (not game bugs): route end points just outside reach, a path too close to a corner, and a path through Theo.

## Not verified

- Whether a person understands the goal within 30 seconds, finds the next place without help, makes a meaningful discovery within 3 minutes, notices the before/after change, and wants to know June's story. This needs real playtesters.
- Whether the game is fun, the pacing, and how readable the text is at normal viewing distance.
- Audio quality. The tests only check that sound events fire (`heard` list); nobody has listened to them.
- Firefox, Safari, and Edge. Only Chromium was run.
- Real phones and tablets: touch feel, performance, iOS Safari audio unlock, notches. Only Chromium's phone emulation was run.
- Frame rate on real hardware with a GPU.
- Keyboard layouts other than QWERTY (W A S D; arrow keys also work).

## Known issues

- **Performance is unmeasured on real hardware.** In CI (software WebGL) the game ran at 10–16 fps at reduced quality. Low-end laptops and phones may also drop to reduced quality, which makes text on in-world signs blurrier.
- **Camera.** Thin objects such as lamp posts can still pass between the camera and Mara for a moment; only walls, houses, the lighthouse and palm trunks pull the camera in. Objects are never faded out.
- **Lighthouse cutscene.** The restore and lighting moments use one fixed view from the promenade. While the lamp assembles, some pieces fly in from above the top edge of the frame. If Mara stands on the far side of the tower, the tower hides her during the cutscene.
- **Collision.** Small props (rocks, flower boxes, crates) have no collision; Mara walks through them.
- **Characters.** Animation is procedural and simple (walk, idle, talk, reach, wave). There is no facial animation or lip sync, and the reach pose is stiff.
- **Phones in portrait.** The objective panel takes up a large part of the top of the screen. Looking around uses a drag on the right side, which can conflict with the browser's own gestures on some phones (untested on real devices).
- **Dialogue.** There is no dialogue log; a line skipped by accident cannot be read again, except by inspecting the object again.
- **Look controls.** Looking requires holding the mouse button; there is no pointer lock and no mouse sensitivity setting.
- **Audio.** All sound is synthesized with WebAudio. Nobody has listened to it for quality or volume balance.
- **Scope.** The slice ends at "To be continued · Chapter 2 · June". After the ending the player can walk around Summer Town, but there is nothing new to find there.
- **Saves** live in this browser's `localStorage` only. Private windows may not keep them.
- **The videos** in the CI artifact were not reviewed by the developer, because artifacts cannot be downloaded in the build sandbox. Screenshots and the operation record were reviewed.

## How to run

```
npm start                        # or: node combined-server/server.js; port 3000, Node 20+, no runtime dependencies
```

Open `http://127.0.0.1:3000/p4/`. The older versions are still at `http://127.0.0.1:3000/` (four-act game) and `http://127.0.0.1:3000/p3/` (P3.2).

Tests:

```
npm test                                   # Node suite, includes test/p4-core.test.mjs
npm install && npx playwright install --with-deps chromium   # once, for the browser tests
npx playwright test e2e/p4.spec.js         # P4 browser tests; starts its own server (about 20 minutes on software WebGL)
```

To rebuild the evidence pages from a CI log: `gh api repos/Quinnverse/resurrection-usenet/actions/jobs/<job id>/logs > job.log`, then `node tools/p4-evidence-docs.mjs job.log <run url> <commit>`.
