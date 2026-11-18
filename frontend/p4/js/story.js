// P4 story: objectives, what can be used when, and what happens when the player uses it.
// Pure and deterministic: interact() takes a state and returns a new state plus a list of events for the
// presentation layer (dialogue, objective changes, scene changes, world changes). No DOM, no Three.js, no clock.

export const VERSION = 1;
export const SCENE_IDS = ['study', 'archive', 'town'];
export const STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4', 'C5', 'END'];
const STUDY_THINGS = ['keepbox', 'photo', 'postcard', 'shelf', 'window'];
const FLAG_KEYS = ['lamp', 'crtOn', 'archiveIntro', 'plaza', 'account', 'townIntro', 'theoMet', 'copy98', 'copy04', 'restored', 'lit', 'ended', 'introSeen'];

export function newState(spawns) {
  const pos = {};
  SCENE_IDS.forEach((s) => { pos[s] = { x: spawns[s].x, z: spawns[s].z, yaw: spawns[s].yaw }; });
  const flags = {};
  FLAG_KEYS.forEach((k) => { flags[k] = false; });
  flags.lamp = true;
  return { v: VERSION, scene: 'study', step: 'A1', pos, seen: [], flags, view: null };
}

const stepIndex = (s) => STEPS.indexOf(s);
export const atLeast = (state, step) => stepIndex(state.step) >= stepIndex(step);

function clone(s) { return JSON.parse(JSON.stringify(s)); }
function setStep(s, ev, step) { if (s.step !== step) { s.step = step; ev.push({ type: 'objective', step }); } }
function say(ev, key, who) { ev.push({ type: 'say', key, who: who || 'mara' }); }
function dialog(ev, lines) { ev.push({ type: 'dialog', lines }); }
function seen(s, id) { if (s.seen.indexOf(id) < 0) { s.seen.push(id); } }

export function copiesSeen(state) { return (state.flags.copy98 ? 1 : 0) + (state.flags.copy04 ? 1 : 0); }

// Objective text key and placeholders for the HUD.
export function objective(state) {
  return { key: 'obj.' + state.step, vars: state.step === 'C2' ? { n: copiesSeen(state) } : null };
}

// Which interaction point the current objective points at (used for the soft guide light), or null.
export function target(state) {
  switch (state.step) {
    case 'A1': return state.seen.length ? null : 'keepbox';
    case 'A2': return 'computer';
    case 'B1': return 'sky';
    case 'B2': return 'gate';
    case 'C1': return 'theo';
    case 'C2': return !state.flags.copy98 ? 'booth98' : 'booth04';
    case 'C3': return state.view === '98' ? 'lighthouse' : 'booth98';
    case 'C4': case 'C5': return 'theo';
    default: return null;
  }
}

// Whether an interaction point is usable right now. Hidden points do not show a prompt.
export function available(state, scene, id) {
  if (scene !== state.scene) { return false; }
  if (scene === 'archive' && id === 'gate') { return state.flags.account; }
  return true;
}

// The verb shown in the prompt. Booths toggle, the lighthouse offers a restore only when it can be done.
export function verbFor(state, scene, point) {
  if (scene === 'town' && (point.id === 'booth98' || point.id === 'booth04')) {
    return state.view === point.id.slice(-2) ? 'verb.leaveView' : 'verb.view';
  }
  if (scene === 'town' && point.id === 'lighthouse' && state.view === '98' && state.flags.copy04 && !state.flags.restored) { return 'verb.restore'; }
  return point.verb;
}

