// Resurrection frontend. Renders the server projection only; every fact, choice and ending comes from the engine.
// Dependency-free plain JavaScript: no framework, no CDN, no build step.

const STORAGE_KEY = 'resurrection.sessionId';
const REQUEST_TIMEOUT_MS = 8000;
const TICK_MS = 650;
const COLD_CONNECT_MS = 1400;
const DECISION_TITLES = {
  COMMIT_DEATH_RECORD: 'Decision 1 of 3 · provisional account',
  COMMIT_MEMORY_CAPACITY: 'Decision 2 of 3 · memory capacity',
  COMMIT_PROVENANCE: 'Decision 3 of 3 · provenance'
};
// Fixed layout for the five relay nodes (SVG units).
const NODE_POSITIONS = {
  'NODE-01': { x: 150, y: 128 },
  'NODE-02': { x: 52, y: 58 },
  'NODE-03': { x: 248, y: 40 },
  'NODE-04': { x: 248, y: 214 },
  'NODE-05': { x: 52, y: 206 }
};

const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const state = {
  status: 'loading', // loading | landing | ready | error
  view: null,
  error: null,
  busy: false,
  notice: '',
  lastResult: null,
  preview: null,
  selectedId: null,
  confirmReset: false,
  skipIntro: false,
  coldStage: 0,
  letterClosing: 'PLAIN',
  sealArmed: false,
  openPanels: {}
};

// Playback of the last committed propagation, driven by recorded engine events. Changes only DOM classes.
const playback = { key: null, index: 0, total: 0, paused: false, timer: null, events: [] };

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function flatten(list) {
  return list.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false && child !== true);
}

// Minimal element builder. Function components receive props and return a DOM node.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'line', 'g', 'circle', 'text', 'title']);

