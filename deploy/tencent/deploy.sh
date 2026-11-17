#!/usr/bin/env bash
# Deploys one Resurrection release on the host. Runs only after preflight.sh has passed.
# Usage: deploy.sh <full-commit-sha>
# stdin: three lines, in order: preview user name, preview password, certificate contact e-mail.
# These values are read into shell variables and never printed or placed in command arguments.
#
# Touches only Resurrection: its container (label quinnverse.app=resurrection), its save directory,
# its image tags, and its own nginx site file. Reloads nginx only after 'nginx -t' passes.
set -euo pipefail

SHA="${1:?usage: deploy.sh <full-commit-sha>}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid commit sha" >&2; exit 2; }

IFS= read -r PREVIEW_USER
IFS= read -r PREVIEW_PASSWORD
IFS= read -r CERT_EMAIL
[ "${#PREVIEW_PASSWORD}" -ge 16 ] || { echo "preview password must be at least 16 characters" >&2; exit 2; }
[[ "$PREVIEW_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]] || { echo "invalid preview user name" >&2; exit 2; }
[[ "$CERT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "invalid certificate e-mail" >&2; exit 2; }

HOST=resurrection.quinnverse.tech
PORT=3100
RELEASE_DIR="/opt/resurrection/releases/$SHA"
SAVE_DIR=/var/lib/resurrection/saves
STATE_DIR=/var/lib/resurrection/state
SITE=/etc/nginx/conf.d/resurrection.quinnverse.tech.conf
HTPASSWD=/etc/nginx/resurrection-preview.htpasswd
LABEL=quinnverse.app=resurrection

log() { printf '[deploy] %s\n' "$*"; }

container_exists() { [ -n "$(docker ps -aq --filter "name=^/$1$" 2>/dev/null)" ]; }

# Rollback touches only Resurrection objects. It is called on any failure after the first mutation.
ROLLBACK_NEEDED=0
created_site=0
rollback() {
  [ "$ROLLBACK_NEEDED" = 1 ] || return 0
  log "rolling back Resurrection only"
  if container_exists resurrection && [ -n "$(docker ps -aq --filter 'name=^/resurrection$' --filter "label=$LABEL")" ]; then
    docker rm -f resurrection >/dev/null 2>&1 || true
  fi
  if container_exists resurrection-prev; then
    docker rename resurrection-prev resurrection >/dev/null
    docker start resurrection >/dev/null || true
    log "restored previous container"
  fi
  if [ "$created_site" = 1 ]; then
    rm -f "$SITE"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || log "WARNING: nginx reload after rollback failed; check manually"
  fi
}
trap 'rc=$?; if [ "$rc" -ne 0 ]; then rollback; fi; exit "$rc"' EXIT

# 1. Unpack the release and build the image on the host (no registry, no secrets in build args).
log "unpacking release $SHA"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "/tmp/resurrection-$SHA.tgz" -C "$RELEASE_DIR"
docker build -q -t "resurrection:$SHA" "$RELEASE_DIR" >/dev/null
log "image built: resurrection:$SHA"

# 2. Persistent saves outside the container, owned by the container's unprivileged user (uid 1000).
install -d -m 0700 -o 1000 -g 1000 "$SAVE_DIR"
install -d -m 0700 "$STATE_DIR"

# 3. Keep the previous container as a stopped rollback copy, then start the new one.
ROLLBACK_NEEDED=1
if container_exists resurrection; then
  if [ -n "$(docker ps -aq --filter 'name=^/resurrection$' --filter "label=$LABEL")" ]; then
    docker stop resurrection >/dev/null
    docker rm -f resurrection-prev >/dev/null 2>&1 || true
    docker rename resurrection resurrection-prev
    log "previous container kept as resurrection-prev"
  else
    echo "a container named resurrection not created by this deployment exists" >&2
    exit 1
  fi
fi

docker run -d --name resurrection --label "$LABEL" --restart unless-stopped \
  -p "127.0.0.1:$PORT:3000" \
  -v "$SAVE_DIR:/data" \
  -e NODE_ENV=production -e PORT=3000 -e RESURRECTION_DATA_DIR=/data -e TRUST_PROXY=1 \
  -e RESURRECTION_RATE_CREATE_PER_HOUR=20 -e RESURRECTION_RATE_WRITE_PER_MINUTE=120 \
  -e RESURRECTION_MAX_SESSIONS=2000 -e RESURRECTION_MAX_STORAGE_MB=512 \
  --read-only --tmpfs /tmp:size=16m --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 256m --cpus 1 --user 1000:1000 \
  "resurrection:$SHA" >/dev/null
log "container started on 127.0.0.1:$PORT"

# 4. Health gate on the localhost port before any public routing changes.
healthy=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
[ "$healthy" = 1 ] || { echo "health check failed on localhost" >&2; exit 1; }
log "localhost health: ok"

# 5. Preview access gate: HTTP basic authentication at the existing nginx. Password is stored hashed.
umask 077
printf '%s:%s\n' "$PREVIEW_USER" "$(openssl passwd -apr1 "$PREVIEW_PASSWORD")" > "$HTPASSWD"
chmod 0640 "$HTPASSWD"
chown root:root "$HTPASSWD"
log "preview access gate written"

# 6. HTTP-only site first, so the certificate can be issued through the webroot.
write_site_http() {
  cat > "$SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;
    access_log off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
}
write_site_https() {
  cat > "$SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;
    access_log off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $HOST;
    ssl_certificate     /etc/letsencrypt/live/$HOST/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$HOST/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    client_max_body_size 32k;
    # Request paths carry session tokens; logging them would store credentials. Only this site is affected.
    access_log off;
    # nginx error lines quote the full request line, which holds the session token; only critical errors are kept.
    error_log /var/log/nginx/resurrection.critical.log crit;
    auth_basic "Resurrection private preview";
    auth_basic_user_file $HTPASSWD;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 30s;
    }
}
EOF
}
[ -e "$SITE" ] || created_site=1
write_site_http
nginx -t >/dev/null
systemctl reload nginx
log "HTTP site active for certificate issuance"

# 7. Certificate through the webroot (no nginx plugin, so no existing config is edited).
if [ ! -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then
  certbot certonly --webroot -w /var/www/html -d "$HOST" \
    --non-interactive --agree-tos -m "$CERT_EMAIL" --keep-until-expiring >/dev/null
  log "certificate issued"
fi

# 8. HTTPS site, tested before reload. Reload, not restart: other sites stay up.
write_site_https
nginx -t >/dev/null
systemctl reload nginx
log "HTTPS site active"

# 9. Retire the rollback copy only after the public site is live; keep the last image tag for rollback.
ROLLBACK_NEEDED=0
docker rm -f resurrection-prev >/dev/null 2>&1 || true
printf '%s\n' "$SHA" > "$STATE_DIR/current-release"
log "DEPLOY COMPLETE: release $SHA"
