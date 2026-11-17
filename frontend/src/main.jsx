// Resurrection v1.0 frontend. A projection of the server session: it renders what the API returns and
// never invents narrative facts. Dependency-free plain JavaScript: no framework, no CDN, no build step.

const STORAGE_KEY = 'resurrection.sessionId';
const REQUEST_TIMEOUT_MS = 8000;
const DECISION_TITLES = {
  COMMIT_DEATH_RECORD: 'Decision 1 of 3 · provisional account',
  COMMIT_MEMORY_CAPACITY: 'Decision 2 of 3 · memory capacity',
  COMMIT_PROVENANCE: 'Decision 3 of 3 · provenance'
};

// ---------- state and rendering ----------

const state = {
  status: 'loading', // loading | landing | ready | error
  view: null,
  error: null,
  busy: false,
  notice: '',
  lastResult: null,
  preview: null,
  selectedId: null,
  confirmReset: false
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function flatten(list) {
  return list.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false && child !== true);
}

// Minimal element builder. Function components receive props and return a DOM node.
function h(tag, props, ...children) {
  if (typeof tag === 'function') return tag(props || {});
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props || {})) {
    if (name === 'key' || value === undefined || value === null || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      el.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === 'className') {
      el.className = value;
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

// Re-renders the whole screen and restores keyboard focus to the element that had it (matched by data-focus).
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

async function startGame() {
  setState({ busy: true });
  try {
    const created = await api('/sessions', { method: 'POST' });
    setState({ lastResult: null, preview: null, selectedId: null, notice: '' });
    remember(created.state);
  } catch (err) {
    setState({ status: 'error', error: err.message });
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

function PrivacyNotice() {
  return h('details', { className: 'privacy' },
    h('summary', null, 'Privacy and saved progress'),
    h('p', null, 'Your progress is saved on this game server under a random session ID that this browser keeps. No account, name, email address or IP address is requested, and none is written to the game log.'),
    h('p', null, 'Saves expire after seven days without activity. Saves are not backed up long-term.'),
    h('p', null, 'To delete your save, choose Reset game during play, then Delete save only. Clearing this site\'s browser data forgets the session ID; the server copy then expires on its own.'),
    h('p', null, 'Hosting providers may process network metadata, such as IP addresses, at the infrastructure level. Full notice: docs/PRIVACY.md.')
  );
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
      setState({ preview: null, lastResult: result, notice: unlocked });
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
    setState({ lastResult: null, preview: null, selectedId: null, confirmReset: false, notice: '' });
    remember(fresh.state);
  } catch (err) {
    setState({ notice: err.message });
  } finally {
    setState({ busy: false });
  }
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
      h('p', { className: 'lede' }, 'You are a restoration operator on a decommissioned network. Copies of a dead researcher survive on five relay nodes, and they disagree. Every copy you make authoritative changes what the others remember.'),
      h('button', { className: 'primary', 'data-focus': 'enter', onClick: () => startGame(), disabled: state.busy }, state.busy ? 'OPENING…' : 'ENTER ARCHIVE'),
      h('p', { className: 'note' }, 'No account is needed. Playing takes 12–18 minutes.'),
      PrivacyNotice()
    );
  }

  const view = state.view;
  if (view.endingSelected) return EndingScreen({ view });

  const actions = view.permittedActions || [];
  const choiceActions = actions.filter(a => a.previewable);
  const otherActions = actions.filter(a => !a.previewable && a.type !== 'COMMIT_FINAL' && a.type !== 'OPEN_THREAD');
  const finalActions = actions.filter(a => a.type === 'COMMIT_FINAL');
  const openAction = actions.find(a => a.type === 'OPEN_THREAD');
  const visible = view.visibleRecords || [];
  const selected = visible.find(r => r.id === state.selectedId) || visible[visible.length - 1] || null;

  return h('div', { className: 'workspace' },
    h('header', { className: 'bar' },
      h('div', null,
        h('span', { className: 'kicker' }, 'ACT ' + view.storyAct + ' · ' + text(view.actTitle)),
        h('span', { className: 'stage' }, 'Stage: ' + text(view.sceneId).replace(/_/g, ' ').toLowerCase())
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
      openAction
        ? h('button', { className: 'primary', 'data-focus': openAction.label, onClick: () => runAction(openAction), disabled: state.busy }, openAction.label)
        : h('p', { className: 'kicker' }, 'Next step'),
      otherActions.map((action, i) =>
        h('button', {
          key: 'o' + i,
          className: i === 0 && !openAction ? 'primary' : 'action',
          'data-focus': action.label,
          onClick: () => runAction(action),
          disabled: state.busy
        }, action.label)
      )
    ),

    state.notice && h('p', { className: 'notice', role: 'status', 'aria-live': 'polite' }, state.notice),

    h('div', { className: 'grid' },
      h('section', { className: 'reader', 'aria-label': 'Transmissions' },
        openAction && h('p', { className: 'lede' }, 'An incoming transmission is waiting in the relay queue. Open it to begin.'),
        visible.length > 0 && h('nav', { className: 'tabs', 'aria-label': 'Visible records' },
          visible.map(r => h('button', {
            key: r.id,
            className: 'tab' + (selected && selected.id === r.id ? ' active' : ''),
            'data-focus': 'tab-' + r.id,
            onClick: () => setState({ selectedId: r.id }),
            'aria-pressed': selected && selected.id === r.id ? 'true' : 'false'
          }, r.subject))
        ),
        selected && RecordView({ record: selected }),
        view.headerComparison && HeaderComparison({ comparison: view.headerComparison }),
        choiceActions.length > 0 && Decisions({ choices: choiceActions }),
        state.lastResult && ResultPanel({ result: state.lastResult })
      ),
      h('aside', { className: 'side', 'aria-label': 'Context' },
        NodeMap({ nodes: view.nodes, record: selected }),
        Agents({ agents: view.agents }),
        Journal({ evidence: view.evidence }),
        view.conflictLog && view.conflictLog.length > 0 && h('details', { className: 'panel' },
          h('summary', null, 'Replica conflict log (' + view.conflictLog.length + ')'),
          h('ul', null, view.conflictLog.map(c => h('li', { key: c.id }, text(c.resolution))))
        ),
        finalActions.length > 0 && Endings({ endings: view.endings, actions: finalActions })
      )
    )
  );
}

function RecordView({ record }) {
  const headers = record.headers || {};
  return h('article', { className: 'record', 'aria-label': text(record.subject) },
    h('h2', { className: 'record-title' }, text(record.subject, 'Untitled record')),
    h('dl', { className: 'headers' },
      h('dt', null, 'From'), h('dd', null, text(record.from)),
      h('dt', null, 'Origin'), h('dd', null, text(record.sourceNode)),
      h('dt', null, 'Timestamp'), h('dd', null, text(headers.timestamp)),
      h('dt', null, 'Path'), h('dd', null, (headers.path || []).join(' → ')),
      h('dt', null, 'Checksum'), h('dd', null, text(headers.checksum)),
      h('dt', null, 'Replica'), h('dd', null, 'v' + text(record.replicaVersion, '?') + ' · ' + text(record.status)),
      h('dt', null, 'Decay'), h('dd', null, text(record.decayLevel, '0') + '%')
    ),
    h('p', { className: 'body' }, text(record.body, '[no content]'))
  );
}

function HeaderComparison({ comparison }) {
  const discrepant = new Set((comparison.discrepancies || []).map(d => d.field));
  return h('section', { className: 'panel compare', 'aria-label': 'Header comparison' },
    h('h3', null, 'Header comparison: Lab 3 against Lab 4'),
    h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Field'), h('th', null, 'Lab 3 report'), h('th', null, 'Lab 4 report'))),
      h('tbody', null, (comparison.fields || []).map(f =>
        h('tr', { key: f.field, className: discrepant.has(f.field) ? 'warn' : '' },
          h('th', { scope: 'row' }, f.field + (discrepant.has(f.field) ? ' ⚠' : '')),
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

function ResultPanel({ result }) {
  const hops = {};
  (result.propagation || []).forEach(p => {
    const key = p.fromNode + ' → ' + p.toNode;
    hops[key] = (hops[key] || 0) + 1;
  });
  const hopList = Object.keys(hops);
  return h('section', { className: 'panel result', 'aria-label': 'Consequences of the last action' },
    h('h3', null, 'What changed'),
    result.changes && result.changes.length > 0
      ? h('ul', null, result.changes.filter(c => c.field !== 'replicaVersion').map((c, i) => h('li', { key: i }, describeChange(c))))
      : h('p', { className: 'muted' }, 'No record values changed.'),
    (result.agentReactions || []).map((r, i) => h('blockquote', { key: i, className: 'reaction' },
      h('strong', null, text(r.agentId, 'agent').charAt(0).toUpperCase() + text(r.agentId, 'agent').slice(1) + ': '), text(r.text)
    )),
    hopList.length > 0 && h('p', { className: 'muted' }, 'Propagated along: ' + hopList.join(', ') + ' (' + (result.propagation || []).length + ' replica updates).')
  );
}

function NodeMap({ nodes, record }) {
  if (!nodes) return null;
  const rid = record ? record.id : null;
  return h('section', { className: 'panel', 'aria-label': 'Replica map' },
    h('h3', null, 'Replica map'),
    h('ul', { className: 'nodes' }, nodes.map(n =>
      h('li', { key: n.id },
        h('strong', null, n.id), ' ' + text(n.label), ' ',
        rid && n.replicaVersions && n.replicaVersions[rid] !== undefined
          ? h('span', { className: 'muted' }, '· holds v' + n.replicaVersions[rid])
          : null,
        h('span', { className: 'muted' }, ' ↔ ' + (n.neighbors || []).join(', '))
      )
    ))
  );
}

function Agents({ agents }) {
  if (!agents || agents.length === 0) {
    return h('section', { className: 'panel' }, h('h3', null, 'Voices'), h('p', { className: 'muted' }, 'No other voices have answered yet.'));
  }
  return h('section', { className: 'panel', 'aria-label': 'Voices' },
    h('h3', null, 'Voices'),
    h('ul', null, agents.map(a => h('li', { key: a.id }, h('strong', null, text(a.name)), ' · trust ' + text(a.trust, 0))))
  );
}

function Journal({ evidence }) {
  const items = (evidence && evidence.discovered) || [];
  return h('details', { className: 'panel', open: true },
    h('summary', null, 'Journal · ' + items.length + ' of ' + text(evidence && evidence.total, 12) + ' discovered'),
    h('ul', { className: 'journal' }, items.map(e => h('li', { key: e.id }, h('strong', null, e.id + ' '), text(e.title), h('br'), h('span', { className: 'muted' }, text(e.summary)))))
  );
}

function Endings({ endings, actions }) {
  return h('section', { className: 'panel endings', 'aria-label': 'Endings' },
    h('h3', null, 'Final choice'),
    (endings || []).map(e => h('p', { key: e.id, className: e.unlocked ? '' : 'muted' },
      e.title + (e.unlocked ? '' : ' · locked: ' + e.missingEvidenceCount + ' evidence item(s) missing'))),
    actions.map((a, i) => h('button', { key: i, className: 'primary', 'data-focus': a.label, onClick: () => runAction(a), disabled: state.busy }, a.label))
  );
}

function EndingScreen({ view }) {
  const ending = view.ending || {};
  return h('main', { className: 'screen ending' },
    h('p', { className: 'kicker' }, 'ENDING · ' + text(ending.title)),
    h('h1', { className: 'title' }, text(ending.title)),
    h('p', { className: 'lede' }, text(ending.closing)),
    h('p', null, text(ending.summary)),
    ending.letter && h('blockquote', { className: 'letter' }, ending.letter.map((line, i) => h('p', { key: i }, line))),
    h('section', { className: 'panel' },
      h('h3', null, 'Verified facts'),
      h('ul', null, (ending.verifiedFacts || []).map((f, i) => h('li', { key: i }, f))),
      h('p', { className: 'muted' }, text(ending.unresolvedCount, 0) + ' evidence item(s) remained undiscovered.')
    ),
    state.confirmReset
      ? h('div', { className: 'confirm' },
          h('p', null, 'Start a new game? This ending and its saved session will be deleted.'),
          h('button', { className: 'danger', 'data-focus': 'reset-confirm', onClick: () => resetGame(), disabled: state.busy }, 'DELETE AND START OVER'),
          h('button', { className: 'quiet', 'data-focus': 'save-delete', onClick: () => deleteSave(), disabled: state.busy }, 'Delete save only, then return to the start'),
          h('button', { className: 'quiet', 'data-focus': 'reset-cancel', onClick: () => setState({ confirmReset: false }) }, 'Keep this ending'))
      : h('button', { className: 'primary', 'data-focus': 'new-game', onClick: () => setState({ confirmReset: true }) }, 'START A NEW GAME')
  );
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

render();
boot();
