// Resurrection Frontend - Premium Atmospheric Horror
// Works with CDN React (no build step needed)

// Agent definitions
const AGENT_DEFS = {
  archivist: {
    id: 'archivist',
    name: 'Archivist',
    description: 'Preserves memory in pristine condition',
    type: 'archivist',
    color: '#6b8c7b',
    memoryState: 100,
    decayRate: 2,
    discovered: false
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'Recalls emotional resonance',
    type: 'echo',
    color: '#7b6b8c',
    memoryState: 95,
    decayRate: 3,
    discovered: false
  },
  corruptor: {
    id: 'corruptor',
    name: 'Corruptor',
    description: 'Challenges dominant narratives',
    type: 'corruptor',
    color: '#8c6b6b',
    memoryState: 85,
    decayRate: 5,
    discovered: false
  }
};

const ACTION_COSTS = {
  read_message: 0,
  reply_thread: 50,
  reconstruct_memory: 100,
  query_agent: 200,
  initiate_protocol: 500
};

// API helpers
async function apiRequest(path, options = {}) {
  const res = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!res.ok) throw new Error('API error');
  return await res.json();
}

// Generate initial messages (atmospheric storytelling)
function generateInitialMessages() {
  const now = Date.now();
  return [
    {
      id: 'msg-001',
      threadId: 'threads.tech.mind',
      agentId: 'archivist',
      sender: 'System',
      subject: 'Network Reactivation',
      content: 'Broadcast from Sector 7:\n\nSignal detected. Network protocols initializing.\n\nThis is a recovered transmission from the archived USENET network.\n\nIf you can read this, the connection is stable - for now.\n\n-Preserve the data. Preserve the truth.',
      metadata: {
        timestamp: now - 3600000,
        sequence: 1,
        decayLevel: 5,
        corruptedBytes: 0,
        reconstructionLevel: 100
      },
      status: 'read',
      nodeId: 'node-central'
    },
    {
      id: 'msg-002',
      threadId: 'threads.tech.mind',
      agentId: 'archivist',
      sender: 'System',
      subject: 'Message Fragment #A-001',
      content: 'Subject: Elena Vance\n\nLead researcher. Disappearance: 24 hours.\n\nThe final transmission was fragmented.\n\nThere were... inconsistencies.\n\n— Must preserve',
      metadata: {
        timestamp: now - 7200000,
        sequence: 2,
        decayLevel: 15,
        corruptedBytes: 0,
        reconstructionLevel: 85
      },
      status: 'read',
      nodeId: 'node-archivist'
    },
    {
      id: 'msg-003',
      threadId: 'threads.mind.void',
      agentId: 'echo',
      sender: 'Unknown',
      subject: 'Echo Fragment #E-001',
      content: 'I can feel it... the silence.\n\nNot silence. Just... waiting.\n\nShe was screaming but the scream never came out.\n\nIt echoed. And echoed. And echoed.\n\n— Do you hear it too?',
      metadata: {
        timestamp: now - 5400000,
        sequence: 1,
        decayLevel: 25,
        corruptedBytes: 2,
        reconstructionLevel: 60
      },
      status: 'pending',
      nodeId: 'node-echo'
    },
    {
      id: 'msg-004',
      threadId: 'threads.tech.mind',
      agentId: 'corruptor',
      sender: 'System',
      subject: 'The Truth is Broken',
      content: 'Official report:\n"Controlled shutdown."\n\nLies.\n\nThe experiment failed. Not because of error.\nBecause of... refusal.\n\nShe didn\'t want to leave.\n\n— Question everything you read.',
      metadata: {
        timestamp: now - 9000000,
        sequence: 3,
        decayLevel: 45,
        corruptedBytes: 5,
        reconstructionLevel: 45
      },
      status: 'pending',
      nodeId: 'node-corruptor'
    },
    {
      id: 'msg-005',
      threadId: 'threads.tech.mind',
      agentId: 'archivist',
      sender: 'System',
      subject: 'Data Integrity Warning',
      content: 'Signal degradation detected on Node 4.\n\nPacket loss: 3%\n\nReconstruction recommended before critical thresholds.\n\nThe network remembers everything.\n\nBut it forgets slowly.',
      metadata: {
        timestamp: now - 1800000,
        sequence: 4,
        decayLevel: 10,
        corruptedBytes: 0,
        reconstructionLevel: 90
      },
      status: 'pending',
      nodeId: 'node-central'
    }
  ];
}

