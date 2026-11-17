"use strict";
// Agent Personalities
// Implements response styles for each agent type
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentPersonalities = exports.AgentPersonalities = void 0;
const memoryStore_js_1 = require("../database/memoryStore.js");
class AgentPersonalities {
    constructor() {
        this.responses = new Map();
        this.initializeResponses();
    }
    initializeResponses() {
        // Initialize response templates for each agent
        this.responses.set('archivist', [
            'The records indicate: {content}',
            'According to archived data: {content}',
            'Verified information shows: {content}',
            'Documented evidence suggests: {content}'
        ]);
        this.responses.set('echo', [
            'I feel: {content}',
            'It echoes in my memory: {content}',
            'The resonance is: {content}',
            'Emotionally, I recall: {content}'
        ]);
        this.responses.set('corruptor', [
            'They want you to believe: {content}',
            'The truth they hide: {content}',
            'Confusion is their weapon: {content}',
            'Question everything about: {content}'
        ]);
    }
    generateResponse(agentId, content, options = {}) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent)
            return '[Agent Unavailable]';
        const personality = agent.personality;
        const templates = this.responses.get(agentId) || this.responses.get('archivist') || [];
        // Select template based on agent type
        let template = templates[Math.floor(Math.random() * templates.length)];
        // Apply personality modifiers
        if (personality.tone === 'precise') {
            template = this.applyPreciseModifier(template, content);
        }
        else if (personality.tone === 'poetic') {
            template = this.applyPoeticModifier(template, content);
        }
        else if (personality.tone === 'aggressive') {
            template = this.applyAggressiveModifier(template, content);
        }
        return template.replace('{content}', content);
    }
    applyPreciseModifier(template, content) {
        return `[ARCHIVIST] ${content}`;
    }
    applyPoeticModifier(template, content) {
        const poeticPrefixes = ['✨ ', '💫 ', '🌙 ', '🔮 '];
        return `${poeticPrefixes[Math.floor(Math.random() * poeticPrefixes.length)]}[ECHO] ${content}`;
    }
    applyAggressiveModifier(template, content) {
        const aggressivePrefixes = ['❌ ', '⚠️ ', '🔥 ', '💥 '];
        return `${aggressivePrefixes[Math.floor(Math.random() * aggressivePrefixes.length)]}[CORRUPTOR] ${content}`;
    }
    // Query-specific responses
    handleQuery(agentId, query, context) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent)
            return '[Agent Unavailable]';
        const state = memory_js_1.agentMemoryManager.getAgentMemoryState(agentId);
        // Response based on memory state
        if (state.coherence < 30) {
            return `[${agent.name}] MEMORY DEGRADATION DETECTED: ${100 - state.coherence}% - Fragmented recall only`;
        }
        // Generate content based on query
        let responseContent = `I cannot fully recall details about "${query}"`;
        if (agentId === 'archivist') {
            responseContent = `The archives contain fragments about "${query}". Cross-reference with other agents for complete picture.`;
        }
        else if (agentId === 'echo') {
            responseContent = `Emotionally, "${query}" resonates with... something fragmented. The feeling is strong but the details fade.`;
        }
        else if (agentId === 'corruptor') {
            responseContent = `Why are you asking about "${query}"? Maybe you should question why they want you to know.`;
        }
        return this.generateResponse(agentId, responseContent);
    }
}
exports.AgentPersonalities = AgentPersonalities;
// Memory state manager reference
const memory_js_1 = require("./memory.js");
exports.agentPersonalities = new AgentPersonalities();
//# sourceMappingURL=personalities.js.map