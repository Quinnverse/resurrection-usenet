#!/bin/bash
# Same, but also reachable from a phone or tablet on the same Wi-Fi. The addresses to type on the phone are printed.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20 or newer is needed: https://nodejs.org"; read -n 1 -s -r -p "Press any key to close"; exit 1; fi
node tools/v5-serve.mjs --lan --open
