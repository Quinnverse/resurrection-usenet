# Resurrection V5 — acceptance report

Branch `feature/resurrection-v5-complete`, pushed to GitHub. Nothing was merged, deployed, published or submitted.
CI run for this report: https://github.com/Quinnverse/resurrection-usenet/actions/runs/44567880188 (commit e40b4ca).

Status words:
- **COMPLETE**: built, and an automated test exercises it where it matters.
- **PARTIAL**: built, but part of the requirement is missing or below target.
- **NOT TESTED**: built, but nothing has checked it where it matters (a person, a speaker, a real device, a real GPU).
- **BLOCKED**: could not be done in this environment.

## Conclusion

**Not release-ready.** All automated checks pass, and keyboard and mouse, gamepad and touch can each finish the whole
game on their own in automated runs. But no person has played it, nobody has listened to the audio, and no real
controller, phone or GPU has been used. Those are the release conditions; the automated results do not replace them.

## RC1 (release candidate 1)

RC1 adds no story. It adds the means to judge the game on real hardware and with real people, and fixes what that
preparation turned up. **It is still not releasable**: the real-device, listening and playtest items are open.
Read `V5-RC1-ACCEPTANCE.md` (the matrix), `V5-RC1-BLOCKERS.md` (what is open and who closes it) and `V5-RC1-README.md`
(how to start it). Automated results for RC1 are in the acceptance matrix; the sections below remain the record of the
earlier verification round.

What RC1 added: the review hub with seven live key-scene previews, a frame-time test (average and 1% low FPS, stalls,
load times, draw calls, memory where reported), single-file builds that open from disk, a local server with a phone mode,
key remapping with conflict handling, a consent-first playtest recorder and a player folder that needs no development
environment, and touch layout checks in portrait, landscape and after a rotation.

## 1. Automated (run by machines; results from CI and the Node shell)

### Node

| Check | Result |
|---|---|
| `npm test` (229 tests, 32 of them V5) | 229 / 229 pass, locally and in CI |
| `npm run test:v5-shell` (the real `main.js` and every render module in Node with a fake DOM; the bot plays the whole game; EN and ZH with different choices; tech page) | pass: 0 shell errors, 0 missing translations, 10 album pictures with images, save at `end` reloads |
| `node tools/v5-shell-run.mjs --device kbm / pad / touch` | all three finish the whole game (game time 562 s / 540 s / 539 s) |

### Chromium (CI run 44567880188, software GPU, SwiftShader)

| Job | Result |
|---|---|
| Authoritative suite, container smoke | pass |
| **Browser end-to-end, V5 full game** | **14 / 14 pass** (title and settings with real keys; all 20 beats from saves; Tab on the pier; the whole game EN and ZH to the credits; key remapping; touch; gamepad-only menus, new-game confirm, pause, settings, save and Continue; keyboard-only menus and number-key choices; audio page; tech demo; regression of `/`, `/p3/`, `/p4/`) |
| **Whole game with only keyboard and mouse** | pass: all seven chapters, credits, save = `end`, leaves the credits with Enter |
| **Whole game with only a gamepad** | pass (ZH, other choices): same checks, leaves the credits with A |
| **Whole game with only touch** (844×390 emulated touch screen) | pass: same checks, leaves the credits by tapping |
| Browser end-to-end (main suite) | pass |
| Browser end-to-end, P5 slice | **fails: 5 of 10 tests**, identical to the baseline (see below) |

What "whole game with one device" means: a scripted player turns its logical input into that device's own state
(a simulated `navigator.getGamepads` pad, synthetic key and mouse events, synthetic touch events and button taps).
The game reads that state through its normal input and menu code; no game input is injected (`test/v5-devices.mjs`).
This proves that every action in the game, including dialogue choices, menus, pause and resume, can be done with that
device and cannot dead-end. It does not prove that it feels good, or that real hardware behaves like the simulation.

Wall time of these CI jobs (54, 14 and 12 minutes) is the test machine at 5–15 fps, not player time.

### Bugs found by playing with one device, and fixed

- Gamepad: only the first dialogue choice worked (edges were computed only when polled); no way to leave the pause menu
  or use any menu; native `window.confirm` for New game could not be answered (now an in-page box).
- Keyboard: menus had no arrow-key navigation; number keys did not pick dialogue choices.
- Touch: no era-switch or hint button; touch buttons only appeared after the first touch.
- Level: a strip with no floor between the point path and the lighthouse; Theo standing in the pier-foot path; the
  suitcase prompt hidden behind June's; letter and game-box prompts overlapping; walls and edges now slide at an angle.

### P5 baseline

The P5 slice fails the same 5 tests with the same 5 errors on the P5 branch (1c6cb0b), on the V5 branch point
(f69fa3b, no V5 code) and on every V5 run since. It is not a V5 regression. Details and run ids: `docs/V5-P5-BASELINE.md`.
Not fixed, by instruction.

### Performance (CI, SwiftShader; 23 samples across the beats)

| Measure | Value | Note |
|---|---|---|
| Frame rate | 5–15 fps; average frame 93–207 ms; worst frame 2.0–3.5 s | software rendering on a 2-core runner. Says nothing about real GPUs. The 30 fps target is **NOT TESTED** on hardware. Automatic quality drop below 24 fps exists. |
| JS heap | 11–34 MB | no growth across beats |
| Failed requests, console errors | 0 | all tests |

### Audio signal (CI, `/v5/audio`; signal only)

10 themes: RMS 0.006–0.026, peak up to 0.139. 41 effects: RMS 0.0002–0.061, peak up to 0.199. No clipping, every
AudioContext ran. This says the sound is produced at a sensible level. It says nothing about whether it sounds good.

