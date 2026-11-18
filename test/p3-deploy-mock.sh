#!/usr/bin/env bash
# Exercises deploy/p3-preview/deploy.sh and rollback.sh against a fake `docker`.
# Each fake container is a real node process serving a real source tree, so the HTTP checks, the save
# persistence across versions, the swap and the rollback are all real. Only the docker layer is simulated.
#
#   bash test/p3-deploy-mock.sh <old-source-tree>      (old tree = a checkout of the previous release, e.g. d168c07)
#
# What this does NOT prove: that `docker build` succeeds, that the real daemon accepts the run options,
# that the Tencent host can pull node:22-alpine, or that nginx forwards /p3/. See docs/P3-TENCENT-PREVIEW.md.
set -uo pipefail

OLD_TREE="${1:?usage: p3-deploy-mock.sh <old-source-tree>}"
NEW_TREE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
W="$(mktemp -d)"
export MOCK="$W/mock" HOME="$W/home" P3_HOST_PORT=28080 P3_CANDIDATE_PORT=28081 P3_STATE_DIR="$W/state"
mkdir -p "$MOCK"/{c,img,vol,bin} "$HOME"

cat > "$MOCK/bin/docker" <<'MOCKDOCKER'
#!/usr/bin/env bash
# Minimal fake docker. State lives in $MOCK.
set -u
cdir() { echo "$MOCK/c/$1"; }
start_proc() {  # $1 name
  local d; d="$(cdir "$1")"
  local tree; tree="$(cat "$MOCK/img/$(cat "$d/imageref" | tr '/:' '__')")"
  local vol; vol="$(cat "$d/volhost")"
  mkdir -p "$vol"
  ( cd "$tree" && PORT="$(cat "$d/hostport")" RESURRECTION_DATA_DIR="$vol" TRUST_PROXY=1 exec node combined-server/server.js ) >/dev/null 2>&1 &
  echo $! > "$d/pid"; echo running > "$d/status"
  for _ in $(seq 1 30); do curl -fs "http://127.0.0.1:$(cat "$d/hostport")/api/health" >/dev/null 2>&1 && return 0; sleep 0.2; done
}
stop_proc() { local d; d="$(cdir "$1")"; [ -f "$d/pid" ] && kill "$(cat "$d/pid")" 2>/dev/null; wait "$(cat "$d/pid")" 2>/dev/null; echo exited > "$d/status"; }

