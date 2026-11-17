// Resurrection Frontend - Complete MVP
// Works with CDN React (no build step needed)

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

// React component as a function (works with React.createElement)
function App() {
  const [messages, setMessages] = React.useState([]);
  const [agents, setAgents] = React.useState(INITIAL_AGENTS);
  const [gameState, setGameState] = React.useState({ credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, currentEnding: null });
  const [threads, setThreads] = React.useState([]);
  const [selectedThread, setSelectedThread] = React.useState(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    // Load initial data
    apiRequest('/messages').then(data => setMessages(data));
    apiRequest('/agents').then(data => setAgents(data));
    apiRequest('/game/state').then(data => setGameState(data));
  }, []);

  // Calculate threads
  const computedThreads = React.useMemo(() => {
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

  const selectedMessages = React.useMemo(() => {
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

  // Render using React.createElement instead of JSX
  return React.createElement('div', { className: 'terminal-window' },
    React.createElement('header', { className: 'terminal-header' },
      React.createElement('div', { className: 'terminal-title' },
        React.createElement('span', { className: 'ansi-cyan' }, '/// RESURRECTION'),
        React.createElement('span', { className: 'ansi-white' }, ' THE INTERNET REMEMBERS THE DEAD')
      ),
      React.createElement('div', { className: 'terminal-status' },
        React.createElement('div', { className: 'status-item' },
          React.createElement('div', { className: 'status-indicator' }),
          React.createElement('span', { className: 'ansi-green' }, 'SYSTEM ONLINE')
        ),
        React.createElement('div', { className: 'status-item' },
          React.createElement('span', { className: 'ansi-gold' }, 'PHASE:'),
          React.createElement('span', { className: 'ansi-white' }, gameState.storyProgress.discoveryPhase + 1 + '/4')
        ),
        React.createElement('div', { className: 'status-item' },
          React.createElement('span', { className: 'ansi-gold' }, 'CREDITS:'),
          React.createElement('span', { className: 'ansi-gold' }, gameState.credits)
        )
      )
    ),
    React.createElement('div', { className: 'terminal-content' },
      React.createElement('aside', { className: 'terminal-sidebar' },
        React.createElement('h3', { className: 'ansi-gold' }, 'NEWGROUPS'),
        React.createElement('nav', { className: 'thread-list' },
          computedThreads.map(t => React.createElement('div', {
            key: t.id,
            className: 'thread-item',
            onClick: () => setSelectedThread(t.id),
            style: { cursor: 'pointer' }
          },
            React.createElement('span', { className: 'ansi-white' }, '[' + t.id.slice(0, 8) + ']'),
            ' ',
            t.subject,
            React.createElement('div', { className: 'ansi-dim' }, t.count + ' msg | ' + new Date(t.last.metadata?.timestamp).toLocaleTimeString())
          ))
        )
      ),
      React.createElement('main', { className: 'terminal-main' },
        selectedThread && React.createElement('div', null,
          React.createElement('h2', { className: 'ansi-cyan' }, selectedThread),
          React.createElement('div', { className: 'message-list' },
            selectedMessages.map(msg => React.createElement('article', { key: msg.id, className: 'message-item' },
              React.createElement('header', { className: 'message-header' },
                React.createElement('span', { className: 'ansi-blue' }, msg.agentId.toUpperCase()),
                React.createElement('span', { className: 'ansi-dim' }, new Date(msg.metadata?.timestamp).toLocaleString() + ' | Seq: ' + msg.metadata?.sequence)
              ),
              React.createElement('div', { className: 'message-content' }, msg.content),
              msg.metadata?.decayLevel > 40 && React.createElement('div', { className: 'message-actions' },
                React.createElement('button', { className: 'action-btn', onClick: () => handleReconstruct(msg.id) }, 'RECONSTRUCT [' + ACTION_COSTS.reconstruct_memory + ' CR]')
              )
            ))
          )
        )
      )
    ),
    React.createElement('aside', { className: 'agent-panel' },
      React.createElement('h3', { className: 'ansi-gold' }, 'AGENTS'),
      agents.map(agent => React.createElement('div', { key: agent.id, className: 'agent-card' },
        React.createElement('h4', { className: 'agent-name ansi-white' }, agent.name),
        React.createElement('p', { className: 'ansi-dim' }, agent.description),
        React.createElement('div', { className: 'memory-bar' },
          React.createElement('div', { className: 'memory-bar-fill', style: { width: agent.currentMemoryState + '%' } })
        ),
        React.createElement('form', { onSubmit: e => { e.preventDefault(); handleQueryAgent(agent.id); } },
          React.createElement('input', { className: 'input-field', placeholder: 'Ask...', value: query, onChange: e => setQuery(e.target.value) }),
          React.createElement('button', { type: 'submit', className: 'action-btn ansi-dim' }, 'QUERY [' + ACTION_COSTS.query_agent + ' CR]')
        )
      ))
    ),
    React.createElement('footer', { className: 'terminal-footer' },
      React.createElement('div', { className: 'action-menu' },
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('read_message') }, 'READ [0 CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('reply_thread') }, 'REPLY [' + ACTION_COSTS.reply_thread + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('reconstruct_memory') }, 'RECONSTRUCT [' + ACTION_COSTS.reconstruct_memory + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('query_agent') }, 'QUERY [' + ACTION_COSTS.query_agent + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: handleEnding }, 'INITIATE [' + ACTION_COSTS.initiate_protocol + ' CR]')
      )
    )
  );
}

// Mount React app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
