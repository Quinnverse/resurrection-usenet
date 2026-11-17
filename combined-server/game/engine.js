// Resurrection v1.0 deterministic session engine.
// Pure state transitions: (session, action, context) -> next session + result.
// No unseeded randomness, and no wall-clock values feed narrative state. Real timestamps are recorded on events only.
// Spec: docs/game-design/PUZZLE-STATE-SPEC.md

const C = require('./content');

const SCHEMA_VERSION = 1;
const ARCHIVE_TIMESTAMP = '1998-10-31 23:42'; // fictional archive epoch used for player events (spec §1)
const ACTS = { 1: 'THE SIGNAL', 2: 'THE FRACTURE', 3: 'THE GHOST', 4: 'THE LAST LETTER' };
const ACTION_TYPES = new Set([
  'OPEN_THREAD', 'INSPECT_HEADERS', 'COMMIT_DEATH_RECORD', 'TRACE_PROVENANCE', 'TRACE_RELAY',
  'INSPECT_MAINTENANCE', 'RECONSTRUCT_MAILBOX', 'COMMIT_MEMORY_CAPACITY', 'COMMIT_PROVENANCE', 'COMMIT_FINAL'
]);
const COMMIT_TYPES = new Set(['COMMIT_DEATH_RECORD', 'COMMIT_MEMORY_CAPACITY', 'COMMIT_PROVENANCE', 'COMMIT_FINAL']);

class GameError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const canon = (value) => {
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
};

const pad = (n) => String(n).padStart(4, '0');
const clamp = (n) => Math.max(0, Math.min(100, n));
const has = (s, id) => s.evidence.includes(id);

// ---------- initial state ----------

const INITIAL_DECAY = {
  'rec-incoming': 5, 'rec-lab3': 20, 'rec-lab4': 20, 'rec-summary': 0, 'rec-blanket': 30, 'rec-note': 25,
  'rec-memo': 10, 'rec-mailbox': 15, 'rec-command': 10, 'rec-edit': 40, 'rec-anomaly': 55, 'rec-stop': 35
};

function freshRecords() {
  const records = {};
  for (const [id, tpl] of Object.entries(C.RECORDS)) {
    const headers = {
      messageId: `<${id}@${tpl.origin.toLowerCase()}>`,
      timestamp: tpl.timestamp,
      path: [...tpl.path],
      checksum: tpl.checksum,
      replicaVersion: 1
    };
    if (tpl.account) headers.account = tpl.account;
    records[id] = {
      id, subject: tpl.subject, from: tpl.from, origin: tpl.origin, headers,
      body: tpl.body, status: id === 'rec-summary' ? 'pending' : 'current',
      decayLevel: INITIAL_DECAY[id] ?? 0
    };
  }
  return records;
}

function freshNodeReplicas(records) {
  const replicas = {};
  for (const nodeId of Object.keys(C.NODES)) {
    replicas[nodeId] = {};
    for (const rid of Object.keys(records)) replicas[nodeId][rid] = 1;
  }
  return replicas;
}

function newSession({ sessionId, now = null }) {
  const records = freshRecords();
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: C.SEED_VERSION,
    sessionId,
    revision: 0,
    storyAct: 1,
    evidence: ['E01'],
    threadOpened: false,
    inspectedHeaders: [],
    chosen: { deathRecord: null, memoryCapacity: null, provenance: null, ending: null },
    fragments: { echoBlanket: 'intact', archivistTiming: 'intact' },
    records,
    nodeReplicas: freshNodeReplicas(records),
    propagationEvents: [],
    playerEvents: [],
    conflictLog: [],
    agentsRevealed: [],
    agentTrust: { archivist: 0, echo: 0, corruptor: 0 },
    agentKnowledge: { archivist: [], echo: [], corruptor: [] },
    actionResults: {},
    endingSelected: null,
    createdAt: now,
    updatedAt: now
  };
}

// ---------- rules ----------

function stageOf(s) {
  if (s.endingSelected) return 'ENDED';
  if (!s.threadOpened) return 'TRANSMISSION';
  if (!has(s, 'E04')) return 'HEADER_COMPARE';
  if (!s.chosen.deathRecord) return 'RECONSTRUCTION_PREVIEW';
  if (!s.chosen.memoryCapacity) return 'MEMORY_BUDGET';
  if (!has(s, 'E10') || !s.chosen.provenance) return has(s, 'E10') ? 'OPERATOR_ANOMALY' : 'PROPAGATION_TRACE';
  return 'FINAL_REVIEW';
}

