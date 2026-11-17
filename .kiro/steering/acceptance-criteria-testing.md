# Acceptance Criteria and Testing Strategy

## 1. Overview

This document defines the acceptance criteria and testing strategy for "Resurrection — The Internet Remembers the Dead".

## 2. MVP Acceptance Criteria

### 2.1 Core Functionality

| Requirement | Acceptance Criteria | Priority |
|-------------|---------------------|----------|
| USENET-style interface | User can view messages in newsgroup format with headers | MANDATORY |
| Agent presence | Three agents (Archivist, Echo, Corruptor) appear in interface | MANDATORY |
| Message propagation | Messages appear to propagate across network with visual indication | MANDATORY |
| Memory decay | Messages show visible degradation over time | MANDATORY |
| Player actions | Player can perform actions (read, reply, reconstruct, query) | MANDATORY |
| Two endings | Game provides two distinct endings based on player choices | MANDATORY |
| Retro terminal UI | CRT effects, scanlines, ANSI colors are visible | MANDATORY |
| Game persistence | Game state persists across browser reloads | MANDATORY |
| Deterministic replay | Replay produces same results from same initial state | MANDATORY |
| No paid LLM | All content is pre-generated, no API keys required | MANDATORY |

### 2.2 User Experience

| Requirement | Acceptance Criteria | Priority |
|-------------|---------------------|----------|
| First-time experience | Player can complete intro sequence and understand game controls | MANDATORY |
| Progression | Player can advance through story phases (Discovery → Pattern → Truth → Choice) | MANDATORY |
| Agent interaction | Player can query each agent and receive distinct responses | MANDATORY |
| Memory reconstruction | Player can restore degraded messages with visible improvement | MANDATORY |
| Ending triggers | Player can reach both endings through different action sequences | MANDATORY |
| Performance | Game maintains 30fps during normal interaction | MANDATORY |

### 2.3 Technical Requirements

| Requirement | Acceptance Criteria | Priority |
|-------------|---------------------|----------|
| Browser compatibility | Works in Chrome, Firefox, Safari, Edge (latest 2 versions) | MANDATORY |
| Responsive design | Layout adapts to screens from 320px to 1920px width | MANDATORY |
| Error handling | Graceful error messages for network failures, database errors | MANDATORY |
| Build process | `npm run build` produces production-ready output | MANDATORY |
| Server startup | `npm start` runs backend on port 3000 without errors | MANDATORY |

---

## 3. Testing Strategy

### 3.1 Unit Testing

#### Backend Unit Tests

