#!/usr/bin/env bash
# Read-only preflight for the Tencent Cloud host. Changes nothing.
# Prints a redacted before-state and exits non-zero on any conflict, so the deploy stage never runs.
# Never prints configuration bodies, environment variables, credentials or session data.
set -u

conflicts=0
note()  { printf '[preflight] %s\n' "$*"; }
bad()   { printf '[preflight] CONFLICT: %s\n' "$*"; conflicts=$((conflicts + 1)); }

note "host=$(hostname) kernel=$(uname -r) time=$(date -u +%FT%TZ)"

# --- container runtime -------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  note "docker=$(docker version --format '{{.Server.Version}}' 2>/dev/null)"
else
  bad "docker is missing or the current user cannot reach the docker daemon"
fi

# --- resources ---------------------------------------------------------------
avail_mb=$(free -m | awk '/Mem:/ {print $7}')
note "memory available=${avail_mb}MB"
[ "${avail_mb:-0}" -ge 800 ] || bad "less than 800MB memory available"

free_gb=$(df -BG / | awk 'NR==2 {gsub("G", "", $4); print $4}')
note "disk free on / = ${free_gb}GB"
[ "${free_gb:-0}" -ge 5 ] || bad "less than 5GB free on /"

# --- ports ----------------------------------------------------------------------
note "listening TCP ports (owner process names only):"
ss -H -ltnp 2>/dev/null | awk '{print $4}' | sort -u | sed 's/^/  /'
owner_of() { ss -H -ltnp "sport = :$1" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1; }
owner80=$(owner_of 80)
owner443=$(owner_of 443)
note "port 80 owner=${owner80:-none} port 443 owner=${owner443:-none}"
if [ "${owner443:-}" != "nginx" ]; then
  bad "port 443 is not served by a host nginx (found: ${owner443:-none}); routing into that proxy is not safe to automate"
fi
if [ -n "$(ss -H -ltn 'sport = :3100' 2>/dev/null)" ]; then
  bad "port 3100 (planned localhost port for Resurrection) is already in use"
fi

# --- existing containers (names, images and status only) --------------------------
note "containers (name image status):"
docker ps -a --format '  {{.Names}} {{.Image}} {{.Status}}' 2>/dev/null
if docker ps -aq --filter 'name=^/resurrection$' 2>/dev/null | grep -q .; then
  if [ -z "$(docker ps -aq --filter 'name=^/resurrection$' --filter 'label=quinnverse.app=resurrection' 2>/dev/null)" ]; then
    bad "a container named resurrection exists that was not created by this deployment"
  else
    note "an earlier Resurrection container exists and will be replaced (rollback copy kept)"
  fi
fi

# --- reverse proxy (host nginx) -------------------------------------------------------
if command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then
  note "nginx config test: ok"
  if nginx -T 2>/dev/null | grep -q 'server_name[^;]*resurrection\.quinnverse\.tech'; then
    bad "resurrection.quinnverse.tech is already routed by nginx"
  fi
  nginx -T 2>/dev/null | grep -qE '^\s*include\s+/etc/nginx/conf\.d/' \
    || bad "nginx does not include /etc/nginx/conf.d/*.conf; the new site file would not load"
else
  bad "nginx is missing or its configuration does not pass 'nginx -t'"
fi

# --- certificate prerequisites ----------------------------------------------------------
if [ -f /etc/letsencrypt/live/resurrection.quinnverse.tech/fullchain.pem ]; then
  note "certificate for resurrection.quinnverse.tech already exists"
else
  command -v certbot >/dev/null 2>&1 || bad "certbot is missing and no certificate exists for resurrection.quinnverse.tech"
  [ -d /var/www/html ] || bad "webroot /var/www/html is missing (needed for certificate issuance without touching nginx)"
fi

# --- system services (state only) -----------------------------------------------------------
for svc in nginx docker; do
  note "service $svc: $(systemctl is-active "$svc" 2>/dev/null || echo unknown)"
done

if [ "$conflicts" -gt 0 ]; then
  note "FAILED with $conflicts conflict(s). No changes were made."
  exit 1
fi
note "PASSED. Ready for deploy stage."