function h(tag, props, ...children) {
  if (typeof tag === 'function') return tag(props || {});
  const isSvg = SVG_TAGS.has(tag);
  const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [name, value] of Object.entries(props || {})) {
    if (name === 'key' || value === undefined || value === null || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      el.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === 'className') {
      el.setAttribute('class', value);
    } else if (name === 'disabled') {
      el.disabled = true;
    } else {
      el.setAttribute(name, value === true ? '' : String(value));
    }
  }
  for (const child of flatten(children)) {
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Collapsible panels keep their open state across re-renders.
function panel(id, defaultOpen, summary, ...children) {
  const open = state.openPanels[id] === undefined ? defaultOpen : state.openPanels[id];
  return h('details', {
    className: 'panel', open: open ? true : undefined,
    onToggle: (event) => { state.openPanels[id] = event.currentTarget.open; }
  }, h('summary', null, summary), ...children);
}

// Re-renders the screen and restores keyboard focus to the element that had it (matched by data-focus).
function render() {
  const root = document.getElementById('root');
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.focus : undefined;
  root.replaceChildren(App());
  if (focusKey) {
    const target = Array.from(root.querySelectorAll('[data-focus]')).find(node => node.dataset.focus === focusKey);
    if (target) target.focus();
  }
}

const text = (value, fallback = '') => (value === undefined || value === null ? fallback : String(value));

function newActionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'act-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('/api' + path, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
    const raw = await res.text();
    let body = null;
    try { body = JSON.parse(raw); } catch (parseError) { body = null; }
    if (!res.ok) {
      const error = new Error(text(body && body.error, 'The archive returned an error (' + res.status + ').'));
      error.status = res.status;
      error.code = body && body.code;
      throw error;
    }
    if (body === null) throw new Error('The archive returned an unreadable response.');
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The archive did not respond within 8 seconds.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function describeChange(change) {
  const label = change.recordId.startsWith('fragment:') ? 'Memory ' + change.recordId.slice(9) : change.recordId;
  if (change.field === 'body' && change.before === null) return label + ': record created';
  return label + ' · ' + change.field + ': ' + text(change.before, '—') + ' → ' + text(change.after, '—');
}

function canonical(payload) {
  return JSON.stringify(Object.keys(payload || {}).sort().map(k => [k, payload[k]]));
}

// What kind of record this is. Derived from state only.
function kindOf(record) {
  const body = text(record.body);
  if (record.id === 'rec-anomaly') return { key: 'anomaly', label: 'Temporal anomaly' };
  if (record.status === 'evicted' || /evicted/.test(body)) return { key: 'corrupted', label: 'Corrupted memory' };
  if (record.id === 'rec-summary' && record.status !== 'pending') return { key: 'player', label: 'Player-authored alteration' };
  if (record.status === 'provisional-authoritative' || record.status === 'authoritative') return { key: 'reconstructed', label: 'Reconstructed evidence' };
  if (record.status === 'unverified' || record.status === 'superseded') return { key: 'contested', label: 'Contested replica' };
  if (record.replicaVersion > 1) return { key: 'replica', label: 'Replica v' + record.replicaVersion };
  return { key: 'original', label: 'Original record' };
}

// ---------- session flow ----------

function remember(view) {
  window.localStorage.setItem(STORAGE_KEY, view.sessionId);
  setState({ view, status: 'ready', error: null });
}

async function loadSession(id) {
  try {
    remember(await api('/sessions/' + id));
  } catch (err) {
    if (err.status === 404) {
      window.localStorage.removeItem(STORAGE_KEY);
      setState({ view: null, status: 'landing' });
    } else {
      setState({ status: 'error', error: err.message });
    }
  }
}

function startColdOpen() {
  setState({ coldStage: 0, skipIntro: false });
  if (reducedMotion) {
    setState({ coldStage: 1 });
    return;
  }
  setTimeout(() => { if (state.coldStage === 0) setState({ coldStage: 1 }); }, COLD_CONNECT_MS);
}

async function startGame() {
  setState({ busy: true });
  try {
    const created = await api('/sessions', { method: 'POST' });
    setState({ lastResult: null, preview: null, selectedId: null, notice: '', openPanels: {}, sealArmed: false });
    remember(created.state);
    startColdOpen();
  } catch (err) {
    setState({ status: 'error', error: err.message });
  } finally {
    setState({ busy: false });
  }
}

async function runAction(action, previewOnly = false) {
  const view = state.view;
  if (!view) return;
  setState({ busy: true, notice: '' });
  try {
    const result = await api('/sessions/' + view.sessionId + '/actions', {
      method: 'POST',
      body: JSON.stringify({
        actionId: newActionId(),
        expectedRevision: view.revision,
        type: action.type,
        payload: action.payload || {},
        preview: previewOnly
      })
    });
    if (previewOnly) {
      setState({ preview: { action, changes: result.changes } });
    } else {
      const unlocked = result.newlyUnlocked && result.newlyUnlocked.length ? 'New evidence: ' + result.newlyUnlocked.join(', ') + '.' : 'Recorded.';
      setState({ preview: null, lastResult: result, notice: unlocked, sealArmed: false });
      await loadSession(view.sessionId);
    }
  } catch (err) {
    if (err.code === 'stale_revision') {
      setState({ notice: 'The archive changed in another tab. Reloaded the current state.' });
      await loadSession(view.sessionId);
    } else {
      setState({ notice: err.message });
    }
  } finally {
    setState({ busy: false });
  }
}

async function resetGame() {
  const view = state.view;
  if (!view) return;
  setState({ busy: true });
  try {
    const fresh = await api('/sessions/' + view.sessionId + '/reset', { method: 'POST', body: JSON.stringify({ confirm: 'RESET' }) });
    setState({ lastResult: null, preview: null, selectedId: null, confirmReset: false, notice: '', openPanels: {} });
    remember(fresh.state);
    startColdOpen();
  } catch (err) {
    setState({ notice: err.message });
  } finally {
    setState({ busy: false });
  }
}

// Deletes the server copy of this save and forgets the session ID in this browser.
async function deleteSave() {
  const view = state.view;
  if (!view) return;
  setState({ busy: true });
  try {
    await api('/sessions/' + view.sessionId, { method: 'DELETE' });
    window.localStorage.removeItem(STORAGE_KEY);
    setState({ view: null, status: 'landing', lastResult: null, preview: null, selectedId: null, confirmReset: false, notice: '' });
  } catch (err) {
    setState({ notice: err.message });
  } finally {
    setState({ busy: false });
  }
}

async function retryBoot() {
  setState({ status: 'loading', error: null });
  await boot();
}

async function boot() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    setState({ status: 'landing' });
    return;
  }
  await loadSession(stored);
}

