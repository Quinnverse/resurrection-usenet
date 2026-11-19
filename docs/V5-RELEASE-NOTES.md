# Resurrection V5 — release notes (pre-release, not released)

Branch `feature/resurrection-v5-complete`. This build has **not** been released, deployed or submitted, and does not
yet meet the release conditions in `docs/V5-TEST-REPORT.md`.

## What it is

A narrative 3D browser game in seven chapters, English and Simplified Chinese, about two girls who made a game in
1998 and the daughter who rebuilds it from a fictional USENET archive. All posts, people and places are fictional.
All music and sound are original and generated in the browser.

## Input devices

Each device was checked by playing the whole game with that device alone (no other input, no injected game input):
a scripted player drives the device and the game reads it through its normal input code. The status below says what
that does and does not prove.

| Device | Status | What was checked | Not checked |
|---|---|---|---|
| Keyboard and mouse | **supported** | whole game in Chromium through synthetic key and mouse events; title (Enter), menus (arrows, Enter, Esc), number keys for choices; real Playwright key presses for walking, pause, settings, language and remapping | real players; Firefox, Safari |
| Key remapping | **supported** | a rebound key moves, the old one stops, reset restores | – |
| Gamepad (standard mapping) | **experimental** | whole game in Chromium with a simulated pad object: move, look, jump, interact and hold, era switch, train camera, choices (D-pad + A), skip (B), hint (Back), pause and resume (Start/B), title, settings, new-game confirm and Continue | any real controller; non-standard mappings; vibration |
| Touch | **experimental** | whole game in Chromium in an emulated 844×390 touch screen through synthetic touch events on the canvas and the on-screen buttons; title and pause/resume with Playwright taps | any real phone or tablet; portrait; multi-touch feel; small screens |
| Low-end GPUs, phones, 30 fps target | **not tested** | only a software GPU (SwiftShader) in CI, 10–12 fps | real hardware |

One optional screen still needs a pointer: the "source" chip at the top right (the provenance panel). It is never
required to finish the game.

## Controls

Keyboard and mouse: WASD move, mouse look (or drag with a button held), Space jump (hold to glide from the windy
ledge), Shift sprint, E or left click interact and continue, hold E for restore / crank / pulley / carving / planks,
Tab 1998 ⇄ 2004 in the town, right mouse or Q raises the train camera and click shoots, 1 2 3 choose, H hint,
Esc pause or skip a seen line, arrows / Enter / Esc in menus, F3 frame-time overlay.

Gamepad: left stick move, right stick look and aim, A jump / continue / pick, X interact (hold), B back or skip a seen
line, Y era switch, LB / RB / L3 sprint, LT raise camera, RT shutter, Back hint, Start pause, D-pad moves through
choices and menus.

Touch: left half is a stick (push far to sprint), right half turns the camera, on-screen buttons: jump, E (tap to
continue, hold to restore), ⇄ era switch in the town, ? hint, II pause (or skip a seen line), and on the train the
camera and the shutter. Choices and menus are tapped.

## Extra pages

- `/v5/tech` — the 3-minute technical demo (archive → parse → manifest → restore → walkable floor).
- `/v5/audio` — the listening check for every theme and sound effect.
- `/v5/?playtest=1` — the game with the playtest recorder on (see `docs/playtest/README.md`).

## Known issues

See the "Known issues" section of `docs/V5-TEST-REPORT.md`.
