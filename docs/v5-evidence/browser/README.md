# V5 real browser screenshots

From GitHub Actions run 44466876584 (job "Browser end-to-end, V5 full game", commit 701a5b6, all 9 tests passed).
Headless Chromium with WebGL through SwiftShader (software GPU emulation on a CI machine). These are real WebGL frames
with the real HUD and CSS. They are not software-rasterised previews.

- `title.jpg`, `study-walk.jpg`, `settings-zh.jpg`: the first test, with real key presses.
- `beat-<beat>-<lang>-a.jpg` / `-b.jpg`: each beat loaded from its save through Continue, then about 4 s of real-time play with E, W and mouse movement.
- `tour-<beat>.jpg`: the first frame captured at each beat during the full automated English playthrough.
- `en-credits.jpg`, `zh-credits.jpg`: the end of the full playthroughs, with the album of 10 pictures.
- `tab-*.jpg`: Tab on the pier. `tech-*.jpg`: the tech demo page in its three states.
- `perf.json`: fps, JS heap and audio output level per beat. `resources.json`: what the page loaded.

The frame rate (10–12 fps) reflects SwiftShader on a 2-core CI runner, not a real GPU. The full videos of both
playthroughs (about 20 minutes each) are in the run's artifact `resurrection-v5-evidence` (kept 14 days):
https://github.com/Quinnverse/resurrection-usenet/actions/runs/44466876584

Newer evidence: `../key-lines/` (key lines of chapters 2, 4, 6, 7, run 44567880188) and `../devices/` (gamepad, touch
and menu frames, run 44528076000). The acceptance report `docs/V5-TEST-REPORT.md` cites run 44567880188.
