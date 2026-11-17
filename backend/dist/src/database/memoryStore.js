"use strict";
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
                agentStates: {
                    archivist: this.getAgent('archivist'),
                    echo: this.getAgent('echo'),
                    corruptor: this.getAgent('corruptor')
                },
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
        const INITIAL_AGENTS = [
            {
                id: 'archivist',
                name: 'Archivist',
                description: 'Preserves memory in pristine condition - precise, organized, detailed',
                personality: {
                    tone: 'precise',
                    fragmentationLevel: 0.1,
                    memoryFocus: 'factual'
                },
                currentMemoryState: 100,
                memoryDecayRate: 2,
                lastActive: Date.now(),
                nodeAffinity: ['node-archivist', 'node-central']
            },
            {
                id: 'echo',
                name: 'Echo',
                description: 'Recalls emotional resonance - fragmented, poetic, emotional',
                personality: {
                    tone: 'poetic',
                    fragmentationLevel: 0.7,
                    memoryFocus: 'emotional'
                },
                currentMemoryState: 95,
                memoryDecayRate: 3,
                lastActive: Date.now(),
                nodeAffinity: ['node-echo', 'node-central']
            },
            {
                id: 'corruptor',
                name: 'Corruptor',
                description: 'Challenges dominant narratives - aggressive, cynical, fragmented',
                personality: {
                    tone: 'aggressive',
                    fragmentationLevel: 0.9,
                    memoryFocus: 'challenging'
                },
                currentMemoryState: 85,
                memoryDecayRate: 5,
                lastActive: Date.now(),
                nodeAffinity: ['node-corruptor', 'node-mixed']
            }
        ];
        INITIAL_AGENTS.forEach(agentData => {
            this.agents.set(agentData.id, agentData);
        });
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
            agentStates: {
                archivist: this.getAgent('archivist'),
                echo: this.getAgent('echo'),
                corruptor: this.getAgent('corruptor')
            },
            activeThreads: [],
            credits: 1000
        };
    }
}
exports.InMemoryStore = InMemoryStore;
exports.store = new InMemoryStore();
//# sourceMappingURL=memoryStore.js.map