# Resurrection V5 — RC1 review package

RC1 is the build the owner reviews on real hardware before any release decision. It adds no chapters and no story. It adds
what is needed to judge the game with your own eyes, ears, hands and GPU, and to run a playtest without a development
environment. **Nothing has been merged, deployed or submitted.**

Status of the evidence is in `V5-RC1-ACCEPTANCE.md`. Open problems are in `V5-RC1-BLOCKERS.md`. The honest summary: all
automated checks are in place and pass, and **everything that needs a real Mac, a real GPU, a real controller, a real
phone or a real person is still to be done by you** (`V5-RC1-DEVICE-TEST.md` is the procedure).

## Start it

| You have | Do this |
|---|---|
| The RC1 zip: `release/v5-rc1/resurrection-v5-rc1.zip` in the repository (or the CI artifact `resurrection-v5-rc1-package`, which needs a GitHub login) | Unzip it and double-click **`Resurrection-V5-Start.html`**. No install, no server, no internet. Use Chrome, Edge, Firefox or Safari on a computer. |
| The repository and Node 20+ (Mac: double-click `start-v5.command`) | `npm run v5` — starts a server on `http://127.0.0.1:8090` and opens the start page (`/v5/home`). |
| A phone or tablet to test | On the computer run `npm run v5:lan` (or double-click `start-v5-phone.command`), then type one of the printed addresses on the phone, e.g. `http://192.168.1.20:8090/v5/home`. The server is open to your Wi-Fi while it runs; stop it with Ctrl+C. |
| A player with no development tools | Give them `release/v5-rc1/resurrection-v5-playtest.zip`: they open `START-HERE.html`, then `Resurrection-V5-Playtest.html`. |

## The start page (six doors)

| Door | Opens | Notes |
|---|---|---|
| Start the game · 开始游戏 | `Resurrection-V5.html` (`/v5/`) | English or 中文 on the title screen |
| Continue · 继续游戏 | the same game page | shows whether a save is visible in this browser; press Continue on the title screen |
| Technical demo · 技术演示 | `Resurrection-V5-Tech.html` (`/v5/tech`) | the USENET archive parsed, checked and restored into a walkable floor, with a 3-minute walkthrough |
| Music and sound · 音乐试听 | `Resurrection-V5-Audio.html` (`/v5/audio`) | every theme by chapter and place, 8 s or looped, and every effect; verdict and notes; a link to the scene where each is heard |
| Key scenes · 场景预览 | `Resurrection-V5-RC.html#scenes` (`/v5/rc`) | the train, the coast ride, the lighthouse, the porch at night, the duet, the 2004 beach, the first snow; one click each, nothing is saved |
| Playtest feedback · 试玩反馈 | `Resurrection-V5-Playtest.html` and `feedback-form.html` | the game with the recorder on (everything stays in the browser) and the questionnaire (saves a file, sends nothing) |

Under “advanced” at the bottom of the start page is the review hub (`Resurrection-V5-RC.html`): what this browser and GPU report, a live
gamepad monitor and the frame-time tests.

## What else is in it

| Page | What it is for |
|---|---|
| **Review hub** (`/v5/rc`, `Resurrection-V5-RC.html`) | The key-scene cards with screenshots (software-rendered CI frames, **not** your GPU), the frame-time tests, a device and GPU report, a gamepad monitor. |
| **Frame-time test** (`?bench=low,medium,high`) | Plays a fixed tour of nine scenes at each quality level and gives a table: average FPS, 1% low FPS, p99 and worst frame, hitches over 100 ms, stalls over 250 ms, load time, memory (where the browser reports it), draw calls and triangles, device and GPU. Copy the table into `V5-RC1-PERF.md`. About five minutes; keep the tab in front. |
| **Playtest build** (`Resurrection-V5-Playtest.html`, `/v5/?playtest=1`) | The game with the recorder on. Facilitator guide: `playtest/README.md`. |

## Single files and where saves live

The `.html` files contain the whole game. Browsers keep one storage for all local files, so the normal game, the audio
page and the frame-time test share a save and settings. The playtest file keeps its own (`v5pt.*`), so a playtest never
overwrites your save. Safari and Firefox may treat each local file separately. If a browser refuses to keep saves for local
files, use `npm run v5` instead and note it in `V5-RC1-DEVICE-TEST.md`.

## Changes in RC1 that you will notice

- **Key remapping**: binding a key another action uses swaps the two (so no key does two things); Esc, F-keys, 1–3 and system keys cannot be bound; Esc cancels a rebinding; damaged stored settings fall back to the defaults.
- **Playtest recorder**: nothing is recorded until the player presses Start or Continue, and the title says what is recorded. It now keeps chapter start and end times, pauses, page exits and tab switches, and has a “Delete my playtest record” button in the pause menu.
- **Hint text no longer overlaps subtitles** (seen in the coast-ride screenshot).
- Panels use `dvh` and a prefixed `backdrop-filter` so they fit on Safari and phone browsers.

## Commands

| | |
|---|---|
| `npm run v5` / `npm run v5:lan` | local server (this computer / also the local network) |
| `npm run v5:rc` | builds `dist/resurrection-v5-rc1.zip` and `dist/resurrection-v5-playtest.zip` |
| `npm run v5:bundle` | only the four html files (`dist/resurrection-v5-rc1/`) |
| `npm run v5:previews` | regenerates `frontend/v5/data/preview-saves.json` after a story change (a test fails if it is stale) |
| `npm test`, `npm run test:v5-shell` | Node tests; the shell run also plays the whole game through the single-file build |
| `npx playwright test e2e/v5-rc.spec.js` | the RC1 browser tests |