// ---------- screens ----------

function App() {
  if (state.status === 'loading') {
    return h('main', { className: 'screen center', 'aria-busy': 'true' }, h('p', { className: 'kicker' }, 'Connecting to the archive…'));
  }

  if (state.status === 'error') {
    return h('main', { className: 'screen center' },
      h('h1', { className: 'title' }, 'Connection lost'),
      h('p', { className: 'warning', role: 'alert' }, 'The archive could not be reached: ' + text(state.error, 'unknown error')),
      h('button', { className: 'primary', 'data-focus': 'retry', onClick: () => retryBoot() }, 'RETRY CONNECTION')
    );
  }

  if (state.status === 'landing' || !state.view) {
    return h('main', { className: 'screen landing' },
      h('p', { className: 'kicker' }, 'alt.memory.1998 · INCOMING · 28 YEARS LATE'),
      h('h1', { className: 'title' }, 'RESURRECTION'),
      h('p', { className: 'tagline' }, 'She died in 1998. Her last message arrived tonight.'),
      h('button', { className: 'primary', 'data-focus': 'enter', onClick: () => startGame(), disabled: state.busy }, state.busy ? 'OPENING…' : 'ENTER ARCHIVE'),
      h('p', { className: 'note' }, 'No account is needed. Playing takes 12–18 minutes.'),
      PrivacyNotice()
    );
  }

  const view = state.view;
  if (view.endingSelected) return EndingScreen({ view });

  const actions = view.permittedActions || [];
  const openAction = actions.find(a => a.type === 'OPEN_THREAD');
  if (openAction && !state.skipIntro) return ColdOpen({ view, openAction });

  const choiceActions = actions.filter(a => a.previewable);
  const otherActions = actions.filter(a => !a.previewable && a.type !== 'COMMIT_FINAL' && a.type !== 'OPEN_THREAD');
  const endingActions = actions.filter(a => a.type === 'COMMIT_FINAL');
  const visible = view.visibleRecords || [];
  const selected = visible.find(r => r.id === state.selectedId) || visible[visible.length - 1] || null;

  return h('div', { className: 'workspace' },
    h('header', { className: 'bar' },
      h('div', { className: 'bar-title' },
        h('span', { className: 'kicker' }, 'Act ' + view.storyAct + ' · ' + text(view.actTitle)),
        h('span', { className: 'epigraph' }, text(view.epigraph))
      ),
      h('div', { className: 'bar-right' },
        h('span', { className: 'muted' }, 'Revision ' + view.revision),
        h('button', { className: 'quiet', 'data-focus': 'reset-toggle', onClick: () => setState({ confirmReset: !state.confirmReset }) }, 'Reset game')
      )
    ),
    state.confirmReset && h('div', { className: 'confirm', role: 'alertdialog', 'aria-label': 'Confirm reset' },
      h('p', null, 'Start a new game? This session will be deleted and cannot be recovered.'),
      h('button', { className: 'danger', 'data-focus': 'reset-confirm', onClick: () => resetGame(), disabled: state.busy }, 'DELETE AND START OVER'),
      h('button', { className: 'quiet', 'data-focus': 'save-delete', onClick: () => deleteSave(), disabled: state.busy }, 'Delete save only, then return to the start'),
      h('button', { className: 'quiet', 'data-focus': 'reset-cancel', onClick: () => setState({ confirmReset: false }) }, 'Keep playing')
    ),

    h('section', { className: 'next', 'aria-label': 'Next step' },
      openAction && h('button', { className: 'primary', 'data-focus': 'open-transmission-bar', onClick: () => runAction(openAction), disabled: state.busy }, openAction.label),
      otherActions.map((action, i) =>
        h('button', {
          key: 'o' + i,
          className: i === 0 ? 'primary' : 'action',
          'data-focus': action.label,
          onClick: () => runAction(action),
          disabled: state.busy
        }, action.label)
      )
    ),

    state.notice && h('p', { className: 'notice', role: 'status', 'aria-live': 'polite' }, state.notice),

    h('div', { className: 'grid' },
      h('section', { className: 'reader', 'aria-label': 'Investigation' },
        visible.length > 0 && h('nav', { className: 'tabs', 'aria-label': 'Visible records' },
          visible.map(r => {
            const kind = kindOf(r);
            return h('button', {
              key: r.id,
              className: 'tab kind-' + kind.key + (selected && selected.id === r.id ? ' active' : ''),
              'data-focus': 'tab-' + r.id,
              onClick: () => setState({ selectedId: r.id }),
              'aria-pressed': selected && selected.id === r.id ? 'true' : 'false'
            }, r.subject);
          })
        ),
        selected && RecordView({ record: selected, view }),
        view.headerComparison && HeaderComparison({ comparison: view.headerComparison }),
        choiceActions.length > 0 && Decisions({ choices: choiceActions }),
        view.letter && !view.letter.sealed && LetterComposer({ letter: view.letter, actions: endingActions }),
        state.lastResult && ResultPanel({ result: state.lastResult })
      ),
      h('aside', { className: 'side', 'aria-label': 'Context' },
        NetworkPanel({ nodes: view.nodes, record: selected, result: state.lastResult }),
        Voices({ agents: view.agents }),
        Journal({ evidence: view.evidence }),
        view.conflictLog && view.conflictLog.length > 0 && panel('conflicts', false, 'Replica conflict log (' + view.conflictLog.length + ')',
          h('ul', null, view.conflictLog.map(c => h('li', { key: c.id }, text(c.resolution))))),
        endingActions.some(a => a.payload.ending !== 'LAST_LETTER') && Endings({ actions: endingActions.filter(a => a.payload.ending !== 'LAST_LETTER'), view })
      )
    )
  );
}

