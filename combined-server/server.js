// Resurrection Combined Server - 90-Second Vertical Slice
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { createSessionApi } = require('./game/api');
const { createStore, scheduleRetention } = require('./game/store');

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

// ============== VERTICAL SLICE DATA ==============
const VERTICAL_SLICE_DATA = {
  threadId: 'threads.tech.mind.98',
  title: 'Dr. Elena Vance: conflicting death records',
  messages: [
    {
      id: 'msg-98-001',
      threadId: 'threads.tech.mind.98',
      agentId: 'archivist',
      sender: 'System Alert',
      subject: '=== CRITICAL DATA INTEGRITY WARNING ===',
      content: 'NOTICE: Multiple conflicting records detected in archived death records.\n\nSubject: Dr. Elena Vance\nStatus: DECEASED\nDate: 1998-11-15\nLocation: Research Lab 3\n\nTwo independent copies found:\n\nRecord A: Lab 3 - Failed protocol termination\nRecord B: Lab 4 - Unauthorized system override\n\nInvestigation recommended before authoritative record selection.',
      metadata: {
        timestamp: Date.now() - 120000,
        sequence: 1,
        decayLevel: 5,
        corruptedBytes: 0,
        reconstructionLevel: 95,
        propagationPath: ['node-central']
      },
      status: 'pending',
      nodeId: 'node-central'
    },
    {
      id: 'msg-98-002',
      recordStatus: 'contested',
      threadId: 'threads.tech.mind.98',
      agentId: 'archivist',
      sender: 'Archivist Node',
      subject: 'Record Fragment A - Lab 3',
      content: 'Record A: Death Certificate\n\nSubject: Dr. Elena Vance\nAffiliation: Vance Labs\nCause: Protocol failure during neural upload\nTime: 23:47:12\nLocation: Research Lab 3\n\nSignature: Dr. Aris Thorne (Lab Director)\nVerified: 1998-11-16 08:03:22\n\nNote: This record shows standard procedure was followed.',
      metadata: {
        timestamp: Date.now() - 300000,
        sequence: 2,
        decayLevel: 15,
        corruptedBytes: 0,
        reconstructionLevel: 80,
        propagationPath: ['node-archivist']
      },
      status: 'pending',
      nodeId: 'node-archivist'
    },
    {
      id: 'msg-98-003',
      recordStatus: 'contested',
      threadId: 'threads.tech.mind.98',
      agentId: 'echo',
      sender: 'Echo Node',
      subject: 'Record Fragment B - Lab 4',
      content: 'Record B: System Override Log\n\nSubject: Dr. Elena Vance\nAffiliation: Vance Labs\nAction: Unauthorized access\nTime: 23:45:08\nLocation: Research Lab 4\n\nSignature: UNKNOWN\nVerified: 1998-11-16 08:05:11\n\nNote: This record shows unauthorized system access BEFORE the protocol failure.\n\nConflicting timestamps suggest premeditated action.',
      metadata: {
        timestamp: Date.now() - 420000,
        sequence: 3,
        decayLevel: 35,
        corruptedBytes: 3,
        reconstructionLevel: 55,
        propagationPath: ['node-echo']
      },
      status: 'pending',
      nodeId: 'node-echo'
    },
    {
      id: 'msg-98-004',
      threadId: 'threads.tech.mind.98',
      agentId: 'corruptor',
      sender: 'Corruptor Node',
      subject: 'Anomaly Detected - Timeline Inconsistency',
      content: 'ANOMALY ALERT:\n\nA message was reconstructed with the following signature:\n\n"System override detected. Elena\'s consciousness fragmented during unauthorized upload. Lab 4 was compromised before the official protocol failure."\n\nThis message appears in the reconstruction log with timestamp:\n1998-11-16 08:00:00\n\nYet it references actions taken BEFORE the protocol failure (23:47:12).\n\nThis creates a temporal paradox unless... she was already fragments before death.',
      metadata: {
        timestamp: Date.now() - 180000,
        sequence: 4,
        decayLevel: 55,
        corruptedBytes: 7,
        reconstructionLevel: 30,
        propagationPath: ['node-corruptor', 'node-echo']
      },
      status: 'pending',
      nodeId: 'node-corruptor'
    }
  ]
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
      credits: 1000,
      verticalSlice: {
        choiceMade: null,
        choiceTimestamp: null,
        authoritativeRecord: null,
        recordsReconstructed: 0,
        agentReactions: { archivist: null, echo: null, corruptor: null }
      }
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
      credits: 1000,
      verticalSlice: {
        choiceMade: null,
        choiceTimestamp: null,
        authoritativeRecord: null,
        recordsReconstructed: 0,
        agentReactions: { archivist: null, echo: null, corruptor: null }
      }
    };
  }
}

