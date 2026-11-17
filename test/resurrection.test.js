// Resurrection - authoritative test suite.
// Runs with Node's built-in test runner (node:test). No npm dependencies.
// Every server runs as its own child process on a dynamically assigned port with
// in-memory state, so runs never share game state, never collide on ports, and
// are always stopped in a finally block or an after hook.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SERVER_ENTRY = path.join(ROOT, 'combined-server', 'server.js');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const THREAD_ID = 'threads.tech.mind.98';
const RECORD_A = 'msg-98-002';
const RECORD_B = 'msg-98-003';
const ANOMALY = 'msg-98-004';
const AGENT_IDS = ['archivist', 'echo', 'corruptor'];

// ---------- server process management ----------

const liveChildren = new Set();
process.on('exit', () => {
  for (const child of liveChildren) child.kill('SIGKILL');
});

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: ROOT,
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    liveChildren.add(child);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Server did not report a bound port within 10s. stderr: ' + stderr));
    }, 10000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const match = stdout.match(/running on port (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({
          baseUrl: `http://127.0.0.1:${match[1]}`,
          stop: () => stopServer(child),
        });
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => {
      liveChildren.delete(child);
      clearTimeout(timer);
      reject(new Error(`Server exited before reporting a port (code ${code}). stderr: ${stderr}`));
    });
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      liveChildren.delete(child);
      return resolve();
    }
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(killTimer);
      liveChildren.delete(child);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function withServer(fn) {
  const server = await startServer();
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.stop();
  }
}

// ---------- HTTP helper ----------

async function call(baseUrl, method, route, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(baseUrl + route, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON response */ }
  return { status: res.status, contentType: res.headers.get('content-type') || '', text, json };
}

async function getJson(baseUrl, route) {
  const res = await call(baseUrl, 'GET', route);
  assert.equal(res.status, 200, `GET ${route} should return 200, got ${res.status}: ${res.text}`);
  return res.json;
}

// Captures everything a player can observe about the archive and the game state.
async function snapshot(baseUrl) {
  const [state, messages] = await Promise.all([
    getJson(baseUrl, '/api/game/state'),
    getJson(baseUrl, '/api/messages'),
  ]);
  return {
    state,
    messages,
    byId: Object.fromEntries(messages.map((m) => [m.id, m])),
    threadMessages: messages.filter((m) => m.threadId === THREAD_ID),
  };
}

// Plays one full branch in a fresh server process and returns the observations.
async function playBranch(choice) {
  return withServer(async (baseUrl) => {
    const before = await snapshot(baseUrl);
    const response = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice });
    const after = await snapshot(baseUrl);
    return { choice, before, response, after };
  });
}

function changedRecordIds(before, after) {
  return Object.keys(before.byId).filter((id) => {
    const b = before.byId[id];
    const a = after.byId[id];
    return JSON.stringify({ c: b.content, m: b.metadata, r: b.recordStatus }) !==
           JSON.stringify({ c: a.content, m: a.metadata, r: a.recordStatus });
  });
}

// Strips identifiers and wall-clock timestamps so two runs can be compared for determinism.
function outcomeFingerprint(obs) {
  return {
    authoritativeRecord: obs.after.state.verticalSlice.authoritativeRecord,
    reactions: obs.response.json.agentReactions,
    records: Object.fromEntries(
      obs.after.threadMessages.map((m) => [m.subject, {
        content: m.content,
        recordStatus: m.recordStatus,
        decayLevel: m.metadata.decayLevel,
        reconstructionLevel: m.metadata.reconstructionLevel,
      }])
    ),
  };
}

// ---------- static frontend assets ----------

