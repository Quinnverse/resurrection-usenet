// Input drivers for V5 device playthroughs (browser only). The scripted bot (test/v5-bot.mjs) says what it wants to do
// in a frame ({ mx, mz, jump, use, useHeld, aim, aimDX, choose, advance, ... }); a driver turns that into the state of
// ONE input device, and the game reads it through its own input code (main.js collectInput / menus), exactly as it
// reads a player. The test hook does not inject game input in this mode.
//   pad:   a standard-mapping gamepad object returned by navigator.getGamepads (installed by the test before load)
//   kbm:   synthetic KeyboardEvent / MouseEvent on window and the canvas
//   touch: synthetic TouchEvent on the canvas and the on-screen buttons; choices are tapped (delivered as click)
// A driver throws "input dead end" if the control it needs is not on screen. That is the point of the test.

const visible = (e) => !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
const snap = () => window.V5Debug.snapshot();
const deadEnd = (what) => { const s = snap(); throw new Error(`input dead end: ${what} (beat ${s.beat}, mode ${s.mode})`); };
const choiceButtons = () => [...document.querySelectorAll('[data-testid="choices"] .copt')];

// ---- gamepad -------------------------------------------------------------------------------------------------------
// The dead zone in main.js is radial (0.18). This gives the stick position that produces exactly output (x, y).
function stickFor(x, y) { const m = Math.hypot(x, y); if (m < 1e-6) { return [0, 0]; } const o = Math.min(1, m), raw = 0.18 + 0.82 * o; return [(x / m) * raw, (y / m) * raw]; }
export function padDriver(h) {
  const pad = window.__pad; if (!pad) { throw new Error('no simulated pad installed'); }
  let last = [];
  const frame = async (on, axes) => {
    for (let i = 0; i < pad.buttons.length; i++) { const v = !!on.has(i); pad.buttons[i].pressed = v; pad.buttons[i].value = v ? 1 : 0; }
    for (let i = 0; i < 4; i++) { pad.axes[i] = axes[i]; } pad.timestamp += 1; last = [...on];
    return h.frame();
  };
  const emit = async (held, edges, axes) => {
    const ev = []; const blocked = edges.filter((b) => last.includes(b));
    if (blocked.length) { ev.push(...await frame(new Set(held.filter((b) => !blocked.includes(b))), axes)); }   // release first, so the press is a new press
    ev.push(...await frame(new Set(held.concat(edges)), axes)); return ev;
  };
  return async (inp) => {
    const L = stickFor(inp.mx || 0, -(inp.mz || 0)), R = stickFor(Math.max(-1, Math.min(1, (inp.aimDX || 0) / 30)), Math.max(-1, Math.min(1, (inp.aimDY || 0) / 20)));
    const axes = [L[0], L[1], R[0], R[1]];
    if (inp.choose !== undefined && inp.choose !== null) {
      const ev = []; const bs = choiceButtons(); if (!bs.length || !visible(bs[0])) { deadEnd('choice requested but no choices on screen'); }
      for (let k = 0; k < 4; k++) { const cur = Math.max(0, choiceButtons().findIndex((b) => b.classList.contains('focus'))); if (cur === inp.choose) { break; } ev.push(...await emit([], [13], axes)); ev.push(...await frame(new Set(), axes)); }
      ev.push(...await emit([], [0], axes)); return ev;
    }
    const held = []; const edges = [];
    if (inp.sprint) { held.push(5); } if (inp.jumpHeld) { held.push(0); } if (inp.useHeld) { held.push(2); } if (inp.aim) { held.push(6); }
    if (inp.jump || inp.advance) { edges.push(0); } if (inp.use) { edges.push(2); } if (inp.tab) { edges.push(3); } if (inp.shoot) { edges.push(7); } if (inp.skip) { edges.push(1); } if (inp.hint) { edges.push(8); }
    return emit([...new Set(held)].filter((b) => !edges.includes(b)), [...new Set(edges)], axes);
  };
}

