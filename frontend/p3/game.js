/*
 * P3 browser shell: scenes, canvas drawing, keyboard and touch input, sound and motion settings,
 * and localStorage autosave. Game rules live in level.js and strings in i18n.js.
 * Text is written with textContent, never innerHTML.
 */
(function () {
  'use strict';

  var L = window.P3Level;
  var I = window.P3I18n;
  var A = window.P3Audio;

  var SAVE_KEY = 'p3.save.v1';
  var LANG_KEY = 'p3.lang.v1';
  var MOTION_KEY = 'p3.motion.v1';
  var ROOM_GLOW_MS = 5000;
  var VIEW_W = 20;
  var VIEW_H = 12;
  var TILE = L.TILE;
  var SAVE_EVERY_MS = 2000;
  var CHANGE_GLOW_MS = 2500;
  var mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var app = {
    scene: 'title',
    lang: loadLang(),
    reduce: loadMotion(),
    level: null,
    room: null,
    roomStart: 0,
    panel: null,            // room panel: 'computer' | 'photo' | null
    input: { left: false, right: false },
    jumpQueued: false,
    interactQueued: false,
    consoleOpen: false,
    consoleLog: '',
    message: null,          // { text, until }
    wallShown: false,
    gapShown: false,
    glow: { from: 0, to: 0, until: 0 },
    sparks: [],
    shakeUntil: 0,
    lastSave: 0,
    lastHud: '',
    lastPrompt: '',
    islandStart: 0,
    islandCaption: ''
  };

  var root = document.getElementById('app');
  var canvas = null;
  var ctx = null;

  // ---- settings and helpers ----------------------------------------------------------

  function reduceMotion() {
    return app.reduce || mediaReduce;
  }

  function t(key, vars) {
    return I.t(app.lang, key, vars);
  }

  function sound(name) {
    if (A) {
      A.play(name);
    }
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

  function button(label, onClick, className, testId) {
    var attrs = { type: 'button', text: label, onClick: function () { sound('click'); onClick(); }, className: className || 'btn' };
    if (testId) {
      attrs['data-testid'] = testId;
    }
    return el('button', attrs);
  }

  function loadLang() {
    try {
      return localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function saveLang() {
    try { localStorage.setItem(LANG_KEY, app.lang); } catch (e) { /* storage may be blocked */ }
  }

  function loadMotion() {
    try {
      return localStorage.getItem(MOTION_KEY) === 'reduce';
    } catch (e) {
      return false;
    }
  }

  function saveMotion() {
    try { localStorage.setItem(MOTION_KEY, app.reduce ? 'reduce' : 'full'); } catch (e) { /* ignore */ }
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

  // Returns { scene, level }, { corrupt: true } for an unreadable save, or null when there is no save.
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

  // ---- scene transitions -------------------------------------------------------------

  function go(scene) {
    app.scene = scene;
    app.consoleOpen = false;
    app.panel = null;
    app.input.left = false;
    app.input.right = false;
    app.jumpQueued = false;
    app.interactQueued = false;
    if (scene === 'room') {
      app.room = app.room || L.roomInitialState();
      app.roomStart = performance.now();
      app.lastPrompt = '';
    }
    render();
    saveProgress();
  }

  function startNewGame() {
    clearProgress();
    app.level = L.initialState();
    app.room = L.roomInitialState();
    app.wallShown = false;
    app.gapShown = false;
    app.message = null;
    app.sparks = [];
    go('room');
  }

  function resumeGame(saved) {
    app.level = saved.level;
    app.room = L.roomInitialState();
    app.wallShown = false;
    app.gapShown = false;
    app.message = null;
    go(saved.scene);
  }

  // ---- rendering ---------------------------------------------------------------------

  function render() {
    document.documentElement.lang = app.lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.classList.toggle('reduce-motion', reduceMotion());
    root.textContent = '';
    canvas = null;
    ctx = null;
    root.appendChild(header());

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
    // Restart the fade-in on each scene change. Motion settings turn it off through CSS.
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
  }

  function header() {
    var muted = A ? A.isMuted() : false;
    return el('header', { className: 'top' }, [
      el('span', { className: 'brand', text: t('title') }),
      el('span', { className: 'settings' }, [
        button(muted ? t('soundOff') : t('soundOn'), function () {
          if (A) {
            A.setMuted(!A.isMuted());
          }
          render();
        }, 'btn small', 'sound-toggle'),
        button(app.reduce ? t('motionReduced') : t('motionFull'), function () {
          app.reduce = !app.reduce;
          saveMotion();
          render();
        }, 'btn small', 'motion-toggle'),
        button(t('languageButton'), function () {
          app.lang = app.lang === 'en' ? 'zh' : 'en';
          saveLang();
          render();
        }, 'btn small', 'lang-toggle')
      ])
    ]);
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
      children.push(button(t('continueGame'), function () { resumeGame(saved); }, 'btn primary', 'continue'));
      children.push(button(t('newGame'), startNewGame, 'btn'));
    } else {
      children.push(button(t('start'), startNewGame, 'btn primary', 'start'));
    }
    children.push(el('p', { className: 'small', text: t('saveNotice') }));
    children.push(el('p', { className: 'small', text: t('controlsKeyboard') }));
    return el('section', { className: 'scene title' }, children);
  }

  function renderRoom() {
    // The prompt element is rebuilt on every render, so the cached prompt text must be cleared too.
    app.lastPrompt = '';
    canvas = el('canvas', {
      width: L.ROOM_W * TILE,
      height: VIEW_H * TILE,
      className: 'stage',
      role: 'img',
      'aria-label': t('computerTitle'),
      'data-testid': 'room-canvas'
    });
    var children = [
      el('p', { className: 'lede', text: t('roomIntro') }),
      canvas,
      el('p', { className: 'prompt', id: 'prompt', 'data-testid': 'room-prompt', role: 'status', text: '' }),
      el('div', { className: 'pad' }, [
        holdButton(t('touchLeft'), 'left'),
        holdButton(t('touchRight'), 'right'),
        tapButton(t('touchUse'), function () { app.interactQueued = true; })
      ]),
      el('p', { className: 'small', text: t('roomHint') }),
      el('p', { className: 'small', text: t('controlsKeyboard') })
    ];
    if (app.panel === 'computer') {
      children.push(el('div', { className: 'panel', 'data-testid': 'computer-panel' }, [
        el('h2', { text: t('computerTitle') }),
        el('p', { text: t('computerBody') }),
        el('div', { className: 'row' }, [
          button(t('computerPlay'), function () { go('game'); }, 'btn primary', 'play'),
          button(t('computerBack'), closePanel, 'btn')
        ])
      ]));
    } else if (app.panel === 'photo') {
      children.push(el('div', { className: 'panel', 'data-testid': 'photo-panel' }, [
        el('p', { text: t('photoCaption') }),
        button(t('consoleClose'), closePanel, 'btn')
      ]));
    }
    return el('section', { className: 'scene room' }, children);
  }

  function openPanel(kind) {
    app.panel = kind;
    app.input.left = false;
    app.input.right = false;
    render();
  }

  function closePanel() {
    app.panel = null;
    render();
  }

  function renderGame() {
    canvas = el('canvas', {
      width: VIEW_W * TILE,
      height: VIEW_H * TILE,
      className: 'stage',
      role: 'img',
      'aria-label': t('title'),
      'data-testid': 'game-canvas'
    });
    var children = [
      el('p', { className: 'hud', id: 'hud' }),
      canvas,
      el('p', { className: 'message', id: 'message', role: 'status' }),
      el('div', { className: 'pad', 'aria-label': 'touch controls' }, [
        holdButton(t('touchLeft'), 'left'),
        holdButton(t('touchRight'), 'right'),
        tapButton(t('touchJump'), function () { app.jumpQueued = true; }),
        button(t('touchConsole'), toggleConsole, 'btn', 'servers')
      ]),
      el('p', { className: 'small', text: t('controlsKeyboard') }),
      el('p', { className: 'small', text: t('controlsTouch') })
    ];
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
    var labLine = el('div', { className: 'server', 'data-testid': 'server-lab' }, [
      el('h3', { text: t('consoleLab') }),
      el('p', { text: t('consoleLabBody') }),
      el('p', { className: 'status', 'data-testid': 'lab-status', text: f.lab ? t('statusRestored') : t('statusMissing') }),
      f.lab ? null : button(t('restoreLab'), function () { restoreFrom('lab'); }, 'btn primary', 'restore-lab')
    ]);
    var archiveLine = el('div', { className: 'server', 'data-testid': 'server-archive' }, [
      el('h3', { text: t('consoleArchive') }),
      el('p', { text: t('consoleArchiveBody') }),
      el('p', { className: 'status', 'data-testid': 'archive-status', text: f.archive ? t('statusRestored') : t('statusMissing') }),
      f.archive ? null : button(t('restoreArchive'), function () { restoreFrom('archive'); }, 'btn primary', 'restore-archive')
    ]);
    return el('section', { className: 'panel console', role: 'dialog', 'aria-label': t('consoleTitle'), 'data-testid': 'console' }, [
      el('h2', { text: t('consoleTitle') }),
      el('div', { className: 'row servers' }, [labLine, archiveLine]),
      el('p', { className: 'log', id: 'console-log', role: 'status', 'data-testid': 'console-log', text: app.consoleLog || '' }),
      button(t('consoleClose'), toggleConsole, 'btn', 'console-close')
    ]);
  }

  function restoreFrom(source) {
    var before = JSON.stringify(app.level.flags);
    var res = L.restore(app.level, source);
    if (!res.ok) {
      app.consoleLog = t('archiveLocked');
      sound('fall');
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
      sound('restore');
    }
    saveProgress();
    render();
  }

  function renderNote() {
    return el('section', { className: 'scene note', 'data-testid': 'note' }, [
      el('h2', { text: t('noteTitle') }),
      el('p', { text: t('noteBody') }),
      el('p', { className: 'joke', text: t('noteJoke') }),
      button(t('noteNext'), function () { go('island'); }, 'btn primary', 'note-next')
    ]);
  }

  // Island layout in canvas pixels (640 x 384). Each part grows from its base point.
  var ISLAND_PARTS = {
    tree: { x: 170, y: 296, box: [120, 190, 100, 110] },
    house: { x: 330, y: 296, box: [290, 196, 84, 104] },
    memory: { x: 240, y: 296, box: [212, 222, 58, 78] },
    console: { x: 470, y: 296, box: [440, 252, 64, 48] }
  };
  var ISLAND_ORDER = ['tree', 'house', 'memory', 'console'];

  function renderIsland() {
    app.islandStart = performance.now();
    canvas = el('canvas', {
      width: 640,
      height: 384,
      className: 'stage',
      role: 'img',
      'aria-label': t('islandTitle'),
      'data-testid': 'island-canvas'
    });
    canvas.addEventListener('click', islandClick);
    var items = L.islandElements(app.level);
    var labels = { tree: t('islandTree'), house: t('islandHouse'), memory: t('islandMemory'), console: t('islandConsole') };
    var captions = {
      tree: t('islandTree'),
      house: t('islandHouse'),
      memory: t('photoCaption'),
      console: t('consoleMessage')
    };
    var buttons = ISLAND_ORDER.filter(function (id) { return items.indexOf(id) >= 0; }).map(function (id) {
      return button(labels[id], function () {
        app.islandCaption = captions[id];
        render();
      }, 'btn', 'island-' + id);
    });
    return el('section', { className: 'scene island', 'data-testid': 'island' }, [
      el('h2', { text: t('completeTitle') }),
      el('p', { className: 'small', text: t('completeReward') }),
      el('h3', { text: t('islandTitle') }),
      el('p', { text: t('islandBody') }),
      canvas,
      el('p', { className: 'log', id: 'island-caption', role: 'status', 'data-testid': 'island-caption', text: app.islandCaption }),
      el('div', { className: 'row' }, buttons),
      button(t('replayButton'), startNewGame, 'btn', 'replay')
    ]);
  }

  function islandClick(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (640 / rect.width);
    var y = (e.clientY - rect.top) * (384 / rect.height);
    var items = L.islandElements(app.level);
    var hit = null;
    ISLAND_ORDER.forEach(function (id) {
      var b = ISLAND_PARTS[id].box;
      if (items.indexOf(id) >= 0 && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]) {
        hit = id;
      }
    });
    if (hit) {
      sound('sign');
      app.islandCaption = { tree: t('islandTree'), house: t('islandHouse'), memory: t('photoCaption'), console: t('consoleMessage') }[hit];
      var cap = document.getElementById('island-caption');
      if (cap) {
        cap.textContent = app.islandCaption;
      }
    }
  }

  // ---- game loop ---------------------------------------------------------------------

  function handleEvents(events) {
    events.forEach(function (ev) {
      if (ev.type === 'star') {
        var parts = ev.id.split(',');
        app.sparks.push({ x: Number(parts[0]) + 0.5, y: Number(parts[1]) + 0.5, t: performance.now() });
        if (ev.hidden) {
          setMessage(t('hiddenStar'), 6000);
          sound('hidden');
        } else {
          sound('star');
        }
      } else if (ev.type === 'sign') {
        setMessage(t('signText'), 6000);
        sound('sign');
      } else if (ev.type === 'fall') {
        setMessage(t('fallText'), 3000);
        app.shakeUntil = performance.now() + 400;
        sound('fall');
      } else if (ev.type === 'door') {
        setMessage(t('completeReward'), 2500);
        sound('door');
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

  function roomTick(now) {
    if (app.panel) {
      app.interactQueued = false;
    } else {
      if (app.interactQueued) {
        app.interactQueued = false;
        var near = L.roomObjectNear(app.room);
        if (near === 'computer') {
          sound('click');
          openPanel('computer');
          return;
        }
        if (near === 'photo') {
          sound('click');
          openPanel('photo');
          return;
        }
      }
      var r = L.stepRoom(app.room, { left: app.input.left, right: app.input.right, jump: false });
      app.room = r.state;
    }
    var near2 = app.panel ? '' : L.roomObjectNear(app.room);
    var prompt = near2 === 'computer' ? t('roomPromptComputer') : near2 === 'photo' ? t('roomPromptPhoto') : '';
    if (prompt !== app.lastPrompt) {
      app.lastPrompt = prompt;
      var p = document.getElementById('prompt');
      if (p) {
        p.textContent = prompt;
      }
    }
  }

  function gameTick(now) {
    if (app.consoleOpen) {
      app.input.left = false;
      app.input.right = false;
    }
    var r = L.step(app.level, {
      left: app.input.left,
      right: app.input.right,
      jump: app.jumpQueued
    });
    if (app.jumpQueued && r.state.vy < 0) {
      sound('jump');
    }
    app.jumpQueued = false;
    app.level = r.state;
    handleEvents(r.events);
    checkBlockers();
    updateHud();
    if (now - app.lastSave > SAVE_EVERY_MS) {
      app.lastSave = now;
      saveProgress();
    }
  }

  var last = 0;
  var acc = 0;

  function tick(now) {
    var dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    if (canvas && app.scene === 'room') {
      acc += dt;
      while (acc >= L.DT) {
        acc -= L.DT;
        roomTick(now);
        if (app.scene !== 'room') {
          break;
        }
      }
      if (app.scene === 'room' && acc < 0) {
        acc = 0;
      }
      if (app.scene === 'room') {
        // Room drawing runs once per animation frame. Physics runs in fixed steps above.
        drawRoom(now);
      }
    } else if (canvas && app.scene === 'game' && app.level) {
      acc += dt;
      while (acc >= L.DT) {
        acc -= L.DT;
        gameTick(now);
      }
      if (app.scene === 'game') {
        drawGame(now);
      }
    } else if (canvas && app.scene === 'island') {
      drawIsland(now);
    } else {
      acc = 0;
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

  function pulseValue(now) {
    return reduceMotion() ? 0.5 : (Math.sin(now / 400) + 1) / 2;
  }

  function drawPlayer(ox, p) {
    var px = ox + p.x * TILE;
    var footY = p.y * TILE;
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(px - 7, footY - 22, 14, 18);
    ctx.beginPath();
    ctx.arc(px, footY - 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b2f';
    ctx.fillRect(px - 7, footY - 2, 14, 2);
  }

  function drawRoom(now) {
    var T = TILE;
    var rows = L.roomRows();
    var w = L.ROOM_W * T;
    var h = VIEW_H * T;
    var glowOn = now - app.roomStart > ROOM_GLOW_MS;

    ctx.fillStyle = '#17122e';
    ctx.fillRect(0, 0, w, h);
    // Wallpaper stripes, drawn once per frame. Decorative only.
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var sx = 0; sx < w; sx += 64) {
      ctx.fillRect(sx, 0, 32, h);
    }

    for (var r = 0; r < L.H; r++) {
      for (var c = 0; c < L.ROOM_W; c++) {
        var ch = rows[r].charAt(c);
        var x = c * T;
        var y = r * T;
        if (ch === '#') {
          drawCell('#', c, r, x, y, 0, rows, false);
        } else if (ch === 'x') {
          ctx.fillStyle = '#211a40';
          ctx.fillRect(x, y, T, T);
        } else if (ch === 'W' && (c === 0 || rows[r].charAt(c - 1) !== 'W') && (r === 0 || rows[r - 1].charAt(c) !== 'W')) {
          drawWindow(x, y, 4 * T, 3 * T, now);
        } else if (ch === 'P') {
          drawPhoto(x, y);
        } else if (ch === 'C') {
          drawComputer(x, y, glowOn, now);
        }
      }
    }

    drawPlayer(0, app.room);

    if (!app.panel) {
      var near = L.roomObjectNear(app.room);
      if (near) {
        var o = L.ROOM_OBJECTS[near === 'computer' ? 'C' : 'P'];
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.4 * pulseValue(now);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x * T - 22, o.y * T - 26, 44, 44);
        ctx.restore();
      }
    }
  }

  function drawWindow(x, y, w, h, now) {
    ctx.fillStyle = '#24306b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff3d6';
    ctx.globalAlpha = 0.85 + 0.1 * pulseValue(now);
    ctx.beginPath();
    ctx.arc(x + w - 36, y + 34, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#17122e';
    ctx.fillRect(x + w / 2 - 3, y, 6, h);
    ctx.fillRect(x, y + h / 2 - 3, w, 6);
    ctx.strokeStyle = '#8b7fc0';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }

  function drawPhoto(x, y) {
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(x + 4, y + 4, 24, 24);
    ctx.fillStyle = '#4a3a6a';
    ctx.fillRect(x + 8, y + 8, 16, 16);
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.arc(x + 16, y + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 12, y + 19, 8, 5);
  }

  function drawComputer(x, y, glowOn, now) {
    if (glowOn) {
      var g = ctx.createRadialGradient(x + 16, y + 14, 4, x + 16, y + 14, 46);
      g.addColorStop(0, 'rgba(158,240,255,' + (0.35 + 0.15 * pulseValue(now)) + ')');
      g.addColorStop(1, 'rgba(158,240,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 30, y - 32, 92, 90);
    }
    ctx.fillStyle = '#3a3550';
    ctx.fillRect(x + 2, y + 2, 28, 20);
    ctx.fillStyle = glowOn ? '#9ef0ff' : '#2a2a3a';
    ctx.fillRect(x + 5, y + 5, 22, 14);
    ctx.fillStyle = '#3a3550';
    ctx.fillRect(x + 12, y + 22, 8, 6);
    ctx.fillRect(x + 6, y + 27, 20, 3);
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
        ctx.globalAlpha = reduceMotion() ? 0.3 : 0.15 + pulse * 0.2;
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

  function drawGame(now) {
    var w = VIEW_W * TILE;
    var h = VIEW_H * TILE;
    var p = app.level;
    var grid = L.gridFor(p.flags);
    var camX = Math.max(0, Math.min(L.W - VIEW_W, p.x - VIEW_W / 2));
    var pulse = pulseValue(now);
    var glowing = now < app.glow.until;
    var shake = now < app.shakeUntil && !reduceMotion() ? Math.sin(now * 0.08) * 4 : 0;

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d0b1f');
    sky.addColorStop(1, '#2a1f4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Background stars drift slowly with the camera (parallax). Fixed seeds keep them stable.
    for (var s = 0; s < 40; s++) {
      var sx = (s * 97) % 640;
      var sy = (s * 53) % 200;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + (s % 3) * 0.1) + ')';
      ctx.fillRect((((sx - camX * 6) % 640) + 640) % 640, sy, 2, 2);
    }

    ctx.save();
    ctx.translate(shake, 0);
    var ox = -camX * TILE;
    var c0 = Math.max(0, Math.floor(camX) - 1);
    var c1 = Math.min(L.W - 1, Math.ceil(camX + VIEW_W) + 1);
    for (var r = 0; r < L.H; r++) {
      for (var c = c0; c <= c1; c++) {
        var inGlow = glowing && c >= app.glow.from && c <= app.glow.to;
        drawCell(grid[r].charAt(c), c, r, ox + c * TILE, r * TILE, pulse, grid, inGlow);
      }
    }
    drawPlayer(ox, p);
    drawSparks(now, ox);
    ctx.restore();

    if (glowing) {
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - (app.glow.until - now) / CHANGE_GLOW_MS);
      ctx.fillStyle = '#9ef0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawSparks(now, ox) {
    app.sparks = app.sparks.filter(function (sp) { return now - sp.t < 500; });
    app.sparks.forEach(function (sp) {
      var age = (now - sp.t) / 500;
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + sp.x * TILE, sp.y * TILE, 6 + age * 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  // Island drawing: each part grows from its base in turn. Reduced motion shows everything at once.
  function growth(index, now) {
    if (reduceMotion()) {
      return 1;
    }
    var k = (now - app.islandStart - index * 300) / 700;
    if (k <= 0) {
      return 0;
    }
    if (k >= 1) {
      return 1;
    }
    return 1 - Math.pow(1 - k, 3);
  }

  function drawIsland(now) {
    var items = L.islandElements(app.level);
    var complete = app.level.phase === 'complete';
    var w = 640;
    var h = 384;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0d0b1f');
    g.addColorStop(0.6, '#3a2a5a');
    g.addColorStop(1, '#1d3450');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(540, 60, 26, 0, Math.PI * 2);
    ctx.fill();
    for (var s = 0; s < 30; s++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + (s % 4) * 0.12) + ')';
      ctx.fillRect((s * 83) % 640, (s * 41) % 170, 2, 2);
    }
    // Sea waves, moving slowly unless reduced motion is on.
    ctx.strokeStyle = 'rgba(158,240,255,0.25)';
    ctx.lineWidth = 2;
    for (var wv = 0; wv < 5; wv++) {
      ctx.beginPath();
      var offset = reduceMotion() ? 0 : Math.sin(now / 900 + wv) * 6;
      for (var x = 0; x <= w; x += 16) {
        var y = 318 + wv * 14 + Math.sin(x / 40 + wv + offset / 6) * 3;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    // Island ground.
    ctx.fillStyle = '#2f6b4f';
    ctx.beginPath();
    ctx.ellipse(320, 306, 290, 76, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f8f6a';
    ctx.beginPath();
    ctx.ellipse(320, 296, 270, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4f3a';
    ctx.beginPath();
    ctx.ellipse(320, 330, 220, 22, 0, 0, Math.PI);
    ctx.fill();

    ISLAND_ORDER.forEach(function (id, i) {
      if (items.indexOf(id) < 0) {
        return;
      }
      var k = growth(i, now);
      if (k <= 0) {
        return;
      }
      var part = ISLAND_PARTS[id];
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.scale(1, Math.max(0.01, k));
      ctx.translate(-part.x, -part.y);
      if (id === 'tree') {
        drawTree(part.x, part.y);
      } else if (id === 'house') {
        drawHouse(part.x, part.y);
      } else if (id === 'memory') {
        drawMemory(part.x, part.y);
      } else if (id === 'console') {
        drawConsole(part.x, part.y, complete, now);
      }
      ctx.restore();
    });
  }

  function drawTree(x, y) {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x - 6, y - 60, 12, 60);
    ctx.fillStyle = '#4fbf7a';
    ctx.beginPath();
    ctx.arc(x, y - 78, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fe09a';
    ctx.beginPath();
    ctx.arc(x - 10, y - 86, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHouse(x, y) {
    ctx.fillStyle = '#b8a6c9';
    ctx.fillRect(x - 30, y - 56, 60, 56);
    ctx.fillStyle = '#7b5ea7';
    ctx.beginPath();
    ctx.moveTo(x - 40, y - 54);
    ctx.lineTo(x, y - 94);
    ctx.lineTo(x + 40, y - 54);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 6, y - 26, 12, 26);
    ctx.fillRect(x + 12, y - 42, 10, 10);
  }

  function drawMemory(x, y) {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x - 3, y - 14, 6, 14);
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(x - 22, y - 62, 44, 48);
    ctx.fillStyle = '#4a3a6a';
    ctx.fillRect(x - 17, y - 57, 34, 38);
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.arc(x, y - 44, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 10, y - 36, 20, 10);
    drawStar(x, y - 74, 9, '#ffd166');
  }

  function drawConsole(x, y, complete, now) {
    ctx.fillStyle = '#3a3550';
    ctx.fillRect(x - 24, y - 46, 48, 46);
    ctx.fillStyle = complete ? '#9ef0ff' : '#2a2a3a';
    ctx.globalAlpha = complete ? 0.7 + 0.3 * pulseValue(now) : 1;
    ctx.fillRect(x - 18, y - 40, 36, 26);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1b1b2f';
    ctx.fillRect(x - 10, y - 2, 20, 4);
  }

  // ---- input -------------------------------------------------------------------------

  function onKeyDown(e) {
    if (A && A.unlock) {
      A.unlock();
    }
    var k = e.key;
    if (app.scene === 'room') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        app.input.left = true;
        e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        app.input.right = true;
        e.preventDefault();
      } else if (k === 'e' || k === 'E') {
        app.interactQueued = true;
      } else if (k === 'Escape' && app.panel) {
        closePanel();
      }
      return;
    }
    if (app.scene !== 'game') {
      return;
    }
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
