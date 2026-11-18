#!/usr/bin/env bash
# Deploys this source tree as a new image of the existing preview container.
#
#   bash deploy.sh                 build, verify a throwaway candidate, back up saves, swap, check, auto-roll back on failure
#   bash deploy.sh --verify-only   build and verify the candidate only; the running container is not touched
#
# Needs only: docker, curl, and a docker-hub (or mirror) route for the node:22-alpine base image.
# It never talks to GitHub, never edits nginx, and only touches the container named resurrection-preview,
# images named resurrection:*, and reads the volume resurrection_saves (it is mounted read-only for the backup).
# Nothing is deleted: the previous container is renamed and stopped, the previous image keeps a rollback tag.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/../.." && pwd)"

CONTAINER="${P3_CONTAINER:-resurrection-preview}"
VOLUME="${P3_VOLUME:-resurrection_saves}"
HOST_ADDR="${P3_HOST_ADDR:-127.0.0.1}"
HOST_PORT="${P3_HOST_PORT:-18080}"
CANDIDATE_PORT="${P3_CANDIDATE_PORT:-18081}"
MEMORY="${P3_MEMORY:-256m}"
CPUS="${P3_CPUS:-0.5}"
PIDS="${P3_PIDS:-128}"
IMAGE_REPO="resurrection"
STATE_DIR="${P3_STATE_DIR:-$HOME/.resurrection-p3-deploy}"
VERIFY_ONLY=0
[ "${1:-}" = "--verify-only" ] && VERIFY_ONLY=1

VERSION="$(cat "$SRC/VERSION" 2>/dev/null || echo "p3-unversioned")"
NEW_IMAGE="$IMAGE_REPO:$VERSION"
TS="$(date +%Y%m%d-%H%M%S)"
CAND="${CONTAINER}-candidate"

log()  { printf '\033[1m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[deploy] FAILED: %s\033[0m\n' "$*" >&2; exit 1; }

cleanup_candidate() { docker rm -f -v "$CAND" >/dev/null 2>&1 || true; }
trap cleanup_candidate EXIT

# ---- 1. read-only preflight -------------------------------------------------------------

log "preflight (read-only)"
command -v docker >/dev/null || fail "docker is not installed"
command -v curl   >/dev/null || fail "curl is not installed"
docker info >/dev/null 2>&1  || fail "cannot talk to the docker daemon (try sudo, or add your user to the docker group)"
[ -f "$SRC/Dockerfile" ] && [ -f "$SRC/combined-server/server.js" ] && [ -f "$SRC/frontend/p3/index.html" ] \
  || fail "source tree incomplete: expected Dockerfile, combined-server/server.js, frontend/p3/index.html under $SRC"

docker inspect "$CONTAINER" >/dev/null 2>&1 || fail "container $CONTAINER does not exist. This script updates an existing preview; it does not create one"
docker volume inspect "$VOLUME" >/dev/null 2>&1 || fail "volume $VOLUME does not exist. Refusing to start with a new empty save volume"

OLD_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CONTAINER")"
OLD_IMAGE_REF="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
OLD_STATE="$(docker inspect -f '{{.State.Status}}' "$CONTAINER")"
OLD_MOUNTS="$(docker inspect -f '{{range .Mounts}}{{.Name}}={{.Destination}}{{println}}{{end}}' "$CONTAINER" | sed '/^$/d')"
DATA_DEST="$(printf '%s\n' "$OLD_MOUNTS" | sed -n "s|^$VOLUME=||p" | head -n1)"
[ -n "$DATA_DEST" ] || fail "container $CONTAINER does not mount volume $VOLUME (mounts: ${OLD_MOUNTS:-none})"

PORT_LINE="$(docker port "$CONTAINER" 2>/dev/null | grep -F "$HOST_ADDR:$HOST_PORT" | head -n1 || true)"
[ -n "$PORT_LINE" ] || fail "container $CONTAINER is not published on $HOST_ADDR:$HOST_PORT (docker port shows: $(docker port "$CONTAINER" 2>/dev/null | tr '\n' ' '))"
INTERNAL_PORT="$(printf '%s' "$PORT_LINE" | sed -E 's|^([0-9]+)/tcp.*|\1|')"

# Carry over only this application's own settings from the running container.
ENV_FILE="$(mktemp)"
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" \
  | grep -E '^(RESURRECTION_[A-Z_]+|TRUST_PROXY|NODE_ENV|PORT)=' > "$ENV_FILE" || true
grep -q '^PORT=' "$ENV_FILE" || echo "PORT=$INTERNAL_PORT" >> "$ENV_FILE"
grep -q '^RESURRECTION_DATA_DIR=' "$ENV_FILE" || echo "RESURRECTION_DATA_DIR=$DATA_DEST" >> "$ENV_FILE"
DATA_DIR_ENV="$(sed -n 's/^RESURRECTION_DATA_DIR=//p' "$ENV_FILE")"
[ "$DATA_DIR_ENV" = "$DATA_DEST" ] || fail "RESURRECTION_DATA_DIR ($DATA_DIR_ENV) differs from the volume mount ($DATA_DEST); saves would go to the wrong place"

