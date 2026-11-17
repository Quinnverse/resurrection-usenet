# Technical Architecture Document

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Player Browser                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Terminal  │  │   Agent     │  │   Message   │            │
│  │   Renderer  │  │   Memory    │  │   Cache     │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│                  ┌────────▼────────┐                           │
│                  │  React State    │                           │
│                  │  Management     │                           │
│                  └────────┬────────┘                           │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │ HTTP / SSE API│
                    └───────┬───────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Node.js Backend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Express   │  │   SQLite    │  │  Game State │            │
│  │   Server    │  │  (Messages) │  │  Manager    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│                  ┌────────▼────────┐                           │
│                  │   Agent Loop    │                           │
│                  │   Propagation   │                           │
│                  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Module Breakdown

### 2.1 Core Modules

```
/projects/sandbox/
├── backend/
│   ├── server.js              # Express server entry
│   ├── api/                   # HTTP endpoints
│   │   ├── messages.js
│   │   ├── agents.js
│   │   ├── memory.js
│   │   └── game.js
│   ├── agents/                # Agent implementations
│   │   ├── archivist.js
│   │   ├── echo.js
│   │   ├── corruptor.js
│   │   └── propagation.js
│   ├── database/              # SQLite layer
│   │   ├── schema.sql
│   │   ├── pool.js
│   │   └── migrations/
│   ├── state/                 # Game state management
│   │   ├── gameState.js
│   │   ├── replay.js
│   │   └── deterministic.js
│   └── utils/
│       └── memoryDecay.js
├── frontend/
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── terminal/
│   │   │   ├── agents/
│   │   │   └── ui/
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Frontend utilities
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── styles/                # CSS including retro terminal
│       ├── terminal.css
│       └── crt.css
├── shared/                    # Shared types and constants
│   ├── messages.ts
│   ├── agents.ts
│   └── config.ts
└── scripts/                   # Build and data scripts
    ├── generate-content.js
    └── seed-database.js
```

## 3. Data Models

### 3.1 Message Schema

```typescript
interface Message {
  id: string;                    // UUID
  threadId: string;              // Thread identifier
  parentMessageId?: string;      // For nested threads
  agentId: AgentId;              // Archivist | Echo | Corruptor
  sender: string;                // Agent name + node ID
  recipient?: string;            // Optional direct recipient
  subject: string;
  content: string;               // Main message body
  metadata: {
    timestamp: number;           // Unix timestamp
    sequence: number;            // Message sequence in thread
    decayLevel: number;          // 0-100 (100 = fully decayed)
    corruptedBytes?: number;     // Simulated corruption
    reconstructionLevel?: number; // 0-100
  };
  status: 'pending' | 'delivered' | 'read';
  nodeId: string;                // Source node identifier
}
```

### 3.2 Agent Schema

```typescript
interface Agent {
  id: AgentId;                   // Archivist | Echo | Corruptor
  name: string;
  description: string;
  personality: AgentPersonality;
  currentMemoryState: number;    // 0-100
  memoryDecayRate: number;       // Decay per tick
  lastActive: number;
  nodeAffinity: string[];        // Nodes this agent monitors
}

type AgentId = 'archivist' | 'echo' | 'corruptor';

interface AgentPersonality {
  tone: 'precise' | 'poetic' | 'aggressive';
  fragmentationLevel: number;
  memoryFocus: 'factual' | 'emotional' | 'challenging';
}
```

### 3.3 Game State Schema

```typescript
interface GameState {
  playerId: string;
  currentScenario: string;
  storyProgress: StoryProgress;
  playerActions: ActionLog[];
  agentStates: Record<AgentId, Agent>;
  messageCache: Message[];
  activeThreads: string[];
  currentEnding?: EndingType;
  completionTimestamp?: number;
}

interface StoryProgress {
  discoveryPhase: number;        // 0-3
  patternRecognition: boolean;
  truthUncovered: boolean;
  choiceMade: boolean;
}

type EndingType = 'preservation' | 'dispersal';
```

## 4. API Endpoints

### 4.1 Messages