function ColdOpen({ view, openAction }) {
  const incoming = (view.visibleRecords || []).find(r => r.id === 'rec-incoming');
  const headers = incoming ? incoming.headers || {} : {};
  return h('main', { className: 'cold', 'aria-label': 'Opening transmission' },
    h('p', { className: 'kicker' }, 'alt.memory.1998 · relay connection'),
    state.coldStage === 0 && h('p', { className: 'connecting', 'aria-live': 'polite' }, 'Establishing a connection to the archive…'),
    state.coldStage >= 1 && incoming && h('article', { className: 'cold-card' },
      h('p', { className: 'cold-subject' }, text(incoming.subject)),
      h('dl', { className: 'cold-meta' },
        h('dt', null, 'From'), h('dd', null, text(incoming.from)),
        h('dt', null, 'Sent'), h('dd', null, text(headers.timestamp)),
        h('dt', null, 'Sender account'), h('dd', null, text(headers.account, 'no record'))
      ),
      h('p', { className: 'cold-note' }, 'A closed account should not be able to send mail. Someone, or something, sent this one anyway.'),
      h('div', { className: 'cold-actions' },
        h('button', { className: 'primary', 'data-focus': 'open-transmission', onClick: () => runAction(openAction), disabled: state.busy }, 'OPEN TRANSMISSION'),
        h('button', { className: 'quiet', 'data-focus': 'skip-intro', onClick: () => setState({ skipIntro: true }) }, 'Skip intro')
      )
    ),
    state.coldStage >= 1 && h('p', { className: 'cold-hint' }, 'Opening the transmission starts the investigation. Its headers will be compared with the other reports.'),
    state.coldStage === 0 && h('button', { className: 'quiet', 'data-focus': 'skip-intro', onClick: () => setState({ skipIntro: true }) }, 'Skip intro')
  );
}

