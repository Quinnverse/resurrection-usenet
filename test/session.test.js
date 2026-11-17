// Resurrection v1.0 session suite: deterministic engine checks, HTTP contract, persistence and replay.
// Each HTTP server is a child process on PORT=0 with its own temporary data directory.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const SERVER_ENTRY = path.join(ROOT, 'combined-server', 'server.js');
const GAME_DIR = path.join(ROOT, 'combined-server', 'game');
const engine = require('../combined-server/game/engine');

// ---------- child server management ----------

const live = new Set();
process.on('exit', () => { for (const c of live) c.kill('SIGKILL'); });

function startServer(dataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: ROOT,
      env: { ...process.env, PORT: '0', RESURRECTION_DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    live.add(child);
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server start timeout: ' + err)); }, 10000);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/running on port (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ baseUrl: `http://127.0.0.1:${m[1]}`, dataDir, logs: () => out + err, stop: () => stopServer(child) });
      }
    });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('exit', (code) => {
      live.delete(child);
      clearTimeout(timer);
      reject(new Error(`server exited (${code}): ${err}`));
    });
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) { live.delete(child); return resolve(); }
    const kill = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => { clearTimeout(kill); live.delete(child); resolve(); });
    child.kill('SIGTERM');
  });
}

function tempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'resurrection-data-'));
}

