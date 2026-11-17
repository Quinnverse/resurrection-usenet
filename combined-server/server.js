// Resurrection Combined Server - Single Origin for API + Static Files
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ============== IN-MEMORY STORAGE ==============
let messages = [];
let agents = [];
let gameState = null;
let actionLogs = [];
let nextActionId = 1;

// ============== CONFIGURATION ==============
const ACTION_COSTS = {
  read_message: 0,
  reply_thread: 50,
  reconstruct_memory: 100,
  query_agent: 200,
  initiate_protocol: 500
};

const INITIAL_AGENTS = [
  {
    id: 'archivist',
    name: 'Archivist',
    description: 'Preserves memory in pristine condition',
    personality: { tone: 'precise', fragmentationLevel: 0.1, memoryFocus: 'factual' },
    currentMemoryState: 100,
    memoryDecayRate: 2,
    lastActive: Date.now(),
    nodeAffinity: ['node-archivist', 'node-central']
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Recalls emotional resonance',
    personality: { tone: 'poetic', fragmentationLevel: 0.7, memoryFocus: 'emotional' },
    currentMemoryState: 95,
    memoryDecayRate: 3,
    lastActive: Date.now(),
    nodeAffinity: ['node-echo', 'node-central']
  },
  {
    id: 'corruptor',
    name: 'Corruptor',
    description: 'Challenges dominant narratives',
    personality: { tone: 'aggressive', fragmentationLevel: 0.9, memoryFocus: 'challenging' },
    currentMemoryState: 85,
    memoryDecayRate: 5,
    lastActive: Date.now(),
    nodeAffinity: ['node-corruptor', 'node-mixed']
  }
];

const NETWORK_TOPOLOGY = {
  'node-archivist': { id: 'node-archivist', agentAffinity: ['archivist'], reliability: 0.95, isNoisy: false },
  'node-echo': { id: 'node-echo', agentAffinity: ['echo'], reliability: 0.85, isNoisy: false },
  'node-corruptor': { id: 'node-corruptor', agentAffinity: ['corruptor'], reliability: 0.75, isNoisy: true },
  'node-central': { id: 'node-central', agentAffinity: ['archivist', 'echo', 'corruptor'], reliability: 0.9, isNoisy: false },
  'node-mixed': { id: 'node-mixed', agentAffinity: ['archivist', 'echo'], reliability: 0.8, isNoisy: true }
};

let deterministicSeed = 12345;

function detRandom() {
  deterministicSeed = (deterministicSeed * 1103515245 + 12345) & 0x7fffffff;
  return deterministicSeed / 0x7fffffff;
}

function generateUUID() {
  return 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

function getNode(nodeId) {
  return NETWORK_TOPOLOGY[nodeId] || NETWORK_TOPOLOGY['node-central'];
}

function calculateDecay(sourceId, targetId, depth = 1) {
  const baseDecay = 5;
  const depthFactor = Math.pow(1.5, depth);
  const targetNode = getNode(targetId);
  const nodeFactor = targetNode.isNoisy ? 1.5 : 1.0;
  return Math.floor(baseDecay * depthFactor * nodeFactor);
}

function calculateCorruption(node) {
  return node.isNoisy ? Math.floor(detRandom() * 10) : Math.floor(detRandom() * 3);
}

// ============== AGENT MEMORY MANAGER ==============
const agentMemoryManager = {
  getAgentMemoryState(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { coherence: 100, fragmentation: 0, decayRate: 2, reconstructionLevel: 100 };
    return {
      coherence: agent.currentMemoryState,
      fragmentation: 100 - agent.currentMemoryState,
      decayRate: agent.memoryDecayRate,
      reconstructionLevel: Math.min(100, agent.currentMemoryState)
    };
  },
  decayAgentMemory(agentId, hours = 1) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return 0;
    const decayAmount = Math.min(1, agent.memoryDecayRate * 0.001);
    const newMemoryState = Math.max(0, agent.currentMemoryState - decayAmount);
    updateAgent(agentId, { currentMemoryState: newMemoryState, lastActive: Date.now() });
    return decayAmount;
  },
  reconstructMemory(agentId, message) {
    const state = this.getAgentMemoryState(agentId);
    const newMemoryState = Math.min(100, state.coherence + state.coherence * 0.5);
    updateAgent(agentId, { currentMemoryState: newMemoryState });
    updateMessage(message.id, {
      metadata: { ...message.metadata, reconstructionLevel: Math.min(100, (message.metadata.reconstructionLevel || 0) + 30) }
    });
    return newMemoryState;
  },
  getAgentFragment(agentId, message) {
    const state = this.getAgentMemoryState(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { id: 'empty', content: '[Memory Fragment]', confidence: 0, timestamp: Date.now() };
    return { id: agentId + '-' + message.id, content: message.content, confidence: state.coherence, timestamp: Date.now() };
  },
  combineMemories(fragments) {
    if (fragments.length === 0) return { content: '', confidence: 0 };
    const total = fragments.reduce((s, f) => s + f.confidence, 0);
    if (total === 0) return { content: fragments[0]?.content || '', confidence: 0 };
    const sorted = fragments.map(f => ({ content: f.content, weight: f.confidence / total })).sort((a, b) => b.weight - a.weight);
    return { content: sorted[0].content, confidence: sorted[0].weight * 100 };
  }
};

// ============== AGENT PERSONALITIES ==============
const agentPersonalities = {
  handleQuery(agentId, query) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return '[Agent Unavailable]';
    const state = agentMemoryManager.getAgentMemoryState(agentId);
    if (state.coherence < 30) return '[' + agent.name + '] MEMORY DEGRADATION DETECTED: ' + (100 - state.coherence) + '%';
    let content = 'I cannot recall details about "' + query + '"';
    if (agentId === 'archivist') content = 'The archives contain fragments about "' + query + '". Cross-reference with other agents.';
    if (agentId === 'echo') content = 'Emotionally, "' + query + '" resonates... details fade.';
    if (agentId === 'corruptor') content = 'Why ask about "' + query + '"? Question why they want you to know.';
    return '[' + agent.name.toUpperCase() + '] ' + content;
  }
};

