// RC1 review hub: links to the game, the key scenes, the audio check and the frame-time tour, plus what this browser
// reports about itself and a live gamepad monitor. It changes nothing in the game and sends nothing anywhere.
import { SCENES } from './rc-scenes.js';

const S = !!window.__V5_STANDALONE__;   // true in the single-file build opened from disk
const GAME = S ? 'Resurrection-V5.html' : '/v5/';
const PLAYTEST = S ? 'Resurrection-V5-Playtest.html' : '/v5/?playtest=1';
const AUDIO = S ? 'Resurrection-V5-Audio.html' : '/v5/audio';
const SHOTS = S ? 'shots/' : '/v5/rc/shots/';
const withQuery = (base, q) => base + (base.indexOf('?') >= 0 ? '&' : '?') + q;

const $ = (s) => document.querySelector(s);
function el(tag, attrs, kids) { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (v === null || v === undefined) { return; } if (k === 'text') { n.textContent = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); (kids || []).forEach((c) => c && n.append(c)); return n; }

$('#homelink').href = S ? 'Resurrection-V5-Start.html' : '/v5/home';
$('#mode').textContent = S ? 'Standalone files opened from disk: no server and no network needed.' : 'Served from a local web server.';
const link = (text, href, cls, id) => el('a', { class: 'btn' + (cls ? ' ' + cls : ''), href, text, 'data-testid': id });
$('#links').append(
  link('▶ Play the game · 开始游戏', GAME, 'primary', 'play'),
  link('Play with the playtest recorder · 试玩记录模式', PLAYTEST, '', 'playtest'),
  link('♪ Music and sound listening · 音乐试听', AUDIO, '', 'audio'),
  link('⏱ Frame-time test, all three quality levels (~5 min) · 帧率测试（三档画质）', withQuery(GAME, 'bench=low,medium,high'), '', 'bench-all'),
  link('⏱ Quick frame-time test (1 min) · 快速帧率测试', withQuery(GAME, 'bench=high&beats=1.town,3.ride,end&secs=6&warm=2'), '', 'bench-quick'));
if (!S) { $('#links').append(link('Technical demo · 技术演示', '/v5/tech', '', 'tech')); }

SCENES.forEach((sc) => {
  const imgs = []; for (let i = 1; i <= sc.imgs; i++) { imgs.push(el('img', { src: SHOTS + (sc.shot || sc.beat) + '-' + i + '.jpg', alt: sc.en + ' (software-rendered CI screenshot ' + i + ')' })); }
  $('#scenes').append(el('div', { class: 'card', 'data-testid': 'scene-' + sc.beat }, [
    el('div', { class: 'imgs' }, imgs),
    el('div', { class: 'body' }, [el('h3', { text: sc.en }), el('div', { class: 'zh', text: sc.zh }), el('div', { class: 'look', text: sc.look }),
      el('div', { class: 'row' }, [link('Open live · 打开现场', withQuery(GAME, 'preview=' + sc.beat), 'primary', 'open-' + sc.beat), link('中文', withQuery(GAME, 'preview=' + sc.beat + '&lang=zh'), '', 'open-zh-' + sc.beat)])])]));
});

