/*
 * P3.2 scene drawing. Each function draws one 320 x 176 frame from plain data (state, camera, time) and
 * never changes game state. Uses only the canvas subset in art.js, so the same code renders in the browser
 * and in the Node software canvas (tools/softcanvas.js) for visual review.
 * UMD: window.P3Scenes / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Scenes = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VW = 320, VH = 176, T = 16;

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    var o = [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); });
    return '#' + o.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ramp(colors, t) {
    var f = clamp(t, 0, 1) * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(f));
    return mix(colors[i], colors[i + 1], f - i);
  }

  function create(art, data, puzzle) {
    var R = art.R, C = art.C, P = art.props;
    var S = {};

    // ---- extra sprites for the study, pier, island ---------------------------------------
    var sp = {};
    var FONT = {
      '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
      '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
      '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
      '9': ['111', '101', '111', '001', '111'], 'B': ['110', '101', '110', '101', '110'], 'E': ['111', '100', '110', '100', '111'],
      '!': ['010', '010', '010', '000', '010'], '?': ['111', '001', '010', '000', '010']
    };
    function glyph(ctx, ch, x, y, color) {
      var g = FONT[ch]; if (!g) { return; }
      for (var yy = 0; yy < 5; yy++) { for (var xx = 0; xx < 3; xx++) { if (g[yy].charAt(xx) === '1') { R(ctx, x + xx, y + yy, 1, 1, color); } } }
    }
    function text(ctx, str, x, y, color) { for (var i = 0; i < str.length; i++) { glyph(ctx, str.charAt(i), x + i * 4, y, color); } }
    S.text = text;

    function ellipse(ctx, cx, cy, rx, ry, color, alpha) {
      for (var yy = -ry; yy <= ry; yy++) { var half = Math.floor(rx * Math.sqrt(1 - (yy * yy) / (ry * ry))); R(ctx, cx - half, cy + yy, half * 2, 1, color, alpha); }
    }
    S.ellipse = ellipse;

    sp.cloud = [0, 1, 2].map(function (k) {
      return art.mk(64, 24, function (cx) {
        var blobs = [[[14, 16, 10], [28, 12, 12], [42, 16, 10], [30, 18, 14]], [[12, 16, 8], [26, 11, 11], [40, 15, 9]], [[18, 15, 11], [34, 14, 13], [48, 17, 8]]][k];
        blobs.forEach(function (b) { ellipse(cx, b[0], b[1], b[2], Math.round(b[2] * 0.7), '#ffffff', 0.9); });
        R(cx, 4, 20, 56, 2, '#d9c8f5', 0.6);
      });
    });

    sp.bookshelf = art.mk(52, 100, function (cx) {
      R(cx, 0, 0, 52, 100, C.woodDD); R(cx, 2, 2, 48, 96, C.woodD);
      var cols = [C.red, C.cyan, C.amber, C.pink, C.green, C.rockL, C.star, '#7a6af0'];
      var rnd = art.seeded(3);
      for (var s = 0; s < 4; s++) {
        var y = 4 + s * 24;
        R(cx, 3, y, 46, 21, C.night2);
        var x = 4;
        while (x < 46) {
          var w = 2 + Math.floor(rnd() * 3), h = 12 + Math.floor(rnd() * 9);
          R(cx, x, y + 21 - h, w, h, cols[Math.floor(rnd() * cols.length)]);
          R(cx, x, y + 21 - h, 1, h, C.white, 0.25);
          x += w + (rnd() < 0.15 ? 3 : 0);
        }
        R(cx, 2, y + 21, 48, 3, C.woodL); R(cx, 2, y + 23, 48, 1, C.woodDD);
      }
      R(cx, 0, 0, 52, 2, C.woodL);
    });
    sp.sidetable = art.mk(22, 30, function (cx) {
      R(cx, 1, 8, 20, 3, C.woodL); R(cx, 1, 11, 20, 1, C.woodDD); R(cx, 3, 12, 2, 18, C.woodD); R(cx, 17, 12, 2, 18, C.woodD);
      // plant
      R(cx, 14, 0, 6, 8, C.woodD); R(cx, 15, 0, 4, 2, C.earth); R(cx, 16, -0, 1, 1, C.leaf);
    });
    sp.tape = [false, true].map(function (glow) {
      return art.mk(14, 10, function (cx) {
        R(cx, 0, 0, 14, 10, C.ink); R(cx, 1, 1, 12, 8, glow ? C.starL : C.cream); R(cx, 2, 2, 10, 3, C.red); R(cx, 3, 6, 3, 2, C.ink); R(cx, 8, 6, 3, 2, C.ink); R(cx, 4, 7, 1, 1, C.cream); R(cx, 9, 7, 1, 1, C.cream);
      });
    });
    sp.frame = art.mk(20, 24, function (cx) {
      R(cx, 0, 0, 20, 24, C.woodDD); R(cx, 1, 1, 18, 22, C.woodL); R(cx, 3, 3, 14, 18, C.night2);
      R(cx, 3, 3, 14, 18, '#7aa6e8'); R(cx, 3, 12, 14, 9, '#f0c070');
      ellipse(cx, 10, 11, 3, 3, C.skin); R(cx, 7, 8, 7, 3, C.hair); R(cx, 6, 14, 9, 7, C.jacket); R(cx, 12, 15, 3, 1, C.metalD); R(cx, 14, 13, 2, 3, C.red);
    });
    sp.desk = art.mk(94, 40, function (cx) {
      R(cx, 0, 0, 94, 6, C.woodL); R(cx, 0, 0, 94, 1, C.cream, 0.5); R(cx, 0, 6, 94, 2, C.woodD);
      R(cx, 4, 8, 8, 32, C.woodD); R(cx, 82, 8, 8, 32, C.woodD); R(cx, 12, 8, 70, 10, C.woodDD);
      R(cx, 70, 8, 20, 30, C.woodD); R(cx, 72, 12, 16, 10, C.woodL); R(cx, 72, 26, 16, 10, C.woodL); R(cx, 78, 16, 4, 2, C.amber); R(cx, 78, 30, 4, 2, C.amber);
    });
    sp.crt = [0, 1].map(function (f) {
      return art.mk(34, 32, function (cx) {
        R(cx, 0, 0, 34, 26, C.crtD); R(cx, 1, 1, 32, 24, C.crt); R(cx, 1, 1, 32, 1, C.white); R(cx, 1, 24, 32, 1, C.crtS);
        R(cx, 4, 4, 26, 18, C.ink); R(cx, 5, 5, 24, 16, C.screenD);
        for (var i = 0; i < 8; i++) { R(cx, 5, 5 + i * 2, 24, 1, C.screen, f ? 0.30 : 0.18); }
        R(cx, 8, 8, 9, 1, C.screen); R(cx, 8, 11, 14, 1, C.screen); R(cx, 8, 14, 11, 1, C.screen); R(cx, 21 + f * 0, 14, 3, 2, C.cream);
        R(cx, 26, 23, 3, 1, C.green); R(cx, 4, 26, 26, 3, C.crt); R(cx, 8, 29, 18, 3, C.crtS); R(cx, 1, 26, 32, 1, C.crtD);
      });
    });
    sp.notes = art.mk(12, 12, function (cx) {
      R(cx, 0, 0, 7, 7, C.star); R(cx, 5, 4, 7, 7, C.pink); R(cx, 1, 2, 4, 1, C.woodD); R(cx, 1, 4, 3, 1, C.woodD); R(cx, 6, 6, 4, 1, C.scarfS); R(cx, 6, 8, 3, 1, C.scarfS);
    });
    sp.lamp = [false, true].map(function (on) {
      return art.mk(18, 28, function (cx) {
        R(cx, 5, 24, 8, 3, C.metalD); R(cx, 8, 10, 2, 14, C.metalL); R(cx, 2, 2, 14, 9, C.red); R(cx, 2, 2, 14, 2, C.scarf); R(cx, 3, 10, 12, 1, on ? C.starL : C.scarfS);
        if (on) { R(cx, 4, 11, 10, 1, C.starL); }
      });
    });
    sp.chair = art.mk(26, 34, function (cx) {
      R(cx, 3, 0, 6, 20, C.scarfS); R(cx, 3, 0, 6, 2, C.scarf); R(cx, 3, 18, 22, 5, C.scarf); R(cx, 3, 18, 22, 1, C.pink, 0.6);
      R(cx, 12, 23, 3, 8, C.metalD); R(cx, 6, 31, 16, 2, C.metalD);
    });
    sp.poster = art.mk(26, 34, function (cx) {
      R(cx, 0, 0, 26, 34, C.cream); R(cx, 1, 1, 24, 32, '#3b3d9e'); R(cx, 1, 22, 24, 11, '#46a85c'); R(cx, 10, 6, 6, 6, C.star); R(cx, 12, 4, 2, 10, C.star); R(cx, 8, 8, 10, 2, C.star);
      R(cx, 4, 26, 6, 7, C.leafD); R(cx, 17, 25, 5, 8, C.leafD); text(cx, 'B3', 8, 16, C.cream);
    });
    sp.rug = art.mk(100, 14, function (cx) { ellipse(cx, 50, 7, 49, 6, C.scarfS); ellipse(cx, 50, 7, 42, 4, C.scarf); ellipse(cx, 50, 7, 30, 3, C.cream, 0.5); });

    sp.post = art.mk(10, 40, function (cx) {
      R(cx, 3, 6, 4, 34, C.woodD); R(cx, 3, 6, 1, 34, C.woodL); R(cx, 1, 4, 8, 3, C.woodDD); R(cx, 1, 20, 8, 2, C.woodDD);
      R(cx, 4, 0, 2, 3, C.metalD); R(cx, 2, 1, 6, 5, C.amber); R(cx, 3, 2, 4, 3, C.starL);
    });
    sp.blueprint = art.mk(34, 36, function (cx) {
      R(cx, 15, 20, 4, 16, C.woodD); R(cx, 1, 0, 32, 22, C.woodDD); R(cx, 2, 1, 30, 20, '#27468f');
      for (var i = 0; i < 6; i++) { R(cx, 2 + i * 5, 1, 1, 20, '#3b63b8', 0.7); } for (var j = 0; j < 4; j++) { R(cx, 2, 1 + j * 5, 30, 1, '#3b63b8', 0.7); }
      R(cx, 4, 12, 7, 2, C.cyan); R(cx, 23, 9, 7, 2, C.cyan); R(cx, 11, 12, 12, 1, C.cyan, 0.5); R(cx, 11, 9, 12, 1, C.cyan, 0.0);
      R(cx, 4, 14, 1, 5, C.cyan); R(cx, 29, 11, 1, 8, C.cyan);
      R(cx, 5, 3, 13, 7, C.cream); R(cx, 6, 4, 11, 5, '#27468f'); text(cx, 'B3', 8, 5, C.star);
      R(cx, 20, 3, 10, 3, C.red, 0.0);
    });
    sp.terminal = [0, 1].map(function (f) {
      return art.mk(36, 40, function (cx) {
        R(cx, 2, 22, 32, 4, C.woodL); R(cx, 2, 26, 32, 2, C.woodDD); R(cx, 5, 28, 4, 12, C.woodD); R(cx, 27, 28, 4, 12, C.woodD);
        R(cx, 6, 0, 24, 22, C.crtD); R(cx, 7, 1, 22, 20, C.crt); R(cx, 9, 3, 18, 14, C.ink); R(cx, 10, 4, 16, 12, '#3a2400');
        for (var i = 0; i < 4; i++) { R(cx, 12, 6 + i * 3, 8 + ((i * 3 + f * 2) % 5), 1, C.amber); }
        R(cx, 22, 14, 3, 1, f ? C.amber : '#3a2400'); R(cx, 8, 18, 20, 2, C.crtS);
      });
    });
    sp.cabin = art.mk(64, 52, function (cx) {
      R(cx, 4, 22, 56, 30, C.woodL); R(cx, 4, 22, 56, 2, C.woodD);
      for (var y = 26; y < 52; y += 6) { R(cx, 4, y, 56, 1, C.woodD); }
      for (var i = 0; i < 18; i++) { R(cx, 0 + i * 2, 20 - i, 64 - i * 4, 2, i % 3 === 0 ? C.scarf : C.scarfS); if (i * 2 >= 30) { break; } }
      R(cx, 0, 18, 64, 3, C.scarfS); R(cx, 14, 6, 36, 14, C.scarf); R(cx, 22, 2, 20, 6, C.scarf); R(cx, 28, 0, 8, 3, C.scarfS);
      R(cx, 26, 34, 12, 18, C.woodDD); R(cx, 27, 35, 10, 17, C.woodD); R(cx, 34, 43, 2, 2, C.star);
      R(cx, 8, 30, 12, 12, C.woodDD); R(cx, 9, 31, 10, 10, '#ffd88a'); R(cx, 13, 31, 2, 10, C.woodDD); R(cx, 9, 35, 10, 2, C.woodDD);
      R(cx, 44, 30, 12, 12, C.woodDD); R(cx, 45, 31, 10, 10, '#ffd88a'); R(cx, 49, 31, 2, 10, C.woodDD); R(cx, 45, 35, 10, 2, C.woodDD);
      R(cx, 0, 50, 64, 2, C.woodDD);
    });
    sp.islandConsole = [0, 1].map(function (f) {
      return art.mk(22, 22, function (cx) {
        R(cx, 2, 14, 18, 8, C.woodD); R(cx, 2, 14, 18, 2, C.woodL);
        R(cx, 3, 0, 16, 14, C.crtD); R(cx, 4, 1, 14, 12, C.crt); R(cx, 5, 2, 12, 8, C.ink); R(cx, 6, 3, 10, 6, C.screenD);
        R(cx, 7, 4, 4, 1, C.screen); R(cx, 7, 6, 7, 1, C.screen); R(cx, 12 + f, 7, 2, 1, C.cream); R(cx, 5, 11, 4, 1, C.metalD); R(cx, 14, 11, 2, 1, C.green);
      });
    });
    sp.jar = art.mk(14, 18, function (cx) {
      R(cx, 3, 0, 8, 3, C.woodD); R(cx, 1, 3, 12, 15, C.cyan, 0.45); R(cx, 1, 3, 1, 15, C.white, 0.5); R(cx, 12, 3, 1, 15, C.waterD, 0.5);
      R(cx, 4, 12, 3, 3, C.star); R(cx, 8, 9, 3, 3, C.star); R(cx, 5, 8, 2, 2, C.starL); R(cx, 1, 17, 12, 1, C.waterD);
    });
    sp.player = art.mk(16, 14, function (cx) {
      R(cx, 0, 4, 16, 10, C.metalD); R(cx, 1, 5, 14, 8, C.metal); R(cx, 2, 6, 6, 5, C.night2); R(cx, 10, 7, 4, 2, C.red); R(cx, 10, 10, 4, 1, C.amber);
      R(cx, 3, 6, 4, 1, C.green); R(cx, 5, 0, 6, 4, C.metalL); R(cx, 6, 1, 4, 2, C.ink);
    });
    sp.frameStand = art.mk(20, 36, function (cx) {
      R(cx, 9, 22, 2, 14, C.woodD); R(cx, 2, 24, 16, 2, C.woodD); R(cx, 5, 34, 10, 2, C.woodDD);
      cx.drawImage(sp.frame, 0, 0);
    });
    sp.noteStand = art.mk(18, 26, function (cx) { R(cx, 8, 10, 2, 16, C.woodD); R(cx, 1, 1, 16, 12, C.cream); R(cx, 1, 1, 16, 1, C.starL); R(cx, 3, 4, 10, 1, C.woodD); R(cx, 3, 6, 8, 1, C.woodD); R(cx, 3, 8, 11, 1, C.woodD); });
    sp.lighthouse = art.mk(14, 56, function (cx) {
      R(cx, 3, 12, 8, 44, C.cream); R(cx, 2, 20, 10, 8, C.red); R(cx, 2, 36, 10, 8, C.red); R(cx, 1, 8, 12, 4, C.metalD); R(cx, 3, 2, 8, 6, C.starL); R(cx, 4, 0, 6, 3, C.red);
    });
    sp.desk2 = art.mk(34, 24, function (cx) { R(cx, 0, 0, 34, 4, C.woodL); R(cx, 2, 4, 4, 20, C.woodD); R(cx, 28, 4, 4, 20, C.woodD); R(cx, 4, -0, 12, 0, C.cream); });
    sp.bag = null;
    S.sprites = sp;

    // ---- backgrounds -----------------------------------------------------------------------
    var DAY = ['#2f3592', '#4b52b8', '#7b72dc', '#aa8bea', '#d9a2ee', '#ffc3d4'];
    var DUSK = ['#2a2468', '#5a3a96', '#a24f9c', '#e66d86', '#ff9a68', '#ffd27a'];
    function skyBands(ctx, colors, y0, h) {
      var n = 24, bh = Math.ceil(h / n);
      for (var i = 0; i < n; i++) { R(ctx, 0, y0 + i * bh, VW, bh, ramp(colors, i / (n - 1))); }
    }
    function skyColors(d) { return DAY.map(function (c, i) { return mix(c, DUSK[i], d); }); }
    S.skyColors = skyColors;

    function hillLayer(color, amp, freq, seed, base) {
      return art.mk(VW * 2, 90, function (cx) {
        for (var x = 0; x < VW * 2; x++) {
          var y = base + Math.round(Math.sin(x * freq + seed) * amp + Math.sin(x * freq * 2.3 + seed * 2) * amp * 0.4);
          R(cx, x, y, 1, 90 - y, color);
        }
      });
    }
    var hills = {
      far: hillLayer('#6a63c4', 9, 0.020, 1.2, 40),
      farDusk: hillLayer('#a2559a', 9, 0.020, 1.2, 40),
      mid: hillLayer('#4a8fb0', 7, 0.031, 4.1, 46),
      midDusk: hillLayer('#6a4a98', 7, 0.031, 4.1, 46),
      near: hillLayer('#3c9a74', 5, 0.045, 2.2, 56),
      nearDusk: hillLayer('#4d5c94', 5, 0.045, 2.2, 56)
    };
    function tileLayer(ctx, img, speed, camX, y, alpha) {
      var off = -Math.floor((camX * speed) % VW);
      if (alpha !== undefined) { ctx.globalAlpha = alpha; }
      ctx.drawImage(img, off, y); ctx.drawImage(img, off + VW, y); ctx.drawImage(img, off + VW * 2, y);
      if (alpha !== undefined) { ctx.globalAlpha = 1; }
    }

    // ---- shared pieces ----------------------------------------------------------------------
    function prompt(ctx, x, y, t, glyphCh, reduce) {
      var bob = reduce ? 0 : Math.round(Math.sin(t * 5) * 1.5);
      var px = Math.round(x - 6), py = Math.round(y - 14 + bob);
      R(ctx, px, py, 13, 11, C.ink); R(ctx, px + 1, py + 1, 11, 9, C.cream); R(ctx, px + 1, py + 8, 11, 2, C.starL);
      R(ctx, px + 5, py + 11, 3, 1, C.ink); R(ctx, px + 6, py + 12, 1, 1, C.ink);
      glyph(ctx, glyphCh || 'E', px + 5, py + 3, C.ink);
    }
    S.prompt = prompt;

    function sparkles(ctx, list, t, ox, oy) {
      list.forEach(function (p) {
        var age = t - p.t0; if (age < 0 || age > p.life) { return; }
        var k = age / p.life;
        var x = p.x + (p.vx || 0) * age - ox, y = p.y + (p.vy || 0) * age + 14 * age * age * (p.g || 0) - oy;
        R(ctx, x, y, p.size || 2, p.size || 2, p.color || C.starL, 1 - k);
      });
    }
    S.sparkles = sparkles;

    function drawPlayer(ctx, cam, pl, anim, t) {
      art.drawMara(ctx, pl.x * T - cam.x, pl.y * T - cam.y, anim, t, pl.facing);
    }

    function vignette(ctx, strength) {
      var s = strength || 0.35;
      R(ctx, 0, 0, VW, 6, C.night, s * 0.5); R(ctx, 0, VH - 6, VW, 6, C.night, s * 0.5);
      R(ctx, 0, 0, 6, VH, C.night, s * 0.35); R(ctx, VW - 6, 0, 6, VH, C.night, s * 0.35);
      R(ctx, 0, 0, 3, VH, C.night, s * 0.3); R(ctx, VW - 3, 0, 3, VH, C.night, s * 0.3);
    }

    // ---- A. study ---------------------------------------------------------------------------
    S.drawStudy = function (ctx, v) {
      var t = v.t, reduce = v.reduce, st = v.state, lampOn = st.flags.lamp;
      // wall and floor
      R(ctx, 0, 0, VW, VH, '#f1dfc2');
      for (var x = 0; x < VW; x += 20) { R(ctx, x, 0, 10, 126, '#ecd7b6'); }
      R(ctx, 0, 100, VW, 3, '#c9a77c'); R(ctx, 0, 103, VW, 41, '#b98a5e'); R(ctx, 0, 103, VW, 1, '#d8b080');
      for (var y = 106; y < 144; y += 9) { R(ctx, 0, y, VW, 1, '#a07448'); }
      R(ctx, 0, 144, VW, 32, '#8a5c3a'); R(ctx, 0, 144, VW, 2, '#b98a5e');
      for (var fx = 0; fx < VW; fx += 26) { R(ctx, fx + ((fx / 26) % 2 ? 8 : 0), 146, 1, 30, '#6e4630'); }
      for (var fy = 156; fy < VH; fy += 10) { R(ctx, 0, fy, VW, 1, '#6e4630', 0.7); }
      // window with a golden evening sky and swaying curtains
      var wx = 138, wy = 22, ww = 56, wh = 62;
      R(ctx, wx - 3, wy - 3, ww + 6, wh + 6, C.woodDD);
      for (var i = 0; i < 12; i++) { R(ctx, wx, wy + i * 5.2, ww, 5.4, ramp(['#8a7ae0', '#e68ec0', '#ffb070', '#ffe090'], i / 11)); }
      ctx.fillStyle = C.cream; ellipse(ctx, wx + 38, wy + 40, 7, 7, '#fff2b0'); ellipse(ctx, wx + 38, wy + 40, 12, 12, '#ffe090', 0.35);
      R(ctx, wx, wy + 44, ww, 18, '#7a5a9e', 0.8); R(ctx, wx + 6, wy + 40, 12, 22, '#5a3f86', 0.9); R(ctx, wx + 20, wy + 46, 10, 16, '#5a3f86', 0.9);
      R(ctx, wx + ww / 2 - 1, wy, 2, wh, C.woodDD); R(ctx, wx, wy + wh / 2 - 1, ww, 2, C.woodDD);
      var sway = reduce ? 0 : Math.sin(t * 0.9) * 2;
      for (var c = 0; c < 2; c++) {
        var side = c ? 1 : -1, base = c ? wx + ww + 2 : wx - 2;
        for (var yy = 0; yy < wh + 14; yy += 2) { var bend = Math.round(sway * (yy / wh) * side); R(ctx, base + (c ? -9 : 0) + bend + (side > 0 ? 0 : 0), wy - 4 + yy, 9, 2, (yy % 8 < 4) ? C.scarf : C.scarfS); }
      }
      R(ctx, wx - 8, wy - 8, ww + 16, 4, C.woodDD);
      // golden light shaft from the window to the floor
      for (var l = 0; l < 20; l++) { R(ctx, wx + 8 + l * 4 - 18, wy + 64 + l * 5, 48, 5, '#ffe6a0', 0.10 - l * 0.003); }
      // furniture
      ctx.drawImage(sp.poster, 78, 40);
      ctx.drawImage(sp.bookshelf, 19, 44);
      ctx.drawImage(sp.rug, 120, 148);
      ctx.drawImage(sp.sidetable, 80, 114);
      var tapeGlow = !st.flags.tape;
      if (!st.flags.tape) { ctx.drawImage(sp.tape[reduce ? 0 : (Math.floor(t * 2) % 2)], 83, 109); }
      ctx.drawImage(sp.frame, 112, 54);
      ctx.drawImage(sp.desk, 196, 104);
      ctx.drawImage(sp.chair, 208, 118);
      // CRT with a soft breathing glow
      var breathe = reduce ? 0.5 : (Math.sin(t * 1.8) + 1) / 2;
      [[44, 32, 0.025], [36, 26, 0.03], [28, 21, 0.035], [20, 15, 0.04]].forEach(function (g) { ellipse(ctx, 233, 94, g[0], g[1], C.screen, g[2] + breathe * 0.025); });
      ctx.drawImage(sp.crt[reduce ? 0 : (Math.floor(t * 2) % 2)], 216, 78);
      ctx.drawImage(sp.notes, 207, 90);
      ctx.drawImage(sp.lamp[lampOn ? 1 : 0], 266, 78);
      if (lampOn) { ellipse(ctx, 275, 100, 26, 14, '#ffe6a0', 0.16); }
      // dust motes in the light
      if (!reduce) { for (var m = 0; m < 14; m++) { var mx = (wx + 10 + (m * 37 + t * 4) % 70), my = wy + 70 + ((m * 53 + t * 6) % 60); R(ctx, mx, my, 1, 1, '#fff2c0', 0.6); } }
      // book that fell off the shelf
      if (st.flags.bookFell) { R(ctx, 56, 140, 14, 4, C.red); R(ctx, 57, 139, 12, 1, C.cream); R(ctx, 56, 143, 14, 1, C.ink); }
      // objects: prompt bubble over the nearest one in range
      if (v.near) { var o = v.near; prompt(ctx, o.x * T, studyTop(o), t, 'E', reduce); }
      if (v.player) { art.drawMara(ctx, v.player.x * T, v.player.y * T, v.anim, t, v.player.facing); }
      sparkles(ctx, v.particles || [], t, 0, 0);
      vignette(ctx, 0.5);
    };
    function studyTop(o) { return { shelf: 56, tape: 100, photo: 100, notes: 80, monitor: 74, lamp: 78 }[o.id] || 100; }

    // ---- B, C, E. the world -----------------------------------------------------------------
    var WATER = [[17, 19], [46, 48]];
    function drawWater(ctx, cam, t, reduce, c0, c1, row) {
      var x0 = c0 * T - cam.x, w = (c1 - c0 + 1) * T, y0 = row * T - cam.y;
      R(ctx, x0, y0, w, (14 - row) * T, C.waterD);
      R(ctx, x0, y0, w, 3, C.waterL); R(ctx, x0, y0 + 3, w, 2, C.water);
      for (var i = 0; i < w; i += 6) { var wob = reduce ? 0 : Math.round(Math.sin(t * 2 + i * 0.6 + c0) * 1); R(ctx, x0 + i, y0 + 8 + (i % 12) / 3 + wob, 4, 1, C.waterL, 0.7); R(ctx, x0 + i + 2, y0 + 14 + wob, 3, 1, C.water, 0.8); }
      R(ctx, x0, y0 + 16, w, (14 - row) * T - 16, C.waterDD, 0.55);
    }

    S.cameraFor = function (px, py, world, vw, vh) {
      return { x: clamp(Math.round(px * T - VW / 2), 0, Math.max(0, world.w * T - VW)), y: clamp(Math.round(py * T - 112), -24, Math.max(0, world.h * T - VH)) };
    };

    S.drawWorld = function (ctx, v) {
      var t = v.t, reduce = v.reduce, cam = v.cam, world = v.world, st = v.state;
      var cxm = (cam.x + VW / 2) / T;
      var dusk = clamp((cxm - 66) / 24, 0, 1);
      var cols = skyColors(dusk);
      skyBands(ctx, cols, 0, VH);
      // stars at dusk, sun
      if (dusk > 0.2) { for (var i = 0; i < 24; i++) { var tw = reduce ? 1 : (Math.sin(t * 2 + i) + 1) / 2; R(ctx, (i * 53) % VW, (i * 29) % 70, 1, 1, '#ffffff', (dusk - 0.2) * (0.35 + 0.5 * tw)); } }
      var sunX = 236 + dusk * 20, sunY = 60 + dusk * 30 - cam.y * 0.15;
      ellipse(ctx, sunX, sunY, 22, 22, '#ffe9b0', 0.25); ellipse(ctx, sunX, sunY, 15, 15, '#fff2c8', 0.5); ellipse(ctx, sunX, sunY, 10, 10, '#fffbe8');
      // clouds drifting slowly
      [[0, 14, 0.04, 0], [1, 38, 0.07, 140], [2, 24, 0.05, 250], [0, 56, 0.09, 60]].forEach(function (c) {
        var drift = reduce ? 0 : t * 5 * c[2] * 10;
        var x = ((c[3] - cam.x * c[2] - drift) % (VW + 90) + (VW + 90)) % (VW + 90) - 70;
        ctx.drawImage(sp.cloud[c[0]], Math.round(x), Math.round(c[1] - cam.y * 0.08));
      });
      var hy = 66 - Math.round(cam.y * 0.35);
      // distant sea and lighthouse
      var seaY = hy + 44;
      R(ctx, 0, seaY, VW, VH, mix('#4b7fd0', '#e0807a', dusk));
      for (var sy = 0; sy < 12; sy++) { R(ctx, 0, seaY + sy * 6, VW, 1, '#ffffff', 0.08 + (sy % 2) * 0.04); }
      var lhx = Math.round(260 - cam.x * 0.18);
      if (lhx > -20 && lhx < VW + 20) { ctx.drawImage(sp.lighthouse, lhx, seaY - 52); }
      tileLayer(ctx, dusk > 0.5 ? hills.farDusk : hills.far, 0.12, cam.x, hy);
      tileLayer(ctx, dusk > 0.5 ? hills.midDusk : hills.mid, 0.22, cam.x, hy + 10);
      tileLayer(ctx, dusk > 0.5 ? hills.nearDusk : hills.near, 0.36, cam.x, hy + 22);

      // canyon depth behind the gap
      var gx0 = 62 * T - cam.x, gw = 10 * T;
      if (gx0 < VW && gx0 + gw > 0) {
        for (var k = 0; k < 8; k++) { R(ctx, gx0, 11 * T - cam.y + k * 14, gw, 14, mix('#4a3f82', '#1c1640', k / 7), 0.95); }
        for (var vx = 0; vx < gw; vx += 9) { R(ctx, gx0 + vx, 11 * T - cam.y, 1, 120, '#2a2158', 0.7); }
        for (var m = 0; m < 16 && !reduce; m++) { R(ctx, gx0 + ((m * 41 + t * 6) % gw), 11 * T - cam.y + ((m * 29 + t * 10) % 90), 1, 1, '#b9a8ff', 0.5); }
      }
      WATER.forEach(function (w) { drawWater(ctx, cam, t, reduce, w[0], w[1], 12); });
      drawWater(ctx, cam, t, reduce, 109, 121, 11);

      // tiles
      var c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(world.w - 1, Math.floor((cam.x + VW) / T) + 1);
      var r0 = Math.max(0, Math.floor(cam.y / T) - 1), r1 = Math.min(world.h - 1, Math.floor((cam.y + VH) / T) + 1);
      for (var r = r0; r <= r1; r++) { for (var c = c0; c <= c1; c++) { var ch = world.cells[r][c]; if (ch !== '.' && ch !== 'x') { art.drawTile(ctx, world, ch, c, r, c * T - cam.x, r * T - cam.y); } } }
      // shade the canyon walls where tiles face the gap
      R(ctx, 62 * T - cam.x - 3, 11 * T - cam.y, 3, 40, C.night, 0.25);
      R(ctx, 72 * T - cam.x, 10 * T - cam.y, 3, 60, C.night, 0.25);

      var px = function (x) { return Math.round(x * T - cam.x); }, py = function (y) { return Math.round(y * T - cam.y); };
      var D = data.WORLD_DECOR;
      D.palms.forEach(function (p) { ctx.drawImage(P.palm, px(p[0]) - 14, py(p[1]) - 52); });
      D.trees.forEach(function (p) { if (px(p[0]) > -40 && px(p[0]) < VW + 40) { ctx.drawImage(P.tree, px(p[0]) - 16, py(p[1]) - 48); } });
      D.bushes.forEach(function (p) { ctx.drawImage(P.bush, px(p[0]) - 10, py(p[1]) - 12); });
      D.shells.forEach(function (p) { ctx.drawImage(P.shell, px(p[0]), py(p[1]) - 4); });
      D.flowers.forEach(function (p, i) {
        var sw = reduce ? 0 : Math.round(Math.sin(t * 1.6 + i) * 1);
        ctx.drawImage(P.flower[i % 4], px(p[0]) + sw, py(p[1]) - 10);
      });
      // garden on the secret platform
      for (var gcol = 39; gcol <= 42; gcol += 3) { ctx.drawImage(P.flower[(gcol / 3) % 4], px(gcol) + 4, py(1) - 10); }
      ctx.drawImage(sp.noteStand, px(40.5) - 9, py(1) - 26);
      // posts, signs, door, cat, crab, flags
      data.WORLD_OBJECTS.forEach(function (o) {
        if (o.requires && !st[o.requires]) { return; }
        var x = px(o.x), y = py(o.y);
        if (x < -40 || x > VW + 40) { return; }
        var read = st.read && st.read.indexOf(o.id) >= 0;
        if (o.id === 'cat') { ctx.drawImage(P.cat[reduce ? 0 : (Math.floor(t * 1.2) % 2)], x - 10, y - 12); }
        else if (o.id === 'crab') { var cxo = reduce ? 0 : Math.round(Math.sin(t * 0.8) * 10); ctx.drawImage(P.crab[reduce ? 0 : (Math.floor(t * 4) % 2)], x - 8 + cxo, y - 10); }
        else if (o.id === 'door' || o.id === 'serverReturn') { ctx.drawImage(P.door[reduce ? 0 : (Math.floor(t * 1.5) % 2)], x - 24, y - 28 + 4); }
        else if (o.id === 'blueprint') { ctx.drawImage(sp.blueprint, x - 17, y - 36); }
        else if (o.id === 'terminal') { ctx.drawImage(sp.terminal[reduce ? 0 : (Math.floor(t * 1.5) % 2)], x - 18, y - 40); if (!reduce) { ellipse(ctx, x, y - 24, 22, 16, C.amber, 0.06 + 0.05 * Math.sin(t * 2)); } }
        else if (o.id === 'bridge' || o.id === 'garden') { /* drawn by posts / note stand */ }
        else if (o.type === 'read') { ctx.drawImage(P.sign[read ? 1 : 0], x - 9, y - 24); }
      });
      data.CHECKPOINTS.forEach(function (cp) { var x = px(cp.x), y = py(cp.y); if (x > -20 && x < VW + 20) { ctx.drawImage(P.flag[st.cp >= cp.id ? 1 : 0], x - 3, y - 28); } });
      D.posts.forEach(function (p) { ctx.drawImage(sp.post, px(p[0]) - 5, py(p[1]) - 40); if (!reduce) { ellipse(ctx, px(p[0]), py(p[1]) - 36, 14, 10, C.amber, 0.08 + 0.05 * Math.sin(t * 3 + p[0])); } });

      // stars
      var sOnly = v.stars || [];
      sOnly.forEach(function (s) {
        var x = px(s[1] + 0.5), y = py(s[2] + 0.5) + (reduce ? 0 : Math.round(Math.sin(t * 3 + s[1]) * 1.5));
        if (x < -10 || x > VW + 10) { return; }
        var f = reduce ? 0 : (Math.floor(t * 4 + s[1]) % 3);
        ctx.drawImage(P.star[f], x - 6, y - 6);
        if (!reduce) { ellipse(ctx, x, y, 8, 8, C.starL, 0.12); }
      });

      // bridge build animation drops planks in one at a time
      (v.building || []).forEach(function (b) {
        var age = t - b.t0; if (age < 0) { return; }
        var drop = reduce ? 0 : Math.max(0, 10 - age * 80);
        var x = px(b.col), y = py(b.row) - Math.round(drop);
        ctx.drawImage(art.tiles.P, x, y);
        if (age < 0.4) { R(ctx, x, y - 2, 16, 2, C.starL, 0.9 - age * 2); }
      });

      // player and foreground grass
      if (v.player) { drawPlayer(ctx, cam, v.player, v.anim, t); }
      for (var gc = c0; gc <= c1; gc++) {
        for (var gr = r0; gr <= r1; gr++) {
          if (world.cells[gr][gc] === 'G') {
            for (var b = 0; b < 3; b++) {
              var bx = gc * T - cam.x + 2 + b * 5 + ((gc * 7 + b * 3) % 3), sw2 = reduce ? 0 : Math.round(Math.sin(t * 2.2 + gc * 0.7 + b) * 1.2);
              var bh = 3 + ((gc + b) % 3);
              R(ctx, bx + sw2, gr * T - cam.y - bh + 1, 1, bh, b % 2 ? C.grassL : C.grass);
              R(ctx, bx + sw2 * 2, gr * T - cam.y - bh, 1, 1, C.grassL);
            }
          }
        }
      }
      sparkles(ctx, v.particles || [], t, cam.x, cam.y);
      if (v.near) { var o2 = v.near; prompt(ctx, px(o2.x), py(o2.y) - ({ terminal: 50, door: 36, serverReturn: 36, bridge: 48, blueprint: 46, cat: 20, crab: 18 }[o2.id] || 30), t, 'E', reduce); }
      // warm light and dusk tint
      R(ctx, 0, 0, VW, VH, '#ff9a68', 0.05 + dusk * 0.08);
      vignette(ctx, 0.25);
      if (v.fade > 0) { R(ctx, 0, 0, VW, VH, '#000000', v.fade); }
    };

    // ---- D. server room ---------------------------------------------------------------------
    S.drawServer = function (ctx, v) {
      var t = v.t, reduce = v.reduce, cam = v.cam, world = v.world, st = v.state;
      R(ctx, 0, 0, VW, VH, '#120e2a');
      for (var i = 0; i < 16; i++) { R(ctx, 0, i * 10, VW, 10, mix('#120e2a', '#1d2a55', i / 15)); }
      // back wall grid that scrolls with the camera
      for (var gx = -((cam.x * 0.5) % 24); gx < VW; gx += 24) { R(ctx, gx, 0, 1, 144, C.cyan, 0.07); }
      for (var gy = 8; gy < 144; gy += 18) { R(ctx, 0, gy, VW, 1, C.cyan, 0.06); }
      // hanging cables
      for (var cb = 0; cb < 8; cb++) {
        var bx = (cb * 83 - cam.x * 0.8 + 40) % (VW + 100) - 20;
        var sway = reduce ? 0 : Math.sin(t * 0.8 + cb) * 3;
        R(ctx, bx, 0, 2, 22 + (cb % 3) * 8, cb % 2 ? C.metalD : C.metalDD);
        R(ctx, bx + sway, 22 + (cb % 3) * 8, 2, 8, [C.red, C.amber, C.cyan][cb % 3]);
      }
      // racks (each one is a server copy), exit door, floppies
      data.SERVER_OBJECTS.forEach(function (o) {
        var x = Math.round(o.x * T - cam.x), y = Math.round(o.y * T);
        if (o.copy) {
          var seen = st.serverSeen.indexOf(o.copy) >= 0;
          ellipse(ctx, x, y - 30, 30, 34, art.RACK_THEME[o.copy], reduce ? 0.07 : 0.05 + 0.04 * Math.sin(t * 2 + o.x));
          ctx.drawImage(P.rack[o.copy][reduce ? 0 : (Math.floor(t * 2 + o.x) % 2)], x - 16, y - 56);
          R(ctx, x - 12, y - 60, 24, 3, art.RACK_THEME[o.copy]);
          if (seen) { R(ctx, x - 3, y - 66, 6, 4, C.green); R(ctx, x - 2, y - 65, 4, 2, C.cream); }
        } else if (o.id === 'exit') {
          R(ctx, x - 12, y - 40, 24, 40, C.metalDD); R(ctx, x - 10, y - 38, 20, 38, C.metalD); R(ctx, x - 8, y - 36, 16, 36, '#ffe6a0', 0.9); R(ctx, x - 8, y - 36, 16, 3, C.cream);
          R(ctx, x - 7, y - 46, 14, 4, C.ink); R(ctx, x - 6, y - 45, 12, 2, C.green); ellipse(ctx, x, y - 44, 14, 6, C.green, reduce ? 0.12 : 0.08 + 0.06 * Math.sin(t * 3));
        }
      });
      data.SERVER_FLOPPIES.forEach(function (f) {
        if (st.floppies.indexOf(f[0]) >= 0) { return; }
        var x = Math.round((f[1] + 0.5) * T - cam.x), y = Math.round((f[2] + 0.5) * T) + (reduce ? 0 : Math.round(Math.sin(t * 3 + f[1]) * 1.5));
        ctx.drawImage(P.floppy, x - 5, y - 5);
        if (!reduce) { ellipse(ctx, x, y, 9, 9, C.cyan, 0.1); }
      });
      // tiles
      var c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(world.w - 1, Math.floor((cam.x + VW) / T) + 1);
      for (var r = 0; r < world.h; r++) { for (var c = c0; c <= c1; c++) { var ch = world.cells[r][c]; if (ch !== '.' && ch !== 'x') { art.drawTile(ctx, world, ch, c, r, c * T - cam.x, r * T); } } }
      // drifting data motes
      if (!reduce) { for (var m = 0; m < 26; m++) { R(ctx, (m * 61 + t * 8) % VW, 140 - ((m * 37 + t * 14) % 130), 1, 1, m % 3 ? C.green : C.cyan, 0.5); } }
      if (v.player) { art.drawMara(ctx, v.player.x * T - cam.x, v.player.y * T, v.anim, t, v.player.facing); }
      if (v.near) { prompt(ctx, v.near.x * T - cam.x, v.near.id === 'exit' ? 74 : 78, t, 'E', reduce); }
      sparkles(ctx, v.particles || [], t, cam.x, 0);
      R(ctx, 0, 0, VW, VH, C.cyan, 0.03);
      vignette(ctx, 0.5);
      if (v.fade > 0) { R(ctx, 0, 0, VW, VH, '#000000', v.fade); }
    };

    // ---- the memory island ------------------------------------------------------------------
    S.drawIsland = function (ctx, v) {
      var t = v.t, reduce = v.reduce, st = v.state, world = v.world, stage = v.stage, prog = v.stageProgress;
      var cam = v.cam;
      skyBands(ctx, ['#2d2a78', '#6a4aa8', '#c0609c', '#f08a7a', '#ffc27a', '#ffe4a0'], 0, VH);
      for (var i = 0; i < 30; i++) { var tw = reduce ? 1 : (Math.sin(t * 2 + i * 1.7) + 1) / 2; R(ctx, (i * 47) % VW, (i * 23) % 60, 1, 1, '#ffffff', 0.3 + 0.5 * tw); }
      ellipse(ctx, 250, 72, 26, 26, '#ffe9b0', 0.25); ellipse(ctx, 250, 72, 16, 16, '#fff5d0');
      ctx.drawImage(sp.cloud[1], 30 - Math.round(cam.x * 0.1), 18); ctx.drawImage(sp.cloud[0], 190 - Math.round(cam.x * 0.1), 30);
      // sea
      var seaTop = 96;
      for (var s = 0; s < 80; s += 4) { R(ctx, 0, seaTop + s, VW, 4, mix('#f09a7a', '#2a4ba0', Math.min(1, s / 70))); }
      for (var w = 0; w < 14; w++) { var wx = ((w * 53 + (reduce ? 0 : t * 12 * (1 + w % 3 * 0.3))) % (VW + 20)) - 10, wy = seaTop + 6 + w * 5; R(ctx, wx, wy, 8 + w % 4 * 3, 1, '#ffffff', 0.35); }
      ellipse(ctx, 250 - cam.x * 0.0, seaTop + 6, 20, 2, '#fff2c0', 0.5);
      if (stage < 1) { R(ctx, 0, 0, VW, VH, '#000000', 0.0); }
      // ground and coast grow in stage 1
      var g = stage >= 1 ? 1 : 0, gp = stage === 1 ? prog : 1;
      if (stage >= 1) {
        var c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(world.w - 1, Math.floor((cam.x + VW) / T) + 1);
        var revealCols = stage > 1 ? 99 : Math.ceil(gp * 26);
        for (var r = 0; r < world.h; r++) {
          for (var c = c0; c <= c1; c++) {
            var ch = world.cells[r][c];
            if (ch === '.' || ch === 'x') { continue; }
            var mid = 15.5, dist = Math.abs(c - mid);
            if (stage === 1 && dist > revealCols / 2) { continue; }
            art.drawTile(ctx, world, ch, c, r, c * T - cam.x, r * T - cam.y);
          }
        }
        // foam along the island edge
        for (var fo = 0; fo < 6; fo++) { var fx = 2 * T - cam.x - 4 + Math.sin((reduce ? 0 : t) * 2 + fo) * 2; R(ctx, fx, (9 + (fo % 2)) * T - cam.y + fo * 4, 5, 1, '#ffffff', 0.6); R(ctx, 29 * T - cam.x + 2 + Math.sin((reduce ? 0 : t) * 2 + fo) * 2, (9 + (fo % 2)) * T - cam.y + fo * 4, 5, 1, '#ffffff', 0.6); }
      }
      var gy = 8 * T - cam.y;
      function gro(minStage) { return stage > minStage ? 1 : (stage === minStage ? prog : 0); }
      var ox = -cam.x;
      // cabin (stage 2)
      if (stage >= 2) { art.drawGrow(ctx, sp.cabin, 9.5 * T - 32 + ox, gy - 52, reduce ? (stage >= 2 ? 1 : 0) : gro(2)); }
      // trees and flowers (stage 3)
      if (stage >= 3) {
        var k3 = reduce ? 1 : gro(3);
        art.drawGrow(ctx, P.tree, 14.6 * T - 16 + ox, gy - 48, k3); art.drawGrow(ctx, P.tree, 5.2 * T - 16 + ox, gy - 48, k3); art.drawGrow(ctx, P.tree, 26.8 * T - 16 + ox, gy - 48, k3);
        [4, 7, 12, 16, 18, 21, 23, 25, 27].forEach(function (fc, i) { art.drawGrow(ctx, P.flower[i % 4], fc * T + 4 + ox, gy - 10, k3); });
        [[7.2], [19], [24]].forEach(function (b) { art.drawGrow(ctx, P.bush, b[0] * T + ox - 10, gy - 12, k3); });
      }
      // console (stage 4)
      if (stage >= 4) {
        var k4 = reduce ? 1 : gro(4), cxp = 12.4 * T + ox;
        art.drawGrow(ctx, sp.islandConsole[reduce ? 0 : (Math.floor(t * 2) % 2)], cxp - 11, gy - 22, k4);
        if (k4 >= 1 && !reduce) { ellipse(ctx, cxp, gy - 12, 18, 12, C.screen, 0.07 + 0.04 * Math.sin(t * 2)); }
      }
      // memory objects (stage 5)
      if (stage >= 5) {
        var k5 = reduce ? 1 : gro(5);
        ctx.globalAlpha = 1;
        art.drawGrow(ctx, sp.frameStand, 17.2 * T - 10 + ox, gy - 36, k5);
        if (st.flags.tape) { art.drawGrow(ctx, sp.player, 19.6 * T - 8 + ox, gy - 14, k5); }
        if (st.flags.catPetted) { art.drawGrow(ctx, P.cat[reduce ? 0 : (Math.floor(t * 1.2) % 2)], 22 * T - 10 + ox, gy - 12, k5); }
        art.drawGrow(ctx, sp.jar, 24.2 * T - 7 + ox, gy - 18, k5);
        if (st.flags.garden) { art.drawGrow(ctx, sp.noteStand, 26.4 * T - 9 + ox, gy - 26, k5); }
      }
      // lantern stars for collected stars
      var n = Math.min(10, st.stars.length);
      for (var s2 = 0; s2 < n && stage >= 5; s2++) { var lx = (4 + s2 * 2.4) * T + ox, ly = 40 + Math.round(Math.sin((reduce ? 0 : t) * 1.4 + s2) * 3); ctx.drawImage(P.star[reduce ? 0 : (Math.floor(t * 3 + s2) % 3)], lx, ly); ellipse(ctx, lx + 6, ly + 6, 9, 9, C.starL, 0.12); }
      if (v.player) { drawPlayer(ctx, cam, v.player, v.anim, t); }
      if (v.near) { prompt(ctx, v.near.x * T + ox, 8 * T - cam.y - ({ cabin: 60, tree: 54, photo: 40, note: 30, cat: 16 }[v.near.id] || 30), t, 'E', reduce); }
      sparkles(ctx, v.particles || [], t, cam.x, 0);
      R(ctx, 0, 0, VW, VH, '#ff9a68', 0.06);
      vignette(ctx, 0.3);
      if (v.fade > 0) { R(ctx, 0, 0, VW, VH, '#000000', v.fade); }
    };

    // ---- title backdrop ---------------------------------------------------------------------
    S.drawTitle = function (ctx, v) {
      var cam = { x: 6 * T + Math.round(v.reduce ? 0 : v.t * 8), y: 48 };
      var world = v.world;
      S.drawWorld(ctx, { t: v.t, reduce: v.reduce, cam: cam, world: world, state: v.state, stars: [], player: { x: 3.5 + 6 + (v.reduce ? 0 : (v.t * 8) / T) * 0, y: 10, facing: 1 }, anim: 'idle', particles: [], near: null, fade: 0 });
    };

    // ---- puzzle art ------------------------------------------------------------------------
    var pieceCache = {};
    function plankTile(build, corrupt, col, row) {
      return art.mk(16, 16, function (cx) {
        if (build === 3) { cx.drawImage(art.tiles.P, 0, 0); }
        else {
          // build 2: an older rope-and-board bridge, greyer wood, with a rope rail
          R(cx, 0, 2, 16, 5, '#b09a82'); R(cx, 0, 2, 16, 1, '#d2c4ae'); R(cx, 0, 6, 16, 1, '#7a6a58');
          R(cx, 4, 3, 1, 3, '#7a6a58'); R(cx, 11, 3, 1, 3, '#7a6a58'); R(cx, 0, 7, 16, 1, '#5a4c40');
          R(cx, 0, 8, 16, 1, '#8a7a62'); R(cx, 2, 9, 1, 5, '#8a7a62', 0.7); R(cx, 13, 9, 1, 5, '#8a7a62', 0.7);
        }
      });
    }
    // A bridge fragment as a canvas: width w*16, height 16 * (max height + 1) so raised columns fit.
    S.pieceCanvas = function (id) {
      if (pieceCache[id]) { return pieceCache[id]; }
      var pc = puzzle.PIECES[id];
      var maxH = Math.max.apply(null, pc.profile);
      var cv = art.mk(pc.w * 16, 16 * (maxH + 1) + 6, function (cx) {
        pc.profile.forEach(function (h, i) {
          var y = (maxH - h) * 16;
          cx.drawImage(plankTile(pc.build, pc.corrupt), i * 16, y);
          // rails: build 3 gets posts at both ends of the piece, build 2 gets a rope line
          if (pc.build === 3 && (i === 0 || i === pc.w - 1)) { R(cx, i === 0 ? 1 : 13, y - 6, 2, 6, C.woodD); R(cx, i === 0 ? 1 : 13, y - 6, 2, 1, C.woodL); }
          if (pc.build === 2) { R(cx, i * 16, y - 3, 16, 1, '#8a7a62'); if (i === 0 || i === pc.w - 1) { R(cx, i * 16 + (i === 0 ? 1 : 13), y - 7, 2, 7, '#6a5a4a'); } }
        });
        // build stamp on the first plank
        var yy = (maxH - pc.profile[0]) * 16;
        R(cx, 2, yy + 8, 11, 7, C.ink); R(cx, 3, yy + 9, 9, 5, pc.build === 3 ? C.star : '#c9b79a');
        text(cx, 'B' + pc.build, 4, yy + 10, C.ink);
        if (pc.corrupt) {
          var rnd = art.seeded(77);
          for (var g = 0; g < 14; g++) { R(cx, Math.floor(rnd() * pc.w * 16), Math.floor(rnd() * (16 * (maxH + 1))), 3 + Math.floor(rnd() * 10), 1 + Math.floor(rnd() * 2), g % 3 === 0 ? '#ff2fd0' : g % 3 === 1 ? C.cyan : C.night, 0.9); }
          R(cx, 16, 0, 2, 16, C.night, 0.0);
          for (var h = 0; h < 4; h++) { R(cx, 16 + h * 8, 4 + (h % 2) * 5, 6, 4, C.night); }
        }
      });
      pieceCache[id] = cv;
      return cv;
    };

    // Layout shared by the canvas and the DOM slot overlay (pixels in the 320 x 176 restore view).
    S.RESTORE = { baseY: 100, cliffW: 80, slotX: { s1: 80, s2: 128, s3: 192 }, slotW: { s1: 48, s2: 64, s3: 48 }, top: 56, height: 64 };

    function drawCliff(ctx, x, w, topY, theme) {
      R(ctx, x, topY, w, VH - topY, C.rock);
      for (var y = topY; y < VH; y += 16) { for (var xx = x; xx < x + w; xx += 16) { ctx.drawImage(art.tiles[(y === topY ? 'R' : 'r') + ((Math.floor(xx / 16) + Math.floor(y / 16)) % 3)], xx, y); } }
    }

    S.drawRestore = function (ctx, v) {
      var t = v.t, reduce = v.reduce, L = S.RESTORE, placed = v.placed || {}, pulse = reduce ? 0.5 : (Math.sin(t * 3) + 1) / 2;
      skyBands(ctx, skyColors(0.55), 0, VH);
      ellipse(ctx, 250, 40, 14, 14, '#fff2c8', 0.8);
      ctx.drawImage(sp.cloud[0], 20, 12); ctx.drawImage(sp.cloud[2], 200, 24);
      tileLayer(ctx, hills.midDusk, 0.0, 0, 70);
      // canyon depth
      for (var k = 0; k < 8; k++) { R(ctx, 80, 112 + k * 9, 160, 9, mix('#4a3f82', '#1c1640', k / 7)); }
      drawCliff(ctx, 0, 80, 100); drawCliff(ctx, 240, 80, 84);
      ctx.drawImage(sp.post, 74, 60); ctx.drawImage(sp.post, 236, 44);
      ctx.drawImage(sp.blueprint, 16, 64);
      // anchors that show the world's build
      R(ctx, 92, 30, 24, 16, C.ink); R(ctx, 93, 31, 22, 14, C.star); R(ctx, 93, 31, 22, 2, C.starL); text(ctx, 'B3', 98, 36, C.ink); R(ctx, 103, 46, 2, 6, C.ink); R(ctx, 100, 50, 8, 2, C.ink);
      // slot outlines and placed pieces
      puzzle.SLOTS.forEach(function (slot) {
        var x = L.slotX[slot.id], w = L.slotW[slot.id];
        var id = placed[slot.id];
        if (id) {
          var cv = S.pieceCanvas(id), maxH = Math.max.apply(null, puzzle.PIECES[id].profile);
          ctx.drawImage(cv, x, L.baseY - maxH * 16);
        } else {
          var a = 0.5 + pulse * 0.4;
          R(ctx, x, L.baseY, w, 1, C.starL, a); R(ctx, x, L.baseY + 15, w, 1, C.starL, a * 0.6);
          R(ctx, x, L.baseY, 1, 16, C.starL, a); R(ctx, x + w - 1, L.baseY, 1, 16, C.starL, a);
          for (var d = 16; d < w; d += 16) { R(ctx, x + d, L.baseY + 2, 1, 12, C.starL, 0.25); }
          var raised = slot.profile[slot.profile.length - 1] === 1;
          if (raised) { R(ctx, x + w - 16, L.baseY - 16, 16, 1, C.starL, a * 0.6); R(ctx, x + w - 1, L.baseY - 16, 1, 16, C.starL, a * 0.6); }
        }
      });
      if (v.flash) { var f = v.flash; if (t - f.t0 < 0.5) { R(ctx, L.slotX[f.slot], L.baseY - 20, L.slotW[f.slot], 40, f.ok ? C.green : C.red, 0.35 * (1 - (t - f.t0) / 0.5)); } }
      vignette(ctx, 0.3);
    };

    // The server copy as it remembers the bridge: complete in build 2, ends only in the archive, a middle in the lab.
    S.drawCopy = function (ctx, v) {
      var copy = puzzle.COPIES[v.copy], t = v.t, reduce = v.reduce, L = S.RESTORE;
      var old = copy.build === 2;
      skyBands(ctx, old ? ['#6a5a7a', '#8a7a8a', '#b09a90', '#d0b8a0', '#e8d0b0', '#f0e0c0'] : skyColors(0.2), 0, VH);
      ellipse(ctx, 250, 40, 14, 14, old ? '#f0e0c0' : '#fff2c8', 0.8);
      if (!old) { ctx.drawImage(sp.cloud[1], 40, 16); }
      tileLayer(ctx, old ? hills.far : hills.mid, 0.0, 0, 70);
      for (var k = 0; k < 8; k++) { R(ctx, 80, 112 + k * 9, 160, 9, mix(old ? '#6a5a60' : '#4a3f82', '#1c1640', k / 7)); }
      drawCliff(ctx, 0, 80, 100); drawCliff(ctx, 240, 80, 84);
      var byWidth = {};
      copy.pieces.forEach(function (id) { var p = puzzle.PIECES[id]; var slot = null; puzzle.SLOTS.forEach(function (s) { if (s.w === p.w && JSON.stringify(s.profile) === JSON.stringify(p.profile)) { slot = s; } }); if (slot && !byWidth[slot.id]) { byWidth[slot.id] = id; } });
      puzzle.SLOTS.forEach(function (slot) {
        var x = L.slotX[slot.id], id = byWidth[slot.id];
        if (id) {
          var cv = S.pieceCanvas(id), maxH = Math.max.apply(null, puzzle.PIECES[id].profile);
          var sag = old ? (slot.id === 's2' ? 4 : 2) : 0;
          ctx.drawImage(cv, x, L.baseY - maxH * 16 + sag);
        } else {
          // missing: static noise where the data is gone
          var rnd = art.seeded(5 + (reduce ? 0 : Math.floor(t * 8)));
          for (var n = 0; n < 24; n++) { R(ctx, x + Math.floor(rnd() * L.slotW[slot.id]), L.baseY - 4 + Math.floor(rnd() * 22), 2 + Math.floor(rnd() * 5), 1, n % 2 ? C.cyan : '#ff2fd0', 0.5); }
          R(ctx, x, L.baseY, L.slotW[slot.id], 1, C.cyan, 0.3); R(ctx, x, L.baseY + 15, L.slotW[slot.id], 1, C.cyan, 0.3);
        }
      });
      // copy plate: name colour and build stamp
      var col = art.RACK_THEME[v.copy];
      R(ctx, 6, 6, 78, 20, C.ink); R(ctx, 7, 7, 76, 18, C.night2); R(ctx, 7, 7, 76, 2, col);
      R(ctx, 10, 12, 20, 11, C.star); text(ctx, 'B' + copy.build, 13, 15, C.ink);
      for (var q = 0; q < 6; q++) { R(ctx, 36 + q * 7, 15, 5, 1, col, 0.8); R(ctx, 36 + q * 7, 19, 3, 1, col, 0.5); }
      vignette(ctx, 0.3);
      if (old) { R(ctx, 0, 0, VW, VH, '#a08a6a', 0.12); }
    };

    // Small icon for a failure reason: stamp / damaged / length / edges.
    S.reasonIcon = function (reason) {
      return art.mk(13, 13, function (cx) {
        R(cx, 0, 0, 13, 13, C.ink); R(cx, 1, 1, 11, 11, C.red);
        if (reason === 'build') { text(cx, 'B2', 3, 4, C.cream); R(cx, 2, 9, 9, 1, C.cream); }
        else if (reason === 'corrupt') { R(cx, 2, 3, 5, 1, C.cream); R(cx, 5, 6, 6, 1, C.cream); R(cx, 2, 9, 4, 1, C.cream); R(cx, 8, 4, 1, 2, C.cream); }
        else if (reason === 'width') { R(cx, 2, 6, 9, 1, C.cream); R(cx, 2, 4, 1, 5, C.cream); R(cx, 10, 4, 1, 5, C.cream); R(cx, 5, 4, 1, 3, C.cream); R(cx, 8, 4, 1, 3, C.cream); }
        else { R(cx, 2, 8, 4, 2, C.cream); R(cx, 6, 5, 2, 5, C.cream); R(cx, 8, 5, 3, 2, C.cream); }
      });
    };

    return S;
  }

  return { create: create, VW: VW, VH: VH, mix: mix, ramp: ramp, clamp: clamp };
});
