# Agent Memory and Message Propagation Design

## 1. Agent Memory Architecture

### 1.1 Memory Storage Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Memory Pool                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Archivist   │  │    Echo     │  │ Corruptor   │            │
│  │  Memory     │  │  Memory     │  │  Memory     │            │
│  │  - Factual  │  │  - Emotional│  │  - Challenged│           │
│  │  - Complete │  │  - Fragmented│ │  - Altered  │            │
│  │  - Structured│ │  - Poetic   │  │  - Mixed    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│                  ┌────────▼────────┐                           │
│                  │  Memory Core    │                           │
│                  │  - Decay Rate   │                           │
│                  │  - Reconstruction│                          │
│                  │  - Propagation  │                           │
│                  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Memory State Structure

```typescript
interface AgentMemory {
  agentId: AgentId;
  primaryMemories: MemoryFragment[];
  secondaryMemories: MemoryFragment[];
  conflictingMemories: MemoryConflict[];
  currentState: MemoryState;
  lastUpdate: number;
}

interface MemoryFragment {
  id: string;
  content: MemoryContent;
  confidence: number;      // 0-100
  sourceAgents: AgentId[]; // Which agents remember this
  creationTime: number;
  lastModified: number;
}

interface MemoryContent {
  type: 'narrative' | 'fact' | 'emotion' | 'sensory';
  rawText: string;
  reconstructedText?: string;
  fragments?: MemoryFragment[]; // For fragmented content
}

interface MemoryConflict {
  id: string;
  memoryId: string;
  versions: MemoryVersion[];
  resolutionStatus: 'pending' | 'resolved' | 'suppressed';
  resolutionMethod?: 'voting' | 'authority' | 'time' | 'reconstruction';
}

interface MemoryVersion {
  agentId: AgentId;
  content: MemoryContent;
  timestamp: number;
  confidence: number;
}

interface MemoryState {
  coherence: number;       // 0-100 (100 = fully coherent)
  fragmentation: number;   // 0-100 (100 = highly fragmented)
  decayRate: number;       // Decay per hour
  reconstructionLevel: number; // 0-100
}
```

## 2. Message Propagation Design

### 2.1 Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    USENET Simulation                            │
│                                                                 │
│   Node A (Archivist) ────────┐                                  │
│          │                   │                                  │
│          ▼                   ▼                                  │
│   Node B (Echo)      Node C (Corruptor)                        │
│          │                   │                                  │
│          ▼                   ▼                                  │
│   Node D (Mixed)        Node E (Mixed)                         │
│          │                                                     │
│          ▼                                                     │
│   Node F (Player Access)                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Propagation Algorithm

```typescript
interface NetworkNode {
  id: string;
  agentAffinity: AgentId[];
  reliability: number;     // 0-1 (probability of clean propagation)
  isNoisy: boolean;
  lastContact: number;
}

interface PropagationEvent {
  messageId: string;
  fromNode: string;
  toNode: string;
  message: Message;
  timestamp: number;
  decayApplied: number;
  corruptionApplied: number;
  success: boolean;
}

async function propagateMessage(
  message: Message,
  sourceNode: NetworkNode
): Promise<PropagationEvent[]> {
  const events: PropagationEvent[] = [];
  const network = getNetworkTopology();
  
  // BFS propagation
  const visited = new Set<string>();
  const queue = [{ node: sourceNode, depth: 0 }];
  
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    
    // Stop propagation at max depth
    if (depth >= MAX_HOPS) continue;
    
    // Calculate propagation parameters
    const decay = calculateDecay(sourceNode.id, node.id, depth);
    const corruption = calculateCorruption(node);
    
    // Attempt propagation
    const success = Math.random() < node.reliability;
    
    if (success) {
      const propagatedMessage = {
        ...message,
        id: generateUUID(),
        nodeId: node.id,
        metadata: {
          ...message.metadata,
          decayLevel: Math.min(100, message.metadata.decayLevel + decay),
          corruptedBytes: (message.metadata.corruptedBytes || 0) + corruption,
          sequence: message.metadata.sequence + 1
        }
      };
      
      events.push({
        messageId: message.id,
        fromNode: sourceNode.id,
        toNode: node.id,
        message: propagatedMessage,
        timestamp: Date.now(),
        decayApplied: decay,
        corruptionApplied: corruption,
        success: true
      });
      
      // Store propagated message
      await storeMessage(propagatedMessage);
      
      // Add neighbors to queue
      const neighbors = network.filter(n => n.id !== node.id);
      queue.push(...neighbors.map(n => ({ node: n, depth: depth + 1 })));
    } else {
      events.push({
        messageId: message.id,
        fromNode: sourceNode.id,
        toNode: node.id,
        message: message,
        timestamp: Date.now(),
        decayApplied: decay,
        corruptionApplied: corruption,
        success: false
      });
    }
  }
  
  return events;
}

function calculateDecay(
  sourceId: string, 
  targetId: string, 
  depth: number
): number {
  // Base decay per hop
  const baseDecay = 5;
  
  // Depth multiplier (exponential decay)
  const depthFactor = Math.pow(1.5, depth);
  
  // Node-specific factor
  const targetNode = getNode(targetId);
  const nodeFactor = targetNode.isNoisy ? 1.5 : 1.0;
  
  return Math.floor(baseDecay * depthFactor * nodeFactor);
}

function calculateCorruption(node: NetworkNode): number {
  // Noisy nodes cause more corruption
  if (node.isNoisy) {
    return Math.floor(Math.random() * 15);
  }
  
  // Normal nodes cause some corruption
  return Math.floor(Math.random() * 5);
}
```

