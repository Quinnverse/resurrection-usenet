// Builds the RC1 package for the owner's own review (a folder and a zip):
//   node tools/v5-rc-pack.mjs   ->  dist/resurrection-v5-rc1/ and dist/resurrection-v5-rc1.zip
// Open Resurrection-V5-Start.html (double-click). Everything works from disk: the game, the technical demo, the music
// page, the key-scene previews, the frame-time test and the gamepad monitor. The review documents are in docs/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildAll } from './v5-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'resurrection-v5-rc1');
const { build } = buildAll(out);
const docs = ['V5-RC1-README.md', 'V5-RC1-DEVICE-TEST.md', 'V5-RC1-PERF.md', 'V5-RC1-BLOCKERS.md', 'V5-RC1-ACCEPTANCE.md', 'V5-AUDIO-CHECKLIST.md', 'V5-P5-BASELINE.md', 'V5-TEST-REPORT.md'];
fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
docs.forEach((d) => { const f = path.join(root, 'docs', d); if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, 'docs', d)); } });
fs.cpSync(path.join(root, 'docs/playtest'), path.join(out, 'docs/playtest'), { recursive: true });
fs.writeFileSync(path.join(out, 'START-HERE.txt'), `Resurrection V5 — RC1 review package (build ${build})\n\nDouble-click  Resurrection-V5-Start.html : six doors: start, continue, technical demo, music, key scenes, feedback.\nDevice, gamepad and frame-time checks are behind “advanced” on that page (Resurrection-V5-RC.html).\nNo installation, no server, no internet. Use Chrome, Edge, Firefox or Safari on a computer.\n\nPhone or tablet: these files cannot be opened from a phone directly. On the computer, in the repository, run  npm run v5:lan  and open the address it prints on the phone.\n\nRead docs/V5-RC1-README.md first, then docs/V5-RC1-DEVICE-TEST.md.\n`);
const zip = path.join(root, 'dist', 'resurrection-v5-rc1.zip'); fs.rmSync(zip, { force: true });
try { execFileSync('zip', ['-qr', zip, 'resurrection-v5-rc1'], { cwd: path.join(root, 'dist') }); console.log('wrote', path.relative(root, zip)); } catch (e) { console.log('zip not available; folder only'); }
console.log('wrote', path.relative(root, out), 'build', build);