```typescript
// backend/__tests__/agents/propagation.test.ts
describe('Message Propagation', () => {
  describe('calculateDecay', () => {
    it('returns decay based on network distance', () => {
      const decay = calculateDecay('node-a', 'node-b', 1);
      expect(decay).toBeGreaterThanOrEqual(5);
    });
    
    it('increases decay with depth', () => {
      const decayShallow = calculateDecay('node-a', 'node-b', 1);
      const decayDeep = calculateDecay('node-a', 'node-c', 3);
      expect(decayDeep).toBeGreaterThan(decayShallow);
    });
  });
  
  describe('calculateCorruption', () => {
    it('returns higher corruption for noisy nodes', () => {
      const noisyNode = { id: 'noisy', isNoisy: true };
      const cleanNode = { id: 'clean', isNoisy: false };
      
      const noisyCorruption = calculateCorruption(noisyNode);
      const cleanCorruption = calculateCorruption(cleanNode);
      
      expect(noisyCorruption).toBeGreaterThanOrEqual(cleanCorruption);
    });
  });
});

// backend/__tests__/database/messages.test.ts
describe('Message Database', () => {
  describe('createMessage', () => {
    it('creates message with valid ID', async () => {
      const message = await createMessage({
        threadId: 'thread-1',
        agentId: 'archivist',
        content: 'Test message'
      });
      
      expect(message.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(message.status).toBe('pending');
    });
  });
  
  describe('getThreadMessages', () => {
    it('returns messages in correct order', async () => {
      await createMessage({ threadId: 'thread-1', sequence: 1 });
      await createMessage({ threadId: 'thread-1', sequence: 2 });
      await createMessage({ threadId: 'thread-1', sequence: 3 });
      
      const messages = await getThreadMessages('thread-1');
      expect(messages.length).toBe(3);
      expect(messages[0].sequence).toBe(1);
      expect(messages[2].sequence).toBe(3);
    });
  });
});

// backend/__tests__/utils/memoryDecay.test.ts
describe('Memory Decay', () => {
  describe('calculateDecayLevel', () => {
    it('increases decay for older messages', () => {
      const oldMessage = {
        metadata: {
          timestamp: Date.now() - 3600000, // 1 hour ago
          decayLevel: 0,
          reconstructionLevel: 0,
          corruptedBytes: 0
        }
      } as Message;
      
      const decay = calculateDecayLevel(oldMessage, Date.now());
      expect(decay).toBeGreaterThan(0);
    });
    
    it('decreases decay for reconstructed messages', () => {
      const reconstructedMessage = {
        metadata: {
          timestamp: Date.now(),
          decayLevel: 60,
          reconstructionLevel: 60,
          corruptedBytes: 0
        }
      } as Message;
      
      const decay = calculateDecayLevel(reconstructedMessage, Date.now());
      expect(decay).toBeLessThan(30);
    });
  });
});

// backend/__tests__/agents/personalities.test.ts
describe('Agent Personalities', () => {
  describe('archivistResponse', () => {
    it('returns precise, structured response', () => {
      const response = generateArchivistResponse('What happened?', {
        primaryMemories: [{ content: { rawText: 'Event A' }, confidence: 90 }]
      });
      
      expect(response).toContain('Event A');
      expect(response).not.toMatch(/^[!?.,]/); // Not fragmented
    });
  });
  
  describe('echoResponse', () => {
    it('returns poetic, fragmented response', () => {
      const response = generateEchoResponse('What happened?', {
        secondaryMemories: [{ content: { rawText: 'Emotion B' }, confidence: 80 }]
      });
      
      expect(response).toMatch(/^[!?.,]/i); // May be fragmented
      expect(response).toMatch(/poetic|metaphor|feeling/i);
    });
  });
});
```

#### Frontend Unit Tests

```typescript
// frontend/__tests__/components/MessageItem.test.tsx
describe('MessageItem Component', () => {
  it('renders message with correct content', () => {
    const message = {
      id: 'msg-1',
      threadId: 'thread-1',
      agentId: 'archivist',
      content: 'Test message',
      metadata: {
        timestamp: Date.now(),
        sequence: 1,
        decayLevel: 10,
        reconstructionLevel: 100
      },
      status: 'delivered',
      nodeId: 'node-a'
    };
    
    render(<MessageItem message={message} />);
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('Archivist')).toBeInTheDocument();
  });
  
  it('applies visual decay based on decay level', () => {
    const message = {
      id: 'msg-1',
      threadId: 'thread-1',
      agentId: 'archivist',
      content: 'Test message',
      metadata: {
        timestamp: Date.now(),
        sequence: 1,
        decayLevel: 75,
        reconstructionLevel: 0
      },
      status: 'delivered',
      nodeId: 'node-a'
    };
    
    render(<MessageItem message={message} />);
    
    const messageElement = screen.getByTestId('message-content');
    expect(messageElement).toHaveStyle('opacity: 0.6');
    expect(messageElement).toHaveStyle('color: #aaa');
  });
  
  it('shows reconstruction button for degraded messages', () => {
    const message = {
      id: 'msg-1',
      threadId: 'thread-1',
      agentId: 'archivist',
      content: 'Test message',
      metadata: {
        timestamp: Date.now(),
        sequence: 1,
        decayLevel: 85,
        reconstructionLevel: 0
      },
      status: 'delivered',
      nodeId: 'node-a'
    };
    
    render(<MessageItem message={message} />);
    
    expect(screen.getByText('Reconstruct Memory')).toBeInTheDocument();
  });
});

// frontend/__tests__/contexts/GameContext.test.tsx
describe('GameContext', () => {
  it('provides initial game state', () => {
    render(
      <GameContextProvider>
        <div>Test</div>
      </GameContextProvider>
    );
    
    expect(GameContext).toBeDefined();
  });
  
  it('updates game state on action', async () => {
    const { result } = renderHook(() => useGame());
    
    await result.current.takeAction('read_message', 'msg-1', 0);
    
    expect(result.current.gameState.playerActions).toHaveLength(1);
  });
});

// frontend/__tests__/hooks/useMessages.test.ts
describe('useMessages', () => {
  it('loads messages from API', async () => {
    mockFetchMessages([
      { id: 'msg-1', content: 'Test', metadata: { decayLevel: 0 } } as Message
    ]);
    
    renderHook(() => useMessages());
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/messages');
    });
  });
});
```

