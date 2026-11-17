// JSON-file persistence with atomic writes
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const STATE_FILE = path.join(DATA_DIR, 'gameState.json');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const LOGS_FILE = path.join(DATA_DIR, 'actionLogs.json');

// Atomic write helper
function atomicWrite(filepath, data) {
  const tmpFile = filepath + '.tmp';
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpFile, json, 'utf8');
  fs.renameSync(tmpFile, filepath);
}

// Read helper with fallback
function safeRead(filepath, defaultValue) {
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Failed to read', filepath, ':', e.message);
  }
  return defaultValue;
}

// Persistence module
const persistence = {
  // Game State
  saveGameState(state) {
    atomicWrite(STATE_FILE, state);
  },
  loadGameState() {
    return safeRead(STATE_FILE, null);
  },
  
  // Agents
  saveAgents(agents) {
    atomicWrite(AGENTS_FILE, agents);
  },
  loadAgents() {
    return safeRead(AGENTS_FILE, null);
  },
  
  // Messages
  saveMessages(messages) {
    atomicWrite(MESSAGES_FILE, messages);
  },
  loadMessages() {
    return safeRead(MESSAGES_FILE, []);
  },
  
  // Action Logs
  saveActionLogs(logs) {
    atomicWrite(LOGS_FILE, logs);
  },
  loadActionLogs() {
    return safeRead(LOGS_FILE, []);
  },
  
  // Full backup
  saveAll(state, agents, messages, logs) {
    this.saveGameState(state);
    this.saveAgents(agents);
    this.saveMessages(messages);
    this.saveActionLogs(logs);
  },
  
  // Restore from backup
  restoreAll() {
    const state = this.loadGameState();
    const agents = this.loadAgents();
    const messages = this.loadMessages();
    const logs = this.loadActionLogs();
    return { state, agents, messages, logs };
  },
  
  // Verify integrity
  verify() {
    try {
      const files = [STATE_FILE, AGENTS_FILE, MESSAGES_FILE, LOGS_FILE];
      for (const f of files) {
        if (fs.existsSync(f)) {
          JSON.parse(fs.readFileSync(f, 'utf8'));
        }
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
};

module.exports = persistence;