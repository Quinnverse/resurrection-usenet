// Agent Memory Management
import { Agent, AgentId, Message, CONFIG } from '../shared/types.js';
import { store } from '../database/memoryStore.js';

export interface MemoryFragment {
  id: string;
  content: string;
  confidence: number;
  timestamp: number;
}

export interface AgentMemoryState {
  coherence: number;
  fragmentation: number;
  decayRate: number;
  reconstructionLevel: number;
}

export class AgentMemoryManager {
  private lastDecayUpdate: Map<string, number> = new Map();

  getAgentMemoryState(agentId: AgentId): AgentMemoryState {
    const agent = store.getAgent(agentId);
    if (!agent) {
      return { coherence: 100, fragmentation: 0, decayRate: CONFIG.DEFAULT_MEMORY_DECAY_RATE, reconstructionLevel: 100 };
    }
    return {
      coherence: agent.currentMemoryState,
      fragmentation: 100 - agent.currentMemoryState,
      decayRate: agent.memoryDecayRate,
      reconstructionLevel: Math.min(100, agent.currentMemoryState)
    };
  }

  decayAgentMemory(agentId: AgentId, hoursPassed: number = 1): number {
    const agent = store.getAgent(agentId);
    if (!agent) return 0;
    
    const elapsed = Date.now() - (this.lastDecayUpdate.get(agentId) || agent.lastActive);
    const hours = elapsed / 3600000;
    const decayAmount = Math.min(hours * agent.memoryDecayRate, 100);
    
    const newMemoryState = Math.max(0, agent.currentMemoryState - decayAmount);
    store.updateAgent(agentId, { currentMemoryState: newMemoryState, lastActive: Date.now() });
    this.lastDecayUpdate.set(agentId, Date.now());
    
    return decayAmount;
  }

  reconstructMemory(agentId: AgentId, message: Message): number {
    const state = this.getAgentMemoryState(agentId);
    const newMemoryState = Math.min(100, state.coherence + state.coherence * 0.5);
    
    store.updateAgent(agentId, { currentMemoryState: newMemoryState });
    
    store.updateMessage(message.id, {
      metadata: {
        ...message.metadata,
        reconstructionLevel: Math.min(100, (message.metadata.reconstructionLevel || 0) + 30),
        lastReconstructed: Date.now()
      }
    });
    
    return newMemoryState;
  }

  getAgentFragment(agentId: AgentId, message: Message): MemoryFragment {
    const state = this.getAgentMemoryState(agentId);
    const agent = store.getAgent(agentId);
    
    if (!agent) {
      return { id: 'empty', content: '[Memory Fragment Unavailable]', confidence: 0, timestamp: Date.now() };
    }
    
    let fragmentedContent = message.content;
    if (agent.memoryDecayRate > 3) {
      const words = message.content.split(' ');
      const fragmentCount = Math.max(1, Math.floor(words.length * agent.memoryDecayRate / 10));
      const fragments: string[] = [];
      const indices = new Set<number>();
      
      while (fragments.length < fragmentCount && indices.size < words.length) {
        const idx = Math.floor(Math.random() * words.length);
        if (!indices.has(idx)) {
          indices.add(idx);
          fragments.push(words[idx]);
        }
      }
      fragmentedContent = fragments.join(' ');
    }
    
    return { id: `${agentId}-${message.id}`, content: fragmentedContent, confidence: state.coherence, timestamp: Date.now() };
  }

  combineMemories(fragments: MemoryFragment[]): { content: string; confidence: number } {
    if (fragments.length === 0) return { content: '', confidence: 0 };
    
    const totalConfidence = fragments.reduce((sum, f) => sum + f.confidence, 0);
    if (totalConfidence === 0) return { content: fragments[0]?.content || '', confidence: 0 };
    
    const contentWeights = fragments.map(f => ({ content: f.content, weight: f.confidence / totalConfidence }));
    const highest = contentWeights.sort((a, b) => b.weight - a.weight)[0];
    
    return { content: highest.content, confidence: highest.weight * 100 };
  }
}

export const agentMemoryManager = new AgentMemoryManager();