function RecordView({ record, view }) {
  const headers = record.headers || {};
  const kind = kindOf(record);
  return h('article', { className: 'record kind-' + kind.key, 'aria-label': text(record.subject) },
    h('div', { className: 'record-head' },
      h('span', { className: 'badge kind-' + kind.key }, kind.label),
      h('span', { className: 'record-time' }, text(headers.timestamp))
    ),
    h('h2', { className: 'record-title' }, text(record.subject, 'Untitled record')),
    h('p', { className: 'body' }, text(record.body, '[no content]')),
    panel('meta-' + record.id, false, 'Provenance and headers',
      h('dl', { className: 'headers' },
        h('dt', null, 'From'), h('dd', null, text(record.from)),
        h('dt', null, 'Origin'), h('dd', null, text(record.sourceNode)),
        h('dt', null, 'Timestamp'), h('dd', null, text(headers.timestamp)),
        h('dt', null, 'Path'), h('dd', null, (headers.path || []).join(' → ')),
        h('dt', null, 'Checksum'), h('dd', null, text(headers.checksum)),
        h('dt', null, 'Replica'), h('dd', null, 'v' + text(record.replicaVersion, '?') + ' · ' + text(record.status)),
        h('dt', null, 'Decay'), h('dd', null, text(record.decayLevel, '0') + '%')
      ))
  );
}

function HeaderComparison({ comparison }) {
  const discrepant = new Set((comparison.discrepancies || []).map(d => d.field));
  return h('section', { className: 'panel compare', 'aria-label': 'Header comparison' },
    h('h3', null, 'Contradictory records: headers compared'),
    h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Field'), h('th', null, 'Lab 3 report'), h('th', null, 'Lab 4 report'))),
      h('tbody', null, (comparison.fields || []).map(f =>
        h('tr', { key: f.field, className: discrepant.has(f.field) ? 'warn' : '' },
          h('th', { scope: 'row' }, f.field + (discrepant.has(f.field) ? ' !' : '')),
          h('td', null, text(f.lab3)), h('td', null, text(f.lab4))))
      )
    ),
    (comparison.discrepancies || []).map((d, i) => h('p', { key: i, className: 'warn-text' }, d.note))
  );
}

function Decisions({ choices }) {
  const preview = state.preview;
  const groups = {};
  choices.forEach(c => { (groups[c.type] = groups[c.type] || []).push(c); });
  return h('section', { className: 'panel decisions', 'aria-label': 'Decisions' },
    Object.keys(groups).map(type =>
      h('div', { key: type, className: 'decision-group' },
        h('p', { className: 'kicker' }, DECISION_TITLES[type] || 'Decision'),
        groups[type].map((c, i) => {
          const isPreviewed = preview && preview.action.type === c.type && canonical(preview.action.payload) === canonical(c.payload);
          return h('div', { key: i, className: 'choice' },
            h('span', null, c.label),
            isPreviewed
              ? h('button', { className: 'primary', 'data-focus': 'commit-' + c.label, onClick: () => runAction(c), disabled: state.busy }, 'COMMIT (cannot be undone)')
              : h('button', { className: 'action', 'data-focus': 'preview-' + c.label, onClick: () => runAction(c, true), disabled: state.busy }, 'PREVIEW')
          );
        })
      )
    ),
    preview && h('div', { className: 'preview', role: 'region', 'aria-label': 'Preview of changes' },
      h('p', null, 'Preview: this change would alter ' + preview.changes.length + ' values.'),
      h('ul', null, preview.changes.map((c, i) => h('li', { key: i }, describeChange(c)))),
      h('button', { className: 'quiet', 'data-focus': 'preview-cancel', onClick: () => setState({ preview: null }) }, 'Cancel preview')
    )
  );
}