```
GET  /api/messages              - List all messages
GET  /api/messages/:id          - Get message by ID
GET  /api/threads/:threadId     - Get thread messages
POST /api/messages              - Post new message
POST /api/messages/:id/reply   - Reply to message
PUT  /api/messages/:id/reconstruct - Reconstruct message
```

### 4.2 Agents

```
GET  /api/agents                - List all agents
GET  /api/agents/:id            - Get agent details
POST /api/agents/:id/query      - Direct query to agent
```

### 4.3 Game

```
GET  /api/game/state            - Get current game state
PUT  /api/game/state            - Update game state (actions)
POST /api/game/replay           - Replay from deterministic state
GET  /api/game/ending           - Check current ending
```

### 4.4 System

```
GET  /api/system/health         - Health check
GET  /api/system/version        - Version info
```

## 5. Database Schema (SQLite)

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  parent_message_id TEXT,
  agent_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  node_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id)
);

-- Agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  personality TEXT NOT NULL,
  current_memory_state INTEGER NOT NULL,
  memory_decay_rate INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  node_affinity TEXT NOT NULL
);

-- Game state table
CREATE TABLE game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  player_id TEXT NOT NULL,
  scenario TEXT NOT NULL,
  discovery_phase INTEGER NOT NULL,
  pattern_recognition INTEGER NOT NULL,
  truth_uncovered INTEGER NOT NULL,
  choice_made INTEGER NOT NULL,
  ending TEXT,
  completion_timestamp INTEGER,
  updated_at INTEGER NOT NULL
);

-- Action log table
CREATE TABLE action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  payload TEXT,
  timestamp INTEGER NOT NULL
);

-- Replay log table
CREATE TABLE replay_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT,
  deterministic_key TEXT NOT NULL
);
```

## 6. Agent Memory Propagation Design

### 6.1 Propagation Algorithm

```typescript
interface PropagationEvent {
  sourceAgent: AgentId;
  sourceNode: string;
  targetNode: string;
  message: Message;
  decayApplied: number;
  corruptionApplied: number;
}

function propagateMessage(message: Message): PropagationEvent[] {
  const events: PropagationEvent[] = [];
  const nodes = getAllNodes();
  
  for (const node of nodes) {
    if (node.id === message.nodeId) continue;
    
    // Apply decay based on distance
    const decay = calculateDecay(message.nodeId, node.id);
    
    // Apply corruption probability
    const corruption = calculateCorruption(node.id);
    
    // Create propagated message
    const propagated: Message = {
      ...message,
      id: generateUUID(),
      nodeId: node.id,
      metadata: {
        ...message.metadata,
        decayLevel: Math.min(100, message.metadata.decayLevel + decay),
        corruptedBytes: message.metadata.corruptedBytes + corruption
      }
    };
    
    events.push({
      sourceAgent: message.agentId,
      sourceNode: message.nodeId,
      targetNode: node.id,
      message: propagated,
      decayApplied: decay,
      corruptionApplied: corruption
    });
  }
  
  return events;
}
```

### 6.2 Memory Decay Logic

```typescript
function calculateDecay(sourceNodeId: string, targetNodeId: string): number {
  // Decay increases with network distance
  const networkDistance = getNetworkDistance(sourceNodeId, targetNodeId);
  const baseDecay = 5; // 5% per hop
  return baseDecay * networkDistance;
}

