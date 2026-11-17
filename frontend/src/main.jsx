// Resurrection Frontend - Main Entry Point
import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// Shared types
const CONFIG = {
  ACTION_COSTS: { read_message: 0, reply_thread: 50, reconstruct_memory: 100, query_agent: 200, initiate_protocol: 500 },
  INITIAL_CREDITS: 1000
};

const store = {
  messages: [],
  agents: [],
  gameState: { credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, playerActions: [] },
  initialize: async () => {
    try {
      const [gRes, mRes, aRes] = await Promise.all([
        fetch('/api/game/state'), fetch('/api/messages'), fetch('/api/agents')
      ]);
      if (gRes.ok) store.gameState = await gRes.json();
      if (mRes.ok) store.messages = await mRes.json();
      if (aRes.ok) store.agents = await aRes.json();
    } catch (e) { console.error('Init error:', e); }
  }
};

// Contexts
const GameContext = createContext(null);

function GameProvider({ children }) {
  const [gameState, setGameState] = useState(store.gameState);
  const [messages, setMessages] = useState(store.messages);
  const [agents, setAgents] = useState(store.agents);
  const [credits, setCredits] = useState(gameState.credits);

  const loadState = async () => {
    try {
      const [gRes, mRes, aRes] = await Promise.all([
        fetch('/api/game/state'), fetch('/api/messages'), fetch('/api/agents')
      ]);
      if (gRes.ok) { const d = await gRes.json(); setGameState(d); setCredits(d.credits); }
      if (mRes.ok) setMessages(await mRes.json());
      if (aRes.ok) setAgents(await aRes.json());
    } catch (e) { console.error('Load error:', e); }
  };

  const performAction = async (actionType, targetId) => {
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, targetId })
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.gameState);
        setCredits(data.gameState.credits);
        return data;
      }
    } catch (e) { console.error('Action error:', e); }
  };

  const sendMessage = async (content, threadId, agentId) => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, agentId, content, subject: 'New Thread', nodeId: 'node-central', sequence: 1 })
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        await performAction('reply_thread', msg.id);
      }
    } catch (e) { console.error('Send error:', e); }
  };

  const queryAgent = async (agentId, query) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        const data = await res.json();
        await performAction('query_agent', agentId);
        return data;
      }
    } catch (e) { console.error('Query error:', e); }
  };

  useEffect(() => { loadState(); }, []);

  return (
    <GameContext.Provider value={{ gameState, messages, agents, credits, loadState, performAction, sendMessage, queryAgent }}>
      {children}
    </GameContext.Provider>
  );
}

function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be within GameProvider');
  return ctx;
}

// Components
function TerminalHeader() {
  const { gameState, credits } = useGame();
  return (
    <div className="terminal-header">
      <div className="terminal-title">
        <span className="ansi-cyan">/// RESURRECTION</span>
        <span className="ansi-dim"> // </span>
        <span className="ansi-white">THE INTERNET REMEMBERS THE DEAD</span>
      </div>
      <div className="terminal-status">
        <div className="status-item">
          <div className="status-indicator"></div>
          <span className="ansi-green">SYSTEM ONLINE</span>
        </div>
        <div className="status-item">
          <span className="ansi-gold">PHASE:</span>
          <span className="ansi-white">{gameState.storyProgress.discoveryPhase + 1}/4</span>
        </div>
        <div className="status-item">
          <span className="ansi-gold">CREDITS:</span>
          <span className="ansi-gold">{credits}</span>
        </div>
      </div>
    </div>
  );
}

