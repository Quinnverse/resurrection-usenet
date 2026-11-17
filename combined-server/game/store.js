// Server-side session persistence.
// - One JSON file per session, written atomically (temp file + rename), mode 0600, directory mode 0700.
// - Session IDs are 256-bit CSPRNG values (64 hex characters). They are the only credential: possession = access.
//   Anything else is rejected before the filesystem is touched.
// - Retention: sessions expire after 7 days without activity. Cleanup runs at startup and every 24 hours.
// - Size limit: a save larger than 256 KB is refused and the previous save is kept.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { GameError } = require('./engine');

const ID_PATTERN = /^[a-f0-9]{64}$/;
const FILE_PATTERN = /^[a-f0-9]{64}\.json$/;
const TEMP_PATTERN = /^[a-f0-9]{64}\.json\..*\.tmp$/;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 7 * DAY_MS;
const CLEANUP_INTERVAL_MS = DAY_MS;
const ORPHAN_TEMP_MS = 60 * 60 * 1000;
const MAX_SESSION_BYTES = 256 * 1024;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function createStore(dataDir, { now = () => Date.now() } = {}) {
  fs.mkdirSync(dataDir, { recursive: true, mode: DIR_MODE });
  fs.chmodSync(dataDir, DIR_MODE);
  const fileFor = (id) => path.join(dataDir, `${id}.json`);

  function lastActivityMs(session, file) {
    const parsed = Date.parse(session && session.lastActiveAt);
    return Number.isNaN(parsed) ? fs.statSync(file).mtimeMs : parsed;
  }

  return {
    isValidId: (id) => typeof id === 'string' && ID_PATTERN.test(id),
    newId: () => crypto.randomBytes(32).toString('hex'),
    retentionMs: RETENTION_MS,
    maxSessionBytes: MAX_SESSION_BYTES,

    load(id) {
      if (!ID_PATTERN.test(id)) return null;
      try {
        return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },

    // Activity is recorded on every save, so a session's age is measured from its last write.
    save(session) {
      session.lastActiveAt = new Date(now()).toISOString();
      const body = JSON.stringify(session);
      if (Buffer.byteLength(body) > MAX_SESSION_BYTES) {
        throw new GameError(413, 'session_too_large', 'This save has reached its size limit. Start a new game to continue.');
      }
      const target = fileFor(session.sessionId);
      const temp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(temp, body, { mode: FILE_MODE, flag: 'wx' });
      fs.chmodSync(temp, FILE_MODE);
      fs.renameSync(temp, target);
    },

    // Counts saves and bytes on disk, for the public-demo capacity limit. Returns totals only.
    stats() {
      let sessions = 0;
      let bytes = 0;
      for (const name of fs.readdirSync(dataDir)) {
        if (!FILE_PATTERN.test(name)) continue;
        sessions += 1;
        bytes += fs.statSync(path.join(dataDir, name)).size;
      }
      return { sessions, bytes };
    },

    isExpired(session) {
      const last = Date.parse(session.lastActiveAt);
      return Number.isNaN(last) || now() - last > RETENTION_MS;
    },

    remove(id) {
      if (!ID_PATTERN.test(id)) return false;
      try {
        fs.unlinkSync(fileFor(id));
        return true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return false;
      }
    },

    // Deletes saves inactive for more than the retention period, and orphaned temp files from crashed writes.
    // Returns counts only, never identifiers.
    cleanupExpired() {
      let expired = 0;
      let orphans = 0;
      for (const name of fs.readdirSync(dataDir)) {
        const file = path.join(dataDir, name);
        if (FILE_PATTERN.test(name)) {
          let session = null;
          try { session = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { session = null; }
          if (now() - lastActivityMs(session, file) > RETENTION_MS) {
            fs.unlinkSync(file);
            expired += 1;
          }
        } else if (TEMP_PATTERN.test(name)) {
          if (now() - fs.statSync(file).mtimeMs > ORPHAN_TEMP_MS) {
            fs.unlinkSync(file);
            orphans += 1;
          }
        }
      }
      return { expired, orphans };
    }
  };
}

// Runs cleanup on a fixed interval. The timer is unref'd so it never keeps the process alive by itself.
function scheduleRetention(store, { intervalMs = CLEANUP_INTERVAL_MS, timer = setInterval, onRun = () => {} } = {}) {
  const handle = timer(() => onRun(store.cleanupExpired()), intervalMs);
  if (handle && typeof handle.unref === 'function') handle.unref();
  return handle;
}

module.exports = {
  createStore, scheduleRetention,
  ID_PATTERN, RETENTION_MS, CLEANUP_INTERVAL_MS, MAX_SESSION_BYTES
};
