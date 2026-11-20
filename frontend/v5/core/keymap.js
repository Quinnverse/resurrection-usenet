// Key bindings: defaults, loading from storage, and rebinding with conflict handling. Pure functions, no DOM.
// Rules:
//  - every action has exactly one key and no key serves two actions (binding a key that another action uses swaps them);
//  - keys the game itself needs cannot be bound: Esc (pause, cancel), F-keys (frame-time overlay, browser), 1 2 3
//    (dialogue choices), the Windows/Command and context-menu keys;
//  - stored bindings that are unknown, malformed, reserved or duplicated fall back to the defaults.
export const ACTIONS = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'use', 'tab', 'aim', 'hint'];
export const DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', use: 'KeyE', tab: 'Tab', hint: 'KeyH', aim: 'KeyQ' };

export function isReserved(code) {
  return code === 'Escape' || /^F\d{1,2}$/.test(code) || /^Digit[123]$/.test(code) || /^(Meta|OS)(Left|Right)$/.test(code) || code === 'ContextMenu';
}
const valid = (c) => typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && !isReserved(c);

// Bindings read from storage (anything at all) -> a complete, conflict-free map.
export function sanitizeKeys(raw) {
  const out = Object.assign({}, DEFAULT_KEYS);
  let repaired = false;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    ACTIONS.forEach((a) => { if (!Object.prototype.hasOwnProperty.call(raw, a) || raw[a] === undefined) { return; } if (valid(raw[a])) { out[a] = raw[a]; } else { repaired = true; } });
  }
  const seen = new Set(Object.values(out));
  if (seen.size !== ACTIONS.length) { return { keys: Object.assign({}, DEFAULT_KEYS), repaired: true }; }
  return { keys: out, repaired };
}

// Bind `code` to `action`. Returns { ok, keys, swappedWith, reason }. The input map is not changed.
export function rebind(keys, action, code) {
  if (ACTIONS.indexOf(action) < 0) { return { ok: false, keys, reason: 'unknown-action' }; }
  if (!valid(code)) { return { ok: false, keys, reason: isReserved(code) ? 'reserved' : 'invalid' }; }
  if (keys[action] === code) { return { ok: true, keys, swappedWith: null }; }
  const next = Object.assign({}, keys); const other = ACTIONS.find((a) => a !== action && next[a] === code) || null;
  if (other) { next[other] = keys[action]; }
  next[action] = code;
  return { ok: true, keys: next, swappedWith: other };
}