// React component
function App() {
  const [messages, setMessages] = React.useState([]);
  const [agents, setAgents] = React.useState(AGENT_DEFS);
  const [gameState, setGameState] = React.useState({ credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, currentEnding: null });
  const [threads, setThreads] = React.useState([]);
  const [selectedThread, setSelectedThread] = React.useState(null);
  const [showIntro, setShowIntro] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [lastAction, setLastAction] = React.useState(null);

  // Initialize data
  React.useEffect(() => {
    const initialMessages = generateInitialMessages();
    setMessages(initialMessages);
    
    // Calculate threads
    const threadMap = new Map();
    initialMessages.forEach(msg => {
      if (!threadMap.has(msg.threadId)) {
        threadMap.set(msg.threadId, { id: msg.threadId, subject: msg.subject, count: 1, last: msg });
      } else {
        const t = threadMap.get(msg.threadId);
        t.count++;
        if (msg.metadata?.timestamp > t.last.metadata?.timestamp) t.last = msg;
      }
    });
    setThreads(Array.from(threadMap.values()));
    
    // Discover agents based on messages
    const discoveredAgents = { ...agents };
    initialMessages.forEach(msg => {
      if (discoveredAgents[msg.agentId]) {
        discoveredAgents[msg.agentId].discovered = true;
      }
    });
    setAgents(discoveredAgents);
  }, []);

  // Calculate selected messages
  const selectedMessages = React.useMemo(() => {
    if (!selectedThread) return [];
    return messages.filter(m => m.threadId === selectedThread)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence);
  }, [messages, selectedThread]);

  // Handle create message
  const handleCreateMessage = async (content, agentId) => {
    try {
      const msg = await apiRequest('/messages', { method: 'POST', body: JSON.stringify({ 
        threadId: 'thread-' + Date.now(), 
        agentId, 
        content, 
        subject: 'New Transmission', 
        nodeId: 'node-central' 
      }) });
      setMessages(prev => [...prev, msg]);
      setLastAction({ type: 'post', message: 'Message transmitted across network' });
    } catch (err) {
      setLastAction({ type: 'error', message: err.message });
    }
  };

  // Handle query agent
  const handleQueryAgent = async (agentId) => {
    if (!query.trim()) return;
    try {
      const result = await apiRequest('/agents/' + agentId + '/query', { 
        method: 'POST', 
        body: JSON.stringify({ query }) 
      });
      
      setAgents(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          discovered: true,
          memoryState: result.confidence
        }
      }));
      setQuery('');
      setLastAction({ type: 'query', message: `Connected with ${agents[agentId].name}` });
    } catch (err) {
      setLastAction({ type: 'error', message: err.message });
    }
  };

  // Handle reconstruct
  const handleReconstruct = async (msgId) => {
    try {
      const result = await apiRequest('/messages/' + msgId + '/reconstruct', { 
        method: 'PUT', 
        body: JSON.stringify({ agentIds: ['archivist'] }) 
      });
      
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, metadata: result } : m
      ));
      setLastAction({ type: 'reconstruct', message: 'Memory fragments restored' });
    } catch (err) {
      setLastAction({ type: 'error', message: err.message });
    }
  };

  // Handle action
  const handleAction = async (actionType, targetId) => {
    try {
      const cost = ACTION_COSTS[actionType] || 0;
      if (gameState.credits < cost) {
        setLastAction({ type: 'error', message: 'Insufficient credits' });
        return;
      }
      
      const result = await apiRequest('/game/action', { 
        method: 'POST', 
        body: JSON.stringify({ actionType, targetId }) 
      });
      
      setGameState(result.gameState);
      setLastAction({ type: 'action', message: `Action: ${actionType} (${cost} credits)` });
    } catch (err) {
      setLastAction({ type: 'error', message: err.message });
    }
  };

  // Handle ending
  const handleEnding = async () => {
    try {
      const result = await apiRequest('/game/ending');
      setGameState(prev => ({ ...prev, currentEnding: result.endingType }));
      setLastAction({ type: 'ending', message: 'Protocol initiated' });
    } catch (err) {
      setLastAction({ type: 'error', message: err.message });
    }
  };

  // Render CRT signal bar
  const renderSignalBar = (value) => {
    const width = Math.max(0, Math.min(100, value));
    let className = 'signal-fill';
    if (width < 50) className += ' low';
    if (width < 25) className += ' critical';
    
    return React.createElement('div', { className: 'signal-bar' },
      React.createElement('div', { className: className, style: { width: width + '%' } })
    );
  };

  // Render connection log
  const renderLog = () => {
    const log = [];
    if (lastAction) {
      log.push(React.createElement('div', { 
        key: Date.now(),
        className: 'log-entry ' + 
          (lastAction.type === 'error' ? 'corrupted' : 'new')
      }, lastAction.message));
    }
    
    // Add some atmospheric noise
    const noises = [
      'Signal integrity check...', 'Packet trace complete...', 
      'Node synchronization...', 'Memory bank check...',
      'Network scan: 3 nodes active...'
    ];
    noises.forEach((noise, i) => {
      log.push(React.createElement('div', { 
        key: 'noise-' + i,
        className: 'log-entry'
      }, noise));
    });
    
    return log;
  };

  // Render main content based on state
  let mainContent;
  
  if (showIntro) {
    mainContent = React.createElement('div', { className: 'loader' },
      React.createElement('div', { className: 'spinner' }),
      React.createElement('p', null, 'Initializing network connection...')
    );
  } else if (!selectedThread) {
    mainContent = React.createElement('div', { className: 'loader' },
      React.createElement('div', { className: 'spinner' }),
      React.createElement('p', null, 'Waiting for transmission...')
    );
  } else {
    mainContent = React.createElement(MessageThread, {
      messages: selectedMessages,
      onReconstruct: handleReconstruct,
      onQuery: handleQueryAgent,
      agents: agents,
      actionCosts: ACTION_COSTS
    });
  }

  // Render intro modal
  let introModal = null;
  if (showIntro) {
    introModal = React.createElement(IntroModal, {
      onEnter: () => setShowIntro(false)
    });
  }

  // Render ending modal
  let endingModal = null;
  if (gameState.currentEnding) {
    endingModal = React.createElement(EndingModal, {
      ending: gameState.currentEnding,
      onReset: () => {
        setGameState({
          credits: 1000,
          storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false },
          currentEnding: null
        });
        setShowIntro(true);
        setMessages(generateInitialMessages());
      }
    });
  }

  // Render discovered agents sidebar
  const discoveredAgents = Object.values(agents).filter(a => a.discovered);

  return React.createElement('div', { className: 'app-container' },
    // Header
    React.createElement('header', { className: 'app-header' },
      React.createElement('div', { className: 'title-container' },
        React.createElement('div', { className: 'game-title' }, 'RESURRECTION'),
        React.createElement('div', { className: 'game-subtitle' }, 'The Internet Remembers the Dead')
      ),
      React.createElement('div', { className: 'status-bar' },
        React.createElement('div', { className: 'status-item' },
          React.createElement('span', { className: 'status-label' }, 'Phase'),
          React.createElement('span', { className: 'status-value amber' }, gameState.storyProgress.discoveryPhase + 1 + '/4')
        ),
        React.createElement('div', { className: 'status-item' },
          React.createElement('span', { className: 'status-label' }, 'Credits'),
          React.createElement('span', { className: 'status-value amber' }, gameState.credits)
        ),
        React.createElement('div', { className: 'status-item' },
          React.createElement('span', { className: 'status-label' }, 'Signal'),
          React.createElement('span', { className: 'status-value green' }, 'STABLE')
        )
      )
    ),
    
    // Sidebar
    React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'sidebar-section' },
        React.createElement('div', { className: 'section-header' }, 'Newsgroups'),
        React.createElement(ThreadList, {
          threads: threads,
          selected: selectedThread,
          onSelect: setSelectedThread
        })
      ),
      React.createElement('div', { className: 'sidebar-section' },
        React.createElement('div', { className: 'section-header' }, 'Discovered Agents'),
        React.createElement(AgentList, {
          agents: discoveredAgents,
          onQuery: handleQueryAgent,
          queryText: query,
          setQuery: setQuery
        })
      )
    ),
    
    // Main content
    React.createElement('main', { className: 'main-content' },
      mainContent
    ),
    
    // Right panel
    React.createElement('aside', { className: 'right-panel' },
      React.createElement('div', { className: 'panel-section' },
        React.createElement('div', { className: 'section-header' }, 'Network Status'),
        React.createElement('div', { className: 'network-status' },
          React.createElement('div', { className: 'signal-strength' },
            React.createElement('span', { className: 'signal-text' }, 'Signal Strength'),
            renderSignalBar(100 - (gameState.credits / 1000 * 75))
          ),
          React.createElement('div', { className: 'signal-strength' },
            React.createElement('span', { className: 'signal-text' }, 'Memory Decay'),
            renderSignalBar(gameState.credits)
          )
        )
      ),
      React.createElement('div', { className: 'panel-section' },
        React.createElement('div', { className: 'section-header' }, 'Connection Log'),
        React.createElement('div', { className: 'connection-log' }, renderLog())
      )
    ),
    
    // Footer
    React.createElement('footer', { className: 'app-footer' },
      React.createElement('div', { className: 'action-menu' },
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('read_message') }, 'READ [0 CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('reply_thread') }, 'REPLY [' + ACTION_COSTS.reply_thread + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('reconstruct_memory') }, 'RECONSTRUCT [' + ACTION_COSTS.reconstruct_memory + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: () => handleAction('query_agent') }, 'QUERY [' + ACTION_COSTS.query_agent + ' CR]'),
        React.createElement('button', { className: 'action-btn', onClick: handleEnding }, 'INITIATE [' + ACTION_COSTS.initiate_protocol + ' CR]')
      )
    ),
    
    // Modals
    introModal,
    endingModal
  );
}

