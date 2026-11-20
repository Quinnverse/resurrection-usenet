// Builds the V5 game as single HTML files that open straight from disk (double-click), with no server, no Node and no
// network: every module, the vendored three.js, the story data and the preview saves are inlined.
//
//   node tools/v5-bundle.mjs [--out dist/resurrection-v5-rc1]
//
// Writes into the output folder:
//   Resurrection-V5-Start.html     the start page: six doors (game, continue, technical demo, music, key scenes, feedback)
//   Resurrection-V5.html           the game
//   Resurrection-V5-Playtest.html  the game with the playtest recorder on (see docs/playtest/)
//   Resurrection-V5-Tech.html      the technical demo (archive → parse → manifest → restore → walkable floor)
//   Resurrection-V5-Audio.html     the music and sound listening page
//   feedback-form.html             the after-play questionnaire (saves a file on the player's computer, sends nothing)
//   Resurrection-V5-RC.html        the RC1 review hub (key scenes, frame-time test, device and gamepad check)
//   shots/                         screenshots used by the hub
//
// The bundler is a small module inliner, not a general one. It understands exactly the import/export forms this code base
// uses (named, namespace, `export {…}`, `export {…} from`, `export * from`, `export const|function|class`) and fails loudly
// on anything else. `bundleGame({ three })` returns the script alone, with three.js replaced by another module, which is how
// tools/v5-shell-run.mjs --bundle runs it in Node.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE_ID = 'frontend/p4/vendor/three.module.min.js';
const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');

const IMPORT_RE = /^import\s+([^;'"]+?)\s+from\s+(['"])([^'"]+)\2\s*;?[ \t]*$/gm;
const EXPORT_LIST_RE = /(^|[;}\n])[ \t]*export\s*\{([^}]*)\}\s*(?:from\s*(['"])([^'"]+)\3)?\s*;?/g;
const EXPORT_STAR_RE = /^export\s*\*\s*from\s*(['"])([^'"]+)\1\s*;?[ \t]*$/gm;

function resolveSpec(fromId, spec, opts) {
  const abs = path.resolve(root, path.dirname(fromId), spec); let id = rel(abs);
  if (opts.three && id === THREE_ID && fromId !== opts.three) { id = opts.three; }
  if (!fs.existsSync(path.join(root, id))) { throw new Error(`${fromId}: cannot find "${spec}" (${id})`); }
  return id;
}

// the names a module exports (needed to check that every import can be satisfied)
function parse(id, opts) {
  const file = path.join(root, id); let src = fs.readFileSync(file, 'utf8');
  const deps = []; const exportsList = []; const reexports = []; const stars = []; const locals = [];
  const names = (list) => list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(\S+)\s+as\s+(\S+)$/.exec(x); return m ? { local: m[1], exported: m[2] } : { local: x, exported: x }; });
  // imports
  const imports = []; src = src.replace(IMPORT_RE, (all, what, q, spec) => {
    const dep = resolveSpec(id, spec, opts); if (deps.indexOf(dep) < 0) { deps.push(dep); }
    let code; what = what.trim();
    let m;
    if ((m = /^\*\s+as\s+(\w+)$/.exec(what))) { code = `const ${m[1]} = __req(${JSON.stringify(dep)});`; imports.push({ dep, names: null }); }
    else if (/^\{[^}]*\}$/.test(what)) { const list = names(what.slice(1, -1)); /* `a as b`: a is the exported name, b the local one */ code = `const { ${list.map((n) => (n.local === n.exported ? n.local : `${n.local}: ${n.exported}`)).join(', ')} } = __req(${JSON.stringify(dep)});`; imports.push({ dep, names: list.map((n) => n.local) }); }
    else { throw new Error(`${id}: unsupported import form: ${all.trim()}`); }
    return code;
  });
  // export * from
  src = src.replace(EXPORT_STAR_RE, (all, q, spec) => { const dep = resolveSpec(id, spec, opts); if (deps.indexOf(dep) < 0) { deps.push(dep); } stars.push(dep); return ''; });
  // export { a, b as c } [from '…']
  src = src.replace(EXPORT_LIST_RE, (all, lead, list, q, spec) => {
    const ns = names(list);
    if (spec) { const dep = resolveSpec(id, spec, opts); if (deps.indexOf(dep) < 0) { deps.push(dep); } ns.forEach((n) => reexports.push({ dep, local: n.local, exported: n.exported })); }
    else { ns.forEach((n) => locals.push(n)); }
    return lead;
  });
  // export function / const / class
  src = src.replace(/^export\s+(async\s+)?function\s*(\*?)\s*(\w+)/gm, (all, a, star, name) => { exportsList.push(name); return `${a || ''}function${star} ${name}`; });
  src = src.replace(/^export\s+(const|class)\s+(\w+)/gm, (all, kind, name) => { exportsList.push(name); return `${kind} ${name}`; });
  if (/^\s*export\s+(let|var)\b/m.test(src)) { throw new Error(`${id}: "export let/var" is not supported (live bindings)`); }
  if (/^\s*(export|import)\s/m.test(src)) { const m = /^\s*(export|import)\s.*$/m.exec(src); throw new Error(`${id}: unhandled module syntax: ${m[0].slice(0, 100)}`); }
  return { id, src, deps, imports, exportsList, reexports, stars, locals };
}

export function bundleModules(entry, opts = {}) {
  const mods = new Map(); const order = []; const visiting = new Set();
  const visit = (id) => {
    if (mods.has(id)) { return; }
    if (visiting.has(id)) { throw new Error('import cycle through ' + id); }
    visiting.add(id); const m = parse(id, opts); m.deps.forEach(visit); visiting.delete(id); mods.set(id, m); order.push(id);
  };
  visit(entry);
  // every imported name must exist in the module it comes from
  const exportedBy = (id, seen = new Set()) => {
    if (seen.has(id)) { return new Set(); } seen.add(id); const m = mods.get(id); const out = new Set([...m.exportsList, ...m.locals.map((n) => n.exported), ...m.reexports.map((n) => n.exported)]);
    m.stars.forEach((d) => exportedBy(d, seen).forEach((n) => out.add(n)));
    return out;
  };
  order.forEach((id) => mods.get(id).imports.forEach((imp) => { if (!imp.names) { return; } const have = exportedBy(imp.dep); const miss = imp.names.filter((n) => !have.has(n)); if (miss.length) { throw new Error(`${id}: ${imp.dep} does not export ${miss.join(', ')}`); } }));
  const parts = [];
  order.forEach((id) => {
    const m = mods.get(id); let body = m.src; const tail = [];
    m.stars.forEach((d) => tail.unshift(`...__req(${JSON.stringify(d)})`));
    m.exportsList.forEach((n) => tail.push(n));
    m.locals.forEach((n) => tail.push(n.local === n.exported ? n.local : `${JSON.stringify(n.exported)}: ${n.local}`));
    m.reexports.forEach((n) => tail.push(`${JSON.stringify(n.exported)}: __req(${JSON.stringify(n.dep)}).${n.local}`));
    parts.push(`__defs[${JSON.stringify(id)}] = function (__req) {\n'use strict';\n${body}\n;return { ${tail.join(', ')} };\n};`);
  });
  return `(function () {\n'use strict';\nconst __defs = Object.create(null), __cache = Object.create(null);\nfunction __req(id) { if (id in __cache) { return __cache[id]; } const f = __defs[id]; if (!f) { throw new Error('module not bundled: ' + id); } return (__cache[id] = f(__req)); }\n${parts.join('\n')}\n__req(${JSON.stringify(entry)});\n})();\n`;
}

export const bundleGame = (opts = {}) => bundleModules('frontend/v5/main.js', opts);

// ---- HTML files -----------------------------------------------------------------------------------------------------
const esc = (js) => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
function dataShim() {
  const dir = path.join(root, 'frontend/v5/data'); const files = {};
  fs.readdirSync(dir).forEach((f) => { files['/v5/data/' + f] = fs.readFileSync(path.join(dir, f), 'utf8'); });
  return { files, js: `(function(){var F=${esc(JSON.stringify(files))};var of=window.fetch?window.fetch.bind(window):null;window.fetch=function(u,o){var k=typeof u==='string'?u:(u&&u.url);if(Object.prototype.hasOwnProperty.call(F,k)){return Promise.resolve(new Response(F[k],{status:200,headers:{'content-type':'text/plain; charset=utf-8'}}));}return of?of(u,o):Promise.reject(new Error('fetch unavailable'));};})();` };
}
const sha = () => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim(); } catch (e) { return 'unknown'; } };