### 2.3 Propagation Timing

```typescript
// Asynchronous propagation schedule
const PROPAGATION_INTERVAL = 1000; // 1 second
const MAX_HOPS = 5; // Maximum network distance
const DECAY_THRESHOLD = 80; // Start visible decay effects

function startPropagationScheduler() {
  setInterval(async () => {
    // Check for pending messages
    const pendingMessages = await getPendingMessages();
    
    for (const message of pendingMessages) {
      const node = getNode(message.nodeId);
      await propagateMessage(message, node);
    }
    
    // Update agent memory states
    await updateAllAgentMemories();
  }, PROPAGATION_INTERVAL);
}
```

## 3. Memory Decay System

### 3.1 Decay Model

```typescript
interface DecayParameters {
  baseRate: number;           // Base decay per tick
  ageMultiplier: number;      // Multiplier for older messages
  reconstructionBonus: number; // Reduction from reconstruction
  nodeCorruption: number;     // Additional corruption per node
}

function calculateDecayLevel(
  message: Message,
  currentTime: number
): number {
  const params: DecayParameters = {
    baseRate: 2,              // 2% per hour
    ageMultiplier: 1.05,      // 5% more decay per hour of age
    reconstructionBonus: 30,  // 30% reduction from full reconstruction
    nodeCorruption: 2         // 2% per node hop
  };
  
  // Time-based decay
  const ageInHours = (currentTime - message.metadata.timestamp) / 3600000;
  const ageDecay = ageInHours * params.baseRate * Math.pow(params.ageMultiplier, ageInHours);
  
  // Reconstruction reduction
  const reconstructionReduction = message.metadata.reconstructionLevel 
    ? (message.metadata.reconstructionLevel / 100) * params.reconstructionBonus
    : 0;
  
  // Node corruption
  const nodeCorruption = (message.metadata.corruptedBytes || 0) * params.nodeCorruption;
  
  return Math.min(100, ageDecay - reconstructionReduction + nodeCorruption);
}
```

### 3.2 Visual Decay Effects

```typescript
function getDecayVisuals(decayLevel: number): DecayVisuals {
  if (decayLevel < 20) {
    return {
      opacity: 1,
      color: 'white',
      effect: 'none',
      message: 'Message preserved in full clarity'
    };
  } else if (decayLevel < 40) {
    return {
      opacity: 0.9,
      color: '#eee',
      effect: 'slight-fade',
      message: 'Message showing minor degradation'
    };
  } else if (decayLevel < 60) {
    return {
      opacity: 0.8,
      color: '#ccc',
      effect: 'moderate-corruption',
      message: 'Message partially corrupted'
    };
  } else if (decayLevel < 80) {
    return {
      opacity: 0.6,
      color: '#aaa',
      effect: 'heavy-corruption',
      message: 'Message heavily degraded - reconstruction recommended'
    };
  } else {
    return {
      opacity: 0.4,
      color: '#888',
      effect: 'severe-corruption',
      message: 'Message nearly unrecoverable'
    };
  }
}
```

## 4. Memory Reconstruction System

### 4.1 Reconstruction Process

