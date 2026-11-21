// Finds code that a `//` comment has swallowed: a line comment followed, on the same line, by statements that look like
// they were meant to run (if, expect, assert, add, push, const, assignments). This happened three times in RC2
// (guide.js twice, tools/v5-shell-run.mjs once) and each time a check or a UI rule silently stopped working.
//
//   node tools/v5-lint-swallowed.mjs [files or folders…]    default: tools test e2e frontend/v5 backend/__tests__
//
// Exit 1 when something is found. Known false positives can be listed in ALLOW as "file:line-text-start".
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const roots = args.length ? args : ['tools', 'test', 'e2e', 'frontend/v5', 'backend/__tests__'];
const files = [];
const walk = (p) => { if (!fs.existsSync(p)) { return; } const st = fs.statSync(p); if (st.isDirectory()) { if (/node_modules|dist|vendor/.test(p)) { return; } fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); } else if (/\.(m?js|ts)$/.test(p) && !/\.min\./.test(p)) { files.push(p); } };
roots.forEach(walk);

// where a line comment starts, skipping strings, template literals, block comments and regex literals
function commentStart(line) {
  let q = null; let prev = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q || (q === ']' && c === ']')) { q = q === ']' ? '/' : null; } continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; prev = c; continue; }
    if (c === '/' && line[i + 1] === '*') { const e = line.indexOf('*/', i + 2); if (e < 0) { return -1; } i = e + 1; continue; }
    if (c === '/' && line[i + 1] === '/') { return line[i - 1] === ':' ? -1 : i; }
    if (c === '/' && /[(,=:[!&|?{};]|^$|return$/.test(prev.trim() || '')) { q = '/'; continue; }   // a regex literal
    if (q === null && c === '[' && prev === '/') { q = ']'; continue; }
    if (!/\s/.test(c)) { prev = c; }
  }
  return -1;
}
const looksLikeCode = /(\bif \(|\bexpect\(|\bassert\.|\.add\(|\.push\(|\bconst \w+ = |\blet \w+ = |\}\s*else\s*\{|;\s*[\w.[\]]+\s*(=|\+=|-=)\s)/;
const ALLOW = [];
const found = [];
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    const k = commentStart(l); if (k < 0) { return; }
    const tail = l.slice(k + 2);
    if (looksLikeCode.test(tail) && /[;{}]\s*$/.test(tail.trim()) && !ALLOW.some((a) => `${f}:${tail.trim()}`.startsWith(a))) { found.push(`${f}:${i + 1}: //${tail.trim().slice(0, 160)}`); }
  });
}
found.forEach((x) => console.log(x));
console.log(`${files.length} files checked, ${found.length} line comment(s) with code after them`);
process.exit(found.length ? 1 : 0);
