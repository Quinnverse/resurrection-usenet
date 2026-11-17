// Resurrection Backend Server - Plain Node.js with JSON persistence
const http = require('http');
const url = require('url');
const persistence = require('./data/persistence.js');

// Initial default state
const INITIAL_AGENTS = [
  { id: 'archivist', name: 'Archivist', description: 'Preserves memory - precise, organized, detailed',
    personality: { tone: 'precise', fragmentationLevel: 0.1, memoryFocus: 'factual' },
    currentMemoryState: 100, memoryDecayRate: 2, lastActive: Date.now(), nodeAffinity: ['node-archivist', 'node-central'] },
  { id: 'echo', name: 'Echo', description: 'Recalls emotional resonance - fragmented, poetic, emotional',
    personality: { tone: 'poetic', fragmentationLevel: 0.7, memoryFocus: 'emotional' },
    currentMemoryState: 95, memoryDecayRate: 3, lastActive: Date.now(), nodeAffinity: ['node-echo', 'node-central'] },
  { id: 'corruptor', name: 'Corruptor', description: 'Challenges narratives - aggressive, cynical, fragmented',
    personality: { tone: 'aggressive', fragmentationLevel: 0.9, memoryFocus: 'challenging' },
    currentMemoryState: 85, memoryDecayRate: 5, lastActive: Date.now(), nodeAffinity: ['node-corruptor', 'node-mixed'] }
];

// Load persisted data or use defaults
const persisted = persistence.restoreAll();

const store = {
  messages: persisted.messages || [],
  agents: persisted.agents || INITIAL_AGENTS,
  gameState: persisted.state || {
    playerId: 'player-1', currentScenario: 'dr-vance-mystery',
    storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false },
    playerActions: [], activeThreads: [], credits: 1000
  },
  actionLogs: persisted.logs || [],
  nextActionId: 1,

  getMessage(id) { return this.messages.find(m => m.id === id); },
  getMessages() { return this.messages; },
  getThreadMessages(threadId) {
    return this.messages.filter(m => m.threadId === threadId)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence);
  },
  createMessage(msg) {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
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
    this.messages.push(message);
    this.save();
    return message;
  },
  updateMessage(id, updates) {
    const idx = this.messages.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.messages[idx] = { ...this.messages[idx], ...updates };
      this.save();
    }
  },
  getAgent(id) { return this.agents.find(a => a.id === id); },
  getAgents() { return this.agents; },
  updateAgent(id, updates) {
    const idx = this.agents.findIndex(a => a.id === id);
    if (idx >= 0) {
      this.agents[idx] = { ...this.agents[idx], ...updates, lastActive: Date.now() };
      this.save();
    }
  },
  getGameState() { return this.gameState; },
  updateGameState(updates) {
    this.gameState = { ...this.gameState, ...updates };
    this.save();
  },
  logAction(action) {
    this.actionLogs.push({ ...action, id: this.nextActionId++ });
    this.save();
  },
  save() {
    persistence.saveAll(this.gameState, this.agents, this.messages, this.actionLogs);
  },
  initializeDefaultData() {
    // If no persisted data, initialize defaults
    if (this.messages.length === 0) {
      this.messages = [];
    }
    if (this.agents.length === 0) {
      this.agents = INITIAL_AGENTS;
    }
    if (!this.gameState.playerId) {
      this.gameState = {
        playerId: 'player-1', currentScenario: 'dr-vance-mystery',
        storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false },
        playerActions: [], activeThreads: [], credits: 1000
      };
    }
    this.save();
  }
};