### Play time (estimate, not measured)

Bot playthrough: 535–562 s of game time. `tools/v5-estimate.mjs` (reading time plus bot time × 1.6–2.8): **EN 28–37 min,
ZH 27–35 min**, middle 33 and 31. This is an estimate. The 35–45 minute target is reached only at the slow end, and no
time was added by slowing movement or lengthening waits.

## 2. Manual / by people

**None.** No person has played the build, no blind playtest has taken place, and `docs/playtest/RESULTS.md` records no
sessions. The playtest kit (`docs/playtest/`, `dist/resurrection-v5-playtest.zip` via `tools/v5-playtest-pack.mjs`,
recorder in `/v5/?playtest=1`) is ready to use. The developer looked at the CI screenshots below; that is a developer
review, not a playtest.

### Key-line screenshots (chapters 2, 4, 6, 7)

`docs/v5-evidence/key-lines/` (50 files, EN and ZH, run 44567880188). Reviewed by the developer:
- Ch 2: June's face on the train is clear, readable expressions ("You're the view, Elena.", the sleeping-photo line).
- Ch 4: June on the night beach was backlit and hard to read; a soft face light was added for dialogue close-ups
  (a9a3358) and the final frame shows her face. The poem line credits Bai Juyi's 《琵琶行》.
- Ch 6: June's faces on the 2004 beach carry the hurt and restraint ("You answered.", "Take care on the road."); close-ups
  are a little stiff.
- Ch 7: the drafts card is readable; Theo and Elena at the pier end are framed side by side with the snow and the lighthouse.
The characters stay a simple low-poly style; close-ups do not carry fine facial acting.

Other screenshots: `docs/v5-evidence/browser/` (earlier run 44466876584, 72 frames) and `docs/v5-evidence/devices/`
(gamepad, touch and menu frames, run 44528076000).

## 3. Unverified (nobody or nothing has checked these)

| Item | Why it is open |
|---|---|
| Whether people can play, understand and finish the game; fun, clarity, emotional effect | no blind playtest |
| Real first-play time | estimate only |
| Audio quality and the balance of music and effects | nobody has listened; checklist in `docs/V5-AUDIO-CHECKLIST.md`, page `/v5/audio` |
| 30 fps and memory on real GPUs, low-end laptops, phones | CI has a software GPU only |
| A real gamepad (other brands, non-standard mapping, vibration) | only a simulated standard pad |
| A real phone or tablet (portrait, small screens, multi-touch feel) | only an emulated touch screen |
| Firefox, Safari, Edge | only Chromium |
| Feel of movement, camera, bike, beam, pen and tuning | needs people |
| Chapter 2/4/6/7 acting as seen by someone outside development | developer review only |

Gamepad and touch are therefore marked **experimental** in `docs/V5-RELEASE-NOTES.md`; keyboard and mouse and key
remapping are marked supported on the basis of the automated runs and real Playwright key presses.

## Requirements

### Story: COMPLETE (automated checks)

All seven chapters are playable start to end in both languages in real Chromium; every required line is present, both
branches of the ch 6 and ch 7 choices work, and the 1998 and 2004 snapshots are unchanged by the present-day edits
(tested). Full bilingual script: `docs/V5-SCRIPT.md`.

### Gameplay and controls

| Item | Status |
|---|---|
| A distinct activity in every chapter; June's state machine; Restore / Revive / Rewind / Recompose | COMPLETE |
| Keyboard and mouse, whole game | COMPLETE (automated); feel NOT TESTED |
| Key remapping | COMPLETE (automated) |
| Gamepad, whole game and every menu | COMPLETE with a simulated pad; real hardware NOT TESTED |
| Touch, whole game and menus | COMPLETE with an emulated touch screen; real devices NOT TESTED |
| Saves and Continue | COMPLETE (every beat, in Chromium, and from the pad) |

### Art and audio

| Item | Status |
|---|---|
| All scenes render in WebGL, 1998 / 2004 / present / winter | COMPLETE (screenshots) |
| Characters: faces, blinking, per-line expressions, poses | PARTIAL: simple low-poly, stiff in some close-ups |
| Audio plays at a sensible level | COMPLETE (signal only) |
| Audio sounds good | **NOT TESTED** |
| English and 简体中文 | COMPLETE (both played to the end in a browser) |

## Known issues

1. No human has played V5.
2. Estimated time 28–37 min (EN), around or below the 35–45 target; unmeasured.
3. Audio unheard.
4. Characters are stylised and simple.
5. 30 fps on real hardware not measured.
6. Gamepad and touch rest on simulations.
7. The optional "source" chip at the top right still needs a pointer; it is never needed to finish the game.
8. The P5 browser job fails the same way as before V5 and is not touched by V5.

## Before a release (needs the owner)

- [ ] Blind playtest with 5–8 strangers (`docs/playtest/README.md`); adjust length only from what they report.
- [ ] Listen to every theme and effect on speakers and headphones (`docs/V5-AUDIO-CHECKLIST.md`).
- [ ] Try a real controller and a real phone or tablet; check frame rate on a low-end GPU.
- [ ] Decide what to do about the failing P5 job.
- [ ] Review the credits, the poem attribution and the fixture labels.
- [ ] Merge, deploy and any submission: only with the owner's approval.

## Commits of this round (after 992e055)

6734153 playtest kit, audio page, F3 overlay, touch buttons · 49a61e9 per-line acting, gamepad choices and pause ·
393d403 input closed loop for every device, device drivers, CI matrix · ef46f77 CI YAML fix · e48dfe7 touch UI from the
start, device test fixes, P5 baseline, release notes · a9a3358 face light in close-ups · e40b4ca test clock fix
(this report and the evidence follow).
