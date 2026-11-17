"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgents = getAgents;
exports.getAgent = getAgent;
exports.queryAgent = queryAgent;
// Agents API Routes
const memoryStore_js_1 = require("../database/memoryStore.js");
const memory_js_1 = require("../agents/memory.js");
const personalities_js_1 = require("../agents/personalities.js");
function getAgents() {
    return memoryStore_js_1.store.getAgents();
}
function getAgent(id) {
    const agent = memoryStore_js_1.store.getAgent(id);
    if (agent) {
        const memoryState = memory_js_1.agentMemoryManager.getAgentMemoryState(id);
        return { ...agent, memoryState };
    }
    return undefined;
}
async function queryAgent(id, query, context) {
    const agent = memoryStore_js_1.store.getAgent(id);
    if (!agent) {
        throw new Error('Agent not found');
    }
    const response = personalities_js_1.agentPersonalities.handleQuery(id, query || 'General inquiry', context);
    memoryStore_js_1.store.updateAgent(id, { lastActive: Date.now() });
    memory_js_1.agentMemoryManager.decayAgentMemory(id, 0.1);
    return {
        agentId: id,
        response,
        confidence: memory_js_1.agentMemoryManager.getAgentMemoryState(id).coherence
    };
}
//# sourceMappingURL=agents.js.map