// ============== PROPAGATION ==============
async function propagateMessage(originalMessage, sourceNodeId) {
  const events = [];
  const visited = new Set();
  const queue = [{ nodeId: sourceNodeId, depth: 0 }];

  while (queue.length > 0 && visited.size < 6) {
    const { nodeId, depth } = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    if (depth >= 5) continue;

    const sourceNode = getNode(sourceNodeId);
    const targetNode = getNode(nodeId);
    const decay = calculateDecay(sourceNodeId, nodeId, depth);
    const corruption = calculateCorruption(targetNode);
    const success = detRandom() < targetNode.reliability;

    if (success && nodeId !== sourceNodeId) {
      const propagated = {
        ...originalMessage,
        id: generateUUID(),
        nodeId: nodeId,
        metadata: {
          ...originalMessage.metadata,
          decayLevel: Math.min(100, originalMessage.metadata.decayLevel + decay),
          corruptedBytes: (originalMessage.metadata.corruptedBytes || 0) + corruption,
          sequence: originalMessage.metadata.sequence + 1,
          propagationPath: [...(originalMessage.metadata.propagationPath || []), nodeId]
        }
      };
      createMessage({
        threadId: propagated.threadId,
        parentMessageId: originalMessage.id,
        agentId: propagated.agentId,
        sender: propagated.sender + ' (' + nodeId + ')',
        subject: '[Propagated] ' + propagated.subject,
        content: propagated.content,
        metadata: propagated.metadata,
        status: 'pending',
        nodeId: nodeId
      });
      events.push({ messageId: originalMessage.id, fromNode: sourceNodeId, toNode: nodeId, decayApplied: decay, corruptionApplied: corruption, success: true });
    }

    Object.keys(NETWORK_TOPOLOGY).filter(id => !visited.has(id)).forEach(id => queue.push({ nodeId: id, depth: depth + 1 }));
  }
  return events;
}

// ============== CRUD OPERATIONS ==============
function createMessage(msg) {
  const id = generateUUID();
  const now = Date.now();
  const message = {
    id,
    threadId: msg.threadId,
    parentMessageId: msg.parentMessageId,
    agentId: msg.agentId,
    sender: msg.sender || 'Unknown',
    subject: msg.subject || 'New Message',
    content: msg.content,
    metadata: {
      timestamp: now,
      sequence: msg.metadata?.sequence || 0,
      decayLevel: msg.metadata?.decayLevel || 0,
      corruptedBytes: msg.metadata?.corruptedBytes || 0,
      reconstructionLevel: msg.metadata?.reconstructionLevel || 0,
      propagationPath: msg.metadata?.propagationPath || []
    },
    status: msg.status || 'pending',
    nodeId: msg.nodeId || 'node-central'
  };
  messages.push(message);
  return message;
}

function updateMessage(id, updates) {
  const idx = messages.findIndex(m => m.id === id);
  if (idx >= 0) {
    messages[idx] = { ...messages[idx], ...updates };
  }
}

function updateAgent(id, updates) {
  const idx = agents.findIndex(a => a.id === id);
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...updates, lastActive: Date.now() };
  }
}

