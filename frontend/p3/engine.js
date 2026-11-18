/*
 * P3.2 movement engine. Pure and deterministic: fixed 1/60 s steps, no random numbers, no clock, no DOM.
 * Units are tiles (16 px each). Feet position is (x, y); the body box is PW wide and PH tall above the feet.
 * UMD: window.P3Engine in the browser, module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Engine = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DT = 1 / 60;
  var PW = 0.6;
  var PH = 1.0;
  var SPEED = 7;              // tiles per second
  var GRAVITY = 40;
  var MAX_FALL = 24;
  var JUMP_SPEED = 16.73;     // apex 3.5 tiles
  var COYOTE = 7;             // frames a jump is still allowed after leaving an edge
  var BUFFER = 7;             // frames a jump press is remembered before landing
  var SUB = 0.05;
  var STEP_DIST = 1.1;        // tiles of ground travel per footstep event

  var SOLID = { '#': 1, G: 1, E: 1, R: 1, r: 1, S: 1, s: 1, D: 1, L: 1, P: 1, x: 1, F: 1, T: 1 };

  // A world is a grid of single characters. Cells outside the left and right edges are solid, the sky above is
  // open, and anything below the last row is the void.
  function makeWorld(rowStrings) {
    var cells = rowStrings.map(function (r) { return r.split(''); });
    return {
      w: cells[0].length,
      h: cells.length,
      cells: cells,
      get: function (c, r) { return (r < 0 || r >= this.h || c < 0 || c >= this.w) ? '.' : this.cells[r][c]; },
      set: function (c, r, ch) { if (r >= 0 && r < this.h && c >= 0 && c < this.w) { this.cells[r][c] = ch; } },
      solid: function (c, r) {
        if (c < 0 || c >= this.w) { return true; }
        if (r < 0 || r >= this.h) { return false; }
        return !!SOLID[this.cells[r][c]];
      }
    };
  }

  function blankRows(w, h) {
    var rows = [];
    for (var i = 0; i < h; i++) { rows.push(new Array(w + 1).join('.')); }
    return rows;
  }

  function createState(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, onGround: false, coyote: 0, buffer: 0, facing: 1, stepAcc: 0, airTime: 0 };
  }

  function clone(s) {
    return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, onGround: s.onGround, coyote: s.coyote, buffer: s.buffer, facing: s.facing, stepAcc: s.stepAcc, airTime: s.airTime };
  }

  function boxHits(world, x, y) {
    var left = x - PW / 2, right = x + PW / 2, top = y - PH, bottom = y;
    for (var r = Math.floor(top); r <= Math.floor(bottom - 1e-9); r++) {
      for (var c = Math.floor(left); c <= Math.floor(right - 1e-9); c++) {
        if (world.solid(c, r)) { return true; }
      }
    }
    return false;
  }

  function move(world, p, dx, dy) {
    var steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / SUB);
    if (steps === 0) { return false; }
    var sx = dx / steps, sy = dy / steps;
    for (var i = 0; i < steps; i++) {
      if (boxHits(world, p.x + sx, p.y + sy)) { return true; }
      p.x += sx; p.y += sy;
    }
    return false;
  }

  // input: { left, right, jump } with jump true only on the frame the key went down.
  // opts.respawn: { x, y } where to put the player after falling into the void; opts.frozen: ignore input.
  function step(state, input, world, opts) {
    var s = clone(state);
    var ev = [];
    var o = opts || {};
    var keys = o.frozen ? {} : (input || {});
    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    s.vx = dir * SPEED;
    if (dir !== 0) { s.facing = dir; }

    if (keys.jump) { s.buffer = BUFFER; } else if (s.buffer > 0) { s.buffer -= 1; }
    if (s.buffer > 0 && s.coyote > 0) {
      s.vy = -JUMP_SPEED; s.buffer = 0; s.coyote = 0; s.onGround = false;
      ev.push({ type: 'jump' });
    }
    s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * DT);

    var p = { x: s.x, y: s.y };
    var startX = p.x;
    if (move(world, p, s.vx * DT, 0)) { s.vx = 0; }
    var impact = s.vy;
    if (move(world, p, 0, s.vy * DT)) { s.vy = 0; }

    var wasAir = !state.onGround;
    s.onGround = boxHits(world, p.x, p.y + 0.1);
    s.coyote = s.onGround ? COYOTE : Math.max(0, s.coyote - 1);
    s.airTime = s.onGround ? 0 : s.airTime + 1;
    if (s.onGround && wasAir && impact > 6) { ev.push({ type: 'land', speed: impact }); }
    if (s.onGround) {
      s.stepAcc += Math.abs(p.x - startX);
      if (s.stepAcc >= STEP_DIST) { s.stepAcc -= STEP_DIST; ev.push({ type: 'step' }); }
    } else {
      s.stepAcc = 0;
    }

    if (p.y > world.h + 2) {
      var rs = o.respawn || { x: 2.5, y: 2 };
      p = { x: rs.x, y: rs.y };
      s.vx = 0; s.vy = 0; s.onGround = false; s.coyote = 0;
      ev.push({ type: 'fall', col: Math.floor(state.x) });
    }
    s.x = p.x; s.y = p.y;
    return { state: s, events: ev };
  }

  return {
    DT: DT, PW: PW, PH: PH, SPEED: SPEED, GRAVITY: GRAVITY, JUMP_SPEED: JUMP_SPEED,
    makeWorld: makeWorld, blankRows: blankRows, createState: createState, step: step, boxHits: boxHits, SOLID: SOLID
  };
});