function calculateCorruption(nodeId: string): number {
  // Some nodes are "noisy" and cause more corruption
  const node = getNode(nodeId);
  return node.isNoisy ? Math.floor(Math.random() * 10) : 0;
}
```

## 7. Frontend Component Structure

### 7.1 Component Tree

```
App
├── TerminalShell
│   ├── Header
│   │   ├── Title
│   │   ├── Status
│   │   └── Credits
│   ├── MessageConsole
│   │   ├── ThreadList
│   │   │   ├── ThreadItem (active, unread, read)
│   │   │   └── NewThreadButton
│   │   └── MessageList
│   │       ├── MessageItem
│   │       │   ├── MessageHeader
│   │       │   ├── MessageContent
│   │       │   └── MessageActions
│   │       └── ReplyInput
│   ├── AgentPanel
│   │   ├── AgentCard (x3)
│   │   │   ├── AgentName
│   │   │   ├── AgentStatus
│   │   │   └── AgentActions
│   │   └── DirectQueryInput
│   └── Footer
│       ├── ActionMenu
│       │   ├── ReadMessage (0 credits)
│       │   ├── ReplyThread (50)
│       │   ├── ReconstructMemory (100)
│       │   ├── QueryAgent (200)
│       │   └── InitiateProtocol (500)
│       └── Navigation
│           ├── Reload
│           ├── Replay
│           └── Reset
```

### 7.2 TypeScript Types

```typescript
// shared/types.ts
export type AgentId = 'archivist' | 'echo' | 'corruptor';

export interface Message {
  id: string;
  threadId: string;
  parentMessageId?: string;
  agentId: AgentId;
  sender: string;
  recipient?: string;
  subject: string;
  content: string;
  metadata: MessageMetadata;
  status: MessageStatus;
  nodeId: string;
}

export interface MessageMetadata {
  timestamp: number;
  sequence: number;
  decayLevel: number;
  corruptedBytes?: number;
  reconstructionLevel?: number;
}

export type MessageStatus = 'pending' | 'delivered' | 'read';

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  personality: AgentPersonality;
  currentMemoryState: number;
  memoryDecayRate: number;
  lastActive: number;
  nodeAffinity: string[];
}

export interface GameState {
  playerId: string;
  currentScenario: string;
  storyProgress: StoryProgress;
  playerActions: ActionLog[];
  agentStates: Record<AgentId, Agent>;
  messageCache: Message[];
  activeThreads: string[];
  currentEnding?: EndingType;
  completionTimestamp?: number;
}

export interface ActionLog {
  id: number;
  timestamp: number;
  actionType: ActionName;
  targetId?: string;
  creditsSpent: number;
}

export type ActionName = 
  | 'read_message'
  | 'reply_thread'
  | 'reconstruct_memory'
  | 'query_agent'
  | 'initiate_protocol';

export type EndingType = 'preservation' | 'dispersal';

export interface StoryProgress {
  discoveryPhase: number;
  patternRecognition: boolean;
  truthUncovered: boolean;
  choiceMade: boolean;
}
```

## 8. State Management

### 8.1 React Context Structure

```typescript
// contexts/GameContext.tsx
const GameContext = createContext<{
  gameState: GameState;
  sendMessage: (message: Partial<Message>) => void;
  reconstructMemory: (messageId: string) => Promise<void>;
  queryAgent: (agentId: AgentId, query: string) => Promise<void>;
  takeAction: (action: ActionName, targetId?: string, cost: number) => Promise<void>;
  replayGame: (timestamp: number) => Promise<void>;
  loadGameState: () => Promise<void>;
  saveGameState: () => Promise<void>;
}>();

// contexts/AgentContext.tsx
const AgentContext = createContext<{
  agents: Record<AgentId, Agent>;
  propagateMemory: (messageId: string) => Promise<void>;
  decayAllAgents: () => Promise<void>;
}>();

// contexts/MessageContext.tsx
const MessageContext = createContext<{
  messages: Message[];
  threads: Record<string, Message[]>;
  addMessage: (message: Partial<Message>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
}>();
```

## 9. Key Design Decisions

### 9.1 Deterministic Replay
- All game state changes are logged with timestamps
- Messages have deterministic decay based on time elapsed
- No random number generation in message content generation
- Replay uses log playback with deterministic calculations

### 9.2 Offline-First Design
- Game state serialized to localStorage for browser persistence
- SQLite used only when backend is running
- Messages can be viewed offline (cached)

### 9.3 Performance Optimization
- Only rendered threads are fully loaded
- Message content lazy-loaded on selection
- Virtual scrolling for large message lists
- Debounced agent state updates

### 9.4 Security Considerations
- Input sanitization for all user messages
- SQL injection prevention with parameterized queries
- XSS prevention with React's automatic escaping
- CORS configured for local development only