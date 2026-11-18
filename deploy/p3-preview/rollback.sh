#!/usr/bin/env bash
# One-command rollback to the container that ran before the last deploy.
#   bash ~/.resurrection-p3-deploy/rollback.sh
# deploy.sh copies this file there, so it still works after the source folder is deleted.
# It renames and stops the new container (kept for its logs), renames the previous container back to
# resurrection-preview and starts it on the same volume. Nothing is deleted. Other sites are not touched.
set -euo pipefail

STATE_DIR="${P3_STATE_DIR:-$HOME/.resurrection-p3-deploy}"
STATE="$STATE_DIR/last-deploy.env"
log()  { printf '\033[1m[rollback]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[rollback] FAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$STATE" ] || fail "no deploy record at $STATE; nothing to roll back"
# shellcheck disable=SC1090
. "$STATE"

docker inspect "$PREV_NAME" >/dev/null 2>&1 || fail "previous container $PREV_NAME not found. Previous image is still available as $ROLLBACK_TAG: docker run it with the same options as deploy.sh"

FAILED_NAME="${CONTAINER}-failed-${DEPLOYED_AT}"
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  log "stopping $CONTAINER and keeping it as $FAILED_NAME (for logs)"
  docker update --restart=no "$CONTAINER" >/dev/null 2>&1 || true
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  docker rename "$CONTAINER" "$FAILED_NAME"
fi

log "restoring $PREV_NAME as $CONTAINER"
docker rename "$PREV_NAME" "$CONTAINER"
docker update --restart unless-stopped "$CONTAINER" >/dev/null
docker start "$CONTAINER" >/dev/null

for _ in $(seq 1 60); do
  s="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER")"
  r="$(docker inspect -f '{{.State.Status}}' "$CONTAINER")"
  { [ "$s" = healthy ] || { [ "$s" = none ] && [ "$r" = running ]; }; } && break
  sleep 1
done
body="$(curl -fsS --max-time 8 "http://$HOST_ADDR:$HOST_PORT/api/health" || true)"
grep -qF '"status":"ok"' <<<"$body" || fail "restored container does not answer on $HOST_ADDR:$HOST_PORT. Check: docker logs $CONTAINER"

log "OK. $CONTAINER is the previous release again. Saves in volume $VOLUME were not modified."
log "Failed release kept as $FAILED_NAME. Remove it later yourself with: docker rm $FAILED_NAME"
