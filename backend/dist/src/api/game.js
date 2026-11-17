"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameState = getGameState;
exports.updateGameState = updateGameState;
exports.performAction = performAction;
exports.checkEnding = checkEnding;
// Game State API Routes
const memoryStore_js_1 = require("../database/memoryStore.js");
const memory_js_1 = require("../agents/memory.js");
const types_js_1 = require("../shared/types.js");
function getGameState() {
    return memoryStore_js_1.store.getGameState();
}
function updateGameState(updates) {
    memoryStore_js_1.store.updateGameState(updates);
    return memoryStore_js_1.store.getGameState();
}
async function performAction(actionType, targetId) {
    const gameState = memoryStore_js_1.store.getGameState();
    const cost = types_js_1.CONFIG.ACTION_COSTS[actionType] || 0;
    if (gameState.credits < cost) {
        throw new Error('Insufficient credits');
    }
    memoryStore_js_1.store.updateGameState({ credits: gameState.credits - cost });
    memoryStore_js_1.store.logAction({
        id: 0,
        timestamp: Date.now(),
        actionType,
        targetId,
        creditsSpent: cost,
        details: JSON.stringify({ actionType, targetId })
    });
    let result = {};
    if (actionType === 'reconstruct_memory' && targetId) {
        const message = memoryStore_js_1.store.getMessage(targetId);
        if (message) {
            const fragments = [memory_js_1.agentMemoryManager.getAgentFragment('archivist', message)];
            const combined = memory_js_1.agentMemoryManager.combineMemories(fragments);
            memoryStore_js_1.store.updateMessage(targetId, {
                metadata: {
                    ...message.metadata,
                    decayLevel: Math.max(0, message.metadata.decayLevel - 50),
                    reconstructionLevel: 80
                }
            });
            memory_js_1.agentMemoryManager.reconstructMemory('archivist', message);
            result = {
                reconstructedContent: combined.content,
                newDecayLevel: Math.max(0, message.metadata.decayLevel - 50)
            };
        }
    }
    return {
        success: true,
        actionType,
        cost,
        gameState: memoryStore_js_1.store.getGameState(),
        result
    };
}
function checkEnding() {
    const gameState = memoryStore_js_1.store.getGameState();
    let endingType = null;
    if (gameState.credits >= 1000) {
        endingType = 'preservation';
    }
    else if (gameState.credits < 500) {
        endingType = 'dispersal';
    }
    if (endingType) {
        memoryStore_js_1.store.updateGameState({ currentEnding: endingType, choiceMade: true });
    }
    return { endingType, gameState: memoryStore_js_1.store.getGameState() };
}
//# sourceMappingURL=game.js.map