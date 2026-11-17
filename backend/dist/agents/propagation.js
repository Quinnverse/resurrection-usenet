"use strict";
// Message Propagation Engine
// Simulates USENET-style message propagation across nodes with decay and corruption
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORK_TOPOLOGY = void 0;
exports.getNode = getNode;
exports.getNetworkDistance = getNetworkDistance;
exports.calculateDecay = calculateDecay;
exports.calculateCorruption = calculateCorruption;
exports.propagateMessage = propagateMessage;
exports.generateUUID = generateUUID;
exports.startPropagationScheduler = startPropagationScheduler;
const types_js_1 = require("../../../shared/types.js");
const memoryStore_js_1 = require("../database/memoryStore.js");
// Simulated network topology
exports.NETWORK_TOPOLOGY = {
    'node-archivist': {
        id: 'node-archivist',
        agentAffinity: ['archivist'],
        reliability: 0.95,
        isNoisy: false
    },
    'node-echo': {
        id: 'node-echo',
        agentAffinity: ['echo'],
        reliability: 0.85,
        isNoisy: false
    },
    'node-corruptor': {
        id: 'node-corruptor',
        agentAffinity: ['corruptor'],
        reliability: 0.75,
        isNoisy: true
    },
    'node-central': {
        id: 'node-central',
        agentAffinity: ['archivist', 'echo', 'corruptor'],
        reliability: 0.9,
        isNoisy: false
    },
    'node-mixed': {
        id: 'node-mixed',
        agentAffinity: ['archivist', 'echo'],
        reliability: 0.8,
        isNoisy: true
    }
};
function getNode(nodeId) {
    return exports.NETWORK_TOPOLOGY[nodeId] || exports.NETWORK_TOPOLOGY['node-central'];
}
function getNetworkDistance(nodeA, nodeB) {
    // Simple distance calculation based on node relationships
    const nodesA = Object.entries(exports.NETWORK_TOPOLOGY)
        .filter(([_, node]) => node.agentAffinity.some(a => exports.NETWORK_TOPOLOGY[nodeB]?.agentAffinity?.includes(a)))
        .map(([id]) => id);
    if (nodesA.includes(nodeB))
        return 1;
    return 2; // Default to 2 hops for simplicity
}
function calculateDecay(sourceId, targetId, depth = 1) {
    const baseDecay = types_js_1.CONFIG.BASE_DECAY_PER_HOP; // 5% per hop
    const depthFactor = Math.pow(1.5, depth); // Exponential decay multiplier
    const targetNode = getNode(targetId);
    const nodeFactor = targetNode.isNoisy ? 1.5 : 1.0;
    return Math.floor(baseDecay * depthFactor * nodeFactor);
}
function calculateCorruption(node) {
    if (node.isNoisy) {
        return Math.floor(Math.random() * 10); // 0-9 bytes corruption
    }
    return Math.floor(Math.random() * 3); // 0-2 bytes corruption
}
async function propagateMessage(originalMessage, sourceNodeId) {
    const events = [];
    const visited = new Set();
    const queue = [{ nodeId: sourceNodeId, depth: 0 }];
    while (queue.length > 0 && visited.size < types_js_1.CONFIG.MAX_HOPS + 1) {
        const { nodeId, depth } = queue.shift();
        if (visited.has(nodeId))
            continue;
        visited.add(nodeId);
        if (depth >= types_js_1.CONFIG.MAX_HOPS)
            continue;
        const sourceNode = getNode(sourceNodeId);
        const targetNode = getNode(nodeId);
        const decay = calculateDecay(sourceNodeId, nodeId, depth);
        const corruption = calculateCorruption(targetNode);
        // Attempt propagation based on node reliability
        const success = Math.random() < targetNode.reliability;
        if (success && nodeId !== sourceNodeId) {
            // Create propagated message
            const propagatedMessage = {
                ...originalMessage,
                id: generateUUID(),
                nodeId: nodeId,
                metadata: {
                    ...originalMessage.metadata,
                    decayLevel: Math.min(100, originalMessage.metadata.decayLevel + decay),
                    corruptedBytes: (originalMessage.metadata.corruptedBytes || 0) + corruption,
                    sequence: originalMessage.metadata.sequence + 1,
                    propagationPath: [
                        ...originalMessage.metadata.propagationPath || [],
                        nodeId
                    ]
                }
            };
            // Store the propagated message
            memoryStore_js_1.store.createMessage({
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
        // Add neighbors to queue (simplified: all nodes are neighbors)
        Object.keys(exports.NETWORK_TOPOLOGY)
            .filter(id => !visited.has(id))
            .forEach(id => queue.push({ nodeId: id, depth: depth + 1 }));
    }
    return events;
}
function generateUUID() {
    // Simple UUID-like generator
    return 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}
// Propagation scheduler
function startPropagationScheduler() {
    return setInterval(async () => {
        // Check for pending messages to propagate
        const pendingMessages = memoryStore_js_1.store.getMessages().filter(m => m.status === 'pending');
        for (const message of pendingMessages) {
            if (message.metadata.propagationPath?.length || 0 < 3) {
                await propagateMessage(message, message.nodeId);
            }
        }
    }, 2000); // Check every 2 seconds
}
//# sourceMappingURL=propagation.js.map