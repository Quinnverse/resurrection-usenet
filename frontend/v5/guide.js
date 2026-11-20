// The player's guide on screen: the task bar (goal, steps, next step), one-at-a-time tips, the help that grows when no
// progress is made (a direction arrow, then the next step spoken, then the place marked), the memory journal and its
// "new memory" note, and the names of controls for whatever the player is using right now (keys after remapping,
// pad buttons, touch buttons). Everything it shows is read from the game state (core/objectives.js, core/journal.js).
import { objective } from './core/objectives.js';
import { fragments, counts } from './core/journal.js';
import { BEATS } from './core/game.js';
import { groundAt } from './core/physics.js';

export function createGuide(c) {
  // c: { app, el, T, tr, prefs, savePrefs, keys, keyLabel, device(), snap(), game(), mode(), camera, THREE, scene(), play(name) }
  const { app, el } = c;
  const T = (k, v) => c.T(k, v);

  // ---- names of controls ----------------------------------------------------------------------------------------
  function label(action) {
    const d = c.device(), k = c.keys, L = (a) => c.keyLabel(k[a]);
    if (d === 'pad') {
      return { use: 'X', jump: 'A', sprint: 'LB', tab: 'Y', hint: 'Back', aim: 'LT', shoot: 'RT', move: T('dev.pad.l'), look: T('dev.pad.r'), pause: 'Start', journal: 'D-pad ↑', advance: 'A', skip: 'B', steer: T('dev.pad.lr'), pedal: T('dev.pad.lup') }[action] || action;
    }
    if (d === 'touch') {
      const b = (x) => T('dev.t.btn', { b: x });
      return { use: b('E'), jump: b('⤒'), sprint: T('dev.t.far'), tab: b('⇄'), hint: b('?'), aim: b('◉'), shoot: b('●'), move: T('dev.t.left'), look: T('dev.t.right'), pause: b('II'), journal: b('📖'), advance: T('dev.t.tap'), skip: b('II'), steer: T('dev.t.lr'), pedal: T('dev.t.up') }[action] || action;
    }
    return { use: L('use'), jump: L('jump'), sprint: L('sprint'), tab: L('tab'), hint: L('hint'), journal: L('journal'), pause: 'Esc', skip: 'Esc',
      aim: L('aim') + T('dev.or') + T('dev.rmouse'), shoot: T('dev.lclick'), look: T('dev.mouse'),
      move: [L('forward'), L('left'), L('back'), L('right')].join(' '), steer: L('left') + ' / ' + L('right'), pedal: L('forward'),
      advance: [L('use'), L('jump'), T('dev.click')].join(' · ') }[action] || action;
  }
  // the short glyph in an interaction prompt
  const glyph = () => { const d = c.device(); return d === 'pad' ? 'X' : d === 'touch' ? 'E' : c.keyLabel(c.keys.use); };
  const fill = (s) => (typeof s === 'string' && s.indexOf('{k:') >= 0 ? s.replace(/\{k:(\w+)\}/g, (m, a) => label(a)) : s);

  // ---- the task bar ---------------------------------------------------------------------------------------------
  const bar = el('div', { class: 'quest', 'data-testid': 'quest', hidden: '' });
  const qch = el('div', { class: 'qch' }), qgoal = el('div', { class: 'qgoal' }), qprog = el('span', { class: 'qprog', 'data-testid': 'quest-progress' });
  const qchT = el('span', { 'data-testid': 'quest-chapter' }), qgoalT = el('span', { 'data-testid': 'quest-goal' }), qnextL = el('span', { class: 'qnl' }), qnextT = el('span', { 'data-testid': 'quest-next' });
  const qnext = el('div', { class: 'qnext' }), qdone = el('div', { class: 'qdone', 'data-testid': 'quest-done' }), qsteps = el('ol', { class: 'qsteps', 'data-testid': 'quest-steps', hidden: '' });
  const qtoggle = el('button', { type: 'button', class: 'qtoggle', 'data-testid': 'quest-toggle', onclick: (e) => { e.stopPropagation(); expanded = !expanded; sig = ''; } });
  const qnew = el('span', { class: 'qnew', text: '' }), qhelp = el('span', { class: 'qhelp', 'data-testid': 'quest-help' });
  bar.append(qch, qgoal, qnext, qdone, qsteps, qtoggle); qch.append(qchT, qnew); qgoal.append(qgoalT, qprog); qnext.append(qnextL, qnextT, qhelp);
  app.appendChild(bar);
  let expanded = false, sig = '', lastGoal = null, lastDone = null, doneT = 0, newT = 0;

  // ---- help markers: an arrow at the edge of the screen, a beacon in the world -----------------------------------
  const arrow = el('div', { class: 'assist-arrow', 'data-testid': 'assist-arrow', hidden: '' }, [el('span', { text: '➜' })]); app.appendChild(arrow);
  let beacon = null, beaconScene = null;
  function ensureBeacon() {
    const sc = c.scene(); if (!sc) { return null; }
    if (beacon && beaconScene === sc) { return beacon; }
    if (beacon && beacon.parent) { beacon.parent.remove(beacon); }
    const THREE = c.THREE; const g = new THREE.Group(); g.name = 'guideBeacon';
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2;
    g.add(core, ring); core.position.y = 1.9; ring.position.y = 0.04; g.userData = { core, ring }; g.visible = false; g.renderOrder = 5;
    sc.add(g); beacon = g; beaconScene = sc; return g;
  }

  // ---- tips ------------------------------------------------------------------------------------------------------
  const tipBox = el('div', { class: 'tut', 'data-testid': 'tut', hidden: '' }); app.appendChild(tipBox);
  const tutDone = () => { c.prefs.tut = c.prefs.tut || {}; return c.prefs.tut; };
  const markTut = (id) => { if (!tutDone()[id]) { tutDone()[id] = 1; c.savePrefs(); } };
  let tut = null, tutT = 0, moved = 0, looked = 0, lastYaw = null, lastPos = null, firstPromptSeen = false, sinceGoal = 0;

  // ---- journal note ---------------------------------------------------------------------------------------------
  const toast = el('div', { class: 'memtoast', 'data-testid': 'mem-toast', hidden: '' }); app.appendChild(toast);
  let knownFound = null, toastT = 0;

  function events(evs) {
    (evs || []).forEach((e) => {
      if (e.type === 'use' && tut && tut.id === 'use') { finishTut(); }
      if (e.type === 'use') { markTut('use'); }
      if (e.type === 'tab') { markTut('tab'); if (tut && tut.id === 'tab') { finishTut(); } }
      if ((e.type === 'restored' || e.type === 'carved' || e.type === 'lens' || e.type === 'lit') && tut && tut.id === 'hold') { finishTut(); }
      if (e.type === 'restored' || e.type === 'carved') { markTut('hold'); }
      if (e.type === 'beat' && e.loading) { lastGoal = null; knownFound = null; }   // only a load starts over; a beat change in play is a new goal to announce
    });
  }
  function finishTut() { if (tut) { markTut(tut.id); } tut = null; tutT = 0; tipBox.hidden = true; }

  function nextTut(s, o, dt) {
    if (c.prefs.tips === false) { return null; }
    const done = tutDone(); const g = c.game();
    if (!done.move && s.scene !== 'train' && s.scene !== 'ride' && s.scene !== 'porch') { return { id: 'move' }; }
    if (!done.look && done.move && s.scene !== 'train' && s.scene !== 'ride' && s.scene !== 'porch') { return { id: 'look' }; }
    if (!done.use && s.prompt) { return { id: 'use' }; }
    if (!done.goal && done.use) { return { id: 'goal', secs: 7 }; }
    if (!done.hold && s.prompt && s.prompt.hold) { return { id: 'hold', secs: 12 }; }
    if (!done.tab && s.scene === 'town' && s.tab) { return { id: 'tab' }; }
    if (!done.journal && g && counts(g).found > 0 && done.goal) { return { id: 'journal', secs: 9 }; }
    if (!done.pause && done.goal && sinceGoal > 25) { return { id: 'pause', secs: 6 }; }
    void o; void dt; return null;
  }

  // ---- every frame ------------------------------------------------------------------------------------------------
  function update(dt, cine) {
    const g = c.game(); const playing = c.mode() === 'play';
    if (!g || !playing) { bar.hidden = true; arrow.hidden = true; tipBox.hidden = true; if (beacon) { beacon.visible = false; } return; }
    const s = c.snap(); const o = objective(g);
    // ---- task bar
    bar.hidden = !o; bar.classList.toggle('dim', !!cine);
    if (o) {
      const req = o.steps.filter((x) => !x.optional);
      if (lastGoal !== o.goal) { if (lastGoal) { newT = 2.4; qnew.textContent = T('hud.newGoal'); c.play('hint'); } lastGoal = o.goal; lastDone = req.map((x) => x.done); sig = ''; }
      // a step just done: say so, briefly
      const nowDone = req.map((x) => x.done); req.forEach((x, i) => { if (x.done && lastDone && !lastDone[i]) { doneT = 2.8; qdone.textContent = '✓ ' + T('hud.stepDone', { s: T(x.key) }); c.play('blip'); } }); lastDone = nowDone;
      const help = s.assist || 0; const nextText = o.nextKey ? T(o.nextKey) : '';
      const k = [o.goal, o.nextKey, nowDone.join(''), o.progress.n, o.progress.of, expanded, help, c.device(), c.prefs.lang, o.steps.map((x) => (x.done ? 1 : 0)).join(''), Object.values(c.keys).join(',')].join('|');   // remapping a key rewrites the instructions at once
      if (k !== sig) {
        sig = k;
        qchT.textContent = T('chap.' + o.chapter); qgoalT.textContent = T(o.goal);
        qprog.textContent = o.progress.of > 1 ? `${o.progress.n}/${o.progress.of}` : ''; qprog.hidden = !(o.progress.of > 1);
        qnextL.textContent = nextText ? T('hud.next') : ''; qnextT.textContent = nextText; qnext.hidden = !nextText;
        qhelp.textContent = help >= 3 ? T('hud.hintKey') : ''; qnext.classList.toggle('pulse', help >= 2);
        qsteps.textContent = ''; o.steps.forEach((x) => qsteps.append(el('li', { class: (x.done ? 'done' : '') + (x.optional ? ' opt' : '') + (x.id === o.next ? ' now' : ''), text: (x.done ? '✓ ' : '○ ') + T(x.key) + (x.optional ? ' (' + T('hud.optional') + ')' : '') })));
        qsteps.hidden = !expanded; qtoggle.textContent = expanded ? T('hud.less') : T('hud.more'); qtoggle.hidden = o.steps.length < 2;
      }
      if (!cine) { newT = Math.max(0, newT - dt); doneT = Math.max(0, doneT - dt); }   // the notes wait until the dialogue is over bar.classList.toggle('new', newT > 0); qnew.hidden = !(newT > 0); qdone.hidden = !(doneT > 0);
    }
    // ---- help markers
    const tgt = o && o.target; const help = s.assist || 0; const g0 = g.s.flags;
    const firstGoal = g.s.beat === '1.study' && c.prefs.tips !== false && !tutDone().use;                    // the very first time: show where the computer is
    const missing = g.s.beat === '1.study' && g0.needDisk && !g0.disk;                                        // the computer asked for a disk: show the box at once
    const showBeacon = !!tgt && !cine && (help >= 2 || firstGoal || missing || (s.hintLevel >= 2));
    const b = ensureBeacon();
    if (b) {
      b.visible = showBeacon;
      if (showBeacon) { const w = g.rt.world; const gr = w ? groundAt(w, tgt.x, tgt.z, 99) : null; b.position.set(tgt.x, tgt.y || (gr ? gr.y : 0), tgt.z); b.userData.core.position.y = 1.9 + Math.sin(performance.now() / 380) * 0.08; b.userData.core.rotation.y += dt * 1.6; b.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 500) * 0.06); }
    }
    let arrowOn = false;
    if (tgt && !cine && (help >= 1 || showBeacon)) {
      const v = new c.THREE.Vector3(tgt.x, (tgt.y || 0) + 1.2, tgt.z).project(c.camera); const behind = v.z > 1;
      let x = v.x, y = v.y; if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
      if (off) {
        const a = Math.atan2(y, x); const r = 0.86; const px = Math.cos(a) * r, py = Math.sin(a) * r;
        arrow.style.left = ((px * 0.5 + 0.5) * window.innerWidth) + 'px'; arrow.style.top = ((-py * 0.5 + 0.5) * window.innerHeight) + 'px'; arrow.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`; arrowOn = true;
      }
    }
    arrow.hidden = !arrowOn;
    // ---- tips
    const pos = { x: s.x, z: s.z }; if (lastPos) { moved += Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z); } lastPos = pos;
    const yaw = c.camYaw(); if (lastYaw !== null) { looked += Math.abs(yaw - lastYaw); } lastYaw = yaw;
    if (tutDone().goal) { sinceGoal += dt; }
    if (!tut || cine) {
      const n = cine ? null : nextTut(s, o, dt);
      if (n && (!tut || tut.id !== n.id)) { tut = n; tutT = 0; moved = 0; looked = 0; }
    }
    if (tut && !cine) {
      tutT += dt;
      if (tut.id === 'move' && moved > 1.5) { finishTut(); } else if (tut && tut.id === 'look' && looked > 0.8) { finishTut(); }
      else if (tut && tut.id === 'use' && !s.prompt && tutT > 6) { tut = null; }   // walked away: shown again at the next prompt
      else if (tut && tut.secs && tutT > tut.secs) { finishTut(); }
    }
    if (tut && !cine) { const dk = 'tut.' + tut.id + '.' + c.device(); const dv = T(dk); const txt = dv !== dk ? dv : T('tut.' + tut.id); /* a wording of its own for the pad and the touch screen where one reads better */ const tsig = tut.id + c.device() + c.prefs.lang + Object.values(c.keys).join(','); if (tipBox.getAttribute('data-sig') !== tsig) { tipBox.setAttribute('data-sig', tsig); tipBox.textContent = ''; tipBox.append(el('span', { class: 'tt', text: txt })); if (!tutDone().first) { tipBox.append(el('span', { class: 'toff', text: T('tut.off') })); } } tipBox.hidden = false; tipBox.setAttribute('data-id', tut.id); }
    else { tipBox.hidden = true; }
    if (tut && tut.id === 'move' && !tutDone().first) { tutDone().first = 1; }
    // ---- journal note
    const cn = counts(g).found;
    if (knownFound === null) { knownFound = cn; }
    if (cn > knownFound) {
      const f = fragments(g).filter((x) => x.found); const last = newest(g, f); knownFound = cn; toastT = 4.2;
      toast.textContent = ''; toast.append(el('span', { class: 'ml', text: T('jr.new') }), el('span', { class: 'mt', text: last ? T('mem.' + last.id + '.t') : '' }), el('span', { class: 'mk', text: label('journal') }));
      c.play('found');
    }
    if (!cine) { toastT = Math.max(0, toastT - dt); } toast.hidden = !(toastT > 0) || !!cine;   // a memory found during a dialogue is announced after it
  }
  // the fragment most recently found: the one of the latest chapter and position in the list
  let seenIds = null;
  function newest(g, found) { const ids = found.map((x) => x.id); const prev = seenIds || []; seenIds = ids; const fresh = found.filter((x) => prev.indexOf(x.id) < 0); return fresh[fresh.length - 1] || found[found.length - 1]; }
  function resetForGame() { knownFound = null; seenIds = null; lastGoal = null; sig = ''; tut = null; const g = c.game(); if (g) { seenIds = fragments(g).filter((x) => x.found).map((x) => x.id); } }

  // ---- the journal panel ------------------------------------------------------------------------------------------
  function journal(panel) {
    const g = c.game(); panel.textContent = ''; if (!g) { return; }
    const o = objective(g); const fr = fragments(g); const ct = counts(g);
    panel.append(el('h2', { text: T('jr.title') }));
    // this chapter: earlier goals of the chapter (done) and the current one with its steps
    const ch = o ? o.chapter : 7; const beatsBefore = BEATS.filter((b) => (b === 'end' ? 7 : parseInt(b, 10)) === ch && BEATS.indexOf(b) < BEATS.indexOf(g.s.beat));
    const goals = el('div', { class: 'jgoals', 'data-testid': 'journal-goals' }, [el('div', { class: 'lbl', text: T('jr.goals') + ' · ' + T('chap.' + ch) })]);
    beatsBefore.forEach((b) => goals.append(el('div', { class: 'jg done', text: '✓ ' + T('obj.' + b) })));
    if (o) { goals.append(el('div', { class: 'jg now', text: '▸ ' + T(o.goal) })); const ol = el('ol', { class: 'qsteps jsteps' }); o.steps.forEach((x) => ol.append(el('li', { class: (x.done ? 'done' : '') + (x.optional ? ' opt' : ''), text: (x.done ? '✓ ' : '○ ') + T(x.key) + (x.optional ? ' (' + T('hud.optional') + ')' : '') }))); goals.append(ol); if (o.nextKey) { goals.append(el('div', { class: 'jnext', text: T('hud.next') + ': ' + T(o.nextKey) })); } }
    panel.append(goals);
    panel.append(el('div', { class: 'lbl', text: T('jr.memories') + ' · ' + T('jr.found', { n: ct.found, of: ct.of }) }));
    const list = el('div', { class: 'jmem', 'data-testid': 'journal-memories' });
    const upto = o ? o.chapter : 7;
    for (let n = 1; n <= 7; n++) {
      const fs = fr.filter((f) => f.chapter === n); if (!fs.length) { continue; } if (n > upto && !fs.some((f) => f.found)) { continue; }   // chapters not reached yet stay out of sight
      const cc = ct.byChapter[n]; list.append(el('div', { class: 'jch', text: T('jr.chapter', { n }) + ' · ' + T('jr.found', { n: cc.found, of: cc.of }) }));
      fs.forEach((f) => {
        if (!f.found) { list.append(el('div', { class: 'jm locked', 'data-testid': 'mem-' + f.id }, [el('div', { class: 'jt', text: '· · ·  ' + T('jr.notYet') + (f.optional ? ' (' + T('jr.optional') + ')' : '') }), el('div', { class: 'jd', text: T(f.optional ? 'jr.hiddenOpt' : 'jr.hiddenReq') })])); return; }
        const meta = [f.year ? String(f.year) : T('jr.noYear'), T('jr.with') + ': ' + f.who.map((w) => T('sp.' + w)).join(', ')].join(' · ');
        const kids = [el('div', { class: 'jt', text: T('mem.' + f.id + '.t') }), el('div', { class: 'jmeta', text: meta }), el('div', { class: 'jd', text: T('mem.' + f.id + '.d') })];
        if (f.provenance) { const p = f.provenance; kids.push(el('div', { class: 'jsrc', text: T('jr.source') + ': ' + [p.status, p.file, p.crc32 ? 'crc32 ' + p.crc32 : null, p.source, p.record].filter(Boolean).join(' · ') + (p.evidence ? '  [' + p.evidence.join(', ') + ']' : '') })); }
        if (f.id === 'snow') { kids.push(el('div', { class: 'jsrc', text: 'CREATED · ' + T('jr.created') })); }
        list.append(el('div', { class: 'jm', 'data-testid': 'mem-' + f.id }, kids));
      });
    }
    if (!ct.found) { list.append(el('p', { class: 'dim', text: T('jr.empty') })); }
    panel.append(list);
    markTut('journal'); if (tut && tut.id === 'journal') { finishTut(); }
  }
  return { label, glyph, fill, update, events, journal, resetForGame, el: { bar, arrow, tipBox, toast } };
}
