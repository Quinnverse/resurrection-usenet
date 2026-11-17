# Deployment

**Status: not deployed.** This repository prepares the configuration only. Creating a public host, spending money, or publishing a URL needs owner authorization.

## Local production-style run

```bash
npm start                                   # PORT=3000 by default
PORT=8080 RESURRECTION_DATA_DIR=/var/lib/resurrection npm start
```

## Container image

```bash
docker build -t resurrection .
docker run -p 3000:3000 -v resurrection-data:/data resurrection
```

The image runs as the `node` user, uses Node 22 (Alpine), and keeps saves on the `/data` volume. A health check calls `/api/health`.

## Choosing a host (free tiers change; check before use)

The game needs a long-running Node process and a writable disk for saves. A static host alone cannot run it. Candidates to check:

- A container host with a free or trial tier and a persistent volume (for example, Fly.io or Render). Confirm that persistent disks are included in the free tier before choosing.
- A small VPS you already own, with the Docker image or `npm start` under systemd.

Check each provider's current terms and pricing yourself. Do not assume a free tier still exists.

## Checklist before any public launch

1. Owner decides the host and approves the cost (zero is acceptable only if the provider confirms it).
2. Confirm the save directory is on persistent storage. Losing it resets every player's game.
3. Confirm retention on the host's disk: saves expire after seven days of inactivity, and cleanup runs at startup and every 24 hours (implemented in `combined-server/game/store.js`).
4. Put the site behind HTTPS (most hosts provide this).
5. Run `npm test` and `npm run test:e2e` against the exact commit being deployed.
6. Record the public URL in the README only after the deployed site has been tested.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port. `0` picks a free port (used by the tests). |
| `RESURRECTION_DATA_DIR` | `combined-server/data` | Directory for session save files. |
| `NODE_ENV` | unset | `production` in the Docker image. |