describe('frontend assets', () => {
  let server;
  let indexHtml;
  before(async () => {
    server = await startServer();
    indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');
  });
  after(() => server.stop());

  it('serves index.html with the React mount point and entry module', async () => {
    const res = await call(server.baseUrl, 'GET', '/');
    assert.equal(res.status, 200);
    assert.match(res.contentType, /text\/html/);
    assert.match(res.text, /<div id="root"><\/div>/);
    assert.match(res.text, /<script type="module" src="\/src\/main\.jsx">/);
  });

  it('every local script and stylesheet referenced by index.html returns 200', async () => {
    const localRefs = [...indexHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(localRefs.length >= 1, 'index.html should reference at least one local asset');
    for (const ref of localRefs) {
      const res = await call(server.baseUrl, 'GET', ref);
      assert.equal(res.status, 200, `local asset ${ref} should return 200`);
    }
  });

  it('serves main.jsx as JavaScript with no raw ES module imports', async () => {
    const res = await call(server.baseUrl, 'GET', '/src/main.jsx');
    assert.equal(res.status, 200);
    assert.match(res.contentType, /javascript/);
    assert.doesNotMatch(res.text, /^\s*import\s/m, 'main.jsx must not use import statements');
    assert.doesNotMatch(res.text, /^\s*export\s/m, 'main.jsx must not use export statements');
  });

  it('main.jsx parses as plain JavaScript (no JSX, no build step required)', () => {
    const source = fs.readFileSync(path.join(FRONTEND_DIR, 'src', 'main.jsx'), 'utf8');
    // vm.Script compiles without executing. Raw JSX is a syntax error here.
    assert.doesNotThrow(() => new vm.Script(source, { filename: 'main.jsx' }));
  });

  it('returns a JSON 404 for unknown API routes instead of the HTML page', async () => {
    const res = await call(server.baseUrl, 'GET', '/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.contentType, /application\/json/);
    assert.deepEqual(res.json, { error: 'Not found' });
  });
});

// ---------- API contract ----------

describe('API contract', () => {
  let server;
  before(async () => { server = await startServer(); });
  after(() => server.stop());

  it('health endpoint reports ok', async () => {
    const health = await getJson(server.baseUrl, '/api/health');
    assert.equal(health.status, 'ok');
    assert.equal(typeof health.timestamp, 'number');
  });

  it('threads have valid ids and real display titles (no "undefined")', async () => {
    const threads = await getJson(server.baseUrl, '/api/threads');
    assert.ok(threads.length >= 1);
    for (const t of threads) {
      assert.equal(typeof t.id, 'string');
      assert.ok(t.id.length > 0);
      assert.equal(typeof t.title, 'string');
      assert.ok(t.title.trim().length > 0, `thread ${t.id} needs a title`);
      assert.doesNotMatch(t.title, /undefined|null/);
      assert.equal(typeof t.messageCount, 'number');
    }
    const first = threads.find((t) => t.id === THREAD_ID);
    assert.ok(first, 'the investigation thread must be listed');
    assert.equal(first.title, 'Dr. Elena Vance: conflicting death records');
  });

  it('every message belongs to a listed thread and has renderable fields', async () => {
    const threads = await getJson(server.baseUrl, '/api/threads');
    const threadIds = new Set(threads.map((t) => t.id));
    const messages = await getJson(server.baseUrl, '/api/messages');
    assert.ok(messages.length >= 4);
    for (const m of messages) {
      assert.ok(threadIds.has(m.threadId), `message ${m.id} belongs to unknown thread ${m.threadId}`);
      assert.equal(typeof m.id, 'string');
      assert.equal(typeof m.subject, 'string', `message ${m.id} must have a subject`);
      assert.ok(m.subject.trim().length > 0);
      assert.equal(typeof m.content, 'string');
      assert.ok(m.content.trim().length > 0);
      assert.ok(AGENT_IDS.includes(m.agentId), `message ${m.id} has unknown agent ${m.agentId}`);
      for (const key of ['timestamp', 'sequence', 'decayLevel', 'reconstructionLevel']) {
        assert.equal(typeof m.metadata[key], 'number', `message ${m.id} metadata.${key} must be a number`);
      }
      assert.doesNotMatch(JSON.stringify(m), /undefined/, `message ${m.id} must not contain undefined values`);
    }
  });

  it('thread messages endpoint returns the same records as the message list', async () => {
    const all = await getJson(server.baseUrl, '/api/messages');
    const thread = await getJson(server.baseUrl, `/api/threads/${THREAD_ID}`);
    assert.deepEqual(thread.map((m) => m.id), all.filter((m) => m.threadId === THREAD_ID).map((m) => m.id));
  });

  it('thread listing counts match the message list', async () => {
    const threads = await getJson(server.baseUrl, '/api/threads');
    const messages = await getJson(server.baseUrl, '/api/messages');
    for (const t of threads) {
      assert.equal(t.messageCount, messages.filter((m) => m.threadId === t.id).length);
    }
  });

  it('agents have the documented shape', async () => {
    const agents = await getJson(server.baseUrl, '/api/agents');
    assert.deepEqual(agents.map((a) => a.id).sort(), [...AGENT_IDS].sort());
    for (const a of agents) {
      assert.equal(typeof a.name, 'string');
      assert.equal(typeof a.description, 'string');
      assert.equal(typeof a.currentMemoryState, 'number');
    }
  });

  it('game state has the documented shape before any choice', async () => {
    const state = await getJson(server.baseUrl, '/api/game/state');
    assert.equal(typeof state.credits, 'number');
    assert.equal(typeof state.storyProgress, 'object');
    assert.equal(state.verticalSlice.choiceMade, null);
    assert.equal(state.verticalSlice.authoritativeRecord, null);
  });

  it('frontend reads only fields that the session projection provides', () => {
    const js = fs.readFileSync(path.join(FRONTEND_DIR, 'src', 'main.jsx'), 'utf8');
    const projectionFields = new Set(Object.keys(require('../combined-server/game/engine').projection(
      require('../combined-server/game/engine').newSession({ sessionId: 'f'.repeat(32) }))));
    const readFields = new Set([...js.matchAll(/\bview\.([A-Za-z]+)/g)].map(m => m[1]));
    assert.ok(readFields.size >= 8, 'frontend should read several projection fields');
    for (const field of readFields) {
      assert.ok(projectionFields.has(field), `frontend reads view.${field}, which the projection does not provide`);
    }
    assert.doesNotMatch(js, /\bundefined\b\s*\+|\+\s*undefined\b/, 'frontend must not concatenate undefined into text');
  });

  it('invalid choice values are rejected with 400', async () => {
    const res = await call(server.baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'C' });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /"A" or "B"/);
  });

  it('choosing in an unknown thread is rejected with 404', async () => {
    const res = await call(server.baseUrl, 'POST', '/api/threads/no-such-thread/choice', { choice: 'A' });
    assert.equal(res.status, 404);
  });

  it('malformed JSON bodies are rejected with 400', async () => {
    const res = await fetch(server.baseUrl + `/api/threads/${THREAD_ID}/choice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
  });
});

// ---------- existing gameplay actions ----------

describe('existing gameplay actions', () => {
  it('read_message costs nothing and succeeds', () => withServer(async (baseUrl) => {
    const res = await call(baseUrl, 'POST', '/api/game/action', { actionType: 'read_message', targetId: RECORD_A });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.gameState.credits, 1000);
  }));

  it('reconstruct_memory spends 100 credits and restores the targeted record', () => withServer(async (baseUrl) => {
    const before = await getJson(baseUrl, `/api/messages`);
    const target = before.find((m) => m.id === RECORD_B);
    const res = await call(baseUrl, 'POST', '/api/game/action', { actionType: 'reconstruct_memory', targetId: RECORD_B });
    assert.equal(res.status, 200);
    assert.equal(res.json.gameState.credits, 900);
    const after = (await getJson(baseUrl, '/api/messages')).find((m) => m.id === RECORD_B);
    assert.ok(after.metadata.decayLevel < target.metadata.decayLevel, 'decay should drop after reconstruction');
  }));

  it('message reconstruction endpoint responds with success and new decay values', () => withServer(async (baseUrl) => {
    const before = (await getJson(baseUrl, '/api/messages')).find((m) => m.id === ANOMALY);
    const res = await call(baseUrl, 'PUT', `/api/messages/${ANOMALY}/reconstruct`, { agentIds: ['archivist'] });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(typeof res.json.newDecayLevel, 'number');
    const after = (await getJson(baseUrl, '/api/messages')).find((m) => m.id === ANOMALY);
    assert.equal(after.metadata.decayLevel, before.metadata.decayLevel - 50 < 0 ? 0 : before.metadata.decayLevel - 50);
  }));

  it('agents answer direct queries in their own voice', () => withServer(async (baseUrl) => {
    const res = await call(baseUrl, 'POST', '/api/agents/archivist/query', { query: 'Lab 4' });
    assert.equal(res.status, 200);
    assert.match(res.json.response, /^\[ARCHIVIST\]/);
    assert.equal(typeof res.json.confidence, 'number');
  }));
});

// ---------- narrative branches (each branch in a fresh, independent server) ----------

describe('investigation branches', { concurrency: false }, () => {
  let branchA;
  let branchB;
  let branchAReplay;

  before(async () => {
    branchA = await playBranch('A');
    branchB = await playBranch('B');
    branchAReplay = await playBranch('A');
  });

  it('a new game starts with both conflicting records available and uncontested state', () => {
    for (const branch of [branchA, branchB]) {
      assert.equal(branch.before.state.verticalSlice.choiceMade, null, 'fresh session must have no choice');
      assert.equal(branch.before.byId[RECORD_A].recordStatus, 'contested');
      assert.equal(branch.before.byId[RECORD_B].recordStatus, 'contested');
      assert.notEqual(branch.before.byId[RECORD_A].content, branch.before.byId[RECORD_B].content);
    }
  });

  it('each branch returns 200 with the documented choice response shape', () => {
    for (const branch of [branchA, branchB]) {
      assert.equal(branch.response.status, 200, branch.response.text);
      assert.equal(branch.response.json.success, true);
      assert.equal(branch.response.json.choice, branch.choice);
      assert.equal(branch.response.json.authoritativeRecord, branch.choice);
      assert.deepEqual(Object.keys(branch.response.json.agentReactions).sort(), [...AGENT_IDS].sort());
      for (const id of AGENT_IDS) {
        assert.equal(typeof branch.response.json.agentReactions[id], 'string');
        assert.ok(branch.response.json.agentReactions[id].length > 0);
      }
    }
  });

  it('choosing A makes Record A authoritative and supersedes Record B', () => {
    assert.equal(branchA.after.state.verticalSlice.choiceMade, 'A');
    assert.equal(branchA.after.state.verticalSlice.authoritativeRecord, 'A');
    assert.equal(branchA.after.byId[RECORD_A].recordStatus, 'authoritative');
    assert.equal(branchA.after.byId[RECORD_B].recordStatus, 'superseded');
  });

  it('choosing B makes Record B authoritative and supersedes Record A', () => {
    assert.equal(branchB.after.state.verticalSlice.choiceMade, 'B');
    assert.equal(branchB.after.state.verticalSlice.authoritativeRecord, 'B');
    assert.equal(branchB.after.byId[RECORD_B].recordStatus, 'authoritative');
    assert.equal(branchB.after.byId[RECORD_A].recordStatus, 'superseded');
  });

  it('the two branches produce different authoritative state', () => {
    assert.notEqual(branchA.after.state.verticalSlice.authoritativeRecord,
                    branchB.after.state.verticalSlice.authoritativeRecord);
  });

  it('choice A changes the anomaly record and does not add evidence', () => {
    assert.equal(branchA.after.byId[ANOMALY].metadata.decayLevel, 35);
    assert.equal(branchA.after.byId[ANOMALY].metadata.reconstructionLevel, 90);
    assert.equal(branchA.after.threadMessages.length, branchA.before.threadMessages.length);
  });

  it('choice B adds a temporal anomaly record and changes the anomaly record differently', () => {
    const added = branchB.after.threadMessages.filter((m) => !branchB.before.byId[m.id]);
    assert.equal(added.length, 1);
    assert.equal(added[0].subject, 'Temporal Anomaly Detected');
    assert.equal(branchB.after.byId[ANOMALY].metadata.decayLevel, 55, 'B does not lower decay on the anomaly record');
    assert.equal(branchB.after.byId[ANOMALY].metadata.reconstructionLevel, 45);
  });

  it('each branch changes at least two dependent records, and the per-record deltas differ', () => {
    const changedA = changedRecordIds(branchA.before, branchA.after);
    const changedB = changedRecordIds(branchB.before, branchB.after);
    assert.ok(changedA.length >= 2, `A changed ${changedA.length} records`);
    assert.ok(changedB.length >= 2, `B changed ${changedB.length} records`);
    const deltaA = Object.fromEntries(changedA.map((id) => [id, branchA.after.byId[id].metadata.decayLevel]));
    const deltaB = Object.fromEntries(changedB.map((id) => [id, branchB.after.byId[id].metadata.decayLevel]));
    assert.notDeepEqual(deltaA, deltaB, 'the consequences of A and B must not be identical');
    assert.notEqual(branchA.after.byId[ANOMALY].metadata.reconstructionLevel,
                    branchB.after.byId[ANOMALY].metadata.reconstructionLevel);
  });

  it('agent reactions are stored in game state and match the choice response', () => {
    for (const branch of [branchA, branchB]) {
      assert.deepEqual(branch.after.state.verticalSlice.agentReactions, branch.response.json.agentReactions);
    }
  });

  it('agent reactions reflect the chosen history for every agent', () => {
    for (const id of AGENT_IDS) {
      assert.notEqual(branchA.response.json.agentReactions[id], branchB.response.json.agentReactions[id],
        `${id} must react differently to A and B`);
    }
    assert.match(branchA.response.json.agentReactions.archivist, /confirm/);
    assert.match(branchB.response.json.agentReactions.archivist, /contradicts/);
  });

  it('replaying branch A in a fresh session reproduces the same outcome', () => {
    assert.deepEqual(outcomeFingerprint(branchAReplay), outcomeFingerprint(branchA));
  });
});

// ---------- second choice, refresh, restart and reset ----------

describe('choice lifecycle and persistence', () => {
  it('a second choice in the same game is rejected with 409 and does not change state', () => withServer(async (baseUrl) => {
    const first = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'A' });
    assert.equal(first.status, 200);
    const stateBefore = await snapshot(baseUrl);
    const second = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'B' });
    assert.equal(second.status, 409);
    const stateAfter = await snapshot(baseUrl);
    assert.deepEqual(stateAfter.state.verticalSlice, stateBefore.state.verticalSlice);
    assert.deepEqual(stateAfter.messages, stateBefore.messages);
  }));

  it('refreshing the page restores the same choice from the running server', () => withServer(async (baseUrl) => {
    const choice = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'B' });
    assert.equal(choice.status, 200);
    // A page reload re-fetches threads, messages and game state. Nothing is kept in the browser.
    const reloaded = await snapshot(baseUrl);
    const threads = await getJson(baseUrl, '/api/threads');
    assert.equal(reloaded.state.verticalSlice.choiceMade, 'B');
    assert.equal(reloaded.state.verticalSlice.authoritativeRecord, 'B');
    assert.deepEqual(reloaded.state.verticalSlice.agentReactions, choice.json.agentReactions);
    assert.equal(reloaded.byId[RECORD_B].recordStatus, 'authoritative');
    assert.ok(threads.some((t) => t.id === THREAD_ID));
  }));

  it('restarting the server does not restore the previous game (persistence is not supported)', async () => {
    const first = await startServer();
    try {
      const choice = await call(first.baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'A' });
      assert.equal(choice.status, 200);
    } finally {
      await first.stop();
    }
    const second = await startServer();
    try {
      const state = await getJson(second.baseUrl, '/api/game/state');
      assert.equal(state.verticalSlice.choiceMade, null, 'in-memory state is lost on restart by design');
    } finally {
      await second.stop();
    }
  });

  it('POST /api/game/reset restores all player-specific state and allows a new choice', () => withServer(async (baseUrl) => {
    await call(baseUrl, 'POST', '/api/game/action', { actionType: 'reconstruct_memory', targetId: RECORD_B });
    const chosen = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'A' });
    assert.equal(chosen.status, 200);
    const addedBeforeReset = (await getJson(baseUrl, `/api/threads/${THREAD_ID}`)).length;

    const reset = await call(baseUrl, 'POST', '/api/game/reset');
    assert.equal(reset.status, 200);
    assert.equal(reset.json.reset, true);

    const state = await getJson(baseUrl, '/api/game/state');
    assert.equal(state.credits, 1000);
    assert.equal(state.verticalSlice.choiceMade, null);
    assert.equal(state.verticalSlice.authoritativeRecord, null);

    const after = await snapshot(baseUrl);
    assert.equal(after.byId[RECORD_A].recordStatus, 'contested');
    assert.equal(after.byId[RECORD_B].recordStatus, 'contested');
    assert.equal(after.threadMessages.length, 4, 'reset restores the seeded archive');
    assert.ok(addedBeforeReset >= 4);

    const rechoose = await call(baseUrl, 'POST', `/api/threads/${THREAD_ID}/choice`, { choice: 'B' });
    assert.equal(rechoose.status, 200);
    assert.equal(rechoose.json.authoritativeRecord, 'B');
  }));
});
