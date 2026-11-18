#!/usr/bin/env bash
# READ-ONLY inspection of the Tencent server before any deployment. It changes nothing: no container is started,
# stopped or renamed, no file is written, no image is built or pulled, nginx is not reloaded. It prints facts
# and PASS / WARN / FAIL lines. Environment variable VALUES are never printed (names only).
#
# Run it without uploading anything:
#     ssh <user>@<server> 'bash -s' < deploy/p3-preview/inspect.sh
# If docker needs sudo on that machine:
#     ssh -t <user>@<server> 'sudo bash -s' < deploy/p3-preview/inspect.sh
# Paste the whole output back so the plan can be checked before the real deploy.
set -u

CONTAINER="${P3_CONTAINER:-resurrection-preview}"
VOLUME="${P3_VOLUME:-resurrection_saves}"
HOST_PORT="${P3_HOST_PORT:-18080}"
CANDIDATE_PORT="${P3_CANDIDATE_PORT:-18081}"
SITE="${P3_SITE:-resurrection.quinnverse.tech}"

pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; }
info() { printf '      %s\n' "$*"; }
head1() { printf '\n== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
t() { if have timeout; then timeout 10 "$@"; else "$@"; fi; }

head1 "Machine"
info "time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')   user: $(id -un)   host: $(hostname 2>/dev/null)"
info "os: $( (. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") || uname -sr )"
info "disk free on /: $(df -h / 2>/dev/null | awk 'NR==2{print $4" of "$2" ("$5" used)"}')"
info "memory: $(free -m 2>/dev/null | awk 'NR==2{print $7" MB available of "$2" MB"}')"
have curl && pass "curl present" || fail "curl missing (deploy.sh needs it)"

head1 "Docker"
if ! have docker; then fail "docker not installed or not on PATH for this user"; DOCKER=0
elif ! t docker info >/dev/null 2>&1; then fail "docker is installed but this user cannot use it (try the sudo form of this command)"; DOCKER=0
else
  DOCKER=1; pass "docker works: $(t docker version --format '{{.Server.Version}}' 2>/dev/null)"
  info "running containers (names only; not touched by any script):"
  t docker ps --format '      {{.Names}}  {{.Image}}  {{.Ports}}' 2>/dev/null
fi

if [ "$DOCKER" = 1 ]; then
  head1 "The preview container: $CONTAINER"
  if ! t docker inspect "$CONTAINER" >/dev/null 2>&1; then
    fail "container $CONTAINER does not exist (deploy.sh only updates an existing preview)"
  else
    f() { t docker inspect -f "$1" "$CONTAINER" 2>/dev/null; }
    info "state:      $(f '{{.State.Status}}')   health: $(f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')   started: $(f '{{.State.StartedAt}}')"
    info "image:      $(f '{{.Config.Image}}')   id: $(f '{{.Image}}' | cut -c1-19)"
    info "created:    $(f '{{.Created}}')"
    info "user:       $(f '{{.Config.User}}')   restart: $(f '{{.HostConfig.RestartPolicy.Name}}')   read-only root: $(f '{{.HostConfig.ReadonlyRootfs}}')"
    info "limits:     memory=$(f '{{.HostConfig.Memory}}') nanocpus=$(f '{{.HostConfig.NanoCpus}}') pids=$(f '{{.HostConfig.PidsLimit}}')   (0 or <nil> means unlimited)"
    info "ports:      $(t docker port "$CONTAINER" 2>/dev/null | tr '\n' ' ')"
    info "mounts:     $(f '{{range .Mounts}}{{.Type}}:{{.Name}}->{{.Destination}} {{end}}')"
    info "env names:  $(f '{{range .Config.Env}}{{println .}}{{end}}' | sed 's/=.*//' | grep -E '^(RESURRECTION_|TRUST_PROXY|NODE_ENV|PORT)' | tr '\n' ' ')"
    t docker port "$CONTAINER" 2>/dev/null | grep -F "127.0.0.1:$HOST_PORT" >/dev/null && pass "published on 127.0.0.1:$HOST_PORT" || fail "NOT published on 127.0.0.1:$HOST_PORT"
    f '{{range .Mounts}}{{.Name}}{{println}}{{end}}' | grep -qx "$VOLUME" && pass "mounts volume $VOLUME" || fail "does not mount volume $VOLUME (deploy.sh would refuse)"
    DEST="$(f '{{range .Mounts}}{{.Name}}={{.Destination}}{{println}}{{end}}' | sed -n "s|^$VOLUME=||p" | head -n1)"
    DATA_ENV="$(f '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^RESURRECTION_DATA_DIR=//p')"
    [ -z "$DATA_ENV" ] && DATA_ENV="(not set: image default /data)"
    info "volume destination: ${DEST:-?}   RESURRECTION_DATA_DIR: $DATA_ENV"
    [ "$DATA_ENV" = "$DEST" ] || [ "$DATA_ENV" = "(not set: image default /data)" -a "$DEST" = "/data" ] && pass "data directory matches the volume mount" || warn "data directory and volume mount differ: deploy.sh will stop before touching anything"
    [ "$(f '{{.HostConfig.Memory}}')" = 0 ] && warn "no memory limit on the current container (the new one gets 256m unless you set P3_MEMORY)"
  fi

  head1 "Save volume: $VOLUME"
  if t docker volume inspect "$VOLUME" >/dev/null 2>&1; then
    pass "volume exists"
    MP="$(t docker volume inspect -f '{{.Mountpoint}}' "$VOLUME" 2>/dev/null)"
    info "mountpoint: $MP"
    if [ -r "$MP" ]; then info "files: $(find "$MP" -type f 2>/dev/null | wc -l)   size: $(du -sh "$MP" 2>/dev/null | cut -f1)   (read-only count)"; else info "mountpoint not readable by this user (that is fine; deploy.sh counts through a read-only helper container)"; fi
  else fail "volume $VOLUME does not exist (deploy.sh would refuse to start with an empty save volume)"; fi

  head1 "Images"
  t docker images --format '      {{.Repository}}:{{.Tag}}  {{.ID}}  {{.Size}}  {{.CreatedSince}}' 2>/dev/null | grep -E "resurrection|node" || info "(no resurrection or node images listed)"
  t docker image inspect node:22-alpine >/dev/null 2>&1 && pass "node:22-alpine is already cached (build needs no download)" || warn "node:22-alpine is not cached: the build must download it from your registry or mirror"
  if have curl; then
    code="$(curl -s -o /dev/null -m 6 -w '%{http_code}' https://registry-1.docker.io/v2/ 2>/dev/null)"
    case "$code" in 200|401) pass "Docker Hub reachable (HTTP $code)";; *) warn "Docker Hub not reachable from this server (HTTP ${code:-none}). If node:22-alpine is not cached, configure a registry mirror first";; esac
  fi
