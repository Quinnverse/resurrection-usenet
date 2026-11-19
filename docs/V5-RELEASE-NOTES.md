# Resurrection V5 — release notes (pre-release, not released)

Branch `feature/resurrection-v5-complete`. This build has **not** been released, deployed or submitted, and does not
yet meet the release conditions in `docs/V5-TEST-REPORT.md`.

## What it is

A narrative 3D browser game in seven chapters, English and Simplified Chinese, about two girls who made a game in
1998 and the daughter who rebuilds it from a fictional USENET archive. All posts, people and places are fictional.
All music and sound are original and generated in the browser.

## Supported

| | Support | How it was checked |
|---|---|---|
| Desktop Chromium (Chrome, Edge) with keyboard and mouse | **supported** | automated Chromium runs, every chapter, both languages |
| Firefox, Safari | expected to work, **not tested** | no automated or manual run |
| Key remapping (Esc → Settings → Keys) | **supported** | automated: a rebound key moves, the old key no longer does, reset restores |
| Gamepad (standard mapping) | **experimental** | only a simulated pad in Chromium (stick moves, Start pauses); never tried on a real controller |
| Touch screens | **experimental** | emulated touch events in desktop Chromium (stick, jump, hold-to-use, pause); never tried on a real phone or tablet; train camera on touch uses two buttons and has not been tried by anyone |
| Low-end GPUs, phones, 30 fps target | **not tested** | only measured on a software GPU (SwiftShader) in CI at 10–12 fps; an automatic quality drop exists |

## Controls

Keyboard and mouse: WASD move, mouse look, Space jump (hold to glide from the windy ledge), Shift sprint, E or left
click interact and continue, hold E for restore/crank/pulley/carving/planks, Tab 1998 ⇄ 2004 in the town, right mouse
or Q to raise the train camera and click to shoot, H hint, Esc pause or skip a dialogue seen before, F3 frame-time
overlay. Gamepad: left stick move, right stick look, A jump/continue, X interact (hold), Y switch era, LT/RT camera,
Start pause, B skip seen dialogue. Touch: left half stick (push far to sprint), right half look, tap to continue,
on-screen jump, interact (hold), camera and shutter on the train, pause.

## Extra pages

- `/v5/tech` — the 3-minute technical demo (archive → parse → manifest → restore → walkable floor).
- `/v5/audio` — the listening check for every theme and sound effect.
- `/v5/?playtest=1` — the game with the playtest recorder on (see `docs/playtest/README.md`).

## Known issues

See the "Known issues" section of `docs/V5-TEST-REPORT.md`.
