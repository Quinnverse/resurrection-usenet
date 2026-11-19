# V5 input device screenshots

From GitHub Actions run 44528076000 (commit e48dfe7). Headless Chromium, WebGL through SwiftShader (a software GPU).

The devices are **simulations inside the page**, not hardware:
- gamepad: a standard-mapping pad object returned by `navigator.getGamepads()`, its buttons and sticks set by the test;
- touch: synthetic `TouchEvent`s on the canvas and the on-screen buttons, in an emulated 844×390 touch screen;
- keyboard and mouse: synthetic `KeyboardEvent`s and `MouseEvent`s.

The game reads them through its own input code; no game input is injected. See `test/v5-devices.mjs`.

- `pad-*.jpg`: the whole game with only the gamepad (Chinese UI, second set of choices). `pad-credits.jpg` is the end.
- `touch-*.jpg`: the whole game with only touch. `touch-credits.jpg` is the end.
- `pad-confirm.jpg`, `pad-settings.jpg`: the new-game confirm box and the settings panel, focus moved by the D-pad.
- `kbd-choice.jpg`: a dialogue choice picked with the number keys. `touch-ui.jpg`: the on-screen touch buttons.
- `perf-44528076000.json`: fps, frame time, heap and audio level per beat. `audio-44528076000.json`: output level of every theme and effect on `/v5/audio` (signal only; nobody listened).
