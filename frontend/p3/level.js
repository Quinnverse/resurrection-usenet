/*
 * P3 "A Life in Fragments" level logic.
 *
 * Pure UMD module: no DOM access, no random numbers, fixed-step physics so that the same
 * inputs always produce the same state. The browser loads it with a <script> tag and
 * exposes window.P3Level. Node tests load it with require().
 *
 * Grid cells (grid = 12 rows of 40 characters, row 0 at the top, col 0 at the left):
 *   '.' empty          '#' ground (solid)        'x' missing-edge / end wall (solid)
 *   'L' ledge (solid)  '*' star                  'h' hidden star
 *   's' sign           'E' door (ends the level) 'H' house (scenery, not solid)
 *
 * Restoration: the local copy starts with a wall at column 20. Restoring the "lab" source copies
 * columns 20-27 (the path) from the lab server, which clears the wall. Restoring the "archive"
 * source copies columns 28-38 (the ending) and needs the lab route first.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.P3Level = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TILE = 32;
  var W = 40;
  var H = 12;

  // Player box in tiles. Feet are at (x, y); the box spans x +/- PW/2 and y - PH to y.
  var PW = 0.6;
  var PH = 1.0;

  var DT = 1 / 60;           // fixed simulation step (seconds)
  var MOVE_SPEED = 6;        // tiles per second
  var GRAVITY = 40;          // tiles per second squared
  var MAX_FALL = 24;         // tiles per second
  var JUMP_SPEED = 16.73;    // apex about 3.5 tiles above the takeoff point
  var COYOTE_FRAMES = 6;     // frames a jump is still allowed after leaving a ledge
  var JUMP_BUFFER_FRAMES = 6; // frames a jump press is remembered before landing
  var SUB_STEP = 0.05;       // collision sub-step in tiles, avoids tunnelling

  var SAVE_VERSION = 1;
  var SPAWN = { x: 2.5, y: 10 };

  var SOLID = { '#': true, 'x': true, 'L': true };
  var STAR = { '*': 'star', 'h': 'hidden' };

  var SEGMENTS = {
    lab: { from: 20, to: 27 },
    archive: { from: 28, to: 38 }
  };

  // ---- grid construction -------------------------------------------------------------

  function blankRows() {
    var rows = [];
    for (var y = 0; y < H; y++) {
      rows.push(new Array(W + 1).join('.'));
    }
    return rows;
  }

  function paint(rows, x, y, ch) {
    if (x < 0 || x >= W || y < 0 || y >= H) {
      return;
    }
    rows[y] = rows[y].substring(0, x) + ch + rows[y].substring(x + 1);
  }

  function fillRect(rows, x1, y1, x2, y2, ch) {
    for (var y = y1; y <= y2; y++) {
      for (var x = x1; x <= x2; x++) {
        paint(rows, x, y, ch);
      }
    }
  }

  function cellOf(rows, x, y) {
    return rows[y].charAt(x);
  }

  // Shared start area: ground, first ledges, two stars, the sign, the hidden star and the wall.
  function placeStart(rows) {
    fillRect(rows, 0, 10, 19, 11, '#');
    fillRect(rows, 11, 7, 14, 7, 'L');
    fillRect(rows, 16, 5, 18, 5, 'L');
    paint(rows, 5, 8, '*');
    paint(rows, 12, 6, '*');
    paint(rows, 17, 3, 'h');
    paint(rows, 2, 9, 's');
  }

  // The local copy of the game as the player first sees it: the mini-game ends at column 20.
  function localBase() {
    var rows = blankRows();
    placeStart(rows);
    fillRect(rows, 20, 0, 20, 9, 'x');
    return rows;
  }

  // Server "lab" (source A): the complete path, no ending and no wall.
  function labGrid() {
    var rows = blankRows();
    placeStart(rows);
    fillRect(rows, 20, 10, 27, 11, '#');
    paint(rows, 24, 8, '*');
    paint(rows, 26, 6, '*');
    return rows;
  }

  // Server "archive" (source B): the ending segment, with the door and the end wall.
  function archiveGrid() {
    var rows = blankRows();
    fillRect(rows, 28, 10, 38, 11, '#');
    fillRect(rows, 33, 6, 35, 9, 'H');
    fillRect(rows, 38, 0, 38, 9, 'x');
    paint(rows, 37, 9, 'E');
    return rows;
  }

  var SOURCES = {
    lab: Object.freeze(labGrid()),
    archive: Object.freeze(archiveGrid())
  };

  var gridCache = {};

  // Returns the grid for a set of restore flags. The result is shared, so callers must not mutate it.
  function gridFor(flags) {
    var lab = !!(flags && flags.lab);
    var archive = !!(flags && flags.archive);
    var key = (lab ? 'L' : '-') + (archive ? 'A' : '-');
    if (gridCache[key]) {
      return gridCache[key];
    }
    var rows = localBase();
    if (lab) {
      copySegment(rows, SOURCES.lab, SEGMENTS.lab);
    }
    if (archive) {
      copySegment(rows, SOURCES.archive, SEGMENTS.archive);
    }
    gridCache[key] = Object.freeze(rows);
    return gridCache[key];
  }

  function copySegment(dst, src, seg) {
    for (var y = 0; y < H; y++) {
      for (var x = seg.from; x <= seg.to; x++) {
        paint(dst, x, y, cellOf(src, x, y));
      }
    }
  }

  // All star cell ids in every source, e.g. "5,8". Used to validate saved collections.
  function starIds() {
    var ids = [];
    [localBase(), SOURCES.lab, SOURCES.archive].forEach(function (rows) {
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          if (STAR[cellOf(rows, x, y)]) {
            var id = x + ',' + y;
            if (ids.indexOf(id) < 0) {
              ids.push(id);
            }
          }
        }
      }
    });
    return ids.sort();
  }

  // ---- state -------------------------------------------------------------------------

  function initialState() {
    return {
      phase: 'playing',               // 'playing' | 'complete'
      x: SPAWN.x,
      y: SPAWN.y,
      vx: 0,
      vy: 0,
      onGround: true,
      coyote: 0,
      jumpBuffer: 0,
      lastSafe: { x: SPAWN.x, y: SPAWN.y },
      flags: { lab: false, archive: false },
      collected: [],                  // star ids already picked up
      seenSigns: [],                  // sign ids already read
      deaths: 0
    };
  }

  function cloneState(s) {
    return {
      phase: s.phase,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      onGround: s.onGround,
      coyote: s.coyote,
      jumpBuffer: s.jumpBuffer,
      lastSafe: { x: s.lastSafe.x, y: s.lastSafe.y },
      flags: { lab: s.flags.lab, archive: s.flags.archive },
      collected: s.collected.slice(),
      seenSigns: s.seenSigns.slice(),
      deaths: s.deaths
    };
  }

  // ---- collision ---------------------------------------------------------------------

  // Map edges are solid on the sides and open above and below. Falling below the map is the void.
  function cellSolid(rows, col, row) {
    if (col < 0 || col >= W) {
      return true;
    }
    if (row < 0 || row >= H) {
      return false;
    }
    return !!SOLID[cellOf(rows, col, row)];
  }

  function boxHits(rows, x, y) {
    var left = x - PW / 2;
    var right = x + PW / 2;
    var top = y - PH;
    var bottom = y;
    for (var r = Math.floor(top); r <= Math.floor(bottom - 1e-9); r++) {
      for (var c = Math.floor(left); c <= Math.floor(right - 1e-9); c++) {
        if (cellSolid(rows, c, r)) {
          return true;
        }
      }
    }
    return false;
  }

  // Moves the box by (dx, dy) in small steps. Returns true when a solid tile stopped it.
  function moveBox(rows, p, dx, dy) {
    var dist = Math.max(Math.abs(dx), Math.abs(dy));
    var steps = Math.ceil(dist / SUB_STEP);
    if (steps === 0) {
      return false;
    }
    var sx = dx / steps;
    var sy = dy / steps;
    for (var i = 0; i < steps; i++) {
      var nx = p.x + sx;
      var ny = p.y + sy;
      if (boxHits(rows, nx, ny)) {
        return true;
      }
      p.x = nx;
      p.y = ny;
    }
    return false;
  }

  // ---- simulation --------------------------------------------------------------------

  // input: { left, right, jump } where jump is true only on the frame the jump was pressed.
  // Returns { state, events } and never mutates the given state.
  function step(state, input) {
    var s = cloneState(state);
    var events = [];
    if (s.phase !== 'playing') {
      return { state: s, events: events };
    }
    var rows = gridFor(s.flags);
    var keys = input || {};

    // Horizontal velocity comes directly from input.
    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    s.vx = dir * MOVE_SPEED;

    // Jump: a press is buffered, and jumping is allowed for a few frames after leaving a ledge.
    if (keys.jump) {
      s.jumpBuffer = JUMP_BUFFER_FRAMES;
    } else if (s.jumpBuffer > 0) {
      s.jumpBuffer -= 1;
    }
    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vy = -JUMP_SPEED;
      s.jumpBuffer = 0;
      s.coyote = 0;
      s.onGround = false;
    }

    s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * DT);

    var p = { x: s.x, y: s.y };
    if (moveBox(rows, p, s.vx * DT, 0)) {
      s.vx = 0;
    }
    if (moveBox(rows, p, 0, s.vy * DT)) {
      s.vy = 0;
    }
    s.onGround = boxHits(rows, p.x, p.y + 0.1);
    s.coyote = s.onGround ? COYOTE_FRAMES : Math.max(0, s.coyote - 1);
    // Only stand-on-solid positions count as safe. A toe over an edge would respawn the player on the overhang.
    if (s.onGround && cellSolid(rows, Math.floor(p.x), Math.round(p.y))) {
      s.lastSafe = { x: p.x, y: p.y };
    }

    // Falling below the map returns the player to the last solid ground.
    if (p.y > H + 1) {
      // Respawn at the centre of the last solid tile, so the player is not placed on an edge.
      p = { x: Math.floor(s.lastSafe.x) + 0.5, y: s.lastSafe.y };
      s.vx = 0;
      s.vy = 0;
      s.onGround = true;
      s.coyote = COYOTE_FRAMES;
      s.deaths += 1;
      events.push({ type: 'fall' });
    }

    s.x = p.x;
    s.y = p.y;
    collectOverlaps(s, rows, events);
    return { state: s, events: events };
  }

  // Pickups, signs and the door, checked against every tile the player box overlaps.
  function collectOverlaps(s, rows, events) {
    var left = s.x - PW / 2;
    var right = s.x + PW / 2;
    var top = s.y - PH;
    var bottom = s.y;
    for (var r = Math.floor(top); r <= Math.floor(bottom - 1e-9); r++) {
      for (var c = Math.floor(left); c <= Math.floor(right - 1e-9); c++) {
        if (r < 0 || r >= H || c < 0 || c >= W) {
          continue;
        }
        var ch = cellOf(rows, c, r);
        var id = c + ',' + r;
        if (STAR[ch] && s.collected.indexOf(id) < 0) {
          s.collected.push(id);
          events.push({ type: 'star', id: id, hidden: STAR[ch] === 'hidden' });
        } else if (ch === 's' && s.seenSigns.indexOf(id) < 0) {
          s.seenSigns.push(id);
          events.push({ type: 'sign', id: id });
        } else if (ch === 'E' && s.phase === 'playing') {
          s.phase = 'complete';
          events.push({ type: 'door', id: id });
        }
      }
    }
  }

  // ---- restoration -------------------------------------------------------------------

  function canRestore(state, source) {
    if (source === 'lab') {
      return true;
    }
    if (source === 'archive') {
      return !!state.flags.lab;
    }
    return false;
  }

  // Returns { state, ok, reason }. Restoring an already restored source is a no-op that still succeeds.
  function restore(state, source) {
    if (source !== 'lab' && source !== 'archive') {
      return { state: state, ok: false, reason: 'unknown-source' };
    }
    if (!canRestore(state, source)) {
      return { state: state, ok: false, reason: 'needs-lab' };
    }
    var s = cloneState(state);
    s.flags[source] = true;
    return { state: s, ok: true, reason: null };
  }

  // Which island elements exist. Derived from flags and collected stars, never stored separately.
  function islandElements(state) {
    var out = [];
    if (state.flags.lab) {
      out.push('tree');
    }
    if (state.flags.archive) {
      out.push('house');
    }
    if (state.collected.indexOf('17,3') >= 0) {
      out.push('memory');
    }
    if (state.phase === 'complete') {
      out.push('console');
    }
    return out;
  }

  // ---- save format -------------------------------------------------------------------

  function serialize(state) {
    return {
      v: SAVE_VERSION,
      phase: state.phase,
      x: Math.round(state.x * 100) / 100,
      y: Math.round(state.y * 100) / 100,
      lastSafe: { x: state.lastSafe.x, y: state.lastSafe.y },
      flags: { lab: !!state.flags.lab, archive: !!state.flags.archive },
      collected: state.collected.slice().sort(),
      seenSigns: state.seenSigns.slice().sort(),
      deaths: state.deaths
    };
  }

  function isNumber(n) {
    return typeof n === 'number' && isFinite(n);
  }

  // Returns a playable state, or null when the saved object is not a valid version 1 save.
  function parse(obj) {
    if (!obj || typeof obj !== 'object' || obj.v !== SAVE_VERSION) {
      return null;
    }
    if (!obj.flags || typeof obj.flags.lab !== 'boolean' || typeof obj.flags.archive !== 'boolean') {
      return null;
    }
    if (obj.phase !== 'playing' && obj.phase !== 'complete') {
      return null;
    }
    var known = starIds();
    var s = initialState();
    s.phase = obj.phase;
    s.flags = { lab: obj.flags.lab, archive: obj.flags.archive };
    s.collected = Array.isArray(obj.collected)
      ? obj.collected.filter(function (id) { return known.indexOf(id) >= 0; })
      : [];
    s.seenSigns = Array.isArray(obj.seenSigns)
      ? obj.seenSigns.filter(function (id) { return typeof id === 'string' && id.length < 12; })
      : [];
    s.deaths = isNumber(obj.deaths) && obj.deaths >= 0 ? Math.floor(obj.deaths) : 0;

    var safe = obj.lastSafe;
    if (safe && isNumber(safe.x) && isNumber(safe.y) && safe.x >= 0 && safe.x < W && safe.y >= 0 && safe.y < H) {
      s.lastSafe = { x: safe.x, y: safe.y };
    }
    if (isNumber(obj.x) && isNumber(obj.y) && obj.x >= 0 && obj.x < W && obj.y >= 0 && obj.y < H) {
      s.x = obj.x;
      s.y = obj.y;
    }
    // A saved position inside solid tiles (for example past the wall before its restore) falls back to the last safe ground.
    if (boxHits(gridFor(s.flags), s.x, s.y)) {
      s.x = s.lastSafe.x;
      s.y = s.lastSafe.y;
    }
    s.onGround = false;
    return s;
  }

  return {
    TILE: TILE,
    W: W,
    H: H,
    PW: PW,
    PH: PH,
    DT: DT,
    SAVE_VERSION: SAVE_VERSION,
    SPAWN: SPAWN,
    SEGMENTS: SEGMENTS,
    localBase: localBase,
    labGrid: labGrid,
    archiveGrid: archiveGrid,
    gridFor: gridFor,
    starIds: starIds,
    initialState: initialState,
    step: step,
    canRestore: canRestore,
    restore: restore,
    islandElements: islandElements,
    serialize: serialize,
    parse: parse
  };
});
