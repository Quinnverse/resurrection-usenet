// One-command local server for the V5 game and the RC1 review pages. No dependencies, no network access needed.
//
//   node tools/v5-serve.mjs                 http://127.0.0.1:8090/v5/ (this computer only)
//   node tools/v5-serve.mjs --lan           also reachable from phones and tablets on the same Wi-Fi (prints the addresses)
//   node tools/v5-serve.mjs --open          open the review hub in the default browser
//   PORT=9000 node tools/v5-serve.mjs       another port
//
// Serves only frontend/v5 and the vendored three.js, read-only. --lan opens that to the local network: use it on a
// network you trust and stop the server when you are done.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const LAN = args.includes('--lan'); const OPEN = args.includes('--open');
const pi = args.indexOf('--port'); const PORT = Number(pi >= 0 ? args[pi + 1] : process.env.PORT) || 8090;
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.spool': 'text/plain; charset=utf-8', '.mbox': 'text/plain; charset=utf-8' };
const ALIAS = { '/': '/v5/home.html', '/v5/home': '/v5/home.html', '/v5': '/v5/index.html', '/v5/': '/v5/index.html', '/v5/tech': '/v5/tech.html', '/v5/audio': '/v5/audio.html', '/v5/rc': '/v5/rc.html' };
const build = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return 'unknown'; } })();
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

export function fileFor(urlPath) {
  if (urlPath === '/v5/feedback') { return path.join(root, 'docs', 'playtest', 'feedback-form.html'); }   // the questionnaire lives with the playtest documents
  const p = ALIAS[urlPath] || urlPath;
  let base;
  if (p.startsWith('/v5/')) { base = path.join(root, 'frontend'); } else if (p.startsWith('/p4/vendor/')) { base = path.join(root, 'frontend'); } else { return null; }
  const f = path.normalize(path.join(base, p)); if (!f.startsWith(base + path.sep)) { return null; }
  return f;
}
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
  let u; try { u = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (u === '/v5/data/build.json') { res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' }); return res.end(JSON.stringify({ build })); }
  const f = fileFor(u);
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' });
  if (req.method === 'HEAD') { return res.end(); }
  fs.createReadStream(f).pipe(res);
});
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Try: PORT=${PORT + 1} node tools/v5-serve.mjs` : String(e)); process.exit(1); });
  server.listen(PORT, HOST, () => {
    console.log(`Resurrection V5 (build ${build})`);
    console.log(`  start page:   http://127.0.0.1:${PORT}/v5/home`);
    console.log(`  review hub:   http://127.0.0.1:${PORT}/v5/rc`);
    console.log(`  the game:     http://127.0.0.1:${PORT}/v5/`);
    console.log(`  music check:  http://127.0.0.1:${PORT}/v5/audio`);
    if (LAN) {
      const addrs = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
      console.log('  on the same Wi-Fi (phones, tablets):'); addrs.forEach((a) => console.log(`    http://${a}:${PORT}/v5/home`));
      if (!addrs.length) { console.log('    (no network address found)'); }
      console.log('  The server is open to your local network while it runs. Press Ctrl+C to stop it.');
    } else { console.log('  (this computer only; add --lan to test on a phone)'); }
    console.log('  Ctrl+C to stop.');
    if (OPEN) { const url = `http://127.0.0.1:${PORT}/v5/home`; const [cmd, a] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]; execFile(cmd, a, () => {}); }
  });
}
export { server };
