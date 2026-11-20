# Resurrection V5 — RC1 acceptance matrix (final archive)

Branch `feature/resurrection-v5-complete`. Nothing has been merged, deployed, published or submitted.

## Result

| | |
|---|---|
| **RC1 AUTOMATED** | **PASS** (V5). All V5 automated checks pass. The only red job in the workflow is the P5 slice, a historical baseline failure that is not a V5 result (below). The workflow as a whole is **not** all green. |
| **RC1 MANUAL** | **NOT TESTED**. No person has played, listened or measured on real hardware. |
| **RELEASE READY** | **NO**. Blockers B1–B6 in `V5-RC1-BLOCKERS.md` are open. |

### Which commit was tested by which run

| Run | Commit | What ran | Result |
|---|---|---|---|
| [44708590327](https://github.com/Quinnverse/resurrection-usenet/actions/runs/44708590327) — **the full run** | `0983c38` | all 9 jobs | 8 pass, P5 fails (details below) |
| [44758500485](https://github.com/Quinnverse/resurrection-usenet/actions/runs/44758500485) — the last code push | `b78e03b` | the “did the game change?” job, npm tests, container smoke and the RC1 browser job (7 tests). The four long jobs were **skipped on purpose**: the push changed no game file | 4 pass, 4 skipped |
| *(no CI run required)* | the commit that adds this file, the release folder and the documents | documents and release files only | the light jobs run again; no game file changes |

**What “skipped” means here.** Between `0983c38` and `b78e03b` ten files changed: the workflow, the RC1 tests, the start page
(`home.html`, `home.js`), the review hub (`rc.html`, `rc.js`) and three tools (`v5-bundle`, `v5-rc-pack`, `v5-serve`).
`git diff 0983c38 b78e03b` touches **none** of `main.js`, `index.html`, `playtest.js`, `core/`, `render/`, `data/`, `combined-server/`,
`e2e/v5.spec.js`, the bot, the device drivers or `package.json`. So the whole-game results from run 44708590327 stand for the game
code in the RC1 package, and are **not** claimed for anything newer. The long jobs run again by themselves whenever a game file changes,
on every pull request, and by hand (`workflow_dispatch`).

### The full run, 44708590327 (commit `0983c38`)

| Job | Result | Evidence in the log |
|---|---|---|
| V5 main browser job | **PASS** 14 / 14 (1.2 h) | title, every beat from its save, Tab on the pier, **whole game EN**, **whole game ZH**, key remapping, touch, gamepad menus, keyboard menus, audio signal, tech demo, regression of `/`, `/p3/`, `/p4/` |
| Whole game with only keyboard and mouse | **PASS** | `V5_DEVICE kbm ok game=562s`, credits left with Enter, save = `end` |
| Whole game with only a gamepad (simulated) | **PASS** | `V5_DEVICE pad ok game=537s` |
| Whole game with only touch (emulated) | **PASS** | `V5_DEVICE touch ok game=539s` |
| RC1 review pages and packages | **PASS** 6 / 6 | remap rules, key-scene previews, frame-time tour, hub and gamepad monitor, single files from disk, touch layout with rotation |
| Authoritative suite (`npm test`) | **PASS** | 243 tests at that commit |
| Browser end-to-end (general) | **PASS** | |
| Container smoke | **PASS** | |
| **P5 slice** | **FAIL** 5 of 10 | the same 5 tests with the same 5 errors as before any V5 work (see “P5”) |

### The last code push, 44758500485 (commit `b78e03b`)

| Job | Result |
|---|---|
| Did the game change? | `game=false` (“changed outside the light paths: none”) |
| `npm test` | **PASS** (245 tests: the 243 plus tests for the start page links, the feedback form and the no-network promise) |
| V5 RC1 review pages and packages | **PASS** 7 / 7, including the new start-page test (6 doors, English and Chinese, saves, technical demo restore, music page, key scenes, feedback form file download, playtest page, **no network request**). It also runs the Node shell harness: EN and ZH full game, the single-file build full game, previews, frame-time tour |
| Container smoke | **PASS** |
| Long browser jobs (V5 main, 3 devices, general, P5) | **skipped**, see above |

### P5 (reported separately from V5)

`Browser end-to-end, P5 slice` fails 5 of 10 tests (full playthrough EN, Chinese chapter, phone touch, hints and safe-spot menu,
reduced motion and settings) with the same five error messages on the P5 branch (`1c6cb0b`), on the V5 branch point
(`f69fa3b`, no V5 code) and on every V5 run since. Table of runs: `V5-P5-BASELINE.md`. V5 does not change P5 files. P5 tests were not
deleted, skipped or weakened; they were not run in `b78e03b` because the push touched no P5 or game file. Repairing P5 is a separate
maintenance task and does not gate V5 RC1.

## Status words

| Word | Meaning |
|---|---|
| **AUTOMATED PASS** | a machine check passed in the runs above. Says nothing about a person’s experience |
| **MANUAL PASS** | a person tested it on real hardware and wrote it down. **No row has this yet** |
| **NOT TESTED** | the tool or procedure exists; nobody has run it on the real thing |
| **BLOCKED** | could not be done in the build environment (a Linux sandbox with no screen, GPU, Mac browsers, controller, phone or other person) |
| **FAIL** | tested and broken |

## 1 · The RC1 brief

### Real-device verification

| Item | Status | Evidence / what exists |
|---|---|---|
| Chrome on the Mac: full seven chapters, FPS, memory, load time | **BLOCKED** → NOT TESTED | frame-time test, playtest recorder, start page, procedure `V5-RC1-DEVICE-TEST.md` §1–2. The whole game plays to the credits in Chromium with a software renderer in both languages (AUTOMATED PASS); that is not a GPU result |
| Safari: start, move, interact, save, key chapters, ending | **BLOCKED** → NOT TESTED | procedure §2; a text search of the code found nothing Safari lacks, CSS has fallbacks. Not a test |
| Firefox | **BLOCKED** → NOT TESTED | same |
| Performance per quality level | tool AUTOMATED PASS; numbers NOT TESTED | the CI numbers are software-rendered (a few frames per second, about 2–15) and are not reported as performance |
| Record: device, browser version, resolution, average FPS, 1% low FPS, max memory, severe stalls | tool AUTOMATED PASS; values NOT TESTED | `V5-RC1-PERF.md` has the definitions and empty tables |

### Input devices

| Item | Status | Evidence |
|---|---|---|
| Keyboard and mouse, whole game | AUTOMATED PASS with synthetic events; feel NOT TESTED | job kbm |
| Gamepad: all menus, dialogue, pause, save, ending | AUTOMATED PASS with a simulated pad; **real controller BLOCKED → NOT TESTED** | job pad; the hub detects a real pad (name, mapping, live buttons): AUTOMATED PASS with the simulated one |
| Phone over the local network: touch, portrait/landscape, performance | AUTOMATED PASS for an emulated touch screen at 390×844, 844×390, 320×568, 568×320 (whole game; layout; rotation); **real phone BLOCKED → NOT TESTED** | job touch, RC1 job; `npm run v5:lan` serves only the game files, read-only (tested) |
| Key remapping: conflicts, saving, reset | AUTOMATED PASS | swap on conflict, reserved keys refused, Esc cancels, kept after reload, damaged settings repaired |

### Sight and sound

| Item | Status | Evidence |
|---|---|---|
| Previews of the key scenes (train, coast ride, lighthouse, porch at night, 2004 beach, first snow, and the duet) | AUTOMATED PASS | start page → “Key scenes”; each opens the live scene and leaves the real save alone; real-browser screenshots in `docs/v5-evidence/rc1/` |
| The owner has looked at the live scenes | NOT TESTED | procedure §5 |
| Listening entry for the original music | AUTOMATED PASS | `Resurrection-V5-Audio.html`, `/v5/audio` |
| Audio quality | **NOT TESTED** | nobody has listened; level numbers are not a quality claim |

### Playtest preparation

| Item | Status | Evidence |
|---|---|---|
| Instructions that need no development environment | AUTOMATED PASS for the files; usability NOT TESTED | `resurrection-v5-playtest.zip`: `START-HERE.html`, `Resurrection-V5-Playtest.html`, `feedback-form.html`; opened from disk in Chromium with no network request |
| Automatic chapter start and end times; stuck, pause, skip and exit statistics | AUTOMATED PASS | recorder fields tested in Node and Chromium |
| Voluntary feedback on story and feeling | AUTOMATED PASS | one-sentence and 1–5 answers after each chapter (skippable); the form, every question optional |
| No personal data, nothing uploaded | AUTOMATED PASS | nothing recorded before Start or Continue; the title says what is recorded; the form and the game contain no network code (unit test); no network request in the browser test; “Delete my playtest record” |
| The owner plays once, then others | **NOT DONE** | `playtest/SESSION-LOG-TEMPLATE.md`; `playtest/RESULTS.md` is empty by design |
| Measured play time | **NOT MEASURED** | the 27–37 minute figure is an **estimate** (EN 28–37, ZH 27–35) from a model; the bot’s virtual game time is about 9 minutes and is not human time |

## 2 · Delivery

| # | Deliverable | Where (verified to exist) |
|---|---|---|
| 1 | Start it with one action | double-click `Resurrection-V5-Start.html` from `release/v5-rc1/resurrection-v5-rc1.zip`; or `npm run v5` (Mac: double-click `start-v5.command`); phone: `npm run v5:lan` |
| 2 | Real-browser preview | the start page → key scenes; screenshots from real Chromium (software GPU, labelled) in `docs/v5-evidence/rc1/` |
| 3 | Performance report | `V5-RC1-PERF.md` |
| 4 | Original-music listening entry | `Resurrection-V5-Audio.html`, `/v5/audio`, `V5-AUDIO-CHECKLIST.md` |
| 5 | Playtest record templates | `playtest/SESSION-LOG-TEMPLATE.md`, `playtest/feedback-form.html`, `PLAYER-SHEET.md`, `RESULTS.md` |
| 6 | Blocker list | `V5-RC1-BLOCKERS.md` |
| 7 | RC1 Git commit | see the final report; the package was built from `b78e03b` |
| 8 | This matrix | this file |

## 3 · What the owner does next

1. Unzip `release/v5-rc1/resurrection-v5-rc1.zip` and open `Resurrection-V5-Start.html` on the Mac. Follow `V5-RC1-DEVICE-TEST.md`.
2. Play the game once, listen to the music, look at the key scenes and the characters, write down stalls and problems.
3. Frame-time test in Chrome and Safari (and Firefox) and fill `V5-RC1-PERF.md`; try a controller and a phone.
4. Then invite 5–8 others with `resurrection-v5-playtest.zip`.
5. Merging, deployment and any submission remain yours to approve.
