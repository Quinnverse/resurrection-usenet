"use strict";
// Game State API Routes
// Handles game state, actions, and endings
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameState = getGameState;
exports.updateGameState = updateGameState;
exports.performAction = performAction;
exports.checkEnding = checkEnding;
const memoryStore_js_1 = require("../database/memoryStore.js");
const memory_js_1 = require("../agents/memory.js");
const types_js_1 = require("../../../shared/types.js");
async function getGameState(req, res) {
    try {
        const gameState = memoryStore_js_1.store.getGameState();
        res.json(gameState);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve game state' });
    }
}
async function updateGameState(req, res) {
    try {
        const updates = req.body;
        memoryStore_js_1.store.updateGameState(updates);
        // Log the action
        const gameState = memoryStore_js_1.store.getGameState();
        memoryStore_js_1.store.logAction({
            id: 0,
            timestamp: Date.now(),
            actionType: updates.actionType,
            targetId: updates.targetId,
            creditsSpent: updates.creditsSpent || 0,
            details: JSON.stringify(updates)
        });
        res.json(memoryStore_js_1.store.getGameState());
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update game state' });
    }
}
async function performAction(req, res) {
    try {
        const { actionType, targetId } = req.body;
        const gameState = memoryStore_js_1.store.getGameState();
        // Check credits
        const cost = types_js_1.CONFIG.ACTION_COSTS[actionType] || 0;
        if (gameState.credits < cost) {
            res.status(400).json({ error: 'Insufficient credits' });
            return;
        }
        // Deduct credits
        memoryStore_js_1.store.updateGameState({ credits: gameState.credits - cost });
        // Log the action
        memoryStore_js_1.store.logAction({
            id: 0,
            timestamp: Date.now(),
            actionType: actionType,
            targetId,
            creditsSpent: cost,
            details: JSON.stringify(req.body)
        });
        // Process action-specific logic
        let result = {};
        if (actionType === 'reconstruct_memory') {
            const message = memoryStore_js_1.store.getMessage(targetId || '');
            if (message) {
                const fragments = [memory_js_1.agentMemoryManager.getAgentFragment('archivist', message)];
                const combined = memory_js_1.agentMemoryManager.combineMemories(fragments);
                memoryStore_js_1.store.updateMessage(targetId || '', {
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
        res.json({
            success: true,
            actionType,
            cost,
            gameState: memoryStore_js_1.store.getGameState(),
            result
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to perform action' });
    }
}
async function checkEnding(req, res) {
    try {
        const gameState = memoryStore_js_1.store.getGameState();
        // Simple ending logic based on credits and story progress
        let endingType = null;
        if (gameState.credits >= 1000) {
            endingType = 'preservation'; // Archivist successful
        }
        else if (gameState.credits < 500) {
            endingType = 'dispersal'; // Corruptor successful
        }
        if (endingType) {
            memoryStore_js_1.store.updateGameState({ currentEnding: endingType, choiceMade: true });
        }
        res.json({ endingType, gameState: memoryStore_js_1.store.getGameState() });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check ending' });
    }
}
//# sourceMappingURL=game.js.map