// ============== API HANDLERS ==============
const apiHandlers = {
  '/api/health': {
    GET: () => ({ status: 'ok', timestamp: Date.now() })
  },
  
  '/api/messages': {
    GET: () => messages.map(toPublicMessage),
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
      
      // Vertical slice specific handling
      if (body.actionType === 'reconstruct_memory' && body.targetId) {
        const msg = messages.find(m => m.id === body.targetId);
        if (msg) {
          const fragments = [agentMemoryManager.getAgentFragment('archivist', msg)];
          const combined = agentMemoryManager.combineMemories(fragments);
          agentMemoryManager.reconstructMemory('archivist', msg);
          updateMessage(body.targetId, { metadata: { ...msg.metadata, decayLevel: Math.max(0, msg.metadata.decayLevel - 50), reconstructionLevel: 80 } });
          
          // Track reconstruction for vertical slice
          if (state.verticalSlice && !state.verticalSlice.choiceMade) {
            state.verticalSlice.recordsReconstructed = (state.verticalSlice.recordsReconstructed || 0) + 1;
          }
          
          result = { reconstructedContent: combined.content, newDecayLevel: Math.max(0, msg.metadata.decayLevel - 50) };
        }
      }
      
      return { success: true, actionType: body.actionType, cost, gameState: getGameState(), result };
    }
  },
  
  '/api/threads': {
    GET: () => listThreads()
  },

  '/api/game/reset': {
    POST: () => {
      resetGameData();
      return { reset: true, gameState: getGameState() };
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
        return toPublicMessage(messages.find(msg => msg.id === id));
      }
      return undefined;
    },
    PUT: async (id, body) => {
      const message = messages.find(m => m.id === id);
      if (!message) throw new Error('Message not found');
      const fragments = (body.agentIds || ['archivist']).map(a => agentMemoryManager.getAgentFragment(a, message));
      const combined = agentMemoryManager.combineMemories(fragments);
      (body.agentIds || ['archivist']).forEach(a => agentMemoryManager.reconstructMemory(a, message));
      updateMessage(id, { metadata: { ...message.metadata, decayLevel: Math.max(0, message.metadata.decayLevel - 50), reconstructionLevel: combined.confidence } });
      return { success: true, reconstructedContent: combined.content, newDecayLevel: Math.max(0, message.metadata.decayLevel - 50), confidence: combined.confidence };
    }
  },
  
  '/api/messages/:id/reconstruct': {
    PUT: async (id, body) => messageApi['/api/messages/:id'].PUT(id, body)
  },
  
  '/api/threads/:threadId': {
    GET: (threadId) => messages.filter(m => m.threadId === threadId)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence)
      .map(toPublicMessage)
  },
  
  // Vertical slice endpoints
  '/api/threads/:threadId/choice': {
    POST: async (threadId, body) => {
      const state = getGameState();
      const recordChoice = body.choice; // 'A' or 'B'
      if (recordChoice !== 'A' && recordChoice !== 'B') {
        throw new HttpError(400, 'choice must be "A" or "B"');
      }
      if (!messages.some(m => m.threadId === threadId)) {
        throw new HttpError(404, 'Thread not found');
      }
      if (state.verticalSlice.choiceMade) {
        throw new HttpError(409, 'A record has already been chosen in this game. Reset the game to choose again.');
      }
      
      // Mark choice as made
      state.verticalSlice.choiceMade = recordChoice;
      state.verticalSlice.choiceTimestamp = Date.now();
      state.verticalSlice.authoritativeRecord = recordChoice;
      messages.forEach(m => {
        if (m.id === 'msg-98-002') m.recordStatus = recordChoice === 'A' ? 'authoritative' : 'superseded';
        if (m.id === 'msg-98-003') m.recordStatus = recordChoice === 'B' ? 'authoritative' : 'superseded';
      });
      
      // Update story progress
      state.storyProgress.patternRecognition = true;
      state.storyProgress.truthUncovered = true;
      state.storyProgress.choiceMade = true;
      
      // Apply effects based on choice
      let archivistReaction, echoReaction, corruptorReaction;
      
      if (recordChoice === 'A') {
        // Player chose Record A - Archivist's version (standard procedure)
        archivistReaction = 'The archives confirm this record. Standard procedure was followed.';
        echoReaction = 'Emotionally, this resonates... but feels incomplete. The truth is buried.';
        corruptorReaction = 'Of course you chose the official story. They always win.';
        
        // Corruptor reveals the anomaly message
        const anomalyMsg = messages.find(m => m.id === 'msg-98-004');
        if (anomalyMsg) {
          anomalyMsg.metadata.reconstructionLevel = 90;
          anomalyMsg.metadata.decayLevel = Math.max(0, anomalyMsg.metadata.decayLevel - 20);
        }
        
        // Update other messages to show confirmation
        messages.forEach(m => {
          if (m.threadId === threadId && m.id !== 'msg-98-004') {
            m.metadata.reconstructionLevel = Math.min(100, m.metadata.reconstructionLevel + 20);
          }
        });
      } else if (recordChoice === 'B') {
        // Player chose Record B - Echo's version (unauthorized access)
        archivistReaction = 'This contradicts the official record. The archives reject this interpretation.';
        echoReaction = 'Yes! This is what I felt... the truth beneath the silence.';
        corruptorReaction = 'Good. The official narrative is always corrupted.';
        
        // Archivist reveals hidden message about temporal paradox
        const tempMsg = {
          id: generateUUID(),
          threadId: threadId,
          agentId: 'archivist',
          sender: 'Archivist Node',
          subject: 'Temporal Anomaly Detected',
          content: 'ALERT: Temporal consistency violation detected.\n\nMessage reconstructed with timestamp:\n1998-11-16 07:59:58\n\nThis message predates the protocol failure by 7 minutes 14 seconds.\n\nElena\'s consciousness fragmented BEFORE her physical death.',
          metadata: {
            timestamp: Date.now() - 60000,
            sequence: 99,
            decayLevel: 25,
            corruptedBytes: 0,
            reconstructionLevel: 75,
            propagationPath: ['node-archivist']
          },
          status: 'pending',
          nodeId: 'node-archivist'
        };
        messages.push(tempMsg);
        
        // Update other messages to show confirmation
        messages.forEach(m => {
          if (m.threadId === threadId && m.id !== tempMsg.id) {
            m.metadata.reconstructionLevel = Math.min(100, m.metadata.reconstructionLevel + 15);
          }
        });
      }
      
      // Record agent reactions
      state.verticalSlice.agentReactions = {
        archivist: archivistReaction,
        echo: echoReaction,
        corruptor: corruptorReaction
      };
      
      logAction({ id: 0, timestamp: Date.now(), actionType: 'make_choice', targetId: threadId, creditsSpent: 0, payload: { choice: recordChoice } });
      
      return {
        success: true,
        choice: recordChoice,
        authoritativeRecord: recordChoice,
        gameState: getGameState(),
        agentReactions: {
          archivist: archivistReaction,
          echo: echoReaction,
          corruptor: corruptorReaction
        }
      };
    }
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

// ============== HELPERS (contract and state) ==============
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toPublicMessage(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    parentMessageId: m.parentMessageId,
    agentId: m.agentId,
    sender: m.sender,
    subject: m.subject,
    content: m.content,
    metadata: m.metadata,
    status: m.status,
    nodeId: m.nodeId,
    recordStatus: m.recordStatus || null
  };
}