// Main entry point. Returns { state, events }.
export function interact(state0, id) {
  const s = clone(state0);
  const ev = [];
  const sc = s.scene;
  if (sc === 'study') {
    if (STUDY_THINGS.indexOf(id) >= 0) {
      say(ev, 'say.' + id); seen(s, id); ev.push({ type: 'sfx', name: 'inspect' });
      if (!s.flags.crtOn && s.step === 'A1') {
        s.flags.crtOn = true;
        ev.push({ type: 'crtWake' });
        setStep(s, ev, 'A2');
      }
    } else if (id === 'lamp') {
      s.flags.lamp = !s.flags.lamp; say(ev, 'say.lamp'); ev.push({ type: 'lamp', on: s.flags.lamp });
    } else if (id === 'computer') {
      if (!s.flags.crtOn) { say(ev, 'say.computerOff'); }
      else {
        dialog(ev, [['screen', 'scr.1'], ['screen', 'scr.2'], ['screen', 'scr.3'], ['mara', 'say.screen']]);
        ev.push({ type: 'scene', to: 'archive' });
        setStep(s, ev, atLeast(s, 'B1') ? s.step : 'B1');
      }
    }
  } else if (sc === 'archive') {
    if (id === 'sky') {
      dialog(ev, [['post', 'say.sky'], ['mara', 'say.skyMara']]); seen(s, id);
      if (!s.flags.account) { s.flags.account = true; ev.push({ type: 'gateOpen' }); setStep(s, ev, 'B2'); }
    } else if (id === 'gate') {
      if (!s.flags.account) { say(ev, 'say.gateLocked'); }
      else { say(ev, 'say.gate', 'screen'); ev.push({ type: 'scene', to: 'town' }); setStep(s, ev, atLeast(s, 'C1') ? s.step : 'C1'); }
    } else if (['pete', 'owl', 'june', 'mirrorbot', 'notice'].indexOf(id) >= 0) {
      say(ev, 'say.' + id, id === 'notice' ? 'screen' : 'post'); seen(s, id); ev.push({ type: 'sfx', name: 'inspect' });
    }
  } else if (sc === 'town') {
    townInteract(s, ev, id);
  }
  return { state: s, events: ev };
}

function townInteract(s, ev, id) {
  if (id === 'theo') {
    if (!s.flags.theoMet) {
      s.flags.theoMet = true;
      dialog(ev, [['theo', 'theo.1'], ['theo', 'theo.2'], ['theo', 'theo.3'], ['theo', 'theo.4'], ['theo', 'theo.5'], ['mara', 'mara.copies']]);
      setStep(s, ev, copiesSeen(s) === 2 ? 'C3' : 'C2');
    } else if (s.step === 'C4') {
      dialog(ev, [['theo', 'theo.6'], ['theo', 'theo.7']]);
      ev.push({ type: 'theoLight' });
    } else if (s.step === 'C5') {
      dialog(ev, [['theo', 'theo.8'], ['theo', 'theo.9'], ['theo', 'theo.10'], ['mara', 'mara.why'], ['theo', 'theo.11']]);
      s.flags.ended = true; ev.push({ type: 'ending' }); setStep(s, ev, 'END');
    } else if (s.step === 'END') { say(ev, 'say.theoLater', 'theo'); }
    else { say(ev, 'theo.wait', 'theo'); }
    return;
  }
  if (id === 'booth98' || id === 'booth04') {
    const copy = id.slice(-2);
    if (s.view === copy) { s.view = null; ev.push({ type: 'view', copy: null }); return; }
    s.view = copy; ev.push({ type: 'view', copy });
    s.flags['copy' + copy] = true;
    say(ev, copy === '98' ? 'say.view98' : 'say.view04');
    if (s.flags.theoMet && !s.flags.restored) { setStep(s, ev, copiesSeen(s) === 2 ? 'C3' : 'C2'); }
    if (s.step === 'C2') { ev.push({ type: 'objective', step: 'C2' }); }
    return;
  }
  if (id === 'lighthouse') {
    if (s.flags.restored) { say(ev, s.flags.lit ? 'say.theoLater' : 'say.restored', s.flags.lit ? 'theo' : 'mara'); return; }
    if (s.view === '04') { say(ev, 'say.lh04'); ev.push({ type: 'sfx', name: 'denied' }); return; }
    if (s.view === '98') {
      if (!s.flags.copy04) { say(ev, 'say.lhNeedCopies'); return; }
      s.flags.restored = true; s.view = null;
      ev.push({ type: 'view', copy: null }); ev.push({ type: 'restore' });
      say(ev, 'say.restored');
      setStep(s, ev, 'C4');
      return;
    }
    say(ev, 'say.lhPresent'); return;
  }
  if (id === 'bakery' || id === 'mural') { say(ev, 'say.' + id + (s.view === '98' ? '98' : '')); seen(s, id); return; }
  if (id === 'pier') { say(ev, 'say.pier'); seen(s, id); }
}

