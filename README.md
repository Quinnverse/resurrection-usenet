# RESURRECTION — The Internet Remembers the Dead

She died in 1998. Her last message arrived tonight.

A browser-based narrative investigation for Kiroween 2026. You are a restoration operator on a decommissioned network. Copies of a dead researcher survive on five relay nodes, and they disagree. Every copy you make authoritative changes what the others remember. The game runs in 12–18 minutes, has four acts, and ends in one of three endings. It needs no account and no paid API.

## Start the game

```bash
npm start
```

Then open http://localhost:3000. Requirements: Node.js 20 or newer. There are no runtime dependencies.

Other versions on the same server, each with its own browser save:

- http://localhost:3000/p3/ — P3.2 "The Summer She Was Seventeen", a 2D pixel level.
- http://localhost:3000/p4/ — P4 "The Lighthouse", a stylized 3D third-person narrative slice (Three.js, English and Simplified Chinese). See [docs/P4-DESIGN.md](docs/P4-DESIGN.md) and [docs/P4-TEST-REPORT.md](docs/P4-TEST-REPORT.md).

Saves are written to `combined-server/data/` (ignored by Git). Use `RESURRECTION_DATA_DIR` and `PORT` to change the location or port.

## Run the tests

```bash
npm test          # authoritative suite: engine, HTTP contract, persistence, replay, legacy routes
npm run test:e2e  # browser suite (Playwright, Chromium). Installs dev dependencies first:
                  #   npm install && npx playwright install --with-deps chromium
```

`npm test` uses Node's built-in test runner and needs no installation. It starts its own servers on dynamic ports with temporary save directories. `npm run test:e2e` starts the server on port 3999 with its own temporary save directory.

CI (`.github/workflows/test.yml`) runs both commands on every push and pull request. The browser job uploads its screenshots and HTML report as the `resurrection-browser-evidence` artifact.

## Verification status

Check the latest GitHub Actions run for the current result. Nothing here is a claim that a test passed.

| Check | Command | What it covers |
|---|---|---|
| Engine and rules | `npm test` | Gating, both C1 branches, C2 eviction, C3 options, three endings, anomaly from the event log, propagation, replay |
| HTTP contract | `npm test` | Session routes, typed errors, idempotent actions, stale revisions, body limits, reset, thread and message fields |
| Persistence | `npm test` | Refresh, server restart recovery, atomic saves |
| Static assets | `npm test` | HTML, the module script, local assets, JavaScript syntax (no raw JSX) |
| Browser journey | `npm run test:e2e` | Both branches to their endings, reload recovery, reset, mobile overflow, console and HTTP errors |

## Project layout

```
combined-server/
  server.js          the one HTTP server (static files, session API, legacy routes)
  game/content.js    authored evidence, records, agent lines and endings
  game/engine.js     deterministic session engine: rules, propagation, projection, replay
  game/api.js        /api/sessions contract adapter
  game/store.js      atomic JSON save files
frontend/
  index.html         page and stylesheet (no third-party scripts)
  src/main.jsx       renders the server projection (dependency-free)
docs/game-design/    authoritative design documents
docs/                public-demo notes, Kiro usage, demo storyboard
e2e/                 Playwright browser suite
test/                node:test suite
```

## Design authority

The behaviour is specified by `docs/game-design/` (game design, narrative bible, puzzle and state specification). Where the code and those documents disagree, the documents win and the code is the defect.

## Creator and licence

Created by **Quinnverse**. Licensed under the MIT Licence (see `LICENSE`, Copyright (c) 2026 Quinnverse).

## Privacy

Progress is saved on the game server under an anonymous random session ID kept in your browser. Saves expire after seven days without activity, and are not backed up long-term. Choose **Reset game** then **Delete save only** in the game, or call `DELETE /api/sessions/{sessionId}`. Full notice: `docs/PRIVACY.md`.

## Resurrection V5 — RC1 (release candidate, not released)

A seven-chapter 3D narrative game in the browser (English and 简体中文), with an owner review kit. **Not released, deployed or submitted.**

- **Open it with no tools:** unzip `release/v5-rc1/resurrection-v5-rc1.zip` and double-click `Resurrection-V5-Start.html` (start, continue, technical demo, music, key scenes, feedback).
- **Or from the repository** (Node 20+): `npm run v5` → http://127.0.0.1:8090/v5/home. Phone: `npm run v5:lan`.
- **Playtest with other people:** give them `release/v5-rc1/resurrection-v5-playtest.zip` (nothing to install; records only in their browser).
- **Status and what is still open:** `docs/V5-RC1-ACCEPTANCE.md`, `docs/V5-RC1-BLOCKERS.md`. Automated checks pass; nobody has played it on real hardware, listened to it or run a blind playtest.
- **P5** (an earlier slice) has a failing CI job that predates V5: `docs/V5-P5-BASELINE.md`.
