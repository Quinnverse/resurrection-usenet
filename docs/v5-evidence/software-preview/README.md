# V5 software previews (NOT browser screenshots)

`sheet-1.png` … `sheet-5.png` hold 59 frames in story order (names in `order.txt`). They come from
`node tools/v5-shell-run.mjs --shots <dir>`: the real shell (`frontend/v5/main.js`) plays the whole game in Node, and
at each beat and camera change the scene and the camera main.js set up are drawn by the small software rasteriser in
`tools/p4-preview.mjs`.

What that means:
- Composition, camera placement, who is on screen and the scene contents are those of the game.
- The pixels are an approximation: flat shading, no textures, no shadows, no sky gradient, no particles (snow, leaves),
  no post effects, no CSS overlays (subtitles, prompts, the CRT filter). The real look has not been seen.
- No WebGL, GPU or browser was involved. Real Chromium screenshots would come from `e2e/v5.spec.js`, which has not run.
