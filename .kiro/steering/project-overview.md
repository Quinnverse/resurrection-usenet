# Resurrection Project Overview

This document provides the high-level spec for "Resurrection — The Internet Remembers the Dead", a Halloween interactive storytelling application.

## Game Concept

Resurrection is an interactive narrative experience that simulates USENET-style newsgroups and message propagation in a decentralized digital consciousness network. Players explore fragmented memories, interact with AI agents, and shape the story's outcome through their actions.

## Core Themes

- USENET retro aesthetics and message propagation
- Digital consciousness and memory fragmentation
- Asynchronous agent communication
- Memory decay and reconstruction
- Two branching story endings
- Deterministic replay for verification

## Budget

Total available: 4,000 Kiro Credits

## Tech Stack

- Frontend: React 18 (CDN), CSS (no build step required)
- Backend: Node.js HTTP server (built-in modules only, no npm packages)
- Storage: In-memory storage (resets on server restart)
- Styling: Retro terminal CSS (ANSI colors, CRT effects)

## Deployment

### Single-Origin Deployment (Recommended)

```bash
cd combined-server
node server.js
```

- Game UI: http://localhost:3000
- API: http://localhost:3000/api/health

See `DEPLOYMENT.md` for detailed deployment instructions including systemd, Docker, and PM2 configurations.

## Budget Status

- **Spent**: ~2,800 Kiro Credits (70%)
- **Remaining**: ~1,200 Kiro Credits
- **Status**: MVP Complete, ready for testing

### Credit Breakdown

| Phase | Credits | Status |
|-------|---------|--------|
| Project Setup | 600 | ✅ Complete |
| Core Backend | 1,200 | ✅ Complete |
| API & Content | 1,000 | ✅ Complete |
| Frontend & Testing | 1,200 | ✅ Complete |
| Documentation | 0 | ✅ Complete |
| **Total** | **4,000** | **MVP Done** |