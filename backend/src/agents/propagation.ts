// Message Propagation Engine
import { Message, AgentId, CONFIG } from '../shared/types.js';
import { store } from '../database/memoryStore.js';

export interface PropagationEvent {
  messageId: string;
  fromNode: string;
  toNode: string;
  decayApplied: number;
  corruptionApplied: number;
  success: boolean;
}

export interface NetworkNode {
  id: string;
  agentAffinity: AgentId[];
  reliability: number;
  isNoisy: boolean;
}

export const NETWORK_TOPOLOGY: Record<string, NetworkNode> = {
  'node-archivist': { id: 'node-archivist', agentAffinity: ['archivist'], reliability: 0.95, isNoisy: false },
  'node-echo': { id: 'node-echo', agentAffinity: ['echo'], reliability: 0.85, isNoisy: false },
  'node-corruptor': { id: 'node-corruptor', agentAffinity: ['corruptor'], reliability: 0.75, isNoisy: true },
  'node-central': { id: 'node-central', agentAffinity: ['archivist', 'echo', 'corruptor'], reliability: 0.9, isNoisy: false },
  'node-mixed': { id: 'node-mixed', agentAffinity: ['archivist', 'echo'], reliability: 0.8, isNoisy: true }
};

export function getNode(nodeId: string): NetworkNode {
  return NETWORK_TOPOLOGY[nodeId] || NETWORK_TOPOLOGY['node-central'];
}

export function calculateDecay(sourceId: string, targetId: string, depth: number = 1): number {
  const baseDecay = CONFIG.BASE_DECAY_PER_HOP;
  const depthFactor = Math.pow(1.5, depth);
  const targetNode = getNode(targetId);
  const nodeFactor = targetNode.isNoisy ? 1.5 : 1.0;
  return Math.floor(baseDecay * depthFactor * nodeFactor);
}

export function calculateCorruption(node: NetworkNode): number {
  return node.isNoisy ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 3);
}

export async function propagateMessage(originalMessage: Message, sourceNodeId: string): Promise<PropagationEvent[]> {
  const events: PropagationEvent[] = [];
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: sourceNodeId, depth: 0 }];
  
  while (queue.length > 0 && visited.size < CONFIG.MAX_HOPS + 1) {
    const { nodeId, depth } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    if (depth >= CONFIG.MAX_HOPS) continue;
    
    const sourceNode = getNode(sourceNodeId);
    const targetNode = getNode(nodeId);
    const decay = calculateDecay(sourceNodeId, nodeId, depth);
    const corruption = calculateCorruption(targetNode);
    const success = Math.random() < targetNode.reliability;
    
    if (success && nodeId !== sourceNodeId) {
      const propagatedMessage: Message = {
        ...originalMessage,
        id: 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36),
        nodeId: nodeId,
        metadata: {
          ...originalMessage.metadata,
          decayLevel: Math.min(100, originalMessage.metadata.decayLevel + decay),
          corruptedBytes: (originalMessage.metadata.corruptedBytes || 0) + corruption,
          sequence: originalMessage.metadata.sequence + 1,
          propagationPath: [...(originalMessage.metadata.propagationPath || []), nodeId]
        }
      };
      
      store.createMessage({
        threadId: propagatedMessage.threadId,
        parentMessageId: originalMessage.id,
        agentId: propagatedMessage.agentId,
        sender: `${propagatedMessage.sender} (${nodeId})`,
        subject: `[Propagated] ${propagatedMessage.subject}`,
        content: propagatedMessage.content,
        metadata: propagatedMessage.metadata,
        status: 'pending',
        nodeId: nodeId
      });
      
      events.push({
        messageId: originalMessage.id,
        fromNode: sourceNodeId,
        toNode: nodeId,
        decayApplied: decay,
        corruptionApplied: corruption,
        success: true
      });
    }
    
    Object.keys(NETWORK_TOPOLOGY).filter(id => !visited.has(id))
      .forEach(id => queue.push({ nodeId: id, depth: depth + 1 }));
  }
  
  return events;
}

export function startPropagationScheduler(): any {
  return setInterval(async () => {
    const pendingMessages = store.getMessages().filter(m => m.status === 'pending');
    for (const message of pendingMessages) {
      if ((message.metadata.propagationPath?.length || 0) < 3) {
        await propagateMessage(message, message.nodeId);
      }
    }
  }, 2000);
}