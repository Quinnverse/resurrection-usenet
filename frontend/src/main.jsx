// Resurrection Frontend - 90-Second Vertical Slice
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
    discovered: true
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'Recalls emotional resonance',
    type: 'echo',
    color: '#7b6b8c',
    memoryState: 95,
    decayRate: 3,
    discovered: true
  },
  corruptor: {
    id: 'corruptor',
    name: 'Corruptor',
    description: 'Challenges dominant narratives',
    type: 'corruptor',
    color: '#8c6b6b',
    memoryState: 85,
    decayRate: 5,
    discovered: true
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
  if (!res.ok) throw new Error('API error: ' + (await res.text()));
  return await res.json();
}

// React component
function App() {
  const [messages, setMessages] = React.useState([]);
  const [agents, setAgents] = React.useState(AGENT_DEFS);
  const [gameState, setGameState] = React.useState({ credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, currentEnding: null, verticalSlice: {} });
  const [threads, setThreads] = React.useState([]);
  const [selectedThread, setSelectedThread] = React.useState(null);
  const [showIntro, setShowIntro] = React.useState(true);
  const [showChoiceModal, setShowChoiceModal] = React.useState(false);
  const [choiceResult, setChoiceResult] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [lastAction, setLastAction] = React.useState(null);
  const [showResults, setShowResults] = React.useState(false);

  // Initialize data
  React.useEffect(() => {
    apiRequest('/messages').then(data => {
      setMessages(data);
      // Calculate threads
      const threadMap = new Map();
      data.forEach(msg => {
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
      data.forEach(msg => {
        if (discoveredAgents[msg.agentId]) {
          discoveredAgents[msg.agentId].discovered = true;
        }
      });
      setAgents(discoveredAgents);
    }).catch(err => {
      setLastAction({ type: 'error', message: 'Failed to load transmission: ' + err.message });
    });
    
    apiRequest('/game/state').then(data => {
      setGameState(data);
    });
  }, []);

  // Calculate selected messages
  const selectedMessages = React.useMemo(() => {
    if (!selectedThread) return [];
    return messages.filter(m => m.threadId === selectedThread)
      .sort((a, b) => a.metadata.sequence - b.metadata.sequence);
  }, [messages, selectedThread]);

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

  // Handle choice
  const handleChoice = async (choice) => {
    try {
      const result = await apiRequest('/threads/' + selectedThread + '/choice', { 
        method: 'POST', 
        body: JSON.stringify({ choice }) 
      });
      
      setGameState(result.gameState);
      setChoiceResult(result);
      setShowChoiceModal(false);
      setShowResults(true);
      setLastAction({ type: 'choice', message: 'Choice recorded: ' + (choice === 'A' ? 'Record A (Lab 3)' : 'Record B (Lab 4)') });
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

  // Show results modal if choice was made
  if (showResults && choiceResult) {
    return React.createElement(ChoiceResultsModal, {
      choice: choiceResult.choice,
      gameState: gameState,
      agents: agents,
      onReset: () => {
        setShowResults(false);
        setShowIntro(true);
        setGameState({ credits: 1000, storyProgress: { discoveryPhase: 0, patternRecognition: false, truthUncovered: false, choiceMade: false }, currentEnding: null, verticalSlice: {} });
        setMessages([]);
        setSelectedThread(null);
        setChoiceResult(null);
        setLastAction(null);
      }
    });
  }

  // Show choice modal if thread selected and choice hasn't been made
  if (selectedThread && !gameState.verticalSlice.choiceMade && !showChoiceModal && messages.length > 0) {
    // Check if there's a choice to make (multiple conflicting records)
    const threadMessages = messages.filter(m => m.threadId === selectedThread);
    const hasConflictingRecords = threadMessages.some(m => 
      m.subject.includes('CRITICAL DATA INTEGRITY WARNING') || 
      m.subject.includes('Record Fragment')
    );
    
    if (hasConflictingRecords && threadMessages.length >= 3) {
      return React.createElement(ChoiceModal, {
        threadId: selectedThread,
        messages: threadMessages,
        onChooseA: () => handleChoice('A'),
        onChooseB: () => handleChoice('B'),
        onCancel: () => {
          setSelectedThread(null);
          setLastAction({ type: 'info', message: 'No choice made. Continue investigation.' });
        }
      });
    }
  }

  // Main content
  let mainContent;
  
  if (showIntro) {
    mainContent = React.createElement(IntroScreen, { onEnter: () => setShowIntro(false) });
  } else if (!selectedThread) {
    mainContent = React.createElement(WelcomeScreen, {
      threads: threads,
      onSelectThread: setSelectedThread,
      onQuery: handleQueryAgent,
      agents: agents,
      queryText: query,
      setQuery: setQuery
    });
  } else {
    mainContent = React.createElement(MessageThread, {
      messages: selectedMessages,
      onReconstruct: handleReconstruct,
      onQuery: handleQueryAgent,
      agents: agents,
      actionCosts: ACTION_COSTS,
      gameState: gameState
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
        setMessages([]);
        setSelectedThread(null);
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
    
    // Footer - only show for investigatory actions
    React.createElement('footer', { className: 'app-footer' },
      !showIntro && !selectedThread && React.createElement('div', { className: 'action-menu' },
        React.createElement('button', { className: 'action-btn', onClick: () => handleEnding() }, 'INITIATE [' + ACTION_COSTS.initiate_protocol + ' CR]')
      )
    ),
    
    // Modals
    introModal,
    endingModal
  );
}

// Intro screen component
function IntroScreen({ onEnter }) {
  return React.createElement('div', { className: 'loader' },
    React.createElement('div', { className: 'spinner' }),
    React.createElement('p', null, 'Initializing network connection...')
  );
}

// Welcome screen component - shows available transmissions
function WelcomeScreen({ threads, onSelectThread, onQuery, agents, queryText, setQuery }) {
  const [localQuery, setLocalQuery] = React.useState('');
  
  const handleQuery = (e) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onQuery(agents.archivist.id);
      setLocalQuery('');
    }
  };
  
  if (threads.length === 0) {
    return React.createElement('div', { className: 'loader' },
      React.createElement('div', { className: 'spinner' }),
      React.createElement('p', null, 'Waiting for transmission...')
    );
  }
  
  return React.createElement('div', { className: 'welcome-screen' },
    React.createElement('div', { className: 'welcome-content' },
      React.createElement('h1', { className: 'welcome-title' }, 'INVESTIGATION CENTER'),
      React.createElement('p', { className: 'welcome-desc' },
        'Selected: ',
        React.createElement('span', { className: 'thread-id' }, threads[0]?.id),
        React.createElement('span', { className: 'thread-subject' }, ' - ' + threads[0]?.subject)
      ),
      React.createElement('p', { className: 'welcome-desc' },
        'Find conflicting death records for Dr. Elena Vance. Choose one record to reconstruct - ',
        'your choice determines which version of history becomes authoritative.'
      ),
      React.createElement('div', { className: 'welcome-actions' },
        threads.map(t => React.createElement('button', {
          key: t.id,
          className: 'btn-primary',
          onClick: () => onSelectThread(t.id)
        }, 'OPEN THREAD: ' + t.subject))
      ),
      React.createElement('div', { className: 'agent-query' },
        React.createElement('form', { onSubmit: handleQuery },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Ask Archivist about the investigation...',
            value: localQuery,
            onChange: e => setLocalQuery(e.target.value)
          }),
          React.createElement('button', { type: 'submit', className: 'action-btn' }, 'QUERY ARCHIVIST')
        )
      )
    )
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
function MessageThread({ messages, onReconstruct, onQuery, agents, actionCosts, gameState }) {
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
      React.createElement('h2', { className: 'thread-title' }, firstMessage.subject),
      React.createElement('div', { className: 'thread-meta-row' },
        'Thread: ' + firstMessage.threadId + ' | ' + messages.length + ' messages'
      ),
      React.createElement('div', { className: 'thread-meta-row' },
        'Status: ',
        gameState.verticalSlice.choiceMade 
          ? React.createElement('span', { style: { color: '#8f9e7b' } }, 'SELECTED') 
          : React.createElement('span', { style: { color: '#c4a054' } }, 'PENDING CHOICE')
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
          onReconstruct: () => onReconstruct(msg.id),
          gameState: gameState
        });
      })
    ),
    firstMessage.agentId && !gameState.verticalSlice.choiceMade && React.createElement('div', { className: 'agent-query' },
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
function MessageCard({ message, contentClass, onReconstruct, gameState }) {
  const agent = message.agentId ? AGENT_DEFS[message.agentId] : null;
  const decay = message.metadata?.decayLevel || 0;
  
  let senderDisplay = message.sender;
  if (agent) {
    senderDisplay = agent.name;
  }
  
  // Highlight choice-related messages
  const isChoiceMessage = message.subject.includes('CRITICAL DATA INTEGRITY WARNING') || 
                          message.subject.includes('Record Fragment');
  
  return React.createElement('div', { 
    className: 'message-card' + (isChoiceMessage ? ' choice-message' : ''),
    style: isChoiceMessage ? { borderColor: agent?.color || '#6b8c7b' } : {}
  },
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
        'Select a thread to begin investigation.'
      ),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'btn-primary', onClick: onEnter }, 'ENTER ARCHIVE')
      )
    )
  );
}

