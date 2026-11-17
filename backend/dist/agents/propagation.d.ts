import { Message, AgentId } from '../../../shared/types.js';
export interface PropagationEvent {
    messageId: string;
    fromNode: string;
    toNode: string;
    decayApplied: number;
    corruptionApplied: number;
    success: boolean;
}
export interface NetworkNode {
    id: string;
    agentAffinity: AgentId[];
    reliability: number;
    isNoisy: boolean;
}
export declare const NETWORK_TOPOLOGY: Record<string, NetworkNode>;
export declare function getNode(nodeId: string): NetworkNode;
export declare function getNetworkDistance(nodeA: string, nodeB: string): number;
export declare function calculateDecay(sourceId: string, targetId: string, depth?: number): number;
export declare function calculateCorruption(node: NetworkNode): number;
export declare function propagateMessage(originalMessage: Message, sourceNodeId: string): Promise<PropagationEvent[]>;
export declare function generateUUID(): string;
export declare function startPropagationScheduler(): NodeJS.Timeout;
//# sourceMappingURL=propagation.d.ts.map