function isLastLetterUnlocked(s) {
  return C.LAST_LETTER_GATE.every(id => has(s, id));
}

function endingOptions(s) {
  const options = ['ARCHIVE', 'ECHO'];
  if (isLastLetterUnlocked(s)) options.push('LAST_LETTER');
  return options;
}

function isVisible(s, rec) {
  const rule = C.RECORDS[rec.id].visibleWhen;
  if (rule === 'always') return true;
  if (rule === 'threadOpened') return s.threadOpened;
  if (rule === 'deathRecordChosen') return Boolean(s.chosen.deathRecord);
  return has(s, rule);
}

function availableActions(s) {
  if (s.endingSelected) return [];
  const out = [];
  if (!s.threadOpened) {
    out.push({ type: 'OPEN_THREAD', payload: {}, label: 'OPEN TRANSMISSION' });
  }
  if (s.threadOpened && !has(s, 'E04')) {
    for (const recordId of ['rec-lab3', 'rec-lab4']) {
      if (!s.inspectedHeaders.includes(recordId)) {
        out.push({ type: 'INSPECT_HEADERS', payload: { recordId }, label: `INSPECT HEADER: ${C.RECORDS[recordId].subject}` });
      }
    }
  }
  if (has(s, 'E04') && !s.chosen.deathRecord) {
    for (const choice of ['LAB3', 'LAB4']) {
      out.push({ type: 'COMMIT_DEATH_RECORD', payload: { choice }, label: `PROVISIONALLY RECONSTRUCT: ${C.CHOICE_LABELS[choice]}`, previewable: true });
    }
  }
  if (has(s, 'E03') && has(s, 'E04') && !has(s, 'E09')) {
    out.push({ type: 'TRACE_PROVENANCE', payload: {}, label: 'TRACE PROVENANCE' });
  }
  if (s.storyAct >= 2 && !has(s, 'E06')) {
    out.push({ type: 'TRACE_RELAY', payload: { node: 'NODE-02' }, label: 'TRACE RELAY: Elena cache (NODE-02)' });
  }
  if (s.storyAct >= 2 && !has(s, 'E07')) {
    out.push({ type: 'INSPECT_MAINTENANCE', payload: {}, label: 'INSPECT MAINTENANCE LOG' });
  }
  if (has(s, 'E06') && !has(s, 'E08')) {
    out.push({ type: 'RECONSTRUCT_MAILBOX', payload: {}, label: 'RECONSTRUCT MAILBOX INDEX' });
  }
  if (has(s, 'E04') && has(s, 'E09') && !has(s, 'E10')) {
    out.push({ type: 'TRACE_RELAY', payload: { node: 'NODE-04' }, label: 'TRACE RELAY: Lab 4 log (NODE-04)' });
  }
  if (has(s, 'E07') && s.chosen.deathRecord && !s.chosen.memoryCapacity) {
    for (const choice of ['FORENSIC', 'HUMAN']) {
      out.push({ type: 'COMMIT_MEMORY_CAPACITY', payload: { choice }, label: `RESTORE: ${choice === 'FORENSIC' ? 'forensic chronology' : 'human memory'}`, previewable: true });
    }
  }
  if (has(s, 'E10') && s.chosen.memoryCapacity && !s.chosen.provenance) {
    for (const choice of ['EXPOSE', 'SUPPRESS']) {
      out.push({ type: 'COMMIT_PROVENANCE', payload: { choice }, label: choice === 'EXPOSE' ? 'EXPOSE the edit history' : 'HOLD the edit pending review', previewable: true });
    }
  }
  if (s.storyAct === 4 && s.chosen.provenance) {
    for (const ending of endingOptions(s)) {
      out.push({ type: 'COMMIT_FINAL', payload: { ending }, label: `CHOOSE ENDING: ${C.FINAL_TEXT[ending].title}` });
    }
  }
  return out;
}

// ---------- derived evidence and anomaly ----------

function generateAnomaly(d) {
  const first = d.playerEvents.find(e => e.type === 'COMMIT_DEATH_RECORD');
  if (!first) return;
  const body = C.ANOMALY_TEMPLATE
    .replace('{choice_label}', C.CHOICE_LABELS[first.payload.choice])
    .replace('{short_session_id}', d.sessionId.slice(0, 8))
    .replace('{event_id}', first.id);
  d.records['rec-anomaly'].body = `FROM: operator@archive.local / DATE: 1998-10-31 23:42 / SUBJECT: A choice already made / BODY: ${body}`;
}

