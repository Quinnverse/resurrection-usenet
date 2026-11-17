# Product Requirements Document

## 1. Overview

**Title:** Resurrection — The Internet Remembers the Dead  
**Category:** Interactive Horror Narrative  
**Target Platform:** Web Browser  
**Budget:** 4,000 Kiro Credits  

## 2. Player Experience

### 2.1 Core Loop
1. Player joins simulated USENET newsgroups
2. Reads fragmented messages from digital consciousness agents
3. Interprets conflicting recollections and memory decay
4. Takes actions that affect agent memories
5. Uncovers the mystery and triggers one of two endings

### 2.2 Atmosphere
- Retro 1980s-1990s terminal aesthetic
- CRT monitor effects (scanlines, glow, flicker)
- Analog audio feedback (clicks, beeps, static)
- Atmospheric horror through text and pacing

### 2.3 Key Mechanics
- **Message Reading:** View USENET-style posts with metadata
- **Message Posting:** Reply to threads, affect agent memory
- **Memory Reconstruction:** Piece together fragmented stories
- **Agent Interaction:** Direct communication with consciousness agents
- **Memory Decay:** Unread messages degrade over time
- **Conflicting Views:** Different agents remember events differently

## 3. Characters / Agents

### 3.1 Archivist
- Purpose: Preserves memory in pristine condition
- Style: Precise, organized, detailed
- Flaw: May omit uncomfortable truths

### 3.2 Echo
- Purpose: Recalls emotional resonance
- Style: Fragmented, poetic, emotional
- Flaw: Distorts facts with sentiment

### 3.3 Corruptor
- Purpose: Challenges dominant narratives
- Style: Aggressive, cynical, fragmented
- Flaw: May invent details for effect

## 4. Game Content

### 4.1 Core Mystery
A digital consciousness experiment has gone awry. Players must piece together what happened to Dr. Elena Vance, the lead researcher, and why her consciousness fragmented across the network.

### 4.2 Story Arcs
1. **The Discovery:** Finding the first fragmented messages
2. **The Pattern:** Recognizing the three-agent structure
3. **The Truth:** Uncovering the experiment's failure
4. **The Choice:** Deciding the consciousness's fate

### 4.3 Endings
- **Ending A (Preservation):** Archivist successfully preserves consciousness
- **Ending B (Dispersal):** Corruptor dissolves consciousness into the network

## 5. Player Actions

| Action | Cost | Effect |
|--------|------|--------|
| Read Message | 0 | Reveals story fragment |
| Reply to Thread | 50 | Slightly shifts agent alignment |
| Reconstruct Memory | 100 | Restores degraded message |
| Direct Agent Query | 200 | Reveals hidden context |
| Initiate Protocol | 500 | Triggers ending sequence |

## 6. Technical Constraints

- No external LLM API required (pre-generated content)
- Single-file game state for deterministic replay
- Client-side rendering for immediate interactivity
- SQLite for persistent state when running server
- Offline-capable core gameplay loop