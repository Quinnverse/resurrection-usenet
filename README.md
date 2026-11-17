# RESURRECTION — The Internet Remembers the Dead

She died in 1998. Her last message arrived tonight.

A browser-based narrative investigation for Kiroween 2026. You are a restoration operator on a decommissioned network. Copies of a dead researcher survive on five relay nodes, and they disagree. Every copy you make authoritative changes what the others remember. The game runs in 12–18 minutes, has four acts, and ends in one of three endings. It needs no account and no paid API.

## Start the game

```bash
npm start
```

Then open http://localhost:3000. Requirements: Node.js 20 or newer. There are no runtime dependencies.

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

## Licence

MIT. See `LICENSE`.
