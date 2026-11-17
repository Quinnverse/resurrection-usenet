# Release checklist — Resurrection public demo

Use this list for each release candidate. Tick an item only when its evidence exists for that commit.

## Code and tests
- [ ] `npm test` passes on the release commit (authoritative suite; record the count).
- [ ] CI job "Browser end-to-end (Playwright)" passes on the release commit (record the count and the artifact link).
- [ ] CI job "Container smoke" passes: image builds, runs as user `node`, health check passes, a session survives a container restart, no session tokens or save paths in logs.
- [ ] No placeholder or empty tests (grep for `it(` bodies that are empty).

## Gameplay
- [ ] Fresh anonymous session starts at the cold open.
- [ ] Full four-act playthrough completes in the browser suite (branch A and branch B).
- [ ] All three endings reached: The Archive, The Echo, The Last Letter.
- [ ] Refresh recovers the same investigation.
- [ ] Restart recovers the same investigation (container restart in CI, server restart in the test suite).
- [ ] Reset starts a fresh session; Delete save removes the server copy.

## Privacy and security
- [ ] Opening screen shows the privacy notice; `docs/PRIVACY.md` matches the hosting arrangement.
- [ ] Session IDs are 256-bit random values; malformed IDs return the same 404 as unknown IDs.
- [ ] Save files are owner-only (0600) and the save directory is not served (tests cover both).
- [ ] Rate limits and capacity limit return 429 and 503 with safe messages.
- [ ] Access logs are discarded at the proxy; game logs contain no tokens.
- [ ] Content-Security-Policy and no-sniff headers present on pages.

## Mobile and browser
- [ ] Mobile viewport (390 × 844) completes the investigation, propagation view, letter composition and an ending without horizontal overflow (browser suite).
- [ ] Browser console and page errors are empty in every browser test (asserted).
- [ ] Reduced-motion mode shows final states immediately (browser suite).
- [ ] Screenshots from the release run are attached to the CI artifact.

## Deployment readiness (owner action required before publishing)
- [ ] Host and cost approved by the owner.
- [ ] Domain registered and DNS pointed at the host.
- [ ] Save volume on persistent storage; retention confirmed (seven days, cleanup every 24 hours).
- [ ] `DEMO_DOMAIN` set; HTTPS certificate issued on first start.
- [ ] Owner approves public publication of the URL, screenshots and any video.

## Known limits accepted for the demo
- Single instance only. Saves and rate limits are per process.
- No backups of saves.
- No monitoring or alerting beyond health checks.
