// Resurrection Backend Server - Minimal HTTP Server
import http from 'http';
import { parse } from 'url';

import { store } from './database/memoryStore.js';
import * as messages from './api/messages.js';
import * as agents from './api/agents.js';
import * as game from './api/game.js';

const PORT = process.env.PORT || 3000;

store.initializeDefaultData();

function parseJSON(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function sendJSON(res: any, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: any, status: number, message: string) {
  sendJSON(res, status, { error: message });
}

async function handleRequest(req: any, res: any) {
  const parsedUrl = parse(req.url || '', true);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';

  try {
    if (pathname === '/api/health' && method === 'GET') {
      sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
      return;
    }

    if (pathname === '/api/messages' && method === 'GET') {
      sendJSON(res, 200, messages.getMessages());
      return;
    }

    if (pathname === '/api/messages' && method === 'POST') {
      const body = await parseJSON(req);
      const message = await messages.createMessage(body);
      sendJSON(res, 201, message);
      return;
    }

    if (pathname.startsWith('/api/messages/') && method === 'PUT' && pathname.endsWith('/reconstruct')) {
      const parts = pathname.split('/');
      const id = parts[3];
      const body = await parseJSON(req);
      const result = await messages.reconstructMessage(id, body.agentIds || ['archivist']);
      sendJSON(res, 200, result);
      return;
    }

    if (pathname.startsWith('/api/messages/') && method === 'GET') {
      const parts = pathname.split('/');
      const id = parts[3];
      const message = messages.getMessage(id);
      if (message) sendJSON(res, 200, message);
      else sendError(res, 404, 'Message not found');
      return;
    }

    if (pathname.startsWith('/api/threads/') && method === 'GET') {
      const parts = pathname.split('/');
      const threadId = parts[3];
      sendJSON(res, 200, messages.getThreadMessages(threadId));
      return;
    }

    if (pathname === '/api/agents' && method === 'GET') {
      sendJSON(res, 200, agents.getAgents());
      return;
    }

    if (pathname.startsWith('/api/agents/') && method === 'GET') {
      const parts = pathname.split('/');
      const id = parts[3];
      const agent = agents.getAgent(id);
      if (agent) sendJSON(res, 200, agent);
      else sendError(res, 404, 'Agent not found');
      return;
    }

    if (pathname.startsWith('/api/agents/') && method === 'POST' && pathname.includes('/query')) {
      const parts = pathname.split('/');
      const id = parts[3];
      const body = await parseJSON(req);
      const result = await agents.queryAgent(id, body.query || 'General inquiry', body.context);
      sendJSON(res, 200, result);
      return;
    }

    if (pathname === '/api/game/state' && method === 'GET') {
      sendJSON(res, 200, game.getGameState());
      return;
    }

    if (pathname === '/api/game/state' && method === 'PUT') {
      const body = await parseJSON(req);
      sendJSON(res, 200, game.updateGameState(body));
      return;
    }

    if (pathname === '/api/game/action' && method === 'POST') {
      const body = await parseJSON(req);
      const result = await game.performAction(body.actionType, body.targetId);
      sendJSON(res, 200, result);
      return;
    }

    if (pathname === '/api/game/ending' && method === 'GET') {
      sendJSON(res, 200, game.checkEnding());
      return;
    }

    sendError(res, 404, 'Not found');
  } catch (error: any) {
    sendError(res, 500, error.message || 'Internal error');
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log('Resurrection Backend running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
});

export { server };