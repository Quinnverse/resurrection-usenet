// Shared Types for Resurrection Backend
// Simplified types for in-memory database

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
  metadata: {
    timestamp: number;
    sequence: number;
    decayLevel: number;
    corruptedBytes?: number;
    reconstructionLevel?: number;
    propagationPath?: string[];
  };
  status: 'pending' | 'delivered' | 'read';
  nodeId: string;
}

export interface AgentPersonality {
  tone: 'precise' | 'poetic' | 'aggressive';
  fragmentationLevel: number;
  memoryFocus: 'factual' | 'emotional' | 'challenging';
}

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

export interface StoryProgress {
  discoveryPhase: number;
  patternRecognition: boolean;
  truthUncovered: boolean;
  choiceMade: boolean;
}

export interface GameState {
  playerId: string;
  currentScenario: string;
  storyProgress: StoryProgress;
  playerActions: Array<{id: number; timestamp: number; actionType: string; targetId?: string; creditsSpent: number}>;
  agentStates: Record<AgentId, Agent>;
  activeThreads: string[];
  currentEnding?: 'preservation' | 'dispersal';
  credits: number;
}

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