function deriveEvidence(d) {
  const add = (id) => { if (!d.evidence.includes(id)) d.evidence.push(id); };
  if (d.threadOpened) { add('E02'); add('E03'); }
  if (d.threadOpened && d.inspectedHeaders.includes('rec-lab3') && d.inspectedHeaders.includes('rec-lab4')) add('E04');
  if (d.storyAct >= 2) {
    add('E05');
    if (!d.agentsRevealed.includes('echo')) d.agentsRevealed.push('echo');
  }
  if (d.storyAct >= 3) {
    add('E11');
    if (!d.records['rec-anomaly'].body) generateAnomaly(d);
  }
  if (has(d, 'E07') && has(d, 'E09')) add('E12');
  d.evidence.sort();
}

// ---------- propagation ----------

// Ordered breadth-first relay from the origin node. Neighbours are visited in sorted order.
function propagate(d, originNode, recordIds, eventId) {
  for (const rid of recordIds) d.nodeReplicas[originNode][rid] = d.records[rid].headers.replicaVersion;
  const visited = new Set([originNode]);
  const queue = [{ node: originNode, hop: 0 }];
  while (queue.length > 0) {
    const { node, hop } = queue.shift();
    for (const next of [...C.NODES[node].neighbors].sort()) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ node: next, hop: hop + 1 });
      for (const rid of recordIds) {
        const version = d.records[rid].headers.replicaVersion;
        d.nodeReplicas[next][rid] = version;
        d.propagationEvents.push({
          id: `prop-${pad(d.propagationEvents.length + 1)}`,
          eventId, fromNode: node, toNode: next, recordId: rid, version, hop: hop + 1
        });
      }
    }
  }
}

// ---------- handlers (mutate the draft `d`, return agent reactions) ----------

const HANDLERS = {
  OPEN_THREAD(d) {
    d.threadOpened = true;
    return [];
  },

  INSPECT_HEADERS(d, p) {
    d.inspectedHeaders.push(p.recordId);
    return [];
  },

  COMMIT_DEATH_RECORD(d, p, ctx) {
    const { choice } = p;
    d.chosen.deathRecord = choice;
    d.storyAct = 2;
    d.records['rec-summary'].body = C.SUMMARY_AFTER_C1[choice];
    d.records['rec-summary'].status = 'provisional';
    for (const [rid, status] of Object.entries(C.STATUS_AFTER_C1[choice])) {
      d.records[rid].status = status;
      d.records[rid].decayLevel = status === 'unverified' ? clamp(d.records[rid].decayLevel + 10) : clamp(d.records[rid].decayLevel - 15);
    }
    d.conflictLog.push({
      id: `conflict-${pad(d.conflictLog.length + 1)}`, eventId: ctx.eventId,
      recordIds: ['rec-lab3', 'rec-lab4'], resolution: `provisional: ${choice}; both replicas kept`
    });
    if (!d.agentsRevealed.includes('archivist')) d.agentsRevealed.push('archivist');
    d.agentKnowledge.archivist.push(ctx.eventId);
    return C.REACTIONS[`C1:${choice}`];
  },

  COMMIT_MEMORY_CAPACITY(d, p, ctx) {
    const { choice } = p;
    d.chosen.memoryCapacity = choice;
    d.storyAct = 3;
    if (choice === 'FORENSIC') {
      d.fragments.echoBlanket = 'evicted';
      d.records['rec-blanket'].body = '[Fragment evicted under capacity policy]';
      d.records['rec-blanket'].status = 'evicted';
    } else {
      d.fragments.archivistTiming = 'evicted';
      d.records['rec-lab3'].body = C.RECORDS['rec-lab3'].body.replace('at 23:41.', 'at [timing evicted].');
    }
    d.agentKnowledge.echo.push(ctx.eventId);
    return C.REACTIONS[`C2:${choice}`];
  },

  COMMIT_PROVENANCE(d, p, ctx) {
    const { choice } = p;
    d.chosen.provenance = choice;
    d.storyAct = 4;
    const expose = choice === 'EXPOSE';
    d.records['rec-edit'].status = expose ? 'published to audit' : 'held pending review';
    d.records['rec-summary'].body += expose
      ? ' Provenance: edit history published.'
      : ' Provenance: edit history held pending review.';
    d.agentTrust.corruptor += expose ? 1 : -1;
    d.agentKnowledge.corruptor.push(ctx.eventId);
    return C.REACTIONS[`C3:${choice}`];
  },

  TRACE_PROVENANCE(d, p, ctx) {
    if (!d.evidence.includes('E09')) d.evidence.push('E09');
    d.conflictLog.push({
      id: `conflict-${pad(d.conflictLog.length + 1)}`, eventId: ctx.eventId,
      recordIds: ['rec-lab3', 'rec-lab4', 'rec-command'],
      resolution: 'reconciled: halt issued from LAB4-TERM2; the earlier provisional choice remains in the audit trail'
    });
    return [];
  },

  TRACE_RELAY(d, p, ctx) {
    if (p.node === 'NODE-02') {
      if (!d.evidence.includes('E06')) d.evidence.push('E06');
      return [];
    }
    if (!d.evidence.includes('E10')) d.evidence.push('E10');
    d.conflictLog.push({
      id: `conflict-${pad(d.conflictLog.length + 1)}`, eventId: ctx.eventId,
      recordIds: ['rec-lab3'], resolution: 'edit recorded on NODE-04 after the original shutdown'
    });
    if (!d.agentsRevealed.includes('corruptor')) d.agentsRevealed.push('corruptor');
    return C.REACTIONS['E10:TRACE'];
  },

  INSPECT_MAINTENANCE(d) {
    if (!d.evidence.includes('E07')) d.evidence.push('E07');
    return [];
  },

  RECONSTRUCT_MAILBOX(d) {
    if (!d.evidence.includes('E08')) d.evidence.push('E08');
    return [];
  },

  COMMIT_FINAL(d, p) {
    const { ending } = p;
    d.endingSelected = ending;
    d.chosen.ending = ending;
    d.records['rec-summary'].body = C.FINAL_TEXT[ending].summary;
    d.records['rec-stop'].status = ending === 'LAST_LETTER' ? 'archived with the letter' : (ending === 'ARCHIVE' ? 'archived' : 'retained');
    return C.REACTIONS[`FINAL:${ending}`];
  }
};

