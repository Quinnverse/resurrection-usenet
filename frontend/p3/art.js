/*
 * P3.2 pixel art. Everything is drawn from code (ASCII sprite maps and rectangles). There are no image files,
 * no third-party assets and no fonts: all art in this file is original to this project.
 *
 * The module only uses a tiny canvas subset (fillStyle, globalAlpha, fillRect, drawImage) so it runs in the
 * browser and in the Node software canvas used for review renders (tools/softcanvas.js).
 * UMD: window.P3Art / module.exports. Call createArt(makeCanvas) once.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Art = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- palette ---------------------------------------------------------------------------
  var C = {
    ink: '#241a3a', ink2: '#3a2c55',
    skin: '#f6d2aa', skinS: '#dca47c', cheek: '#f29a8c',
    hair: '#4b3568', hairL: '#7054920', hairH: '#6d4f90',
    jacket: '#f2ad3d', jacketS: '#c9801f', jacketL: '#ffd27a',
    scarf: '#e4506f', scarfS: '#a8325a',
    pants: '#41529a', pantsS: '#2e3b78', boot: '#2d2444', white: '#fff4dc',
    grass: '#6fd070', grassL: '#9fe58a', grassM: '#46a85c', grassD: '#2f8050',
    earth: '#8c5b3e', earthL: '#a8734d', earthD: '#6a4331', earthDD: '#4c3028',
    rock: '#9a94b8', rockL: '#bab4d6', rockD: '#6c668f', rockDD: '#4a4570',
    sand: '#f2d49a', sandL: '#fbe6b8', sandD: '#d3ad73', sandDD: '#b38d58',
    wood: '#b9784a', woodL: '#d89a62', woodD: '#8a5436', woodDD: '#5e3826',
    plank: '#d9a25e', plankL: '#f0c27e', plankD: '#a8702f',
    leaf: '#4fbf6a', leafL: '#86e07e', leafD: '#2f8a52', leafDD: '#1f6040',
    water: '#58a8ff', waterL: '#9fd2ff', waterD: '#3a6fd0', waterDD: '#2a4ba0',
    star: '#ffd84a', starL: '#fff2a0', starD: '#e8a020',
    crt: '#efe4c8', crtS: '#cbbd9c', crtD: '#a89a7a', screen: '#5fe0c0', screenD: '#1d6a63',
    metal: '#8e96b8', metalL: '#b4bcd8', metalD: '#5d6488', metalDD: '#393f60',
    cream: '#fff0d0', pink: '#ff9ac0', red: '#e5484d', green: '#58d68d', amber: '#ffb347', cyan: '#5fe0f0',
    night: '#17122e', night2: '#221a45'
  };
  C.hairL = '#7a5a9e';

  function createArt(makeCanvas) {
    var art = { C: C, makeCanvas: makeCanvas };
    var cache = {};

    // ---- primitives ----------------------------------------------------------------------
    function R(ctx, x, y, w, h, color, alpha) {
      if (w <= 0 || h <= 0) { return; }
      var prev = ctx.globalAlpha;
      if (alpha !== undefined) { ctx.globalAlpha = prev * alpha; }
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      if (alpha !== undefined) { ctx.globalAlpha = prev; }
    }
    art.R = R;

    function newCanvas(w, h) { var c = makeCanvas(w, h); return c; }
    art.newCanvas = newCanvas;

    // Builds a canvas from ASCII rows. '.' and ' ' are transparent. pal maps characters to colours.
    function sprite(rows, pal) {
      var h = rows.length, w = 0;
      rows.forEach(function (r) { if (r.length > w) { w = r.length; } });
      var cv = newCanvas(w, h);
      var cx = cv.getContext('2d');
      var mask = [];
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          var ch = rows[y].charAt(x);
          if (ch === '.' || ch === ' ') { continue; }
          mask[y * w + x] = true;
          var col = pal[ch];
          if (!col) { throw new Error('sprite: no colour for "' + ch + '"'); }
          cx.fillStyle = col; cx.fillRect(x, y, 1, 1);
        }
      }
      cv.__mask = mask;
      return cv;
    }
    art.sprite = sprite;

    function flipH(src) {
      var cv = newCanvas(src.width, src.height);
      var cx = cv.getContext('2d');
      for (var x = 0; x < src.width; x++) { cx.drawImage(src, x, 0, 1, src.height, src.width - 1 - x, 0, 1, src.height); }
      return cv;
    }
    art.flipH = flipH;

    // Draws a sprite showing only its bottom fraction (0..1): things growing up out of the ground.
    function drawGrow(ctx, src, x, y, frac) {
      if (frac <= 0) { return; }
      if (frac >= 1) { ctx.drawImage(src, Math.round(x), Math.round(y)); return; }
      var h = Math.max(1, Math.round(src.height * frac));
      ctx.drawImage(src, 0, src.height - h, src.width, h, Math.round(x), Math.round(y + src.height - h), src.width, h);
    }
    art.drawGrow = drawGrow;

    // Draws a sprite with a 1 px dark outline built from its own silhouette (cheap and very readable).
    function outlined(src, color) {
      var cv = newCanvas(src.width + 2, src.height + 2);
      var cx = cv.getContext('2d');
      var tmp = silhouette(src, color);
      [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(function (d) { cx.drawImage(tmp, d[0], d[1]); });
      cx.drawImage(src, 1, 1);
      return cv;
    }
    function silhouette(src, color) {
      var cv = newCanvas(src.width, src.height);
      var cx = cv.getContext('2d');
      cx.fillStyle = color;
      // Row-run silhouette from the source canvas pixels, via its stored map when available.
      if (src.__mask) {
        for (var y = 0; y < src.height; y++) { for (var x = 0; x < src.width; x++) { if (src.__mask[y * src.width + x]) { cx.fillRect(x, y, 1, 1); } } }
      }
      return cv;
    }
    art.sprite = sprite;
    art.outlined = outlined;

    // ---- Mara -----------------------------------------------------------------------------
    var MP = {
      o: C.ink, h: C.hair, H: C.hairL, s: C.skin, S: C.skinS, e: C.ink, k: C.cheek,
      j: C.jacket, J: C.jacketS, L: C.jacketL, r: C.scarf, R: C.scarfS, p: C.pants, P: C.pantsS, b: C.boot, w: C.white
    };

    // Head, scarf and torso, 14 wide, facing right. The ponytail trails to the left.
    var MARA_TOP = [
      '....oooooo....',
      '...ohhhhhho...',
      '..ohhHHhhhho..',
      '.ohhHhhhhhhho.',
      '.ohhhhhhhhhho.',
      'ohhhhhhhhhhso.',
      'ohhhhhhssssso.',
      'ohhhoossessso.',
      '.ohhhosskssso.',
      '..ohoossssSo..',
      '...orrrrrrro..',
      '..ojjrRRrrjjo.',
      '..ojjjjjjjjjo.',
      '..ojLjjjjjJjo.',
      '..ojjjjjjjJo..',
      '...oJJJJJJJo..'
    ];
    // Legs, 14 wide. Each variant is 6 rows.
    var MARA_LEGS = {
      stand: ['...opppppppo..', '...oppoopppo..', '...oppo.opppo.', '...oPPo.oPPo..', '...obbo.obbo..', '...obbo.obbo..'],
      run1:  ['...opppppppo..', '..oppo.oppo...', '.oppo...oppo..', '.obbo....oPo..', '.obbo....obbo.', '..oo......oo..'],
      run2:  ['...opppppppo..', '...oppoopppo..', '...opppoppo...', '...oPPoPPo....', '...obbbbbo....', '....ooooo.....'],
      run3:  ['...opppppppo..', '..oppo.oppo...', '..oppo..oppo..', '..oPPo...oPo..', '..obbo...obbo.', '...oo.....oo..'],
      air:   ['...opppppppo..', '..oppppo.oppo.', '..opPPo...oPPo', '..obbo....obbo', '...oo......oo.', '..............'],
      fall:  ['...opppppppo..', '..oppo..oppo..', '.oppo....oppo.', '.oPPo....oPPo.', '.obbo....obbo.', '..oo......oo..'],
      crouch:['...opppppppo..', '..opppppppppo.', '..obbbbbbbbbo.', '...oooooooooo.', '..............', '..............']
    };
    // Arms, 4 wide x 6 tall, drawn over the torso on the facing side.
    var MARA_ARM = {
      down: ['.oo.', 'ojjo', 'ojjo', 'oJso', '.oso', '..o.'],
      swingF: ['..oo', '.ojo', '.ojo', 'osso', 'oso.', '.o..'],
      swingB: ['.oo.', 'ojjo', 'ojjo', 'oJso', '.oso', '..oo'],
      up: ['oso.', 'oso.', 'ojjo', 'ojjo', 'ojjo', '.oo.']
    };

    function buildMaraFrame(name) {
      var legsKey = 'stand', armKey = 'down', bob = 0, squash = 0, armDy = 0;
      if (name === 'idle0') { bob = 0; }
      if (name === 'idle1') { bob = 1; }
      if (name === 'run0') { legsKey = 'run1'; armKey = 'swingF'; }
      if (name === 'run1') { legsKey = 'run2'; armKey = 'down'; bob = 1; }
      if (name === 'run2') { legsKey = 'run3'; armKey = 'swingB'; }
      if (name === 'run3') { legsKey = 'run2'; armKey = 'down'; bob = 1; }
      if (name === 'jump') { legsKey = 'air'; armKey = 'swingF'; armDy = -1; }
      if (name === 'fall') { legsKey = 'fall'; armKey = 'swingB'; armDy = -2; }
      if (name === 'land') { legsKey = 'crouch'; armKey = 'down'; squash = 4; }
      if (name === 'act') { legsKey = 'stand'; armKey = 'up'; }
      var topRows = MARA_TOP.slice(0, MARA_TOP.length - (squash > 0 ? 3 : 0));
      var legRows = MARA_LEGS[legsKey];
      var h = topRows.length + 6 + 1;
      var cv = newCanvas(14, 24);
      var cx = cv.getContext('2d');
      var top = sprite(topRows, MP);
      var legs = sprite(legRows, MP);
      var yTop = 24 - h - (squash > 0 ? 0 : 0) + bob;
      cx.drawImage(top, 0, yTop);
      var armRows = MARA_ARM[armKey];
      var arm = sprite(armRows, MP);
      var ax = armKey === 'up' ? 10 : 8, ay = yTop + (armKey === 'up' ? 9 : 10) + armDy;
      cx.drawImage(arm, ax, ay);
      cx.drawImage(legs, 0, yTop + topRows.length);
      return cv;
    }

    var MARA_FRAMES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'land', 'act'];
    var mara = { right: {}, left: {} };
    MARA_FRAMES.forEach(function (n) { mara.right[n] = buildMaraFrame(n); mara.left[n] = flipH(mara.right[n]); });
    art.mara = mara;
    art.MARA_FRAMES = MARA_FRAMES;

    // Picks the animation frame. t is seconds, anim one of idle|run|jump|fall|land|act.
    function maraFrame(anim, t) {
      if (anim === 'run') { return 'run' + (Math.floor(t * 10) % 4); }
      if (anim === 'idle') { return 'idle' + (Math.floor(t * 1.6) % 2); }
      return anim;
    }
    art.maraFrame = maraFrame;

    // Feet at (fx, fy) in screen pixels.
    art.drawMara = function (ctx, fx, fy, anim, t, facing) {
      var frame = maraFrame(anim, t);
      var spr = (facing < 0 ? mara.left : mara.right)[frame];
      ctx.drawImage(spr, Math.round(fx - 7), Math.round(fy - 24));
    };


    // ---- helpers for composed art -----------------------------------------------------------
    function mk(w, h, fn) { var cv = newCanvas(w, h); fn(cv.getContext('2d'), cv); return cv; }
    art.mk = mk;
    function seeded(seed) { var st = seed * 9301 + 49297; return function () { st = (st * 9301 + 49297) % 233280; return st / 233280; }; }
    art.seeded = seeded;
    function dots(cx, rnd, n, x0, y0, w, h, colors) {
      for (var i = 0; i < n; i++) { R(cx, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), 1, 1, colors[Math.floor(rnd() * colors.length)]); }
    }

    // ---- tiles (16 x 16) --------------------------------------------------------------------
    var tiles = {};
    function earthBody(cx, rnd, base, light, dark) {
      R(cx, 0, 0, 16, 16, base);
      dots(cx, rnd, 9, 0, 0, 16, 16, [light, dark, dark]);
      for (var i = 0; i < 2; i++) { var px = Math.floor(rnd() * 12), py = 3 + Math.floor(rnd() * 9); R(cx, px, py, 3, 2, dark); R(cx, px, py, 2, 1, light); }
    }
    for (var v = 0; v < 3; v++) {
      (function (v) {
        tiles['E' + v] = mk(16, 16, function (cx) { earthBody(cx, seeded(5 + v), C.earth, C.earthL, C.earthD); });
        tiles['G' + v] = mk(16, 16, function (cx) {
          var rnd = seeded(21 + v);
          earthBody(cx, rnd, C.earth, C.earthL, C.earthD);
          R(cx, 0, 0, 16, 4, C.grass); R(cx, 0, 0, 16, 1, C.grassL); R(cx, 0, 3, 16, 1, C.grassM);
          for (var x = 0; x < 16; x++) { var d = Math.floor(rnd() * 3); if (d > 0) { R(cx, x, 4, 1, d, C.grassM); } if (rnd() < 0.2) { R(cx, x, 1, 1, 1, C.grassL); } }
          R(cx, 0, 5, 16, 1, C.earthD, 0.35);
        });
        tiles['r' + v] = mk(16, 16, function (cx) {
          var rnd = seeded(41 + v);
          R(cx, 0, 0, 16, 16, C.rock);
          R(cx, 0, 7 + v, 16, 1, C.rockD); R(cx, 0, 8 + v, 16, 1, C.rockL, 0.5);
          dots(cx, rnd, 10, 0, 0, 16, 16, [C.rockL, C.rockD]);
          var cxp = 3 + Math.floor(rnd() * 9); R(cx, cxp, 0, 1, 5, C.rockDD); R(cx, cxp + 1, 4, 1, 4, C.rockDD);
        });
        tiles['R' + v] = mk(16, 16, function (cx) {
          var rnd = seeded(61 + v);
          R(cx, 0, 0, 16, 16, C.rock);
          dots(cx, rnd, 8, 0, 5, 16, 11, [C.rockL, C.rockD]);
          R(cx, 0, 0, 16, 3, C.rockL); R(cx, 0, 3, 16, 1, C.rockD);
          R(cx, 0, 0, 16, 1, C.cream, 0.55);
          for (var x = 0; x < 16; x += 1) { if (rnd() < 0.3) { R(cx, x, 0, 1, 1, C.grassM); } }
          var c2 = 2 + Math.floor(rnd() * 11); R(cx, c2, 4, 1, 5, C.rockDD);
        });
        tiles['s' + v] = mk(16, 16, function (cx) { earthBody(cx, seeded(81 + v), C.sandD, C.sand, C.sandDD); });
        tiles['S' + v] = mk(16, 16, function (cx) {
          var rnd = seeded(101 + v);
          earthBody(cx, rnd, C.sandD, C.sand, C.sandDD);
          R(cx, 0, 0, 16, 5, C.sand); R(cx, 0, 0, 16, 1, C.sandL); R(cx, 0, 4, 16, 1, C.sandD);
          dots(cx, rnd, 5, 0, 1, 16, 3, [C.sandL, C.sandD]);
        });
      })(v);
    }
    tiles.D = mk(16, 16, function (cx) {
      R(cx, 0, 0, 16, 16, C.wood); R(cx, 0, 0, 16, 2, C.woodL); R(cx, 0, 5, 16, 1, C.woodD); R(cx, 0, 10, 16, 1, C.woodD); R(cx, 0, 15, 16, 1, C.woodDD);
      R(cx, 3, 2, 1, 1, C.woodDD); R(cx, 12, 7, 1, 1, C.woodDD); R(cx, 5, 12, 1, 1, C.woodDD);
      R(cx, 8, 0, 1, 5, C.woodD); R(cx, 4, 5, 1, 5, C.woodD); R(cx, 11, 10, 1, 5, C.woodD);
    });
    // floating ledge: a plank with grass on top and a rope fringe underneath
    function ledgeTile(kind) {
      return mk(16, 16, function (cx) {
        R(cx, 0, 2, 16, 6, C.plank); R(cx, 0, 2, 16, 1, C.plankL); R(cx, 0, 7, 16, 1, C.plankD);
        R(cx, 0, 0, 16, 3, C.grass); R(cx, 0, 0, 16, 1, C.grassL); R(cx, 0, 2, 16, 1, C.grassM);
        R(cx, 4, 3, 1, 4, C.plankD); R(cx, 10, 3, 1, 4, C.plankD);
        R(cx, 0, 8, 16, 1, C.plankD, 0.4);
        if (kind === 'L' || kind === 'O') { R(cx, 0, 0, 1, 8, C.ink2, 0.5); R(cx, 1, 8, 2, 2, C.woodD); R(cx, 2, 10, 1, 3, C.leafD); }
        if (kind === 'R' || kind === 'O') { R(cx, 15, 0, 1, 8, C.ink2, 0.5); R(cx, 13, 8, 2, 2, C.woodD); R(cx, 13, 10, 1, 3, C.leafD); }
        if (kind === 'M') { R(cx, 7, 8, 2, 2, C.woodD); R(cx, 7, 10, 1, 2, C.leafD); }
      });
    }
    tiles.Lleft = ledgeTile('L'); tiles.Lright = ledgeTile('R'); tiles.Lmid = ledgeTile('M'); tiles.Lone = ledgeTile('O');
    // bridge plank (build 3): stone-capped planks with a truss underneath
    tiles.P = mk(16, 16, function (cx) {
      R(cx, 0, 0, 16, 5, C.plank); R(cx, 0, 0, 16, 1, C.plankL); R(cx, 0, 4, 16, 1, C.plankD);
      R(cx, 3, 1, 1, 3, C.plankD); R(cx, 8, 1, 1, 3, C.plankD); R(cx, 13, 1, 1, 3, C.plankD);
      R(cx, 0, 5, 16, 2, C.woodD); R(cx, 0, 7, 16, 1, C.woodDD);
      R(cx, 1, 7, 2, 7, C.woodD); R(cx, 13, 7, 2, 7, C.woodD);
      for (var i = 0; i < 6; i++) { R(cx, 3 + i * 2, 7 + i, 2, 1, C.woodD); R(cx, 11 - i * 2, 7 + i, 2, 1, C.woodD); }
    });
    tiles.F = mk(16, 16, function (cx) {
      R(cx, 0, 0, 16, 16, C.night2); R(cx, 0, 0, 16, 2, C.metalD); R(cx, 0, 0, 16, 1, C.green, 0.9);
      R(cx, 0, 2, 16, 1, C.green, 0.25);
      R(cx, 0, 8, 16, 1, C.metalDD); R(cx, 7, 2, 1, 14, C.metalDD); R(cx, 15, 2, 1, 14, C.metalDD);
      R(cx, 2, 11, 2, 1, C.green, 0.4); R(cx, 10, 5, 2, 1, C.cyan, 0.4);
    });
    tiles.T = mk(16, 16, function (cx) {
      R(cx, 0, 0, 16, 5, C.metal); R(cx, 0, 0, 16, 1, C.metalL); R(cx, 0, 4, 16, 1, C.metalD);
      for (var x = 2; x < 16; x += 4) { R(cx, x, 2, 2, 1, C.metalDD); }
      R(cx, 0, 5, 16, 2, C.metalDD); R(cx, 2, 7, 1, 6, C.red, 0.7); R(cx, 4, 7, 1, 5, C.amber, 0.7); R(cx, 12, 7, 1, 7, C.cyan, 0.7);
    });
    art.tiles = tiles;

    var TOP_SURFACE = { G: 1, R: 1, S: 1, D: 1, L: 1, P: 1, F: 1, T: 1 };
    // Draws one tile of a world at pixel (x, y). c, r are the grid position (used for variant and neighbours).
    art.drawTile = function (ctx, world, ch, c, r, x, y) {
      var v = (c * 7 + r * 3) % 3;
      var spr;
      if (ch === 'L') {
        var l = world.get(c - 1, r) === 'L', rr = world.get(c + 1, r) === 'L';
        spr = tiles[l && rr ? 'Lmid' : l ? 'Lright' : rr ? 'Lleft' : 'Lone'];
      } else if (ch === 'G' || ch === 'E' || ch === 'R' || ch === 'r' || ch === 'S' || ch === 's') {
        spr = tiles[ch + v];
      } else { spr = tiles[ch]; }
      if (spr) { ctx.drawImage(spr, Math.round(x), Math.round(y)); }
    };

    // ---- small props ------------------------------------------------------------------------
    var props = {};
    props.star = [0, 1, 2].map(function (f) {
      return mk(12, 12, function (cx) {
        var s = [[5, 0, 2, 12], [0, 5, 12, 2], [3, 3, 6, 6], [4, 2, 4, 8], [2, 4, 8, 4]];
        if (f === 1) { s = [[5, 1, 2, 10], [1, 5, 10, 2], [3, 3, 6, 6], [4, 2, 4, 8], [2, 4, 8, 4]]; }
        if (f === 2) { s = [[5, 2, 2, 8], [2, 5, 8, 2], [3, 3, 6, 6], [4, 2, 4, 8], [2, 4, 8, 4]]; }
        s.forEach(function (q) { R(cx, q[0], q[1], q[2], q[3], C.star); });
        R(cx, 4, 4, 4, 4, C.starL); R(cx, 5, 5, 2, 2, C.cream);
        R(cx, 3, 8, 6, 1, C.starD, 0.0);
      });
    });
    props.bigStar = mk(16, 16, function (cx) {
      R(cx, 7, 0, 2, 16, C.star); R(cx, 0, 7, 16, 2, C.star); R(cx, 3, 3, 10, 10, C.star); R(cx, 5, 1, 6, 14, C.star); R(cx, 1, 5, 14, 6, C.star);
      R(cx, 5, 5, 6, 6, C.starL); R(cx, 7, 7, 2, 2, C.cream);
    });

    props.tree = mk(32, 48, function (cx) {
      R(cx, 13, 24, 6, 24, C.woodD); R(cx, 13, 24, 2, 24, C.woodL); R(cx, 17, 24, 2, 24, C.woodDD);
      R(cx, 11, 44, 10, 4, C.woodD); R(cx, 12, 42, 8, 2, C.woodD);
      var rnd = seeded(7);
      var blobs = [[16, 12, 12], [8, 18, 9], [24, 18, 9], [16, 22, 10], [11, 9, 7], [22, 10, 7]];
      blobs.forEach(function (b) {
        for (var yy = -b[2]; yy <= b[2]; yy++) {
          var half = Math.floor(Math.sqrt(b[2] * b[2] - yy * yy));
          R(cx, b[0] - half, b[1] + yy, half * 2, 1, C.leaf);
        }
      });
      for (var yy = 0; yy < 32; yy++) { for (var xx = 0; xx < 32; xx++) { } }
      R(cx, 9, 6, 12, 2, C.leafL); R(cx, 5, 14, 6, 2, C.leafL); R(cx, 14, 3, 6, 1, C.leafL);
      R(cx, 6, 26, 20, 3, C.leafD); R(cx, 10, 29, 12, 2, C.leafD); R(cx, 18, 18, 10, 3, C.leafD);
      dots(cx, rnd, 18, 4, 4, 24, 26, [C.leafL, C.leafD]);
      R(cx, 20, 12, 2, 2, C.pink); R(cx, 9, 20, 2, 2, C.pink); R(cx, 14, 24, 2, 2, C.pink);
    });
    props.palm = mk(28, 52, function (cx) {
      for (var i = 0; i < 12; i++) { R(cx, 12 + Math.round(Math.sin(i / 4) * 2), 22 + i * 2.5, 4, 3, i % 2 ? C.woodD : C.wood); }
      var fronds = [[-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2], [-1, 1], [1, 1]];
      fronds.forEach(function (f, k) { for (var i = 0; i < 9; i++) { R(cx, 14 + f[0] * i * 1.4, 22 + f[1] * i * 0.9 + i * i * 0.07, 3, 2, k % 2 ? C.leaf : C.leafD); } });
      R(cx, 12, 22, 5, 4, C.woodDD); R(cx, 11, 26, 3, 3, C.woodDD);
    });
    props.bush = mk(20, 12, function (cx) {
      [[10, 7, 7], [5, 8, 5], [15, 8, 5]].forEach(function (b) { for (var yy = -b[2]; yy <= 0; yy++) { var half = Math.floor(Math.sqrt(b[2] * b[2] - yy * yy)); R(cx, b[0] - half, b[1] + yy, half * 2, 1, C.leaf); } });
      R(cx, 3, 11, 14, 1, C.leafD); R(cx, 6, 3, 5, 1, C.leafL); R(cx, 12, 5, 3, 1, C.leafL); R(cx, 4, 8, 2, 2, C.leafD); R(cx, 14, 7, 2, 2, C.leafD); R(cx, 9, 6, 1, 1, C.pink);
    });
    var flowerColors = [C.pink, C.amber, C.cream, C.cyan];
    props.flower = flowerColors.map(function (col) {
      return mk(7, 10, function (cx) {
        R(cx, 3, 4, 1, 6, C.leafD); R(cx, 1, 6, 2, 1, C.leaf); R(cx, 4, 7, 2, 1, C.leaf);
        R(cx, 2, 1, 3, 3, col); R(cx, 3, 0, 1, 1, col); R(cx, 3, 4, 1, 1, col); R(cx, 1, 2, 1, 1, col); R(cx, 5, 2, 1, 1, col); R(cx, 3, 2, 1, 1, C.starD);
      });
    });
    props.shell = mk(6, 4, function (cx) { R(cx, 1, 0, 4, 3, C.pink); R(cx, 0, 2, 6, 2, C.cream); R(cx, 2, 1, 1, 2, C.rockD); R(cx, 4, 1, 1, 2, C.rockD); });

    // signpost, 16 x 22. The board has "text" lines; lit = true draws a warm glow mark (already read).
    props.sign = [false, true].map(function (lit) {
      return mk(18, 24, function (cx) {
        R(cx, 8, 12, 3, 12, C.woodD); R(cx, 8, 12, 1, 12, C.woodL);
        R(cx, 1, 2, 16, 11, C.woodDD); R(cx, 2, 3, 14, 9, C.woodL); R(cx, 2, 3, 14, 1, C.cream, 0.6); R(cx, 2, 11, 14, 1, C.woodD);
        [[4, 5, 10], [4, 7, 7], [4, 9, 9]].forEach(function (l) { R(cx, l[0], l[1], l[2], 1, lit ? C.woodD : C.woodDD); });
        R(cx, 2, 3, 1, 1, C.woodDD); R(cx, 15, 3, 1, 1, C.woodDD); R(cx, 2, 10, 1, 1, C.woodDD); R(cx, 15, 10, 1, 1, C.woodDD);
      });
    });

    // sleeping cat (2 breathing frames) and a crab (2 frames)
    props.cat = [0, 1].map(function (f) {
      return mk(20, 12, function (cx) {
        var y = f;
        R(cx, 3, 6 + y, 14, 5 - y, C.amber); R(cx, 5, 4 + y, 10, 3, C.amber); R(cx, 3, 10, 14, 1, C.starD);
        R(cx, 14, 3 + y, 5, 5, C.amber); R(cx, 14, 2 + y, 1, 2, C.amber); R(cx, 18, 2 + y, 1, 2, C.amber); R(cx, 15, 5 + y, 1, 1, C.ink); R(cx, 17, 5 + y, 1, 1, C.ink);
        R(cx, 0, 8, 4, 2, C.amber); R(cx, 0, 7, 1, 2, C.starD); R(cx, 6, 5 + y, 1, 5, C.starD); R(cx, 9, 5 + y, 1, 5, C.starD); R(cx, 12, 6 + y, 1, 4, C.starD);
        R(cx, 4, 9, 3, 2, C.cream); R(cx, 15, 7 + y, 3, 1, C.cream);
      });
    });
    props.crab = [0, 1].map(function (f) {
      return mk(16, 10, function (cx) {
        R(cx, 4, 4, 8, 4, C.red); R(cx, 5, 3, 6, 1, C.red); R(cx, 5, 2, 1, 2, C.ink); R(cx, 10, 2, 1, 2, C.ink); R(cx, 5, 2, 1, 1, C.white);
        R(cx, 1, 2 - f, 3, 3, C.red); R(cx, 12, 2 - (1 - f), 3, 3, C.red); R(cx, 2, 4, 2, 1, C.red); R(cx, 12, 4, 2, 1, C.red);
        for (var i = 0; i < 3; i++) { R(cx, 3 + i * 3 + (f ? 1 : 0), 8, 1, 2, C.scarfS); }
        R(cx, 6, 5, 4, 1, C.scarfS);
      });
    });

    // checkpoint flag: grey when idle, warm when active
    props.flag = [false, true].map(function (on) {
      return mk(14, 28, function (cx) {
        R(cx, 2, 2, 2, 26, C.metalL); R(cx, 2, 2, 1, 26, C.cream); R(cx, 1, 26, 4, 2, C.metalD);
        R(cx, 4, 3, 9, 7, on ? C.amber : C.metal); R(cx, 4, 3, 9, 1, on ? C.starL : C.metalL);
        if (on) { R(cx, 6, 5, 5, 3, C.red); R(cx, 7, 6, 3, 1, C.cream); } else { R(cx, 6, 5, 5, 1, C.metalD); R(cx, 6, 7, 3, 1, C.metalD); }
        R(cx, 1, 0, 4, 3, C.starD); R(cx, 2, 0, 2, 2, C.star);
      });
    });

    // the shed door set into the cliff, with a blinking LED and a downward arrow sign
    props.door = [0, 1].map(function (f) {
      return mk(16, 28, function (cx) {
        R(cx, 0, 4, 16, 24, C.rockDD); R(cx, 1, 5, 14, 23, C.metalD); R(cx, 2, 6, 12, 22, C.metalDD);
        R(cx, 3, 7, 10, 21, C.metal); R(cx, 3, 7, 10, 1, C.metalL); R(cx, 4, 10, 8, 5, C.night); R(cx, 5, 11, 6, 3, C.screenD); R(cx, 5, 11, 6, 1, C.screen, 0.8);
        R(cx, 4, 18, 8, 1, C.metalD); R(cx, 4, 22, 8, 1, C.metalD); R(cx, 11, 24, 2, 2, C.metalDD);
        R(cx, 6, 8, 2, 1, f ? C.green : C.metalD);
        R(cx, 4, 8, 1, 1, f ? C.metalD : C.amber);
        R(cx, 5, 0, 6, 4, C.woodD); R(cx, 6, 1, 4, 2, C.amber);
        R(cx, 7, 3, 2, 1, C.amber);
      });
    });

    // server rack: 3 colour themes, 2 blink frames. 32 x 56
    var RACK_THEME = { archive: C.amber, lab: C.green, mirror: C.cyan };
    props.rack = {};
    Object.keys(RACK_THEME).forEach(function (name) {
      props.rack[name] = [0, 1].map(function (f) {
        return mk(32, 56, function (cx) {
          var glow = RACK_THEME[name];
          R(cx, 0, 0, 32, 56, C.metalDD); R(cx, 1, 1, 30, 54, C.metalD); R(cx, 2, 2, 28, 52, C.night2);
          R(cx, 0, 0, 32, 1, C.metalL, 0.6);
          // screen
          R(cx, 4, 4, 24, 16, C.night); R(cx, 5, 5, 22, 14, glow, 0.18);
          for (var i = 0; i < 5; i++) { R(cx, 7, 7 + i * 2, 8 + ((i * 5 + f * 3) % 11), 1, glow); }
          R(cx, 4, 4, 24, 1, glow, 0.7);
          // drive bays and LEDs
          for (var b = 0; b < 4; b++) {
            R(cx, 4, 23 + b * 8, 24, 6, C.metalDD); R(cx, 5, 24 + b * 8, 22, 4, C.metal); R(cx, 5, 24 + b * 8, 22, 1, C.metalL);
            R(cx, 7, 25 + b * 8, 10, 2, C.metalD);
            R(cx, 21, 25 + b * 8, 2, 2, ((b + f) % 2) ? glow : C.metalDD);
            R(cx, 24, 25 + b * 8, 2, 2, ((b + f + 1) % 3 === 0) ? C.red : C.metalDD);
          }
          R(cx, 2, 54, 28, 2, C.ink);
        });
      });
    });
    art.RACK_THEME = RACK_THEME;

    props.floppy = mk(10, 10, function (cx) {
      R(cx, 0, 0, 10, 10, C.ink); R(cx, 1, 1, 8, 8, C.cyan); R(cx, 2, 1, 6, 3, C.metalL); R(cx, 6, 2, 1, 2, C.ink); R(cx, 2, 6, 6, 3, C.cream); R(cx, 3, 7, 4, 1, C.metalD);
    });

    art.props = props;
    art.drawProp = function (ctx, spr, x, y) { ctx.drawImage(spr, Math.round(x), Math.round(y)); };

    art.__sprite = function () { return sprite; };
    art.__R = R;
    art.__cache = cache;
    art.__defineMore = [];
    return art;
  }

  return { createArt: createArt, C: C };
});
