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
| The RC1 zip (`resurrection-v5-rc1.zip`, from the CI artifact `resurrection-v5-rc1-package`, or `npm run v5:rc`) | Unzip, double-click **`Resurrection-V5-RC.html`**. No install, no server, no internet. |
| The repository and Node 20+ (Mac: double-click `start-v5.command`) | `npm run v5` — starts a server on `127.0.0.1:8090` and opens the hub. |
| A phone or tablet to test | On the computer run `npm run v5:lan` (or double-click `start-v5-phone.command`), then type one of the printed addresses on the phone, e.g. `http://192.168.1.20:8090/v5/rc`. The server is open to your Wi-Fi while it runs; stop it with Ctrl+C. |

## What is in it

| Page | What it is for |
|---|---|
| **Review hub** (`/v5/rc`, `Resurrection-V5-RC.html`) | One place with links to everything below, a report of what this browser and GPU report, and a live gamepad monitor. |
| **Key scenes** (hub, section 2) | One click opens the real game at: the train (Elena and June), the coast ride, the lighthouse beam, the porch at night, the guitar duet, the 2004 beach, and the first snow. `?preview=<beat>` — nothing is saved and your own save is untouched. The screenshots on the cards are from a CI machine with **software rendering**; they are not what your GPU draws. |
| **Frame-time test** (`?bench=low,medium,high`) | Plays a fixed tour of nine scenes at each quality level and gives a table: average FPS, 1% low FPS, p99 and worst frame, hitches over 100 ms, stalls over 250 ms, load time, memory (where the browser reports it), draw calls and triangles, device and GPU. Copy the table into `V5-RC1-PERF.md`. Takes about five minutes. Keep the tab in front. |
| **Music and sound** (`/v5/audio`, `Resurrection-V5-Audio.html`) | Every music arrangement (8 s or looped) and every sound effect, a verdict and a note field, and a link to the scene where each arrangement is heard. The level numbers only show that sound is produced. They say nothing about how it sounds. |
| **Playtest build** (`Resurrection-V5-Playtest.html`, `/v5/?playtest=1`) | The game with the recorder on. The package for players is `resurrection-v5-playtest.zip` (see `playtest/README.md`). |

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
