// Builds the playtest package for players who have no development environment:
//   node tools/v5-playtest-pack.mjs   ->  dist/resurrection-v5-playtest/ and dist/resurrection-v5-playtest.zip
// The package is a folder with START-HERE.html (what to do, controls, how long, what is recorded), the game with the
// recorder on as ONE html file that opens by double-click (no Node, no server, no internet) and the feedback form.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildAll } from './v5-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'resurrection-v5-playtest'); const tmp = path.join(root, 'dist', '.v5-bundle-tmp');
const { build } = buildAll(tmp);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(tmp, 'Resurrection-V5-Playtest.html'), path.join(out, 'Resurrection-V5-Playtest.html'));
fs.copyFileSync(path.join(root, 'docs/playtest/START-HERE.html'), path.join(out, 'START-HERE.html'));
fs.copyFileSync(path.join(root, 'docs/playtest/feedback-form.html'), path.join(out, 'feedback-form.html'));
fs.writeFileSync(path.join(out, 'README.txt'), `Resurrection — The Summer We Never Finished: playtest folder (build ${build})\n\n1. Open START-HERE.html (double-click) and read it. It takes two minutes.\n2. Double-click Resurrection-V5-Playtest.html to play. No installation, no internet.\n3. Afterwards open feedback-form.html, and give the downloaded files to the person who gave you this folder.\n\nThe game keeps a play record inside your browser only. It is never sent anywhere. You can delete it in the pause menu.\n\n---\n\n请先双击打开 START-HERE.html（两分钟）。然后双击 Resurrection-V5-Playtest.html 开始游戏，无需安装也不需要联网。\n玩完后打开 feedback-form.html，把下载的文件交给给你这个文件夹的人。\n游玩记录只保存在你的浏览器里，不会被发送到任何地方，可在暂停菜单中删除。\n`);
fs.rmSync(tmp, { recursive: true, force: true });
const zip = path.join(root, 'dist', 'resurrection-v5-playtest.zip'); fs.rmSync(zip, { force: true });
try { execFileSync('zip', ['-qr', zip, 'resurrection-v5-playtest'], { cwd: path.join(root, 'dist') }); console.log('wrote', path.relative(root, zip)); } catch (e) { console.log('zip not available; folder only'); }
console.log('wrote', path.relative(root, out), 'build', build);
