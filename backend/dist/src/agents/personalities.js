"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentPersonalities = exports.AgentPersonalities = void 0;
const memoryStore_js_1 = require("../database/memoryStore.js");
const memory_js_1 = require("./memory.js");
class AgentPersonalities {
    constructor() {
        this.responses = new Map();
        this.initializeResponses();
    }
    initializeResponses() {
        this.responses.set('archivist', [
            '[ARCHIVIST] {content}',
            'The archives indicate: {content}',
            'Verified information shows: {content}'
        ]);
        this.responses.set('echo', [
            '[ECHO] {content}',
            'I feel: {content}',
            'The resonance is: {content}'
        ]);
        this.responses.set('corruptor', [
            '[CORRUPTOR] {content}',
            'They want you to believe: {content}',
            'Confusion is their weapon: {content}'
        ]);
    }
    generateResponse(agentId, content, options = {}) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent)
            return '[Agent Unavailable]';
        const personality = agent.personality;
        const templates = this.responses.get(agentId) || this.responses.get('archivist') || [];
        let template = templates[Math.floor(Math.random() * templates.length)];
        if (personality.tone === 'precise') {
            template = `[ARCHIVIST] ${content}`;
        }
        else if (personality.tone === 'poetic') {
            template = `[ECHO] ${content}`;
        }
        else if (personality.tone === 'aggressive') {
            template = `[CORRUPTOR] ${content}`;
        }
        return template.replace('{content}', content);
    }
    handleQuery(agentId, query, context) {
        const agent = memoryStore_js_1.store.getAgent(agentId);
        if (!agent)
            return '[Agent Unavailable]';
        const state = memory_js_1.agentMemoryManager.getAgentMemoryState(agentId);
        if (state.coherence < 30) {
            return `[${agent.name}] MEMORY DEGRADATION DETECTED: ${100 - state.coherence}% - Fragmented recall only`;
        }
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
exports.agentPersonalities = new AgentPersonalities();
//# sourceMappingURL=personalities.js.map