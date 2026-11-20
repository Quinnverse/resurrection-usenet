// V5 listening page: every music arrangement and every sound effect from render/audio.js, with where it plays in the
// game and what it is meant to do. A person listens and ticks the boxes; the page can also measure the output level
// (that shows sound is produced and not clipping, not that it sounds good).
import * as A from './render/audio.js';
import * as Ar from './core/archive.js';

import { THEMES, EFFECTS } from './core/audio-cues.js';
export { THEMES, EFFECTS };

async function measure(secs) {
  let rms = 0, n = 0, peak = 0; const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) { const l = A.level(); rms += l.rms; n += 1; peak = Math.max(peak, l.peak || 0); await new Promise((r) => setTimeout(r, 50)); }
  return { rms: n ? rms / n : 0, peak, state: A.level().state };
}
window.V5Audio = {
  themes: () => A.themes(), effects: () => A.effects(),
  async theme(name, secs) { A.unlock(); A.setTheme(name); const m = await measure(secs || 3); A.stopMusic(); await new Promise((r) => setTimeout(r, 700)); return m; },
  async effect(name) { A.unlock(); A.play(name); return measure(1.2); }
};

// ---- the page --------------------------------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
function el(tag, attrs, kids) { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') { n.textContent = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); (kids || []).forEach((c) => c && n.append(c)); return n; }
async function loadTune() {
  try { const files = Object.assign({}, Object.fromEntries(Ar.SOURCES.map((s) => [s.id, s.file])), Ar.EXTRA_FILES); const texts = {}; await Promise.all(Object.entries(files).map(async ([id, f]) => { texts[id] = await (await fetch('/v5/data/' + f)).text(); }));
    const t = Ar.sceneGraph(Ar.createArchive(texts), 1998).objects.find((o) => o.id === 'tune'); if (t && t.data) { A.setTune(t.data); return 'tune.ll from the archive'; } } catch (e) { /* default */ }
  return 'built-in default tune';
}
// where each arrangement can be heard in the game (opens that moment, nothing is saved)
const SCENE_FOR = { study: '1.study', summer: '4.cottage', train: '2.train', coast: '3.ride', night: '4.porch', parting: '5.depart', y2004: '5.alone', cottage04: '6.beach', winter: 'snow', ending: 'end' };
const GAME = window.__V5_STANDALONE__ ? 'Resurrection-V5.html' : '/v5/';
function row(kind, id, where, want) {
  const level = el('span', { class: 'lvl' });
  const play = el('button', { type: 'button', text: kind === 'theme' ? '▶ 8 s' : '▶', 'data-testid': `play-${kind}-${id}`, onclick: async () => { level.textContent = '…'; const m = kind === 'theme' ? await window.V5Audio.theme(id, 8) : await window.V5Audio.effect(id); level.textContent = `rms ${m.rms.toFixed(3)} · peak ${m.peak.toFixed(2)}`; } });
  const ok = el('select', {}, ['—', 'good', 'too loud', 'too quiet', 'unpleasant', 'wrong mood'].map((o) => el('option', { text: o })));
  const loop = kind === 'theme' ? el('button', { type: 'button', text: '▶ loop', title: 'keeps playing until you press stop', 'data-testid': `loop-${id}`, onclick: () => { A.unlock(); A.setTheme(id); level.textContent = 'playing…'; } }) : null;
  const scene = kind === 'theme' && SCENE_FOR[id] ? el('a', { href: GAME + '?preview=' + SCENE_FOR[id], target: '_blank', rel: 'noopener', text: 'in the game ↗', style: 'color:#7fc4ff', 'data-testid': `scene-${id}` }) : null;
  return el('tr', {}, [el('td', {}, loop ? [play, loop] : [play]), el('td', { class: 'id', text: id }), el('td', { text: where || '' }), el('td', { text: want || '' }), el('td', {}, [ok]), el('td', {}, [el('input', { type: 'text', placeholder: 'notes' })]), el('td', {}, [level]), el('td', {}, scene ? [scene] : [])]);
}
loadTune().then((src) => {
  $('#tune').textContent = src;
  const tb = $('#themes'); A.themes().forEach((id) => tb.append(row('theme', id, (THEMES[id] || {}).where, (THEMES[id] || {}).want)));
  const fb = $('#effects'); A.effects().forEach((id) => fb.append(row('fx', id, EFFECTS[id] || '', '')));
  $('#stop').addEventListener('click', () => A.stopMusic());
  $('#export').addEventListener('click', () => {
    const rows = [...document.querySelectorAll('tbody tr')].map((tr) => ({ id: tr.querySelector('.id').textContent, verdict: tr.querySelector('select').value, notes: tr.querySelector('input').value, level: tr.querySelector('.lvl').textContent }));
    const meta = { listener: $('#who').value, device: $('#dev').value, when: new Date().toISOString(), userAgent: navigator.userAgent };
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ meta, rows }, null, 2)], { type: 'application/json' })), download: 'v5-audio-check.json' }); document.body.append(a); a.click(); a.remove();
  });
  window.V5AudioReady = true;
});