// Called when Theo's lighting sequence has finished playing.
export function lightDone(state0) {
  const s = clone(state0);
  const ev = [];
  if (s.flags.restored && !s.flags.lit) { s.flags.lit = true; setStep(s, ev, 'C5'); }
  return { state: s, events: ev };
}

// Called once when the player walks into the newsgroup plaza in the archive.
export function enterPlaza(state0) {
  const s = clone(state0);
  const ev = [];
  if (!s.flags.plaza) { s.flags.plaza = true; say(ev, 'say.plaza'); }
  return { state: s, events: ev };
}

// Called when a scene finishes loading. Shows the first-visit line once.
export function arrive(state0) {
  const s = clone(state0);
  const ev = [];
  if (s.scene === 'archive' && !s.flags.archiveIntro) { s.flags.archiveIntro = true; say(ev, 'say.archive'); }
  if (s.scene === 'town' && !s.flags.townIntro) { s.flags.townIntro = true; say(ev, 'say.town'); }
  return { state: s, events: ev };
}

// Leaves a copy view from anywhere (the HUD button), without needing to walk back to the kiosk.
export function leaveView(state0) {
  const s = clone(state0);
  const ev = [];
  if (s.view) { s.view = null; ev.push({ type: 'view', copy: null }); }
  return { state: s, events: ev };
}

export function enterScene(state0, scene) {
  const s = clone(state0);
  s.scene = scene; s.view = null;
  return s;
}

// ---- save format ---------------------------------------------------------------------------------------

const num = (n, lo, hi) => typeof n === 'number' && isFinite(n) && n >= lo && n <= hi;

// Returns a valid state or null. A save can never claim progress its flags do not support.
export function parse(obj, spawns) {
  if (!obj || typeof obj !== 'object' || obj.v !== VERSION) { return null; }
  if (SCENE_IDS.indexOf(obj.scene) < 0 || STEPS.indexOf(obj.step) < 0) { return null; }
  const s = newState(spawns);
  FLAG_KEYS.forEach((k) => { if (obj.flags && typeof obj.flags[k] === 'boolean') { s.flags[k] = obj.flags[k]; } });
  SCENE_IDS.forEach((n) => {
    const p = obj.pos && obj.pos[n];
    if (p && num(p.x, -60, 60) && num(p.z, -60, 60) && num(p.yaw, -100, 100)) { s.pos[n] = { x: p.x, z: p.z, yaw: p.yaw }; }
  });
  const known = ['keepbox', 'photo', 'postcard', 'shelf', 'window', 'pete', 'owl', 'sky', 'june', 'mirrorbot', 'notice', 'bakery', 'mural', 'pier'];
  s.seen = Array.isArray(obj.seen) ? obj.seen.filter((id, i, a) => known.indexOf(id) >= 0 && a.indexOf(id) === i) : [];
  s.step = obj.step; s.scene = obj.scene;
  // Consistency: later steps need the flags that unlock them, so a tampered save falls back safely.
  if (atLeast(s, 'A2')) { s.flags.crtOn = true; }
  if (!s.flags.restored) { s.flags.lit = false; }
  if (!s.flags.lit) { s.flags.ended = false; }
  if (atLeast(s, 'B2') && !s.flags.account) { s.step = 'B1'; }
  if (atLeast(s, 'C2') && !s.flags.theoMet) { s.step = 'C1'; }
  if (atLeast(s, 'C4') && !s.flags.restored) { s.step = 'C3'; }
  if (atLeast(s, 'C5') && !s.flags.lit) { s.step = 'C4'; }
  if (s.step === 'END' && !s.flags.ended) { s.step = 'C5'; }
  if (s.scene === 'town' && !s.flags.account) { s.scene = 'archive'; }
  if (s.scene !== 'study' && !s.flags.crtOn) { s.scene = 'study'; s.step = 'A1'; }
  if (s.scene === 'archive' && !atLeast(s, 'B1')) { s.step = 'B1'; }
  if (s.scene === 'archive' && atLeast(s, 'C1')) { s.step = s.flags.account ? 'B2' : 'B1'; }
  if (s.scene === 'town' && !atLeast(s, 'C1')) { s.step = 'C1'; }
  s.view = null;
  return s;
}

export function serialize(state) { const s = clone(state); s.view = null; return s; }