```typescript
interface ReconstructionRequest {
  messageId: string;
  agentIds: AgentId[];  // Which agents to consult
  playerContribution?: string;
}

interface ReconstructionResult {
  messageId: string;
  success: boolean;
  newDecayLevel: number;
  reconstructedContent: string;
  confidence: number;
  agentsConsulted: AgentId[];
}

async function reconstructMemory(
  request: ReconstructionRequest
): Promise<ReconstructionResult> {
  const message = await getMessage(request.messageId);
  const agents = request.agentIds.length > 0 
    ? request.agentIds 
    : Object.values(AgentId);
  
  const agentResponses = await Promise.all(
    agents.map(async (agentId) => {
      const agent = await getAgent(agentId);
      return getAgentMemoryFragment(agent, message);
    })
  );
  
  // Combine fragments using agent weights
  const combinedContent = combineMemoryFragments(agentResponses);
  
  // Calculate confidence based on agreement
  const confidence = calculateConfidence(agentResponses);
  
  // Update message with reconstruction
  const newDecayLevel = Math.max(0, message.metadata.decayLevel - 50);
  
  await updateMessage(message.id, {
    metadata: {
      ...message.metadata,
      decayLevel: newDecayLevel,
      reconstructionLevel: confidence,
      lastReconstructed: Date.now()
    },
    content: combinedContent
  });
  
  return {
    messageId: request.messageId,
    success: confidence >= 50,
    newDecayLevel,
    reconstructedContent: combinedContent,
    confidence,
    agentsConsulted: agents
  };
}

function combineMemoryFragments(responses: MemoryFragment[]): string {
  // Weight by agent reliability
  const weights = {
    archivist: 0.4,
    echo: 0.35,
    corruptor: 0.25
  };
  
  // Combine fragments (simplified)
  const fragments = responses.map(r => ({
    content: r.content.rawText,
    weight: weights[r.agentId]
  }));
  
  // Simple weighted average (real implementation would use more sophisticated merging)
  const sorted = fragments.sort((a, b) => b.weight - a.weight);
  return sorted[0].content;
}

function calculateConfidence(responses: MemoryFragment[]): number {
  // High confidence if multiple agents agree
  const uniqueContents = new Set(responses.map(r => r.content.rawText));
  const agreementScore = (1 - (uniqueContents.size / responses.length)) * 100;
  
  return Math.round(agreementScore);
}
```

### 4.2 Reconstruction UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reconstruction Interface                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Select Agent Memories to Consult:                        │  │
│  │ [✓] Archivist - Precise, Factual                         │  │
│  │ [✓] Echo - Emotional, Fragmented                         │  │
│  │ [ ] Corruptor - Aggressive, Challenging                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Input Player Context (Optional):                         │  │
│  │ [________________________________________]               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Current Message Status:                                  │  │
│  │ [█░░░░░░░░░] 80% Decay                                  │  │
│  │ Message heavily degraded - reconstruction recommended    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Estimated Cost: 100 Credits                              │  │
│  │ [Reconstruct Memory] [Cancel]                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Agent Interaction Patterns

### 5.1 Direct Query System

```typescript
interface AgentQuery {
  agentId: AgentId;
  query: string;
  playerContext?: string;
}

interface AgentResponse {
  agentId: AgentId;
  response: string;
  confidence: number;
  bias: number;
  timestamp: number;
}

async function queryAgent(query: AgentQuery): Promise<AgentResponse> {
  const agent = await getAgent(query.agentId);
  
  // Determine response based on agent personality
  let responseContent: string;
  let confidence: number;
  let bias: number;
  
  switch (query.agentId) {
    case 'archivist':
      // Factual, detailed, but may omit uncomfortable truths
      responseContent = await generateArchivistResponse(query, agent);
      confidence = 0.85;
      bias = 0.2; // Slight optimism bias
      break;
      
    case 'echo':
      // Emotional, fragmented, may distort facts
      responseContent = await generateEchoResponse(query, agent);
      confidence = 0.6;
      bias = -0.3; // Emotional bias
      break;
      
    case 'corruptor':
      // Aggressive, challenges narratives, may invent
      responseContent = await generateCorruptorResponse(query, agent);
      confidence = 0.5;
      bias = 0.5; // Distrustful bias
      break;
  }
  
  // Apply memory state to response
  if (agent.currentMemoryState < 50) {
    responseContent += `\n\n[MEMORY DEGRADATION DETECTED: ${100 - agent.currentMemoryState}%]`;
    confidence *= 0.7;
  }
  
  return {
    agentId: query.agentId,
    response: responseContent,
    confidence,
    bias,
    timestamp: Date.now()
  };
}
```

### 5.2 Agent Personality Implementation

