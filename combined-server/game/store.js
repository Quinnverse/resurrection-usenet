// Server-side session persistence. One JSON file per session, written atomically (temp file + rename).
// Session IDs are random 128-bit hex strings; anything else is rejected before touching the filesystem.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_PATTERN = /^[a-f0-9]{32}$/;

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const fileFor = (id) => path.join(dataDir, `${id}.json`);

  return {
    dataDir,
    isValidId: (id) => typeof id === 'string' && ID_PATTERN.test(id),
    newId: () => crypto.randomBytes(16).toString('hex'),

    load(id) {
      if (!ID_PATTERN.test(id)) return null;
      try {
        return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },

    save(session) {
      const target = fileFor(session.sessionId);
      const temp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(session));
      fs.renameSync(temp, target);
    },

    remove(id) {
      if (!ID_PATTERN.test(id)) return;
      try {
        fs.unlinkSync(fileFor(id));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  };
}

module.exports = { createStore };
