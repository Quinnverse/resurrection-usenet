# Resurrection V5 — release notes (RC1, not released)

Branch `feature/resurrection-v5-complete`. This build has **not** been released, deployed or submitted, and does not
yet meet the release conditions: see `docs/V5-RC1-ACCEPTANCE.md` and `docs/V5-RC1-BLOCKERS.md`.

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

- `/v5/home` — the start page: six doors (start, continue, technical demo, music, key scenes, feedback).
- `/v5/rc` — the RC1 review hub: links, the key scenes, what this browser and GPU report, a gamepad monitor.
- `/v5/?preview=<beat>` — opens one moment of the story (the train, the coast ride, the lighthouse beam, the porch at night, the duet, the 2004 beach, `snow` for the first snow) without touching your save.
- `/v5/?bench=low,medium,high` — a frame-time tour of nine scenes with a report (average and 1% low FPS, stalls, load times, memory where the browser reports it).
- `/v5/tech` — the 3-minute technical demo (archive → parse → manifest → restore → walkable floor).
- `/v5/audio` — the listening check for every theme and sound effect (8 s, or looped), with a link to the scene where each is heard.
- `/v5/?playtest=1` — the game with the playtest recorder on (see `docs/playtest/README.md`).
- `Resurrection-V5-Start.html`, `Resurrection-V5.html`, `-Tech`, `-Audio`, `-RC`, `-Playtest` and `feedback-form.html` — the same pages as single files that open from disk with no server, no Node and no network. Built by `npm run v5:rc`; the built zips are in `release/v5-rc1/`.

## Key bindings

Binding a key that another action already uses swaps the two. Esc, F-keys, 1–3 and the system keys (Windows/Command, context menu)
are used by the game and cannot be bound. Esc cancels a rebinding. Settings that are damaged or conflicting fall back to the
defaults. “Reset keys” restores W A S D, Space, Shift, E, Tab, Q, H.

## Playtest recorder and privacy

Only in the playtest page (`?playtest=1` or `Resurrection-V5-Playtest.html`). Nothing is recorded until the player presses Start or
Continue; the title says what is recorded. It stays in the player’s browser, is never sent anywhere, can be downloaded by the
player, and can be deleted from the pause menu. No name or contact detail is asked for.

## Known issues

See the "Known issues" section of `docs/V5-TEST-REPORT.md`.
