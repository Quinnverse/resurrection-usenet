/*
 * P3.2 game state and save format. Pure: no DOM, no storage access (the browser shell reads and writes
 * localStorage). The save holds ids and numbers only, never text, so switching language loses nothing.
 * UMD: window.P3State / module.exports.
 */
(function (root, factory) {
  var api = factory(
    typeof require === 'function' ? require('./data.js') : root.P3Data,
    typeof require === 'function' ? require('./puzzle.js') : root.P3Puzzle,
    typeof require === 'function' ? require('./engine.js') : root.P3Engine
  );
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3State = api; }
})(typeof self !== 'undefined' ? self : this, function (D, Pz, E) {
  'use strict';

  var VERSION = 2;
  var SCENES = ['study', 'world', 'server', 'island'];
  var COPY_IDS = Object.keys(Pz.COPIES);
  var FLAG_KEYS = ['tape', 'catPetted', 'garden', 'bookFell', 'lamp', 'notesRead', 'introSeen'];

  function newState() {
    var cfg = D.CONFIG.scenes;
    return {
      v: VERSION,
      scene: 'study',
      pos: {
        study: { x: cfg.study.spawn.x, y: cfg.study.spawn.y },
        world: { x: cfg.world.spawn.x, y: cfg.world.spawn.y },
        server: { x: cfg.server.spawn.x, y: cfg.server.spawn.y },
        island: { x: cfg.island.spawn.x, y: cfg.island.spawn.y }
      },
      cp: 0,
      stars: [],
      floppies: [],
      flags: { tape: false, catPetted: false, garden: false, bookFell: false, lamp: true, notesRead: false, introSeen: false },
      serverSeen: [],
      backpack: [],
      placed: Pz.emptyPlaced(),
      bridge: false,
      ended: false,
      island: { stage: 0, seen: [] },
      falls: 0,
      wrong: 0
    };
  }

  function starIds() { return D.WORLD_STARS.map(function (s) { return s[0]; }); }
  function floppyIds() { return D.SERVER_FLOPPIES.map(function (s) { return s[0]; }); }
  function islandIds() { return D.ISLAND_OBJECTS.map(function (o) { return o.id; }); }

  function num(n, lo, hi, dflt) { return (typeof n === 'number' && isFinite(n) && n >= lo && n <= hi) ? n : dflt; }
  function pickKnown(list, known, max) {
    if (!Array.isArray(list)) { return []; }
    var out = [];
    list.forEach(function (id) { if (known.indexOf(id) >= 0 && out.indexOf(id) < 0 && out.length < max) { out.push(id); } });
    return out;
  }

  // Returns a valid state, or null when the object is not a version 2 save.
  function parse(obj) {
    if (!obj || typeof obj !== 'object' || obj.v !== VERSION || SCENES.indexOf(obj.scene) < 0) { return null; }
    var s = newState();
    var cfg = D.CONFIG.scenes;
    s.scene = obj.scene;
    SCENES.forEach(function (name) {
      var p = obj.pos && obj.pos[name];
      if (p) {
        s.pos[name] = { x: num(p.x, 0, cfg[name].w, s.pos[name].x), y: num(p.y, 0, cfg[name].h + 2, s.pos[name].y) };
      }
    });
    s.cp = Math.floor(num(obj.cp, 0, D.CHECKPOINTS.length - 1, 0));
    s.stars = pickKnown(obj.stars, starIds(), 64);
    s.floppies = pickKnown(obj.floppies, floppyIds(), 8);
    FLAG_KEYS.forEach(function (k) { if (obj.flags && typeof obj.flags[k] === 'boolean') { s.flags[k] = obj.flags[k]; } });
    s.serverSeen = pickKnown(obj.serverSeen, COPY_IDS, 8);
    s.backpack = pickKnown(obj.backpack, Object.keys(Pz.PIECES), Pz.BACKPACK_SIZE);
    var placed = Pz.emptyPlaced();
    Pz.SLOTS.forEach(function (slot) {
      var id = obj.placed && obj.placed[slot.id];
      // A saved placement counts only if it is a correct fit, so a tampered save cannot skip the puzzle.
      if (typeof id === 'string' && Pz.check(id, slot.id).ok && s.backpack.indexOf(id) < 0) { placed[slot.id] = id; }
    });
    s.placed = placed;
    s.bridge = obj.bridge === true && Pz.isComplete(placed);
    s.ended = obj.ended === true && s.bridge;
    var stage = Math.floor(num(obj.island && obj.island.stage, 0, D.ISLAND_STAGES, 0));
    s.island = { stage: s.ended ? stage : 0, seen: pickKnown(obj.island && obj.island.seen, islandIds(), 16) };
    s.falls = Math.floor(num(obj.falls, 0, 99999, 0));
    s.wrong = Math.floor(num(obj.wrong, 0, 99999, 0));
    // Scenes that need earlier progress cannot be entered without it.
    if (s.scene === 'island' && !s.ended) { s.scene = 'world'; }
    return s;
  }

  function serialize(s) { return JSON.parse(JSON.stringify(s)); }

  // Island objects that exist for this save: stage reached and required flag present.
  function islandObjects(s) {
    return D.ISLAND_OBJECTS.filter(function (o) { return s.island.stage >= o.stage && (!o.required || s.flags[o.required]); });
  }

  // Applies a placed bridge to a world grid (used when loading a save and when the build animation ends).
  function applyBridge(world, placed) {
    Pz.SLOTS.forEach(function (slot) {
      if (placed[slot.id]) { Pz.tilesFor(placed[slot.id], slot.id).forEach(function (t) { world.set(t.col, t.row, 'P'); }); }
    });
  }

  return {
    VERSION: VERSION, newState: newState, parse: parse, serialize: serialize, islandObjects: islandObjects,
    applyBridge: applyBridge, starIds: starIds, floppyIds: floppyIds
  };
});