async function withServer(fn) {
  const dataDir = tempDataDir();
  const server = await startServer(dataDir);
  try {
    return await fn(server);
  } finally {
    await server.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function call(baseUrl, method, route, body, rawBody) {
  const headers = {};
  let payload;
  if (rawBody !== undefined) { headers['content-type'] = 'application/json'; payload = rawBody; }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(baseUrl + route, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

// Accepts a session action over HTTP using the current revision. Throws if the server refuses.
async function act(baseUrl, sessionId, type, payload = {}) {
  const current = await call(baseUrl, 'GET', `/api/sessions/${sessionId}`);
  const res = await call(baseUrl, 'POST', `/api/sessions/${sessionId}/actions`, {
    actionId: randomUUID(), expectedRevision: current.json.revision, type, payload
  });
  assert.equal(res.status, 200, `action ${type} failed: ${res.text}`);
  return res.json;
}

// ---------- in-process helpers (engine only) ----------

let seq = 0;
function step(s, type, payload = {}) {
  seq += 1;
  return engine.applyAction(s, { actionId: `local-${seq}`, type, payload }, { now: null });
}
function fresh(id = 'a'.repeat(32)) {
  return engine.newSession({ sessionId: id, now: null });
}

// The canonical investigation. Options choose the three branch decisions and the ending.
const COMMON_PREFIX = [
  ['OPEN_THREAD'],
  ['INSPECT_HEADERS', { recordId: 'rec-lab3' }],
  ['INSPECT_HEADERS', { recordId: 'rec-lab4' }]
];
function playPath({ c1 = 'LAB3', c2 = 'FORENSIC', c3 = 'EXPOSE', ending = 'ARCHIVE', closing = 'PLAIN', mailbox = true, stopBeforeFinal = false } = {}) {
  let s = fresh();
  const outcomes = {};
  const run = (type, payload) => { const out = step(s, type, payload); s = out.session; return out.result; };
  for (const [type, payload] of COMMON_PREFIX) run(type, payload);
  outcomes.c1 = run('COMMIT_DEATH_RECORD', { choice: c1 });
  run('TRACE_RELAY', { node: 'NODE-02' });
  run('INSPECT_MAINTENANCE', {});
  if (mailbox) run('RECONSTRUCT_MAILBOX', {});
  run('TRACE_PROVENANCE', {});
  run('TRACE_RELAY', { node: 'NODE-04' });
  outcomes.c2 = run('COMMIT_MEMORY_CAPACITY', { choice: c2 });
  outcomes.c3 = run('COMMIT_PROVENANCE', { choice: c3 });
  if (!stopBeforeFinal) outcomes.final = run('COMMIT_FINAL', ending === 'LAST_LETTER' ? { ending, closing } : { ending });
  return { session: s, outcomes };
}

// ---------- deterministic engine ----------

describe('engine: determinism and rules', () => {
  it('game logic never calls Math.random', () => {
    for (const file of fs.readdirSync(GAME_DIR)) {
      const source = fs.readFileSync(path.join(GAME_DIR, file), 'utf8');
      assert.doesNotMatch(source, /Math\.random/, `${file} must not use Math.random`);
    }
  });

  it('fresh sessions start from an identical canonical seed', () => {
    const a = engine.projection(fresh('1'.repeat(32)));
    const b = engine.projection(fresh('2'.repeat(32)));
    const strip = (v) => ({ ...v, sessionId: null });
    assert.deepEqual(strip(a), strip(b));
  });

  it('a new player cannot act on the commit decision before header comparison (E04 gate)', () => {
    const s = fresh();
    const allowed = engine.availableActions(s).map(a => a.type);
    assert.ok(!allowed.includes('COMMIT_DEATH_RECORD'));
    assert.throws(() => step(s, 'COMMIT_DEATH_RECORD', { choice: 'LAB3' }), (err) => err.status === 409 && err.code === 'invalid_action');
  });

  it('agents stay hidden until the narrative introduces them', () => {
    let s = fresh();
    assert.deepEqual(engine.projection(s).agents, []);
    s = step(s, 'OPEN_THREAD').session;
    s = step(s, 'INSPECT_HEADERS', { recordId: 'rec-lab3' }).session;
    s = step(s, 'INSPECT_HEADERS', { recordId: 'rec-lab4' }).session;
    assert.deepEqual(engine.projection(s).agents, []);
    s = step(s, 'COMMIT_DEATH_RECORD', { choice: 'LAB4' }).session;
    // Archivist speaks at the first choice; Echo's blanket memory (Act II) follows immediately. Corruptor stays hidden.
    assert.deepEqual(engine.projection(s).agents.map(a => a.id), ['archivist', 'echo']);
    assert.ok(!engine.projection(s).agents.some(a => a.id === 'corruptor'));
  });

  it('header comparison flags real discrepancies between the Lab 3 and Lab 4 reports', () => {
    const s = fresh();
    let t = step(s, 'OPEN_THREAD').session;
    t = step(t, 'INSPECT_HEADERS', { recordId: 'rec-lab3' }).session;
    t = step(t, 'INSPECT_HEADERS', { recordId: 'rec-lab4' }).session;
    const discrepancies = engine.projection(t).headerComparison.discrepancies.map(d => d.field).sort();
    assert.deepEqual(discrepancies, ['path', 'timestamp']);
  });

  it('preview reports changes without changing state', () => {
    let s = fresh();
    s = step(s, 'OPEN_THREAD').session;
    s = step(s, 'INSPECT_HEADERS', { recordId: 'rec-lab3' }).session;
    s = step(s, 'INSPECT_HEADERS', { recordId: 'rec-lab4' }).session;
    const before = JSON.stringify(engine.replayFingerprint(s));
    const preview = engine.previewAction(s, { actionId: 'p', type: 'COMMIT_DEATH_RECORD', payload: { choice: 'LAB4' } });
    assert.ok(preview.changes.length >= 2);
    assert.equal(JSON.stringify(engine.replayFingerprint(s)), before);
  });
});

describe('engine: first choice (C1) branches', () => {
  it('A and B each change at least two record values and change them differently', () => {
    const a = playPath({ c1: 'LAB3' }).outcomes.c1;
    const b = playPath({ c1: 'LAB4' }).outcomes.c1;
    const valuesA = new Set(a.changes.map(c => c.recordId));
    const valuesB = new Set(b.changes.map(c => c.recordId));
    assert.ok(valuesA.size >= 2 && valuesB.size >= 2, 'both branches change two or more records');
    const statusA = a.changes.filter(c => c.field === 'status').map(c => `${c.recordId}=${c.after}`).sort();
    const statusB = b.changes.filter(c => c.field === 'status').map(c => `${c.recordId}=${c.after}`).sort();
    assert.notDeepEqual(statusA, statusB);
    assert.ok(statusA.includes('rec-lab3=provisional-authoritative'));
    assert.ok(statusB.includes('rec-lab4=provisional-authoritative'));
  });

  it('agent reactions differ between A and B', () => {
    const a = playPath({ c1: 'LAB3' }).outcomes.c1.agentReactions;
    const b = playPath({ c1: 'LAB4' }).outcomes.c1.agentReactions;
    const archivistA = a.find(r => r.agentId === 'archivist').text;
    const archivistB = b.find(r => r.agentId === 'archivist').text;
    assert.notEqual(archivistA, archivistB);
    assert.notEqual(a.find(r => r.agentId === 'echo').text, b.find(r => r.agentId === 'echo').text);
  });

  it('the provisional summary record is rewritten to cite the chosen account at the first choice', () => {
    const a = playPath({ c1: 'LAB3' }).outcomes.c1.changes.find(c => c.recordId === 'rec-summary' && c.field === 'body');
    const b = playPath({ c1: 'LAB4' }).outcomes.c1.changes.find(c => c.recordId === 'rec-summary' && c.field === 'body');
    assert.match(a.after, /Lab 3 shutdown account selected/);
    assert.match(b.after, /Lab 4 access account selected/);
  });
});

describe('engine: memory capacity (C2) and eviction', () => {
  it('FORENSIC evicts Echo\'s blanket memory with a real before/after diff', () => {
    const { outcomes, session } = playPath({ c2: 'FORENSIC' });
    const blanket = outcomes.c2.changes.find(c => c.recordId === 'rec-blanket' && c.field === 'body');
    assert.match(blanket.before, /blanket on the roof/);
    assert.equal(blanket.after, '[Fragment evicted under capacity policy]');
    assert.equal(session.fragments.echoBlanket, 'evicted');
    assert.equal(session.fragments.archivistTiming, 'intact');
  });

  it('HUMAN removes the timing detail from the Archivist\'s Lab 3 replica instead', () => {
    const { outcomes, session } = playPath({ c2: 'HUMAN' });
    const timing = outcomes.c2.changes.find(c => c.recordId === 'rec-lab3' && c.field === 'body');
    assert.match(timing.before, /23:41/);
    assert.match(timing.after, /\[timing evicted\]/);
    assert.equal(session.fragments.archivistTiming, 'evicted');
    assert.equal(session.fragments.echoBlanket, 'intact');
  });

  it('both capacity options produce different agent reactions', () => {
    const f = playPath({ c2: 'FORENSIC' }).outcomes.c2.agentReactions;
    const h = playPath({ c2: 'HUMAN' }).outcomes.c2.agentReactions;
    assert.notDeepEqual(f, h);
  });
});

describe('engine: operator anomaly (E11) is derived from the event log', () => {
  it('names the real first-choice event ID and choice, with the session short ID', () => {
    const { session } = playPath({ c1: 'LAB4' });
    const c1Event = session.playerEvents.find(e => e.type === 'COMMIT_DEATH_RECORD');
    const body = session.records['rec-anomaly'].body;
    assert.ok(body.includes(`Event ${c1Event.id} has been archived.`));
    assert.ok(body.includes('You selected the Lab 4 access record'));
    const label = createHash('sha256').update(session.sessionId).digest('hex').slice(0, 8);
    assert.ok(body.includes(`session ${label}`), 'label is a hash prefix, not part of the credential');
    assert.ok(!body.includes(session.sessionId.slice(0, 8)), 'the anomaly must not quote any prefix of the token');
    assert.ok(body.includes('DATE: 1998-10-31 23:42'));
  });

  it('two sessions with different first choices produce different anomaly text', () => {
    const a = playPath({ c1: 'LAB3' }).session.records['rec-anomaly'].body;
    const b = playPath({ c1: 'LAB4' }).session.records['rec-anomaly'].body;
    assert.notEqual(a, b);
  });
});

describe('engine: propagation', () => {
  it('every changed record is carried by propagation events from the committing node', () => {
    const { outcomes } = playPath({ c1: 'LAB3' });
    const changed = [...new Set(outcomes.c1.changes.filter(c => c.field === 'replicaVersion').map(c => c.recordId))];
    assert.ok(changed.length >= 2);
    const events = outcomes.c1.propagation;
    assert.ok(events.length > 0);
    assert.ok(events.every(e => e.fromNode && e.toNode && e.version >= 2));
    for (const rid of changed) {
      const reached = new Set(events.filter(e => e.recordId === rid).map(e => e.toNode));
      assert.equal(reached.size, engine.projection(playPath().session).nodes.length - 1,
        `${rid} must reach every other node`);
    }
  });

  it('after propagation every node holds the current version of each visible record', () => {
    const { session } = playPath({ c1: 'LAB4', c2: 'HUMAN' });
    for (const node of Object.keys(session.nodeReplicas)) {
      for (const [rid, version] of Object.entries(session.nodeReplicas[node])) {
        assert.equal(version, session.records[rid].headers.replicaVersion, `${node} stale for ${rid}`);
      }
    }
  });

  it('propagation events record the chosen commit event ID', () => {
    const { session, outcomes } = playPath({ c1: 'LAB3' });
    const c1Id = session.playerEvents.find(e => e.type === 'COMMIT_DEATH_RECORD').id;
    assert.ok(outcomes.c1.propagation.every(p => p.eventId === c1Id));
  });
});

describe('engine: endings and gating', () => {
  it('ARCHIVE and ECHO are always offered at Act IV', () => {
    const { session } = playPath({ mailbox: false });
    const offered = engine.projection(session).endings;
    assert.equal(offered.find(e => e.id === 'ARCHIVE').unlocked, true);
    assert.equal(offered.find(e => e.id === 'ECHO').unlocked, true);
  });

  it('LAST_LETTER stays locked without the mailbox reconstruction, and cannot be forced', () => {
    const { session } = playPath({ mailbox: false, c3: 'EXPOSE' });
    const letter = engine.projection(session).endings.find(e => e.id === 'LAST_LETTER');
    assert.equal(letter.unlocked, false);
    assert.equal(letter.missingEvidenceCount, 1);
    assert.throws(() => step(session, 'COMMIT_FINAL', { ending: 'LAST_LETTER' }), (e) => e.status === 409);
  });

  for (const ending of ['ARCHIVE', 'ECHO', 'LAST_LETTER']) {
    it(`${ending} is reachable and ends the game`, () => {
      const { session, outcomes } = playPath({ ending });
      assert.equal(session.endingSelected, ending);
      assert.equal(outcomes.final.ending.id, ending);
      assert.ok(outcomes.final.ending.verifiedFacts.length >= 10);
      assert.throws(() => step(session, 'COMMIT_FINAL', { ending: 'ARCHIVE' }), (e) => e.code === 'game_over');
    });
  }

  it('the Last Letter is composed from state: branch, capacity, provenance and closing all change it', () => {
    const letter = (opts) => playPath({ ending: 'LAST_LETTER', ...opts }).outcomes.final.ending.letter;
    const base = letter({});
    assert.ok(base.length >= 8, 'opening, six slots, closing and sign-off');
    assert.notDeepEqual(letter({ c1: 'LAB4' }), base, 'truth slot follows the death-record choice');
    assert.notDeepEqual(letter({ c2: 'HUMAN' }), base, 'memory slot follows the capacity choice');
    assert.notDeepEqual(letter({ c3: 'SUPPRESS' }), base, 'provenance slot follows the provenance choice');
    assert.notDeepEqual(letter({ closing: 'COST' }), base, 'the closing line is the player\'s choice');
  });

  it('sealing the Last Letter is irreversible: the game ends and no further action is accepted', () => {
    const { session } = playPath({ ending: 'LAST_LETTER', closing: 'PLAIN' });
    assert.equal(session.endingSelected, 'LAST_LETTER');
    assert.throws(() => step(session, 'COMMIT_FINAL', { ending: 'ECHO' }), (e) => e.code === 'game_over');
  });

  it('the letter composer is hidden until the gate opens, then shows six slots and two closings until sealed', () => {
    assert.equal(engine.projection(playPath({ mailbox: false, c3: 'EXPOSE' }).session).letter, null, 'gate closed');
    const { session } = playPath({ stopBeforeFinal: true });
    const view = engine.projection(session).letter;
    assert.equal(view.slots.length, 6);
    assert.deepEqual(view.closings.map(c => c.id), ['PLAIN', 'COST']);
    assert.equal(view.sealed, null);
    const sealed = playPath({ ending: 'LAST_LETTER', closing: 'COST' }).session;
    assert.equal(engine.projection(sealed).letter.sealed, 'COST');
  });

  it('the Last Letter ending offers two sealing actions that differ only in closing', () => {
    const { session } = playPath({ stopBeforeFinal: true });
    const seals = engine.availableActions(session).filter(a => a.type === 'COMMIT_FINAL' && a.payload.ending === 'LAST_LETTER');
    assert.deepEqual(seals.map(a => a.payload.closing).sort(), ['COST', 'PLAIN']);
  });

  it('the Last Letter is the only ending with a letter body', () => {
    assert.ok(playPath({ ending: 'LAST_LETTER' }).outcomes.final.ending.letter.length >= 4);
    assert.equal(playPath({ ending: 'ARCHIVE' }).outcomes.final.ending.letter, null);
  });

  it('both provenance options allow Act IV', () => {
    assert.equal(playPath({ c3: 'EXPOSE' }).session.storyAct, 4);
    assert.equal(playPath({ c3: 'SUPPRESS' }).session.storyAct, 4);
  });
});

describe('engine: replay', () => {
  for (const [label, options] of [
    ['A/forensic/expose/archive', { c1: 'LAB3', c2: 'FORENSIC', c3: 'EXPOSE', ending: 'ARCHIVE' }],
    ['B/human/suppress/last-letter', { c1: 'LAB4', c2: 'HUMAN', c3: 'SUPPRESS', ending: 'LAST_LETTER' }],
    ['B/forensic/expose/echo', { c1: 'LAB4', c2: 'FORENSIC', c3: 'EXPOSE', ending: 'ECHO' }]
  ]) {
    it(`replaying the event log reproduces the narrative state (${label})`, () => {
      const { session } = playPath(options);
      const actions = session.playerEvents.map(e => ({ actionId: e.actionId, type: e.type, payload: e.payload }));
      const replayed = engine.replay(session.sessionId, actions);
      assert.deepEqual(engine.replayFingerprint(replayed), engine.replayFingerprint(session));
    });
  }
});

// ---------- HTTP contract, isolation, persistence ----------

describe('HTTP session API', () => {
  let server;
  let dataDir;
  before(async () => {
    dataDir = tempDataDir();
    server = await startServer(dataDir);
  });
  after(async () => {
    await server.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('creates a session with an opaque 128-bit ID and returns the projection', async () => {
    const res = await call(server.baseUrl, 'POST', '/api/sessions');
    assert.equal(res.status, 201);
    assert.match(res.json.sessionId, /^[a-f0-9]{64}$/);
    assert.equal(res.json.revision, 0);
    assert.equal(res.json.sceneId, 'TRANSMISSION');
    assert.equal(res.json.state.endings.length, 3);
  });

  it('keeps sessions isolated: actions in one session do not change another', async () => {
    const a = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const b = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, a, 'OPEN_THREAD');
    const stateB = (await call(server.baseUrl, 'GET', `/api/sessions/${b}`)).json;
    assert.equal(stateB.revision, 0);
    assert.equal(stateB.visibleRecords.some(r => r.id === 'rec-lab3'), false);
  });

  it('rejects a stale expectedRevision with 409 stale_revision', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const res = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, {
      actionId: randomUUID(), expectedRevision: 0, type: 'INSPECT_HEADERS', payload: { recordId: 'rec-lab3' }
    });
    assert.equal(res.status, 409);
    assert.equal(res.json.code, 'stale_revision');
    assert.equal(res.json.currentRevision, 1);
  });

  it('rejects an action not available at the current stage with a typed 409', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const res = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, {
      actionId: randomUUID(), expectedRevision: 0, type: 'COMMIT_DEATH_RECORD', payload: { choice: 'LAB3' }
    });
    assert.equal(res.status, 409);
    assert.equal(res.json.code, 'invalid_action');
    assert.equal(res.json.stage, 'TRANSMISSION');
  });

  it('validates input: bad action ID, unknown type, bad revision, non-object payload', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const url = `/api/sessions/${id}/actions`;
    assert.equal((await call(server.baseUrl, 'POST', url, { actionId: 'bad id!', expectedRevision: 0, type: 'OPEN_THREAD' })).status, 400);
    assert.equal((await call(server.baseUrl, 'POST', url, { actionId: 'ok1', expectedRevision: 0, type: 'DROP_TABLES' })).status, 400);
    assert.equal((await call(server.baseUrl, 'POST', url, { actionId: 'ok2', expectedRevision: -1, type: 'OPEN_THREAD' })).status, 400);
    assert.equal((await call(server.baseUrl, 'POST', url, { actionId: 'ok3', expectedRevision: 0, type: 'OPEN_THREAD', payload: [] })).status, 400);
    assert.equal((await call(server.baseUrl, 'POST', url, undefined, '{broken')).status, 400);
  });

  it('rejects oversized request bodies with 413', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const huge = JSON.stringify({ actionId: 'big', expectedRevision: 0, type: 'OPEN_THREAD', payload: { pad: 'x'.repeat(40000) } });
    const res = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, undefined, huge);
    assert.equal(res.status, 413);
  });

  it('replays a repeated actionId without applying it twice', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const body = { actionId: 'same-action', expectedRevision: 0, type: 'OPEN_THREAD', payload: {} };
    const first = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, body);
    const second = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, body);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.json.replayed, true);
    assert.equal(second.json.revision, first.json.revision);
    const events = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/events`)).json;
    assert.equal(events.playerEvents.length, 1);
  });

  it('preview returns changes and leaves the revision unchanged', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    await act(server.baseUrl, id, 'INSPECT_HEADERS', { recordId: 'rec-lab3' });
    await act(server.baseUrl, id, 'INSPECT_HEADERS', { recordId: 'rec-lab4' });
    const before = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).json;
    const res = await call(server.baseUrl, 'POST', `/api/sessions/${id}/actions`, {
      actionId: randomUUID(), expectedRevision: before.revision, type: 'COMMIT_DEATH_RECORD', payload: { choice: 'LAB4' }, preview: true
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.preview, true);
    assert.ok(res.json.changes.length >= 2);
    const after = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).json;
    assert.equal(after.revision, before.revision);
    assert.equal(after.chosen.deathRecord, null);
  });

  it('threads and thread messages expose headers, replica version and decay for visible records only', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const threads = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads`)).json;
    assert.equal(threads[0].id, 'alt.memory.1998');
    assert.match(threads[0].subject, /incident reports/);
    const before = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads/alt.memory.1998`)).json;
    assert.deepEqual(before.map(m => m.id), ['rec-incoming']);
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const after = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads/alt.memory.1998`)).json;
    const lab3 = after.find(m => m.id === 'rec-lab3');
    assert.equal(lab3.replicaVersion, 1);
    assert.equal(typeof lab3.decayLevel, 'number');
    assert.equal(lab3.headers.checksum, '1A7F');
    assert.equal(lab3.subject, 'Shutdown report, Lab 3');
    assert.equal(after.some(m => m.id === 'rec-anomaly'), false);
  });

  it('never renders undefined in any projection or message', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const state = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).text;
    const msgs = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads/alt.memory.1998`)).text;
    assert.doesNotMatch(state, /undefined/);
    assert.doesNotMatch(msgs, /undefined/);
  });

  it('unknown thread and malformed session IDs return typed 404 responses', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    const thread = await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads/nope`);
    assert.equal(thread.status, 404);
    assert.equal(thread.json.code, 'thread_not_found');
    const bad = await call(server.baseUrl, 'GET', '/api/sessions/..%2F..%2Fetc');
    assert.equal(bad.status, 404);
    assert.equal(bad.json.code, 'session_not_found');
    assert.equal((await call(server.baseUrl, 'GET', '/api/sessions/00000000000000000000000000000000')).status, 404);
  });

  it('events endpoint returns the audit log with archive and real timestamps recorded separately', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const events = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/events`)).json;
    assert.equal(events.playerEvents.length, 1);
    const [event] = events.playerEvents;
    assert.equal(event.archiveTimestamp, '1998-10-31 23:42');
    assert.equal(typeof event.realTimestamp, 'string');
    assert.match(event.id, /^evt-\d{4}$/);
  });

  it('reset requires explicit confirmation and gives a fresh session ID', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const refused = await call(server.baseUrl, 'POST', `/api/sessions/${id}/reset`, { confirm: 'yes' });
    assert.equal(refused.status, 400);
    const reset = await call(server.baseUrl, 'POST', `/api/sessions/${id}/reset`, { confirm: 'RESET' });
    assert.equal(reset.status, 201);
    assert.notEqual(reset.json.sessionId, id);
    assert.equal(reset.json.revision, 0);
    assert.equal((await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).status, 404);
    const fresh = (await call(server.baseUrl, 'GET', `/api/sessions/${reset.json.sessionId}`)).json;
    assert.equal(fresh.revision, 0);
    assert.deepEqual(fresh.inspectedHeaders, []);
  });

  it('unknown session subroutes return a JSON 404', async () => {
    const res = await call(server.baseUrl, 'GET', '/api/sessions/x/unknown/route');
    assert.equal(res.status, 404);
    assert.equal(res.json.code, 'not_found');
  });

  it('writes sessions atomically, leaving no temporary files behind', async () => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const files = fs.readdirSync(dataDir);
    assert.ok(files.includes(`${id}.json`));
    assert.equal(files.filter(f => f.endsWith('.tmp')).length, 0);
  });
});

describe('HTTP: full investigations and recovery', () => {
  it('plays a complete Lab 4 + Last Letter investigation over HTTP and shows the anomaly from the event log', () => withServer(async (server) => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    await act(server.baseUrl, id, 'INSPECT_HEADERS', { recordId: 'rec-lab3' });
    await act(server.baseUrl, id, 'INSPECT_HEADERS', { recordId: 'rec-lab4' });
    const c1 = await act(server.baseUrl, id, 'COMMIT_DEATH_RECORD', { choice: 'LAB4' });
    assert.ok(c1.changes.filter(c => c.field === 'status' || c.field === 'body').length >= 2);
    assert.ok(c1.agentReactions.length >= 1);
    await act(server.baseUrl, id, 'TRACE_RELAY', { node: 'NODE-02' });
    await act(server.baseUrl, id, 'INSPECT_MAINTENANCE', {});
    await act(server.baseUrl, id, 'RECONSTRUCT_MAILBOX', {});
    await act(server.baseUrl, id, 'TRACE_PROVENANCE', {});
    await act(server.baseUrl, id, 'TRACE_RELAY', { node: 'NODE-04' });
    const c2 = await act(server.baseUrl, id, 'COMMIT_MEMORY_CAPACITY', { choice: 'FORENSIC' });
    assert.ok(c2.changes.some(c => c.recordId === 'rec-blanket' && c.field === 'body'));
    await act(server.baseUrl, id, 'COMMIT_PROVENANCE', { choice: 'EXPOSE' });

    const messages = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/threads/alt.memory.1998`)).json;
    const anomaly = messages.find(m => m.id === 'rec-anomaly');
    const events = (await call(server.baseUrl, 'GET', `/api/sessions/${id}/events`)).json;
    const firstChoice = events.playerEvents.find(e => e.type === 'COMMIT_DEATH_RECORD');
    assert.ok(anomaly.content.includes(firstChoice.id), 'anomaly quotes the real event ID');
    assert.ok(anomaly.content.includes('the Lab 4 access record'));

    const final = await act(server.baseUrl, id, 'COMMIT_FINAL', { ending: 'LAST_LETTER', closing: 'COST' });
    assert.equal(final.ending.id, 'LAST_LETTER');
    assert.ok(final.ending.letter.length >= 4);
    const state = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).json;
    assert.equal(state.endingSelected, 'LAST_LETTER');
    assert.equal(state.sceneId, 'ENDED');
  }));

  it('a page refresh (repeat GET) returns identical narrative state', () => withServer(async (server) => {
    const id = (await call(server.baseUrl, 'POST', '/api/sessions')).json.sessionId;
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const first = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).json;
    const second = (await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).json;
    assert.deepEqual(second, first);
  }));

  it('a server restart recovers the same session from disk', async () => {
    const dataDir = tempDataDir();
    const first = await startServer(dataDir);
    let sessionId;
    let before;
    try {
      sessionId = (await call(first.baseUrl, 'POST', '/api/sessions')).json.sessionId;
      await act(first.baseUrl, sessionId, 'OPEN_THREAD');
      await act(first.baseUrl, sessionId, 'INSPECT_HEADERS', { recordId: 'rec-lab3' });
      await act(first.baseUrl, sessionId, 'INSPECT_HEADERS', { recordId: 'rec-lab4' });
      await act(first.baseUrl, sessionId, 'COMMIT_DEATH_RECORD', { choice: 'LAB3' });
      before = (await call(first.baseUrl, 'GET', `/api/sessions/${sessionId}`)).json;
    } finally {
      await first.stop();
    }
    const second = await startServer(dataDir);
    try {
      const after = (await call(second.baseUrl, 'GET', `/api/sessions/${sessionId}`)).json;
      assert.deepEqual(after, before);
      assert.equal(after.chosen.deathRecord, 'LAB3');
      assert.equal(after.revision, 4);
      // The recovered session keeps accepting valid actions at the stored revision.
      const next = await act(second.baseUrl, sessionId, 'TRACE_RELAY', { node: 'NODE-02' });
      assert.equal(next.revision, 5);
    } finally {
      await second.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

// ---------- anonymous sessions: token validation, isolation, permissions, size, retention, deletion, logs ----------

const http = require('node:http');
const DAY_MS = 24 * 60 * 60 * 1000;

async function getJson(baseUrl, route) {
  const res = await call(baseUrl, 'GET', route);
  assert.equal(res.status, 200, `GET ${route} should return 200, got ${res.status}`);
  return res.json;
}
const STORE_PATH = path.join(ROOT, 'combined-server', 'game', 'store.js');

function rawGet(baseUrl, requestPath) {
  const { port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: Number(port), path: requestPath }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function saveFile(dataDir, id) {
  return path.join(dataDir, `${id}.json`);
}

function backdate(dataDir, id, days) {
  const file = saveFile(dataDir, id);
  const session = JSON.parse(fs.readFileSync(file, 'utf8'));
  session.lastActiveAt = new Date(Date.now() - days * DAY_MS).toISOString();
  fs.writeFileSync(file, JSON.stringify(session), { mode: 0o600 });
}

async function newSessionId(baseUrl) {
  return (await call(baseUrl, 'POST', '/api/sessions')).json.sessionId;
}

describe('anonymous sessions: identifiers and access', () => {
  it('session IDs are 256-bit random values and do not repeat', () => withServer(async (server) => {
    const ids = [];
    for (let i = 0; i < 20; i += 1) ids.push(await newSessionId(server.baseUrl));
    for (const id of ids) assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal(new Set(ids).size, ids.length);
  }));

  it('malformed identifiers get the same 404 as an unknown session and never touch the save directory', () => withServer(async (server) => {
    const unknown = await call(server.baseUrl, 'GET', '/api/sessions/' + 'b'.repeat(64));
    const before = fs.readdirSync(server.dataDir).sort();
    const malformed = [
      'short', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65),
      'a'.repeat(64) + '.json', '..%2F..%2Fetc%2Fpasswd', '%2e%2e', 'a'.repeat(32) + '%00'
    ];
    for (const id of malformed) {
      const encoded = encodeURIComponent(id);
      for (const [method, route, body] of [
        ['GET', `/api/sessions/${encoded}`],
        ['DELETE', `/api/sessions/${encoded}`],
        ['POST', `/api/sessions/${encoded}/actions`, { actionId: 'x1', expectedRevision: 0, type: 'OPEN_THREAD' }]
      ]) {
        const res = await call(server.baseUrl, method, route, body);
        assert.equal(res.status, 404, `${method} ${id.slice(0, 12)} should be 404`);
        assert.equal(res.json.code, 'session_not_found');
        assert.deepEqual(res.json, unknown.json, 'malformed and unknown IDs must look identical');
      }
    }
    assert.deepEqual(fs.readdirSync(server.dataDir).sort(), before, 'no files created or removed by malformed IDs');
  }));

  it('static file serving cannot reach save files through path traversal', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    const relative = path.relative(path.join(ROOT, 'frontend', 'src'), saveFile(server.dataDir, id));
    const res = await rawGet(server.baseUrl, '/src/' + relative);
    assert.notEqual(res.status, 200);
    assert.ok(!res.body.includes('"sessionId"'), 'save contents must never be served');
  }));

  it('one session cannot read or change another session', () => withServer(async (server) => {
    const a = await newSessionId(server.baseUrl);
    const b = await newSessionId(server.baseUrl);
    await act(server.baseUrl, a, 'OPEN_THREAD');
    const stateB = await getJson(server.baseUrl, `/api/sessions/${b}`);
    assert.equal(stateB.sessionId, b);
    assert.equal(stateB.revision, 0);
    const eventsB = await getJson(server.baseUrl, `/api/sessions/${b}/events`);
    assert.equal(eventsB.playerEvents.length, 0);
  }));

  it('save files and the save directory are owner-only (0600 and 0700)', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    assert.equal(fs.statSync(saveFile(server.dataDir, id)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(server.dataDir).mode & 0o777, 0o700);
  }));

  it('saves hold only game state and an activity timestamp, with no network or contact fields', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const saved = JSON.parse(fs.readFileSync(saveFile(server.dataDir, id), 'utf8'));
    const allowed = new Set([
      'schemaVersion', 'seedVersion', 'sessionId', 'revision', 'storyAct', 'evidence', 'threadOpened',
      'inspectedHeaders', 'chosen', 'fragments', 'records', 'nodeReplicas', 'propagationEvents',
      'playerEvents', 'conflictLog', 'agentsRevealed', 'agentTrust', 'agentKnowledge', 'actionResults',
      'endingSelected', 'createdAt', 'updatedAt', 'lastActiveAt'
    ]);
    assert.deepEqual(Object.keys(saved).filter(k => !allowed.has(k)), [], 'save files contain only game state and timestamps');
    assert.match(saved.lastActiveAt, /^\d{4}-\d{2}-\d{2}T/);
  }));
});

