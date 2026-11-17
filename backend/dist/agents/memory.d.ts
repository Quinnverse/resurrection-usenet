import { AgentId, Message } from '../../../shared/types.js';
export interface MemoryFragment {
    id: string;
    content: string;
    confidence: number;
    timestamp: number;
}
export interface AgentMemoryState {
    coherence: number;
    fragmentation: number;
    decayRate: number;
    reconstructionLevel: number;
}
export declare class AgentMemoryManager {
    private memoryFragments;
    private lastDecayUpdate;
    getAgentMemoryState(agentId: AgentId): AgentMemoryState;
    decayAgentMemory(agentId: AgentId, hoursPassed?: number): number;
    reconstructMemory(agentId: AgentId, message: Message): number;
    getAgentFragment(agentId: AgentId, message: Message): MemoryFragment;
    private applyFragmentation;
    combineMemories(fragments: MemoryFragment[]): {
        content: string;
        confidence: number;
    };
}
export declare const agentMemoryManager: AgentMemoryManager;
//# sourceMappingURL=memory.d.ts.map