### 3.2 Integration Testing

#### Backend Integration Tests

```typescript
// backend/__tests__/integration/api.test.ts
describe('API Endpoints', () => {
  describe('GET /api/messages', () => {
    it('returns messages from database', async () => {
      await createMessage({
        threadId: 'thread-1',
        agentId: 'archivist',
        content: 'Test message'
      });
      
      const response = await request(app).get('/api/messages');
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].content).toBe('Test message');
    });
  });
  
  describe('POST /api/messages', () => {
    it('creates new message', async () => {
      const response = await request(app).post('/api/messages').send({
        threadId: 'thread-1',
        agentId: 'echo',
        content: 'New message',
        nodeId: 'node-a'
      });
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe('New message');
    });
  });
  
  describe('POST /api/messages/:id/reconstruct', () => {
    it('reconstructs degraded message', async () => {
      const message = await createMessage({
        threadId: 'thread-1',
        agentId: 'corruptor',
        content: 'Degraded message',
        metadata: {
          decayLevel: 80,
          reconstructionLevel: 0
        }
      });
      
      const response = await request(app)
        .put(`/api/messages/${message.id}/reconstruct`)
        .send({ agentIds: ['archivist', 'echo'] });
      
      expect(response.status).toBe(200);
      expect(response.body.newDecayLevel).toBeLessThan(80);
      expect(response.body.reconstructedContent).toBeDefined();
    });
  });
});

// backend/__tests__/integration/propagation.test.ts
describe('Message Propagation', () => {
  it('propagates message across nodes', async () => {
    const message = await createMessage({
      threadId: 'thread-1',
      agentId: 'archivist',
      content: 'Original message',
      nodeId: 'node-a'
    });
    
    await propagateMessage(message, getNode('node-a'));
    
    const propagated = await getMessageByContent('Original message');
    expect(propagated).toHaveLength(2); // Original + propagated
  });
  
  it('applies decay during propagation', async () => {
    const message = await createMessage({
      threadId: 'thread-1',
      agentId: 'echo',
      content: 'Test',
      nodeId: 'node-a',
      metadata: { decayLevel: 0 }
    });
    
    await propagateMessage(message, getNode('node-a'));
    
    const propagated = await getMessagesByContent('Test');
    const propagatedMessage = propagated.find(m => m.nodeId !== 'node-a');
    
    expect(propagatedMessage.metadata.decayLevel).toBeGreaterThan(0);
  });
});
```

#### Frontend Integration Tests

```typescript
// frontend/__tests__/integration/end-to-end.test.ts
describe('End-to-End Game Flow', () => {
  it('completes discovery phase', async () => {
    render(<App />);
    
    // Player reads initial messages
    await screen.findByText('Archivist');
    await screen.findByText('Echo');
    await screen.findByText('Corruptor');
    
    // Player views first thread
    const firstThread = screen.getByText(/UseNet.*announcement/i);
    userEvent.click(firstThread);
    
    // Player reads messages
    await screen.findByText(/ consciousness/i);
    await screen.findByText(/experiment/i);
    
    // Player can see story progress
    expect(screen.getByText(/Phase 1/i)).toBeInTheDocument();
  });
  
  it('reaches preservation ending', async () => {
    render(<App />);
    
    // Read all messages
    await screen.findAllByText(/memory/i);
    
    // Query archivist multiple times
    const queryButton = screen.getByText(/Query Archivist/i);
    userEvent.click(queryButton);
    
    // Reconstruct degraded messages
    const reconstructButtons = await screen.findAllByText(/Reconstruct Memory/i);
    for (const button of reconstructButtons) {
      userEvent.click(button);
    }
    
    // Trigger ending
    const protocolButton = screen.getByText(/Initiate Protocol/i);
    userEvent.click(protocolButton);
    
    // Verify ending
    await screen.findByText(/Preservation/i);
    expect(screen.getByText(/memory preserved/i)).toBeInTheDocument();
  });
  
  it('reaches dispersal ending', async () => {
    render(<App />);
    
    // Query corruptor multiple times
    const queryButton = screen.getByText(/Query Corruptor/i);
    userEvent.click(queryButton);
    
    // Ignore reconstruction opportunities
    await screen.findByText(/confusion/i);
    
    // Trigger ending
    const protocolButton = screen.getByText(/Initiate Protocol/i);
    userEvent.click(protocolButton);
    
    // Verify ending
    await screen.findByText(/Dispersal/i);
    expect(screen.getByText(/network/i)).toBeInTheDocument();
  });
});
```

