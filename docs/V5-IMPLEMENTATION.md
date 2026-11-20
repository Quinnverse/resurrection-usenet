# Resurrection V5 — implementation, controls and how to run

Branch `feature/resurrection-v5-complete`. Entry points: the game at `/v5/`, the tech demo at `/v5/tech`.
`/`, `/p3/`, `/p4/` and `/p5/` are unchanged.

All posts, addresses, hosts and people in the archive are fictional test data (each record has an `X-Fixture` header).
No paid API, no network service, and no downloaded asset is used. Every model, texture and sound is made in code. The
melody comes from the fixture file `tune.ll`, which is original.

## Run

```
npm start                     # or: node combined-server/server.js   (port 3000; PORT=... to change)
open http://127.0.0.1:3000/v5/        the game
open http://127.0.0.1:3000/v5/tech    the 3-minute tech demo (docs/V5-DEMO-SCRIPT.md)
open http://127.0.0.1:3000/v5/audio   the audio listening check (docs/V5-AUDIO-CHECKLIST.md)
open http://127.0.0.1:3000/v5/?playtest=1   the game with the playtest recorder (docs/playtest/README.md)
node tools/v5-playtest-pack.mjs        build dist/resurrection-v5-playtest.zip for test machines
```

Tests (Node 22, no dependencies):

```
npm test                      # 229 unit/integration tests, includes test/v5-core.test.mjs
npm run test:v5-shell         # the browser shell in Node: full game in EN and ZH, tech page walkthrough
node tools/v5-estimate.mjs [--lang zh]                   # first-play time ESTIMATE (model, not a measurement)
node tools/v5-export-script.mjs > docs/V5-SCRIPT.md     # the full bilingual script
node tools/v5-playthrough.mjs [--variant] [--no-glide]   # headless playthrough timeline
node tools/v5-shell-run.mjs --shots <dir>                # same as test:v5-shell + software previews
npx playwright test e2e/v5.spec.js                       # real Chromium (passes in CI, see docs/V5-TEST-REPORT.md)
```

Regenerate the fixture archive with `node tools/v5-make-archive.mjs`.

## Controls

| Action | Keyboard / mouse | Gamepad (standard mapping) |
|---|---|---|
| Move | WASD or arrow keys | left stick |
| Camera | mouse (pointer lock after the first click), or drag | right stick |
| Jump / glide (coast ledge, hold) | Space | A |
| Sprint | Shift | LB, RB or L3 |
| Interact, advance dialogue | E, or left click | X (advance also A) |
| Hold to restore or crank | hold E or hold the left button | hold X |
| Switch 1998 ⇄ 2004 (town, after Theo explains it) | Tab, or click the era label | Y |
| Camera on the train: aim / take photo | right mouse or Q held, then click or E | LT held, RT |
| Choices | 1 / 2 / 3, or click | D-pad, then A |
| Hint in a character's voice | H | — |
| Pause, or skip a dialogue already seen | Esc | Start (pause), B (skip seen dialogue) |
| Menus (title, pause, settings, credits, confirm) | arrows, Enter, Esc, or the mouse | D-pad, A, B / Start |
| Hint | H | Back |
| Bicycle | W pedal, A/D steer, Shift sprint, E bell | left stick, LB, X |
| Lighthouse beam (ch. 3 and the end) | A / D turn it | left stick |
| Drawing the boat (ch. 4) | move the mouse (or WASD) | right stick |
| Tuning (ch. 4) | E when the needle is in the middle | X |
| Stars on the porch (ch. 4) | move the mouse; rest the middle of the view on a star | right stick |
| Hold still for June's sketch (ch. 2) | do nothing | do nothing |

Touch (experimental): the left half of the screen is a stick (push it far to sprint), the right half turns the camera,
a tap continues dialogue, and on-screen buttons give jump, interact (hold for restore and crank), the train camera and
shutter, and pause. Gamepad support is also experimental (see docs/V5-RELEASE-NOTES.md). F3 shows a frame-time overlay.
Every keyboard binding can be changed in Pause → Settings → Keys (stored in `localStorage` `v5.keys.v1`).
Settings also hold volume (music, effects), quality (low/medium/high, with an automatic drop when frames fall below
24 fps), reduced motion, subtitle size and language (EN / 简体中文).
The game saves itself every 5 s and at every chapter beat, restore, photo and ending (`v5.save.v1`).

