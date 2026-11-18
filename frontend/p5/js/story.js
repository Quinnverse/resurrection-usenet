// P5 story rules: one main objective at a time, derived from what the player has actually done.
// Pure functions: no DOM, no Three.js. main.js runs the events these functions return.
//
// The objective (step) is never stored as truth. It is computed from flags plus live archive facts, so it cannot
// drift out of sync: removing Mom's disk before the bridge is built puts the objective back to "find a copy".
//
//   A1 computer -> A2 who was skylark (2 of 3 clues) -> A3 open the game
//   B1 answer Theo -> B2 inspect the gap -> B3 find a surviving copy -> B4 rebuild (hold) -> B5 talk to Theo
//   C1 find a way onto the old pier (switch builds) -> C2 walk to its end -> END (the lighthouse anomaly)

export const STEPS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'END'];
export const CLUES = ['photo', 'keepbox', 'postcard'];
const FLAGS = ['computer', 'deduced', 'opened', 'arrived', 'theoMet', 'gapSeen', 'readerSeen', 'theoCrossed', 'theoTalked', 'switchUnlocked', 'switched', 'pierReached', 'anomaly', 'ended', 'lamp'];

export function newState() {
  const flags = {}; FLAGS.forEach((f) => { flags[f] = false; }); flags.lamp = true;
  return { v: 1, scene: 'study', build: '2004', disk: false, bridge: 0, bridgeFrom: null, clues: [], seen: [], flags, pos: {}, hint: { step: 'A1', level: 0 }, guide: false, theoLine: 0 };
}
const clone = (s) => JSON.parse(JSON.stringify(s));

// facts: { bridgeOk, has1998, has2004 } from archive.facts().
export function step(s, facts) {
  const f = s.flags;
  if (s.scene === 'study') {
    if (!f.computer) { return 'A1'; }
    if (!f.deduced) { return 'A2'; }
    return 'A3';
  }
  if (!f.theoMet) { return 'B1'; }
  if (!f.gapSeen) { return 'B2'; }
  if (s.bridge < 1) { return facts && facts.bridgeOk ? 'B4' : 'B3'; }
  if (!f.theoTalked) { return 'B5'; }
  if (!f.pierReached) { return 'C1'; }
  if (!f.anomaly) { return 'C2'; }
  return 'END';
}
export const objective = (s, facts) => 'obj.' + step(s, facts);
export const chapter = (s) => (s.scene === 'study' ? 'chap.study' : 'chap.town');

// Where the light trail may lead: a place to investigate, never the answer itself.
export function navTarget(s, facts) {
  switch (step(s, facts)) {
    case 'A1': case 'A3': return { scene: 'study', ids: ['computer'] };
    case 'A2': return { scene: 'study', ids: CLUES.filter((c) => s.clues.indexOf(c) < 0) };
    case 'B1': return { scene: 'town', ids: ['gap'] };          // the near end of the missing bridge, facing Theo
    case 'B2': case 'B3': case 'B4': return { scene: 'town', ids: ['gap'] };
    case 'B5': return { scene: 'town', ids: ['theo'] };
    case 'C1': return { scene: 'town', ids: ['pierGate'] };
    case 'C2': return { scene: 'town', ids: ['pierEnd'] };
    default: return null;
  }
}

export function available(s, id, facts) {
  if (s.scene === 'study') { return true; }
  if (id === 'gap') { return s.flags.theoMet && s.bridge < 1; }
  if (id === 'theo') { return true; }
  if (id === 'pierEnd') { return s.build === '1998'; }
  return true;
}
// The interaction at the gap is a hold once there is a good copy to build from.
export const isHold = (s, id, facts) => id === 'gap' && s.flags.gapSeen && s.bridge < 1 && !!(facts && facts.bridgeOk);
export function verbFor(s, id, facts) {
  if (isHold(s, id, facts)) { return 'verb.rebuild'; }
  if (id === 'computer' && s.flags.deduced) { return 'verb.open'; }
  return null;
}

// ---- events helpers --------------------------------------------------------------------------------------
const say = (ev, key, who) => ev.push({ type: 'say', who: who || 'mara', key });
const dialog = (ev, lines, id) => ev.push({ type: 'dialog', id, lines });
function seenThing(s, id) { if (s.seen.indexOf(id) < 0) { s.seen.push(id); } }