fi

head1 "Ports"
if have ss; then
  for p in "$HOST_PORT" "$CANDIDATE_PORT"; do
    owner="$(ss -ltnH "sport = :$p" 2>/dev/null | awk '{print $4}' | head -n1)"
    if [ "$p" = "$HOST_PORT" ]; then [ -n "$owner" ] && pass "port $p is listening on $owner (the running preview)" || warn "nothing listens on $p"
    else [ -z "$owner" ] && pass "port $p is free for the temporary candidate container" || fail "port $p is already used by $owner (set P3_CANDIDATE_PORT to a free port)"; fi
  done
else info "ss not available; skipping port checks"; fi

head1 "What the running preview serves now (localhost, GET only)"
if have curl; then
  b="http://127.0.0.1:$HOST_PORT"
  h="$(curl -s -m 6 "$b/api/health" 2>/dev/null)"; [ -n "$h" ] && pass "GET /api/health -> $h" || fail "GET $b/api/health gave nothing"
  info "GET / -> HTTP $(curl -s -m 6 -o /dev/null -w '%{http_code}' "$b/" 2>/dev/null), $(curl -s -m 6 "$b/" 2>/dev/null | wc -c) bytes, sha256 $(curl -s -m 6 "$b/" 2>/dev/null | sha256sum | cut -c1-16)  (the four-act page; must be identical after deploying)"
  p3="$(curl -s -m 6 "$b/p3/" 2>/dev/null)"
  if printf '%s' "$p3" | grep -q 'The Internet Remembers You'; then pass "/p3/ already serves P3.2"
  elif printf '%s' "$p3" | grep -q 'A Life in Fragments'; then info "/p3/ serves the earlier P3 prototype"
  elif [ -n "$p3" ]; then info "/p3/ returns the four-act page (the running image predates P3). This is expected before deploying"
  else warn "/p3/ returned nothing"; fi
  sess="$(curl -s -m 6 -o /dev/null -w '%{http_code}' "$b/api/sessions/0000000000000000000000000000000000000000000000000000000000000000" 2>/dev/null)"; info "GET /api/sessions/<unknown id> -> HTTP $sess (404 expected: the session API exists and rejects unknown ids)"
fi

head1 "Nginx (read-only)"
if ! have nginx; then warn "nginx not on PATH for this user (try the sudo form)"; else
  info "version: $(nginx -v 2>&1)"
  CONF="$( (nginx -T 2>/dev/null || true) )"
  if [ -z "$CONF" ]; then
    warn "cannot read the full nginx config as this user. Falling back to grep of /etc/nginx"
    grep -rn --include='*.conf' -E "server_name|proxy_pass|location" /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null | grep -E "$SITE|$HOST_PORT" | head -20
  else
    printf '%s\n' "$CONF" | grep -q "$SITE" && pass "a server block names $SITE" || fail "no server block names $SITE"
    printf '%s\n' "$CONF" | grep -q "127.0.0.1:$HOST_PORT" && pass "something proxies to 127.0.0.1:$HOST_PORT" || fail "nothing proxies to 127.0.0.1:$HOST_PORT"
    info "the relevant location blocks (lines mentioning port $HOST_PORT, with context):"
    printf '%s\n' "$CONF" | grep -n -B6 -A3 "127.0.0.1:$HOST_PORT" | sed 's/^/      /' | head -50
    if printf '%s\n' "$CONF" | awk -v s="$SITE" 'index($0,"server_name") && index($0,s){f=1} f&&/location[ \t]+\/[ \t]*\{/{print "yes"; exit}' | grep -q yes; then pass "found a catch-all 'location / {' in the site block, so /p3/ is forwarded without changes"
    else warn "no obvious catch-all 'location /' found. /p3/ may need its own location block (see the guide)"; fi
  fi
  t nginx -t >/dev/null 2>&1 && pass "nginx -t passes (nothing was reloaded)" || warn "nginx -t could not be run or failed as this user"
fi
if have curl; then
  for u in / /p3/; do
    c="$(curl -sk -m 8 --resolve "$SITE:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$SITE$u" 2>/dev/null)"
    info "through nginx on this machine: https://$SITE$u -> HTTP ${c:-none}   (401 means basic auth is on, which is fine)"
  done
fi

head1 "Summary"
info "Nothing was changed. Next steps are in docs/P3-TENCENT-PREVIEW.md. The real check of the new build is:"
info "  bash deploy/p3-preview/deploy.sh --verify-only    (builds, tests a throwaway candidate on 127.0.0.1:$CANDIDATE_PORT, does not touch $CONTAINER)"
