/*
 * P3.2 memory restoration puzzle. Pure data and rules: no DOM, no clock, no random numbers.
 *
 * The broken bridge needs three fragments (slots s1, s2, s3, left to right). The world is "build 3".
 * Three server copies each remember the bridge differently:
 *   mirror   build 2 (Mar 1998)  a COMPLETE bridge, but an old draft, so every piece is the wrong build
 *   archive  build 3 (Aug 1998)  the left and right ends are intact, the middle is corrupted
 *   lab      build 3 (Aug 1998)  a clean middle, plus an arched middle that is the wrong shape
 * The player can carry 4 fragments, so taking everything is impossible and each copy has to be read.
 * A fragment fits a slot only when its build, integrity, width and profile all match, checked in that order.
 * UMD: window.P3Puzzle in the browser, module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Puzzle = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORLD_BUILD = 3;
  var BACKPACK_SIZE = 4;

  // profile: height of each column above the bridge base line, in tiles (0 = flat, 1 = one tile higher).
  var SLOTS = [
    { id: 's1', col: 62, w: 3, profile: [0, 0, 0] },
    { id: 's2', col: 65, w: 4, profile: [0, 0, 0, 0] },
    { id: 's3', col: 69, w: 3, profile: [0, 0, 1] }
  ];
  var BRIDGE_ROW = 10;       // map row of the flat part of the bridge

  var PIECES = {
    'm-left':  { id: 'm-left',  copy: 'mirror',  build: 2, w: 3, profile: [0, 0, 0],    corrupt: false },
    'm-mid':   { id: 'm-mid',   copy: 'mirror',  build: 2, w: 4, profile: [0, 0, 0, 0], corrupt: false },
    'm-right': { id: 'm-right', copy: 'mirror',  build: 2, w: 3, profile: [0, 0, 1],    corrupt: false },
    'a-left':  { id: 'a-left',  copy: 'archive', build: 3, w: 3, profile: [0, 0, 0],    corrupt: false },
    'a-mid':   { id: 'a-mid',   copy: 'archive', build: 3, w: 4, profile: [0, 0, 0, 0], corrupt: true },
    'a-right': { id: 'a-right', copy: 'archive', build: 3, w: 3, profile: [0, 0, 1],    corrupt: false },
    'l-mid':   { id: 'l-mid',   copy: 'lab',     build: 3, w: 4, profile: [0, 0, 0, 0], corrupt: false },
    'l-arch':  { id: 'l-arch',  copy: 'lab',     build: 3, w: 4, profile: [0, 1, 1, 0], corrupt: false }
  };

  var COPIES = {
    mirror:  { id: 'mirror',  build: 2, month: 3, pieces: ['m-left', 'm-mid', 'm-right'] },
    archive: { id: 'archive', build: 3, month: 8, pieces: ['a-left', 'a-mid', 'a-right'] },
    lab:     { id: 'lab',     build: 3, month: 8, pieces: ['l-mid', 'l-arch'] }
  };

  function slotById(id) {
    for (var i = 0; i < SLOTS.length; i++) { if (SLOTS[i].id === id) { return SLOTS[i]; } }
    return null;
  }

  function sameProfile(a, b) {
    if (a.length !== b.length) { return false; }
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) { return false; } }
    return true;
  }

  // Returns { ok: true } or { ok: false, reason } where reason is build | corrupt | width | shape.
  function check(pieceId, slotId) {
    var piece = PIECES[pieceId];
    var slot = slotById(slotId);
    if (!piece || !slot) { return { ok: false, reason: 'unknown' }; }
    if (piece.build !== WORLD_BUILD) { return { ok: false, reason: 'build' }; }
    if (piece.corrupt) { return { ok: false, reason: 'corrupt' }; }
    if (piece.w !== slot.w) { return { ok: false, reason: 'width' }; }
    if (!sameProfile(piece.profile, slot.profile)) { return { ok: false, reason: 'shape' }; }
    return { ok: true };
  }

  // Backpack rules. All three functions return a new array and never exceed BACKPACK_SIZE.
  function take(backpack, pieceId) {
    if (!PIECES[pieceId] || backpack.indexOf(pieceId) >= 0) { return { ok: false, backpack: backpack, reason: 'invalid' }; }
    if (backpack.length >= BACKPACK_SIZE) { return { ok: false, backpack: backpack, reason: 'full' }; }
    return { ok: true, backpack: backpack.concat([pieceId]) };
  }
  function drop(backpack, pieceId) {
    return backpack.filter(function (id) { return id !== pieceId; });
  }

  // Which tiles a placed piece occupies: [{ col, row }]. The step-up column sits one row higher.
  function tilesFor(pieceId, slotId) {
    var piece = PIECES[pieceId];
    var slot = slotById(slotId);
    return piece.profile.map(function (h, i) { return { col: slot.col + i, row: BRIDGE_ROW - h }; });
  }

  // Attempts to place a piece. placed is { s1: id|null, ... }. A slot that already holds a piece is replaced
  // and the old piece goes back to the backpack, so the player can never get stuck.
  function place(placed, backpack, pieceId, slotId) {
    if (backpack.indexOf(pieceId) < 0) { return { ok: false, reason: 'missing', placed: placed, backpack: backpack }; }
    var res = check(pieceId, slotId);
    if (!res.ok) { return { ok: false, reason: res.reason, placed: placed, backpack: backpack }; }
    var np = {};
    SLOTS.forEach(function (s) { np[s.id] = placed[s.id] || null; });
    var bp = drop(backpack, pieceId);
    if (np[slotId]) { bp = bp.concat([np[slotId]]); }
    np[slotId] = pieceId;
    return { ok: true, placed: np, backpack: bp, complete: isComplete(np) };
  }

  function unplace(placed, backpack, slotId) {
    var id = placed[slotId];
    if (!id) { return { placed: placed, backpack: backpack }; }
    var np = {};
    SLOTS.forEach(function (s) { np[s.id] = placed[s.id] || null; });
    np[slotId] = null;
    return { placed: np, backpack: backpack.length < BACKPACK_SIZE ? backpack.concat([id]) : backpack, returned: backpack.length < BACKPACK_SIZE };
  }

  function isComplete(placed) {
    return SLOTS.every(function (s) { return !!placed[s.id] && check(placed[s.id], s.id).ok; });
  }

  function emptyPlaced() {
    var p = {};
    SLOTS.forEach(function (s) { p[s.id] = null; });
    return p;
  }

  // The one correct solution, used by tests and by the automated playthrough.
  var SOLUTION = { s1: 'a-left', s2: 'l-mid', s3: 'a-right' };

  return {
    WORLD_BUILD: WORLD_BUILD, BACKPACK_SIZE: BACKPACK_SIZE, BRIDGE_ROW: BRIDGE_ROW,
    SLOTS: SLOTS, PIECES: PIECES, COPIES: COPIES, SOLUTION: SOLUTION,
    slotById: slotById, check: check, take: take, drop: drop, place: place, unplace: unplace,
    tilesFor: tilesFor, isComplete: isComplete, emptyPlaced: emptyPlaced
  };
});
