# Deployment procedure (single instance)

**Status: release candidate. Not deployed. No public URL exists.** Publishing needs the owner's authorization listed in section 7.

This is the only deployment procedure. It uses `deploy/docker-compose.yml`, which runs the game and an HTTPS proxy on one host.

## 1. Requirements

| Item | Requirement |
|---|---|
| Host | One Linux machine or VM with Docker Engine and the Compose plugin (v2) |
| Domain | A host name whose DNS A/AAAA record points at the host, with ports 80 and 443 open |
| CPU | 1 vCPU for the game, 0.5 vCPU for the proxy (limits set in Compose) |
| Memory | About 256 MB for the game and 128 MB for the proxy (limits set in Compose). Expect about 100 MB resident for the game. |
| Disk | Save volume: plan for 512 MB (the application's own cap, `RESURRECTION_MAX_STORAGE_MB`). Add headroom for images and logs: 2 GB total is comfortable. |
| Network | Outbound HTTPS to the certificate authority for the certificate. No other outbound calls: the game uses no external API. |
| External services | None required. No database, no model API, no object storage. |

Estimated load: each game makes about 30 requests, and each save is well under 256 KB. A single 1 vCPU instance should handle modest demo traffic. Measure before promoting it.

## 2. Configuration

Set one variable. All others have safe defaults in `deploy/docker-compose.yml`.

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_DOMAIN` | required | Public host name for HTTPS |
| `RESURRECTION_RATE_CREATE_PER_HOUR` | 20 | New games per client address per hour |
| `RESURRECTION_RATE_WRITE_PER_MINUTE` | 120 | Actions, resets and deletes per client address per minute |
| `RESURRECTION_MAX_SESSIONS` | 2000 | Saves on disk before new games are refused (HTTP 503) |
| `RESURRECTION_MAX_STORAGE_MB` | 512 | Total save size before new games are refused |

Saves expire after seven days without activity. The server removes expired saves at startup and every 24 hours.

## 3. Procedure

Run from the repository root on the host:

```bash
# 1. Get the release candidate at the tagged commit
git fetch origin && git checkout <release-candidate-sha>

# 2. Run the authoritative tests on the same commit (must pass)
npm test

# 3. Build and start (the proxy obtains the certificate on first start)
DEMO_DOMAIN=demo.example.org docker compose -f deploy/docker-compose.yml up -d --build

# 4. Confirm health through the proxy
curl -fsS https://demo.example.org/api/health

# 5. Confirm the container user and the save volume
docker compose -f deploy/docker-compose.yml exec game id
docker volume inspect resurrection_saves
```

Expected: step 4 prints `{"status":"ok",...}`; step 5 shows user `node` (uid 1000).

## 4. Verify before announcing

Run the browser suite against the deployed URL only if the owner approves it. Otherwise run the same checks in CI on the commit (see `docs/RELEASE-CHECKLIST.md`).

## 5. Operations

- **Update:** repeat section 3 with the new commit. Compose replaces the container; the save volume is kept.
- **Restart recovery:** `docker compose ... restart game`. Existing saves reload from the volume.
- **Logs:** the game logs only start-up messages and save-cleanup counts. The proxy discards access logs, so request paths (which contain session tokens) and client addresses are not stored.
- **Delete all saves:** `docker compose ... down -v` removes the save volume. This is irreversible.
- **Rollback:** check out the previous commit and repeat section 3.

## 6. What is not in place

- Multiple instances: saves and rate limits are per instance. Do not scale out.
- Backups: saves are not backed up. Losing the volume loses progress.
- Monitoring and alerting: not configured. Health checks run inside Docker and through the proxy.

## 7. Owner authorization needed before publishing

1. Choose the host and provider, and approve its cost (zero is acceptable only if the provider confirms it).
2. Choose and register the domain, and point its DNS record at the host.
3. Approve the public launch and the demo publication (video, screenshots, public URL).
4. Confirm the privacy notice in `docs/PRIVACY.md` matches the hosting arrangement.