cmd="$1"; shift
case "$cmd" in
  info|version) exit 0 ;;
  build)
    tags=(); ctx=""
    while [ $# -gt 0 ]; do if [ "$1" = -t ]; then tags+=("$2"); shift 2; else ctx="$1"; shift; fi; done
    for t in "${tags[@]}"; do echo "$ctx" > "$MOCK/img/$(echo "$t" | tr '/:' '__')"; done; exit 0 ;;
  tag) cp "$MOCK/img/$(echo "$1" | tr '/:' '__')" "$MOCK/img/$(echo "$2" | tr '/:' '__')" ;;
  volume) [ -d "$MOCK/vol/$2" ] ;;
  image) case "$2" in node:22-alpine) exit 0 ;; *) [ -f "$MOCK/img/$(echo "$2" | tr '/:' '__')" ] ;; esac ;;
  inspect)
    fmt=""; [ "$1" = "-f" ] && { fmt="$2"; shift 2; }; n="$1"; d="$(cdir "$n")"; [ -d "$d" ] || exit 1
    case "$fmt" in
      "") exit 0 ;;
      '{{.Image}}') cat "$d/imageref" ;;
      '{{.Config.Image}}') cat "$d/imageref" ;;
      '{{.State.Status}}') cat "$d/status" ;;
      *'{{.Name}}={{.Destination}}'*) echo "$(cat "$d/volname")=$(cat "$d/dest")" ;;
      *'range .Mounts'*'{{.Name}}{{println}}'*) cat "$d/volname" ;;
      *'range .Config.Env'*) cat "$d/env" ;;
      *'.HostConfig.Memory'*'PidsLimit'*) echo "$(cat "$d/mem") $(cat "$d/cpu") $(cat "$d/pids") true" ;;
      *'.HostConfig.Memory'*) echo "$(cat "$d/mem") $(cat "$d/cpu")" ;;
      *'.State.Health'*) if [ "$(cat "$d/status")" = running ] && curl -fs "http://127.0.0.1:$(cat "$d/hostport")/api/health" >/dev/null 2>&1; then echo healthy; else echo starting; fi ;;
      '{{.Config.User}}') echo node ;;
      *) echo "mock: unknown inspect format $fmt" >&2; exit 2 ;;
    esac ;;
  port) d="$(cdir "$1")"; echo "$(cat "$d/internal")/tcp -> 127.0.0.1:$(cat "$d/hostport")" ;;
  ps) for d in "$MOCK"/c/*; do [ -d "$d" ] && [ "$(cat "$d/status")" = running ] && echo "$(basename "$d") 127.0.0.1:$(cat "$d/hostport")->$(cat "$d/internal")/tcp"; done; exit 0 ;;
  update) exit 0 ;;
  logs) echo "(mock logs)"; exit 0 ;;
  exec) n="$1"; d="$(cdir "$n")"; test -w "$(cat "$d/volhost")" ;;
  stop) stop_proc "$1" ;;
  start) start_proc "$1" ;;
  rename) mv "$(cdir "$1")" "$(cdir "$2")" ;;
  rm) args=("$@"); n="${args[-1]}"; d="$(cdir "$n")"; [ -d "$d" ] && { stop_proc "$n"; rm -rf "$d"; }; exit 0 ;;
  run)
    detach=0; rm_after=0; name=""; hp=""; ip=""; vol=""; mem=0; cpu=0; pids=0; envf=""; args=("$@"); i=0; mounts=(); image=""
    while [ $i -lt ${#args[@]} ]; do a="${args[$i]}"; case "$a" in
      -d) detach=1 ;; --rm) rm_after=1 ;; --read-only) ;;
      --name) name="${args[$((i+1))]}"; i=$((i+1)) ;;
      -p) IFS=: read -r _ hp ip <<<"${args[$((i+1))]}"; i=$((i+1)) ;;
      -v) mounts+=("${args[$((i+1))]}"); i=$((i+1)) ;;
      --memory) mem=$(( $(echo "${args[$((i+1))]}" | tr -d m) * 1048576 )); i=$((i+1)) ;;
      --cpus) cpu=$(awk "BEGIN{print ${args[$((i+1))]}*1000000000}"); i=$((i+1)) ;;
      --pids-limit) pids="${args[$((i+1))]}"; i=$((i+1)) ;;
      --env-file) envf="${args[$((i+1))]}"; i=$((i+1)) ;;
      --tmpfs|--cap-drop|--security-opt|--memory-swap|--restart|--label) i=$((i+1)) ;;
      node:22-alpine) image=node:22-alpine; break ;;
      *) image="$a"; break ;; esac; i=$((i+1)); done
    if [ "$image" = node:22-alpine ]; then   # helper containers: file count and tar backup
      rest="${args[*]}"; vhost=""; bhost=""
      for m in "${mounts[@]}"; do case "$m" in *:/data:ro) vhost="$MOCK/vol/${m%%:*}" ;; *:/backup) bhost="${m%%:*}" ;; esac; done
      case "$rest" in
        *"find /data"*) find "$vhost" -type f | wc -l ;;
        *"tar czf"*) f="$(echo "$rest" | sed -n 's|.*tar czf /backup/\([^ ]*\).*|\1|p')"; tar czf "$bhost/$f" -C "$vhost" . && ls -l "$bhost/$f" ;;
        *) exit 1 ;; esac; exit $? ; fi
    [ "${MOCK_FAIL_RUN_NAME:-}" = "$name" ] && { echo "mock: refusing to start $name" >&2; exit 125; }
    d="$(cdir "$name")"; [ -d "$d" ] && { echo "mock: name in use" >&2; exit 125; }
    mkdir -p "$d"; echo "$image" > "$d/imageref"; echo "$hp" > "$d/hostport"; echo "$ip" > "$d/internal"
    echo "$mem" > "$d/mem"; echo "$cpu" > "$d/cpu"; echo "$pids" > "$d/pids"; cp "$envf" "$d/env"
    m="${mounts[0]:-/data}"; case "$m" in *:*) echo "${m%%:*}" > "$d/volname"; echo "${m#*:}" > "$d/dest"; echo "$MOCK/vol/${m%%:*}" > "$d/volhost" ;;
      *) echo "anon-$name" > "$d/volname"; echo "$m" > "$d/dest"; echo "$MOCK/vol/anon-$name" > "$d/volhost" ;; esac
    start_proc "$name"; echo "mockid-$name" ;;
  *) echo "mock docker: unsupported command $cmd" >&2; exit 2 ;;
esac
MOCKDOCKER
chmod +x "$MOCK/bin/docker"
export PATH="$MOCK/bin:$PATH"

pass=0; failn=0
ok()   { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad()  { failn=$((failn+1)); printf '  FAIL %s\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1  [$2]"; fi; }
cleanup() { for d in "$MOCK"/c/*; do [ -f "$d/pid" ] && kill "$(cat "$d/pid")" 2>/dev/null; done; rm -rf "$W"; }
trap cleanup EXIT

# --- initial state: the old release is running as resurrection-preview with a real save --------------
echo "$OLD_TREE" > "$MOCK/img/resurrection_old"
mkdir -p "$MOCK/vol/resurrection_saves"
printf 'TRUST_PROXY=1\nPORT=3000\nRESURRECTION_DATA_DIR=/data\nRESURRECTION_MAX_SESSIONS=2000\nPATH=/usr/bin\n' > "$W/oldenv"
docker run -d --name resurrection-preview --env-file "$W/oldenv" -p 127.0.0.1:28080:3000 -v resurrection_saves:/data resurrection:old >/dev/null
OLD_PID="$(cat "$MOCK/c/resurrection-preview/pid")"
SID="$(curl -fsS -X POST http://127.0.0.1:28080/api/sessions | sed -n 's/.*"sessionId":"\([a-f0-9]*\)".*/\1/p')"
OLD_ROOT="$(curl -fsS http://127.0.0.1:28080/ | sha256sum)"
check "setup: old release serves /, a save exists" "[ -n '$SID' ] && [ \"\$(find $MOCK/vol/resurrection_saves -type f | wc -l)\" -ge 1 ]"
check "setup: old release has no P3 page" "! curl -fs http://127.0.0.1:28080/p3/ | grep -qF 'The Internet Remembers You'"