// The Last Letter: slots already established in the archive, a closing choice, and an irreversible seal.
function LetterComposer({ letter, actions }) {
  const seal = actions.find(a => a.payload.closing === state.letterClosing);
  return h('section', { className: 'panel letter-composer', 'aria-label': 'The Last Letter' },
    h('p', { className: 'kicker' }, 'The Last Letter · assembled from the archive'),
    h('p', { className: 'lede' }, 'Every line here came from something you found. Choose how the letter ends, then decide whether to seal it.'),
    letter.slots.map(slot => h('div', { key: slot.id, className: 'letter-slot' },
      h('span', { className: 'slot-source' }, 'from ' + slot.source),
      h('p', null, slot.text))),
    h('fieldset', { className: 'closings' },
      h('legend', null, 'Closing line'),
      letter.closings.map(c => h('label', { key: c.id, className: 'closing-option' },
        h('input', {
          type: 'radio', name: 'closing', value: c.id,
          checked: state.letterClosing === c.id ? true : undefined,
          'data-focus': 'closing-' + c.id,
          onChange: () => setState({ letterClosing: c.id, sealArmed: false })
        }),
        h('span', null, c.text)))
    ),
    !state.sealArmed
      ? h('button', { className: 'primary', 'data-focus': 'seal-arm', onClick: () => setState({ sealArmed: true }), disabled: !seal || state.busy }, 'SEAL THE LETTER…')
      : h('div', { className: 'confirm seal-confirm', role: 'alertdialog', 'aria-label': 'Confirm sealing' },
          h('p', null, 'Sealing ends this copy. It will not wake again, and the game then closes. The letter and the evidence stay in the archive. This cannot be undone.'),
          h('button', { className: 'danger', 'data-focus': 'seal-confirm', onClick: () => seal && runAction(seal), disabled: !seal || state.busy }, 'SEAL AND END THE COPY'),
          h('button', { className: 'quiet', 'data-focus': 'seal-cancel', onClick: () => setState({ sealArmed: false }) }, 'Not yet'))
  );
}

function ResultPanel({ result }) {
  const hops = {};
  (result.propagation || []).forEach(p => {
    const key = p.fromNode + ' → ' + p.toNode;
    hops[key] = (hops[key] || 0) + 1;
  });
  const hopList = Object.keys(hops);
  const agents = result.agentReactions || [];
  return h('section', { className: 'panel result', 'aria-label': 'Consequences of the last action' },
    h('h3', null, 'What changed'),
    result.changes && result.changes.length > 0
      ? h('ul', null, result.changes.filter(c => c.field !== 'replicaVersion').map((c, i) => h('li', { key: i }, describeChange(c))))
      : h('p', { className: 'muted' }, 'No record values changed.'),
    agents.map((r, i) => h('blockquote', { key: i, className: 'reaction voice-' + text(r.agentId, 'agent') },
      h('strong', null, text(r.agentId, 'agent').charAt(0).toUpperCase() + text(r.agentId, 'agent').slice(1) + ' '), text(r.text))),
    hopList.length > 0 && h('p', { className: 'muted' }, 'Propagated along ' + hopList.join(', ') + ' (' + (result.propagation || []).length + ' replica updates).')
  );
}

// Five-node network. Draws the recorded propagation of the last action, in engine order. No animation invents hops.
function NetworkPanel({ nodes, record, result }) {
  if (!nodes) return null;
  const events = result && result.propagation ? result.propagation : [];
  const key = result ? result.eventId : null;
  if (playback.key !== key) startPlayback(key, events);
  const rid = record ? record.id : null;

  const edges = [];
  const seen = new Set();
  nodes.forEach(n => n.neighbors.forEach(other => {
    const id = [n.id, other].sort().join('|');
    if (!seen.has(id)) { seen.add(id); edges.push([n.id, other]); }
  }));

  const hopKey = (a, b) => [a, b].sort().join('|').replace(/[^A-Za-z0-9|]/g, '');
  const holds = (nodeId) => {
    const n = nodes.find(x => x.id === nodeId);
    return Boolean(rid && n && n.replicaVersions && n.replicaVersions[rid] !== undefined);
  };
  const origin = events.length > 0 ? events[0].fromNode : (record ? record.sourceNode : null);

  return panel('network', true, 'Network · where this record lives',
    h('svg', { className: 'network', viewBox: '0 0 300 260', role: 'img', 'aria-label': 'Five relay nodes and their links' },
      edges.map(([a, b]) => h('line', {
        key: a + b, id: 'edge-' + hopKey(a, b),
        x1: NODE_POSITIONS[a].x, y1: NODE_POSITIONS[a].y, x2: NODE_POSITIONS[b].x, y2: NODE_POSITIONS[b].y,
        className: 'edge' + (playbackState(a, b, events) || '')
      })),
      nodes.map(n => h('g', { key: n.id, id: 'node-' + n.id, className: 'node' + (holds(n.id) ? ' holds' : '') + (origin === n.id ? ' origin' : '') },
        h('circle', { cx: NODE_POSITIONS[n.id].x, cy: NODE_POSITIONS[n.id].y, r: 17 }),
        h('text', { x: NODE_POSITIONS[n.id].x, y: NODE_POSITIONS[n.id].y + 4, 'text-anchor': 'middle' }, n.id.replace('NODE-', '0')),
        h('title', null, n.id + ' · ' + text(n.label))))
    ),
    h('p', { id: 'hop-caption', className: 'caption', 'aria-live': 'polite' }, captionFor(events, playback.index)),
    events.length > 0 && h('div', { className: 'playback' },
      h('button', { className: 'quiet', 'data-focus': 'net-pause', onClick: togglePause }, playback.paused ? 'Resume' : 'Pause'),
      h('button', { className: 'quiet', 'data-focus': 'net-skip', onClick: skipPlayback }, 'Skip to final state')),
    events.length > 0 && h('ol', { className: 'hop-list' }, events.map((e, i) =>
      h('li', { key: i, id: 'hop-' + i, className: i < playback.index ? 'done' : '' },
        e.fromNode + ' → ' + e.toNode + ' · ' + e.recordId + ' v' + e.version))),
    events.length === 0 && h('p', { className: 'muted' }, 'No propagation has run yet. Commit a choice to watch replicas update.')
  );
}

