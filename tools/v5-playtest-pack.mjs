// Builds the V5 playtest package: the game, a dependency-free local server, and the facilitator documents.
//   node tools/v5-playtest-pack.mjs            -> dist/resurrection-v5-playtest/ and dist/resurrection-v5-playtest.zip
// On the test machine: install Node 18+ and run `node serve.mjs`, then open the address it prints.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'resurrection-v5-playtest');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });
copy('frontend/v5', 'site/v5');
copy('frontend/p4/vendor', 'site/p4/vendor');
copy('docs/playtest', 'docs');
copy('docs/V5-AUDIO-CHECKLIST.md', 'docs/V5-AUDIO-CHECKLIST.md');
const sha = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim(); } catch (e) { return 'unknown'; } })();
fs.writeFileSync(path.join(out, 'serve.mjs'), `// Local server for the V5 playtest package. No dependencies, no network access needed.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site'); const port = +process.env.PORT || 8098;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8' };
const alias = { '/': '/v5/index.html', '/v5': '/v5/index.html', '/v5/': '/v5/index.html', '/v5/tech': '/v5/tech.html', '/v5/audio': '/v5/audio.html' };
http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); const p = alias[u] || u; const f = path.join(site, path.normalize(p));
  if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'" });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log('Resurrection V5 playtest build ${sha}');
  console.log('  game, recording a playtest:  http://127.0.0.1:' + port + '/v5/?playtest=1');
  console.log('  audio listening check:       http://127.0.0.1:' + port + '/v5/audio');
  console.log('  feedback form:               docs/feedback-form.html (open the file directly)');
});
`);
fs.writeFileSync(path.join(out, 'README.txt'), `Resurrection V5 — playtest package (build ${sha})\n\n1. Install Node.js 18 or newer.\n2. In this folder run:  node serve.mjs\n3. Open http://127.0.0.1:8098/v5/?playtest=1 in Chrome, Firefox, Edge or Safari.\n\nRead docs/README.md (facilitator guide) before the first session.\nAll story content and the USENET archive in the game are fictional.\n`);
const zip = path.join(root, 'dist', 'resurrection-v5-playtest.zip'); fs.rmSync(zip, { force: true });
try { execFileSync('zip', ['-qr', zip, 'resurrection-v5-playtest'], { cwd: path.join(root, 'dist') }); console.log('wrote', path.relative(root, zip)); } catch (e) { console.log('zip not available; folder only'); }
console.log('wrote', path.relative(root, out), 'build', sha);