OLD_LIMITS="$(docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}' "$CONTAINER")"
log "current container : $CONTAINER ($OLD_STATE), image $OLD_IMAGE_REF"
log "published port    : $HOST_ADDR:$HOST_PORT -> $INTERNAL_PORT/tcp"
log "save volume       : $VOLUME mounted at $DATA_DEST"
log "current limits    : memory/nanocpus = $OLD_LIMITS (0 means unlimited)"
log "new limits        : memory $MEMORY, cpus $CPUS, pids $PIDS"
log "new image         : $NEW_IMAGE"

docker image inspect node:22-alpine >/dev/null 2>&1 \
  || log "note: node:22-alpine is not cached locally; the build will pull it from your registry or mirror"
PS_NOW="$(docker ps --format '{{.Names}} {{.Ports}}')"
if grep -F ":$CANDIDATE_PORT->" <<<"$PS_NOW" | grep -v "^$CAND " >/dev/null; then
  fail "port $CANDIDATE_PORT is used by another container; set P3_CANDIDATE_PORT to a free port"
fi

SAVES_BEFORE="$(docker run --rm -v "$VOLUME:/data:ro" node:22-alpine sh -c 'find /data -type f | wc -l' 2>/dev/null | tr -d ' ' || echo '?')"
log "files in $VOLUME  : $SAVES_BEFORE (read-only count)"

# ---- 2. build ---------------------------------------------------------------------------

log "building $NEW_IMAGE (the previous image is kept)"
docker build -t "$NEW_IMAGE" -t "$IMAGE_REPO:p3-latest" "$SRC"

# ---- 3. verify a throwaway candidate, never on the real volume ---------------------------

http_get() { curl -fsS --max-time 8 "$1"; }
# Fetches into a variable first, so grep -q closing early cannot break the pipe under pipefail.
page_has() {  # $1 url, $2 fixed text
  local body; body="$(http_get "$1")" || return 1
  grep -qF -- "$2" <<<"$body"
}
wait_healthy() {  # $1 container, $2 seconds
  local n="$1" t="$2" s
  for _ in $(seq 1 "$t"); do
    s="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$n" 2>/dev/null || echo gone)"
    [ "$s" = healthy ] && return 0
    [ "$(docker inspect -f '{{.State.Status}}' "$n" 2>/dev/null || echo gone)" = running ] || return 1
    sleep 1
  done
  return 1
}

# Common hardened run options. The candidate and the real container use the same ones.
run_opts=(--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true
          --memory "$MEMORY" --memory-swap "$MEMORY" --cpus "$CPUS" --pids-limit "$PIDS"
          --env-file "$ENV_FILE")

log "starting candidate on $HOST_ADDR:$CANDIDATE_PORT with its own temporary data volume"
cleanup_candidate
# An anonymous volume at the data path: the real saves volume is never mounted here. rm -v removes it afterwards.
docker run -d --name "$CAND" "${run_opts[@]}" -p "$HOST_ADDR:$CANDIDATE_PORT:$INTERNAL_PORT" \
  -v "$DATA_DEST" "$NEW_IMAGE" >/dev/null
wait_healthy "$CAND" 60 || { docker logs --tail 30 "$CAND" 2>&1 || true; fail "candidate did not become healthy within 60 s"; }

C="http://$HOST_ADDR:$CANDIDATE_PORT"
page_has "$C/api/health" '"status":"ok"'       || fail "candidate /api/health is not ok"
page_has "$C/p3/" 'A Life in Fragments'        || fail "candidate /p3/ does not serve the P3 page"
page_has "$C/p3" 'A Life in Fragments'         || fail "candidate /p3 (no slash) does not serve the P3 page"
for f in level.js game.js i18n.js audio.js; do
  http_get "$C/p3/$f" >/dev/null                             || fail "candidate /p3/$f is missing"
done
page_has "$C/p3/level.js" 'P3Level'            || fail "candidate /p3/level.js is not the P3 module"

# The original four-act page must be byte-identical to what is running now.
OLD_ROOT_SUM="$(http_get "http://$HOST_ADDR:$HOST_PORT/" | sha256sum | cut -d' ' -f1)" || fail "cannot read / from the running container"
NEW_ROOT_SUM="$(http_get "$C/" | sha256sum | cut -d' ' -f1)"
if [ "$OLD_ROOT_SUM" != "$NEW_ROOT_SUM" ]; then
  log "WARNING: / differs between the running container and the candidate. This is expected only if the running image is older than the P2 release."
  [ "${P3_ALLOW_ROOT_DIFF:-0}" = 1 ] || fail "four-act page changed. Review, then re-run with P3_ALLOW_ROOT_DIFF=1 if intended"
fi
CREATED="$(curl -fsS --max-time 8 -X POST "$C/api/sessions")" || fail "candidate session API did not create a session"
SID="$(sed -n 's/.*"sessionId":"\([a-f0-9]*\)".*/\1/p' <<<"$CREATED")"
[ -n "$SID" ] || fail "candidate session response has no sessionId"
page_has "$C/api/sessions/$SID" '"revision"'   || fail "candidate session API cannot read a session back"