// Choice modal component - presents player with two conflicting records
function ChoiceModal({ threadId, messages, onChooseA, onChooseB, onCancel }) {
  const recordA = messages.find(m => m.subject.includes('Record Fragment A'));
  const recordB = messages.find(m => m.subject.includes('Record Fragment B'));
  const warning = messages.find(m => m.subject.includes('CRITICAL DATA INTEGRITY WARNING'));
  
  return React.createElement('div', { className: 'overlay' },
    React.createElement('div', { className: 'modal choice-modal' },
      React.createElement('h2', { className: 'modal-title' }, 'INVESTIGATION RESULT'),
      React.createElement('p', { className: 'modal-content' },
        'Two contradictory copies of Dr. Elena Vance\'s death record have been recovered.',
        ' Your choice determines which version becomes authoritative for the archive.'
      ),
      warning && React.createElement('div', { className: 'warning-box' },
        React.createElement('h3', null, 'CRITICAL DATA INTEGRITY WARNING'),
        React.createElement('p', null, warning.content)
      ),
      React.createElement('div', { className: 'choice-comparison' },
        React.createElement('div', { className: 'choice-option' },
          React.createElement('h3', { style: { color: '#6b8c7b' } }, 'RECORD A'),
          React.createElement('p', null, 'Lab 3 - Protocol failure'),
          recordA && React.createElement('p', { style: { fontSize: '13px', color: '#a8a8b8' } }, recordA.content.substring(0, 200) + '...')
        ),
        React.createElement('div', { className: 'choice-option' },
          React.createElement('h3', { style: { color: '#7b6b8c' } }, 'RECORD B'),
          React.createElement('p', null, 'Lab 4 - Unauthorized access'),
          recordB && React.createElement('p', { style: { fontSize: '13px', color: '#a8a8b8' } }, recordB.content.substring(0, 200) + '...')
        )
      ),
      React.createElement('p', { className: 'modal-content' },
        'Note: After this choice, one agent will react differently based on your selection.',
        ' Choose wisely - the archive remembers everything.'
      ),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'btn-primary', onClick: onChooseA }, 'SELECT RECORD A'),
        React.createElement('button', { className: 'btn-primary', style: { backgroundColor: '#7b6b8c', color: '#0d0d10' }, onClick: onChooseB }, 'SELECT RECORD B'),
        React.createElement('button', { className: 'btn-secondary', onClick: onCancel }, 'CANCEL')
      )
    )
  );
}

// Choice results modal component - shows consequences of player's choice
function ChoiceResultsModal({ choice, gameState, agents, onReset }) {
  const reaction = choice === 'A' 
    ? agents.corruptor
    : agents.archivist;
  
  const resultText = choice === 'A' 
    ? 'You selected Record A. The official version of events. The Archivist confirms this record is standard procedure.'
    : 'You selected Record B. The unauthorized access version. The Echo acknowledges this as the true emotional resonance.';
  
  return React.createElement('div', { className: 'overlay' },
    React.createElement('div', { className: 'modal choice-modal' },
      React.createElement('h2', { className: 'modal-title', style: { color: choice === 'A' ? '#6b8c7b' : '#7b6b8c' } }, 'AUTHORITATIVE RECORD CHOSEN'),
      React.createElement('p', { className: 'modal-content' }, resultText),
      
      choice === 'B' && React.createElement('div', { className: 'new-message-alert' },
        React.createElement('h3', { style: { color: '#c4a054' } }, 'NEW MESSAGE DETECTED'),
        React.createElement('p', null, 'The Archivist has reconstructed a temporal anomaly message based on your choice.')
      ),
      
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'btn-primary', onClick: onReset }, 'RETURN TO NETWORK')
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
