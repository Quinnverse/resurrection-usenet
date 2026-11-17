#!/usr/bin/env bash
# Acceptance checks against the real public HTTPS address. Runs on the GitHub runner, not on the server.
# Usage:
#   acceptance.sh pre-restart   # creates and advances a session, stores its ID in $SESSION_FILE
#   acceptance.sh post-restart  # after the container restart, checks the same session is intact, then deletes it
# Credentials come from the environment (PREVIEW_USER, PREVIEW_PASSWORD) and are never printed.
set -euo pipefail

BASE=https://resurrection.quinnverse.tech
SESSION_FILE="${SESSION_FILE:-session.id}"
phase="${1:?usage: acceptance.sh pre-restart|post-restart}"
fails=0
check() { if [ "$2" = "ok" ]; then echo "PASS  $1"; else echo "FAIL  $1 ($2)"; fails=$((fails + 1)); fi; }

auth=(-u "$PREVIEW_USER:$PREVIEW_PASSWORD")
json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s);console.log(v[process.argv[1]]??"")}catch(e){console.log("")}})' "$1"; }

if [ "$phase" = pre-restart ]; then
  # Gate: every path must refuse unauthenticated visitors.
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/")
  check "unauthenticated homepage is blocked (got $code)" "$([ "$code" = 401 ] && echo ok || echo "$code")"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/sessions")
  check "unauthenticated session creation is blocked (got $code)" "$([ "$code" = 401 ] && echo ok || echo "$code")"
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/health")
  check "unauthenticated health endpoint is blocked (got $code)" "$([ "$code" = 401 ] && echo ok || echo "$code")"

  # Authenticated: homepage and HTTPS certificate.
  body=$(curl -sS "${auth[@]}" "$BASE/")
  check "authenticated homepage loads" "$(echo "$body" | grep -q 'RESURRECTION' && echo ok || echo 'title missing')"
  check "security headers present" "$(curl -sSI "${auth[@]}" "$BASE/" | grep -qi 'content-security-policy' && echo ok || echo missing)"

  # Session creation and gameplay through the real route.
  created=$(curl -sS "${auth[@]}" -X POST "$BASE/api/sessions")
  sid=$(echo "$created" | json_field sessionId)
  check "session creation returns a 64-hex ID" "$([[ "$sid" =~ ^[a-f0-9]{64}$ ]] && echo ok || echo "no id")"
  printf '%s' "$sid" > "$SESSION_FILE"

  act=$(curl -sS "${auth[@]}" -X POST "$BASE/api/sessions/$sid/actions" -H 'content-type: application/json' \
        -d '{"actionId":"accept-open-1","expectedRevision":0,"type":"OPEN_THREAD","payload":{}}')
  check "gameplay action applies (revision 1)" "$([ "$(echo "$act" | json_field revision)" = 1 ] && echo ok || echo "$act")"

  state=$(curl -sS "${auth[@]}" "$BASE/api/sessions/$sid")
  check "state projection returns evidence" "$(echo "$state" | grep -q '"evidence"' && echo ok || echo missing)"
fi

if [ "$phase" = post-restart ]; then
  sid=$(cat "$SESSION_FILE")
  state=$(curl -sS "${auth[@]}" "$BASE/api/sessions/$sid")
  check "progress survives container restart (revision 1)" "$([ "$(echo "$state" | json_field revision)" = 1 ] && echo ok || echo "revision lost")"
  check "session is still open after restart" "$(echo "$state" | grep -q '"permittedActions"' && echo ok || echo missing)"

  code=$(curl -sS "${auth[@]}" -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/sessions/$sid")
  check "save deletion works (got $code)" "$([ "$code" = 200 ] && echo ok || echo "$code")"
  code=$(curl -sS "${auth[@]}" -o /dev/null -w '%{http_code}' "$BASE/api/sessions/$sid")
  check "deleted save is gone (got $code)" "$([ "$code" = 404 ] && echo ok || echo "$code")"
fi

if [ "$fails" -gt 0 ]; then
  echo "acceptance FAILED: $fails check(s)"
  exit 1
fi
echo "acceptance PASSED ($phase)"