### 3.3 Performance Testing

```typescript
// backend/__tests__/performance/memory.test.ts
describe('Memory Performance', () => {
  it('handles 1000 messages without slowdown', async () => {
    // Create 1000 messages
    for (let i = 0; i < 1000; i++) {
      await createMessage({
        threadId: 'thread-1',
        agentId: 'archivist',
        content: `Message ${i}`,
        nodeId: 'node-a'
      });
    }
    
    const start = performance.now();
    await getThreadMessages('thread-1');
    const end = performance.now();
    
    expect(end - start).toBeLessThan(500); // Should complete in < 500ms
  });
  
  it('handles concurrent decay calculations', async () => {
    const messages = [];
    for (let i = 0; i < 100; i++) {
      messages.push(await createMessage({
        threadId: 'thread-1',
        agentId: 'echo',
        content: `Message ${i}`,
        nodeId: 'node-a'
      }));
    }
    
    const start = performance.now();
    for (const message of messages) {
      calculateDecayLevel(message, Date.now());
    }
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100); // Should complete in < 100ms
  });
});

// frontend/__tests__/performance/render.test.ts
describe('Render Performance', () => {
  it('maintains 30fps with 100 messages', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`,
      metadata: { decayLevel: 0 }
    }));
    
    const start = performance.now();
    render(<MessageList messages={messages} />);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(33); // < 33ms = >30fps
  });
});
```

### 3.4 Acceptance Test Checklist

```markdown
# Acceptance Test Checklist

## Phase 1: Setup ✓
- [ ] Project structure created
- [ ] Dependencies installed
- [ ] Database schema created
- [ ] Retro CSS applied

## Phase 2: Core Backend ✓
- [ ] Message CRUD operations work
- [ ] Agent CRUD operations work
- [ ] Game state persists
- [ ] Propagation engine runs
- [ ] Decay calculations correct
- [ ] Agent personalities distinct

## Phase 3: API & Content ✓
- [ ] All API endpoints respond correctly
- [ ] Story content generated
- [ ] Database seeded
- [ ] Replay system functional

## Phase 4: Frontend ✓
- [ ] Terminal UI renders
- [ ] Message console works
- [ ] Agent panel functional
- [ ] Game logic hooks work
- [ ] Story content displayed
- [ ] Endings accessible

## Functional Testing ✓
- [ ] Player can read messages
- [ ] Player can reply to threads
- [ ] Player can reconstruct memories
- [ ] Player can query agents
- [ ] Memory decay visible
- [ ] Agent states update
- [ ] Story progresses

## Quality Assurance ✓
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance tests pass
- [ ] Error handling works
- [ ] Documentation complete
```

---

## 4. Exit Criteria

### 4.1 Definition of Done

A feature is "Done" when:
- [ ] Code implemented and committed
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated
- [ ] Code review completed (by another developer)
- [ ] Acceptance criteria met

### 4.2 Release Criteria

Release-ready when:
- [ ] All MANDATORY acceptance criteria met
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance targets met
- [ ] No critical security issues
- [ ] Documentation complete
- [ ] Backwards compatibility maintained

### 4.3 Known Limitations (Post-MVP)

- Multiplayer support not implemented
- Persistent server deployment not configured
- Advanced message filtering not implemented
- Audio feedback not implemented
- Mobile-specific optimizations not implemented