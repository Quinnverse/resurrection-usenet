export declare const SCHEMA: {
    messages: string;
    agents: string;
    game_state: string;
    action_log: string;
    replay_log: string;
};
export declare const INITIAL_AGENTS: {
    id: string;
    name: string;
    description: string;
    personality: string;
    currentMemoryState: number;
    memoryDecayRate: number;
    lastActive: number;
    nodeAffinity: string;
}[];
export declare const INITIAL_GAME_STATE: {
    id: number;
    player_id: string;
    scenario: string;
    discovery_phase: number;
    pattern_recognition: number;
    truth_uncovered: number;
    choice_made: number;
    ending: null;
    completion_timestamp: null;
    credits: number;
    updated_at: number;
};
//# sourceMappingURL=schema.d.ts.map