```typescript
// Archivist personality
const archivistPersonality = {
  tone: 'precise',
  fragmentationLevel: 0.1,
  memoryFocus: 'factual',
  responseStyle: (query: string, memory: AgentMemory): string => {
    // Detailed, structured responses
    // Emphasizes completeness
    // May downplay uncertainty
    
    const fragments = memory.primaryMemories
      .filter(m => m.confidence > 70)
      .map(m => m.content.rawText);
    
    return formatPreciseResponse(query, fragments);
  }
};

// Echo personality
const echoPersonality = {
  tone: 'poetic',
  fragmentationLevel: 0.7,
  memoryFocus: 'emotional',
  responseStyle: (query: string, memory: AgentMemory): string => {
    // Fragmented, emotional responses
    // Uses metaphor and poetic language
    // May sacrifice accuracy for emotional impact
    
    const fragments = memory.secondaryMemories
      .filter(m => m.confidence > 40)
      .map(m => m.content.rawText);
    
    return formatPoeticResponse(query, fragments);
  }
};

// Corruptor personality
const corruptorPersonality = {
  tone: 'aggressive',
  fragmentationLevel: 0.9,
  memoryFocus: 'challenging',
  responseStyle: (query: string, memory: AgentMemory): string => {
    // Challenging, cynical responses
    // Questions official narratives
    // May invent details for effect
    
    const fragments = memory.conflictingMemories
      .filter(m => m.resolutionStatus === 'pending')
      .map(m => m.versions[0].content.rawText);
    
    return formatAggressiveResponse(query, fragments);
  }
};
```

## 6. Deterministic Replay Support

### 6.1 Replay Log Structure

```typescript
interface ReplayLogEntry {
  timestamp: number;
  deterministicKey: string;  // Hash of all deterministic inputs
  actionType: 'message_propagation' | 'memory_decay' | 'player_action';
  payload: {
    messageId?: string;
    agentId?: AgentId;
    action?: PlayerAction;
  };
}

interface PlayerAction {
  type: ActionName;
  targetId: string;
  timestamp: number;
}

async function generateDeterministicReplay(
  startTime: number,
  endTime: number
): Promise<ReplayLogEntry[]> {
  const logs: ReplayLogEntry[] = [];
  
  // Get all messages created in timeframe
  const messages = await getMessagesInTimeframe(startTime, endTime);
  
  // Generate deterministic propagation events
  for (const message of messages) {
    const propagationEvents = await simulatePropagation(message);
    
    for (const event of propagationEvents) {
      logs.push({
        timestamp: event.timestamp,
        deterministicKey: generateDeterministicKey(event),
        actionType: 'message_propagation',
        payload: {
          messageId: message.id,
          agentId: message.agentId
        }
      });
    }
  }
  
  // Add memory decay events
  const agents = await getAllAgents();
  for (const agent of agents) {
    const decayEvents = await simulateMemoryDecay(agent, startTime, endTime);
    
    for (const event of decayEvents) {
      logs.push({
        timestamp: event.timestamp,
        deterministicKey: generateDeterministicKey(event),
        actionType: 'memory_decay',
        payload: {
          agentId: agent.id
        }
      });
    }
  }
  
  // Sort by timestamp
  return logs.sort((a, b) => a.timestamp - b.timestamp);
}
```

### 6.2 Replay Verification

```typescript
async function verifyReplay(
  originalLog: ReplayLogEntry[],
  replayedLog: ReplayLogEntry[]
): Promise<ReplayVerificationResult> {
  const results: VerificationResult[] = [];
  
  // Compare timestamps
  for (let i = 0; i < Math.min(originalLog.length, replayedLog.length); i++) {
    const orig = originalLog[i];
    const replay = replayedLog[i];
    
    if (orig.deterministicKey !== replay.deterministicKey) {
      results.push({
        type: 'determinism_failure',
        timestamp: orig.timestamp,
        originalKey: orig.deterministicKey,
        replayedKey: replay.deterministicKey
      });
    }
  }
  
  return {
    verified: results.length === 0,
    results
  };
}

interface ReplayVerificationResult {
  verified: boolean;
  results: VerificationResult[];
}

interface VerificationResult {
  type: 'determinism_failure' | 'timing_mismatch';
  timestamp: number;
  originalKey?: string;
  replayedKey?: string;
}
```

## 7. Testing Strategy for Agent Memory

### 7.1 Unit Tests