function page(htmlFile, scriptTag, entry, flags, build, extraReplace) {
  let html = fs.readFileSync(path.join(root, 'frontend/v5', htmlFile), 'utf8');
  if (html.indexOf(scriptTag) < 0) { throw new Error(htmlFile + ': script tag not found'); }
  const pre = `window.__V5_STANDALONE__ = true; window.__V5_BUILD__ = ${JSON.stringify(build)};${flags}\n${dataShim().js}\n`;
  html = html.replace(scriptTag, () => `<script>\n${pre}${esc(bundleModules(entry))}</script>`);
  (extraReplace || []).forEach(([a, b]) => { html = html.split(a).join(b); });
  return html;
}

export function buildAll(outDir) {
  const build = sha(); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(outDir, name), text);
  const mainTag = '<script type="module" src="/v5/main.js"></script>';
  write('Resurrection-V5.html', page('index.html', mainTag, 'frontend/v5/main.js', '', build));
  write('Resurrection-V5-Playtest.html', page('index.html', mainTag, 'frontend/v5/main.js', ' window.__V5_PLAYTEST__ = true;', build));
  write('Resurrection-V5-Audio.html', page('audio.html', '<script type="module" src="/v5/audio-check.js"></script>', 'frontend/v5/audio-check.js', '', build, [['href="/v5/"', 'href="Resurrection-V5-Start.html"']]));
  write('Resurrection-V5-Tech.html', page('tech.html', '<script type="module" src="/v5/tech.js"></script>', 'frontend/v5/tech.js', '', build, [['href="/v5/"', 'href="Resurrection-V5.html"']]));
  write('Resurrection-V5-Start.html', page('home.html', '<script type="module" src="/v5/home.js"></script>', 'frontend/v5/home.js', '', build));
  fs.copyFileSync(path.join(root, 'docs/playtest/feedback-form.html'), path.join(outDir, 'feedback-form.html'));
  write('Resurrection-V5-RC.html', page('rc.html', '<script type="module" src="/v5/rc.js"></script>', 'frontend/v5/rc.js', '', build));
  fs.cpSync(path.join(root, 'frontend/v5/rc/shots'), path.join(outDir, 'shots'), { recursive: true });
  return { build, files: fs.readdirSync(outDir) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out'); const out = path.resolve(root, i >= 0 ? process.argv[i + 1] : 'dist/resurrection-v5-rc1');
  const r = buildAll(out);
  r.files.forEach((f) => { const p = path.join(out, f); console.log(f.padEnd(34), fs.statSync(p).isDirectory() ? '(folder)' : (fs.statSync(p).size / 1024).toFixed(0) + ' KB'); });
  console.log('build', r.build, '->', path.relative(root, out));
}
