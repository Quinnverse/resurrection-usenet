# Resurrection V5 — RC1 acceptance matrix

Branch `feature/resurrection-v5-complete`. Nothing has been merged, deployed, published or submitted.
CI run for this matrix: https://github.com/Quinnverse/resurrection-usenet/actions/runs/44696534992 (commit e3be862).

**Conclusion: RC1 is complete as a build and as a review kit, but it is NOT releasable yet.** Everything that a machine can
check is checked and passes. Everything that needs a real Mac, a real GPU, a real controller or phone, a pair of ears, or
another person has **not been done**: it was impossible in the environment where RC1 was built (a Linux sandbox with no
screen, no GPU and no browser; CI machines draw with software rendering). Those items are listed as NOT TESTED or BLOCKED,
never as passed. The owner’s next steps are at the end.

Status words:

| Word | Meaning |
|---|---|
| **PASS (auto)** | a machine check passed in the CI run above (or the Node suite). Says nothing about a person’s experience |
| **PASS (owner)** | the owner tested it on real hardware and wrote it down. *No row has this yet.* |
| **NOT TESTED** | the tool or procedure exists; nobody has run it on the real thing |
| **BLOCKED** | could not be done in the build environment (no GUI, GPU, Mac browsers, device or person) |
| **FAIL** | tested and broken |

## 1 · The RC1 brief

### 1. Real-device verification

| Item | Status | Evidence / what exists |
|---|---|---|
| Chrome on the Mac: full seven chapters, FPS, memory, load time | **BLOCKED** (no Mac, no GUI) → NOT TESTED | frame-time test (`?bench=`), playtest recorder with per-chapter fps/1% low/heap, hub and procedure (`V5-RC1-DEVICE-TEST.md` §1–2). The whole game does play to the credits in Chromium on a software renderer, both languages (PASS (auto)); that is not a GPU result. |
| Safari: start, move, interact, save, key chapters, ending | **BLOCKED** → NOT TESTED | `V5-RC1-DEVICE-TEST.md` §2. A static text search found no feature Safari lacks; CSS has fallbacks (`dvh`, prefixed blur). Not a test. |
| Firefox (if installed) | **BLOCKED** → NOT TESTED | same procedure |
| Performance at each quality level | tool: **PASS (auto)**; numbers: **NOT TESTED** | the frame-time test runs at low / medium / high and produces its report in Chromium (2 levels × 2 scenes in CI, and from a single file); the numbers are software-rendered and are not reported as performance |
| Record: device, browser version, resolution, average FPS, 1% low FPS, max memory, severe stalls | tool: **PASS (auto)**; values: **NOT TESTED** | report columns and the JSON hold all of them; heap only where the browser reports it (Chrome), otherwise read the system monitor (`V5-RC1-PERF.md`) |
| CI software-rendering numbers are not presented as GPU results | **PASS** | `V5-RC1-PERF.md` section B is labelled; the hub warns when it detects software rendering |

### 2. Input devices

| Item | Status | Evidence |
|---|---|---|
| Keyboard and mouse: whole game | **PASS (auto)** with synthetic events; human feel NOT TESTED | whole game with only keyboard and mouse in Chromium (CI job kbm) |
| Gamepad: all menus, dialogue, pause, save and the ending | **PASS (auto)** with a simulated pad; **real controller NOT TESTED** | whole game and every menu with only a simulated standard pad (CI job pad). The hub detects a real pad, shows its name and mapping, and lights the pressed buttons: PASS (auto) with the simulated pad |
| Real connected controller | **BLOCKED** → NOT TESTED | `V5-RC1-DEVICE-TEST.md` §4 |
| Phone over the local network: touch, portrait and landscape, performance, operation | **BLOCKED** → NOT TESTED | `npm run v5:lan` serves the pages to the local network (tested: the server only serves the game files, read-only). Emulated touch screens at 390×844, 844×390, 320×568 and 568×320 play the whole game (CI job touch) and pass layout checks: buttons and menus inside the screen, no overlap, Resume reachable, the picture and buttons re-fit after a rotation (PASS (auto)). No real phone has been used |
| Key remapping: conflicts, saving, reset to defaults | **PASS (auto)** | swap on conflict, reserved keys refused, Esc cancels, kept after reload, damaged settings repaired, reset (Node tests and Chromium) |

### 3. Sight and sound

| Item | Status | Evidence |
|---|---|---|
| Openable previews of the key scenes: Elena and June on the train, the coast ride, the lighthouse together, night music, the 2004 standoff, the first snow | **PASS (auto)** | hub section 2 (`/v5/rc`, `Resurrection-V5-RC.html`); each card opens the live scene (`?preview=`), tested for all seven scenes in Chromium including that the real save is untouched; real-browser screenshots in `docs/v5-evidence/rc1/` |
| The owner has looked at the live scenes | **NOT TESTED** | `V5-RC1-DEVICE-TEST.md` §5 |
| Listening entry for the original music | **PASS (auto)** | `/v5/audio`, `Resurrection-V5-Audio.html`: every theme (8 s or looped) and effect, verdict and notes, link to the scene |
| Audio quality is **not** claimed from levels | **PASS** | the page, the checklist and the report say the numbers only show that sound is produced |
| Someone has listened to the music | **NOT TESTED** | nobody has |

