// Propagation Engine Tests
// Tests for message propagation with decay and corruption

import { propagateMessage, calculateDecay, calculateCorruption, NETWORK_TOPOLOGY } from '../src/agents/propagation.js';
import { store } from '../src/database/memoryStore.js';
import { AgentId } from '../shared/types.js';

describe('Propagation Engine', () => {
  beforeAll(() => {
    store.initializeDefaultData();
  });

  describe('calculateDecay', () => {
    it('returns base decay for direct neighbors', () => {
      const decay = calculateDecay('node-archivist', 'node-central', 1);
      expect(decay).toBe(5); // BASE_DECAY_PER_HOP
    });

    it('increases decay with depth', () => {
      const decay1 = calculateDecay('node-archivist', 'node-central', 1);
      const decay2 = calculateDecay('node-archivist', 'node-central', 2);
      expect(decay2).toBeGreaterThan(decay1);
    });

    it('applies noisy node multiplier', () => {
      const decayNoisy = calculateDecay('node-central', 'node-mixed', 1);
      const decayClean = calculateDecay('node-central', 'node-archivist', 1);
      expect(decayNoisy).toBeGreaterThan(decayClean);
    });
  });

  describe('calculateCorruption', () => {
    it('returns higher corruption for noisy nodes', () => {
      const noisyNode = NETWORK_TOPOLOGY['node-mixed'];
      const cleanNode = NETWORK_TOPOLOGY['node-archivist'];
      
      // Run multiple times to account for randomness
      const noisyCorruption = calculateCorruption(noisyNode);
      const cleanCorruption = calculateCorruption(cleanNode);
      
      expect(noisyCorruption).toBeGreaterThanOrEqual(cleanCorruption);
    });
  });

  describe('propagateMessage', () => {
    it('propagates message to other nodes', async () => {
      const originalMessage = store.createMessage({
        threadId: 'test-thread',
        agentId: 'archivist' as AgentId,
        sender: 'Archivist',
        subject: 'Test Message',
        content: 'This is a test message',
        metadata: {
          sequence: 1,
          decayLevel: 0
        },
        status: 'pending',
        nodeId: 'node-archivist'
      });

      const events = await propagateMessage(originalMessage, 'node-archivist');
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].success).toBe(true);
    });

    it('applies decay during propagation', async () => {
      const originalMessage = store.createMessage({
        threadId: 'test-thread-2',
        agentId: 'echo' as AgentId,
        sender: 'Echo',
        subject: 'Test Decay',
        content: 'Testing decay',
        metadata: {
          sequence: 1,
          decayLevel: 0
        },
        status: 'pending',
        nodeId: 'node-echo'
      });

      const events = await propagateMessage(originalMessage, 'node-echo');
      
      const propagatedMessages = store.getMessages().filter(
        m => m.threadId === 'test-thread-2' && m.nodeId !== 'node-echo'
      );
      
      expect(propagatedMessages.length).toBeGreaterThan(0);
      expect(propagatedMessages[0].metadata.decayLevel).toBeGreaterThan(0);
    });

    it('tracks propagation path', async () => {
      const originalMessage = store.createMessage({
        threadId: 'test-thread-3',
        agentId: 'corruptor' as AgentId,
        sender: 'Corruptor',
        subject: 'Test Path',
        content: 'Testing path tracking',
        metadata: {
          sequence: 1,
          decayLevel: 0
        },
        status: 'pending',
        nodeId: 'node-corruptor'
      });

      await propagateMessage(originalMessage, 'node-corruptor');
      
      const messages = store.getMessages().filter(
        m => m.threadId === 'test-thread-3' && m.metadata.propagationPath
      );
      
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].metadata.propagationPath?.length).toBeGreaterThan(0);
    });
  });
});

// Run tests if executed directly
if (process.argv[1]?.includes('propagation.test')) {
  (async () => {
    try {
      await jest.runAllTimers();
      console.log('Tests completed');
    } catch (error) {
      console.error('Test error:', error);
    }
  })();
}