// ---------- diffing ----------

const DIFF_FIELDS = ['body', 'status', 'decayLevel'];

function diffRecords(before, after) {
  const changes = [];
  for (const rid of Object.keys(after.records)) {
    const b = before.records[rid];
    const a = after.records[rid];
    if (!b) continue;
    for (const field of DIFF_FIELDS) {
      if (b[field] !== a[field]) changes.push({ recordId: rid, field, before: b[field], after: a[field] });
    }
    if (b.headers.replicaVersion !== a.headers.replicaVersion) {
      changes.push({ recordId: rid, field: 'replicaVersion', before: b.headers.replicaVersion, after: a.headers.replicaVersion });
    }
  }
  for (const key of ['echoBlanket', 'archivistTiming']) {
    if (before.fragments[key] !== after.fragments[key]) {
      changes.push({ recordId: `fragment:${key}`, field: 'status', before: before.fragments[key], after: after.fragments[key] });
    }
  }
  return changes;
}

// ---------- public operations ----------

function previewAction(s, action) {
  const match = findAvailable(s, action);
  if (!match || !['COMMIT_DEATH_RECORD', 'COMMIT_MEMORY_CAPACITY', 'COMMIT_PROVENANCE'].includes(action.type)) {
    throw new GameError(409, 'invalid_action', 'This action cannot be previewed at the current stage.', { stage: stageOf(s) });
  }
  const draft = structuredClone(s);
  HANDLERS[action.type](draft, action.payload, { eventId: 'preview' });
  deriveEvidence(draft);
  return { preview: true, revision: s.revision, changes: diffRecords(s, draft) };
}

function findAvailable(s, action) {
  if (!action || typeof action.type !== 'string' || !ACTION_TYPES.has(action.type)) return null;
  const payload = action.payload ?? {};
  return availableActions(s).find(a => a.type === action.type && canon(a.payload) === canon(payload)) || null;
}

