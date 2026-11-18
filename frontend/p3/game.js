/*
 * P3.2 browser shell: scenes, input, interactions, panels, saving. The rules live in engine.js, puzzle.js and
 * state.js, the strings in i18n.js, the pictures in art.js and scenes.js. All text goes in with textContent.
 */
(function () {
  'use strict';

  var E = window.P3Engine, D = window.P3Data, Pz = window.P3Puzzle, St = window.P3State, I = window.P3I18n, A = window.P3Audio;
  var art = window.P3Art.createArt(function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  var S = window.P3Scenes.create(art, D, Pz);
  var T = D.TILE, VW = 320, VH = 176;

  var SAVE_KEY = 'p3.save.v2', LANG_KEY = 'p3.lang.v1', MOTION_KEY = 'p3.motion.v1';
  var mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var lang = loadSetting(LANG_KEY) === 'zh' ? 'zh' : 'en';
  var userReduce = loadSetting(MOTION_KEY) === 'reduce';
  var st = St.newState();

  // runtime (never saved)
  var rt = {
    mode: 'title', scene: 'study', world: null, player: null, cam: { x: 0, y: 0 }, t: 0, anim: 'idle', landT: 0, actT: 0,
    input: { left: false, right: false }, jumpQ: false, useQ: false, near: null, particles: [], read: [],
    panel: null, cap: null, fade: 0, trans: null, later: [], building: [], buildQueue: [], frozen: false,
    shake: 0, flash: null, isl: null, lastSave: 0, saved: null, dlg: null, selected: null
  };

  function loadSetting(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSetting(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  function reduce() { return userReduce || mediaReduce; }
  function tr(key, vars) { return I.t(lang, key, vars); }
  function sfx(name, p) { if (A) { A.play(name, p); } }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k === 'onClick') { n.addEventListener('click', v); } else { n.setAttribute(k, v); }
    });
    (kids || []).forEach(function (c) { if (c) { n.appendChild(c); } });
    return n;
  }
  function btn(label, onClick, cls, testId) {
    var a = { type: 'button', text: label, 'class': cls || 'btn', onClick: function () { sfx('click'); onClick(); } };
    if (testId) { a['data-testid'] = testId; }
    return el('button', a);
  }

  // ---- DOM skeleton (built once) -----------------------------------------------------------------
  var root = document.getElementById('app');
  var $ = {};
  function build() {
    root.textContent = '';
    $.brand = el('span', { 'class': 'brand' });
    $.sound = el('button', { type: 'button', 'class': 'btn small', 'data-testid': 'sound-toggle' });
    $.vol = el('input', { type: 'range', min: '0', max: '100', step: '5', 'class': 'vol', 'data-testid': 'volume' });
    $.volLabel = el('label', { 'class': 'volwrap' }, [$.vol]);
    $.motion = el('button', { type: 'button', 'class': 'btn small', 'data-testid': 'motion-toggle' });
    $.lang = el('button', { type: 'button', 'class': 'btn small', 'data-testid': 'lang-toggle' });
    var header = el('header', { 'class': 'top' }, [$.brand, el('span', { 'class': 'settings' }, [$.sound, $.volLabel, $.motion, $.lang])]);

    $.zone = el('span', { 'data-testid': 'hud-zone' }); $.stars = el('span', { 'data-testid': 'hud-stars' }); $.falls = el('span', { 'data-testid': 'hud-falls' });
    $.hud = el('div', { 'class': 'hud' }, [$.zone, $.stars, $.falls]);
    $.canvas = el('canvas', { width: String(VW), height: String(VH), 'class': 'view', 'data-testid': 'view', role: 'img' });
    $.ctx = $.canvas.getContext('2d');
    $.ctx.imageSmoothingEnabled = false;
    $.stage = el('section', { 'class': 'stagewrap' }, [$.hud, $.canvas]);

    $.title = el('section', { 'class': 'titlecard', 'data-testid': 'title-card' });
    $.who = el('span', { 'class': 'who' }); $.say = el('span', { 'class': 'say' });
    $.cap = el('p', { 'class': 'caption', role: 'status', 'data-testid': 'caption' }, [$.who, $.say]);
    $.padLeft = padHold('pad-left', 'left'); $.padRight = padHold('pad-right', 'right');
    $.padJump = padTap('pad-jump', function () { rt.jumpQ = true; }); $.padUse = padTap('pad-use', function () { rt.useQ = true; });
    $.pad = el('div', { 'class': 'pad', 'data-testid': 'pad' }, [el('div', { 'class': 'padL' }, [$.padLeft, $.padRight]), el('div', { 'class': 'padR' }, [$.padJump, $.padUse])]);
    $.keys = el('p', { 'class': 'small keys' });
    $.replay = btn('', function () { newGame(); }, 'btn', 'replay');
    $.play = el('section', { 'class': 'playui' }, [$.cap, $.pad, $.keys, $.replay]);
    $.host = el('section', { 'class': 'panelhost' });
    root.appendChild(header); root.appendChild($.stage); root.appendChild($.title); root.appendChild($.play); root.appendChild($.host);

    $.sound.addEventListener('click', function () { if (A) { A.setMuted(!A.isMuted()); } sfx('click'); renderChrome(); });
    $.vol.addEventListener('input', function () { if (A) { A.setVolume(Number($.vol.value) / 100); } });
    $.vol.addEventListener('change', function () { sfx('click'); });
    $.motion.addEventListener('click', function () { userReduce = !userReduce; storeSetting(MOTION_KEY, userReduce ? 'reduce' : 'full'); sfx('click'); renderChrome(); });
    $.lang.addEventListener('click', function () { lang = lang === 'en' ? 'zh' : 'en'; storeSetting(LANG_KEY, lang); sfx('click'); renderChrome(); rebuildPanel(); });
  }

  function padHold(id, dir) {
    var b = el('button', { type: 'button', 'class': 'pad-btn', 'data-testid': id });
    function down(e) { e.preventDefault(); rt.input[dir] = true; if (A) { A.unlock(); } }
    function up(e) { e.preventDefault(); rt.input[dir] = false; }
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    return b;
  }
  function padTap(id, fn) {
    var b = el('button', { type: 'button', 'class': 'pad-btn big', 'data-testid': id });
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (A) { A.unlock(); } fn(); });
    return b;
  }

  // ---- text and chrome -----------------------------------------------------------------------------
  var ZONE_OF_SCENE = { study: 'zone.study', server: 'zone.D', island: 'zone.island' };
  function zoneKey() {
    if (rt.scene !== 'world') { return ZONE_OF_SCENE[rt.scene]; }
    var x = rt.player ? rt.player.x : 0, z = 'B';
    D.ZONES.forEach(function (q) { if (x >= q.from) { z = q.id; } });
    return 'zone.' + z;
  }

  function renderChrome() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.classList.toggle('reduce-motion', reduce());
    document.title = tr('game.title');
    $.brand.textContent = tr('game.title');
    var muted = A ? A.isMuted() : false;
    $.sound.textContent = muted ? tr('ui.soundOff') : tr('ui.soundOn');
    $.vol.value = String(Math.round((A ? A.getVolume() : 0.7) * 100));
    $.vol.setAttribute('aria-label', tr('ui.volume'));
    $.motion.textContent = userReduce ? tr('ui.motionReduced') : tr('ui.motionFull');
    $.lang.textContent = tr('ui.language');
    $.canvas.setAttribute('aria-label', tr('game.title'));
    $.padLeft.textContent = tr('pad.left'); $.padRight.textContent = tr('pad.right'); $.padJump.textContent = tr('pad.jump'); $.padUse.textContent = tr('pad.use');
    $.padLeft.setAttribute('aria-label', tr('pad.left')); $.padRight.setAttribute('aria-label', tr('pad.right')); $.padJump.setAttribute('aria-label', tr('pad.jump')); $.padUse.setAttribute('aria-label', tr('pad.use'));
    $.keys.textContent = tr('ui.keys');
    $.replay.textContent = tr('ui.again');
    renderHud(); renderCaption(); renderTitle();
    $.stage.hidden = rt.panel && rt.panel.type !== 'dialogue';
  }

  function renderHud() {
    $.zone.textContent = rt.mode === 'play' ? tr(zoneKey()) : '';
    var total = D.WORLD_STARS.length;
    $.stars.textContent = tr('ui.stars', { n: st.stars.length, total: total });
    $.falls.textContent = tr('ui.falls', { n: st.falls });
    if (rt.scene === 'island') { $.stars.textContent = tr('isl.visited', { n: st.island.seen.length, total: St.islandObjects(st).filter(function (o) { return o.type !== 'x'; }).length }); $.falls.textContent = tr('ui.stars', { n: st.stars.length, total: total }); }
    $.hud.hidden = rt.mode !== 'play';
  }

  function say(key, who, vars) { rt.cap = { key: key, who: who || 'mara', vars: vars || null }; renderCaption(); }
  function renderCaption() {
    if (!rt.cap) { $.who.textContent = ''; $.say.textContent = ''; $.cap.setAttribute('data-who', ''); return; }
    $.who.textContent = tr('sp.' + rt.cap.who);
    $.say.textContent = tr(rt.cap.key, rt.cap.vars);
    $.cap.setAttribute('data-who', rt.cap.who);
  }

  function hasSave() { return !!rt.saved && !rt.saved.corrupt; }
  function renderTitle() {
    var c = $.title; c.textContent = '';
    if (rt.mode !== 'title') { c.hidden = true; return; }
    c.hidden = false;
    c.appendChild(el('h1', { text: tr('game.title') }));
    c.appendChild(el('p', { 'class': 'chapter', text: tr('game.chapter') }));
    c.appendChild(el('p', { 'class': 'lede', text: tr('game.tagline') }));
    if (rt.saved && rt.saved.corrupt) { c.appendChild(el('p', { 'class': 'notice', text: tr('ui.saveCorrupt') })); }
    var row = el('div', { 'class': 'row' });
    if (hasSave()) { row.appendChild(btn(tr('ui.continue'), continueGame, 'btn primary', 'continue')); row.appendChild(btn(tr('ui.newGame'), newGame, 'btn', 'new-game')); }
    else { row.appendChild(btn(tr('ui.start'), newGame, 'btn primary', 'start')); }
    c.appendChild(row);
    c.appendChild(el('p', { 'class': 'small', text: tr('ui.saveNote') }));
    c.appendChild(el('p', { 'class': 'small', text: tr('ui.keys') }));
  }

  // ---- saving --------------------------------------------------------------------------------------
  function persist() {
    if (rt.mode !== 'play' || !rt.player) { return; }
    st.pos[rt.scene] = { x: Math.round(rt.player.x * 100) / 100, y: Math.round(rt.player.y * 100) / 100 };
    st.scene = rt.scene;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(St.serialize(st))); } catch (e) { /* storage full or blocked */ }
  }
  function readSave() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) { return null; }
    try { var s = St.parse(JSON.parse(raw)); return s ? { state: s } : { corrupt: true }; } catch (e) { return { corrupt: true }; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ---- scenes --------------------------------------------------------------------------------------
  function sceneWorld(name) { return { study: D.buildStudy, world: D.buildWorld, server: D.buildServer, island: D.buildIsland }[name](); }
  function respawn() {
    if (rt.scene === 'world') { var cp = D.CHECKPOINTS[st.cp]; return { x: cp.x, y: cp.y }; }
    var s = D.CONFIG.scenes[rt.scene].spawn; return { x: s.x, y: s.y };
  }
  function enterScene(name, spot) {
    rt.scene = name; rt.world = sceneWorld(name); rt.particles = []; rt.building = []; rt.buildQueue = []; rt.near = null;
    if (name === 'world') {
      if (Pz.isComplete(st.placed) && !st.bridge) { st.bridge = true; }
      if (st.bridge) { St.applyBridge(rt.world, st.placed); }
    }
    var p = spot || st.pos[name];
    if (E.boxHits(rt.world, p.x, p.y)) { p = respawn(); }
    rt.player = E.createState(p.x, p.y);
    rt.player.onGround = false;
    rt.cam = camTarget(true);
    rt.frozen = false; rt.isl = null;
    if (name === 'island') { startIsland(); }
    if (A) { A.setScene(name); }
    renderHud();
  }
  function camTarget(snap) {
    var w = rt.world, c = S.cameraFor(rt.player.x, rt.player.y, w);
    if (rt.scene === 'study') { c = { x: 0, y: 0 }; }
    if (rt.scene === 'island') { c = { x: S.cameraFor(rt.player.x, 8, w).x, y: -24 }; }
    if (rt.scene === 'server') { c.y = 0; }
    if (snap || reduce()) { return c; }
    return { x: rt.cam.x + (c.x - rt.cam.x) * 0.14, y: rt.cam.y + (c.y - rt.cam.y) * 0.14 };
  }

  function newGame() {
    clearSave();
    st = St.newState();
    rt.read = []; rt.cap = null; rt.panel = null; rt.saved = null;
    beginPlay();
    enterScene('study', null);
    say('say.intro', 'mara');
    persist();
  }
  function continueGame() {
    if (!hasSave()) { newGame(); return; }
    st = rt.saved.state; rt.saved = null; rt.read = [];
    beginPlay();
    enterScene(st.scene, null);
    if (st.scene === 'study' && !st.flags.introSeen) { say('say.intro', 'mara'); }
    persist();
  }
  function beginPlay() {
    rt.mode = 'play'; rt.fade = 0; rt.trans = null; rt.later = [];
    $.title.hidden = true; $.play.hidden = false; $.replay.hidden = true;
    closePanel(true);
    renderChrome();
    if (A) { A.unlock(); }
  }

  // fade out, run fn at full black, fade in
  function transition(fn) {
    if (rt.trans) { return; }
    rt.trans = { phase: 'out', t: 0, fn: fn };
    rt.input.left = false; rt.input.right = false;
  }
  function updateTransition(dt) {
    var tr0 = rt.trans; if (!tr0) { return; }
    var dur = reduce() ? 0.01 : 0.35;
    tr0.t += dt;
    if (tr0.phase === 'out') { rt.fade = Math.min(1, tr0.t / dur); if (tr0.t >= dur) { tr0.fn(); tr0.phase = 'in'; tr0.t = 0; } }
    else { rt.fade = Math.max(0, 1 - tr0.t / dur); if (tr0.t >= dur) { rt.fade = 0; rt.trans = null; } }
  }
  function schedule(delay, fn) { rt.later.push({ at: rt.t + delay, fn: fn }); }

  // ---- particles -----------------------------------------------------------------------------------
  function burst(xTiles, yTiles, n, color, spread, up) {
    var count = reduce() ? Math.ceil(n / 3) : n;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      rt.particles.push({ x: xTiles * T, y: yTiles * T, vx: Math.cos(a) * (spread || 18), vy: Math.sin(a) * (spread || 18) - (up || 6), g: 1, t0: rt.t, life: 0.6, size: 2, color: color });
    }
  }
  function dust(x, y, dir) {
    if (reduce()) { return; }
    for (var i = 0; i < 4; i++) { rt.particles.push({ x: x * T, y: y * T - 1, vx: (i - 1.5) * 8 * (dir || 1), vy: -4 - i, g: 0, t0: rt.t, life: 0.35, size: 2, color: '#e8dcc0' }); }
  }
  function hearts(x, y) {
    for (var i = 0; i < 4; i++) { rt.particles.push({ x: x * T + (i - 1.5) * 4, y: y * T - 8, vx: 0, vy: -14 - i * 3, g: 0, t0: rt.t + i * 0.1, life: 0.9, size: 3, color: '#ff7aa8' }); }
  }

  // ---- simulation ----------------------------------------------------------------------------------
  function objectsHere() {
    if (rt.scene === 'study') { return D.STUDY_OBJECTS; }
    if (rt.scene === 'world') { return D.WORLD_OBJECTS; }
    if (rt.scene === 'server') { return D.SERVER_OBJECTS; }
    return St.islandObjects(st);
  }
  function nearest() {
    var best = null, bd = 99, p = rt.player;
    objectsHere().forEach(function (o) {
      var range = o.range || D.CONFIG.interactRange, dx = Math.abs(p.x - o.x), dy = Math.abs(p.y - o.y);
      if (dx <= range && dy < 1.2 && dx < bd) { best = o; bd = dx; }
    });
    return best;
  }

  function simStep() {
    var frozen = rt.frozen || !!rt.panel || !!rt.trans;
    var res = E.step(rt.player, { left: rt.input.left, right: rt.input.right, jump: rt.jumpQ }, rt.world, { respawn: respawn(), frozen: frozen });
    rt.jumpQ = false;
    var p0 = rt.player; rt.player = res.state;
    res.events.forEach(function (ev) {
      if (ev.type === 'jump') { sfx('jump'); dust(p0.x, p0.y, -p0.facing); }
      else if (ev.type === 'land') { sfx('land'); rt.landT = 0.12; dust(p0.x, p0.y, 1); }
      else if (ev.type === 'step' && rt.scene !== 'island') { sfx('step'); }
      else if (ev.type === 'fall') { onFall(ev); }
    });
    if (rt.landT > 0) { rt.landT -= E.DT; }
    if (rt.actT > 0) { rt.actT -= E.DT; }
    var pl = rt.player;
    rt.anim = rt.actT > 0 ? 'act' : !pl.onGround ? (pl.vy < 0 ? 'jump' : 'fall') : rt.landT > 0 ? 'land' : (Math.abs(pl.vx) > 0.1 && !frozen) ? 'run' : 'idle';
    rt.near = frozen ? null : nearest();
    if (!frozen && rt.useQ) { rt.useQ = false; if (rt.near) { interact(rt.near); } }
    rt.useQ = false;
    if (!frozen) { pickups(); checkpoints(); }
    rt.cam = camTarget(false);
  }

  function onFall(ev) {
    st.falls += 1;
    var water = rt.scene === 'world' && ((ev.col >= 17 && ev.col <= 19) || (ev.col >= 46 && ev.col <= 48));
    sfx(water ? 'splash' : 'fall');
    say('say.fall', 'mara');
    rt.shake = rt.t + 0.35;
    rt.fade = 0;
    renderHud(); persist();
  }

  function pickups() {
    var p = rt.player, rad = D.CONFIG.pickupRadius + 0.2;
    if (rt.scene === 'world') {
      D.WORLD_STARS.forEach(function (s) {
        if (st.stars.indexOf(s[0]) >= 0) { return; }
        if (Math.abs(p.x - (s[1] + 0.5)) < rad && Math.abs((p.y - 0.5) - (s[2] + 0.5)) < rad + 0.2) {
          st.stars.push(s[0]); sfx('star', st.stars.length); burst(s[1] + 0.5, s[2] + 0.5, 8, '#fff2a0', 16, 4);
          if (s[0] === 'g1') { sfx('hidden'); }
          renderHud(); persist();
        }
      });
    } else if (rt.scene === 'server') {
      D.SERVER_FLOPPIES.forEach(function (f) {
        if (st.floppies.indexOf(f[0]) >= 0) { return; }
        if (Math.abs(p.x - (f[1] + 0.5)) < rad && Math.abs((p.y - 0.5) - (f[2] + 0.5)) < rad + 0.2) {
          st.floppies.push(f[0]); sfx('collect'); burst(f[1] + 0.5, f[2] + 0.5, 8, '#5fe0f0', 16, 4);
          if (st.floppies.length === D.SERVER_FLOPPIES.length) { say('say.floppyAll', 'mara'); } else { say('say.floppy', 'mara', { n: st.floppies.length }); }
          persist();
        }
      });
    }
  }

  function checkpoints() {
    if (rt.scene !== 'world') { return; }
    var p = rt.player;
    D.CHECKPOINTS.forEach(function (cp) {
      if (cp.id > st.cp && Math.abs(p.x - cp.x) < 0.8 && Math.abs(p.y - cp.y) < 1.5 && p.onGround) { st.cp = cp.id; sfx('check'); say('say.checkpoint', 'sys'); persist(); }
    });
  }

  // ---- interactions --------------------------------------------------------------------------------
  function markRead(id) { if (rt.read.indexOf(id) < 0) { rt.read.push(id); } }
  function act() { rt.actT = 0.35; }

  function interact(o) {
    act();
    if (rt.scene === 'study') { return interactStudy(o); }
    if (rt.scene === 'world') { return interactWorld(o); }
    if (rt.scene === 'server') { return interactServer(o); }
    return interactIsland(o);
  }

  function interactStudy(o) {
    if (o.id === 'shelf') { st.flags.bookFell = true; sfx('thud'); say('say.shelf', 'mara'); }
    else if (o.id === 'tape') {
      if (!st.flags.tape) { st.flags.tape = true; sfx('collect'); burst(o.x, 8.5, 8, '#fff2a0', 16, 4); say('say.tape', 'mara'); } else { sfx('click'); say('say.tapeAgain', 'mara'); }
    }
    else if (o.id === 'photo') { sfx('click'); say('say.photo', 'mara'); }
    else if (o.id === 'notes') { st.flags.notesRead = true; sfx('click'); say('say.notes', 'elena'); }
    else if (o.id === 'lamp') { st.flags.lamp = !st.flags.lamp; sfx('click'); say('say.lamp', 'mara'); }
    else if (o.id === 'monitor') {
      st.flags.introSeen = true; sfx('powerup'); say('say.monitor', 'mara'); rt.frozen = true;
      schedule(0.9, function () {
        transition(function () { enterScene('world', null); persist(); });
      });
    }
    persist();
  }

  function interactWorld(o) {
    var id = o.id;
    if (id === 'cat') {
      if (!st.flags.catPetted) { st.flags.catPetted = true; say('say.cat', 'elena'); } else { say('say.cat2', 'mara'); }
      sfx('meow'); hearts(o.x, o.y - 0.6);
    } else if (id === 'garden') {
      st.flags.garden = true; sfx('hidden'); burst(o.x, o.y - 1, 10, '#fff2a0', 20, 6); say('say.garden', 'elena'); markRead(id);
    } else if (id === 'blueprint') { sfx('click'); say('say.blueprint', 'mara'); }
    else if (id === 'bridge') {
      if (st.bridge) { say('say.bridgeDone', 'mara'); }
      else if (st.backpack.length === 0 && !Pz.SLOTS.some(function (s) { return st.placed[s.id]; })) { sfx('click'); say('say.bridgeNone', 'mara'); }
      else { sfx('server'); openRestore(); }
    } else if (id === 'door') {
      sfx('door'); say('say.door', 'mara'); rt.frozen = true;
      schedule(0.5, function () { transition(function () { enterScene('server', null); if (st.serverSeen.length === 0) { say('say.serverIntro', 'mara'); } persist(); }); });
    } else if (id === 'terminal') { sfx('powerup'); openDialogue(); }
    else if (id === 'crab') { sfx('click'); say('say.crab', 'mara'); }
    else if (o.type === 'read') { sfx('click'); markRead(id); say('say.' + id, 'elena'); }
    persist();
  }

  function interactServer(o) {
    if (o.id === 'exit') {
      sfx('door'); rt.frozen = true;
      schedule(0.2, function () { transition(function () { enterScene('world', { x: 62.5, y: 12 }); persist(); }); });
    } else if (o.copy) { openCopy(o.copy); }
  }

  var ISLAND_TEXT = { cabin: ['isl.cabin', 'mara'], tree: ['isl.tree', 'mara'], console: ['isl.console', 'elena'], photo: ['isl.photo', 'mara'], cassette: ['isl.cassette', 'mara'], cat: ['isl.cat', 'elena'], jar: ['isl.jar', 'mara'], note: ['isl.note', 'elena'] };
  function interactIsland(o) {
    var tx = ISLAND_TEXT[o.id];
    sfx('click');
    if (o.id === 'cassette') { sfx('tape'); }
    if (o.id === 'cat') { sfx('meow'); hearts(o.x, o.y - 0.6); }
    if (o.id === 'note') { sfx('hidden'); }
    if (o.id === 'photo' || o.id === 'cabin') { burst(o.x, o.y - 1, 6, '#ffd8a0', 14, 4); }
    say(tx[0], tx[1], o.id === 'jar' ? { n: st.stars.length } : null);
    if (o.id === 'console') { schedule(2.2, function () { say('isl.console2', 'mara'); }); }
    if (st.island.seen.indexOf(o.id) < 0) { st.island.seen.push(o.id); }
    var total = St.islandObjects(st).length;
    if (st.island.seen.length >= total) { schedule(o.id === 'console' ? 4.6 : 2.6, function () { say('isl.done', 'sys'); }); }
    renderHud(); persist();
  }

  // ---- island growth -------------------------------------------------------------------------------
  function startIsland() {
    if (st.island.stage >= D.ISLAND_STAGES) { rt.isl = { stage: D.ISLAND_STAGES, t0: rt.t, done: true }; $.replay.hidden = false; return; }
    rt.isl = { stage: 1, t0: rt.t, done: false };
    rt.frozen = true; $.replay.hidden = true;
    sfx('grow', 0); say('isl.grow1', 'sys');
  }
  function islandDur() { return reduce() ? 0.5 : 1.7; }
  function updateIsland() {
    var g = rt.isl; if (!g || g.done) { return; }
    if (rt.t - g.t0 >= islandDur()) {
      if (g.stage >= D.ISLAND_STAGES) {
        g.done = true; rt.frozen = false; st.island.stage = D.ISLAND_STAGES; $.replay.hidden = false; persist();
        return;
      }
      g.stage += 1; g.t0 = rt.t; sfx('grow', g.stage - 1); say('isl.grow' + g.stage, 'sys');
      if (g.stage === D.ISLAND_STAGES) { burst(20, 8, 12, '#fff2a0', 24, 8); }
    }
  }

  // ---- panels --------------------------------------------------------------------------------------
  function closePanel(silent) {
    rt.panel = null; rt.selected = null; rt.dlg = null;
    $.host.textContent = ''; $.host.hidden = true;
    $.stage.hidden = false;
    $.play.hidden = rt.mode !== 'play';
    if (!silent && document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
  }
  function openPanelShell(type, hideStage) {
    rt.panel = { type: type }; rt.input.left = false; rt.input.right = false;
    $.host.hidden = false; $.stage.hidden = !!hideStage; $.play.hidden = true;
  }
  function rebuildPanel() {
    if (!rt.panel) { return; }
    var p = rt.panel;
    if (p.type === 'copy') { buildCopy(p.copy); } else if (p.type === 'restore') { buildRestore(); } else if (p.type === 'dialogue') { buildDialogue(); }
    renderChrome();
  }

  // ---- copy viewer ---------------------------------------------------------------------------------
  function pieceRole(id) { return id.split('-')[1]; }
  function pieceName(id) {
    var p = Pz.PIECES[id];
    return tr('copy.' + p.copy) + ' · ' + tr('piece.' + pieceRole(id)) + (p.corrupt ? ' (' + tr('piece.damaged') + ')' : '');
  }
  function pieceCanvasEl(id) {
    var src = S.pieceCanvas(id);
    var c = el('canvas', { width: String(src.width), height: String(src.height), 'class': 'piececv' });
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = (src.width * 2) + 'px';
    return c;
  }

  function openCopy(id) {
    openPanelShell('copy', true);
    rt.panel.copy = id;
    if (st.serverSeen.indexOf(id) < 0) { st.serverSeen.push(id); persist(); }
    sfx('server');
    buildCopy(id);
  }
  function buildCopy(id) {
    var copy = Pz.COPIES[id];
    var h = $.host; h.textContent = '';
    var cv = el('canvas', { width: String(VW), height: String(VH), 'class': 'view', 'data-testid': 'copy-canvas', role: 'img', 'aria-label': tr('copy.' + id) });
    rt.panel.ctx = cv.getContext('2d'); rt.panel.ctx.imageSmoothingEnabled = false; rt.panel.canvas = cv;
    var title = tr('copy.' + id) + ' · ' + tr('copy.date.m' + copy.month) + ' · ' + tr('copy.build', { n: copy.build });
    var pack = el('p', { 'class': 'pack', 'data-testid': 'pack' });
    var fb = el('p', { 'class': 'feedback', role: 'status', 'data-testid': 'copy-feedback' });
    var cards = el('div', { 'class': 'cards' });
    function refresh() {
      cards.textContent = '';
      pack.textContent = tr('copy.pack', { n: st.backpack.length, max: Pz.BACKPACK_SIZE });
      copy.pieces.forEach(function (pid) {
        var carrying = st.backpack.indexOf(pid) >= 0;
        var placed = Pz.SLOTS.some(function (s) { return st.placed[s.id] === pid; });
        var b = btn(carrying ? tr('copy.putBack') : tr('copy.take'), function () {
          if (carrying) { st.backpack = Pz.drop(st.backpack, pid); sfx('putback'); fb.textContent = ''; }
          else {
            var r = Pz.take(st.backpack, pid);
            if (r.ok) { st.backpack = r.backpack; sfx('pick'); fb.textContent = ''; }
            else { sfx('wrong'); fb.textContent = tr('copy.full'); }
          }
          persist(); refresh();
        }, carrying ? 'btn' : 'btn primary', 'take-' + pid);
        if (placed) { b.disabled = true; }
        var card = el('div', { 'class': 'card' + (carrying ? ' carried' : ''), 'data-testid': 'card-' + pid }, [pieceCanvasEl(pid), el('span', { 'class': 'cardname', text: pieceName(pid) }), b]);
        cards.appendChild(card);
      });
    }
    h.appendChild(el('section', { 'class': 'panel', 'data-testid': 'copy-panel' }, [
      el('h2', { text: title }), cv, el('p', { 'class': 'note', text: tr('copy.' + id + '.note') }), cards, pack,
      el('p', { 'class': 'small', text: tr('copy.hint', { max: Pz.BACKPACK_SIZE }) }), fb,
      btn(tr('ui.close'), function () { closePanel(); sfx('door'); persist(); }, 'btn', 'panel-close')
    ]));
    refresh();
  }

  // ---- restore panel -------------------------------------------------------------------------------
  function openRestore() {
    openPanelShell('restore', true);
    rt.flash = null; rt.selected = null;
    buildRestore();
  }
  function slotRect(id) {
    var L = S.RESTORE;
    return { left: (L.slotX[id] / VW * 100) + '%', top: (L.top / VH * 100) + '%', width: (L.slotW[id] / VW * 100) + '%', height: (L.height / VH * 100) + '%' };
  }

  function buildRestore() {
    var h = $.host; h.textContent = '';
    var cv = el('canvas', { width: String(VW), height: String(VH), 'class': 'view', 'data-testid': 'restore-canvas', role: 'img', 'aria-label': tr('restore.title') });
    rt.panel.ctx = cv.getContext('2d'); rt.panel.ctx.imageSmoothingEnabled = false; rt.panel.canvas = cv;
    var fb = el('p', { 'class': 'feedback', role: 'status', 'data-testid': 'feedback' });
    var tray = el('div', { 'class': 'tray', 'data-testid': 'tray' });
    var slotsWrap = el('div', { 'class': 'slots' });
    var rstage = el('div', { 'class': 'rstage' }, [cv, slotsWrap]);
    rt.panel.fb = fb;

    function feedbackOk() { fb.className = 'feedback ok'; fb.textContent = tr('restore.fits'); }
    function feedbackFail(reason) {
      fb.className = 'feedback bad'; fb.textContent = '';
      var icon = S.reasonIcon(reason); var ic = el('canvas', { width: '13', height: '13', 'class': 'reasonicon' }); ic.getContext('2d').drawImage(icon, 0, 0);
      fb.appendChild(ic);
      fb.appendChild(document.createTextNode(' ' + tr('reason.' + reason) + (reason === 'build' ? ' · ' + tr('restore.need', { n: Pz.WORLD_BUILD }) : '')));
    }

    function tryPlace(pieceId, slotId, pieceEl) {
      var res = Pz.place(st.placed, st.backpack, pieceId, slotId);
      rt.selected = null;
      if (res.ok) {
        st.placed = res.placed; st.backpack = res.backpack;
        sfx('snap'); feedbackOk(); rt.flash = { slot: slotId, ok: true, t0: rt.t };
        burst((S.RESTORE.slotX[slotId] + S.RESTORE.slotW[slotId] / 2) / T, 6, 6, '#fff2a0', 14, 4);
        persist(); refresh();
        if (res.complete) { sfx('bridge'); schedule(reduce() ? 0.3 : 1.0, function () { if (rt.panel && rt.panel.type === 'restore') { closePanel(); startBridge(); } }); }
      } else {
        st.wrong += 1; sfx('wrong'); feedbackFail(res.reason); rt.flash = { slot: slotId, ok: false, t0: rt.t };
        if (pieceEl && !reduce()) { pieceEl.classList.remove('shake'); void pieceEl.offsetWidth; pieceEl.classList.add('shake'); }
        persist(); refresh();
      }
    }

    function slotAt(x, y) {
      var hit = null;
      Pz.SLOTS.forEach(function (s) { var b = slotsWrap.querySelector('[data-slot="' + s.id + '"]'); if (b) { var r = b.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top - 12 && y <= r.bottom + 12) { hit = s.id; } } });
      return hit;
    }

    function pieceButton(pid) {
      var b = el('button', { type: 'button', 'class': 'piece' + (rt.selected === pid ? ' selected' : ''), 'data-testid': 'piece-' + pid, 'aria-label': pieceName(pid) }, [pieceCanvasEl(pid)]);
      var drag = null, suppress = false;
      b.addEventListener('pointerdown', function (e) {
        if (A) { A.unlock(); }
        drag = { x: e.clientX, y: e.clientY, moved: false, ghost: null };
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      });
      b.addEventListener('pointermove', function (e) {
        if (!drag) { return; }
        if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 8) {
          drag.moved = true; sfx('pick');
          drag.ghost = pieceCanvasEl(pid); drag.ghost.className = 'piececv ghost'; document.body.appendChild(drag.ghost); b.classList.add('dragging');
        }
        if (drag.moved && drag.ghost) {
          drag.ghost.style.left = (e.clientX - drag.ghost.width) + 'px'; drag.ghost.style.top = (e.clientY - drag.ghost.height) + 'px';
          var over = slotAt(e.clientX, e.clientY);
          Pz.SLOTS.forEach(function (s) { var sb = slotsWrap.querySelector('[data-slot="' + s.id + '"]'); if (sb) { sb.classList.toggle('over', s.id === over); } });
        }
      });
      function end(e) {
        if (!drag) { return; }
        var d = drag; drag = null;
        try { b.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        b.classList.remove('dragging');
        if (d.ghost && d.ghost.parentNode) { d.ghost.parentNode.removeChild(d.ghost); }
        Pz.SLOTS.forEach(function (s) { var sb = slotsWrap.querySelector('[data-slot="' + s.id + '"]'); if (sb) { sb.classList.remove('over'); } });
        if (d.moved) {
          suppress = true; setTimeout(function () { suppress = false; }, 50);
          var target = slotAt(e.clientX, e.clientY);
          if (target) { tryPlace(pid, target, b); } else { sfx('putback'); }
        }
      }
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('click', function () {
        if (suppress) { return; }
        rt.selected = rt.selected === pid ? null : pid; sfx('pick'); refresh();
        var again = tray.querySelector('[data-testid="piece-' + pid + '"]'); if (again) { again.focus(); }
      });
      return b;
    }

    function refresh() {
      tray.textContent = '';
      tray.appendChild(el('h3', { text: tr('restore.tray') }));
      var list = el('div', { 'class': 'traylist' });
      if (st.backpack.length === 0) { list.appendChild(el('span', { 'class': 'small', text: tr('restore.empty') })); }
      st.backpack.forEach(function (pid) { list.appendChild(pieceButton(pid)); });
      tray.appendChild(list);
      slotsWrap.textContent = '';
      Pz.SLOTS.forEach(function (slot, i) {
        var filled = st.placed[slot.id];
        var r = slotRect(slot.id);
        var sb = el('button', { type: 'button', 'class': 'slot' + (filled ? ' filled' : '') + (rt.selected && !filled ? ' ready' : ''), 'data-testid': 'slot-' + slot.id, 'data-slot': slot.id, 'aria-label': tr('restore.slot', { n: i + 1 }) + (filled ? ' · ' + pieceName(filled) : '') }, [el('span', { 'class': 'slotlabel', text: String(i + 1) })]);
        sb.style.left = r.left; sb.style.top = r.top; sb.style.width = r.width; sb.style.height = r.height;
        sb.addEventListener('click', function () {
          if (rt.selected) { tryPlace(rt.selected, slot.id, null); }
          else if (filled) {
            var u = Pz.unplace(st.placed, st.backpack, slot.id); st.placed = u.placed; st.backpack = u.backpack; sfx('putback'); fb.className = 'feedback'; fb.textContent = ''; persist(); refresh();
          }
        });
        slotsWrap.appendChild(sb);
      });
    }

    h.appendChild(el('section', { 'class': 'panel', 'data-testid': 'restore-panel' }, [
      el('h2', { text: tr('restore.title') }), el('p', { 'class': 'small', text: tr('restore.hint') + ' ' + tr('restore.need', { n: Pz.WORLD_BUILD }) }),
      rstage, tray, fb,
      btn(tr('ui.close'), function () { closePanel(); persist(); }, 'btn', 'panel-close')
    ]));
    refresh();
  }

  // ---- bridge build --------------------------------------------------------------------------------
  function startBridge() {
    rt.frozen = true; rt.building = []; rt.buildQueue = [];
    var i = 0, start = rt.t + 0.5, gap = reduce() ? 0.06 : 0.14;
    Pz.SLOTS.forEach(function (slot) {
      Pz.tilesFor(st.placed[slot.id], slot.id).forEach(function (tile) {
        var item = { col: tile.col, row: tile.row, t0: start + i * gap, applied: false, idx: i };
        rt.building.push(item); i += 1;
      });
    });
    rt.bridgeEnd = start + i * gap + 0.4;
    say('say.bridgeDone', 'sys');
  }
  function updateBridge() {
    if (!rt.building.length) { return; }
    var all = true;
    rt.building.forEach(function (b) {
      if (!b.sounded && rt.t >= b.t0) { b.sounded = true; sfx('plank', b.idx); burst(b.col + 0.5, b.row, 3, '#fff2a0', 10, 3); }
      if (!b.applied && rt.t >= b.t0 + (reduce() ? 0 : 0.25)) { rt.world.set(b.col, b.row, 'P'); b.applied = true; }
      if (!b.applied) { all = false; }
    });
    if (all && rt.t >= rt.bridgeEnd) {
      st.bridge = true; rt.building = []; rt.frozen = false; sfx('bridge'); burst(67, 9, 14, '#fff2a0', 26, 8);
      say('say.bridgeDone', 'mara'); persist();
    }
  }

  // ---- ending dialogue -----------------------------------------------------------------------------
  var DIALOGUE = [['elena', 'end.elena1'], ['elena', 'end.elena2'], ['elena', 'end.elena3'], ['mara', 'end.mara1']];
  function openDialogue() {
    openPanelShell('dialogue', false);
    rt.panel.index = 0; rt.panel.shown = 0; rt.panel.started = rt.t; rt.frozen = true;
    buildDialogue();
  }
  function dlgText() { return tr(DIALOGUE[rt.panel.index][1]); }
  function buildDialogue() {
    var p = rt.panel; var h = $.host; h.textContent = '';
    var who = el('span', { 'class': 'who' }); var txt = el('p', { 'class': 'dlgtext', 'data-testid': 'dialogue-text' });
    var next = btn(tr('ui.next'), advanceDialogue, 'btn primary', 'dialogue-next');
    p.whoEl = who; p.txtEl = txt;
    h.appendChild(el('section', { 'class': 'panel dialogue', 'data-testid': 'dialogue', 'data-who': DIALOGUE[p.index][0] }, [el('h2', { text: tr('end.title') }), who, txt, next]));
    who.textContent = tr('sp.' + DIALOGUE[p.index][0]);
    txt.textContent = reduce() ? dlgText() : dlgText().slice(0, p.shown);
    if (reduce()) { p.shown = dlgText().length; }
  }
  function advanceDialogue() {
    var p = rt.panel; if (!p || p.type !== 'dialogue') { return; }
    var full = dlgText();
    if (p.shown < full.length) { p.shown = full.length; p.txtEl.textContent = full; return; }
    if (p.index < DIALOGUE.length - 1) {
      p.index += 1; p.shown = 0; p.started = rt.t; buildDialogue(); sfx('click');
    } else {
      closePanel(); rt.frozen = true; st.ended = true; persist();
      transition(function () { enterScene('island', D.CONFIG.scenes.island.spawn); persist(); });
    }
  }
  function updateDialogue() {
    var p = rt.panel; if (!p || p.type !== 'dialogue' || reduce()) { return; }
    var full = dlgText();
    if (p.shown < full.length) {
      var target = Math.min(full.length, Math.floor((rt.t - p.started) * 42));
      if (target > p.shown) { p.shown = target; p.txtEl.textContent = full.slice(0, p.shown); if (p.shown % 3 === 0) { sfx('blip'); } }
    }
  }

  // ---- main loop -----------------------------------------------------------------------------------
  var acc = 0, last = 0;
  function draw() {
    var ctx = $.ctx, v;
    var shaking = rt.t < rt.shake && !reduce();
    if (rt.mode === 'title') {
      S.drawTitle(ctx, { t: rt.t, reduce: reduce(), world: rt.titleWorld, state: st });
      return;
    }
    var common = { t: rt.t, reduce: reduce(), state: st, player: rt.player, anim: rt.anim, particles: rt.particles, near: rt.near, fade: rt.fade, cam: rt.cam, world: rt.world };
    if (rt.scene === 'study') { S.drawStudy(ctx, common); }
    else if (rt.scene === 'world') { common.stars = D.WORLD_STARS.filter(function (s) { return st.stars.indexOf(s[0]) < 0; }); common.building = rt.building; common.state = { cp: st.cp, read: rt.read, flags: st.flags }; S.drawWorld(ctx, common); }
    else if (rt.scene === 'server') { S.drawServer(ctx, common); }
    else { common.stage = rt.isl ? rt.isl.stage : D.ISLAND_STAGES; common.stageProgress = rt.isl && !rt.isl.done ? Math.min(1, (rt.t - rt.isl.t0) / islandDur()) : 1; S.drawIsland(ctx, common); }
    if (rt.scene === 'study' && rt.fade > 0) { ctx.globalAlpha = rt.fade; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (shaking) { /* a brief shake: re-blit the frame offset by a pixel */ var off = Math.round(Math.sin(rt.t * 90) * 2); ctx.drawImage($.canvas, off, 0); }
  }
  function drawPanel() {
    var p = rt.panel; if (!p || !p.ctx) { return; }
    if (p.type === 'copy') { S.drawCopy(p.ctx, { t: rt.t, reduce: reduce(), copy: p.copy }); }
    else if (p.type === 'restore') { S.drawRestore(p.ctx, { t: rt.t, reduce: reduce(), placed: st.placed, flash: rt.flash }); }
  }

  function tick(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    rt.t += dt;
    var due = rt.later.filter(function (l) { return l.at <= rt.t; });
    if (due.length) { rt.later = rt.later.filter(function (l) { return l.at > rt.t; }); due.forEach(function (l) { l.fn(); }); }
    if (rt.mode === 'play') {
      updateTransition(dt);
      acc += dt;
      while (acc >= E.DT) { acc -= E.DT; simStep(); }
      updateBridge(); updateIsland(); updateDialogue();
      rt.particles = rt.particles.filter(function (q) { return rt.t - q.t0 < q.life + 0.05; });
      if (rt.t - rt.lastSave > 2) { rt.lastSave = rt.t; persist(); }
      var zk = $.zone.getAttribute('data-k'); var nk = zoneKey(); if (zk !== nk) { $.zone.setAttribute('data-k', nk); renderHud(); }
    } else { acc = 0; }
    draw(); drawPanel();
    window.requestAnimationFrame(tick);
  }

  // ---- input ---------------------------------------------------------------------------------------
  function isTyping(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
  window.addEventListener('keydown', function (e) {
    if (isTyping(e)) { return; }
    if (A) { A.unlock(); }
    var k = e.key;
    if (rt.mode !== 'play') { return; }
    if (rt.panel) {
      if (rt.panel.type === 'dialogue' && (k === 'e' || k === 'E' || k === 'Enter' || k === ' ')) { if (e.target === document.body || e.target === document.documentElement) { e.preventDefault(); advanceDialogue(); } return; }
      if (k === 'Escape' && rt.panel.type !== 'dialogue') { closePanel(); persist(); }
      return;
    }
    var onButton = e.target && e.target.tagName === 'BUTTON';
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { rt.input.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { rt.input.right = true; e.preventDefault(); }
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!onButton || k !== ' ') { if (!e.repeat) { rt.jumpQ = true; } e.preventDefault(); } }
    else if (k === 'e' || k === 'E' || (k === 'Enter' && !onButton)) { if (!e.repeat) { rt.useQ = true; } }
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { rt.input.left = false; } else if (k === 'ArrowRight' || k === 'd' || k === 'D') { rt.input.right = false; }
  });
  window.addEventListener('blur', function () { rt.input.left = false; rt.input.right = false; });
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { persist(); } });
  window.addEventListener('pointerdown', function () { if (A) { A.unlock(); } });

  // Read-only snapshot for the automated tests. It exposes nothing that can change the game.
  window.P3Debug = {
    snapshot: function () {
      var p = rt.player || { x: 0, y: 0, vx: 0, vy: 0, onGround: false };
      return {
        mode: rt.mode, scene: rt.scene, x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, cp: st.cp, stars: st.stars.length, falls: st.falls, wrong: st.wrong,
        backpack: st.backpack.slice(), placed: JSON.parse(JSON.stringify(st.placed)), bridge: st.bridge, ended: st.ended, near: rt.near ? rt.near.id : null,
        panel: rt.panel ? rt.panel.type : null, frozen: rt.frozen, trans: !!rt.trans, island: { stage: rt.isl ? rt.isl.stage : st.island.stage, done: rt.isl ? rt.isl.done : false, seen: st.island.seen.length },
        flags: JSON.parse(JSON.stringify(st.flags)), caption: rt.cap ? rt.cap.key : null, building: rt.building.length, serverSeen: st.serverSeen.slice(), floppies: st.floppies.length
      };
    }
  };

  // ---- start ---------------------------------------------------------------------------------------
  build();
  rt.titleWorld = D.buildWorld();
  rt.saved = readSave();
  $.play.hidden = true; $.host.hidden = true;
  renderChrome();
  window.requestAnimationFrame(tick);
})();
