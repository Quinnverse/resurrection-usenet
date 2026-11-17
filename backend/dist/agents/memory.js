"use strict";
// Agent Memory Management
// Handles memory decay, reconstruction, and state transitions
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMemoryManager = exports.AgentMemoryManager = void 0;
const types_js_1 = require("../../../shared/types.js");
const memoryStore_js_1 = require("../database/memoryStore.js");
class AgentMemoryManager {
    constructor() {
        this.memoryFragments = new Map();
        this.lastDecayUpdate = new Map();
    }
    getAgentMemoryState(agentId) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent) {
            return {
                coherence: 100,
                fragmentation: 0,
                decayRate: types_js_1.CONFIG.DEFAULT_MEMORY_DECAY_RATE,
                reconstructionLevel: 100
            };
        }
        return {
            coherence: agent.currentMemoryState,
            fragmentation: 100 - agent.currentMemoryState,
            decayRate: agent.memoryDecayRate,
            reconstructionLevel: Math.min(100, agent.currentMemoryState)
        };
    }
    decayAgentMemory(agentId, hoursPassed = 1) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent)
            return 0;
        const elapsed = Date.now() - (this.lastDecayUpdate.get(agentId) || agent.lastActive);
        const hours = elapsed / 3600000;
        const decayAmount = Math.min(hours * agent.memoryDecayRate, 100);
        const newMemoryState = Math.max(0, agent.currentMemoryState - decayAmount);
        memoryStore_js_1.store.updateAgent(agentId, {
            currentMemoryState: newMemoryState,
            lastActive: Date.now()
        });
        this.lastDecayUpdate.set(agentId, Date.now());
        return decayAmount;
    }
    reconstructMemory(agentId, message) {
        const state = this.getAgentMemoryState(agentId);
        // Reconstruction effectiveness depends on memory coherence
        const reconstructionBonus = state.coherence * 0.5; // Up to 50% improvement
        const newMemoryState = Math.min(100, state.coherence + reconstructionBonus);
        memoryStore_js_1.store.updateAgent(agentId, {
            currentMemoryState: newMemoryState
        });
        // Mark message as reconstructed
        memoryStore_js_1.store.updateMessage(message.id, {
            metadata: {
                ...message.metadata,
                reconstructionLevel: Math.min(100, message.metadata.reconstructionLevel || 0 + 30),
                lastReconstructed: Date.now()
            }
        });
        return newMemoryState;
    }
    getAgentFragment(agentId, message) {
        const state = this.getAgentMemoryState(agentId);
        // Agent-specific response based on personality
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent) {
            return {
                id: 'empty',
                content: '[Memory Fragment Unavailable]',
                confidence: 0,
                timestamp: Date.now()
            };
        }
        // Apply fragmentation based on personality
        let fragmentedContent = message.content;
        if (agent.memoryDecayRate > 3) {
            // High decay agents produce more fragmented memories
            fragmentedContent = this.applyFragmentation(message.content, agent.memoryDecayRate / 10);
        }
        return {
            id: `${agentId}-${message.id}`,
            content: fragmentedContent,
            confidence: state.coherence,
            timestamp: Date.now()
        };
    }
    applyFragmentation(text, fragmentationFactor) {
        if (fragmentationFactor < 0.3)
            return text;
        // Split text into fragments
        const words = text.split(' ');
        const fragmentCount = Math.max(1, Math.floor(words.length * fragmentationFactor));
        // Select random fragments
        const fragments = [];
        const indices = new Set();
        while (fragments.length < fragmentCount && indices.size < words.length) {
            const idx = Math.floor(Math.random() * words.length);
            if (!indices.has(idx)) {
                indices.add(idx);
                fragments.push(words[idx]);
            }
        }
        return fragments.join(' ');
    }
    combineMemories(fragments) {
        if (fragments.length === 0) {
            return { content: '', confidence: 0 };
        }
        // Weight by confidence
        const totalConfidence = fragments.reduce((sum, f) => sum + f.confidence, 0);
        if (totalConfidence === 0) {
            return { content: fragments[0]?.content || '', confidence: 0 };
        }
        // Combine content based on confidence weighting
        const contentWeights = fragments.map(f => ({
            content: f.content,
            weight: f.confidence / totalConfidence
        }));
        // Use highest confidence fragment as base
        const highest = contentWeights.sort((a, b) => b.weight - a.weight)[0];
        return {
            content: highest.content,
            confidence: highest.weight * 100
        };
    }
}
exports.AgentMemoryManager = AgentMemoryManager;
exports.agentMemoryManager = new AgentMemoryManager();
//# sourceMappingURL=memory.js.map