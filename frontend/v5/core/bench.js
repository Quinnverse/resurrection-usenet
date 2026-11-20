// Frame-time statistics and the parameters of the RC1 performance run (?bench=...). Pure functions, no DOM.
// "1% low" here is the frame rate of the slowest 1% of frames: 1000 / (mean of the worst ceil(n / 100) frame times).
export const TIERS = ['low', 'medium', 'high'];
// Places that stress different things: the big town, indoor rooms, night and lights, the coast, snow.
export const BENCH_BEATS = ['1.study', '1.town', '1.pier', '2.train', '3.ride', '3.beam', '4.porch', '6.beach', 'end'];
export const HITCH_MS = 100, SEVERE_MS = 250;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const round = (x, d) => { const k = Math.pow(10, d == null ? 1 : d); return Math.round(x * k) / k; };

// frames: array or typed array of frame times in milliseconds (time between consecutive animation frames)
export function summarize(frames) {
  const n = frames.length; if (!n) { return { frames: 0, seconds: 0, avgFps: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, low1Fps: 0, worstMs: 0, hitches: 0, severe: 0 }; }
  const sorted = Array.from(frames).sort((a, b) => a - b); const total = sorted.reduce((a, b) => a + b, 0);
  const k = Math.max(1, Math.ceil(n / 100)); const worst = sorted.slice(n - k); const worstMean = worst.reduce((a, b) => a + b, 0) / k;
  return {
    frames: n, seconds: round(total / 1000, 2), avgFps: round(1000 * n / total, 1), avgMs: round(total / n, 2),
    p50Ms: round(pct(sorted, 0.5), 2), p95Ms: round(pct(sorted, 0.95), 2), p99Ms: round(pct(sorted, 0.99), 2),
    low1Fps: round(1000 / worstMean, 1), worstMs: round(sorted[n - 1], 1),
    hitches: sorted.filter((x) => x > HITCH_MS).length, severe: sorted.filter((x) => x > SEVERE_MS).length
  };
}

// The display's refresh rate from idle frame times: the median is robust against a few slow frames.
export function refreshHz(frames) {
  if (!frames.length) { return null; }
  const sorted = Array.from(frames).sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)];
  const hz = 1000 / med; const known = [30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240];
  return known.reduce((best, k2) => (Math.abs(k2 - hz) < Math.abs(best - hz) ? k2 : best), known[0]);
}

// ?bench=low,medium,high&beats=1.town,2.train&secs=8&warm=2&run=abc  ->  null when it is not a bench address
export function parseBench(search) {
  const q = new URLSearchParams(search || ''); if (!q.has('bench')) { return null; }
  const tiers = (q.get('bench') || '').split(',').filter((t) => TIERS.indexOf(t) >= 0); if (!tiers.length) { tiers.push('high'); }
  const beats = q.has('beats') ? q.get('beats').split(',').filter(Boolean) : BENCH_BEATS.slice();
  const num = (k, d, lo, hi) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? Math.max(lo, Math.min(hi, v)) : d; };
  return { tiers, beats, secs: num('secs', 8, 1, 60), warm: num('warm', 2, 0, 10), run: (q.get('run') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || null };
}
export function benchUrl(base, b) {
  const q = new URLSearchParams(); q.set('bench', b.tiers.join(',')); q.set('beats', b.beats.join(',')); q.set('secs', String(b.secs)); q.set('warm', String(b.warm)); if (b.run) { q.set('run', b.run); }
  return base + '?' + q.toString();
}

// "Chrome 142", "Safari 18.1", "Firefox 140", "Edge 142" from a user-agent string (best effort)
export function browserName(ua) {
  const u = String(ua || ''); let m;
  if ((m = /Edg(?:e|A|iOS)?\/(\d+[\d.]*)/.exec(u))) { return 'Edge ' + m[1].split('.')[0]; }
  if ((m = /(?:Firefox|FxiOS)\/(\d+[\d.]*)/.exec(u))) { return 'Firefox ' + m[1].split('.')[0]; }
  if ((m = /(?:Chrome|CriOS)\/(\d+[\d.]*)/.exec(u))) { return 'Chrome ' + m[1].split('.')[0]; }
  if ((m = /Version\/(\d+[\d.]*).*Safari/.exec(u))) { return 'Safari ' + m[1]; }
  return 'unknown browser';
}

export function markdown(report) {
  const d = report.device || {}; const L = [];
  L.push(`### ${d.browser || 'browser'} · ${d.gpu || 'GPU unknown'} · ${d.screen ? d.screen.join('×') : '?'} @${d.dpr || '?'}x · ${report.when ? report.when.slice(0, 10) : ''}`);
  L.push(`Build ${report.build || 'unknown'}, display ≈ ${d.refreshHz || '?'} Hz, ${d.cores || '?'} cores, ${d.memoryGB ? d.memoryGB + ' GB (browser-reported)' : 'memory not reported'}, ready ${report.readyMs != null ? Math.round(report.readyMs) + ' ms' : '?'} after navigation start.`);
  L.push('');
  L.push('| Quality | Scene | Load ms | Avg FPS | 1% low FPS | p99 ms | Worst ms | Hitches >100 ms | Severe >250 ms | Heap MB | Draw calls | Triangles |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  (report.results || []).forEach((r) => { const s = r.stats; L.push(`| ${r.tier} | ${r.beat}${r.interrupted ? ' (tab hidden!)' : ''} | ${r.loadMs != null ? Math.round(r.loadMs) : '–'} | ${s.avgFps} | ${s.low1Fps} | ${s.p99Ms} | ${s.worstMs} | ${s.hitches} | ${s.severe} | ${r.heapMB != null ? r.heapMB : 'n/a'} | ${r.calls != null ? r.calls : '–'} | ${r.triangles != null ? r.triangles : '–'} |`); });
  const by = {}; (report.results || []).forEach((r) => { (by[r.tier] = by[r.tier] || []).push(r); });
  L.push(''); L.push('| Quality | Mean of scene avg FPS | Lowest scene 1% low FPS | Max heap MB | Severe stalls (total) |'); L.push('|---|---|---|---|---|');
  Object.keys(by).forEach((t) => { const a = by[t]; const mean = a.reduce((x, r) => x + r.stats.avgFps, 0) / a.length; const low = Math.min.apply(null, a.map((r) => r.stats.low1Fps)); const heaps = a.map((r) => r.heapMB).filter((h) => h != null); L.push(`| ${t} | ${round(mean, 1)} | ${low} | ${heaps.length ? Math.max.apply(null, heaps) : 'n/a'} | ${a.reduce((x, r) => x + r.stats.severe, 0)} |`); });
  return L.join('\n');
}
