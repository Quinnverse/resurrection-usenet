// Checks an RC package the way an owner receives it: unzip into a brand-new folder, then look at the extracted files only.
//
//   node tools/v5-verify-package.mjs dist/resurrection-v5-rc2.zip [--commit <short hash>]
//
// 1. every expected file is there, and no page asks for anything outside the folder (no http(s) src/href/url(), no CDN)
// 2. every link between the pages points at a file that exists in the folder
// 3. every inline script parses, and every page carries the same build id (and the one you expect with --commit)
// 4. the game page from the folder is played from the title to the credits in Node (tools/v5-shell-run.mjs --html): English and
//    Chinese, with every check of that harness (HUD, goals, journal, saves, no stuck moments). Only three.js's WebGL layer is
//    replaced; the game code, the story data and the build id are the ones inside the extracted file.
//
// What this does NOT prove: that a particular browser opens the file, draws it on a real GPU, or plays sound.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const zip = path.resolve(args.find((a) => a.endsWith('.zip')) || '');
const want = args.indexOf('--commit') >= 0 ? args[args.indexOf('--commit') + 1] : null;
if (!fs.existsSync(zip)) { console.error('usage: node tools/v5-verify-package.mjs <package.zip> [--commit <hash>]'); process.exit(2); }

const BEAT_COUNT = (await import('../frontend/v5/core/game.js')).BEATS.length;
const results = []; const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail || '' }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-package-verify-'));
console.log(`zip      ${zip}\nsha256   ${sha256(zip)}\nunzipped into a new folder: ${dir}`);
execFileSync('unzip', ['-q', zip, '-d', dir]);
const top = fs.readdirSync(dir); const base = top.length === 1 && fs.statSync(path.join(dir, top[0])).isDirectory() ? path.join(dir, top[0]) : dir;
check('one top folder inside the zip', base !== dir, top.join(', '));

const rcN = (/resurrection-v5-rc(\d+)/.exec(path.basename(base)) || [])[1] || '2';
const PAGES = ['Resurrection-V5-Start.html', 'Resurrection-V5.html', 'Resurrection-V5-Playtest.html', 'Resurrection-V5-Tech.html', 'Resurrection-V5-Audio.html', 'Resurrection-V5-RC.html', 'feedback-form.html'];
const need = rcN === '4'
  ? ['START-HERE.txt', 'PLAYTEST-QUESTIONS.txt', 'RESURRECTION_THEME.md', 'docs/V5-RC2-REPORT.md', 'docs/V5-LOCAL-TESTING.md', 'docs/R4-REPORT.md', 'docs/R4-SCRIPT.md', 'docs/R4-CHARACTERS-TIMELINE.md', 'docs/R4-CHAPTER-LINKS.md', 'docs/R4-BLOCKER-FIXES.md', 'docs/R4-TEST-STRATEGY.md'].concat(PAGES)
  : ['START-HERE.txt', 'CHAPTER-1-RETEST.txt', 'docs/V5-RC2-REPORT.md', 'docs/V5-LOCAL-TESTING.md'].concat(PAGES, rcN !== '2' ? ['docs/V5-RC' + rcN + '-REPORT.md', 'docs/V5-RC' + rcN + '-STORY.md'] : []);
const missing = need.filter((f) => !fs.existsSync(path.join(base, f)));
check('all expected files are in the folder', missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : `${need.length} files`);
const shots = fs.existsSync(path.join(base, 'shots')) ? fs.readdirSync(path.join(base, 'shots')).length : 0;
check('review screenshots are in the folder', shots > 0, shots + ' files');