// Called after any change: emits an 'objective' event when the main objective moved on (or back).
function settle(before, s, facts, ev) {
  const a = step(before, facts), b = step(s, facts);
  if (a !== b) { ev.push({ type: 'objective', from: a, to: b }); s.hint = { step: b, level: 0 }; }
}

export function interact(s0, id, facts) {
  const s = clone(s0); const ev = [];
  const f = s.flags;
  if (s.scene === 'study') {
    seenThing(s, id);
    if (id === 'computer') {
      if (!f.computer) {
        f.computer = true;
        dialog(ev, [['screen', 'scr.boot'], ['screen', 'scr.user'], ['mara', 'mara.who'], ['screen', 'scr.thread']], 'computer');
        ev.push({ type: 'crt', lines: 'skylark' });
        if (s.clues.length >= 2 && !f.deduced) { deduce(s, ev); }
      } else if (!f.deduced) {
        say(ev, 'say.computerAgain');
      } else {
        f.opened = true;
        dialog(ev, [['screen', 'scr.open'], ['mara', 'mara.open']], 'open');
        ev.push({ type: 'enterTown' });
      }
    } else if (CLUES.indexOf(id) >= 0) {
      const first = s.clues.indexOf(id) < 0;
      say(ev, 'say.' + id); ev.push({ type: 'sfx', name: 'inspect' });
      if (first) { s.clues.push(id); }
      if (f.computer && !f.deduced && s.clues.length >= 2) { deduce(s, ev); }
    } else if (id === 'lamp') {
      f.lamp = !f.lamp; ev.push({ type: 'lamp', on: f.lamp });
    } else {
      say(ev, 'say.' + id); ev.push({ type: 'sfx', name: 'inspect' });
    }
    settle(s0, s, facts, ev);
    return { state: s, events: ev };
  }
  // ---- town ----
  seenThing(s, id);
  const b98 = s.build === '1998';
  if (id === 'theo') {
    if (!f.theoMet) {
      f.theoMet = true;
      dialog(ev, [['theo', 'theo.hello'], ['theo', 'theo.almost'], ['mara', 'mara.howLong'], ['theo', 'theo.dontAsk'], ['theo', 'theo.bridge']], 'theoMeet');
    } else if (s.bridge < 1) {
      say(ev, s.theoLine % 2 ? 'theo.wait2' : 'theo.wait1', 'theo'); s.theoLine += 1;
    } else if (!f.theoTalked) {
      f.theoTalked = true; f.switchUnlocked = true;
      dialog(ev, [['theo', 'theo.solid'], ['theo', 'theo.light'], ['theo', 'theo.pier'], ['mara', 'mara.summer'], ['theo', 'theo.onlyLive']], 'theoPier');
      ev.push({ type: 'unlockSwitch' });
      ev.push({ type: 'theoGo', to: 'post' });
    } else if (f.anomaly) {
      say(ev, 'theo.after', 'theo');
    } else {
      say(ev, ['theo.idle1', 'theo.idle2', 'theo.idle3'][s.theoLine % 3], 'theo'); s.theoLine += 1;
    }
  } else if (id === 'gap') {
    if (!f.gapSeen) {
      f.gapSeen = true;
      say(ev, 'say.gap');
      ev.push({ type: 'reader', topic: 'bridge' });
    } else if (!(facts && facts.bridgeOk)) {
      say(ev, 'say.gapDamaged');
      ev.push({ type: 'reader', topic: 'bridge' });
    }
  } else if (id === 'pierGate') {
    if (b98) { say(ev, 'say.pier98'); } else {
      say(ev, f.switchUnlocked ? 'say.pierClosedKnown' : 'say.pierClosed');
      if (f.switchUnlocked && !f.switched) { ev.push({ type: 'tip', key: 'tip.switch' }); }
    }
    ev.push({ type: 'sfx', name: 'inspect' });
  } else if (id === 'pierEnd') {
    // reaching the end triggers the anomaly by itself; pressing E there only looks
    say(ev, 'say.pierEnd'); ev.push({ type: 'sfx', name: 'inspect' });
  } else {
    const key = ['notice', 'bakery', 'mural'].indexOf(id) >= 0 ? `say.${id}.${b98 ? '98' : '04'}` : 'say.' + id;
    say(ev, key); ev.push({ type: 'sfx', name: 'inspect' });
    if (id === 'notice' && !b98 && f.switched) { say(ev, 'say.noticeCompare'); }
  }
  settle(s0, s, facts, ev);
  return { state: s, events: ev };
}
function deduce(s, ev) {
  s.flags.deduced = true;
  dialog(ev, [['mara', 'mara.deduce1'], ['mara', 'mara.deduce2']], 'deduce');
}