// ---- this device ---------------------------------------------------------------------------------------------------
function gl() {
  try {
    const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) { return null; }
    const ext = g.getExtension('WEBGL_debug_renderer_info');
    return { webgl2: typeof WebGL2RenderingContext !== 'undefined' && g instanceof WebGL2RenderingContext, vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR), renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), maxTexture: g.getParameter(g.MAX_TEXTURE_SIZE), debugInfo: !!ext };
  } catch (e) { return null; }
}
function refreshRate(done) {
  const t = []; let last = 0; const f = (now) => { if (last) { t.push(now - last); } last = now; if (t.length < 70) { requestAnimationFrame(f); } else { const s = t.slice(10).sort((a, b) => a - b); done(Math.round(1000 / s[Math.floor(s.length / 2)])); } }; requestAnimationFrame(f);
}
const g = gl(); const rows = [];
const add = (k, v, cls) => rows.push([k, v, cls]);
const build = el('span', { text: window.__V5_BUILD__ || '…' }); add('Build · 版本', build);
if (!window.__V5_BUILD__) { fetch('/v5/data/build.json').then((r) => (r.ok ? r.text() : null)).then((t) => { build.textContent = t ? JSON.parse(t).build : 'unknown (not served by tools/v5-serve.mjs)'; }).catch(() => { build.textContent = 'unknown'; }); }
add('Browser · 浏览器', navigator.userAgent);
add('Platform · 平台', navigator.platform || '–');
add('Screen · 屏幕', `${screen.width}×${screen.height}, window ${innerWidth}×${innerHeight}, device pixel ratio ${devicePixelRatio}`);
add('Orientation · 方向', (screen.orientation && screen.orientation.type) || (innerWidth > innerHeight ? 'landscape' : 'portrait'));
add('CPU cores · 内核数', String(navigator.hardwareConcurrency || '–'));
add('Memory (browser-reported) · 内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB (capped by the browser)' : 'not reported by this browser');
add('WebGL', g ? (g.webgl2 ? 'WebGL 2' : 'WebGL 1 only') : 'NOT AVAILABLE — the game cannot run', g ? (g.webgl2 ? 'ok' : 'warn') : 'bad');
add('Graphics card · 显卡', g ? `${g.renderer} (${g.vendor})${g.debugInfo ? '' : ' — the browser hides the real name'}` : '–');
if (g && /swiftshader|llvmpipe|software|basic render/i.test(g.renderer)) { add('Software rendering · 软件渲染', 'This browser is drawing on the CPU. Frame rates here say nothing about a real GPU.', 'warn'); }
add('Secure context', String(window.isSecureContext));
add('Web Audio · 音频', window.AudioContext || window.webkitAudioContext ? 'available' : 'NOT AVAILABLE', window.AudioContext || window.webkitAudioContext ? 'ok' : 'bad');
add('Touch points · 触点', String(navigator.maxTouchPoints || 0));
add('Gamepad API · 手柄接口', navigator.getGamepads ? 'available' : 'NOT AVAILABLE', navigator.getGamepads ? 'ok' : 'bad');
add('JS heap readout · 内存读数', performance.memory ? 'Chrome-style (usedJSHeapSize)' : 'not exposed here: watch the browser’s own task manager / Activity Monitor for memory');
add('Reduced motion · 减少动态', String(matchMedia('(prefers-reduced-motion: reduce)').matches));
const hz = el('span', { text: 'measuring…' }); add('Display refresh · 刷新率', hz);
const tbl = $('#device'); rows.forEach(([k, v, cls]) => tbl.append(el('tr', {}, [el('th', { text: k }), el('td', { class: cls || '' }, [typeof v === 'string' ? document.createTextNode(v) : v])])));
refreshRate((r) => { hz.textContent = '≈ ' + r + ' Hz (from animation frames)'; });

// ---- gamepads ------------------------------------------------------------------------------------------------------
const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
const box = $('#pads'); const seen = new Map();
const none = el('p', { text: 'No gamepad detected yet. Press a button on it. · 尚未检测到手柄，请按手柄上的任意键。', 'data-testid': 'no-pad' });
box.textContent = ''; box.append(none);
function pads() { return navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected) : []; }
function draw() {
  const ps = pads(); none.hidden = ps.length > 0;
  [...seen.keys()].forEach((i) => { if (!ps.some((p) => p.index === i)) { seen.get(i).root.remove(); seen.delete(i); } });
  ps.forEach((p) => {
    let card = seen.get(p.index);
    if (!card) {
      card = { root: el('div', { class: 'pad', 'data-testid': 'pad-' + p.index }), info: el('div', { 'data-testid': 'pad-info' }), verdict: el('div', { 'data-testid': 'pad-verdict' }), btns: el('div', { class: 'btns' }), axes: el('div', { class: 'dim', 'data-testid': 'pad-axes' }) };
      card.spans = p.buttons.map((b, i) => { const s = el('span', { text: NAMES[i] || String(i) }); card.btns.append(s); return s; });
      card.root.append(card.info, card.verdict, card.btns, card.axes); box.append(card.root); seen.set(p.index, card);
    }
    const std = p.mapping === 'standard';
    card.info.textContent = `${p.id} · ${p.buttons.length} buttons, ${p.axes.length} axes, mapping “${p.mapping || 'none'}”`;
    card.verdict.className = std ? 'ok' : 'bad'; card.verdict.textContent = std ? 'Standard mapping: the game’s pad controls apply as documented.' : 'Not the standard mapping: buttons may do something different in the game. Note the model and what went wrong.';
    p.buttons.forEach((b, i) => { if (card.spans[i]) { card.spans[i].classList.toggle('on', !!(b.pressed || b.value > 0.5)); } });
    card.axes.textContent = 'Left stick ' + [p.axes[0], p.axes[1]].map((v) => (v || 0).toFixed(2)).join(', ') + ' · right stick ' + [p.axes[2], p.axes[3]].map((v) => (v || 0).toFixed(2)).join(', ');
  });
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
window.V5RC = { scenes: SCENES, ready: true };
