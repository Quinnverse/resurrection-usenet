# Resurrection — public demo notes

## What the demo is
A single-player browser investigation, about 12–18 minutes, in four acts with three endings. The game runs on one Node.js server with no npm runtime dependencies and no paid model API. All story text is authored and stored in `combined-server/game/content.js`.

## Run it locally
```bash
npm start            # http://localhost:3000
```
Requirements: Node.js 20 or newer. Saves are written to `combined-server/data/` (ignored by Git). Set `RESURRECTION_DATA_DIR` to change the location and `PORT` to change the port.

## Run it in Docker (prepared, not deployed)
```bash
docker build -t resurrection .
docker run -p 3000:3000 -v resurrection-data:/data resurrection
```
The container runs as the unprivileged `node` user and keeps saves in the `/data` volume.

## Deployment status
**Not deployed. No public URL exists.** Publishing needs a hosting account, a payment method or free-tier approval, and owner authorization, none of which this repository has. See `DEPLOYMENT.md` for the options and the checklist.

## Data and privacy
- No account, email, or personal data is requested.
- Each browser stores one random session ID in `localStorage` (`resurrection.sessionId`).
- The server stores each session as one JSON file, containing only game state and a timestamp for each action.
- Reset deletes the session file. Clearing browser storage leaves the server file orphaned until the host removes it.
- There is no retention policy beyond the host's disk. A public deployment should add a cleanup job for sessions older than an agreed period before going live.

## Known limits
- Sessions live on one server's disk. Multi-instance hosting needs a shared store (not built).
- The opening scene is English only.
- Audio is not implemented. Captions are not needed because the game has no audio.
- The React-free frontend is a single hand-written file; there is no build step.
- Browser support is tested only in the Playwright run described in the README.

## Licensing
MIT (see `LICENSE`). All authored text and the interface are original to this project. No third-party fonts or images are loaded: the interface uses system serif and monospace fonts.