export function arrive(s0, facts) {
  const s = clone(s0); const ev = [];
  if (s.scene === 'town' && !s.flags.arrived) { s.flags.arrived = true; say(ev, 'say.arrive'); ev.push({ type: 'theoCall' }); }
  settle(s0, s, facts, ev);
  return { state: s, events: ev };
}
export function enterScene(s0, scene) { const s = clone(s0); s.scene = scene; return s; }

// The reader was opened (any topic).
export function readerOpened(s0) { const s = clone(s0); s.flags.readerSeen = true; return s; }

// Add or remove Mom's backup disk as a source. factsAfter: facts with the new inclusion.
export function setDisk(s0, on, factsBefore, factsAfter) {
  const s = clone(s0); const ev = [];
  s.disk = !!on;
  ev.push({ type: 'sfx', name: on ? 'diskIn' : 'diskOut' });
  const a = step(s0, factsBefore), b = step(s, factsAfter);
  if (a !== b) { ev.push({ type: 'objective', from: a, to: b }); s.hint = { step: b, level: 0 }; }
  return { state: s, events: ev };
}

// Holding E at the gap. amount: 0..1 of the bridge to add this tick. Refuses without a good copy.
export function buildTick(s0, amount, facts, provenance) {
  if (s0.bridge >= 1 || !s0.flags.gapSeen) { return { state: s0, events: [], refused: false }; }
  if (!(facts && facts.bridgeOk)) { return { state: s0, events: [], refused: true }; }
  const s = clone(s0); const ev = [];
  s.bridge = Math.min(1, s.bridge + Math.max(0, amount));
  if (!s.bridgeFrom && provenance) { s.bridgeFrom = provenance; }
  if (s.bridge >= 1) {
    ev.push({ type: 'bridgeDone' });
    ev.push({ type: 'theoGo', to: 'meet' });
    say(ev, 'theo.planks', 'theo'); say(ev, 'mara.juneMade');
    s.flags.theoCrossed = true;
  }
  settle(s0, s, facts, ev);
  return { state: s, events: ev, refused: false };
}

// Switch between the builds. Free and repeatable. Needs the target build in the searched sources.
export function switchBuild(s0, facts) {
  const s = clone(s0); const ev = [];
  if (s.scene !== 'town' || !s.flags.switchUnlocked) { return { state: s0, events: [], ok: false }; }
  const to = s.build === '2004' ? '1998' : '2004';
  if ((to === '1998' && !facts.has1998) || (to === '2004' && !facts.has2004)) {
    say(ev, to === '1998' ? 'say.no1998' : 'say.no2004'); ev.push({ type: 'sfx', name: 'denied' });
    return { state: s0, events: ev, ok: false };
  }
  s.build = to; s.flags.switched = true;
  ev.push({ type: 'build', to });
  if (to === '1998' && !s0.flags.switched) { say(ev, 'say.first98'); }
  settle(s0, s, facts, ev);
  return { state: s, events: ev, ok: true };
}

// Standing on the old pier (only possible in 1998), then at its end.
export function onPier(s0, facts) {
  if (s0.flags.pierReached || s0.build !== '1998' || !s0.flags.theoTalked) { return { state: s0, events: [] }; }
  const s = clone(s0); const ev = []; s.flags.pierReached = true;
  say(ev, 'say.onPier'); settle(s0, s, facts, ev);
  return { state: s, events: ev };
}
export function atPierEnd(s0, facts) {
  if (s0.flags.anomaly || !s0.flags.pierReached || s0.build !== '1998') { return { state: s0, events: [] }; }
  const s = clone(s0); const ev = []; s.flags.anomaly = true;
  ev.push({ type: 'anomaly' });
  say(ev, 'theo.notScheduled', 'theo');
  dialog(ev, [['mara', 'mara.noLamp'], ['mara', 'mara.june2005'], ['mara', 'mara.envelope']], 'anomaly');
  ev.push({ type: 'ending' });
  s.flags.ended = true;
  settle(s0, s, facts, ev);
  return { state: s, events: ev };
}