function applyAction(s, action, ctx = {}) {
  if (s.actionResults[action.actionId]) {
    return { session: s, result: { ...s.actionResults[action.actionId], replayed: true }, replayed: true };
  }
  if (s.endingSelected) {
    throw new GameError(409, 'game_over', 'This game has ended. Reset to start a new game.', { stage: 'ENDED' });
  }
  if (!findAvailable(s, action)) {
    throw new GameError(409, 'invalid_action', 'This action is not available at the current stage.', { stage: stageOf(s), storyAct: s.storyAct });
  }

  const d = structuredClone(s);
  const before = structuredClone(s);
  const eventId = `evt-${pad(d.playerEvents.length + 1)}`;
  const payload = action.payload ?? {};
  const reactions = HANDLERS[action.type](d, payload, { eventId, now: ctx.now ?? null }) || [];

  const event = {
    id: eventId,
    actionId: action.actionId,
    revision: s.revision + 1,
    type: action.type,
    payload,
    storyActBefore: s.storyAct,
    storyActAfter: null,
    originNode: null,
    changedRecords: [],
    archiveTimestamp: ARCHIVE_TIMESTAMP,
    archiveSequence: d.playerEvents.length + 1,
    realTimestamp: ctx.now ?? null
  };
  d.playerEvents.push(event);
  deriveEvidence(d);

  const changes = diffRecords(before, d);
  const changedIds = [...new Set(changes.filter(c => !c.recordId.startsWith('fragment:')).map(c => c.recordId))];
  for (const rid of changedIds) d.records[rid].headers.replicaVersion += 1;
  const versionChanges = changedIds.map(rid => ({ recordId: rid, field: 'replicaVersion', before: s.records[rid].headers.replicaVersion, after: d.records[rid].headers.replicaVersion }));
  const allChanges = [...changes.filter(c => c.field !== 'replicaVersion'), ...versionChanges];

  const originNode = originFor(action.type, payload, d);
  event.storyActAfter = d.storyAct;
  event.originNode = originNode;
  event.changedRecords = changedIds;
  if (changedIds.length > 0 && originNode) {
    propagate(d, originNode, changedIds, eventId);
  }

  d.revision = s.revision + 1;
  d.updatedAt = ctx.now ?? null;
  event.revision = d.revision;

  const newlyUnlocked = d.evidence.filter(id => !s.evidence.includes(id));
  const propagation = d.propagationEvents.filter(p => p.eventId === eventId);
  const result = {
    revision: d.revision,
    eventId,
    sceneId: stageOf(d),
    changes: allChanges,
    agentReactions: reactions,
    newlyUnlocked,
    propagation,
    endingSelected: d.endingSelected,
    replayed: false
  };
  if (d.endingSelected) result.ending = endingResult(d);
  d.actionResults[action.actionId] = result;
  return { session: d, result, replayed: false };
}

function originFor(type, payload, d) {
  if (type === 'COMMIT_DEATH_RECORD') return payload.choice === 'LAB3' ? 'NODE-03' : 'NODE-04';
  if (type === 'COMMIT_MEMORY_CAPACITY' || type === 'COMMIT_FINAL') return 'NODE-05';
  if (type === 'COMMIT_PROVENANCE') return 'NODE-05';
  return null;
}

function endingResult(s) {
  const text = C.FINAL_TEXT[s.endingSelected];
  return {
    id: s.endingSelected,
    title: text.title,
    closing: text.closing,
    summary: text.summary,
    letter: text.letter || null,
    verifiedFacts: s.evidence.map(id => C.EVIDENCE[id].title),
    unresolvedCount: Object.keys(C.EVIDENCE).length - s.evidence.length
  };
}

