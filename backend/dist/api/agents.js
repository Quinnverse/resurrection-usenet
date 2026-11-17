"use strict";
// Agents API Routes
// Handles agent queries and state management
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgents = getAgents;
exports.getAgent = getAgent;
exports.queryAgent = queryAgent;
const memoryStore_js_1 = require("../database/memoryStore.js");
const memory_js_1 = require("../agents/memory.js");
const personalities_js_1 = require("../agents/personalities.js");
async function getAgents(req, res) {
    try {
        const agents = memoryStore_js_1.store.getAgents();
        res.json(agents);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve agents' });
    }
}
async function getAgent(req, res) {
    try {
        const { id } = req.params;
        const agent = memoryStore_js_1.store.getAgent(id);
        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        // Get current memory state
        const memoryState = memory_js_1.agentMemoryManager.getAgentMemoryState(id);
        res.json({
            ...agent,
            memoryState
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve agent' });
    }
}
async function queryAgent(req, res) {
    try {
        const { id } = req.params;
        const { query, context } = req.body;
        const agent = memoryStore_js_1.store.getAgent(id);
        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        // Query the agent
        const response = personalities_js_1.agentPersonalities.handleQuery(id, query || 'General inquiry', context);
        // Update agent last active time
        memoryStore_js_1.store.updateAgent(id, { lastActive: Date.now() });
        // Decay memory slightly
        memory_js_1.agentMemoryManager.decayAgentMemory(id, 0.1);
        res.json({
            agentId: id,
            response,
            confidence: memory_js_1.agentMemoryManager.getAgentMemoryState(id).coherence
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to query agent' });
    }
}
//# sourceMappingURL=agents.js.map