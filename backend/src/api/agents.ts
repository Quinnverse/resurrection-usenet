// Agents API
import { store } from '../database/memoryStore.js';
import { agentMemoryManager } from '../agents/memory.js';
import { agentPersonalities } from '../agents/personalities.js';

export function getAgents(): Array<{id: string; name: string; description: string; personality: any; currentMemoryState: number}> {
  return store.getAgents().map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    personality: a.personality,
    currentMemoryState: a.currentMemoryState
  }));
}

export function getAgent(id: string): any {
  const agent = store.getAgent(id);
  if (!agent) return undefined;
  const memoryState = agentMemoryManager.getAgentMemoryState(id as any);
  return { ...agent, memoryState };
}

export async function queryAgent(id: string, query: string, context?: string): Promise<any> {
  const response = agentPersonalities.handleQuery(id as any, query || 'General inquiry', context);
  store.updateAgent(id, { lastActive: Date.now() });
  agentMemoryManager.decayAgentMemory(id as any, 0.1);
  return { agentId: id, response, confidence: agentMemoryManager.getAgentMemoryState(id as any).coherence };
}