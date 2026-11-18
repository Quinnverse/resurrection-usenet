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
```

Tests (Node 22, no dependencies):

```
npm test                      # 229 unit/integration tests, includes test/v5-core.test.mjs
npm run test:v5-shell         # the browser shell in Node: full game in EN and ZH, tech page walkthrough
node tools/v5-playthrough.mjs [--variant] [--no-glide]   # headless playthrough timeline
node tools/v5-shell-run.mjs --shots <dir>                # same as test:v5-shell + software previews
npx playwright test e2e/v5.spec.js                       # real Chromium. Written, NOT RUN (see the test report)
```

Regenerate the fixture archive with `node tools/v5-make-archive.mjs`.

## Controls

| Action | Keyboard / mouse | Gamepad (standard mapping) |
|---|---|---|
| Move | WASD or arrow keys | left stick |
| Camera | mouse (pointer lock after the first click), or drag | right stick |
| Jump / glide (coast ledge, hold) | Space | A |
| Sprint | Shift | LB or L3 |
| Interact, advance dialogue | E, or left click | X (advance also A) |
| Hold to restore or crank | hold E or hold the left button | hold X |
| Switch 1998 ⇄ 2004 (town, after Theo explains it) | Tab, or click the era label | Y |
| Camera on the train: aim / take photo | right mouse or Q held, then click or E | LT held, RT |
| Choices | 1 / 2 / 3, or click | — |
| Hint in a character's voice | H | — |
| Pause, or skip a dialogue already seen | Esc | Start (pause), B (skip seen dialogue) |

Touch: the left half of the screen moves, the right half turns the camera, and a tap acts.
Every keyboard binding can be changed in Pause → Settings → Keys (stored in `localStorage` `v5.keys.v1`).
Settings also hold volume (music, effects), quality (low/medium/high, with an automatic drop when frames fall below
24 fps), reduced motion, subtitle size and language (EN / 简体中文).
The game saves itself every 5 s and at every chapter beat, restore, photo and ending (`v5.save.v1`).

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
