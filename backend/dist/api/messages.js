"use strict";
// Messages API Routes
// Handles message CRUD operations
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = getMessages;
exports.getMessage = getMessage;
exports.getThreadMessages = getThreadMessages;
exports.createMessage = createMessage;
exports.reconstructMessage = reconstructMessage;
const memoryStore_js_1 = require("../database/memoryStore.js");
const propagation_js_1 = require("../agents/propagation.js");
const memory_js_1 = require("../agents/memory.js");
async function getMessages(req, res) {
    try {
        const messages = memoryStore_js_1.store.getMessages();
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
}
async function getMessage(req, res) {
    try {
        const { id } = req.params;
        const message = memoryStore_js_1.store.getMessage(id);
        if (!message) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }
        // Update status to read
        memoryStore_js_1.store.updateMessage(id, { status: 'read' });
        res.json(message);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve message' });
    }
}
async function getThreadMessages(req, res) {
    try {
        const { threadId } = req.params;
        const messages = memoryStore_js_1.store.getThreadMessages(threadId);
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve thread messages' });
    }
}
async function createMessage(req, res) {
    try {
        const body = req.body;
        const message = memoryStore_js_1.store.createMessage({
            threadId: body.threadId,
            parentMessageId: body.parentMessageId,
            agentId: body.agentId,
            sender: body.sender || 'Unknown',
            recipient: body.recipient,
            subject: body.subject || 'New Message',
            content: body.content,
            metadata: {
                sequence: body.sequence || 0,
                decayLevel: body.decayLevel || 0
            },
            status: body.status || 'pending',
            nodeId: body.nodeId || 'node-central'
        });
        // Trigger propagation
        await (0, propagation_js_1.propagateMessage)(message, message.nodeId);
        res.status(201).json(message);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create message' });
    }
}
async function reconstructMessage(req, res) {
    try {
        const { id } = req.params;
        const { agentIds } = req.body;
        const message = memoryStore_js_1.store.getMessage(id);
        if (!message) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }
        // Get memory fragments from selected agents
        const fragments = agentIds.map((agentId) => memory_js_1.agentMemoryManager.getAgentFragment(agentId, message));
        // Combine fragments
        const combined = memory_js_1.agentMemoryManager.combineMemories(fragments);
        // Update message with reconstruction
        memoryStore_js_1.store.updateMessage(id, {
            metadata: {
                ...message.metadata,
                decayLevel: Math.max(0, message.metadata.decayLevel - 50),
                reconstructionLevel: combined.confidence
            }
        });
        // Update agent memory states
        agentIds.forEach((agentId) => {
            memory_js_1.agentMemoryManager.reconstructMemory(agentId, message);
        });
        res.json({
            success: true,
            reconstructedContent: combined.content,
            newDecayLevel: Math.max(0, message.metadata.decayLevel - 50),
            confidence: combined.confidence
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to reconstruct message' });
    }
}
//# sourceMappingURL=messages.js.map