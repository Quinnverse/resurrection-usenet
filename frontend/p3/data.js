/*
 * P3.2 level data: every map, spawn point, checkpoint, interaction range and collectible lives here.
 * Units are tiles (1 tile = 16 px). Rows count down from the top, y is the row of the feet.
 * Pure data and builders, no DOM. UMD: window.P3Data / module.exports.
 */
(function (root, factory) {
  var api = factory(typeof require === 'function' ? require('./engine.js') : root.P3Engine, typeof require === 'function' ? require('./puzzle.js') : root.P3Puzzle);
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Data = api; }
})(typeof self !== 'undefined' ? self : this, function (E, Pz) {
  'use strict';

  var VIEW_W = 20;           // visible tiles across
  var VIEW_H = 11;           // visible tiles down
  var TILE = 16;

  var CONFIG = {
    tile: TILE,
    view: { w: VIEW_W, h: VIEW_H, px: { w: VIEW_W * TILE, h: VIEW_H * TILE } },
    interactRange: 1.6,      // tiles, measured along x between the player's feet and the object
    pickupRadius: 0.7,       // tiles, star and floppy pickup distance
    scenes: {
      study:  { w: 20,  h: 11, spawn: { x: 2.5, y: 9 } },
      world:  { w: 122, h: 14, spawn: { x: 3.5, y: 10 } },
      server: { w: 40,  h: 11, spawn: { x: 3.5, y: 9 } },
      island: { w: 32,  h: 11, spawn: { x: 8.5, y: 8 } }
    }
  };

  // ---- grid helpers ----------------------------------------------------------------------

  function grid(w, h) {
    var cells = [];
    for (var r = 0; r < h; r++) { var row = []; for (var c = 0; c < w; c++) { row.push('.'); } cells.push(row); }
    return {
      cells: cells,
      fill: function (c1, c2, r1, r2, ch) {
        for (var r = r1; r <= r2; r++) { for (var c = c1; c <= c2; c++) { cells[r][c] = ch; } }
      },
      world: function () { return E.makeWorld(cells.map(function (row) { return row.join(''); })); }
    };
  }

  // ---- A. study --------------------------------------------------------------------------

  function buildStudy() {
    var g = grid(20, 11);
    g.fill(0, 19, 9, 10, 'D');       // wooden floor
    g.fill(0, 0, 0, 8, 'x');         // left wall
    g.fill(19, 19, 0, 8, 'x');       // right wall
    return g.world();
  }

  // Interactable objects. type is used for the prompt icon; text keys live in i18n under "obj.<id>".
  var STUDY_OBJECTS = [
    { id: 'shelf',   x: 3.4,  y: 9, type: 'book' },
    { id: 'tape',    x: 5.4,  y: 9, type: 'tape' },
    { id: 'photo',   x: 7.4,  y: 9, type: 'look' },
    { id: 'notes',   x: 13.1, y: 9, type: 'read' },
    { id: 'monitor', x: 14.6, y: 9, type: 'use' },
    { id: 'lamp',    x: 17.2, y: 9, type: 'use' }
  ];

  // ---- B, C, E. the 1998 world -----------------------------------------------------------

  function buildWorld() {
    var g = grid(122, 14);
    // B. meadow
    g.fill(0, 16, 10, 10, 'G');   g.fill(0, 16, 11, 13, 'E');
    g.fill(20, 45, 10, 10, 'G');  g.fill(20, 45, 11, 13, 'E');
    g.fill(49, 58, 10, 10, 'G');  g.fill(49, 58, 11, 13, 'E');
    // the high route: four wooden ledges climbing to the secret garden
    g.fill(23, 26, 7, 7, 'L');
    g.fill(28, 31, 5, 5, 'L');
    g.fill(33, 36, 3, 3, 'L');
    g.fill(38, 43, 1, 1, 'L');
    // C. canyon: left cliff, the server ledge under its lip, and the right cliff one tile higher
    g.fill(59, 61, 10, 10, 'R');  g.fill(59, 61, 11, 13, 'r');
    g.fill(62, 64, 12, 12, 'R');  g.fill(62, 64, 13, 13, 'r');
    g.fill(72, 76, 9, 9, 'R');    g.fill(72, 76, 10, 13, 'r');
    // E. the far side: meadow, beach and pier
    g.fill(77, 90, 9, 9, 'G');    g.fill(77, 90, 10, 13, 'E');
    g.fill(91, 108, 10, 10, 'S'); g.fill(91, 108, 11, 13, 's');
    g.fill(109, 121, 10, 10, 'D');
    return g.world();
  }

  var CHECKPOINTS = [
    { id: 0, x: 3.5,  y: 10, zone: 'B' },
    { id: 1, x: 13.2, y: 10, zone: 'B' },     // just before the stream
    { id: 2, x: 21.0, y: 10, zone: 'B' },     // after the stream, at the foot of the high route
    { id: 3, x: 44.6, y: 10, zone: 'B' },     // just before the second gap, and where the garden drop lands
    { id: 4, x: 49.8, y: 10, zone: 'B' },
    { id: 5, x: 54.2, y: 10, zone: 'C' },     // the canyon edge
    { id: 6, x: 74.5, y: 9,  zone: 'E' },     // across the bridge
    { id: 7, x: 93.5, y: 10, zone: 'E' }      // the beach
  ];

  // Zones for the HUD and for the sky colour.
  var ZONES = [
    { id: 'B', from: 0,  to: 51 },
    { id: 'C', from: 52, to: 71 },
    { id: 'E', from: 72, to: 122 }
  ];

  // Stars are [id, col, row]. The star at (63, 11) lures the player onto the server ledge.
  var WORLD_STARS = [
    ['s01', 6, 9], ['s02', 11, 8], ['s03', 18, 8], ['s04', 24, 6], ['s05', 29, 4], ['s06', 34, 2],
    ['g1', 39, 0], ['g2', 41, 0], ['g3', 43, 0],
    ['s07', 47, 8], ['s08', 53, 9], ['sx', 63, 11],
    ['s09', 78, 8], ['s10', 84, 8], ['s11', 98, 9], ['s12', 104, 9]
  ];

  var WORLD_OBJECTS = [
    { id: 'sign0',    x: 4.6,   y: 10, type: 'read' },
    { id: 'cat',      x: 10.4,  y: 10, type: 'pet' },
    { id: 'sign1',    x: 15.2,  y: 10, type: 'read' },
    { id: 'sign2',    x: 42.8,  y: 10, type: 'read' },
    { id: 'garden',   x: 40.5,  y: 1,  type: 'read' },
    { id: 'sign3',    x: 55.6,  y: 10, type: 'read' },
    { id: 'blueprint',x: 58.7,  y: 10, type: 'look' },
    { id: 'bridge',   x: 60.7,  y: 10, type: 'use' },
    { id: 'door',        x: 62.5,  y: 12, type: 'use', range: 1.5 },
    { id: 'serverReturn', x: 63.5, y: 10, type: 'use', range: 1.5, requires: 'bridge' },
    { id: 'sign4',       x: 74.6,  y: 9,  type: 'read' },
    { id: 'crab',     x: 85.5,  y: 9,  type: 'pet' },
    { id: 'sign5',    x: 100.5, y: 10, type: 'read' },
    { id: 'terminal', x: 118.2, y: 10, type: 'use' }
  ];

  // Scenery positions [x, base row]. Purely visual.
  var WORLD_DECOR = {
    trees: [[2, 10], [8, 10], [13.5, 10], [24, 10], [34, 10], [41, 10], [51, 10], [79.5, 9], [88, 9]],
    bushes: [[6.5, 10], [12, 10], [22, 10], [28, 10], [36, 10], [47.8, 10], [54, 10], [75, 9], [82, 9], [90, 9]],
    flowers: [[3, 10], [5.5, 10], [9, 10], [11.5, 10], [14.5, 10], [21, 10], [26, 10], [30, 10], [38, 10], [43, 10], [50, 10], [53, 10], [78, 9], [81, 9], [86, 9], [89, 9]],
    posts: [[61.4, 10], [72.6, 9]],
    palms: [[96, 10], [106, 10]],
    shells: [[93, 10], [99.5, 10], [103, 10]]
  };

  // ---- D. the server room ----------------------------------------------------------------

  function buildServer() {
    var g = grid(40, 11);
    g.fill(0, 39, 9, 10, 'F');
    g.fill(0, 0, 0, 8, 'x');
    g.fill(39, 39, 0, 8, 'x');
    g.fill(11, 14, 6, 6, 'T');
    g.fill(16, 18, 6, 6, 'T');
    g.fill(21, 25, 4, 4, 'T');
    g.fill(31, 33, 6, 6, 'T');
    return g.world();
  }

  var SERVER_OBJECTS = [
    { id: 'exit',    x: 2.5,  y: 9, type: 'use' },
    { id: 'archive', x: 8.5,  y: 9, type: 'use', copy: 'archive' },
    { id: 'lab',     x: 20.5, y: 9, type: 'use', copy: 'lab' },
    { id: 'mirror',  x: 33.5, y: 9, type: 'use', copy: 'mirror' }
  ];
  var SERVER_FLOPPIES = [['f1', 12, 5], ['f2', 23, 3], ['f3', 32, 5]];

  // ---- the memory island -----------------------------------------------------------------

  function buildIsland() {
    var g = grid(32, 11);
    g.fill(3, 28, 8, 8, 'G');
    g.fill(3, 28, 9, 10, 'E');
    g.fill(2, 2, 0, 10, 'x');
    g.fill(29, 29, 0, 10, 'x');
    return g.world();
  }

  // required: a flag that must be set for the object to exist.
  var ISLAND_OBJECTS = [
    { id: 'cabin',    x: 9.5,  y: 8, type: 'look', stage: 2 },
    { id: 'tree',     x: 14.6, y: 8, type: 'look', stage: 3 },
    { id: 'console',  x: 12.4, y: 8, type: 'use',  stage: 4 },
    { id: 'photo',    x: 17.2, y: 8, type: 'look', stage: 5 },
    { id: 'cassette', x: 19.6, y: 8, type: 'use',  stage: 5, required: 'tape' },
    { id: 'cat',      x: 22.0, y: 8, type: 'pet',  stage: 5, required: 'catPetted' },
    { id: 'jar',      x: 24.2, y: 8, type: 'look', stage: 5 },
    { id: 'note',     x: 26.4, y: 8, type: 'read', stage: 5, required: 'garden' }
  ];

  // Island growth, in order: ground and coast, cabin, trees and flowers, console, memory objects.
  var ISLAND_STAGES = 5;

  return {
    CONFIG: CONFIG, VIEW_W: VIEW_W, VIEW_H: VIEW_H, TILE: TILE,
    buildStudy: buildStudy, buildWorld: buildWorld, buildServer: buildServer, buildIsland: buildIsland,
    STUDY_OBJECTS: STUDY_OBJECTS, WORLD_OBJECTS: WORLD_OBJECTS, SERVER_OBJECTS: SERVER_OBJECTS, ISLAND_OBJECTS: ISLAND_OBJECTS,
    CHECKPOINTS: CHECKPOINTS, ZONES: ZONES, WORLD_STARS: WORLD_STARS, WORLD_DECOR: WORLD_DECOR,
    SERVER_FLOPPIES: SERVER_FLOPPIES, ISLAND_STAGES: ISLAND_STAGES, PIECES_REF: Pz
  };
});
