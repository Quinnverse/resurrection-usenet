// API contract tests for Resurrection
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3002;

// Helper to make HTTP requests
function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

describe('API Contract Tests', () => {
  let testServer;

  beforeAll((done) => {
    // Start a test server instance
    const http = require('http');
    const url = require('url');
    const fs = require('fs');
    
    // Load the server module
    const serverModule = require('../combined-server/server.js');
    
    testServer = serverModule.server;
    testServer.listen(PORT, done);
  });

  afterAll(() => {
    if (testServer) {
      testServer.close();
    }
  });

  test('GET /api/health returns status ok', async () => {
    const res = await apiRequest('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /api/messages returns messages array', async () => {
    const res = await apiRequest('/api/messages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    
    // Verify message structure
    const msg = res.body[0];
    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('threadId');
    expect(msg).toHaveProperty('agentId');
    expect(msg).toHaveProperty('content');
    expect(msg).toHaveProperty('metadata');
    expect(msg.metadata).toHaveProperty('timestamp');
    expect(msg.metadata).toHaveProperty('decayLevel');
    expect(msg.metadata).toHaveProperty('reconstructionLevel');
  });

  test('GET /api/threads/:threadId returns messages for thread', async () => {
    // First get a thread ID
    const messagesRes = await apiRequest('/api/messages');
    const threadId = messagesRes.body[0].threadId;
    
    const res = await apiRequest(`/api/threads/${threadId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/agents returns agents array', async () => {
    const res = await apiRequest('/api/agents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    
    // Verify agent structure
    const agent = res.body[0];
    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('name');
    expect(agent).toHaveProperty('description');
    expect(agent).toHaveProperty('currentMemoryState');
  });

  test('GET /api/game/state returns game state', async () => {
    const res = await apiRequest('/api/game/state');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('credits');
    expect(res.body).toHaveProperty('storyProgress');
    expect(res.body.storyProgress).toHaveProperty('discoveryPhase');
  });

  test('POST /api/threads/:threadId/choice with choice A', async () => {
    const messagesRes = await apiRequest('/api/messages');
    const threadId = messagesRes.body[0].threadId;
    
    const res = await apiRequest(`/api/threads/${threadId}/choice`, 'POST', { choice: 'A' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('choice', 'A');
    expect(res.body).toHaveProperty('gameState');
    expect(res.body).toHaveProperty('agentReactions');
  });

  test('POST /api/threads/:threadId/choice with choice B', async () => {
    const messagesRes = await apiRequest('/api/messages');
    const threadId = messagesRes.body[0].threadId;
    
    const res = await apiRequest(`/api/threads/${threadId}/choice`, 'POST', { choice: 'B' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('choice', 'B');
    expect(res.body).toHaveProperty('gameState');
    expect(res.body).toHaveProperty('agentReactions');
  });
});