echo "== 1. --verify-only leaves the running container alone"
bash "$NEW_TREE/deploy/p3-preview/deploy.sh" --verify-only > "$W/verify.log" 2>&1; rc=$?
check "verify-only exits 0" "[ $rc -eq 0 ]"
check "verify-only reports candidate checks passed" "grep -q 'candidate checks passed' $W/verify.log"
check "old container still the same process" "[ \"\$(cat $MOCK/c/resurrection-preview/pid)\" = '$OLD_PID' ] && kill -0 $OLD_PID"
check "candidate container removed" "[ ! -d $MOCK/c/resurrection-preview-candidate ]"

echo "== 2. full deploy"
bash "$NEW_TREE/deploy/p3-preview/deploy.sh" > "$W/deploy.log" 2>&1; rc=$?
[ $rc -ne 0 ] && sed 's/^/    | /' "$W/deploy.log" | tail -25
check "deploy exits 0" "[ $rc -eq 0 ]"
check "new container is resurrection-preview on 28080 serving /p3/" "curl -fs http://127.0.0.1:28080/p3/ | grep -qF 'The Internet Remembers You'"
check "four-act page unchanged after deploy" "[ \"\$(curl -fs http://127.0.0.1:28080/ | sha256sum)\" = '$OLD_ROOT' ]"
check "old session still readable on the new release" "curl -fs http://127.0.0.1:28080/api/sessions/$SID | grep -q revision"
check "old container kept (stopped) under a -prev- name" "ls $MOCK/c | grep -q '^resurrection-preview-prev-' && [ \"\$(cat $MOCK/c/resurrection-preview-prev-*/status)\" = exited ]"
check "previous image kept with a rollback tag" "ls $MOCK/img | grep -q '^resurrection_rollback-'"
check "version tag and p3-latest exist" "ls $MOCK/img | grep -q 'resurrection_p3-'"
check "save backup written" "ls $P3_STATE_DIR/backups/resurrection_saves-*.tar.gz"
check "rollback script copied to the state dir" "[ -x $P3_STATE_DIR/rollback.sh ] || [ -f $P3_STATE_DIR/rollback.sh ]"
check "new container mounts resurrection_saves at /data" "[ \"\$(cat $MOCK/c/resurrection-preview/volname)\" = resurrection_saves ] && [ \"\$(cat $MOCK/c/resurrection-preview/dest)\" = /data ]"
check "new container has memory and cpu limits" "[ \"\$(cat $MOCK/c/resurrection-preview/mem)\" -gt 0 ] && [ \"\$(cat $MOCK/c/resurrection-preview/cpu)\" -gt 0 ]"
check "app settings carried over, PATH not" "grep -q '^RESURRECTION_MAX_SESSIONS=2000' $MOCK/c/resurrection-preview/env && ! grep -q '^PATH=' $MOCK/c/resurrection-preview/env"

echo "== 3. rollback"
bash "$P3_STATE_DIR/rollback.sh" > "$W/rollback.log" 2>&1; rc=$?
[ $rc -ne 0 ] && sed 's/^/    | /' "$W/rollback.log" | tail -15
check "rollback exits 0" "[ $rc -eq 0 ]"
check "old release is back (no P3 page)" "! curl -fs http://127.0.0.1:28080/p3/ | grep -qF 'The Internet Remembers You'"
check "save still readable after rollback" "curl -fs http://127.0.0.1:28080/api/sessions/$SID | grep -q revision"
check "failed release kept for logs, not deleted" "ls $MOCK/c | grep -q '^resurrection-preview-failed-'"

echo "== 4. start failure rolls back automatically"
export MOCK_FAIL_RUN_NAME=resurrection-preview
bash "$NEW_TREE/deploy/p3-preview/deploy.sh" > "$W/fail.log" 2>&1; rc=$?
unset MOCK_FAIL_RUN_NAME
check "deploy reports failure (non-zero)" "[ $rc -ne 0 ]"
check "old release restored and answering" "curl -fs http://127.0.0.1:28080/api/health | grep -q ok"
check "save intact after failed deploy" "curl -fs http://127.0.0.1:28080/api/sessions/$SID | grep -q revision"

echo "== 5. refuses unsafe situations"
mv "$MOCK/vol/resurrection_saves" "$MOCK/vol/saves_moved"
bash "$NEW_TREE/deploy/p3-preview/deploy.sh" --verify-only > "$W/novol.log" 2>&1; rc=$?
check "missing save volume: refuses" "[ $rc -ne 0 ] && grep -q 'does not exist' $W/novol.log"
mv "$MOCK/vol/saves_moved" "$MOCK/vol/resurrection_saves"

echo
echo "mock deploy checks: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
