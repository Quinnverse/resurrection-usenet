export declare function getMessages(): Message[];
export declare function getMessage(id: string): Message | undefined;
export declare function getThreadMessages(threadId: string): Message[];
export declare function createMessage(body: any): Promise<Message>;
export declare function reconstructMessage(id: string, agentIds: string[]): Promise<any>;
//# sourceMappingURL=messages.d.ts.map