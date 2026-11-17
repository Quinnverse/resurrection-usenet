// Agent Personalities
import { AgentId } from '../shared/types.js';
import { store } from '../database/memoryStore.js';
import { agentMemoryManager } from './memory.js';

export class AgentPersonalities {
  handleQuery(agentId: AgentId, query: string, context?: string): string {
    const agent = store.getAgent(agentId);
    if (!agent) return '[Agent Unavailable]';
    
    const state = agentMemoryManager.getAgentMemoryState(agentId);
    
    if (state.coherence < 30) {
      return `[${agent.name}] MEMORY DEGRADATION DETECTED: ${100 - state.coherence}% - Fragmented recall only`;
    }
    
    let responseContent = `I cannot fully recall details about "${query}"`;
    
    if (agentId === 'archivist') {
      responseContent = `The archives contain fragments about "${query}". Cross-reference with other agents for complete picture.`;
    } else if (agentId === 'echo') {
      responseContent = `Emotionally, "${query}" resonates with... something fragmented. The feeling is strong but the details fade.`;
    } else if (agentId === 'corruptor') {
      responseContent = `Why are you asking about "${query}"? Maybe you should question why they want you to know.`;
    }
    
    return `[${agent.name.toUpperCase()}] ${responseContent}`;
  }
}

export const agentPersonalities = new AgentPersonalities();