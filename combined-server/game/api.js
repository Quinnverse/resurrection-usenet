// HTTP contract adapter for /api/sessions (PUZZLE-STATE-SPEC §6). Thin layer over engine.js and store.js.
// Returns { status, body } for the server to send, or null when the path is not a session route.

const engine = require('./engine');
const { GameError } = engine;

const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PAYLOAD_KEYS = 8;

function createSessionApi({ store, now = () => new Date().toISOString() }) {
  // Malformed, unknown and expired IDs all get the same response, so IDs cannot be probed for existence.
  const notFound = () => new GameError(404, 'session_not_found', 'No session with that ID.');
  const TOUCH_INTERVAL_MS = 60 * 1000;

  function loadOr404(id) {
    if (!store.isValidId(id)) throw notFound();
    const session = store.load(id);
    if (!session) throw notFound();
    if (store.isExpired(session)) {
      store.remove(id);
      throw notFound();
    }
    // Record activity at most once a minute so reads do not rewrite the file on every request.
    if (Date.parse(now()) - Date.parse(session.lastActiveAt) > TOUCH_INTERVAL_MS) store.save(session);
    return session;
  }

  function createSession() {
    const id = store.newId();
    const session = engine.newSession({ sessionId: id, now: now() });
    store.save(session);
    const view = engine.projection(session);
    return { status: 201, body: { sessionId: id, revision: session.revision, sceneId: view.sceneId, state: view } };
  }

  function validateAction(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new GameError(400, 'invalid_body', 'Request body must be a JSON object.');
    }
    const { actionId, expectedRevision, type, payload, preview } = body;
    if (typeof actionId !== 'string' || !ACTION_ID_PATTERN.test(actionId)) {
      throw new GameError(400, 'invalid_action_id', 'actionId must be 1–64 characters: letters, digits, _ or -.');
    }
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new GameError(400, 'invalid_revision', 'expectedRevision must be a non-negative integer.');
    }
    if (typeof type !== 'string' || !engine.ACTION_TYPES.has(type)) {
      throw new GameError(400, 'unknown_action_type', 'Unknown action type.');
    }
    if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
      throw new GameError(400, 'invalid_payload', 'payload must be an object.');
    }
    if (payload && Object.keys(payload).length > MAX_PAYLOAD_KEYS) {
      throw new GameError(400, 'invalid_payload', 'payload has too many keys.');
    }
    return { actionId, expectedRevision, action: { actionId, type, payload: payload ?? {} }, preview: preview === true };
  }

  function postAction(id, body) {
    const session = loadOr404(id);
    const { actionId, expectedRevision, action, preview } = validateAction(body);

    if (preview) {
      if (expectedRevision !== session.revision) {
        throw new GameError(409, 'stale_revision', 'The session changed. Refresh before previewing.', { currentRevision: session.revision });
      }
      return { status: 200, body: engine.previewAction(session, action) };
    }

    // A repeated actionId returns the stored result without re-checking the revision (idempotent retry).
    if (!session.actionResults[actionId] && expectedRevision !== session.revision) {
      throw new GameError(409, 'stale_revision', 'The session changed since this action was prepared.', { currentRevision: session.revision });
    }

    const outcome = engine.applyAction(session, action, { now: now() });
    if (!outcome.replayed) store.save(outcome.session);
    return { status: 200, body: outcome.result };
  }

  function threadsFor(session) {
    const view = engine.projection(session);
    const records = view.visibleRecords;
    return [{
      id: 'alt.memory.1998',
      subject: 'alt.memory.1998 — incident reports',
      unreadCount: records.filter(r => r.status === 'current' || r.status === 'pending').length,
      lastMessageAt: records.length ? records[records.length - 1].headers.timestamp : null
    }];
  }

  function threadMessages(session, threadId) {
    if (threadId !== 'alt.memory.1998') throw new GameError(404, 'thread_not_found', 'No thread with that ID.');
    return engine.projection(session).visibleRecords.map(r => ({
      id: r.id,
      subject: r.subject,
      from: r.from,
      content: r.body,
      sourceNode: r.sourceNode,
      headers: r.headers,
      replicaVersion: r.replicaVersion,
      decayLevel: r.decayLevel,
      status: r.status
    }));
  }

  function reset(id, body) {
    const session = loadOr404(id);
    if (!body || body.confirm !== 'RESET') {
      throw new GameError(400, 'confirmation_required', 'Send {"confirm":"RESET"} to start a new game.');
    }
    const freshId = store.newId();
    const fresh = engine.newSession({ sessionId: freshId, now: now() });
    store.save(fresh);
    store.remove(session.sessionId);
    const view = engine.projection(fresh);
    return { status: 201, body: { sessionId: freshId, revision: 0, sceneId: view.sceneId, state: view } };
  }

  // Returns { status, body } for session routes, or null for any other path.
  async function handle({ method, pathname, readBody }) {
    if (!pathname.startsWith('/api/sessions')) return null;
    const parts = pathname.split('/').filter(Boolean); // ['api','sessions', id?, sub?, subId?]

    try {
      if (parts.length === 2 && method === 'POST') return createSession();

      const id = parts[2];
      if (parts.length === 3 && method === 'GET') {
        return { status: 200, body: engine.projection(loadOr404(id)) };
      }
      // Deleting a save: the session ID in the path is the credential.
      if (parts.length === 3 && method === 'DELETE') {
        const session = loadOr404(id);
        store.remove(session.sessionId);
        return { status: 200, body: { deleted: true } };
      }
      if (parts.length === 4 && parts[3] === 'threads' && method === 'GET') {
        return { status: 200, body: threadsFor(loadOr404(id)) };
      }
      if (parts.length === 5 && parts[3] === 'threads' && method === 'GET') {
        return { status: 200, body: threadMessages(loadOr404(id), decodeURIComponent(parts[4])) };
      }
      if (parts.length === 4 && parts[3] === 'actions' && method === 'POST') {
        return postAction(id, await readBody());
      }
      if (parts.length === 4 && parts[3] === 'events' && method === 'GET') {
        const session = loadOr404(id);
        return { status: 200, body: { playerEvents: session.playerEvents, propagationEvents: session.propagationEvents, conflictLog: session.conflictLog } };
      }
      if (parts.length === 4 && parts[3] === 'reset' && method === 'POST') {
        return reset(id, await readBody());
      }
      return { status: 404, body: { error: 'Not found', code: 'not_found' } };
    } catch (error) {
      if (error instanceof GameError) {
        return { status: error.status, body: { error: error.message, code: error.code, ...error.extra } };
      }
      throw error;
    }
  }

  return { handle };
}

module.exports = { createSessionApi };