## Chapters and what you do in them

| Chapter | Beats | Activities |
|---|---|---|
| 1 Catch the Summer | 1.study, 1.town, 1.pier, 1.carve, 1.chase | find Elena's backup disk; restore June's bridge from the archive (hold E); cross the pier by switching 1998/2004 (Tab); carve "E + J" with June (1998 memory); run for the train, jump the cart, take June's hand |
| 2 You Are the View | 2.train | photo dares (the cape lighthouse, a kite, June when she isn't looking); hold still while June sketches; the tunnel (reach for her hand, optional); June dozes (a photo, optional) |
| 3 Our Lighthouse | 3.ride, 3.yard, 3.beam, 3.cliff | 420 m bike ride with ribbon gates, the bell, June's slipped chain; carry and paint the crooked window; pull the lens up to June; crank the lamp; steer the beam to find June and then the cottage; glide down or take the stairs |
| 4 A Song Only for You | 4.cottage, 4.duet, 4.porch | June's portfolio (her own ambitions); draw a boat with June guiding; tune the guitar; the duet twice (sit closer or not); join five stars into June's constellation; the poem and the almost-confession |
| 5 Don't Leave Yourself Here | 5.depart, 5.alone | carry June's suitcase, the soda machine, a last photo, walk with her to the end of the platform, the news, the choice of words, run beside the leaving train; six years later the same machine, camera, door and walk give no answer |
| 6 You Remember, So Do I | 6.cottage, 6.beach | pack June's boxes with her (her picture books, her residency), the 1999 studio letter, the walk along the beach and up to the dark lighthouse with the conversation in three stops and two choices; "Take care on the road" when you leave |
| 7 Let Summer End | 7.study, 7.town, end | the unsent drafts (read one or close the folder; never sent); read the 1998 gate sign with Tab, then restore the names; free Iris from her loop and untie her boat; restore the lamp (RESTORED) then make the seasons (CREATED); turn the last light on the old pier; lay new pale planks (CREATED, present edition only) and walk Theo out in the snow |

## Architecture

```
frontend/v5/data/*.spool|mbox|txt     fictional archive (rnews spool, mbox, uuencode, MIME base64)
        │
core/usenet.js      parse: headers, Message-ID, References, cancels per source, conflicts, attachments, CRC-32, SHA-256
core/archive.js     sources → manifests (1998 summer-0.9, 2004 public-1.0) → resolveAsset → provenance → sceneGraph
        │                                   restoreCandidate / reviveCandidate / verifyProvenance
core/layout.js      the six places as floors/solids/points; bridgeFloors(bridge.ll data, progress)
core/physics.js     floors with heights and ramps, solids, step/drop, jump, glide, edge guard, void respawn, A* paths
core/companion.js   June: INVITE → LEAD → WAIT → PLAY → COOPERATE → REACT → TRANSITION
core/toys.js        bicycle ride, the duet, photo framing and June's mood cycle
core/game.js        seven chapters as beats, dialogue, choices, Restore / Revive / Rewind / Recompose, saves
core/i18n.js        EN / ZH text with key parity
        │  pure: no DOM, no WebGL. A headless bot (test/v5-bot.mjs) plays the whole game on this layer.
render/*.js         Three.js scenes (study, town, station, carriage, coast, cottage), cast, procedural audio
main.js             input, director camera, HUD, subtitles, choices, photos, overlays, menus, saving
tech.html / tech.js the same core modules shown step by step
```

How the archive drives the scene. An object exists in an era only if that era's build manifest lists it. An attached
asset (bridge, window, tune, lamp, Iris's script) appears only when a copy of its bytes has the size and CRC-32 the
manifest names. In 2004 the public sources hold only a truncated copy (mirror) and a stripped one (groups) of
`bridge.ll`, so the 2004 town has no bridge floor and the canal cannot be crossed. Restore searches every source,
including Elena's backup disk, finds the intact copy and stores a provenance reference (record, manifest, source,
CRC-32, SHA-256) in the save. The scene graph then includes the bridge, `bridgeFloors` turns its plank lines into
walkable floors, and the physics world is rebuilt. On load, `parseSave` re-checks the reference against the bytes; a
forged one is dropped and the game returns to the bridge.

With `variant-missing-plank.spool` as the disk, the 1998 bridge has 14 planks and a real 0.24 m hole, and the 2004
restore is refused because the CRC does not match. The same code gives a different world from different input.

The four verbs:
- **Restore**: the bridge (ch1), June's credit line (ch7). Shown as RESTORED with its provenance.
- **Revive**: Iris's own 1998 behaviour script, which ends with her leaving, applied in the present edition (ch7).
- **Rewind**: Tab switches the town between the 1998 and 2004 build data. Buildings, collision (pier decks), actors,
  light and music change; the switch is refused if the landing spot is not safe.
- **Recompose**: the seasons and winter theme are new work, labelled CREATED and credited to Mara, never to the 1998
  authors. The 1998 and 2004 snapshots stay unchanged (`sceneGraph(ar, era)` without the edition).

## Files

See `git log --stat feature/resurrection-v5-complete` and the file list in docs/V5-TEST-REPORT.md.

## RC1 review tooling (added after the game was complete; no story or gameplay changes)

| Part | Files | How it works |
|---|---|---|
| Start page and review hub | `frontend/v5/home.html`, `home.js`, `rc.html`, `rc.js`, `rc-scenes.js`, `rc/shots/` | Plain pages that only link and report. The same files are served by `tools/v5-serve.mjs` and inlined into single files; a flag `window.__V5_STANDALONE__` makes the links relative. |
| Previews | `?preview=<beat>` in `main.js`, `data/preview-saves.json`, `tools/v5-preview-saves.mjs` | One save per beat (plus `snow`, the end of the new pier) is made by playing the core with the scripted bot. A preview loads one, shows a tip, and never writes the real save. A test fails if the file is stale. |
| Frame-time test | `?bench=…` in `main.js`, `core/bench.js` | The renderer measures `requestAnimationFrame` gaps on a fixed tour with the game logic frozen; statistics (average, 1% low, p99, worst, hitches) and a Markdown report are pure functions in `core/bench.js` (unit-tested). The quality level is applied in memory only. |
| Key bindings | `core/keymap.js`, settings in `main.js` | Pure functions: stored bindings are sanitised, rebinding swaps on conflict and refuses reserved keys. |
| Playtest recorder | `playtest.js`, title notice, pause-menu buttons | Nothing is recorded until Start or Continue; chapter clock times, pauses, exits, a frame-time histogram (approximate 1% low). Local storage only. |
| Single-file builds | `tools/v5-bundle.mjs` | A small module inliner for exactly the import/export forms used here (fails on anything else; refuses cycles and missing exports). `tools/v5-shell-run.mjs --bundle` plays the whole game through the bundled script in Node. |
| Servers and packs | `tools/v5-serve.mjs`, `tools/v5-rc-pack.mjs`, `tools/v5-playtest-pack.mjs` | A read-only static server (`--lan` for phones); the owner package and the player folder. |
| CI | `.github/workflows/test.yml` | A first job compares the push with the previous one: if only documents, release files, RC1 pages, tools, their tests or the workflow changed, the long browser jobs are skipped. |
| Tests | `test/v5-rc.test.mjs` (Node), `e2e/v5-rc.spec.js` (Chromium) | Key bindings, statistics, recorder consent, preview saves, bundle, server, privacy checks; remap, previews, frame-time tour, hub, single files from disk, start page, touch layouts. |

Known limits: the frame-time tour measures drawing, not walking or physics; `performance.memory` exists only in Chrome-based browsers;
everything here was verified in Chromium with a software renderer, not on real GPUs, Safari, Firefox, controllers or phones.