// ---- keyboard and mouse --------------------------------------------------------------------------------------------
export function kbmDriver(h) {
  const cv = document.querySelector('[data-testid="canvas"]'); const keysDown = new Set(); let right = false; const acc = {};
  const kd = (code) => { keysDown.add(code); window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true })); };
  const ku = (code) => { keysDown.delete(code); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); };
  const md = (button) => cv.dispatchEvent(new MouseEvent('mousedown', { button, bubbles: true, cancelable: true, clientX: 400, clientY: 300 }));
  const mu = (button) => window.dispatchEvent(new MouseEvent('mouseup', { button, bubbles: true }));
  return async (inp) => {
    const want = new Set(); const tap = [];
    // keys are on or off; an in-between direction is made by tapping, as a player does (pulse width per axis)
    const axis = (v, k) => { acc[k] = (acc[k] || 0) + (v || 0); if (Math.abs(v || 0) < 0.05) { acc[k] = 0; return 0; } if (acc[k] > 0.5) { acc[k] -= 1; return 1; } if (acc[k] < -0.5) { acc[k] += 1; return -1; } return 0; };
    const ax = axis(inp.mx, 'x'), az = axis(inp.mz, 'z');
    if (az > 0) { want.add('KeyW'); } if (az < 0) { want.add('KeyS'); } if (ax > 0) { want.add('KeyD'); } if (ax < 0) { want.add('KeyA'); }
    if (inp.sprint) { want.add('ShiftLeft'); } if (inp.jumpHeld) { want.add('Space'); } if (inp.useHeld) { want.add('KeyE'); }
    if (inp.jump) { tap.push('Space'); } if (inp.use || inp.advance) { tap.push('KeyE'); } if (inp.tab) { tap.push('Tab'); } if (inp.skip) { tap.push('Escape'); } if (inp.hint) { tap.push('KeyH'); }
    if (inp.choose !== undefined && inp.choose !== null) { if (!visible(choiceButtons()[0])) { deadEnd('choice requested but no choices on screen'); } tap.push('Digit' + (inp.choose + 1)); }
    for (const k of [...keysDown]) { if (!want.has(k) || tap.includes(k)) { ku(k); } }
    for (const k of want) { if (!keysDown.has(k) && !tap.includes(k)) { kd(k); } }
    for (const k of tap) { kd(k); }
    // the right button raises the camera; it is also how the view is dragged when the pointer is not locked
    const needRight = !!inp.aim || !!(inp.aimDX || inp.aimDY);
    if (needRight && !right) { md(2); right = true; } if (!needRight && right) { mu(2); right = false; }
    if (inp.aimDX || inp.aimDY) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: inp.aimDX || 0, movementY: inp.aimDY || 0, bubbles: true })); }
    if (inp.shoot) { md(0); }
    const ev = await h.frame();
    if (inp.shoot) { mu(0); }
    for (const k of tap) { if (!want.has(k)) { ku(k); } }
    return ev;
  };
}

// ---- touch ---------------------------------------------------------------------------------------------------------
export function touchDriver(h) {
  const cv = document.querySelector('[data-testid="canvas"]'); const W = () => window.innerWidth, H = () => window.innerHeight;
  const send = (type, target, id, x, y) => { const t = new Touch({ identifier: id, target, clientX: x, clientY: y }); target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
  const btn = (id) => { const b = document.querySelector(`[data-testid="touch-${id}"]`); if (!visible(b)) { deadEnd(`touch button "${id}" not on screen`); } return b; };
  const at = (b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const holding = {}; let move = null, look = null, aimOn = false, nextId = 10;
  const press = (id) => { const b = btn(id); const [x, y] = at(b); holding[id] = nextId++; send('touchstart', b, holding[id], x, y); };
  const release = (id) => { const b = document.querySelector(`[data-testid="touch-${id}"]`); const [x, y] = at(b); send('touchend', b, holding[id], x, y); delete holding[id]; };
  const tap = (id) => { if (holding[id] !== undefined) { release(id); } press(id); release(id); };
  // the first touch on the screen shows the buttons, as it does for a player
  send('touchstart', cv, 99, W() * 0.2, H() * 0.6); send('touchend', cv, 99, W() * 0.2, H() * 0.6);   // left half: no tap action
  return async (inp) => {
    const s = snap(); if (s.scene !== 'train') { aimOn = false; }
    // left half: the stick. Push further than the ring to sprint.
    const m = Math.hypot(inp.mx || 0, inp.mz || 0);
    if (m > 0.05) {
      const k = (inp.sprint ? 1.75 : 1) * 60 / Math.max(1, m); const x0 = W() * 0.18, y0 = H() * 0.62;
      if (!move) { move = { x0, y0 }; send('touchstart', cv, 1, x0, y0); }
      send('touchmove', cv, 1, move.x0 + (inp.mx || 0) * k, move.y0 - (inp.mz || 0) * k);
    } else if (move) { send('touchend', cv, 1, move.x0, move.y0); move = null; }
    // right half: drag to turn the camera (and aim on the train); a drag held under 220 ms would count as a tap
    if (inp.aimDX || inp.aimDY) {
      if (!look) { look = { x: W() * 0.6, y: H() * 0.35, t: performance.now() }; send('touchstart', cv, 2, look.x, look.y); }
      look.x += (inp.aimDX || 0) / 1.4; look.y += (inp.aimDY || 0) / 1.4; send('touchmove', cv, 2, look.x, look.y);
    } else if (look) { while (performance.now() - look.t < 260) { await new Promise((r) => h.realTimeout(r, 20)); } send('touchend', cv, 2, look.x, look.y); look = null; }
    if (inp.choose !== undefined && inp.choose !== null) { const b = choiceButtons()[inp.choose]; if (!visible(b)) { deadEnd('choice button not on screen'); } b.click(); return h.frame(); }
    if (!!inp.aim !== aimOn && s.scene === 'train') { tap('aim'); aimOn = !aimOn; }
    for (const [id, want] of [['jump', !!inp.jumpHeld], ['use', !!inp.useHeld]]) { if (want && holding[id] === undefined) { press(id); } if (!want && holding[id] !== undefined) { release(id); } }
    if (inp.jump) { if (holding.jump !== undefined) { release('jump'); press('jump'); } else { tap('jump'); } }
    if (inp.use || inp.advance) { if (holding.use !== undefined) { release('use'); press('use'); } else { tap('use'); } }
    if (inp.tab) { tap('tab'); } if (inp.hint) { tap('hint'); } if (inp.shoot) { tap('shoot'); } if (inp.skip) { tap('pause'); }
    return h.frame();
  };
}
export const DRIVERS = { pad: padDriver, kbm: kbmDriver, touch: touchDriver };