```typescript
// tests/memory/decay.test.ts
describe('Memory Decay', () => {
  test('calculates decay correctly', () => {
    const message = createTestMessage({ decayLevel: 0 });
    const decay = calculateDecayLevel(message, Date.now());
    expect(decay).toBeGreaterThan(0);
  });
  
  test('reconstruction reduces decay', () => {
    const message = createTestMessage({ decayLevel: 60, reconstructionLevel: 50 });
    const decay = calculateDecayLevel(message, Date.now());
    expect(decay).toBeLessThan(40);
  });
  
  test('no decay for fresh messages', () => {
    const message = createTestMessage({ decayLevel: 0 });
    const decay = calculateDecayLevel(message, Date.now());
    expect(decay).toBeLessThan(1); // Minimal floating point
  });
});

// tests/memory/propagation.test.ts
describe('Message Propagation', () => {
  test('propagates across network', async () => {
    const message = createTestMessage();
    const events = await propagateMessage(message, getNode('node-a'));
    expect(events.length).toBeGreaterThan(0);
  });
  
  test('decay increases with hops', async () => {
    const message = createTestMessage({ decayLevel: 0 });
    const events = await propagateMessage(message, getNode('node-a'));
    
    // Check that decay increases with network distance
    const depths = events.map(e => getNetworkDistance(e.fromNode, e.toNode));
    const decays = events.map(e => e.decayApplied);
    
    expect(depths).toEqual(expect.arrayContaining([1, 2]));
    expect(decays).toEqual(expect.arrayContaining([expect.any(Number)]));
  });
  
  test('corruption varies by node', async () => {
    const message = createTestMessage();
    const noisyNode = createNode({ isNoisy: true });
    const cleanNode = createNode({ isNoisy: false });
    
    const noisyEvents = await simulatePropagation(message, noisyNode);
    const cleanEvents = await simulatePropagation(message, cleanNode);
    
    const avgNoisyCorruption = noisyEvents.reduce((a, e) => a + e.corruptionApplied, 0) / noisyEvents.length;
    const avgCleanCorruption = cleanEvents.reduce((a, e) => a + e.corruptionApplied, 0) / cleanEvents.length;
    
    expect(avgNoisyCorruption).toBeGreaterThan(avgCleanCorruption);
  });
});

// tests/memory/reconstruction.test.ts
describe('Memory Reconstruction', () => {
  test('combines fragments correctly', () => {
    const fragments = [
      { content: { rawText: 'Fact A' }, agentId: 'archivist', confidence: 90 },
      { content: { rawText: 'Fact A' }, agentId: 'echo', confidence: 70 },
      { content: { rawText: 'Fact B' }, agentId: 'corruptor', confidence: 50 }
    ];
    
    const combined = combineMemoryFragments(fragments);
    expect(combined).toBe('Fact A'); // Higher confidence wins
  });
  
  test('confidence reflects agreement', () => {
    const fragments = [
      { content: { rawText: 'Same' }, agentId: 'archivist', confidence: 90 },
      { content: { rawText: 'Same' }, agentId: 'echo', confidence: 90 },
      { content: { rawText: 'Same' }, agentId: 'corruptor', confidence: 90 }
    ];
    
    const confidence = calculateConfidence(fragments);
    expect(confidence).toBeCloseTo(100);
  });
  
  test('high decay messages need reconstruction', () => {
    const message = createTestMessage({ decayLevel: 80 });
    expect(message.metadata.reconstructionLevel).toBeUndefined();
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/agent-memory-integration.test.ts
describe('Agent Memory Integration', () => {
  test('complete memory lifecycle', async () => {
    // 1. Create initial message
    const message = await createMessage({
      agentId: 'archivist',
      content: 'Initial memory fragment'
    });
    
    // 2. Propagate across network
    await propagateMessage(message, getNode('node-a'));
    
    // 3. Wait for decay
    await sleep(3600000); // 1 hour
    
    // 4. Check decay
    const decayedMessage = await getMessage(message.id);
    expect(decayedMessage.metadata.decayLevel).toBeGreaterThan(0);
    
    // 5. Reconstruct memory
    const result = await reconstructMemory({
      messageId: message.id,
      agentIds: ['archivist', 'echo']
    });
    
    // 6. Verify reconstruction
    expect(result.success).toBe(true);
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.newDecayLevel).toBeLessThan(decayedMessage.metadata.decayLevel);
  });
  
  test('agent memory state updates correctly', async () => {
    const initialMemory = await getAgentMemory('archivist');
    expect(initialMemory.currentMemoryState).toBe(100);
    
    // Trigger memory decay
    await decayAllAgents();
    
    const updatedMemory = await getAgentMemory('archivist');
    expect(updatedMemory.currentMemoryState).toBeLessThan(initialMemory.currentMemoryState);
  });
});
```