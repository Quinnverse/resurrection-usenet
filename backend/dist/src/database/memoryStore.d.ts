import { Message, Agent, GameState, ActionLog, ReplayEvent } from '../shared/types.js';
export declare class InMemoryStore {
    private messages;
    private agents;
    private gameState;
    private actionLogs;
    private replayEvents;
    private nextActionId;
    getMessage(id: string): Message | undefined;
    getMessages(): Message[];
    getThreadMessages(threadId: string): Message[];
    createMessage(message: Omit<Message, 'id' | 'metadata'> & {
        metadata?: Partial<Message['metadata']>;
    }): Message;
    updateMessage(id: string, updates: Partial<Message>): void;
    getAgent(id: string): Agent | undefined;
    getAgents(): Agent[];
    createAgent(agent: Agent): void;
    updateAgent(id: string, updates: Partial<Agent>): void;
    getGameState(): GameState;
    updateGameState(updates: Partial<GameState>): void;
    logAction(action: ActionLog): void;
    getActionLogs(): ActionLog[];
    logReplayEvent(event: Omit<ReplayEvent, 'id' | 'timestamp' | 'deterministicKey'>): void;
    private generateDeterministicKey;
    getReplayEvents(): ReplayEvent[];
    initializeDefaultData(): void;
}
export declare const store: InMemoryStore;
//# sourceMappingURL=memoryStore.d.ts.map