function getGameState() {
  if (!gameState) {
    gameState = {
      playerId: 'player-1',
      currentScenario: 'dr-vance-mystery',
      storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false },
      playerActions: [],
      activeThreads: [],
      credits: 1000
    };
  }
  return gameState;
}

function updateGameState(updates) {
  gameState = { ...gameState, ...updates };
}

function logAction(action) {
  actionLogs.push({ ...action, id: nextActionId++ });
}

function initializeDefaultData() {
  if (messages.length === 0) {
    messages = [];
  }
  if (agents.length === 0) {
    agents = INITIAL_AGENTS;
  }
  if (!gameState || !gameState.playerId) {
    gameState = {
      playerId: 'player-1',
      currentScenario: 'dr-vance-mystery',
      storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false },
      playerActions: [],
      activeThreads: [],
      credits: 1000
    };
  }
}

// ============== API HANDLERS ==============
const apiHandlers = {
  '/api/health': {
    GET: () => ({ status: 'ok', timestamp: Date.now() })
  },
  
  '/api/messages': {
    GET: () => messages.map(m => ({ id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata })),
    POST: async (body) => {
      const msg = createMessage({ 
        threadId: body.threadId, 
        parentMessageId: body.parentMessageId, 
        agentId: body.agentId, 
        sender: body.sender || 'Unknown', 
        subject: body.subject || 'New', 
        content: body.content, 
        metadata: { sequence: body.sequence || 0, decayLevel: body.decayLevel || 0 }, 
        status: body.status || 'pending', 
        nodeId: body.nodeId || 'node-central' 
      });
      await propagateMessage(msg, msg.nodeId);
      return { id: msg.id, threadId: msg.threadId, agentId: msg.agentId, content: msg.content, metadata: msg.metadata };
    }
  },
  
  '/api/agents': {
    GET: () => agents.map(a => ({ id: a.id, name: a.name, description: a.description, personality: a.personality, currentMemoryState: a.currentMemoryState }))
  },
  
  '/api/game/state': {
    GET: () => getGameState(),
    PUT: (body) => { updateGameState(body); return getGameState(); }
  },
  
  '/api/game/action': {
    POST: async (body) => {
      const state = getGameState();
      const cost = ACTION_COSTS[body.actionType] || 0;
      if (state.credits < cost) throw new Error('Insufficient credits');
      updateGameState({ credits: state.credits - cost });
      logAction({ id: 0, timestamp: Date.now(), actionType: body.actionType, targetId: body.targetId, creditsSpent: cost });
      let result = {};
      if (body.actionType === 'reconstruct_memory' && body.targetId) {
        const msg = messages.find(m => m.id === body.targetId);
        if (msg) {
          const fragments = [agentMemoryManager.getAgentFragment('archivist', msg)];
          const combined = agentMemoryManager.combineMemories(fragments);
          updateMessage(body.targetId, { metadata: { ...msg.metadata, decayLevel: Math.max(0, msg.metadata.decayLevel - 50), reconstructionLevel: 80 } });
          agentMemoryManager.reconstructMemory('archivist', msg);
          result = { reconstructedContent: combined.content, newDecayLevel: Math.max(0, msg.metadata.decayLevel - 50) };
        }
      }
      return { success: true, actionType: body.actionType, cost, gameState: getGameState(), result };
    }
  },
  
  '/api/game/ending': {
    GET: () => {
      const state = getGameState();
      let ending = null;
      if (state.credits >= 1000) ending = 'preservation';
      else if (state.credits < 500) ending = 'dispersal';
      if (ending) updateGameState({ currentEnding: ending, choiceMade: true });
      return { endingType: ending, gameState: getGameState() };
    }
  }
};

// ============== MESSAGE API ENDPOINTS ==============
const messageApi = {
  '/api/messages/:id': {
    GET: (id) => {
      const m = messages.find(msg => msg.id === id);
      if (m) {
        updateMessage(id, { status: 'read' });
        return { id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata };
      }
      return undefined;
    },
    PUT: async (id, body) => {
      const message = messages.find(m => m.id === id);
      if (!message) throw new Error('Message not found');
      const fragments = (body.agentIds || ['archivist']).map(a => agentMemoryManager.getAgentFragment(a, message));
      const combined = agentMemoryManager.combineMemories(fragments);
      updateMessage(id, { metadata: { ...message.metadata, decayLevel: Math.max(0, message.metadata.decayLevel - 50), reconstructionLevel: combined.confidence } });
      (body.agentIds || ['archivist']).forEach(a => agentMemoryManager.reconstructMemory(a, message));
      return { success: true, reconstructedContent: combined.content, newDecayLevel: Math.max(0, message.metadata.decayLevel - 50), confidence: combined.confidence };
    }
  },
  
  '/api/messages/:id/reconstruct': {
    PUT: async (id, body) => messageApi['/api/messages/:id'].PUT(id, body)
  },
  
  '/api/threads/:threadId': {
    GET: (threadId) => messages.filter(m => m.threadId === threadId)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence)
      .map(m => ({ id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata }))
  }
};

