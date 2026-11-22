// R4: every dialogue camera of a beat, checked for what stands between the camera and the speaker's face.
//   node tools/r4-camera-scan.mjs 2.train           one beat
//   node tools/r4-camera-scan.mjs                   the beats that have dialogue cameras (about 10 minutes)
// Writes docs/r4-evidence/camera/<beat>.json and a screenshot of every blocked shot. Real Chromium, software GPU.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const OUT = path.resolve(process.env.R4_CAM_OUT || 'docs/r4-evidence/camera'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 9100 + Math.floor(Math.random() * 800); const srv = spawn('node', ['tools/v5-serve.mjs', '--port', String(PORT)], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// which shots a beat uses, from the game's own dialogue tables, and who speaks in them
const Gm = await import('../frontend/v5/core/game.js');
const SPEAKERS = { june: 'june', elena: 'elena', mara: 'mara', theo: 'theo', mother: 'mother' };
const SHOTS = {}; Object.entries(Gm.DIALOGS).forEach(([id, lines]) => lines.forEach((ln) => { if (Array.isArray(ln) && ln[2]) { const b = id.startsWith('c2.') ? '2.train' : id.startsWith('c1.theo') ? '1.town' : id.startsWith('c3.') ? '3.yard' : id.startsWith('c4.') ? '4.cottage' : id.startsWith('c5.') ? '5.depart' : id.startsWith('c6.') ? '6.cottage' : id.startsWith('c7.') ? '7.town' : id.startsWith('p.k.') ? 'P.kitchen' : id.startsWith('p.s.') ? 'P.summer' : null; if (b) { (SHOTS[b] = SHOTS[b] || new Set()).add(ln[2] + '|' + (SPEAKERS[ln[0]] || '')); } } }));
const only = process.argv.slice(2); const beats = only.length ? only : Object.keys(SHOTS);
const results = {};
for (const beat of beats) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/v5/?preview=${beat}`);
  for (let i = 0; i < 120; i++) { const s = await page.evaluate(() => window.V5Debug && window.V5Debug.snapshot()).catch(() => null); if (s && s.beat === beat) { break; } await page.waitForTimeout(500); }
  await page.waitForTimeout(1500); const list = [...(SHOTS[beat] || [])].map((x) => x.split('|')).filter(([sh, sp]) => sp);
  // the beat's default camera too (no shot), for every speaker in it
  [...new Set(list.map(([, sp]) => sp))].forEach((sp) => list.push(['', sp]));
  const rows = [];
  for (const [shot, sp] of list) { const r = await page.evaluate(([a, b]) => window.V5Debug.probeShot(a || null, b), [shot, sp]); if (r && !r.error) { rows.push(r); if ((r.blocked && r.blocker && r.blocker.dist < r.headDist - 0.2) || (r.nearestBody && r.nearestBody.d < 0.7)) { await page.screenshot({ path: path.join(OUT, `${beat}-${shot || 'default'}-${sp}.jpg`), type: 'jpeg', quality: 70 }); } } }
  results[beat] = rows; await ctx.close();
  console.log(beat, rows.length, 'probes;', rows.filter((r) => r.blocked).length, 'blocked;', rows.filter((r) => r.nearestBody && r.nearestBody.d < 0.7).length, 'with a body within 0.7 m');
}
fs.writeFileSync(path.join(OUT, only.length ? `scan-${only.join('-')}.json` : 'scan.json'), JSON.stringify(results, null, 2));
// pass/fail: a camera that looks at a face from closer than 0.9 m to another body, or with a character's coat or hair in
// front of the speaker's face (far-away play cameras such as the beam are judged by eye: they are not close-ups)
const bad = []; Object.entries(results).forEach(([beat, rows]) => rows.forEach((r) => { if (r.headDist < 5 && ((r.blocked && r.blocker && r.blocker.dist < r.headDist - 0.15) || (r.nearestBody && r.nearestBody.d < 0.9))) { bad.push(`${beat} ${r.shot || 'default'} ${r.speaker}: ${r.blocked ? 'blocked by ' + (r.blocker.owner || r.blocker.color) + ' at ' + r.blocker.dist + ' m' : 'body at ' + r.nearestBody.d + ' m'}`); } }));
console.log(bad.length ? 'PROBLEMS:\n  ' + bad.join('\n  ') : 'every dialogue close-up is clear');
if (bad.length) { process.exitCode = 1; }
await browser.close(); srv.kill();
