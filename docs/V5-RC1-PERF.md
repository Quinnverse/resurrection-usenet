# RC1 — performance report

**Status: NOT MEASURED on real hardware.** The environment in which RC1 was built (a Linux sandbox and a CI runner) has no
GPU, no screen and none of Chrome, Safari or Firefox on a Mac. The only frame rates that exist are from a CI machine
drawing with **software rendering**, which says nothing about a real GPU. Do not read section B as performance.

Sections A and C are for the owner to fill in with `V5-RC1-DEVICE-TEST.md`. Leave a cell empty if it was not measured.

## Definitions

| Term | Meaning |
|---|---|
| Avg FPS | frames drawn ÷ seconds, over 8 s after a 2 s warm-up, on a fixed tour: the camera orbits the player, the game logic is frozen, the HUD and the audio run |
| 1% low FPS | 1000 ÷ the mean time of the slowest 1% of frames (at least one frame) |
| p99 ms, worst ms | 99th percentile and largest frame time |
| Hitch / severe stall | a frame over 100 ms / over 250 ms |
| Load ms | from asking for a scene to the second frame after it: building the scene, uploading to the GPU, first draw, shader compilation |
| Heap MB | JS heap (`performance.memory`): Chrome only |
| Draw calls, triangles | what the last frame asked the GPU to draw (`renderer.info`), available in every browser |
| Playtest 1% low | in the playtest log, the same idea but computed from a frame-time histogram, so approximate |
| The 30 fps target | the project’s acceptance target for normal play |

The tour scenes are `1.study` (indoors), `1.town` (the biggest scene), `1.pier`, `2.train`, `3.ride`, `3.beam`,
`4.porch` (night), `6.beach` and `end` (snow). Frame times are measured with `requestAnimationFrame`, so they are limited
by the display’s refresh rate (a 60 Hz display cannot show more than 60 fps) and by browser throttling when the tab is
hidden (the report flags a hidden tab).

## A · Real devices (owner)

### Machine

| | Value |
|---|---|
| Mac model, chip, RAM | |
| macOS | |
| Display, scaling, refresh | |
| Power state | |
| Build (commit) | |

### Chrome (version: ) — frame-time test

Paste the Markdown from the report here.

|  |  |
|---|---|
| | |

### Safari (version: ) — frame-time test

|  |  |
|---|---|
| | |

### Firefox (version: , or “not installed”) — frame-time test

|  |  |
|---|---|
| | |

### Quality levels in play

| Browser | Quality | Looks acceptable? | Holds the refresh rate? | Default for this Mac? |
|---|---|---|---|---|
| | low | | | |
| | medium | | | |
| | high | | | |

### Full play-through (Chrome, playtest log of the owner’s own first play)

| Chapter | Real minutes | Avg fps | 1% low (approx) | Worst frame ms | Max heap MB | Stutter noticed (where) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |

Largest memory seen in the system’s monitor (Task Manager / Activity Monitor / `about:processes`), per browser, after the full play:

| Browser | Process | MB |
|---|---|---|
| Chrome | | |
| Safari | | |
| Firefox | | |

Load time: page opened → title shown (ms), and the longest *Load ms* in the tour:

| Browser | Ready ms | Longest scene load |
|---|---|---|
| | | |

Severe stalls (over 250 ms) during play: where and how often:

## B · CI software rendering (for orientation only, **not a GPU**)

Chromium in GitHub Actions with SwiftShader on a 2-core runner, run 44567880188 (commit e40b4ca), 23 scenes sampled during
the browser tests:

| Measure | Value |
|---|---|
| Frame rate | 5–15 fps (average frame 93–207 ms, worst frame 2.0–3.5 s) |
| JS heap | 11–34 MB, no growth across scenes |
| Console errors, failed loads | 0 |

The RC1 frame-time test also runs once in CI to check that it produces its report; its numbers are software-rendered
too and are in the CI log line `V5_BENCH`, not here.

## C · Phone or tablet (owner)

| Device, OS, browser | Orientation | Quality | Avg FPS | 1% low FPS | Worst ms | Heat or battery notes |
|---|---|---|---|---|---|---|
| | | | | | | |

## D · What the code does to protect performance (static facts, not measurements)

- The quality setting caps the pixel ratio (0.75 on *low*, 1.0 on *medium*, 1.5 on *high*, never above the device’s own ratio), and turns shadows and antialiasing off on *low*.
- If the frame rate stays under 24 fps for 3 seconds, the pixel ratio drops by a quarter (automatic; disabled in the frame-time test so each level is measured as it is).
- Scenes are built when first visited (the first visit costs *Load ms*), then kept.
- The JS heap sampling and the recorder add a few array writes per frame.
- Static scan of the code for features Safari and Firefox lack found none in use (no regex look-behind, `Array.at`, `Object.hasOwn`, top-level await, private fields or `structuredClone`). This is a text search, not a Safari test.
