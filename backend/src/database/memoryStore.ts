// In-memory database
import { Message, Agent, GameState, AgentId } from '../shared/types.js';

export class InMemoryStore {
  private messages: Map<string, Message> = new Map();
  private agents: Map<string, Agent> = new Map();
  private gameState: GameState | null = null;
  private actionLogs: Array<{id: number; timestamp: number; actionType: string; targetId?: string; creditsSpent: number}> = [];
  private nextActionId: number = 1;

  getMessage(id: string): Message | undefined {
    return this.messages.get(id);
  }

  getMessages(): Message[] {
    return Array.from(this.messages.values());
  }

  getThreadMessages(threadId: string): Message[] {
    return Array.from(this.messages.values())
      .filter(m => m.threadId === threadId)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence);
  }

  createMessage(message: Omit<Message, 'id' | 'metadata'> & { metadata?: Partial<Message['metadata']> }): Message {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
    const now = Date.now();
    
    const msg: Message = {
      ...message,
      id,
      metadata: {
        timestamp: now,
        sequence: message.metadata?.sequence || 0,
        decayLevel: message.metadata?.decayLevel || 0,
        corruptedBytes: message.metadata?.corruptedBytes || 0,
        reconstructionLevel: message.metadata?.reconstructionLevel || 0,
        propagationPath: message.metadata?.propagationPath || [],
        ...message.metadata
      },
      status: message.status || 'pending',
      nodeId: message.nodeId
    };
    
    this.messages.set(id, msg);
    return msg;
  }

  updateMessage(id: string, updates: Partial<Message>): void {
    const existing = this.messages.get(id);
    if (existing) {
      this.messages.set(id, { ...existing, ...updates });
    }
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const existing = this.agents.get(id);
    if (existing) {
      this.agents.set(id, { ...existing, ...updates, lastActive: Date.now() });
    }
  }

  getGameState(): GameState {
    if (!this.gameState) {
      this.gameState = {
        playerId: 'player-1',
        currentScenario: 'dr-vance-mystery',
        storyProgress: {
          discoveryPhase: 0,
          patternRecognition: false,
          truthUncovered: false,
          choiceMade: false
        },
        playerActions: [],
        agentStates: {
          archivist: this.getAgent('archivist') as Agent,
          echo: this.getAgent('echo') as Agent,
          corruptor: this.getAgent('corruptor') as Agent
        },
        activeThreads: [],
        credits: 1000
      };
    }
    return this.gameState;
  }

  updateGameState(updates: Partial<GameState>): void {
    if (this.gameState) {
      this.gameState = { ...this.gameState, ...updates };
    }
  }

  logAction(action: {id: number; timestamp: number; actionType: string; targetId?: string; creditsSpent: number}): void {
    this.actionLogs.push({ ...action, id: this.nextActionId++ });
  }

  initializeDefaultData(): void {
    const INITIAL_AGENTS = [
      {
        id: 'archivist' as AgentId,
        name: 'Archivist',
        description: 'Preserves memory in pristine condition - precise, organized, detailed',
        personality: {
          tone: 'precise',
          fragmentationLevel: 0.1,
          memoryFocus: 'factual'
        },
        currentMemoryState: 100,
        memoryDecayRate: 2,
        lastActive: Date.now(),
        nodeAffinity: ['node-archivist', 'node-central']
      },
      {
        id: 'echo' as AgentId,
        name: 'Echo',
        description: 'Recalls emotional resonance - fragmented, poetic, emotional',
        personality: {
          tone: 'poetic',
          fragmentationLevel: 0.7,
          memoryFocus: 'emotional'
        },
        currentMemoryState: 95,
        memoryDecayRate: 3,
        lastActive: Date.now(),
        nodeAffinity: ['node-echo', 'node-central']
      },
      {
        id: 'corruptor' as AgentId,
        name: 'Corruptor',
        description: 'Challenges dominant narratives - aggressive, cynical, fragmented',
        personality: {
          tone: 'aggressive',
          fragmentationLevel: 0.9,
          memoryFocus: 'challenging'
        },
        currentMemoryState: 85,
        memoryDecayRate: 5,
        lastActive: Date.now(),
        nodeAffinity: ['node-corruptor', 'node-mixed']
      }
    ];

    INITIAL_AGENTS.forEach(agentData => {
      this.agents.set(agentData.id, agentData);
    });

    this.gameState = {
      playerId: 'player-1',
      currentScenario: 'dr-vance-mystery',
      storyProgress: {
        discoveryPhase: 0,
        patternRecognition: false,
        truthUncovered: false,
        choiceMade: false
      },
      playerActions: [],
      agentStates: {
        archivist: this.getAgent('archivist') as Agent,
        echo: this.getAgent('echo') as Agent,
        corruptor: this.getAgent('corruptor') as Agent
      },
      activeThreads: [],
      credits: 1000
    };
  }
}

export const store = new InMemoryStore();