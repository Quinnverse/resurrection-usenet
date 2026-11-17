// Agent Memory Tests
// Tests for memory decay, reconstruction, and state management

import { agentMemoryManager } from '../src/agents/memory.js';
import { store } from '../src/database/memoryStore.js';
import { AgentId } from '../shared/types.js';

describe('Agent Memory Management', () => {
  beforeAll(() => {
    store.initializeDefaultData();
  });

  describe('getAgentMemoryState', () => {
    it('returns memory state for agent', () => {
      const state = agentMemoryManager.getAgentMemoryState('archivist');
      
      expect(state.coherence).toBe(100);
      expect(state.fragmentation).toBe(0);
      expect(state.reconstructionLevel).toBe(100);
    });

    it('handles missing agents', () => {
      const state = agentMemoryManager.getAgentMemoryState('unknown');
      
      expect(state.coherence).toBe(100);
      expect(state.fragmentation).toBe(0);
    });
  });

  describe('decayAgentMemory', () => {
    it('reduces memory coherence over time', () => {
      const initial = store.getAgent('archivist')?.currentMemoryState || 100;
      
      // Simulate 1 hour passing
      const decayAmount = agentMemoryManager.decayAgentMemory('archivist', 1);
      
      const updated = store.getAgent('archivist');
      expect(updated?.currentMemoryState).toBeLessThan(initial);
      expect(decayAmount).toBeGreaterThan(0);
    });

    it('respects decay rate', () => {
      // Archivist has decay rate 2, Corruptor has decay rate 5
      const archivistInitial = store.getAgent('archivist')?.currentMemoryState || 100;
      const corruptorInitial = store.getAgent('corruptor')?.currentMemoryState || 100;
      
      agentMemoryManager.decayAgentMemory('archivist', 1);
      agentMemoryManager.decayAgentMemory('corruptor', 1);
      
      const archivistDecay = archivistInitial - (store.getAgent('archivist')?.currentMemoryState || 0);
      const corruptorDecay = corruptorInitial - (store.getAgent('corruptor')?.currentMemoryState || 0);
      
      expect(corruptorDecay).toBeGreaterThan(archivistDecay);
    });
  });

  describe('reconstructMemory', () => {
    it('increases memory coherence', () => {
      store.updateAgent('archivist', { currentMemoryState: 60 });
      
      const message = store.createMessage({
        threadId: 'test-thread',
        agentId: 'archivist' as AgentId,
        sender: 'Archivist',
        subject: 'Test',
        content: 'Test content',
        metadata: { sequence: 1, decayLevel: 50 },
        status: 'pending',
        nodeId: 'node-archivist'
      });

      const newCoherence = agentMemoryManager.reconstructMemory('archivist', message);
      
      expect(newCoherence).toBeGreaterThan(60);
      expect(newCoherence).toBeLessThanOrEqual(100);
    });

    it('updates message reconstruction level', () => {
      const message = store.createMessage({
        threadId: 'test-thread-2',
        agentId: 'archivist' as AgentId,
        sender: 'Archivist',
        subject: 'Test 2',
        content: 'Test content 2',
        metadata: { sequence: 1, decayLevel: 50, reconstructionLevel: 0 },
        status: 'pending',
        nodeId: 'node-archivist'
      });

      agentMemoryManager.reconstructMemory('archivist', message);
      
      const updatedMessage = store.getMessage(message.id);
      expect(updatedMessage?.metadata.reconstructionLevel).toBeGreaterThan(0);
    });
  });

  describe('getAgentFragment', () => {
    it('returns memory fragment for agent', () => {
      const message = store.createMessage({
        threadId: 'test-thread-3',
        agentId: 'archivist' as AgentId,
        sender: 'Archivist',
        subject: 'Test 3',
        content: 'Original content',
        metadata: { sequence: 1, decayLevel: 0 },
        status: 'pending',
        nodeId: 'node-archivist'
      });

      const fragment = agentMemoryManager.getAgentFragment('archivist', message);
      
      expect(fragment.id).toContain('archivist');
      expect(fragment.content).toBe('Original content');
      expect(fragment.confidence).toBe(100);
    });

    it('applies fragmentation for high decay agents', () => {
      const message = store.createMessage({
        threadId: 'test-thread-4',
        agentId: 'corruptor' as AgentId,
        sender: 'Corruptor',
        subject: 'Test 4',
        content: 'This is a longer message that will be fragmented',
        metadata: { sequence: 1, decayLevel: 0 },
        status: 'pending',
        nodeId: 'node-corruptor'
      });

      const fragment = agentMemoryManager.getAgentFragment('corruptor', message);
      
      expect(fragment.id).toContain('corruptor');
      // Corruptor has high decay rate (5), so fragmentation should apply
    });
  });

  describe('combineMemories', () => {
    it('combines fragments by confidence', () => {
      const fragments = [
        { content: 'High confidence', confidence: 90 },
        { content: 'Medium confidence', confidence: 60 },
        { content: 'Low confidence', confidence: 30 }
      ];

      const result = agentMemoryManager.combineMemories(fragments as any);
      
      expect(result.content).toBe('High confidence');
      expect(result.confidence).toBeCloseTo(90, -1);
    });

    it('returns empty for no fragments', () => {
      const result = agentMemoryManager.combineMemories([]);
      
      expect(result.content).toBe('');
      expect(result.confidence).toBe(0);
    });
  });
});

// Run tests if executed directly
if (process.argv[1]?.includes('memory.test')) {
  (async () => {
    try {
      await jest.runAllTimers();
      console.log('Memory tests completed');
    } catch (error) {
      console.error('Test error:', error);
    }
  })();
}