# Limits and hardening as docker sees them.
LIMITS="$(docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}} {{.HostConfig.PidsLimit}} {{.HostConfig.ReadonlyRootfs}}' "$CAND")"
log "candidate limits (memory nanocpus pids readonly): $LIMITS"
case "$LIMITS" in 0\ *) fail "candidate has no memory limit";; esac
[ "$(docker inspect -f '{{.Config.User}}' "$CAND")" = node ] || fail "candidate does not run as the node user"
docker exec "$CAND" sh -c 'test -w "$RESURRECTION_DATA_DIR"' || fail "candidate cannot write to its data directory"
log "candidate checks passed: health, /p3/ routes, four-act page, session API, limits, writable data directory"
cleanup_candidate

if [ "$VERIFY_ONLY" = 1 ]; then
  log "--verify-only: nothing was changed on the running container. Run again without the flag to deploy."
  exit 0
fi

# ---- 4. back up saves (read-only mount), then swap --------------------------------------

mkdir -p "$STATE_DIR/backups"
if [ "${P3_SKIP_BACKUP:-0}" != 1 ]; then
  BACKUP="$STATE_DIR/backups/${VOLUME}-$TS.tar.gz"
  log "backing up $VOLUME to $BACKUP"
  docker run --rm -v "$VOLUME:/data:ro" -v "$STATE_DIR/backups:/backup" node:22-alpine \
    sh -c "tar czf /backup/$(basename "$BACKUP") -C /data . && ls -l /backup/$(basename "$BACKUP")" \
    || fail "backup failed; nothing was changed"
fi

PREV_NAME="${CONTAINER}-prev-$TS"
ROLLBACK_TAG="$IMAGE_REPO:rollback-$TS"
docker tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"
log "previous image kept as $ROLLBACK_TAG"

cat > "$STATE_DIR/last-deploy.env" <<EOF
CONTAINER=$CONTAINER
PREV_NAME=$PREV_NAME
PREV_OLD_STATE=$OLD_STATE
NEW_IMAGE=$NEW_IMAGE
ROLLBACK_TAG=$ROLLBACK_TAG
VOLUME=$VOLUME
HOST_ADDR=$HOST_ADDR
HOST_PORT=$HOST_PORT
DEPLOYED_AT=$TS
EOF
cp "$HERE/rollback.sh" "$STATE_DIR/rollback.sh"

log "swapping: stop and rename $CONTAINER to $PREV_NAME (kept, not deleted)"
docker update --restart=no "$CONTAINER" >/dev/null
docker stop "$CONTAINER" >/dev/null
docker rename "$CONTAINER" "$PREV_NAME"

start_new() {
  docker run -d --name "$CONTAINER" --restart unless-stopped "${run_opts[@]}" \
    --label quinnverse.app=resurrection-preview --label "quinnverse.version=$VERSION" \
    -p "$HOST_ADDR:$HOST_PORT:$INTERNAL_PORT" -v "$VOLUME:$DATA_DEST" "$NEW_IMAGE" >/dev/null
}
if ! start_new || ! wait_healthy "$CONTAINER" 60; then
  log "new container failed to start healthy; rolling back"
  docker logs --tail 30 "$CONTAINER" 2>&1 || true
  bash "$STATE_DIR/rollback.sh" || true
  fail "deploy failed and was rolled back; saves untouched. Logs above."
fi

# ---- 5. post-deploy checks, with automatic rollback -------------------------------------

L="http://$HOST_ADDR:$HOST_PORT"
post_ok=1
page_has "$L/api/health" '"status":"ok"'  || post_ok=0
page_has "$L/p3/" 'A Life in Fragments'   || post_ok=0
http_get "$L/" >/dev/null                 || post_ok=0
SAVES_AFTER="$(docker run --rm -v "$VOLUME:/data:ro" node:22-alpine sh -c 'find /data -type f | wc -l' 2>/dev/null | tr -d ' ' || echo '?')"
if [ "$SAVES_BEFORE" != '?' ] && [ "$SAVES_AFTER" != '?' ] && [ "$SAVES_AFTER" -lt "$SAVES_BEFORE" ]; then post_ok=0; fi
[ "$(docker inspect -f '{{range .Mounts}}{{.Name}}{{println}}{{end}}' "$CONTAINER" | grep -cx "$VOLUME")" = 1 ] || post_ok=0

if [ "$post_ok" != 1 ]; then
  log "post-deploy checks failed; rolling back"
  bash "$STATE_DIR/rollback.sh" || true
  fail "post-deploy checks failed and the previous release was restored"
fi

log "OK. Deployed $NEW_IMAGE. Save files: $SAVES_BEFORE before, $SAVES_AFTER after."
log "Previous container: $PREV_NAME (stopped). Previous image: $ROLLBACK_TAG."
log "Rollback:  bash $STATE_DIR/rollback.sh"
log "Check from your browser: https://resurrection.quinnverse.tech/p3/ and the main page /"
