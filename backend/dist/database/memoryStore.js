"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = exports.InMemoryStore = void 0;
const uuid_1 = require("uuid");
class InMemoryStore {
    constructor() {
        this.messages = new Map();
        this.agents = new Map();
        this.gameState = null;
        this.actionLogs = [];
        this.replayEvents = [];
        this.nextActionId = 1;
    }
    // Messages
    getMessage(id) {
        return this.messages.get(id);
    }
    getMessages() {
        return Array.from(this.messages.values());
    }
    getThreadMessages(threadId) {
        return Array.from(this.messages.values())
            .filter(m => m.threadId === threadId)
            .sort((a, b) => a.metadata.sequence - b.metadata.sequence);
    }
    createMessage(message) {
        const id = (0, uuid_1.v4)();
        const now = Date.now();
        const msg = {
            ...message,
            id,
            metadata: {
                timestamp: now,
                sequence: message.metadata?.sequence || 0,
                decayLevel: message.metadata?.decayLevel || 0,
                corruptedBytes: message.metadata?.corruptedBytes || 0,
                reconstructionLevel: message.metadata?.reconstructionLevel || 0,
                propagationPath: message.metadata?.propagationPath || [],
                ...message.metadata
            },
            status: message.status || 'pending',
            nodeId: message.nodeId
        };
        this.messages.set(id, msg);
        return msg;
    }
    updateMessage(id, updates) {
        const existing = this.messages.get(id);
        if (existing) {
            this.messages.set(id, { ...existing, ...updates });
        }
    }
    // Agents
    getAgent(id) {
        return this.agents.get(id);
    }
    getAgents() {
        return Array.from(this.agents.values());
    }
    createAgent(agent) {
        this.agents.set(agent.id, agent);
    }
    updateAgent(id, updates) {
        const existing = this.agents.get(id);
        if (existing) {
            this.agents.set(id, { ...existing, ...updates, lastActive: Date.now() });
        }
    }
    // Game State
    getGameState() {
        if (!this.gameState) {
            this.gameState = {
                playerId: 'player-1',
                currentScenario: 'dr-vance-mystery',
                storyProgress: {
                    discoveryPhase: 0,
                    patternRecognition: false,
                    truthUncovered: false,
                    choiceMade: false
                },
                playerActions: [],
                agentStates: {},
                activeThreads: [],
                credits: 1000
            };
        }
        return this.gameState;
    }
    updateGameState(updates) {
        if (this.gameState) {
            this.gameState = { ...this.gameState, ...updates };
        }
    }
    // Action Logs
    logAction(action) {
        this.actionLogs.push({ ...action, id: this.nextActionId++ });
    }
    getActionLogs() {
        return this.actionLogs;
    }
    // Replay Events
    logReplayEvent(event) {
        const replayEvent = {
            ...event,
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            deterministicKey: this.generateDeterministicKey(event)
        };
        this.replayEvents.push(replayEvent);
    }
    generateDeterministicKey(event) {
        // Simple deterministic hash for replay verification
        const str = JSON.stringify(event.payload || {});
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return `key-${Math.abs(hash).toString(16).padStart(8, '0')}`;
    }
    getReplayEvents() {
        return this.replayEvents;
    }
    // Initialization
    initializeDefaultData() {
        // Initialize agents
        const { INITIAL_AGENTS } = await Promise.resolve().then(() => __importStar(require('./schema.js')));
        INITIAL_AGENTS.forEach(agentData => {
            this.agents.set(agentData.id, {
                ...agentData,
                personality: JSON.parse(agentData.personality)
            });
        });
        // Initialize game state
        this.gameState = {
            playerId: 'player-1',
            currentScenario: 'dr-vance-mystery',
            storyProgress: {
                discoveryPhase: 0,
                patternRecognition: false,
                truthUncovered: false,
                choiceMade: false
            },
            playerActions: [],
            agentStates: {},
            activeThreads: [],
            credits: 1000
        };
    }
}
exports.InMemoryStore = InMemoryStore;
exports.store = new InMemoryStore();
//# sourceMappingURL=memoryStore.js.map