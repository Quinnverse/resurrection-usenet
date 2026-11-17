#!/bin/bash
# Resurrection - Test script
# Runs automated tests against the server

set -e

echo "Starting Resurrection Tests..."
echo "=============================="

# Start test server on a different port
cd combined-server
node server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
sleep 3

# Check health
echo "Checking health endpoint..."
curl -s http://localhost:3000/api/health | head -c 100

echo ""
echo ""
echo "Running API contract tests..."
node -e "
const http = require('http');

function request(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

async function run() {
  const tests = [
    { name: 'Health', path: '/api/health', check: r => r.status === 200 && r.body.status === 'ok' },
    { name: 'Messages', path: '/api/messages', check: r => r.status === 200 && Array.isArray(r.body) && r.body.length > 0 },
    { name: 'Agents', path: '/api/agents', check: r => r.status === 200 && Array.isArray(r.body) && r.body.length === 3 },
    { name: 'Game State', path: '/api/game/state', check: r => r.status === 200 && r.body.credits !== undefined },
    { name: 'Threads', path: '/api/threads/threads.tech.mind.98', check: r => r.status === 200 && Array.isArray(r.body) && r.body.length >= 3 },
  ];
  
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      const r = await request(t.path);
      if (t.check(r)) { console.log('PASS:', t.name); passed++; }
      else { console.log('FAIL:', t.name); failed++; }
    } catch(e) { console.log('FAIL:', t.name, '-', e.message); failed++; }
  }
  
  console.log('');
  console.log('Results:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

run();
"

# Cleanup
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "Tests complete!"
