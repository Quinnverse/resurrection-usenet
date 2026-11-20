#!/bin/bash
# Double-click on a Mac (or run in a terminal): starts the V5 review server and opens the RC1 review hub.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20 or newer is needed: https://nodejs.org"; read -n 1 -s -r -p "Press any key to close"; exit 1; fi
node tools/v5-serve.mjs --open
