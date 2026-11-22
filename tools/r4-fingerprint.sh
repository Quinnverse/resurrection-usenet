#!/usr/bin/env bash
# Fingerprint of the game files: a hash of what git tracks under these paths. Documents, reports, releases, screenshots and
# the packaging tools are not part of it, so repackaging or writing a report does not change it. The CI "plan" job uses
# this to decide whether the full test suite already passed for exactly these files; run it locally to compare versions.
#   bash tools/r4-fingerprint.sh [rev]        (default: the working tree's index)
set -euo pipefail
cd "$(dirname "$0")/.."
git ls-files -s -- frontend combined-server backend/src shared test e2e playwright.config.js package.json package-lock.json Dockerfile \
  tools/v5-shell-run.mjs tools/v5-three-shim.mjs tools/v5-playthrough.mjs tools/v5-bundle.mjs tools/v5-serve.mjs tools/v5-guide-audit.mjs tools/v5-preview-saves.mjs \
  tools/r4-browser.mjs tools/r4-camera-scan.mjs tools/r4-fingerprint.sh ':(exclude)frontend/v5/rc' | sha256sum | cut -c1-24