### 4. Playtest preparation

| Item | Status | Evidence |
|---|---|---|
| Instructions that need no development environment: how to start, controls, duration, feedback | **PASS (auto)** for the files; usability NOT TESTED | `resurrection-v5-playtest.zip`: `START-HERE.html` (EN/中文), `Resurrection-V5-Playtest.html` (one file, double-click), `feedback-form.html`. The single file runs in Chromium from disk with no network request (PASS (auto)); other browsers NOT TESTED |
| Automatic chapter start and end times | **PASS (auto)** | recorder keeps real play time and clock start/end per chapter |
| Stuck, pause, skip and exit statistics | **PASS (auto)** | idle stretches, hints, retries, pauses (count and time), skipped lines, page exits and tab switches; summary tool prints them |
| Voluntary feedback on story and feeling | **PASS (auto)** | 1–5 and one sentence after each chapter (skippable) and the optional form, every question optional |
| No personal data collected, nothing uploaded without consent | **PASS (auto)** | nothing is recorded before Start or Continue, the title says what is recorded, the single-file playtest page made no network request in the browser test, no name or contact asked, “Delete my playtest record” in the pause menu |
| The owner plays once first, then others are invited | **NOT DONE** | `playtest/SESSION-LOG-TEMPLATE.md` has the owner’s section; no session has been run and `RESULTS.md` is empty by design |

### 5. P5

| Item | Status |
|---|---|
| `V5-P5-BASELINE.md` kept and extended | done |
| P5 history reported separately from V5 | yes: the P5 job is not part of the V5 acceptance |
| P5 tests deleted or disabled to get a green run | **no**: the job still runs and still fails the same 5 of 10 tests with the same 5 errors as before V5 existed (`V5-P5-BASELINE.md`) |
| P5 repair | a separate maintenance task; does not block V5 RC1 |

### 6. RC1 delivery

| # | Deliverable | Where |
|---|---|---|
| 1 | One-command local start | `npm run v5` (Mac: double-click `start-v5.command`); phone: `npm run v5:lan`; or open `Resurrection-V5-RC.html` from the zip (`npm run v5:rc`; CI artifact `resurrection-v5-rc1-package`) |
| 2 | Real-browser preview | the hub and its seven live scenes; screenshots from real Chromium (software GPU, labelled) in `docs/v5-evidence/rc1/`; a preview on your own GPU needs you to open the hub |
| 3 | Performance report | `V5-RC1-PERF.md`: definitions, what CI measured (software, labelled), and empty tables for the owner’s Mac, browsers and phone |
| 4 | Original-music listening entry | `/v5/audio`, `Resurrection-V5-Audio.html`, `V5-AUDIO-CHECKLIST.md` |
| 5 | Playtest record template | `playtest/SESSION-LOG-TEMPLATE.md`, `playtest/feedback-form.html`, `PLAYER-SHEET.md`, `RESULTS.md` (empty) |
| 6 | Release-blocker list | `V5-RC1-BLOCKERS.md` |
| 7 | RC1 Git commit | on the branch (commit shown at the end of the final report) |
| 8 | Final acceptance matrix | this file |

## 2 · Automated results behind the PASS (auto) rows

| Check | Result |
|---|---|
| `npm test` | 243 / 243 pass (229 earlier tests plus 14 for RC1: key bindings, frame-time statistics, the recorder, preview saves, the single-file bundle, the server) |
| Node shell: EN and ZH full game, tech page, the single-file bundle full game, previews, frame-time tour, three input devices | all pass |
| Chromium, V5 main job (title, every beat, Tab, whole game EN and ZH, remap, touch, gamepad menus, keyboard menus, audio, tech, regression) | MAINV5 |
| Chromium, RC1 job (6 tests: remap, previews, frame-time tour, hub and gamepad monitor, single files from disk, touch layout with rotation) | 6 / 6 pass |
| Whole game with only keyboard and mouse / only a gamepad / only touch | all three pass (562 s / 537 s / 539 s of game time) |
| Container smoke, authoritative suite, main browser suite | pass |
| P5 job | 5 of 10 fail, identical to the baseline (separate, not a V5 result) |

## 3 · Found and fixed while preparing RC1

See the last table of `V5-RC1-BLOCKERS.md`: key conflicts and Esc binding, hint text overlapping subtitles, touch buttons
over the title and menus, the recorder starting before consent, the recorder switch persisting, panels exceeding phone height.

## 4 · What the owner does next

1. Open `Resurrection-V5-RC.html` (or `npm run v5`) on the Mac and follow `V5-RC1-DEVICE-TEST.md`: frame-time test in Chrome and Safari (and Firefox), one full play with the recorder, the key scenes, the music.
2. Plug in a controller and test with the hub’s monitor, then a phone with `npm run v5:lan`.
3. Fill in `V5-RC1-PERF.md`, mark the rows above PASS (owner) or FAIL, add problems to `V5-RC1-BLOCKERS.md`.
4. Play once yourself, then invite 5–8 others with `resurrection-v5-playtest.zip`.
5. Decide on release only after B1–B6 in the blockers list are closed or accepted. Merging, deployment and any submission remain yours to approve.