const pages = fs.readdirSync(base).filter((f) => f.endsWith('.html'));
const builds = new Set();
for (const f of pages) {
  const html = fs.readFileSync(path.join(base, f), 'utf8');
  const external = [...html.matchAll(/\b(?:src|href|action|poster)\s*=\s*["'](https?:)?\/\/[^"']+/gi)].map((m) => m[0].slice(0, 80))
    .concat([...html.matchAll(/url\(\s*["']?(?:https?:)?\/\/[^)]+/gi)].map((m) => m[0].slice(0, 80)))
    .concat([...html.matchAll(/@import\s+(?:url\()?["']?(?:https?:)?\/\/[^;)]+/gi)].map((m) => m[0].slice(0, 80)));
  check(`${f}: asks for nothing outside the folder`, external.length === 0, external.slice(0, 3).join(' | '));
  const local = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+\.(?:html|png|jpg|jpeg|svg|css|js|json|txt|md))["']/gi)].map((m) => m[1]).filter((x) => !/^(https?:)?\/\//.test(x));
  const dead = local.filter((x) => !x.startsWith('/') && !fs.existsSync(path.join(base, x)));
  const rootLinks = local.filter((x) => x.startsWith('/'));
  check(`${f}: its links to other files exist`, dead.length === 0 && rootLinks.length === 0, [dead.length ? 'dead: ' + dead.join(', ') : '', rootLinks.length ? 'server-only paths: ' + rootLinks.slice(0, 3).join(', ') : ''].filter(Boolean).join('; '));
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim());
  // links that the page's own script builds (the start page and the hub choose file names when opened from disk)
  const named = [...new Set(scripts.flatMap((s) => [...s.matchAll(/['"]((?:Resurrection-V5[\w-]*|feedback-form)\.html)['"]/g)].map((m) => m[1])))];
  const gone = named.filter((x) => !fs.existsSync(path.join(base, x)));
  check(`${f}: ${named.length} page name(s) its script links to exist`, gone.length === 0, gone.length ? 'missing: ' + gone.join(', ') : named.join(', ').slice(0, 120));
  let bad = null; scripts.forEach((s, i) => { try { new vm.Script(s, { filename: `${f}#script${i + 1}` }); } catch (e) { bad = bad || `${e.message}`; } });
  check(`${f}: ${scripts.length} inline script(s) parse`, !bad && (scripts.length > 0 || f === 'feedback-form.html'), bad || '');
  const b = /__V5_BUILD__\s*=\s*"(\w+)"/.exec(html); if (b) { builds.add(b[1]); }
}
const textBuild = (/build (\w+)/.exec(fs.readFileSync(path.join(base, 'START-HERE.txt'), 'utf8')) || [])[1];
const all = new Set([...builds, textBuild].filter(Boolean));
check('every page and START-HERE.txt carry the same build id', all.size === 1, [...all].join(', '));
if (want) { check(`the build id is the expected commit ${want}`, all.has(want), [...all].join(', ')); }

const game = path.join(base, 'Resurrection-V5.html');
for (const [label, extra] of [['English', []], ['Chinese (with the alternate choices)', ['--lang', 'zh', '--alt']]]) {
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'v5-shell-run.mjs'), '--quiet', '--html', game, ...extra], { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  let j = null; try { j = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { /* no report */ }
  const ok = !!j && j.ok === true && r.status === 0 && j.shippedPage && j.shippedPage.standalone === true && (all.size !== 1 || j.shippedPage.build === [...all][0]) && (j.beatsVisited || []).length === BEAT_COUNT &&   /* R4: the prologue and epilogue make 25 */  (j.failedChecks || []).length === 0 && (j.hudHiddenTooLong || []).length === 0;
  check(`the extracted game page plays all seven chapters to the credits, ${label}`, ok, j ? `ok=${j.ok}, ${(j.beatsVisited || []).length} beats, ${j.gameSeconds}s of game time, build ${j.shippedPage && j.shippedPage.build}, journal ${j.journal && j.journal.found}/${j.journal && j.journal.of}${(j.failedChecks || []).length ? ', failed: ' + j.failedChecks.join('; ') : ''}` : `no report; exit ${r.status}; ${String(r.stderr || '').slice(0, 200)}`);
}

fs.rmSync(dir, { recursive: true, force: true });
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? '; FAILED: ' + failed.map((x) => x.name).join(' | ') : ''}`);
process.exit(failed.length ? 1 : 0);