// Projection: the only state the frontend may render. Contains no undiscovered evidence content.
function projection(s) {
  const visibleRecords = Object.values(s.records).filter(r => isVisible(s, r)).map(r => ({
    id: r.id,
    subject: r.subject,
    from: r.from,
    sourceNode: r.origin,
    headers: { ...r.headers, path: [...r.headers.path] },
    body: r.body,
    status: r.status,
    decayLevel: r.decayLevel,
    replicaVersion: r.headers.replicaVersion
  })).sort((a, b) => a.id.localeCompare(b.id));

  const actions = availableActions(s);
  return {
    sessionId: s.sessionId,
    revision: s.revision,
    seedVersion: s.seedVersion,
    storyAct: s.storyAct,
    actTitle: ACTS[s.storyAct],
    sceneId: stageOf(s),
    evidence: {
      discovered: s.evidence.map(id => ({ id, title: C.EVIDENCE[id].title, summary: C.EVIDENCE[id].summary })),
      total: Object.keys(C.EVIDENCE).length
    },
    journal: s.evidence.map(id => `${id} ${C.EVIDENCE[id].title}: ${C.EVIDENCE[id].summary}`),
    inspectedHeaders: [...s.inspectedHeaders],
    headerComparison: s.inspectedHeaders.length === 2 ? compareHeaders(s.records) : null,
    visibleRecords,
    chosen: { ...s.chosen },
    fragments: { ...s.fragments },
    nodes: Object.entries(C.NODES).map(([id, node]) => ({
      id, label: node.label, neighbors: [...node.neighbors],
      replicaVersions: Object.fromEntries(visibleRecords.map(r => [r.id, s.nodeReplicas[id][r.id]]))
    })),
    propagationTail: s.propagationEvents.slice(-12),
    conflictLog: s.conflictLog.map(c => ({ ...c, recordIds: [...c.recordIds] })),
    agents: s.agentsRevealed.map(id => ({ id, name: AGENT_NAMES[id], trust: s.agentTrust[id] })),
    endings: ['ARCHIVE', 'ECHO', 'LAST_LETTER'].map(id => ({
      id,
      title: C.FINAL_TEXT[id].title,
      unlocked: id === 'LAST_LETTER' ? isLastLetterUnlocked(s) : true,
      missingEvidenceCount: id === 'LAST_LETTER' ? C.LAST_LETTER_GATE.filter(e => !has(s, e)).length : 0,
      available: s.storyAct === 4 && s.chosen.provenance !== null && !s.endingSelected && endingOptions(s).includes(id)
    })),
    endingSelected: s.endingSelected,
    ending: s.endingSelected ? endingResult(s) : null,
    permittedActions: actions.map(a => ({ type: a.type, payload: a.payload, label: a.label, previewable: Boolean(a.previewable) })),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  };
}

const AGENT_NAMES = { archivist: 'Archivist', echo: 'Echo', corruptor: 'Corruptor' };

function compareHeaders(records) {
  const a = records['rec-lab3'].headers;
  const b = records['rec-lab4'].headers;
  const discrepancies = [];
  if (a.path.join('>') !== b.path.join('>')) {
    discrepancies.push({
      field: 'path',
      note: `Relay paths differ and share no hop: ${a.path.join(' → ')} against ${b.path.join(' → ')}.`
    });
  }
  if (a.timestamp > b.timestamp) {
    discrepancies.push({
      field: 'timestamp',
      note: `Event order conflicts: access at ${b.timestamp.slice(11)} precedes the shutdown at ${a.timestamp.slice(11)} with no shared relay.`
    });
  }
  return {
    fields: [
      { field: 'origin', lab3: records['rec-lab3'].origin, lab4: records['rec-lab4'].origin },
      { field: 'messageId', lab3: a.messageId, lab4: b.messageId },
      { field: 'timestamp', lab3: a.timestamp, lab4: b.timestamp },
      { field: 'path', lab3: a.path.join(' → '), lab4: b.path.join(' → ') },
      { field: 'checksum', lab3: a.checksum, lab4: b.checksum },
      { field: 'replicaVersion', lab3: a.replicaVersion, lab4: b.replicaVersion }
    ],
    discrepancies
  };
}

// Everything replay must reproduce. Real timestamps are excluded; they are recorded but not narrative state.
function replayFingerprint(s) {
  const strip = (e) => { const { realTimestamp, ...rest } = e; return rest; };
  const { createdAt, updatedAt, ...narrative } = projection(s);
  return {
    projection: narrative,
    playerEvents: s.playerEvents.map(strip),
    propagationEvents: s.propagationEvents,
    conflictLog: s.conflictLog,
    agentTrust: s.agentTrust,
    agentKnowledge: s.agentKnowledge,
    records: s.records,
    fragments: s.fragments
  };
}

// Rebuilds a session from its canonical seed and an ordered list of accepted actions.
function replay(sessionId, actions) {
  let s = newSession({ sessionId, now: null });
  for (const a of actions) {
    s = applyAction(s, { actionId: a.actionId, type: a.type, payload: a.payload }, { now: null }).session;
  }
  return s;
}

module.exports = {
  SCHEMA_VERSION, GameError, ACTS, AGENT_NAMES,
  newSession, projection, availableActions, applyAction, previewAction,
  replay, replayFingerprint, stageOf, ACTION_TYPES, COMMIT_TYPES
};
