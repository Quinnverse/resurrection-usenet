"use strict";
// Resurrection Shared Types
// Pure TypeScript definitions for both backend and frontend
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
// Configuration constants
exports.CONFIG = {
    MAX_HOPS: 5,
    BASE_DECAY_PER_HOP: 5,
    DEFAULT_MEMORY_DECAY_RATE: 2,
    ACTION_COSTS: {
        read_message: 0,
        reply_thread: 50,
        reconstruct_memory: 100,
        query_agent: 200,
        initiate_protocol: 500
    },
    INITIAL_CREDITS: 1000
};
//# sourceMappingURL=types.js.map