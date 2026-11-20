# RC1 review tooling in real Chromium

From GitHub Actions run 44696534992 (commit e3be862), job “V5 RC1 review pages and packages”, 6 of 6 tests passed.
Headless Chromium on a CI runner with **software rendering** (SwiftShader). These are real browser frames of the real
pages, but they say nothing about what a GPU draws or how fast it draws it.

- `preview-<beat>.jpg`, `preview-6.beach-zh.jpg`: the live scenes opened with `?preview=<beat>` (`snow` is the end of the new pier in winter).
- `hub.jpg`: the review hub with the scene cards, the device report and the gamepad monitor (a simulated pad).
- `bench-report.jpg`: the frame-time report. `bench-ci-software.json`: its numbers, 2 quality levels × 2 scenes at 3 s each: **software rendering, not performance**.
- `remap-settings.jpg`: settings after binding Forward to D (Right took W).
- `touch-<size>-<title|play|settings|rotated>.jpg` and `touch-layout.json`: phone-sized touch screens (390×844, 844×390, 320×568, 568×320) before and after a rotation, with the measured problems (none).
- `file-*.jpg`: the single html files opened from disk (no server, no network): a preview from the hub, the title, and the playtest pause menu with “Download playtest log” and “Delete my playtest record”.

## Added by the last code push

From GitHub Actions run 44758500485 (commit b78e03b), job “V5 RC1 review pages and packages”, 7 of 7 tests passed. Same conditions
(headless Chromium, software rendering, pages opened from disk):

- `start-desktop.jpg`, `start-phone.jpg`: the owner start page with its six doors, at 1280 px and at 390 px.
- `file-tech-restored.jpg`: the technical demo opened from the start page, after “Restore bridge”.
- `file-audio.jpg`: the music page, after playing a theme on loop.
- `file-playtest-title-zh.jpg`: the playtest build with a Chinese setting: the title notice says what is recorded.

No video is included; all evidence here is still frames from real browser runs. The earlier files in this folder come from run
44696534992 (commit e3be862). The key-line frames in `../key-lines/` and the card images of the hub (`frontend/v5/rc/shots/`) come from
run 44567880188 (commit e40b4ca) and are software-rendered too.
