#!/bin/bash
# Resurrection - Start script
# Starts the combined server on port 3000

set -e

cd "$(dirname "$0")/combined-server"

echo "Starting Resurrection Combined Server..."
echo "=========================================="
echo "Game: http://localhost:3000"
echo "API:  http://localhost:3000/api/health"
echo "=========================================="

node server.js
