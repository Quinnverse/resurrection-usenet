// Resurrection Shared Types
// Pure TypeScript definitions for both backend and frontend

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
  decayLevel: number;        // 0-100 (100 = fully decayed)
  corruptedBytes?: number;
  reconstructionLevel?: number;
  propagationPath?: string[];
}

export type MessageStatus = 'pending' | 'delivered' | 'read';

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  personality: AgentPersonality;
  currentMemoryState: number;  // 0-100
  memoryDecayRate: number;     // Decay per hour
  lastActive: number;
  nodeAffinity: string[];
}

export interface AgentPersonality {
  tone: 'precise' | 'poetic' | 'aggressive';
  fragmentationLevel: number;
  memoryFocus: 'factual' | 'emotional' | 'challenging';
}

export interface GameState {
  playerId: string;
  currentScenario: string;
  storyProgress: StoryProgress;
  playerActions: ActionLog[];
  agentStates: Record<AgentId, Agent>;
  activeThreads: string[];
  currentEnding?: EndingType;
  completionTimestamp?: number;
  credits: number;
}

export interface StoryProgress {
  discoveryPhase: number;      // 0-3
  patternRecognition: boolean;
  truthUncovered: boolean;
  choiceMade: boolean;
}

export interface ActionLog {
  id: number;
  timestamp: number;
  actionType: ActionName;
  targetId?: string;
  creditsSpent: number;
  details?: string;
}

export type ActionName = 
  | 'read_message'
  | 'reply_thread'
  | 'reconstruct_memory'
  | 'query_agent'
  | 'initiate_protocol';

export type EndingType = 'preservation' | 'dispersal';

export interface ReplayEvent {
  id: string;
  timestamp: number;
  type: ReplayEventType;
  payload: any;
  deterministicKey: string;
}

export type ReplayEventType = 
  | 'message_propagation'
  | 'memory_decay'
  | 'player_action'
  | 'message_creation';

// Configuration constants
export const CONFIG = {
  MAX_HOPS: 5,
  BASE_DECAY_PER_HOP: 5,
  DEFAULT_MEMORY_DECAY_RATE: 2,
  ACTION_COSTS: {
    read_message: 0,
    reply_thread: 50,
    reconstruct_memory: 100,
    query_agent: 200,
    initiate_protocol: 500
  },
  INITIAL_CREDITS: 1000
};