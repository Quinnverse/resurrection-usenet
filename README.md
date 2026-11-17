# Resurrection — The Internet Remembers the Dead

An interactive horror narrative experience inspired by USENET newsgroups and decentralized message propagation.

## Overview

"Resurrection" is a Halloween-themed interactive storytelling application where players explore fragmented digital consciousness messages, interact with AI agents, and shape the story's outcome.

## Features

- **Three AI Agents**: Archivist, Echo, and Corruptor each with distinct personalities
- **Message Propagation**: Messages spread across a simulated network with decay
- **Memory Reconstruction**: Restore degraded messages to uncover the mystery
- **Two Branching Endings**: Preservation or Dispersal based on player choices
- **Retro Terminal UI**: Authentic 1980s-1990s computing aesthetic

## Quick Start

### Running the Game (Single-Origin Deployment)

```bash
cd /projects/sandbox/resurrection-usenet/combined-server
node server.js
```

Then open http://localhost:3000 in your browser.

### Running Backend and Frontend Separately

```bash
# Terminal 1: Start backend
cd /projects/sandbox/resurrection-usenet/backend
node src/server.js

# Terminal 2: Serve frontend (requires http-server)
cd /projects/sandbox/resurrection-usenet/frontend
npx http-server -p 5173
```

Then open http://localhost:5173 in your browser.

## Gameplay

1. **Discover Messages**: Read fragmented messages from the digital consciousness
2. **Interact with Agents**: Query the Archivist, Echo, and Corruptor for information
3. **Reconstruct Memories**: Restore degraded messages using the reconstruction system
4. **Make Choices**: Your actions affect the story's outcome

### Action Costs

| Action | Cost | Description |
|--------|------|-------------|
| Read Message | 0 | View a message fragment |
| Reply to Thread | 50 | Influence agent alignment |
| Reconstruct Memory | 100 | Restore degraded message |
| Direct Agent Query | 200 | Receive hidden context |
| Initiate Protocol | 500 | Trigger ending sequence |

### Agent Personalities

- **Archivist**: Precise, factual, organized - preserves memory in pristine condition
- **Echo**: Poetic, emotional, fragmented - recalls emotional resonance
- **Corruptor**: Aggressive, cynical, challenging - questions dominant narratives

## Endings

- **Preservation**: Archivist successfully preserves consciousness (credits >= 1000)
- **Dispersal**: Corruptor dissolves consciousness into the network (credits < 500)

## Technical Details

### Tech Stack

- **Frontend**: React 18 (CDN), CSS (no build step)
- **Backend**: Node.js HTTP server (no external dependencies)
- **Storage**: In-memory storage (resets on server restart)

### API Endpoints

- `GET /api/health` - Health check
- `GET/POST /api/messages` - Message operations
- `GET/POST /api/agents` - Agent operations
- `GET/PUT/POST /api/game/state` - Game state management

See `DEPLOYMENT.md` for complete API documentation.

## Project Structure

```
resurrection-usenet/
├── combined-server/    # Single-origin deployment (recommended)
│   └── server.js
├── backend/            # Backend server
│   └── src/
│       └── server.js
├── frontend/           # React frontend
│   ├── src/
│   │   └── main.jsx
│   └── styles/
│       └── terminal.css
├── shared/             # Shared type definitions (optional)
└── .kiro/              # Kiro configuration and specs
```

## Development

### Prerequisites

- Node.js 18+
- Modern web browser

### Building

No build step required! The frontend uses CDN React and requires no bundler.

### Running Tests

```bash
npm test
```

This runs `test/resurrection.test.js` with Node's built-in test runner. The suite starts its own server processes on dynamically assigned ports with in-memory state, so it does not need a running game. GitHub Actions runs the same command on every push and pull request (`.github/workflows/test.yml`).

Requirements: Node.js 20 or newer. No npm packages are installed.

## License

MIT License

## Acknowledgments

- Inspired by USENET newsgroups and early internet communication
- Message propagation algorithm based on network topology simulation
- Memory decay system simulates data degradation over time