function listThreads() {
  const byId = new Map();
  messages.forEach(m => {
    if (!byId.has(m.threadId)) byId.set(m.threadId, []);
    byId.get(m.threadId).push(m);
  });
  return Array.from(byId.entries()).map(([id, list]) => {
    const title = id === VERTICAL_SLICE_DATA.threadId
      ? VERTICAL_SLICE_DATA.title
      : (list[0].subject || 'Untitled transmission');
    return { id, title, messageCount: list.length };
  });
}

// Restores the seeded archive and player state. Used at startup and by POST /api/game/reset.
function resetGameData() {
  messages = JSON.parse(JSON.stringify(VERTICAL_SLICE_DATA.messages));
  agents = JSON.parse(JSON.stringify(INITIAL_AGENTS));
  gameState = null;
  actionLogs = [];
  nextActionId = 1;
  deterministicSeed = 12345;
  getGameState();
}

// ============== HTTP SERVER ==============
const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 16 * 1024;
const SAVE_DIR = process.env.RESURRECTION_DATA_DIR || path.join(__dirname, 'data');
const sessionStore = createStore(SAVE_DIR);
const LIMITS = {
  createPerHour: Number(process.env.RESURRECTION_RATE_CREATE_PER_HOUR ?? 20),
  writesPerMinute: Number(process.env.RESURRECTION_RATE_WRITE_PER_MINUTE ?? 120),
  maxSessions: Number(process.env.RESURRECTION_MAX_SESSIONS ?? 2000),
  maxBytes: Number(process.env.RESURRECTION_MAX_STORAGE_MB ?? 512) * 1024 * 1024
};
const sessionApi = createSessionApi({ store: sessionStore, limits: LIMITS });

