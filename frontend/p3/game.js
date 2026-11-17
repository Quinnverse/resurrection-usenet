/*
 * P3 browser shell: scenes, canvas drawing, keyboard and touch input, and localStorage autosave.
 * Game rules live in level.js. Strings live in i18n.js. Text is written with textContent, never innerHTML.
 */
(function () {
  'use strict';

  var L = window.P3Level;
  var I = window.P3I18n;

  var SAVE_KEY = 'p3.save.v1';
  var LANG_KEY = 'p3.lang.v1';
  var ROOM_GLOW_MS = 5000;
  var VIEW_W = 20;   // visible tiles across the canvas
  var VIEW_H = 12;
  var TILE = L.TILE;
  var SAVE_EVERY_MS = 2000;
  var CHANGE_GLOW_MS = 2500;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var app = {
    scene: 'title',
    lang: loadLang(),
    level: null,
    input: { left: false, right: false },
    jumpQueued: false,
    consoleOpen: false,
    computerOpen: false,
    message: null,         // { text, until }
    wallShown: false,
    gapShown: false,
    glow: { from: 0, to: 0, until: 0 },
    lastFlags: null,
    lastSave: 0,
    notice: null,
    lastHud: ''
  };

  var root = document.getElementById('app');
  var canvas = null;
  var ctx = null;

  // ---- helpers -----------------------------------------------------------------------

  function t(key, vars) {
    return I.t(app.lang, key, vars);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') {
          node.textContent = attrs[k];
        } else if (k === 'onClick') {
          node.addEventListener('click', attrs[k]);
        } else if (k === 'className') {
          node.className = attrs[k];
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c) {
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    });
    return node;
  }

  function button(label, onClick, className) {
    return el('button', { type: 'button', text: label, onClick: onClick, className: className || 'btn' });
  }

  function loadLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v === 'zh' ? 'zh' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function saveLang() {
    try { localStorage.setItem(LANG_KEY, app.lang); } catch (e) { /* storage may be blocked */ }
  }

  function saveProgress() {
    if (!app.level) {
      return;
    }
    var scene = app.scene === 'title' ? 'room' : app.scene;
    if (app.level.phase === 'complete' && (scene === 'game' || scene === 'room')) {
      scene = 'note';
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, scene: scene, level: L.serialize(app.level) }));
    } catch (e) {
      // Storage full or blocked: play continues without autosave.
    }
  }

  // Returns { scene, level } or null when there is no save. Returns { corrupt: true } when the save is unreadable.
  function readProgress() {
    var raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      var data = JSON.parse(raw);
      var level = data && data.v === 1 ? L.parse(data.level) : null;
      if (!level) {
        return { corrupt: true };
      }
      var scene = data.scene;
      if (level.phase === 'complete') {
        scene = scene === 'island' ? 'island' : 'note';
      } else if (scene !== 'room' && scene !== 'game') {
        scene = 'room';
      }
      return { scene: scene, level: level };
    } catch (e) {
      return { corrupt: true };
    }
  }

  function clearProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function setMessage(text, ms) {
    app.message = { text: text, until: performance.now() + (ms || 5000) };
  }

  // ---- scene transitions ---------------------------------------------------------------

  function go(scene) {
    app.scene = scene;
    app.consoleOpen = false;
    app.computerOpen = false;
    if (scene === 'room') {
      window.setTimeout(function () {
        var c = document.querySelector('.computer');
        if (c && app.scene === 'room') {
          c.classList.add('glow');
        }
      }, ROOM_GLOW_MS);
    }
    if (scene === 'game' && app.level) {
      app.lastFlags = JSON.stringify(app.level.flags);
    }
    app.input.left = false;
    app.input.right = false;
    render();
    saveProgress();
  }

  function startNewGame() {
    clearProgress();
    app.level = L.initialState();
    app.wallShown = false;
    app.gapShown = false;
    app.message = null;
    go('room');
  }

  // readProgress already maps the saved scene to one that matches the saved phase.
  function resumeGame(saved) {
    app.level = saved.level;
    app.wallShown = false;
    app.gapShown = false;
    app.message = null;
    go(saved.scene);
  }

  // ---- scenes ------------------------------------------------------------------------

  function render() {
    document.documentElement.lang = app.lang === 'zh' ? 'zh-CN' : 'en';
    root.textContent = '';
    canvas = null;
    ctx = null;
    var header = el('header', { className: 'top' }, [
      el('span', { className: 'brand', text: t('title') }),
      button(t('languageButton'), function () {
        app.lang = app.lang === 'en' ? 'zh' : 'en';
        saveLang();
        render();
      }, 'btn small')
    ]);
    root.appendChild(header);

    var view;
    if (app.scene === 'title') {
      view = renderTitle();
    } else if (app.scene === 'room') {
      view = renderRoom();
    } else if (app.scene === 'game') {
      view = renderGame();
    } else if (app.scene === 'note') {
      view = renderNote();
    } else {
      view = renderIsland();
    }
    root.appendChild(view);
    if (canvas) {
      ctx = canvas.getContext('2d');
    }
  }

  function renderTitle() {
    var saved = readProgress();
    var children = [
      el('h1', { text: t('title') }),
      el('p', { className: 'lede', text: t('subtitle') })
    ];
    if (saved && saved.corrupt) {
      children.push(el('p', { className: 'notice', text: t('saveCorrupt') }));
      clearProgress();
      saved = null;
    }
    if (saved) {
      children.push(button(t('continueGame'), function () { resumeGame(saved); }, 'btn primary'));
      children.push(button(t('newGame'), startNewGame, 'btn'));
    } else {
      children.push(button(t('start'), startNewGame, 'btn primary'));
    }
    children.push(el('p', { className: 'small', text: t('saveNotice') }));
    children.push(el('p', { className: 'small', text: t('controlsKeyboard') }));
    return el('section', { className: 'scene title' }, children);
  }

  function renderRoom() {
    var computer = el('button', {
      type: 'button',
      className: 'computer',
      text: '▣',
      'aria-label': t('computerTitle'),
      onClick: function () { app.computerOpen = true; render(); }
    });
    var children = [
      el('p', { className: 'lede', text: t('roomIntro') }),
      computer,
      el('p', { className: 'small', text: t('roomHint') })
    ];
    if (app.computerOpen) {
      children.push(el('div', { className: 'panel' }, [
        el('h2', { text: t('computerTitle') }),
        el('p', { text: t('computerBody') }),
        el('div', { className: 'row' }, [
          button(t('computerPlay'), function () { go('game'); }, 'btn primary'),
          button(t('computerBack'), function () { app.computerOpen = false; render(); }, 'btn')
        ])
      ]));
    }
    children.push(el('p', { className: 'small', text: t('controlsKeyboard') }));
    return el('section', { className: 'scene room' }, children);
  }

  function renderGame() {
    canvas = el('canvas', {
      width: VIEW_W * TILE,
      height: VIEW_H * TILE,
      className: 'stage',
      role: 'img',
      'aria-label': t('title')
    });
    var hud = el('p', { className: 'hud', id: 'hud' });
    var msg = el('p', { className: 'message', id: 'message', role: 'status' });
    var servers = button(t('touchConsole'), toggleConsole, 'btn');
    var pad = el('div', { className: 'pad', 'aria-label': 'touch controls' }, [
      holdButton(t('touchLeft'), 'left'),
      holdButton(t('touchRight'), 'right'),
      tapButton(t('touchJump'), function () { app.jumpQueued = true; }),
      servers
    ]);
    var children = [hud, canvas, msg, pad,
      el('p', { className: 'small', text: t('controlsKeyboard') }),
      el('p', { className: 'small', text: t('controlsTouch') })];
    if (app.consoleOpen) {
      children.push(renderConsole());
    }
    app.lastHud = '';
    return el('section', { className: 'scene game' }, children);
  }

  function holdButton(label, dir) {
    var b = el('button', { type: 'button', className: 'btn pad-btn', text: label });
    function down(e) { e.preventDefault(); app.input[dir] = true; }
    function up(e) { e.preventDefault(); app.input[dir] = false; }
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    return b;
  }

  function tapButton(label, fn) {
    var b = el('button', { type: 'button', className: 'btn pad-btn', text: label });
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); fn(); });
    return b;
  }

  function toggleConsole() {
    app.consoleOpen = !app.consoleOpen;
    app.input.left = false;
    app.input.right = false;
    render();
  }

  function renderConsole() {
    var f = app.level.flags;
    var labLine = el('div', { className: 'server' }, [
      el('h3', { text: t('consoleLab') }),
      el('p', { text: t('consoleLabBody') }),
      el('p', { className: 'status', text: f.lab ? t('statusRestored') : t('statusMissing') }),
      f.lab ? null : button(t('restoreLab'), function () { restoreFrom('lab'); }, 'btn primary')
    ]);
    var archiveLine = el('div', { className: 'server' }, [
      el('h3', { text: t('consoleArchive') }),
      el('p', { text: t('consoleArchiveBody') }),
      el('p', { className: 'status', text: f.archive ? t('statusRestored') : t('statusMissing') }),
      f.archive ? null : button(t('restoreArchive'), function () { restoreFrom('archive'); }, 'btn primary')
    ]);
    var log = el('p', { className: 'log', id: 'console-log', role: 'status', text: app.consoleLog || '' });
    return el('section', { className: 'panel console', role: 'dialog', 'aria-label': t('consoleTitle') }, [
      el('h2', { text: t('consoleTitle') }),
      el('div', { className: 'row servers' }, [labLine, archiveLine]),
      log,
      button(t('consoleClose'), toggleConsole, 'btn')
    ]);
  }

  function restoreFrom(source) {
    var before = JSON.stringify(app.level.flags);
    var res = L.restore(app.level, source);
    if (!res.ok) {
      app.consoleLog = t('archiveLocked');
    } else if (JSON.stringify(res.state.flags) === before) {
      app.consoleLog = t('logAlready');
    } else {
      app.level = res.state;
      app.consoleLog = source === 'lab' ? t('logLabRestored') : t('logArchiveRestored');
      app.glow = {
        from: source === 'lab' ? 20 : 28,
        to: source === 'lab' ? 27 : 38,
        until: performance.now() + CHANGE_GLOW_MS
      };
      app.lastFlags = JSON.stringify(app.level.flags);
    }
    saveProgress();
    render();
  }

  function renderNote() {
    return el('section', { className: 'scene note' }, [
      el('h2', { text: t('noteTitle') }),
      el('p', { text: t('noteBody') }),
      el('p', { className: 'joke', text: t('noteJoke') }),
      button(t('noteNext'), function () { go('island'); }, 'btn primary')
    ]);
  }

  function renderIsland() {
    var items = L.islandElements(app.level);
    var labels = {
      tree: t('islandTree'),
      house: t('islandHouse'),
      memory: t('islandMemory'),
      console: t('islandConsole')
    };
    var glyph = { tree: '♣', house: '⌂', memory: '✦', console: '▣' };
    var list = el('ul', { className: 'island' });
    items.forEach(function (id) {
      var li = el('li', { className: 'island-' + id }, [
        el('span', { className: 'glyph', text: glyph[id], 'aria-hidden': 'true' }),
        el('span', { text: labels[id] })
      ]);
      list.appendChild(li);
    });
    var consoleMsg = el('p', { className: 'log', text: '' });
    var kids = [
      el('h2', { text: t('completeTitle') }),
      el('p', { className: 'small', text: t('completeReward') }),
      el('h3', { text: t('islandTitle') }),
      el('p', { text: t('islandBody') }),
      list
    ];
    if (items.indexOf('console') >= 0) {
      kids.push(button(t('islandConsole'), function () {
        consoleMsg.textContent = t('consoleMessage');
      }, 'btn'));
      kids.push(consoleMsg);
    }
    kids.push(button(t('replayButton'), startNewGame, 'btn'));
    return el('section', { className: 'scene island' }, kids);
  }

  // ---- game loop ---------------------------------------------------------------------

  function handleEvents(events) {
    events.forEach(function (ev) {
      if (ev.type === 'star' && ev.hidden) {
        setMessage(t('hiddenStar'), 6000);
      } else if (ev.type === 'sign') {
        setMessage(t('signText'), 6000);
      } else if (ev.type === 'fall') {
        setMessage(t('fallText'), 3000);
      } else if (ev.type === 'door') {
        setMessage(t('completeReward'), 2500);
        window.setTimeout(function () {
          if (app.scene === 'game') {
            go('note');
          }
        }, 1500);
      }
    });
  }

  function checkBlockers() {
    var p = app.level;
    if (!p.flags.lab && p.x > 18.5 && !app.wallShown) {
      app.wallShown = true;
      setMessage(t('wallText') + ' ' + t('wallHint'), 8000);
    }
    if (p.flags.lab && !p.flags.archive && p.x > 26.5 && !app.gapShown) {
      app.gapShown = true;
      setMessage(t('gapText') + ' ' + t('wallHint'), 8000);
    }
    if (p.x < 17) {
      app.wallShown = false;
    }
  }

  function tick(now) {
    if (app.scene === 'game' && app.level && canvas) {
      var r = L.step(app.level, {
        left: app.input.left,
        right: app.input.right,
        jump: app.jumpQueued
      });
      app.jumpQueued = false;
      var before = app.level;
      app.level = r.state;
      handleEvents(r.events);
      if (before.flags.lab !== app.level.flags.lab || before.flags.archive !== app.level.flags.archive) {
        app.lastFlags = JSON.stringify(app.level.flags);
      }
      checkBlockers();
      draw(now);
      updateHud();
      if (now - app.lastSave > SAVE_EVERY_MS) {
        app.lastSave = now;
        saveProgress();
      }
    }
    window.requestAnimationFrame(tick);
  }

  function updateHud() {
    var hud = document.getElementById('hud');
    if (!hud) {
      return;
    }
    var text = t('starCount', { n: app.level.collected.length }) + '    ' + t('deathCount', { n: app.level.deaths });
    if (text !== app.lastHud) {
      hud.textContent = text;
      app.lastHud = text;
    }
    var msgEl = document.getElementById('message');
    if (msgEl) {
      var shown = app.message && performance.now() < app.message.until ? app.message.text : '';
      if (msgEl.textContent !== shown) {
        msgEl.textContent = shown;
      }
    }
  }

  // ---- drawing -----------------------------------------------------------------------

  function drawStar(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? size : size * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    var w = VIEW_W * TILE;
    var h = VIEW_H * TILE;
    var p = app.level;
    var grid = L.gridFor(p.flags);
    var camX = Math.max(0, Math.min(L.W - VIEW_W, p.x - VIEW_W / 2));
    var pulse = reduceMotion ? 0.5 : (Math.sin(now / 400) + 1) / 2;
    var glowing = now < app.glow.until;

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d0b1f');
    sky.addColorStop(1, '#2a1f4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Background stars are fixed per position so they do not shift during play.
    for (var s = 0; s < 40; s++) {
      var sx = ((s * 97) % 640) + 0;
      var sy = ((s * 53) % 200) + 0;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + (s % 3) * 0.1) + ')';
      ctx.fillRect(((sx - camX * 6) % 640 + 640) % 640, sy, 2, 2);
    }

    var ox = -camX * TILE;
    var c0 = Math.max(0, Math.floor(camX) - 1);
    var c1 = Math.min(L.W - 1, Math.ceil(camX + VIEW_W) + 1);

    for (var r = 0; r < L.H; r++) {
      for (var c = c0; c <= c1; c++) {
        var ch = grid[r].charAt(c);
        var x = ox + c * TILE;
        var y = r * TILE;
        var inGlow = glowing && c >= app.glow.from && c <= app.glow.to;
        drawCell(ch, c, r, x, y, pulse, grid, inGlow);
      }
    }

    drawPlayer(ox, p);

    if (glowing) {
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - (app.glow.until - now) / CHANGE_GLOW_MS);
      ctx.fillStyle = '#9ef0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawCell(ch, c, r, x, y, pulse, grid, inGlow) {
    var T = TILE;
    if (ch === '#') {
      ctx.fillStyle = '#2b4a3a';
      ctx.fillRect(x, y, T, T);
      if (grid[r - 1] === undefined || grid[r - 1].charAt(c) !== '#') {
        ctx.fillStyle = '#6fbf8a';
        ctx.fillRect(x, y, T, 4);
      }
    } else if (ch === 'L') {
      ctx.fillStyle = '#6b4f7a';
      ctx.fillRect(x, y + 4, T, T - 4);
      ctx.fillStyle = '#b28dc7';
      ctx.fillRect(x, y, T, 4);
    } else if (ch === 'x') {
      ctx.fillStyle = '#4a1624';
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = '#e4572e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + T);
      ctx.lineTo(x + T, y);
      ctx.stroke();
    } else if (ch === '*') {
      if (!isCollected(c, r)) {
        drawStar(x + T / 2, y + T / 2, T * 0.38, '#ffd166');
      }
    } else if (ch === 'h') {
      if (!isCollected(c, r)) {
        ctx.globalAlpha = reduceMotion ? 0.3 : 0.15 + pulse * 0.2;
        drawStar(x + T / 2, y + T / 2, T * 0.3, '#ffe8a3');
        ctx.globalAlpha = 1;
      }
    } else if (ch === 's') {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x + 14, y + 12, 4, T - 12);
      ctx.fillStyle = '#c99a5b';
      ctx.fillRect(x + 4, y + 4, 24, 12);
    } else if (ch === 'E') {
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(x + 6, y - 14, 20, T + 14);
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(x + 12, y - 4, 8, 10);
    } else if (ch === 'H') {
      ctx.fillStyle = '#b8a6c9';
      ctx.fillRect(x + 4, y + 10, T - 8, T - 10);
      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x + T / 2, y);
      ctx.lineTo(x + T, y + 12);
      ctx.fill();
    }
    if (inGlow && ch !== '.') {
      ctx.fillStyle = 'rgba(158,240,255,0.25)';
      ctx.fillRect(x, y, T, T);
    }
  }

  function isCollected(c, r) {
    return app.level.collected.indexOf(c + ',' + r) >= 0;
  }

  function drawPlayer(ox, p) {
    var T = TILE;
    var px = ox + p.x * T;
    var footY = p.y * T;
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(px - 7, footY - 22, 14, 18);
    ctx.beginPath();
    ctx.arc(px, footY - 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b2f';
    ctx.fillRect(px - 7, footY - 2, 14, 2);
  }

  // ---- input -------------------------------------------------------------------------

  function onKeyDown(e) {
    if (app.scene === 'room' && (e.key === 'e' || e.key === 'E')) {
      app.computerOpen = true;
      render();
      return;
    }
    if (app.scene !== 'game') {
      return;
    }
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      app.input.left = true;
      e.preventDefault();
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      app.input.right = true;
      e.preventDefault();
    } else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      if (!e.repeat) {
        app.jumpQueued = true;
      }
      e.preventDefault();
    } else if (k === 'r' || k === 'R') {
      toggleConsole();
    }
  }

  function onKeyUp(e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      app.input.left = false;
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      app.input.right = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () {
    app.input.left = false;
    app.input.right = false;
  });
  window.addEventListener('pagehide', saveProgress);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      saveProgress();
    }
  });

  render();
  window.requestAnimationFrame(tick);
})();
