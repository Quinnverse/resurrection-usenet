// The owner's start page for RC1: six doors and nothing else. It only links; it changes nothing in the game and sends nothing.
const S = !!window.__V5_STANDALONE__;   // the single-file build opened from disk
const L = S
  ? { game: 'Resurrection-V5.html', tech: 'Resurrection-V5-Tech.html', audio: 'Resurrection-V5-Audio.html', hub: 'Resurrection-V5-RC.html', playtest: 'Resurrection-V5-Playtest.html', form: 'feedback-form.html' }
  : { game: '/v5/', tech: '/v5/tech', audio: '/v5/audio', hub: '/v5/rc', playtest: '/v5/?playtest=1', form: '/v5/feedback' };
const $ = (id) => document.getElementById(id);
$('start').href = L.game; $('continue').href = L.game; $('tech').href = L.tech; $('audio').href = L.audio; $('scenes').href = L.hub + '#scenes';
$('playtest').href = L.playtest; $('form').href = L.form; $('advanced').href = L.hub;

// is there a save in this browser? (browsers may keep local files apart: then it simply says so and the title screen decides)
const chapterOf = (beat) => { const m = /^(\d)\./.exec(String(beat || '')); return m ? Number(m[1]) : beat === 'end' ? 7 : null; };
try {
  const raw = JSON.parse(localStorage.getItem('v5.save.v1')); const box = $('save');
  if (raw && typeof raw.beat === 'string') { const ch = chapterOf(raw.beat); box.textContent = `Save found: ${ch ? 'chapter ' + ch + ' · ' : ''}${raw.beat} · 找到存档${ch ? '：第 ' + ch + ' 章' : ''}`; box.classList.remove('none'); }
  else { box.textContent = 'No save seen in this browser yet. · 此浏览器里还没有存档。'; }
} catch (e) { $('save').textContent = 'Save status unknown. · 存档状态未知。'; }

// WebGL check, and the build
try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) { $('webgl').hidden = false; } } catch (e) { $('webgl').hidden = false; }
const setBuild = (b) => { $('build').textContent = 'build ' + b; };
if (window.__V5_BUILD__) { setBuild(window.__V5_BUILD__); }
else { fetch('/v5/data/build.json').then((r) => (r.ok ? r.text() : null)).then((t) => setBuild(t ? JSON.parse(t).build : 'unknown')).catch(() => setBuild('unknown')); }
window.V5Home = { ready: true };