describe('anonymous sessions: logs', () => {
  it('server output never contains a full session token or the save directory path', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    await act(server.baseUrl, id, 'OPEN_THREAD');
    await call(server.baseUrl, 'GET', `/api/sessions/${id}`);
    await call(server.baseUrl, 'GET', '/api/sessions/' + 'z'.repeat(64));
    await call(server.baseUrl, 'DELETE', `/api/sessions/${id}`);
    const output = server.logs();
    assert.ok(!output.includes(id), 'full token must not appear in logs');
    assert.ok(!output.includes(server.dataDir), 'save directory must not appear in logs');
    assert.doesNotMatch(output, /[a-f0-9]{64}/);
  }));
});

describe('anonymous sessions: size limit', () => {
  it('refuses a save over 256 KB and keeps the previous save intact', () => {
    const dataDir = tempDataDir();
    try {
      const { createStore } = require('../combined-server/game/store');
      const store = createStore(dataDir);
      const session = engine.newSession({ sessionId: store.newId(), now: null });
      store.save(session);
      const before = fs.readFileSync(saveFile(dataDir, session.sessionId), 'utf8');
      session.padding = 'x'.repeat(store.maxSessionBytes + 1024);
      assert.throws(() => store.save(session), (err) => err.status === 413 && err.code === 'session_too_large');
      assert.equal(fs.readFileSync(saveFile(dataDir, session.sessionId), 'utf8'), before);
      assert.deepEqual(fs.readdirSync(dataDir).filter(f => f.endsWith('.tmp')), []);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('a normal full investigation stays far below the limit', () => {
    const { session } = playPath({ c1: 'LAB4', c2: 'HUMAN', c3: 'SUPPRESS', ending: 'LAST_LETTER' });
    assert.ok(Buffer.byteLength(JSON.stringify(session)) < 64 * 1024);
  });
});

describe('anonymous sessions: expiry, cleanup and recovery', () => {
  it('a session inactive for more than seven days is gone, and its file is removed', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    backdate(server.dataDir, id, 8);
    const res = await call(server.baseUrl, 'GET', `/api/sessions/${id}`);
    assert.equal(res.status, 404);
    assert.equal(res.json.code, 'session_not_found');
    assert.equal(fs.existsSync(saveFile(server.dataDir, id)), false);
  }));

  it('a session six days idle still loads and its activity is recorded', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    backdate(server.dataDir, id, 6);
    const res = await call(server.baseUrl, 'GET', `/api/sessions/${id}`);
    assert.equal(res.status, 200);
    const saved = JSON.parse(fs.readFileSync(saveFile(server.dataDir, id), 'utf8'));
    assert.ok(Date.now() - Date.parse(saved.lastActiveAt) < 60 * 1000, 'reading a save refreshes its activity time');
  }));

  it('store cleanup removes only expired saves and orphaned temp files, and reports counts without IDs', () => {
    const dataDir = tempDataDir();
    try {
      const { createStore } = require('../combined-server/game/store');
      let clock = Date.parse('2026-11-01T00:00:00Z');
      const writer = createStore(dataDir, { now: () => clock });
      const oldSession = engine.newSession({ sessionId: writer.newId(), now: null });
      writer.save(oldSession);
      clock += 3 * DAY_MS;
      const recentSession = engine.newSession({ sessionId: writer.newId(), now: null });
      writer.save(recentSession);
      const orphan = path.join(dataDir, `${recentSession.sessionId}.json.1.abcd.tmp`);
      fs.writeFileSync(orphan, 'partial', { mode: 0o600 });
      fs.utimesSync(orphan, new Date(clock - 2 * 60 * 60 * 1000), new Date(clock - 2 * 60 * 60 * 1000));

      const later = createStore(dataDir, { now: () => clock + 5 * DAY_MS }); // old save is 8 days idle, recent is 5
      const result = later.cleanupExpired();
      assert.deepEqual(result, { expired: 1, orphans: 1 });
      assert.equal(fs.existsSync(saveFile(dataDir, oldSession.sessionId)), false);
      assert.equal(fs.existsSync(saveFile(dataDir, recentSession.sessionId)), true);
      assert.equal(fs.existsSync(orphan), false);
      assert.equal(later.isExpired(JSON.parse(fs.readFileSync(saveFile(dataDir, recentSession.sessionId), 'utf8'))), false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('cleanup runs every 24 hours from an unref-ed timer', () => {
    const { createStore, scheduleRetention } = require('../combined-server/game/store');
    const dataDir = tempDataDir();
    try {
      const store = createStore(dataDir);
      let scheduled = null;
      let unrefCalled = false;
      const fakeTimer = (fn, ms) => { scheduled = { fn, ms }; return { unref: () => { unrefCalled = true; } }; };
      const ran = [];
      scheduleRetention(store, { timer: fakeTimer, onRun: (r) => ran.push(r) });
      assert.equal(scheduled.ms, DAY_MS);
      assert.equal(unrefCalled, true);
      scheduled.fn();
      assert.deepEqual(ran, [{ expired: 0, orphans: 0 }]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('server startup removes expired saves before serving, and live saves survive a restart', async () => {
    const dataDir = tempDataDir();
    let live;
    let stale;
    const first = await startServer(dataDir);
    try {
      live = await newSessionId(first.baseUrl);
      stale = await newSessionId(first.baseUrl);
    } finally {
      await first.stop();
    }
    backdate(dataDir, stale, 8);
    const second = await startServer(dataDir);
    try {
      assert.match(second.logs(), /removed 1 expired save/);
      assert.equal((await call(second.baseUrl, 'GET', `/api/sessions/${stale}`)).status, 404);
      assert.equal((await call(second.baseUrl, 'GET', `/api/sessions/${live}`)).status, 200);
    } finally {
      await second.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('a live session with progress recovers fully after a restart', async () => {
    const dataDir = tempDataDir();
    const first = await startServer(dataDir);
    let id;
    let before;
    try {
      id = await newSessionId(first.baseUrl);
      await act(first.baseUrl, id, 'OPEN_THREAD');
      await act(first.baseUrl, id, 'INSPECT_HEADERS', { recordId: 'rec-lab3' });
      before = await getJson(first.baseUrl, `/api/sessions/${id}`);
    } finally {
      await first.stop();
    }
    const second = await startServer(dataDir);
    try {
      assert.deepEqual(await getJson(second.baseUrl, `/api/sessions/${id}`), before);
    } finally {
      await second.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe('anonymous sessions: deletion', () => {
  it('DELETE removes the save; the session is then unknown and a second DELETE is 404', () => withServer(async (server) => {
    const id = await newSessionId(server.baseUrl);
    await act(server.baseUrl, id, 'OPEN_THREAD');
    const first = await call(server.baseUrl, 'DELETE', `/api/sessions/${id}`);
    assert.equal(first.status, 200);
    assert.deepEqual(first.json, { deleted: true });
    assert.equal(fs.existsSync(saveFile(server.dataDir, id)), false);
    assert.equal((await call(server.baseUrl, 'GET', `/api/sessions/${id}`)).status, 404);
    assert.equal((await call(server.baseUrl, 'DELETE', `/api/sessions/${id}`)).status, 404);
  }));

  it('deleting one session leaves every other session untouched', () => withServer(async (server) => {
    const keep = await newSessionId(server.baseUrl);
    const drop = await newSessionId(server.baseUrl);
    await act(server.baseUrl, keep, 'OPEN_THREAD');
    await call(server.baseUrl, 'DELETE', `/api/sessions/${drop}`);
    const kept = await getJson(server.baseUrl, `/api/sessions/${keep}`);
    assert.equal(kept.revision, 1);
  }));
});
