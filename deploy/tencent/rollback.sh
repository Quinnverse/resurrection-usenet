#!/usr/bin/env bash
# Rolls back Resurrection only: restores the previous container if one exists, otherwise removes the
# Resurrection container and its site file. Never touches other containers, volumes or nginx sites.
set -euo pipefail

SITE=/etc/nginx/conf.d/resurrection.quinnverse.tech.conf
log() { printf '[rollback] %s\n' "$*"; }

if [ -n "$(docker ps -aq --filter 'name=^/resurrection$' --filter 'label=quinnverse.app=resurrection')" ]; then
  docker rm -f resurrection >/dev/null
  log "removed current Resurrection container"
fi

if [ -n "$(docker ps -aq --filter 'name=^/resurrection-prev$')" ]; then
  docker rename resurrection-prev resurrection >/dev/null
  docker start resurrection >/dev/null
  log "restored previous Resurrection container"
else
  if [ -f "$SITE" ]; then
    rm -f "$SITE"
    nginx -t >/dev/null && systemctl reload nginx
    log "removed Resurrection site file (no previous release to restore)"
  fi
fi

echo "rollback finished; other services were not changed"