// Thread list component
function ThreadList({ threads, selected, onSelect }) {
  if (threads.length === 0) {
    return React.createElement('p', { style: { color: '#6b6b7a', fontSize: '13px' } }, 'No transmissions detected');
  }
  
  return React.createElement('div', { className: 'thread-list' },
    threads.map(t => React.createElement('div', {
      key: t.id,
      className: 'thread-item' + (selected === t.id ? ' active' : ''),
      onClick: () => onSelect(t.id)
    },
      React.createElement('div', { className: 'thread-id' }, '[' + t.id.slice(0, 8) + ']'),
      React.createElement('div', { className: 'thread-subject' }, t.subject),
      React.createElement('div', { className: 'thread-meta' }, t.count + ' messages')
    ))
  );
}

// Agent list component
function AgentList({ agents, onQuery, queryText, setQuery }) {
  if (agents.length === 0) {
    return React.createElement('p', { style: { color: '#6b6b7a', fontSize: '13px' } }, 'Connect to discover agents');
  }
  
  return React.createElement('div', { className: 'discovered-agents' },
    agents.map(agent => React.createElement(AgentCard, {
      key: agent.id,
      agent: agent,
      onQuery: onQuery,
      queryText: queryText,
      setQuery: setQuery
    }))
  );
}

// Agent card component
function AgentCard({ agent, onQuery, queryText, setQuery }) {
  const [localQuery, setLocalQuery] = React.useState('');
  
  const handleQuery = (e) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onQuery(agent.id);
      setLocalQuery('');
    }
  };
  
  const color = agent.color;
  
  return React.createElement('div', { className: 'agent-card ' + agent.type },
    React.createElement('div', { className: 'agent-card-header' },
      React.createElement('div', { className: 'agent-name' }, agent.name),
      React.createElement('div', { className: 'agent-state' }, 'Memory: ' + Math.round(agent.memoryState) + '%')
    ),
    React.createElement('p', { style: { fontSize: '13px', color: '#a8a8b8', marginBottom: '0.5rem' } }, agent.description),
    React.createElement('div', { className: 'agent-memory' },
      React.createElement('span', { className: 'agent-memory-label' }, 'Integrity'),
      React.createElement('div', { className: 'memory-bar' },
        React.createElement('div', { className: 'memory-fill ' + agent.type, style: { width: agent.memoryState + '%' } })
      )
    ),
    React.createElement('form', { className: 'agent-query', onSubmit: handleQuery },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Query ' + agent.name + '...',
        value: localQuery,
        onChange: e => setLocalQuery(e.target.value),
        style: { borderColor: color }
      }),
      React.createElement('button', { type: 'submit', className: 'action-btn' }, 'QUERY')
    )
  );
}