function playbackState(a, b, events) {
  const idx = events.findIndex(e => (e.fromNode === a && e.toNode === b) || (e.fromNode === b && e.toNode === a));
  if (idx === -1 || idx >= playback.index) return '';
  return idx === playback.index - 1 && playback.index < events.length ? ' current' : ' done';
}

function captionFor(events, index) {
  if (events.length === 0) return '';
  if (index >= events.length) return 'Final state: ' + events.length + ' replica updates across the network.';
  const e = events[index];
  return 'Hop ' + (index + 1) + ' of ' + events.length + ': ' + e.fromNode + ' → ' + e.toNode + ' · ' + e.recordId + ' v' + e.version;
}

// Starts playback for a new propagation. Reduced motion shows the final state immediately.
function startPlayback(key, events) {
  if (playback.timer) clearTimeout(playback.timer);
  playback.key = key;
  playback.events = events;
  playback.total = events.length;
  playback.paused = false;
  playback.timer = null;
  playback.index = reducedMotion || events.length === 0 ? events.length : 0;
  if (playback.index < playback.total) scheduleTick();
}

function scheduleTick() {
  if (playback.timer) clearTimeout(playback.timer);
  playback.timer = setTimeout(() => {
    if (playback.paused) return;
    playback.index += 1;
    updatePlaybackDom();
    if (playback.index < playback.total) scheduleTick(); else playback.timer = null;
  }, TICK_MS);
}

function updatePlaybackDom() {
  const events = playback.events;
  document.querySelectorAll('line.edge').forEach(line => {
    const id = line.id.replace('edge-', '');
    const idx = events.findIndex(e => [e.fromNode, e.toNode].sort().join('|').replace(/[^A-Za-z0-9|]/g, '') === id);
    const current = idx === playback.index - 1 && playback.index < events.length;
    line.setAttribute('class', 'edge' + (idx === -1 || idx >= playback.index ? '' : (current ? ' current' : ' done')));
  });
  const caption = document.getElementById('hop-caption');
  if (caption) caption.textContent = captionFor(events, playback.index);
  events.forEach((_, i) => {
    const item = document.getElementById('hop-' + i);
    if (item) item.setAttribute('class', i < playback.index ? 'done' : '');
  });
  const pause = document.querySelector('[data-focus="net-pause"]');
  if (pause) pause.textContent = playback.paused ? 'Resume' : 'Pause';
}

function togglePause() {
  playback.paused = !playback.paused;
  if (!playback.paused && playback.index < playback.total) scheduleTick();
  updatePlaybackDom();
}

function skipPlayback() {
  if (playback.timer) clearTimeout(playback.timer);
  playback.timer = null;
  playback.index = playback.total;
  updatePlaybackDom();
}

