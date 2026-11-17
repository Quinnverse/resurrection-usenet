# RESURRECTION — Game Design Document v1.0
**Tagline:** She died in 1998. Her last message arrived tonight.
**Category:** Kiroween 2026 — Resurrection. **Format:** browser-based, single-player narrative investigation. **Target playtime:** 12–18 minutes; first meaningful action within 15 seconds; first consequential reconstruction by minute 3. **Primary language:** English. **No paid inference API.**

## 1. Player promise and pillars
The player is a restoration operator accessing a decommissioned 1998 USENET-like network. Messages exist as asynchronous replicas across nodes. Every attempt to establish a single authoritative memory changes what the surviving digital minds remember.

Pillars: (1) Investigate, don't merely read; (2) distributed replication is a game rule, not a skin; (3) every important decision has visible and mechanical cost; (4) dread resolves into empathy, not a cheap jump scare; (5) replayable deterministic outcomes.

**Core loop:** receive transmission → inspect message headers and replicas → compare provenance and contradictions → make a justified reconstruction or defer → observe propagation, changed memories and character reactions → unlock a new thread. Each act introduces exactly one new mechanic.

## 2. Scope
Four acts, three possible endings, 10–14 evidence items, three agent personalities, five nodes, four major decisions, one optional final reconciliation puzzle. Fully authored dialogue and evidence; state-driven variations, no generative free-form story dependency. One save slot per browser session with a stable session ID and server-side persistence. Reset/new game explicit. Accessibility: readable font, reduced motion, keyboard focus, captions for any audio.

### Non-goals
No real USENET connectivity, live external messaging, real consciousness upload, multiplayer, real-time LLM chat, combat, endless procedural content, account creation, monetization or user-supplied sensitive data.

## 3. Game acts
### Act I — THE SIGNAL (3 minutes)
Opening: black screen, a packet trace and one new message dated after its sender's death. Player opens a thread and discovers two incompatible death reports: NODE-03 says protocol failure in Lab 3; NODE-04 says unauthorized access in Lab 4. Compare headers and relay paths. A first reconstruction selects a provisional authoritative account. The choice changes two dependent records and one agent's response. The game clearly labels the choice **provisional**; players are not punished for lacking unavailable evidence. End beat: the reply is from an account deactivated in 1998.

### Act II — THE FRACTURE (4 minutes)
Introduce replica map and provenance tracing. Player retrieves a delayed cache containing Elena's unsent note to her daughter Mara, and a system memo on the experiment's memory budget. New clue: each restored high-fidelity fragment evicts a low-priority fragment from another mind. The player chooses to preserve a precise forensic fragment or a human memory of the promised meteor shower. Either yields useful evidence, but different records fade and different agent affinities change. End beat: the 'corruption' appears intentional.

### Act III — THE GHOST (4 minutes)
Corruptor reveals that some altered copies were protective edits, but also that protection became censorship. Player uses a propagation log to identify which node originated a falsified version. Then a message arrives containing the exact action the player performed in Act I, with an impossible 1998 timestamp. The anomaly is assembled from a stored player event ID and action metadata; it is not a hardcoded line. The player's reconstruction choices become evidence in a system that learns to narrate the operator as part of its past. End beat: Elena's surviving pattern asks not to be restored at someone else's expense.

### Act IV — THE LAST LETTER (3–5 minutes)
Network replication is failing. Player must decide what is preserved. The Archive and The Echo are always available, with outcomes derived from prior choices. A third, The Last Letter, is available only after the player discovers the memory-budget memo, the unsent note, the provenance of the protective edit, and the operator anomaly. The third ending allows agents to jointly assemble one final message, preserve an honest record of uncertainty, and shut down the unstable copy. No ending literally resurrects Elena.

## 4. Puzzles and affordances
- **Header comparison:** inspect origin, message-id, timestamp, path, checksum, and replica version. Highlight discrepancies, not answers.
- **Replica reconstruction:** select a candidate source, preview exactly which records will change and what will be lost, then commit. Preview is reversible; commit is not within the current run.
- **Propagation trace:** follow node-to-node relays to find the earliest unaltered copy. The graph is a functional interface, not decoration.
- **Memory budget:** preserve one of two conflicting high-cost fragments; show an explicit eviction consequence, not a meaningless percentage meter.
- **Final reconciliation:** use collected evidence to establish a chain of provenance and make a value choice; no single objectively 'correct' moral answer.

## 5. Visual and UX direction
A fictional 1998 archival workstation with cinematic composition: one central message/evidence workspace, contextual node map, sparse system chrome. Avoid three permanent dashboard columns and all-agent cards. Onboarding occurs through one visible incoming transmission; no separate 'Investigation Center' instructional wall. Reveal each agent through transmissions, not a directory. Distinctive visual moments: delayed packet arriving, two conflicting documents overlaid, a line rewriting elsewhere after reconstruction, archival image of meteor shower implied through typography and sparse original graphic, operator action echoed as impossible old message. Palette: charcoal, ink-blue, parchment-white, muted amber; limited warning red. Strong hierarchy, large readable text, responsive layout. No excessive scanlines or continuous flicker.

## 6. Interaction and feedback
Primary action changes by context: OPEN TRANSMISSION → INSPECT HEADER → COMPARE REPLICAS → PREVIEW RECONSTRUCTION → COMMIT. Never show irrelevant generic action toolbar. Every action returns immediate feedback and updates the source of truth. Loading states have timeout and actionable retry; missing fields are errors, never literal 'undefined'. Choice consequences show before/after evidence, agent reaction and propagation path. A journal summarizes discovered facts without revealing undiscovered secrets.

## 7. Quality and submission gates
G1: new player performs first meaningful interaction in <=15 seconds, with no empty center. G2: first reconstruction changes authoritative state, >=2 records and an agent response; both branches tested. G3: Act III anomaly uses actual session event log. G4: three endings meet stated unlock conditions. G5: refresh and server restart recover a session. G6: all acts playable end-to-end, no dead ends; browser E2E captures evidence. G7: deployed public URL, MIT LICENSE file, root .kiro preserved, README, Kiro usage write-up, public <=3-minute YouTube demo. G8: all authored content and art original or appropriately licensed.

## 8. Demo storyboard (<3 min)
0:00–0:25 impossible transmission; 0:25–1:05 compare conflicting replicas; 1:05–1:40 commit a memory change and show other records changing; 1:40–2:15 operator anomaly based on action log; 2:15–2:45 emotional choice/last letter; 2:45–3:00 Kiro specs, hooks, tests and replay evidence. Use real captured gameplay, not a fabricated prototype video.