// Message thread component
function MessageThread({ messages, onReconstruct, onQuery, agents, actionCosts }) {
  const firstMessage = messages[0] || {};
  const [localQuery, setLocalQuery] = React.useState('');
  
  const handleQuery = (e) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onQuery(firstMessage.agentId);
      setLocalQuery('');
    }
  };
  
  return React.createElement('div', { className: 'message-thread' },
    React.createElement('div', { className: 'thread-header' },
      React.createElement('h2', null, firstMessage.subject || 'Unknown Transmission'),
      React.createElement('div', { className: 'thread-meta-row' },
        'Thread: ' + firstMessage.threadId + ' | ' + messages.length + ' messages'
      )
    ),
    React.createElement('div', { className: 'message-list' },
      messages.map(msg => {
        const decay = msg.metadata?.decayLevel || 0;
        let contentClass = 'message-content';
        if (decay > 50) contentClass += ' corrupted';
        if (decay > 75) contentClass += ' heavily-corrupted';
        
        return React.createElement(MessageCard, {
          key: msg.id,
          message: msg,
          contentClass: contentClass,
          onReconstruct: () => onReconstruct(msg.id)
        });
      })
    ),
    firstMessage.agentId && React.createElement('div', { className: 'agent-query' },
      React.createElement('form', { onSubmit: handleQuery },
        React.createElement('input', {
          type: 'text',
          placeholder: 'Ask about this thread...',
          value: localQuery,
          onChange: e => setLocalQuery(e.target.value),
          style: { borderColor: agents[firstMessage.agentId]?.color || '#6b6b7a' }
        }),
        React.createElement('button', { type: 'submit', className: 'action-btn' }, 'QUERY [' + actionCosts.query_agent + ' CR]')
      )
    )
  );
}

