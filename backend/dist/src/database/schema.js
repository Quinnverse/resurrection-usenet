"use strict";
// Database schema initialization
// Pure JavaScript/TypeScript for in-memory SQLite simulation
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_GAME_STATE = exports.INITIAL_AGENTS = exports.SCHEMA = void 0;
exports.SCHEMA = {
    messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      parent_message_id TEXT,
      agent_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      recipient TEXT,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      node_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `,
    agents: `
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      personality TEXT NOT NULL,
      current_memory_state INTEGER NOT NULL,
      memory_decay_rate INTEGER NOT NULL,
      last_active INTEGER NOT NULL,
      node_affinity TEXT NOT NULL
    );
  `,
    game_state: `
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      player_id TEXT NOT NULL,
      scenario TEXT NOT NULL,
      discovery_phase INTEGER NOT NULL,
      pattern_recognition INTEGER NOT NULL,
      truth_uncovered INTEGER NOT NULL,
      choice_made INTEGER NOT NULL,
      ending TEXT,
      completion_timestamp INTEGER,
      credits INTEGER NOT NULL DEFAULT 1000,
      updated_at INTEGER NOT NULL
    );
  `,
    action_log: `
    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_id TEXT,
      payload TEXT,
      timestamp INTEGER NOT NULL,
      credits_spent INTEGER NOT NULL
    );
  `,
    replay_log: `
    CREATE TABLE IF NOT EXISTS replay_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      payload TEXT,
      deterministic_key TEXT NOT NULL
    );
  `
};
exports.INITIAL_AGENTS = [
    {
        id: 'archivist',
        name: 'Archivist',
        description: 'Preserves memory in pristine condition - precise, organized, detailed',
        personality: JSON.stringify({
            tone: 'precise',
            fragmentationLevel: 0.1,
            memoryFocus: 'factual'
        }),
        currentMemoryState: 100,
        memoryDecayRate: 2,
        lastActive: Date.now(),
        nodeAffinity: JSON.stringify(['node-archivist', 'node-central'])
    },
    {
        id: 'echo',
        name: 'Echo',
        description: 'Recalls emotional resonance - fragmented, poetic, emotional',
        personality: JSON.stringify({
            tone: 'poetic',
            fragmentationLevel: 0.7,
            memoryFocus: 'emotional'
        }),
        currentMemoryState: 95,
        memoryDecayRate: 3,
        lastActive: Date.now(),
        nodeAffinity: JSON.stringify(['node-echo', 'node-central'])
    },
    {
        id: 'corruptor',
        name: 'Corruptor',
        description: 'Challenges dominant narratives - aggressive, cynical, fragmented',
        personality: JSON.stringify({
            tone: 'aggressive',
            fragmentationLevel: 0.9,
            memoryFocus: 'challenging'
        }),
        currentMemoryState: 85,
        memoryDecayRate: 5,
        lastActive: Date.now(),
        nodeAffinity: JSON.stringify(['node-corruptor', 'node-mixed'])
    }
];
exports.INITIAL_GAME_STATE = {
    id: 1,
    player_id: 'player-1',
    scenario: 'dr-vance-mystery',
    discovery_phase: 0,
    pattern_recognition: 0,
    truth_uncovered: 0,
    choice_made: 0,
    ending: null,
    completion_timestamp: null,
    credits: 1000,
    updated_at: Date.now()
};
//# sourceMappingURL=schema.js.map