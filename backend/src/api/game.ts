// Game State API
import { store } from '../database/memoryStore.js';
import { agentMemoryManager } from '../agents/memory.js';
import { CONFIG } from '../shared/types.js';

export function getGameState(): any {
  return store.getGameState();
}

export function updateGameState(updates: any): any {
  store.updateGameState(updates);
  return store.getGameState();
}

export async function performAction(actionType: string, targetId?: string): Promise<any> {
  const gameState = store.getGameState();
  const cost = CONFIG.ACTION_COSTS[actionType as keyof typeof CONFIG.ACTION_COSTS] || 0;
  
  if (gameState.credits < cost) throw new Error('Insufficient credits');
  
  store.updateGameState({ credits: gameState.credits - cost });
  store.logAction({ id: 0, timestamp: Date.now(), actionType, targetId, creditsSpent: cost });

  let result: any = {};
  if (actionType === 'reconstruct_memory' && targetId) {
    const message = store.getMessage(targetId);
    if (message) {
      const fragments = [agentMemoryManager.getAgentFragment('archivist', message)];
      const combined = agentMemoryManager.combineMemories(fragments);
      store.updateMessage(targetId, { metadata: { ...message.metadata, decayLevel: Math.max(0, message.metadata.decayLevel - 50), reconstructionLevel: 80 } });
      agentMemoryManager.reconstructMemory('archivist', message);
      result = { reconstructedContent: combined.content, newDecayLevel: Math.max(0, message.metadata.decayLevel - 50) };
    }
  }

  return { success: true, actionType, cost, gameState: store.getGameState(), result };
}

export function checkEnding(): any {
  const gameState = store.getGameState();
  let endingType: 'preservation' | 'dispersal' | null = null;
  if (gameState.credits >= 1000) endingType = 'preservation';
  else if (gameState.credits < 500) endingType = 'dispersal';
  if (endingType) store.updateGameState({ currentEnding: endingType as any, choiceMade: true });
  return { endingType, gameState: store.getGameState() };
}