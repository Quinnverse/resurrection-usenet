"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = getMessages;
exports.getMessage = getMessage;
exports.getThreadMessages = getThreadMessages;
exports.createMessage = createMessage;
exports.reconstructMessage = reconstructMessage;
// Messages API Routes
const memoryStore_js_1 = require("../database/memoryStore.js");
const propagation_js_1 = require("../agents/propagation.js");
const memory_js_1 = require("../agents/memory.js");
function getMessages() {
    return memoryStore_js_1.store.getMessages();
}
function getMessage(id) {
    const message = memoryStore_js_1.store.getMessage(id);
    if (message) {
        memoryStore_js_1.store.updateMessage(id, { status: 'read' });
    }
    return message;
}
function getThreadMessages(threadId) {
    return memoryStore_js_1.store.getThreadMessages(threadId);
}
async function createMessage(body) {
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
    await (0, propagation_js_1.propagateMessage)(message, message.nodeId);
    return message;
}
async function reconstructMessage(id, agentIds) {
    const message = memoryStore_js_1.store.getMessage(id);
    if (!message) {
        throw new Error('Message not found');
    }
    const fragments = agentIds.map((agentId) => memory_js_1.agentMemoryManager.getAgentFragment(agentId, message));
    const combined = memory_js_1.agentMemoryManager.combineMemories(fragments);
    memoryStore_js_1.store.updateMessage(id, {
        metadata: {
            ...message.metadata,
            decayLevel: Math.max(0, message.metadata.decayLevel - 50),
            reconstructionLevel: combined.confidence
        }
    });
    agentIds.forEach((agentId) => {
        memory_js_1.agentMemoryManager.reconstructMemory(agentId, message);
    });
    return {
        success: true,
        reconstructedContent: combined.content,
        newDecayLevel: Math.max(0, message.metadata.decayLevel - 50),
        confidence: combined.confidence
    };
}
//# sourceMappingURL=messages.js.map