// ---- hints: a light line by default, then three levels (H, or by themselves when the player seems stuck) ----
export const HINT_LEVELS = 3;
export function hintKey(s, facts) { const st = step(s, facts); const lvl = s.hint && s.hint.step === st ? s.hint.level : 0; return `hint.${st}.${lvl}`; }
export function nextHint(s0, facts) {
  const s = clone(s0); const st = step(s, facts);
  const lvl = s.hint && s.hint.step === st ? s.hint.level : 0;
  s.hint = { step: st, level: Math.min(HINT_LEVELS, lvl + 1) };
  return s;
}

// ---- saving ------------------------------------------------------------------------------------------------
export function serialize(s) { return clone(s); }
// Reads a save and repairs anything impossible, so a damaged or edited save can never skip the bridge.
// verifyBridge(bridgeFrom) -> true when that provenance points at a real, intact copy in the archive data.
export function parse(raw, verifyBridge) {
  const s = newState();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) { return null; }
  const fl = raw.flags || {};
  FLAGS.forEach((k) => { s.flags[k] = fl[k] === true; });
  if (fl.lamp === false) { s.flags.lamp = false; }
  s.scene = raw.scene === 'town' ? 'town' : 'study';
  s.build = raw.build === '1998' ? '1998' : '2004';
  s.disk = raw.disk === true;
  s.clues = Array.isArray(raw.clues) ? raw.clues.filter((c, i, a) => CLUES.indexOf(c) >= 0 && a.indexOf(c) === i) : [];
  s.seen = Array.isArray(raw.seen) ? raw.seen.filter((x) => typeof x === 'string').slice(0, 64) : [];
  s.bridge = typeof raw.bridge === 'number' && isFinite(raw.bridge) ? Math.max(0, Math.min(1, raw.bridge)) : 0;
  s.bridgeFrom = raw.bridgeFrom && typeof raw.bridgeFrom === 'object' ? { messageId: String(raw.bridgeFrom.messageId || ''), source: String(raw.bridgeFrom.source || ''), crc: String(raw.bridgeFrom.crc || '') } : null;
  s.guide = raw.guide === true;
  s.theoLine = Number.isInteger(raw.theoLine) ? raw.theoLine : 0;
  if (raw.pos && typeof raw.pos === 'object') {
    ['study', 'town'].forEach((k) => { const p = raw.pos[k]; if (p && isFinite(p.x) && isFinite(p.z)) { s.pos[k] = { x: +p.x, z: +p.z, yaw: isFinite(p.yaw) ? +p.yaw : 0 }; } });
  }
  if (raw.hint && STEPS.indexOf(raw.hint.step) >= 0 && Number.isInteger(raw.hint.level)) { s.hint = { step: raw.hint.step, level: Math.max(0, Math.min(HINT_LEVELS, raw.hint.level)) }; }
  // repair, in story order
  const f = s.flags;
  if (f.deduced && (!f.computer || s.clues.length < 2)) { f.deduced = false; }
  if (!f.deduced) { f.opened = false; }
  if (s.scene === 'town' && !f.opened) { s.scene = 'study'; }
  if (!f.opened) { ['arrived', 'theoMet', 'gapSeen', 'readerSeen', 'theoCrossed', 'theoTalked', 'switchUnlocked', 'switched', 'pierReached', 'anomaly', 'ended'].forEach((k) => { f[k] = false; }); s.bridge = 0; s.bridgeFrom = null; }
  if (s.bridge > 0 && !(s.bridgeFrom && verifyBridge && verifyBridge(s.bridgeFrom))) { s.bridge = 0; s.bridgeFrom = null; }
  if (s.bridge > 0) { f.theoMet = true; f.gapSeen = true; }
  if (s.bridge < 1) { f.theoCrossed = false; f.theoTalked = false; }
  if (!f.theoTalked) { f.switchUnlocked = false; }
  if (!f.switchUnlocked) { f.switched = false; s.build = '2004'; }
  if (!f.switchUnlocked) { f.pierReached = false; }
  if (!f.pierReached) { f.anomaly = false; }
  if (!f.anomaly) { f.ended = false; }
  return s;
}
