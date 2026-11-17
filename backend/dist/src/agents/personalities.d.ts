import { AgentId } from '../shared/types.js';
export interface ResponseOptions {
    query?: string;
    context?: string;
    confidence?: number;
}
export declare class AgentPersonalities {
    private responses;
    constructor();
    private initializeResponses;
    generateResponse(agentId: AgentId, content: string, options?: ResponseOptions): string;
    handleQuery(agentId: AgentId, query: string, context?: string): string;
}
export declare const agentPersonalities: AgentPersonalities;
//# sourceMappingURL=personalities.d.ts.map