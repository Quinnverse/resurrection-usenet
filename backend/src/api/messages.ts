// Messages API
import { store } from '../database/memoryStore.js';
import { propagateMessage } from '../agents/propagation.js';
import { agentMemoryManager } from '../agents/memory.js';

export function getMessages(): Array<{id: string; threadId: string; agentId: string; content: string; metadata: any}> {
  return store.getMessages().map(m => ({
    id: m.id,
    threadId: m.threadId,
    agentId: m.agentId,
    content: m.content,
    metadata: m.metadata
  }));
}

export function getMessage(id: string): any {
  const message = store.getMessage(id);
  if (message) {
    store.updateMessage(id, { status: 'read' });
    return { id: message.id, threadId: message.threadId, agentId: message.agentId, content: message.content, metadata: message.metadata };
  }
  return undefined;
}

export function getThreadMessages(threadId: string): any[] {
  return store.getThreadMessages(threadId).map(m => ({
    id: m.id,
    threadId: m.threadId,
    agentId: m.agentId,
    content: m.content,
    metadata: m.metadata
  }));
}

export async function createMessage(body: any): Promise<any> {
  const message = store.createMessage({
    threadId: body.threadId,
    parentMessageId: body.parentMessageId,
    agentId: body.agentId,
    sender: body.sender || 'Unknown',
    subject: body.subject || 'New Message',
    content: body.content,
    metadata: { sequence: body.sequence || 0, decayLevel: body.decayLevel || 0 },
    status: body.status || 'pending',
    nodeId: body.nodeId || 'node-central'
  });
  await propagateMessage(message, message.nodeId);
  return { id: message.id, threadId: message.threadId, agentId: message.agentId, content: message.content, metadata: message.metadata };
}

export async function reconstructMessage(id: string, agentIds: string[]): Promise<any> {
  const message = store.getMessage(id);
  if (!message) throw new Error('Message not found');

  const fragments = agentIds.map((agentId: string) => agentMemoryManager.getAgentFragment(agentId as any, message));
  const combined = agentMemoryManager.combineMemories(fragments);

  store.updateMessage(id, { metadata: { ...message.metadata, decayLevel: Math.max(0, message.metadata.decayLevel - 50), reconstructionLevel: combined.confidence } });
  agentIds.forEach((agentId: string) => agentMemoryManager.reconstructMemory(agentId as any, message));

  return { success: true, reconstructedContent: combined.content, newDecayLevel: Math.max(0, message.metadata.decayLevel - 50), confidence: combined.confidence };
}