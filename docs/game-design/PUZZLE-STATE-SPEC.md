# RESURRECTION — Puzzle, State and API Specification v1.0

## 1. Single authoritative state
Use a persistent backend session keyed by random opaque sessionId, stored in isolated server-side JSON or SQLite with atomic writes. No account required. Session includes schemaVersion, storyAct, sceneId, evidenceDiscovered[], inspectedHeaders[], chosenVersions{}, memoryFragments{}, nodeReplicas{}, agentKnowledge{}, agentTrust{}, playerEvents[], propagationEvents[], endingsUnlocked[], endingSelected, revision, createdAt, updatedAt. Frontend is a projection; never invent independent narrative facts.

No cross-session state leakage. Fresh sessions start from identical canonical seed. Use deterministic seeded random only where needed. Separate real event time from fictional archive timestamp. Record both explicitly. Do not derive randomness from Math.random for replay-relevant decisions.

## 2. Evidence graph
| ID | Evidence | Unlock | Mechanical role |
|---|---|---|---|
| E01 | Impossible incoming message | Start | First action |
| E02 | Lab 3 shutdown record | Open thread | Candidate A |
| E03 | Lab 4 security record | Open thread | Candidate B |
| E04 | Header relay discrepancy | Inspect E02 + E03 | Allows provisional reconstruction |
| E05 | Echo's blanket memory | Act II | Human context |
| E06 | Elena unsent note | Trace NODE-02 cache | Emotional context |
| E07 | Capacity/eviction memo | Inspect maintenance log | Memory budget mechanic |
| E08 | Mara's later reply | Reconstruct mailbox index | Establishes continued life |
| E09 | Original shutdown command | Trace provenance | Resolves false murder theory |
| E10 | Corruptor edit path | Trace NODE-04 relay | Establishes protective censorship |
| E11 | Operator event anomaly | Perform recorded reconstruction | Meta reveal |
| E12 | Elena-pattern stop request | E07 + E09 | Final ethical conflict |

Dependencies: E01→{E02,E03}→E04→first choice→{E05,E06,E07}; E07→memory budget choice; {E03,E04}→E09; {E04,E09}→E10; first choice event→E11; {E07,E09}→E12; {E06,E07,E08,E10,E11}→Last Letter unlock. E08 optional to complete main story, required for third ending. Every branch must offer all mandatory evidence later.

## 3. Choices and consequences
**C1 Death record:** A (Lab 3 shutdown) or B (Lab 4 access). A and B are provisional competing narratives. Both update `chosenVersions.deathRecord`, two or more dependent visible records, a replica conflict log and agent reactions. Later E09 reconciles the two records without erasing the player's earlier choice; the system retains an audit trail.

**C2 Memory capacity:** preserve FORENSIC (high-confidence incident chronology; lose part of Echo's blanket memory) or HUMAN (preserve sensory memory; lose fine-grained timing detail in an Archivist replica). Each has exact before/after diff and a distinct agent reaction. Neither removes the ability to finish the game.

**C3 Provenance:** expose Corruptor's edit history or keep the edit suppressed pending review. Both allow Act IV, but affect dialogue, trust and end-card audit quality.

**C4 Final:** ARCHIVE, ECHO, or LAST_LETTER if gated. The ending is based on committed state, not merely a frontend button. No infinite credits grind.

## 4. State machine
`BOOT → TRANSMISSION → HEADER_COMPARE → RECONSTRUCTION_PREVIEW → RECONSTRUCTION_COMMITTED → MEMORY_BUDGET → PROPAGATION_TRACE → OPERATOR_ANOMALY → FINAL_REVIEW → ENDING`. Invalid actions return typed 409 with current stage. Every screen has an explicit primary affordance and a journal route back to discovered evidence. Client refresh rehydrates from GET session state.

## 5. Propagation and replay
For each committed mutation, append an immutable event with eventId, sessionId, action, input, beforeRevision, afterRevision, affectedRecordIds, originNode, relayPath, archiveTimestamp, realTimestamp and deterministic seed position. Propagate by a documented ordered queue through a fixed topology, producing versioned replicas. Different nodes may temporarily disagree; conflict resolution is explicit and traceable. Replay from canonical seed + event log must reproduce message content, memory levels, agent reactions, unlocked clues and ending. Never use client-side random to decide narrative state.

## 6. Proposed API contract (adapt to existing routes, do not blindly replace)
- `POST /api/sessions` → `{sessionId, revision, sceneId}`
- `GET /api/sessions/:id` → state projection with actionable scene, visible evidence and permitted actions
- `GET /api/sessions/:id/threads` → `[ {id, subject, unreadCount, lastMessageAt} ]`
- `GET /api/sessions/:id/threads/:threadId` → messages with `id, subject, content, sourceNode, headers, replicaVersion, decayLevel`
- `POST /api/sessions/:id/actions` with `{actionId, expectedRevision, type, payload}` → `{revision, eventId, sceneId, changes[], agentReactions[], newlyUnlocked[]}`
- `GET /api/sessions/:id/events` → authoritative audit log
- `POST /api/sessions/:id/reset` → new fresh state (explicit confirmation in UI)

Require input validation, idempotent action IDs, optimistic revision checks, typed JSON errors, no unbounded request bodies, and no public test reset endpoint affecting other sessions. Do not expose internal server paths. Any existing API may be kept if it meets the same semantics; write a contract adapter instead of duplicating the server.

## 7. Acceptance matrix
T01 first thread loads with subject (never `undefined`); T02 E02/E03 headers disagree in meaningful inspectable fields; T03 C1 A/B both change >=2 record *values*; T04 E07 triggers real eviction and before/after display; T05 propagation event explains every dependent change; T06 E11 interpolates an actual C1 event ID and choice; T07 replay same event sequence equals same narrative projection; T08 fresh session isolated; T09 browser refresh persists; T10 server restart persists; T11 all three endings reachable under correct conditions; T12 all mandatory clues reachable on both C1 branches; T13 UI never stuck loading or exposing undiscovered agents; T14 accessible keyboard and reduced-motion paths; T15 no external API required to play; T16 Playwright browser run with screenshots and no uncaught errors; T17 public deployment and licensing checks.

## 8. Implementation order and hard boundaries
(1) State schema + persistent session + migration from existing in-memory state; (2) evidence graph + authored script; (3) real reconstruction and propagation; (4) state-driven frontend; (5) branch and replay tests; (6) browser E2E + deploy. Keep one canonical Node server, root `.kiro`, no new parallel server, no empty placeholder tests. Do not claim a browser PASS if browser automation was not run. Do not rewrite the entire application just to satisfy a naming convention.