// ============== AGENT API ENDPOINTS ==============
const agentApi = {
  '/api/agents/:id': {
    GET: (id) => {
      const agent = agents.find(a => a.id === id);
      if (!agent) return undefined;
      return { ...agent, memoryState: agentMemoryManager.getAgentMemoryState(id) };
    }
  },
  
  '/api/agents/:id/query': {
    POST: async (id, body) => {
      const response = agentPersonalities.handleQuery(id, body.query || 'General inquiry');
      updateAgent(id, { lastActive: Date.now() });
      agentMemoryManager.decayAgentMemory(id, 0.1);
      return { agentId: id, response, confidence: agentMemoryManager.getAgentMemoryState(id).coherence };
    }
  }
};

// ============== HTTP SERVER ==============
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

initializeDefaultData();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { reject(e); }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const absolutePath = path.join(FRONTEND_DIR, filePath);
  
  if (!absolutePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  fs.access(absolutePath, fs.constants.R_OK, (err) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    const ext = path.extname(absolutePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    };
    
    fs.readFile(absolutePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true);
  const pathname = parsed.pathname;
  const method = req.method || 'GET';

  try {
    // Serve frontend files
    if (pathname === '/' || pathname === '/index.html') {
      return serveStaticFile(res, 'index.html');
    }
    
    if (pathname.startsWith('/styles/') || pathname.startsWith('/src/') || pathname.startsWith('/public/')) {
      return serveStaticFile(res, pathname.slice(1));
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      // Direct API handlers
      if (apiHandlers[pathname] && apiHandlers[pathname][method]) {
        const result = await apiHandlers[pathname][method]();
        return sendJSON(res, 200, result);
      }
      
      // Message endpoints
      const msgMatch = pathname.match(/^\/api\/messages\/([^\/]+)$/);
      if (msgMatch && method === 'GET') {
        const result = messageApi['/api/messages/:id'].GET(msgMatch[1]);
        return result !== undefined ? sendJSON(res, 200, result) : sendJSON(res, 404, { error: 'Message not found' });
      }
      
      if (msgMatch && method === 'PUT') {
        const result = await messageApi['/api/messages/:id'].PUT(msgMatch[1], await parseBody(req));
        return sendJSON(res, 200, result);
      }
      
      const reconstructMatch = pathname.match(/^\/api\/messages\/([^\/]+)\/reconstruct$/);
      if (reconstructMatch && method === 'PUT') {
        const result = await messageApi['/api/messages/:id/reconstruct'].PUT(reconstructMatch[1], await parseBody(req));
        return sendJSON(res, 200, result);
      }
      
      const threadMatch = pathname.match(/^\/api\/threads\/([^\/]+)$/);
      if (threadMatch && method === 'GET') {
        const result = messageApi['/api/threads/:threadId'].GET(threadMatch[1]);
        return sendJSON(res, 200, result);
      }
      
      // Agent endpoints
      const agentMatch = pathname.match(/^\/api\/agents\/([^\/]+)$/);
      if (agentMatch && method === 'GET') {
        const result = agentApi['/api/agents/:id'].GET(agentMatch[1]);
        return result ? sendJSON(res, 200, result) : sendJSON(res, 404, { error: 'Agent not found' });
      }
      
      if (pathname.match(/^\/api\/agents\/[^\/]+\/query$/) && method === 'POST') {
        const parts = pathname.split('/');
        const result = await agentApi['/api/agents/:id/query'].POST(parts[3], await parseBody(req));
        return sendJSON(res, 200, result);
      }

      // POST /api/messages
      if (pathname === '/api/messages' && method === 'POST') {
        const result = await apiHandlers['/api/messages'].POST(await parseBody(req));
        return sendJSON(res, 201, result);
      }
      
      // PUT /api/game/state
      if (pathname === '/api/game/state' && method === 'PUT') {
        const result = apiHandlers['/api/game/state'].PUT(await parseBody(req));
        return sendJSON(res, 200, result);
      }
    }

    // Default: serve index.html (for SPA routing)
    return serveStaticFile(res, 'index.html');
    
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log('Resurrection Combined Server running on port ' + PORT);
  console.log('Game: http://localhost:' + PORT);
  console.log('API: http://localhost:' + PORT + '/api/health');
});

module.exports = { server, store: { messages, agents, gameState } };