// Agent memory manager
const agentMemoryManager = {
  getAgentMemoryState(agentId) {
    const agent = store.getAgent(agentId);
    if (!agent) return { coherence: 100, fragmentation: 0, decayRate: 2, reconstructionLevel: 100 };
    return {
      coherence: agent.currentMemoryState,
      fragmentation: 100 - agent.currentMemoryState,
      decayRate: agent.memoryDecayRate,
      reconstructionLevel: Math.min(100, agent.currentMemoryState)
    };
  },
  decayAgentMemory(agentId) {
    const agent = store.getAgent(agentId);
    if (!agent) return 0;
    const decayAmount = Math.min(1, agent.memoryDecayRate * 0.001);
    const newMemoryState = Math.max(0, agent.currentMemoryState - decayAmount);
    store.updateAgent(agentId, { currentMemoryState: newMemoryState, lastActive: Date.now() });
    return decayAmount;
  },
  reconstructMemory(agentId, message) {
    const state = this.getAgentMemoryState(agentId);
    const newMemoryState = Math.min(100, state.coherence + state.coherence * 0.5);
    store.updateAgent(agentId, { currentMemoryState: newMemoryState });
    store.updateMessage(message.id, { metadata: { ...message.metadata, reconstructionLevel: Math.min(100, (message.metadata.reconstructionLevel || 0) + 30) } });
    return newMemoryState;
  },
  getAgentFragment(agentId, message) {
    const state = this.getAgentMemoryState(agentId);
    const agent = store.getAgent(agentId);
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

// Network topology
const NETWORK_TOPOLOGY = {
  'node-archivist': { id: 'node-archivist', agentAffinity: ['archivist'], reliability: 0.95, isNoisy: false },
  'node-echo': { id: 'node-echo', agentAffinity: ['echo'], reliability: 0.85, isNoisy: false },
  'node-corruptor': { id: 'node-corruptor', agentAffinity: ['corruptor'], reliability: 0.75, isNoisy: true },
  'node-central': { id: 'node-central', agentAffinity: ['archivist', 'echo', 'corruptor'], reliability: 0.9, isNoisy: false },
  'node-mixed': { id: 'node-mixed', agentAffinity: ['archivist', 'echo'], reliability: 0.8, isNoisy: true }
};

function getNode(nodeId) { return NETWORK_TOPOLOGY[nodeId] || NETWORK_TOPOLOGY['node-central']; }

// Deterministic random for replay
let deterministicSeed = 12345;
function deterministicRandom() {
  deterministicSeed = (deterministicSeed * 1103515245 + 12345) & 0x7fffffff;
  return deterministicSeed / 0x7fffffff;
}

// Network propagation with deterministic randomness
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
    const decay = Math.floor(5 * Math.pow(1.5, depth) * (targetNode.isNoisy ? 1.5 : 1.0));
    const corruption = targetNode.isNoisy ? Math.floor(deterministicRandom() * 10) : Math.floor(deterministicRandom() * 3);
    const success = deterministicRandom() < targetNode.reliability;
    
    if (success && nodeId !== sourceNodeId) {
      const propagated = {
        ...originalMessage,
        id: 'msg-' + deterministicRandom().toString(36).substr(2, 9) + '-' + Date.now().toString(36),
        nodeId: nodeId,
        metadata: {
          ...originalMessage.metadata,
          decayLevel: Math.min(100, originalMessage.metadata.decayLevel + decay),
          corruptedBytes: (originalMessage.metadata.corruptedBytes || 0) + corruption,
          sequence: originalMessage.metadata.sequence + 1,
          propagationPath: [...(originalMessage.metadata.propagationPath || []), nodeId]
        }
      };
      store.createMessage({
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

// Agent personalities
const agentPersonalities = {
  handleQuery(agentId, query) {
    const agent = store.getAgent(agentId);
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

// API handlers
const api = {
  getMessages: () => store.getMessages().map(m => ({ id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata })),
  getMessage: (id) => {
    const m = store.getMessage(id);
    if (m) { store.updateMessage(id, { status: 'read' }); return { id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata }; }
    return undefined;
  },
  getThreadMessages: (threadId) => store.getThreadMessages(threadId).map(m => ({ id: m.id, threadId: m.threadId, agentId: m.agentId, content: m.content, metadata: m.metadata })),
  createMessage: async (body) => {
    const msg = store.createMessage({ threadId: body.threadId, parentMessageId: body.parentMessageId, agentId: body.agentId, sender: body.sender || 'Unknown', subject: body.subject || 'New', content: body.content, metadata: { sequence: body.sequence || 0, decayLevel: body.decayLevel || 0 }, status: body.status || 'pending', nodeId: body.nodeId || 'node-central' });
    await propagateMessage(msg, msg.nodeId);
    return { id: msg.id, threadId: msg.threadId, agentId: msg.agentId, content: msg.content, metadata: msg.metadata };
  },
  reconstructMessage: async (id, agentIds) => {
    const message = store.getMessage(id);
    if (!message) throw new Error('Message not found');
    const fragments = agentIds.map(a => agentMemoryManager.getAgentFragment(a, message));
    const combined = agentMemoryManager.combineMemories(fragments);
    store.updateMessage(id, { metadata: { ...message.metadata, decayLevel: Math.max(0, message.metadata.decayLevel - 50), reconstructionLevel: combined.confidence } });
    agentIds.forEach(a => agentMemoryManager.reconstructMemory(a, message));
    return { success: true, reconstructedContent: combined.content, newDecayLevel: Math.max(0, message.metadata.decayLevel - 50), confidence: combined.confidence };
  },
  getAgents: () => store.getAgents().map(a => ({ id: a.id, name: a.name, description: a.description, personality: a.personality, currentMemoryState: a.currentMemoryState })),
  getAgent: (id) => {
    const agent = store.getAgent(id);
    if (!agent) return undefined;
    return { ...agent, memoryState: agentMemoryManager.getAgentMemoryState(id) };
  },
  queryAgent: async (id, query) => {
    const response = agentPersonalities.handleQuery(id, query || 'General inquiry');
    store.updateAgent(id, { lastActive: Date.now() });
    agentMemoryManager.decayAgentMemory(id, 0.1);
    return { agentId: id, response, confidence: agentMemoryManager.getAgentMemoryState(id).coherence };
  },
  getGameState: () => store.getGameState(),
  updateGameState: (updates) => { store.updateGameState(updates); return store.getGameState(); },
  performAction: async (actionType, targetId) => {
    const state = store.getGameState();
    const cost = { read_message: 0, reply_thread: 50, reconstruct_memory: 100, query_agent: 200, initiate_protocol: 500 }[actionType] || 0;
    if (state.credits < cost) throw new Error('Insufficient credits');
    store.updateGameState({ credits: state.credits - cost });
    store.logAction({ id: 0, timestamp: Date.now(), actionType, targetId, creditsSpent: cost });
    let result = {};
    if (actionType === 'reconstruct_memory' && targetId) {
      const msg = store.getMessage(targetId);
      if (msg) {
        const fragments = [agentMemoryManager.getAgentFragment('archivist', msg)];
        const combined = agentMemoryManager.combineMemories(fragments);
        store.updateMessage(targetId, { metadata: { ...msg.metadata, decayLevel: Math.max(0, msg.metadata.decayLevel - 50), reconstructionLevel: 80 } });
        agentMemoryManager.reconstructMemory('archivist', msg);
        result = { reconstructedContent: combined.content, newDecayLevel: Math.max(0, msg.metadata.decayLevel - 50) };
      }
    }
    return { success: true, actionType, cost, gameState: store.getGameState(), result };
  },
  checkEnding: () => {
    const state = store.getGameState();
    let ending = null;
    if (state.credits >= 1000) ending = 'preservation';
    else if (state.credits < 500) ending = 'dispersal';
    if (ending) store.updateGameState({ currentEnding: ending, choiceMade: true });
    return { endingType: ending, gameState: store.getGameState() };
  }
};

// HTTP server
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true);
  const pathname = parsed.pathname;
  const method = req.method || 'GET';
  
  function sendJSON(status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
  
  async function parseBody() {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); } });
    });
  }
  
  try {
    if (pathname === '/api/health' && method === 'GET') return sendJSON(200, { status: 'ok', timestamp: Date.now() });
    if (pathname === '/api/messages' && method === 'GET') return sendJSON(200, api.getMessages());
    if (pathname === '/api/messages' && method === 'POST') return sendJSON(201, await api.createMessage(await parseBody()));
    if (pathname === '/api/agents' && method === 'GET') return sendJSON(200, api.getAgents());
    if (pathname === '/api/game/state' && method === 'GET') return sendJSON(200, api.getGameState());
    if (pathname === '/api/game/state' && method === 'PUT') return sendJSON(200, api.updateGameState(await parseBody()));
    if (pathname === '/api/game/action' && method === 'POST') return sendJSON(200, await api.performAction((await parseBody()).actionType, (await parseBody()).targetId));
    if (pathname === '/api/game/ending' && method === 'GET') return sendJSON(200, api.checkEnding());
    
    const msgMatch = pathname.match(/^\/api\/messages\/([^\/]+)$/);
    if (msgMatch && method === 'GET') {
      const msg = api.getMessage(msgMatch[1]);
      return msg ? sendJSON(200, msg) : sendJSON(404, { error: 'Message not found' });
    }
    
    const threadMatch = pathname.match(/^\/api\/threads\/([^\/]+)$/);
    if (threadMatch && method === 'GET') return sendJSON(200, api.getThreadMessages(threadMatch[1]));
    
    const reconstructMatch = pathname.match(/^\/api\/messages\/([^\/]+)\/reconstruct$/);
    if (reconstructMatch && method === 'PUT') return sendJSON(200, await api.reconstructMessage(reconstructMatch[1], (await parseBody()).agentIds || ['archivist']));
    
    const agentMatch = pathname.match(/^\/api\/agents\/([^\/]+)$/);
    if (agentMatch && method === 'GET') {
      const agent = api.getAgent(agentMatch[1]);
      return agent ? sendJSON(200, agent) : sendJSON(404, { error: 'Agent not found' });
    }
    
    if (pathname.match(/^\/api\/agents\/[^\/]+\/query$/) && method === 'POST') {
      const parts = pathname.split('/');
      return sendJSON(200, await api.queryAgent(parts[3], (await parseBody()).query || 'General inquiry'));
    }
    
    sendJSON(404, { error: 'Not found' });
  } catch (error) {
    sendJSON(500, { error: error.message });
  }
});

// Initialize persistence
store.initializeDefaultData();

server.listen(PORT, () => {
  console.log('Resurrection Backend running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
});

module.exports = { server, store };