// Client address for rate limiting. Behind a reverse proxy (TRUST_PROXY=1) the proxy's forwarded address is used.
// Addresses are used only as in-memory keys: they are never logged or written to saves.
function clientKeyFor(req) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

// Removes saves inactive for seven days before the first request, then every 24 hours.
function logRetention(result) {
  if (result.expired || result.orphans) {
    console.log(`Save retention: removed ${result.expired} expired save(s) and ${result.orphans} orphaned temp file(s).`);
  }
}
logRetention(sessionStore.cleanupExpired());
scheduleRetention(sessionStore, { onRun: logRetention });

// Error text is logged without session IDs or the save directory path.
function redactForLog(value) {
  return String(value).split(SAVE_DIR).join('[save directory]').replace(/[a-f0-9]{64}/g, '[session]');
}
const FRONTEND_DIR = path.join(__dirname, '../frontend');

resetGameData();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new HttpError(413, 'Request body is too large'));
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { reject(new HttpError(400, 'Request body must be valid JSON')); }
    });
  });
}

function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  res.end(JSON.stringify(data));
}

const PAGE_SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY'
};

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
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream', ...PAGE_SECURITY_HEADERS });
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

    // P3 standalone level ("A Life in Fragments") at its own entry point
    if (pathname === '/p3' || pathname === '/p3/') {
      return serveStaticFile(res, 'p3/index.html');
    }
    if (pathname.startsWith('/p3/')) {
      return serveStaticFile(res, pathname.slice(1));
    }

    // P4 3D narrative vertical slice, separate from P3 and the four-act game
    if (pathname === '/p4' || pathname === '/p4/') {
      return serveStaticFile(res, 'p4/index.html');
    }
    if (pathname.startsWith('/p4/')) {
      return serveStaticFile(res, pathname.slice(1));
    }

    // Resurrection V5, the full game, plus its technical demonstration page
    if (pathname === '/v5' || pathname === '/v5/') {
      return serveStaticFile(res, 'v5/index.html');
    }
    if (pathname === '/v5/tech' || pathname === '/v5/tech/') {
      return serveStaticFile(res, 'v5/tech.html');
    }
    if (pathname === '/v5/audio' || pathname === '/v5/audio/') {
      return serveStaticFile(res, 'v5/audio.html');
    }
    if (pathname.startsWith('/v5/')) {
      return serveStaticFile(res, pathname.slice(1));
    }

    // P5 playable slice (V3.4), separate from P4, P3 and the four-act game
    if (pathname === '/p5' || pathname === '/p5/') {
      return serveStaticFile(res, 'p5/index.html');
    }
    if (pathname.startsWith('/p5/')) {
      return serveStaticFile(res, pathname.slice(1));
    }

    // Session API (persistent, versioned game state)
    if (pathname.startsWith('/api/sessions')) {
      const sessionResult = await sessionApi.handle({ method, pathname, readBody: () => parseBody(req), clientKey: clientKeyFor(req) });
      if (sessionResult) return sendJSON(res, sessionResult.status, sessionResult.body, sessionResult.headers || {});
    }

    // Legacy API routes (global in-memory state, kept for the existing test suite)
    if (pathname.startsWith('/api/')) {
      // Direct API handlers
      if (apiHandlers[pathname] && apiHandlers[pathname][method]) {
        const body = (method === 'POST' || method === 'PUT') ? await parseBody(req) : undefined;
        const result = await apiHandlers[pathname][method](body);
        const status = (pathname === '/api/messages' && method === 'POST') ? 201 : 200;
        return sendJSON(res, status, result);
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
      
      // Vertical slice choice endpoint
      const choiceMatch = pathname.match(/^\/api\/threads\/([^\/]+)\/choice$/);
      if (choiceMatch && method === 'POST') {
        const result = await messageApi['/api/threads/:threadId/choice'].POST(choiceMatch[1], await parseBody(req));
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

      return sendJSON(res, 404, { error: 'Not found' });
    }

    // Default: serve index.html (for SPA routing)
    return serveStaticFile(res, 'index.html');
    
  } catch (error) {
    if (!(error.status) && process.env.NODE_ENV !== 'test') console.error('Unhandled error:', redactForLog(error.stack || error.message));
    sendJSON(res, error.status || 500, { error: error.status ? error.message : 'Internal server error', code: error.code || (error.status ? undefined : 'internal_error') });
  }
});

server.listen(PORT, () => {
  const boundPort = server.address().port;
  console.log('Resurrection Combined Server running on port ' + boundPort);
  console.log('Game: http://localhost:' + boundPort);
  console.log('API: http://localhost:' + boundPort + '/api/health');
});

module.exports = { server, store: { messages, agents, gameState } };
