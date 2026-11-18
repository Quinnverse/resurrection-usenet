#!/usr/bin/env bash
# Builds the deployable source ZIP from a git commit (default HEAD). Runs on a machine with git and zip.
#   bash deploy/p3-preview/make-zip.sh [commit]
# Output: release/resurrection-p3-<sha7>.zip and release/SHA256SUMS. Only runtime files are included:
# Dockerfile, server, frontend (four-act game and frontend/p3), package.json, LICENSE and the deploy scripts.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
COMMIT="$(git rev-parse --verify "${1:-HEAD}^{commit}")"
SHORT="$(git rev-parse --short=7 "$COMMIT")"
NAME="resurrection-p3-$SHORT"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
git archive --format=tar --prefix="$NAME/" "$COMMIT" -- \
  Dockerfile .dockerignore package.json LICENSE combined-server frontend \
  deploy/p3-preview docs/P3-TENCENT-PREVIEW.md | tar -x -C "$STAGE"
printf 'p3-%s\n' "$SHORT" > "$STAGE/$NAME/VERSION"
# Fixed timestamps from the commit, so the same commit always produces the same file list and dates.
STAMP="$(git show -s --format=%cd --date=format:%Y%m%d%H%M.%S "$COMMIT")"
find "$STAGE/$NAME" -exec touch -t "$STAMP" {} +
mkdir -p release
rm -f "release/$NAME.zip"
( cd "$STAGE" && find "$NAME" -type f | LC_ALL=C sort | zip -X -q "$OLDPWD/release/$NAME.zip" -@ )
( cd release && sha256sum "$NAME.zip" >> SHA256SUMS.tmp && sort -u SHA256SUMS.tmp > SHA256SUMS && rm SHA256SUMS.tmp )
echo "built release/$NAME.zip from $COMMIT"
sha256sum "release/$NAME.zip"