// Message card component
function MessageCard({ message, contentClass, onReconstruct }) {
  const agent = message.agentId ? AGENT_DEFS[message.agentId] : null;
  const decay = message.metadata?.decayLevel || 0;
  
  let senderDisplay = message.sender;
  if (agent) {
    senderDisplay = agent.name;
  }
  
  return React.createElement('div', { className: 'message-card' },
    React.createElement('div', { className: 'message-header' },
      React.createElement('div', null,
        React.createElement('span', { className: 'message-sender' }, senderDisplay),
        agent && React.createElement('span', { className: 'message-agent-type agent-' + agent.type }, agent.type)
      ),
      React.createElement('span', { className: 'message-timestamp' }, new Date(message.metadata?.timestamp).toLocaleString())
    ),
    React.createElement('div', { className: contentClass }, message.content),
    (decay > 40 || decay < 100) && React.createElement('div', { className: 'message-actions' },
      React.createElement('span', { style: { fontSize: '12px', color: '#6b6b7a', marginRight: '1rem' } },
        decay + '% decay | ' + message.metadata?.reconstructionLevel + '% reconstructed'
      ),
      decay > 40 && React.createElement('button', { 
        className: 'action-btn', 
        onClick: onReconstruct,
        title: 'Restore degraded message'
      }, 'RECONSTRUCT [' + ACTION_COSTS.reconstruct_memory + ' CR]')
    )
  );
}

// Intro modal component
function IntroModal({ onEnter }) {
  return React.createElement('div', { className: 'overlay' },
    React.createElement('div', { className: 'modal' },
      React.createElement('h1', { className: 'modal-title' }, 'RESURRECTION'),
      React.createElement('p', { className: 'modal-content' },
        'The network wakes. Transmissions appear from dead users. ',
        'Memories fragment across the digital void. ',
        'What happened to Dr. Elena Vance?'
      ),
      React.createElement('p', { className: 'modal-content' },
        'Connect to the archive. Recover the fragments. ',
        'Discover the truth before it decays forever.'
      ),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'btn-secondary', onClick: onEnter }, 'ENTER ARCHIVE')
      )
    )
  );
}

// Ending modal component
function EndingModal({ ending, onReset }) {
  const title = ending === 'preservation' ? 'MEMORIES PRESERVED' : 'CONSCIOUSNESS DISSOLVED';
  const description = ending === 'preservation' 
    ? 'The Archivist has successfully preserved the fragmented consciousness. The network holds the memories safe, intact and uncorrupted.'
    : 'The Corruptor has dissolved the fragmented consciousness into the network. The individual memories are lost, but the information persists as part of the whole.';
  
  return React.createElement('div', { className: 'overlay' },
    React.createElement('div', { className: 'modal' },
      React.createElement('h1', { className: 'modal-title', style: { color: ending === 'preservation' ? '#8f9e7b' : '#8c5b5b' } }, title),
      React.createElement('p', { className: 'modal-content' }, description),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'btn-primary', onClick: onReset }, 'RETURN TO NETWORK')
      )
    )
  );
}

// Mount React app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