function ThreadList() {
  const { messages } = useGame();
  const threads = useMemo(() => {
    const map = new Map();
    messages.forEach(m => {
      if (!map.has(m.threadId)) {
        map.set(m.threadId, { id: m.threadId, subject: m.subject, count: 1, last: m });
      } else {
        const t = map.get(m.threadId);
        t.count++;
        if (m.metadata?.timestamp > t.last.metadata?.timestamp) t.last = m;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.last.metadata.timestamp - a.last.metadata.timestamp);
  }, [messages]);

  return (
    <nav className="thread-list">
      <h3 className="ansi-gold" style={{ marginBottom: '0.5rem' }}>NEWGROUPS</h3>
      {threads.map(t => (
        <div key={t.id} className="thread-item active" style={{ cursor: 'pointer' }}>
          <span className="ansi-white">[{t.id.slice(0, 8)}]</span> {t.subject}
          <div className="ansi-dim">{t.count} msg{t.count > 1 ? 's' : ''} | {new Date(t.last.metadata.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      {threads.length === 0 && <div className="ansi-yellow" style={{ padding: '1rem' }}>No threads found.</div>}
    </nav>
  );
}

function MessageItem({ msg }) {
  const decay = msg.metadata?.decayLevel || 0;
  const decayClass = decay >= 80 ? 'ansi-red' : decay >= 40 ? 'ansi-yellow' : 'ansi-green';
  return (
    <article className="message-item">
      <header className="message-header">
        <span className="ansi-blue">{msg.agentId.toUpperCase()}</span>
        {' '}&lt;<span className="ansi-cyan">{msg.sender}</span>&gt;
        <div className="ansi-dim">
          {new Date(msg.metadata.timestamp).toLocaleString()} | Seq: {msg.metadata.sequence} |
          <span className={decayClass}> [DECAY: {decay}%]</span>
        </div>
      </header>
      <div className="message-content">{msg.content}</div>
      <div className="message-actions">
        <span className="ansi-dim">Node: {msg.nodeId}</span>
        {msg.metadata.propagationPath?.length > 0 && <span className="ansi-dim"> &lt;{'>'} {msg.metadata.propagationPath.length} hop(s)</span>}
      </div>
    </article>
  );
}

function MessageList({ messages }) {
  const sorted = [...messages].sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  return (
    <div className="message-list">
      {sorted.map(m => <MessageItem key={m.id} msg={m} />)}
      {sorted.length === 0 && <div className="ansi-yellow" style={{ textAlign: 'center', padding: '2rem' }}>No messages. Select a node.</div>}
    </div>
  );
}

function MessageConsole() {
  const { messages, performAction } = useGame();
  const [threadId, setThreadId] = useState('thread-1');

  const threadMessages = messages.filter(m => m.threadId === threadId);

  const onReconstruct = async (id) => {
    await performAction('reconstruct_memory', id);
  };

  return (
    <div className="terminal-content">
      <aside className="terminal-sidebar">
        <ThreadList />
        <div style={{ marginTop: '1rem' }}>
          <h3 className="ansi-yellow" style={{ fontSize: '0.85rem' }}>AVAILABLE NODES</h3>
          <ul className="ansi-dim" style={{ paddingLeft: '1rem' }}>
            <li>node-archivist</li>
            <li>node-echo</li>
            <li>node-corruptor</li>
            <li>node-central</li>
          </ul>
        </div>
      </aside>
      <main className="terminal-main">
        <h2 className="ansi-cyan">{threadId} - {threadMessages.length} MESSAGES</h2>
        <MessageList messages={threadMessages} />
        <div style={{ marginTop: '1rem' }}>
          <form onSubmit={e => { e.preventDefault(); performAction('reply_thread'); }}>
            <input className="input-field" placeholder="Type your message..." />
          </form>
        </div>
      </main>
    </div>
  );
}

function AgentPanel() {
  const { agents, queryAgent, performAction } = useGame();

  const handleQuery = async (agentId, e) => {
    e.preventDefault();
    const input = e.target.elements.query;
    if (input.value.trim()) {
      await queryAgent(agentId, input.value);
      input.value = '';
    }
  };

  return (
    <aside className="agent-panel">
      <h2 className="ansi-gold">AGENTS</h2>
      {agents.map(a => {
        const color = a.id === 'archivist' ? 'ansi-blue' : a.id === 'echo' ? 'ansi-purple' : 'ansi-cyan';
        return (
          <div key={a.id} className={`agent-card ${a.id}`}>
            <div className="agent-name"><span className={color}>{a.name}</span></div>
            <p className="ansi-dim" style={{ fontSize: '0.85rem' }}>{a.description}</p>
            <div className="memory-bar">
              <div className="memory-bar-fill" style={{ width: `${a.currentMemoryState}%` }}></div>
            </div>
            <form onSubmit={e => handleQuery(a.id, e)}>
              <input name="query" className="input-field" placeholder={`Ask ${a.name}...`} />
              <button type="submit" className="action-btn ansi-dim" style={{ fontSize: '0.75rem' }}>QUERY</button>
            </form>
          </div>
        );
      })}
    </aside>
  );
}

function ActionMenu() {
  const { performAction, credits, messages, gameState } = useGame();
  const canReconstruct = messages.some(m => (m.metadata.decayLevel || 0) >= 40);
  const canInitiate = gameState.storyProgress.truthUncovered || credits < 200;

  const costs = CONFIG.ACTION_COSTS;

  return (
    <div className="action-menu">
      <button className="action-btn" onClick={() => performAction('read_message')}>
        READ [{costs.read_message} CR]
      </button>
      <button className="action-btn" onClick={() => performAction('reply_thread')} disabled={credits < costs.reply_thread}>
        REPLY [{costs.reply_thread} CR]
      </button>
      <button className="action-btn" onClick={() => performAction('reconstruct_memory')} disabled={!canReconstruct || credits < costs.reconstruct_memory}>
        RECONSTRUCT [{costs.reconstruct_memory} CR]
      </button>
      <button className="action-btn" onClick={() => performAction('query_agent')} disabled={credits < costs.query_agent}>
        QUERY [{costs.query_agent} CR]
      </button>
      <button className="action-btn" onClick={() => performAction('initiate_protocol')} disabled={!canInitiate || credits < costs.initiate_protocol}>
        INITIATE [{costs.initiate_protocol} CR]
      </button>
    </div>
  );
}

function TerminalShell() {
  return (
    <div className="terminal-window">
      <TerminalHeader />
      <MessageConsole />
      <AgentPanel />
      <footer className="terminal-footer">
        <ActionMenu />
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <span className="ansi-dim">Type '/help' for commands</span>
        </div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GameProvider>
      <TerminalShell />
    </GameProvider>
  </React.StrictMode>
);