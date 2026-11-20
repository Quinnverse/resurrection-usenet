# RC1 — release blockers and open issues

A **blocker** is something that must be settled before V5 is called releasable. Most blockers here are not bugs: they
are things nobody has been able to check because RC1 was built in a sandbox with no screen, GPU or real browsers, and
without any other person. Each says who can close it and how.

Severity: **Blocker** (must be closed or consciously accepted before release), **Major** (should be fixed or accepted),
**Minor** (note it). Status: OPEN, CLOSED (with evidence), ACCEPTED (owner decision).

## Blockers

| ID | Problem | Why it matters | Close it by | Status |
|---|---|---|---|---|
| B1 | **No frame rate or memory measurement on a real GPU.** The only numbers are 5–15 fps from a software renderer on a CI machine. The 30 fps target is unverified. | The game may stutter on the owner’s Mac, or be fine; nobody knows. | The owner runs the frame-time test in Chrome, Safari (and Firefox) and plays through once with the recorder (`V5-RC1-DEVICE-TEST.md` §1–3); results go in `V5-RC1-PERF.md`. If *high* is below 30 fps 1% low on the target machine, choose a lower default or fix the slow scene. | OPEN |
| B2 | **No person has played the game.** No measured play time (estimate 28–37 min EN against a 35–45 min target), no check that players understand June, 2004 and the ending, no stall data. | The release thresholds in `V5-PLAYTEST-PLAN.md` cannot be evaluated. | The owner plays first (`playtest/SESSION-LOG-TEMPLATE.md`, “Owner”), then 5–8 other players with `resurrection-v5-playtest.zip`. Adjust length only from what they report. | OPEN |
| B3 | **Nobody has listened to the music and sound.** Only signal levels were measured (no clipping, peaks up to 0.2 of full scale). | Level numbers do not say whether it sounds good, balanced or intrusive. | The owner listens through `Resurrection-V5-Audio.html` on speakers and headphones, and in the six scenes (`V5-AUDIO-CHECKLIST.md`). | OPEN |
| B4 | **Safari and Firefox have never been run.** A text search of the code found no use of features they lack, and the CSS has fallbacks for older Safari (`-webkit-backdrop-filter`, `dvh`). That is not a test. | If Safari is a target, it may not start, or audio, pointer lock, full screen or saving may behave differently. | `V5-RC1-DEVICE-TEST.md` §2 in Safari (and Firefox). | OPEN |
| B5 | **Gamepad and touch rest on simulations.** A simulated standard pad and an emulated touch screen play the whole game in Chromium. No real controller, phone or tablet has been used. | Real devices differ: other layouts, thumb reach, notches, browser bars, iOS audio rules. | `V5-RC1-DEVICE-TEST.md` §4. Until then both stay “experimental” in the release notes. | OPEN |
| B6 | **Key scenes have not been judged on a real display.** Faces, framing, lighting and music in the six key scenes were reviewed by the developer from software-rendered screenshots only. | Whether the emotional scenes land is the point of the game. | The owner reviews the live scenes from the hub (`V5-RC1-DEVICE-TEST.md` §5). | OPEN |

## Major

| ID | Problem | Notes | Status |
|---|---|---|---|
| M1 | Characters are simple low-poly figures; some close-ups are stiff. | Improved for chapters 2, 4, 6, 7 (per-line faces, resting lids, face light in close-ups). Whether it is good enough is the owner’s call (B6). | OPEN |
| M2 | Single html files and local storage. Browsers share one storage between all local files, and some (Safari, Firefox) may separate or refuse it. | Saves, settings and the frame-time report depend on it. The playtest file uses its own keys. If a browser refuses, use `npm run v5`. | OPEN until B4 is tested |
| M3 | The frame-time test measures drawing with the game logic frozen and a moving camera. It does not include the cost of walking, physics or the bike. | Good for comparing quality levels and scenes; an in-play stutter shows up only in the playtest log (frame histogram) and F3. | ACCEPTED as a limit of the tool |
| M4 | JS memory is only reported by Chrome-based browsers. | Safari and Firefox need the system monitor (`V5-RC1-DEVICE-TEST.md` §1). | ACCEPTED |
| M5 | Phone use over the local network needs the server (`npm run v5:lan`); the single html files cannot be opened from a phone directly. | A deployed copy would remove this, but deployment is not allowed in RC1. | ACCEPTED |

## Not a V5 blocker

| ID | Problem | Notes |
|---|---|---|
| P5-1 | The CI job “Browser end-to-end, P5 slice” fails 5 of 10 tests. | It failed identically before any V5 work and on every V5 run since (`V5-P5-BASELINE.md`). V5 does not touch P5. P5 tests were neither deleted nor disabled. Fixing P5 is a separate maintenance task and does not gate V5 RC1. Reported separately from the V5 acceptance in `V5-RC1-ACCEPTANCE.md`. |

## Found and fixed during RC1

| What | Where it was found | Fixed in |
|---|---|---|
| A key could be bound to two actions, and Esc (or F-keys, 1–3) could be bound to an action although the game always uses them for something else, so that action would never work. | code review for the remap check | `core/keymap.js`, settings UI; tested in Node and Chromium |
| The control hint overlapped the subtitle name during the coast ride. | CI screenshot of chapter 3 | `index.html` |
| The touch buttons showed through the title and the pause menu, overlapping “Start”. | CI screenshot at 320×568 | buttons hidden outside play (`main.js`, `index.html`) |
| The playtest recorder created and saved a log, and read device details, as soon as the page opened, before the player agreed. | review against “no recording without consent” | `playtest.js`, title notice |
| The recorder switch persisted in browser storage, so the normal game page could start recording after a playtest page was used. | review | recorder is on only for the playtest page or `?playtest` |
| Panels could exceed the visible height on phones (`vh`) and had no prefixed blur on older Safari. | static review | `index.html` |

## New problems found by the owner

Add rows here: what, where, how to reproduce, severity, status.

| ID | What | Where | Severity | Status |
|---|---|---|---|---|
| | | | | |
