// P3 "A Life in Fragments": level physics, restoration, save format and string parity.
// Pure logic only. Browser behaviour is covered by e2e/p3.spec.js.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const L = require('../frontend/p3/level.js');
const I = require('../frontend/p3/i18n.js');

const NONE = { left: false, right: false, jump: false };
const RIGHT = { left: false, right: true, jump: false };

// Runs frames with a fixed input list (or a function of frame index) and returns the final state and all events.
function run(state, frames, inputFor) {
  let s = state;
  const events = [];
  for (let i = 0; i < frames; i++) {
    const input = typeof inputFor === 'function' ? inputFor(i, s) : (inputFor || NONE);
    const r = L.step(s, input);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function withFlags(flags, extra) {
  const s = L.initialState();
  s.flags = Object.assign({ lab: false, archive: false }, flags);
  return Object.assign(s, extra || {});
}

describe('P3 grid', () => {
  it('starts with a missing-edge wall at column 20 that blocks the way', () => {
    const grid = L.gridFor({ lab: false, archive: false });
    for (let y = 0; y < 10; y++) {
      assert.equal(grid[y].charAt(20), 'x', `wall at row ${y}`);
    }
    assert.equal(grid[10].charAt(20), '.');
    assert.equal(grid[10].charAt(19), '#');
  });

  it('restoring the lab route clears the wall and adds the path ground', () => {
    const grid = L.gridFor({ lab: true, archive: false });
    assert.equal(grid[0].charAt(20), '.');
    assert.equal(grid[10].charAt(27), '#');
    assert.equal(grid[10].charAt(28), '.');
  });

  it('restoring the archive adds the ending with its door and end wall', () => {
    const grid = L.gridFor({ lab: true, archive: true });
    assert.equal(grid[9].charAt(37), 'E');
    assert.equal(grid[0].charAt(38), 'x');
    assert.equal(grid[9].charAt(34), 'H');
  });

  it('lists the five star cells in every source', () => {
    assert.deepEqual(L.starIds(), ['12,6', '17,3', '24,8', '26,6', '5,8']);
  });

  it('returns frozen grids so callers cannot change shared state', () => {
    assert.ok(Object.isFrozen(L.gridFor({ lab: false, archive: false })));
  });
});

describe('P3 physics', () => {
  it('stops at the missing-edge wall when walking right', () => {
    const { state } = run(L.initialState(), 400, RIGHT);
    assert.ok(state.x < 20, `x=${state.x}`);
    assert.ok(state.x > 19, `x=${state.x}`);
  });

  it('jumps to about 3.5 tiles above the ground', () => {
    let s = L.initialState();
    s.coyote = 6;
    s = run(s, 2).state;
    const jumped = L.step(s, { left: false, right: false, jump: true }).state;
    let minY = jumped.y;
    let cur = jumped;
    for (let i = 0; i < 90; i++) {
      cur = L.step(cur, NONE).state;
      minY = Math.min(minY, cur.y);
    }
    assert.ok(minY > 6.3 && minY < 6.7, `apex feet y=${minY}`);
  });

  it('lands on the first ledge after a running jump', () => {
    let s = withFlags({}, { x: 9.5, y: 10, coyote: 6 });
    s = L.step(s, { left: false, right: true, jump: true }).state;
    let onLedge = false;
    for (let i = 0; i < 120 && !onLedge; i++) {
      s = L.step(s, RIGHT).state;
      onLedge = s.onGround && Math.abs(s.y - 7) < 0.01 && s.x > 11;
    }
    assert.ok(onLedge, `ended at x=${s.x}, y=${s.y}`);
  });

  it('collects the hidden star above the high ledge', () => {
    let s = withFlags({}, { x: 17.5, y: 5, coyote: 6, lastSafe: { x: 17.5, y: 5 } });
    s = L.step(s, { left: false, right: false, jump: true }).state;
    const { state } = run(s, 60);
    assert.ok(state.collected.includes('17,3'), `collected=${state.collected}`);
  });

  it('collects a star and reports it once', () => {
    let s = withFlags({}, { x: 5.5, y: 10 });
    const { state, events } = run(s, 1, NONE);
    assert.equal(state.collected.length, 0);
    const starEvents = [];
    let cur = L.initialState();
    cur.x = 5.5;
    cur.y = 8;
    const r = L.step(cur, NONE);
    starEvents.push(...r.events);
    assert.equal(events.length, 0);
    assert.equal(starEvents.filter((e) => e.type === 'star').length, 1);
    const again = L.step(r.state, NONE);
    assert.equal(again.events.filter((e) => e.type === 'star').length, 0);
  });

  it('respawns on the last solid ground after falling into the void', () => {
    let s = withFlags({ lab: true, archive: false }, { x: 27.5, y: 10, lastSafe: { x: 27.5, y: 10 } });
    let fell = null;
    for (let i = 0; i < 300 && !fell; i++) {
      const r = L.step(s, RIGHT);
      s = r.state;
      if (r.events.some((e) => e.type === 'fall')) {
        fell = s;
      }
    }
    assert.ok(fell, 'the player should fall past the end of the lab ground');
    assert.equal(fell.deaths, 1);
    assert.equal(fell.x, 27.5);
    assert.equal(fell.y, 10);
  });

  it('does not treat a toe over an edge as safe ground', () => {
    let s = withFlags({ lab: true, archive: false }, { x: 27.5, y: 10 });
    s = run(s, 30, RIGHT).state;
    assert.ok(s.lastSafe.x < 28, `lastSafe x=${s.lastSafe.x}`);
  });

  it('is deterministic: identical inputs give identical states', () => {
    const script = (i) => ({ left: i % 90 < 20, right: i % 90 >= 40 && i % 90 < 80, jump: i % 90 === 45 });
    const a = run(L.initialState(), 600, script).state;
    const b = run(L.initialState(), 600, script).state;
    assert.deepEqual(a, b);
  });
});

describe('P3 restoration', () => {
  it('lets the player pass the wall after the lab restore', () => {
    const r = L.restore(L.initialState(), 'lab');
    assert.equal(r.ok, true);
    const { state } = run(r.state, 400, RIGHT);
    assert.ok(state.x > 26, `x=${state.x}`);
  });

  it('refuses the archive before the lab route is back', () => {
    const r = L.restore(L.initialState(), 'archive');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'needs-lab');
    assert.equal(r.state.flags.archive, false);
  });

  it('completes the level at the door once both restores are done', () => {
    let s = L.restore(L.restore(L.initialState(), 'lab').state, 'archive').state;
    s.x = 30.5;
    s.y = 10;
    const { state, events } = run(s, 500, RIGHT);
    assert.equal(state.phase, 'complete');
    assert.ok(events.some((e) => e.type === 'door'));
  });

  it('does not change state when the same source is restored twice', () => {
    const once = L.restore(L.initialState(), 'lab');
    const twice = L.restore(once.state, 'lab');
    assert.equal(twice.ok, true);
    assert.deepEqual(twice.state.flags, { lab: true, archive: false });
  });

  it('rejects unknown sources', () => {
    assert.equal(L.restore(L.initialState(), 'mainframe').ok, false);
  });

  it('grows the island from flags and the hidden star', () => {
    let s = L.restore(L.initialState(), 'lab').state;
    assert.deepEqual(L.islandElements(s), ['tree']);
    s = L.restore(s, 'archive').state;
    s.collected = ['17,3'];
    s.phase = 'complete';
    assert.deepEqual(L.islandElements(s), ['tree', 'house', 'memory', 'console']);
  });
});

describe('P3 save format', () => {
  it('round-trips flags, collected stars and position', () => {
    let s = L.restore(L.initialState(), 'lab').state;
    s.collected = ['5,8', '17,3'];
    s.seenSigns = ['2,9'];
    s.x = 12.5;
    s.y = 10;
    const parsed = L.parse(JSON.parse(JSON.stringify(L.serialize(s))));
    assert.deepEqual(parsed.flags, s.flags);
    assert.deepEqual(parsed.collected, ['17,3', '5,8']);
    assert.equal(parsed.x, 12.5);
    assert.equal(parsed.phase, 'playing');
  });

  it('rejects other save versions and malformed flags', () => {
    assert.equal(L.parse(null), null);
    assert.equal(L.parse({ v: 2, flags: { lab: false, archive: false }, phase: 'playing' }), null);
    assert.equal(L.parse({ v: 1, flags: { lab: 'yes', archive: false }, phase: 'playing' }), null);
    assert.equal(L.parse({ v: 1, flags: { lab: false, archive: false }, phase: 'paused' }), null);
  });

  it('drops star ids that do not exist in the level', () => {
    const parsed = L.parse({ v: 1, flags: { lab: false, archive: false }, phase: 'playing', collected: ['99,99', '5,8'] });
    assert.deepEqual(parsed.collected, ['5,8']);
  });

  it('moves a saved position that sits inside the wall back to safe ground', () => {
    const parsed = L.parse({
      v: 1,
      flags: { lab: false, archive: false },
      phase: 'playing',
      x: 20.2,
      y: 8,
      lastSafe: { x: 3, y: 10 }
    });
    assert.equal(parsed.x, 3);
    assert.equal(parsed.y, 10);
  });
});

describe('P3 strings', () => {
  it('has the same keys in English and Chinese', () => {
    assert.deepEqual(I.keysOf(I.dictionaries.en), I.keysOf(I.dictionaries.zh));
  });

  it('keeps placeholders identical in both languages', () => {
    const keys = I.keysOf(I.dictionaries.en);
    keys.forEach((k) => {
      const a = (I.dictionaries.en[k].match(/\{\w+\}/g) || []).sort().join();
      const b = (I.dictionaries.zh[k].match(/\{\w+\}/g) || []).sort().join();
      assert.equal(a, b, `placeholders differ for ${k}`);
    });
  });

  it('has no empty strings', () => {
    ['en', 'zh'].forEach((lang) => {
      Object.keys(I.dictionaries[lang]).forEach((k) => {
        assert.ok(I.dictionaries[lang][k].trim().length > 0, `${lang}.${k} is empty`);
      });
    });
  });

  it('uses the developer note wording in Chinese', () => {
    assert.match(I.dictionaries.zh.noteJoke, /如果有人真的玩到了这里，说明我的游戏至少没有烂到没人通关。/);
  });

  it('falls back to English for an unknown language and returns the key for a missing key', () => {
    assert.equal(I.t('fr', 'start'), I.dictionaries.en.start);
    assert.equal(I.t('en', 'noSuchKey'), 'noSuchKey');
  });
});

describe('P3 determinism guards', () => {
  it('level logic never uses Math.random or Date', () => {
    const src = fs.readFileSync(path.join(__dirname, '../frontend/p3/level.js'), 'utf8');
    assert.doesNotMatch(src, /Math\.random/);
    assert.doesNotMatch(src, /Date\.now|new Date/);
  });
});