function Voices({ agents }) {
  if (!agents || agents.length === 0) {
    return h('section', { className: 'panel quiet-panel' }, h('h3', null, 'Voices'), h('p', { className: 'muted' }, 'No other voice has answered yet.'));
  }
  return h('section', { className: 'panel', 'aria-label': 'Voices' },
    h('h3', null, 'Voices'),
    h('ul', { className: 'voices' }, agents.map(a => h('li', { key: a.id, className: 'voice-' + a.id }, h('strong', null, text(a.name)), ' · trust ' + text(a.trust, 0))))
  );
}

function Journal({ evidence }) {
  const items = (evidence && evidence.discovered) || [];
  return panel('journal', true, 'Journal · ' + items.length + ' of ' + text(evidence && evidence.total, 12) + ' found',
    h('ul', { className: 'journal' }, items.map(e => h('li', { key: e.id }, h('strong', null, e.id + ' '), text(e.title), h('br'), h('span', { className: 'muted' }, text(e.summary))))));
}

function Endings({ actions, view }) {
  return h('section', { className: 'panel endings', 'aria-label': 'Endings' },
    h('h3', null, 'Ending'),
    (view.endings || []).filter(e => e.id !== 'LAST_LETTER').map(e => h('p', { key: e.id, className: 'muted' }, e.title)),
    actions.map((a, i) => h('button', { key: i, className: 'primary', 'data-focus': a.label, onClick: () => runAction(a), disabled: state.busy }, a.label))
  );
}

function EndingScreen({ view }) {
  const ending = view.ending || {};
  const id = text(ending.id, 'archive').toLowerCase().replace(/_/g, '-');
  const divergence = ending.divergence || [];
  return h('main', { className: 'screen ending ending-' + id, 'aria-label': text(ending.title) },
    h('p', { className: 'kicker' }, 'Ending · ' + text(ending.title)),
    h('h1', { className: 'title' }, text(ending.title)),
    h('p', { className: 'lede' }, text(ending.closing)),
    h('p', { className: 'summary' }, text(ending.summary)),
    ending.letter && h('blockquote', { className: 'letter' }, ending.letter.map((line, i) => h('p', { key: i }, line))),
    divergence.length > 0 && panel('divergence', true, 'Memory divergence · ' + divergence.length + ' records no longer match the original',
      h('ul', null, divergence.map((d, i) => h('li', { key: i }, h('strong', null, d.subject + ': '), text(d.now)))))
    ,
    panel('verified', false, 'What the archive can and cannot verify',
      h('ul', null, (ending.verifiedFacts || []).map((f, i) => h('li', { key: i }, f))),
      h('p', { className: 'muted' }, text(ending.unresolvedCount, 0) + ' evidence item(s) were never found.')),
    state.confirmReset
      ? h('div', { className: 'confirm' },
          h('p', null, 'Start a new game? This ending and its saved session will be deleted.'),
          h('button', { className: 'danger', 'data-focus': 'reset-confirm', onClick: () => resetGame(), disabled: state.busy }, 'DELETE AND START OVER'),
          h('button', { className: 'quiet', 'data-focus': 'save-delete', onClick: () => deleteSave(), disabled: state.busy }, 'Delete save only, then return to the start'),
          h('button', { className: 'quiet', 'data-focus': 'reset-cancel', onClick: () => setState({ confirmReset: false }) }, 'Keep this ending'))
      : h('button', { className: 'primary', 'data-focus': 'new-game', onClick: () => setState({ confirmReset: true }) }, 'START A NEW GAME')
  );
}

function PrivacyNotice() {
  return h('details', { className: 'privacy' },
    h('summary', null, 'Privacy and saved progress'),
    h('p', null, 'Your progress is saved on this game server under a random session ID that this browser keeps. No account, name, email address or IP address is requested, and none is written to the game log.'),
    h('p', null, 'Saves expire after seven days without activity. Saves are not backed up long-term.'),
    h('p', null, 'To delete your save, choose Reset game during play, then Delete save only. Clearing this site\'s browser data forgets the session ID; the server copy then expires on its own.'),
    h('p', null, 'Hosting providers may process network metadata, such as IP addresses, at the infrastructure level. Full notice: docs/PRIVACY.md.')
  );
}

render();
boot();
