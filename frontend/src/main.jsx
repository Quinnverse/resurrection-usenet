// Resurrection Frontend - Complete MVP
import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// Initial state
const INITIAL_AGENTS = [
  { id: 'archivist', name: 'Archivist', description: 'Preserves memory', personality: { tone: 'precise' }, currentMemoryState: 100, memoryDecayRate: 2 },
  { id: 'echo', name: 'Echo', description: 'Recalls emotional resonance', personality: { tone: 'poetic' }, currentMemoryState: 95, memoryDecayRate: 3 },
  { id: 'corruptor', name: 'Corruptor', description: 'Challenges narratives', personality: { tone: 'aggressive' }, currentMemoryState: 85, memoryDecayRate: 5 }
];

const ACTION_COSTS = { read_message: 0, reply_thread: 50, reconstruct_memory: 100, query_agent: 200, initiate_protocol: 500 };

// API helpers
async function apiRequest(path, options = {}) {
  const res = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  return await res.json();
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [agents, setAgents] = useState(INITIAL_AGENTS);
  const [gameState, setGameState] = useState({ credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, currentEnding: null });
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Load initial data
    apiRequest('/messages').then(data => setMessages(data));
    apiRequest('/agents').then(data => setAgents(data));
    apiRequest('/game/state').then(data => setGameState(data));
  }, []);

  // Calculate threads
  const computedThreads = useMemo(() => {
    const threadMap = new Map();
    messages.forEach(msg => {
      if (!threadMap.has(msg.threadId)) {
        threadMap.set(msg.threadId, { id: msg.threadId, subject: msg.subject, count: 1, last: msg });
      } else {
        const t = threadMap.get(msg.threadId);
        t.count++;
        if (msg.metadata?.timestamp > t.last.metadata?.timestamp) t.last = msg;
      }
    });
    return Array.from(threadMap.values());
  }, [messages]);

  const selectedMessages = useMemo(() => {
    if (!selectedThread) return [];
    return messages.filter(m => m.threadId === selectedThread);
  }, [messages, selectedThread]);

  const handleCreateMessage = async (content, agentId) => {
    const msg = await apiRequest('/messages', { method: 'POST', body: JSON.stringify({ threadId: 'thread-' + Date.now(), agentId, content, subject: 'New Thread', nodeId: 'node-central' }) });
    setMessages(prev => [...prev, msg]);
  };

  const handleQueryAgent = async (agentId) => {
    if (!query.trim()) return;
    const result = await apiRequest('/agents/' + agentId + '/query', { method: 'POST', body: JSON.stringify({ query }) });
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, currentMemoryState: result.confidence } : a));
    setQuery('');
  };

  const handleReconstruct = async (msgId) => {
    const result = await apiRequest('/messages/' + msgId + '/reconstruct', { method: 'PUT', body: JSON.stringify({ agentIds: ['archivist'] }) });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, metadata: result } : m));
  };

  const handleAction = async (actionType, targetId) => {
    const result = await apiRequest('/game/action', { method: 'POST', body: JSON.stringify({ actionType, targetId }) });
    setGameState(result.gameState);
  };

  const handleEnding = async () => {
    const result = await apiRequest('/game/ending');
    setGameState(prev => ({ ...prev, currentEnding: result.endingType }));
  };

  // Render
  return (
    <div className="terminal-window">
      <header className="terminal-header">
        <div className="terminal-title">
          <span className="ansi-cyan">/// RESURRECTION</span>
          <span className="ansi-white"> THE INTERNET REMEMBERS THE DEAD</span>
        </div>
        <div className="terminal-status">
          <div className="status-item"><div className="status-indicator"></div><span className="ansi-green">SYSTEM ONLINE</span></div>
          <div className="status-item"><span className="ansi-gold">PHASE:</span><span className="ansi-white">{gameState.storyProgress.discoveryPhase + 1}/4</span></div>
          <div className="status-item"><span className="ansi-gold">CREDITS:</span><span className="ansi-gold">{gameState.credits}</span></div>
        </div>
      </header>

      <div className="terminal-content">
        <aside className="terminal-sidebar">
          <h3 className="ansi-gold">NEWGROUPS</h3>
          <nav className="thread-list">
            {computedThreads.map(t => (
              <div key={t.id} className="thread-item" onClick={() => setSelectedThread(t.id)} style={{ cursor: 'pointer' }}>
                <span className="ansi-white">[{t.id.slice(0,8)}]</span> {t.subject}
                <div className="ansi-dim">{t.count} msg | {new Date(t.last.metadata?.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="terminal-main">
          {selectedThread && (
            <div>
              <h2 className="ansi-cyan">{selectedThread}</h2>
              <div className="message-list">
                {selectedMessages.map(msg => (
                  <article key={msg.id} className="message-item">
                    <header className="message-header">
                      <span className="ansi-blue">{msg.agentId.toUpperCase()}</span>
                      <span className="ansi-dim">{new Date(msg.metadata?.timestamp).toLocaleString()} | Seq: {msg.metadata?.sequence}</span>
                    </header>
                    <div className="message-content">{msg.content}</div>
                    {msg.metadata?.decayLevel > 40 && (
                      <div className="message-actions">
                        <button className="action-btn" onClick={() => handleReconstruct(msg.id)}>RECONSTRUCT [{ACTION_COSTS.reconstruct_memory} CR]</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <aside className="agent-panel">
        <h3 className="ansi-gold">AGENTS</h3>
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <h4 className="agent-name ansi-white">{agent.name}</h4>
            <p className="ansi-dim">{agent.description}</p>
            <div className="memory-bar"><div className="memory-bar-fill" style={{ width: agent.currentMemoryState + '%' }}></div></div>
            <form onSubmit={e => { e.preventDefault(); handleQueryAgent(agent.id); }}>
              <input className="input-field" placeholder="Ask..." value={query} onChange={e => setQuery(e.target.value)} />
              <button type="submit" className="action-btn ansi-dim">QUERY [{ACTION_COSTS.query_agent} CR]</button>
            </form>
          </div>
        ))}
      </aside>

      <footer className="terminal-footer">
        <div className="action-menu">
          <button className="action-btn" onClick={() => handleAction('read_message')}>READ [0 CR]</button>
          <button className="action-btn" onClick={() => handleAction('reply_thread')}>REPLY [{ACTION_COSTS.reply_thread} CR]</button>
          <button className="action-btn" onClick={() => handleAction('reconstruct_memory')}>RECONSTRUCT [{ACTION_COSTS.reconstruct_memory} CR]</button>
          <button className="action-btn" onClick={() => handleAction('query_agent')}>QUERY [{ACTION_COSTS.query_agent} CR]</button>
          <button className="action-btn" onClick={handleEnding}>INITIATE [{ACTION_COSTS.initiate_protocol} CR]</button>
        </div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);