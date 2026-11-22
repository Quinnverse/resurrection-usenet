// Builds the RC2 playtest package for the owner (chapter 1 retest first), from the same single-file builds as RC1:
//   node tools/v5-rc2-pack.mjs   ->  dist/resurrection-v5-rc2/ and dist/resurrection-v5-rc2.zip
// Run `npm run v5:rc` first (it builds dist/resurrection-v5-rc1/ and the playtest folder from the current commit), or just
//   npm run v5:rc2     (build, pack, then verify the zip from a fresh folder: tools/v5-verify-package.mjs)
// Needs a clean tree (see below). The zip holds the single-file pages, the review screenshots, docs/ and two plain-text sheets.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist', 'resurrection-v5-rc1');
if (!fs.existsSync(path.join(src, 'Resurrection-V5.html'))) { console.error('run  npm run v5:rc  first'); process.exit(1); }
const build = (fs.readFileSync(path.join(src, 'START-HERE.txt'), 'utf8').match(/build (\w+)/) || [])[1] || 'unknown';
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
if (build !== head) { console.error(`dist/ is from ${build}, HEAD is ${head}: run  npm run v5:rc  again`); process.exit(1); }
// the build id in the pages is only the commit hash: a package made from a modified tree would look clean and not be
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'frontend', 'combined-server', 'docs', 'tools', 'test', 'e2e', 'package.json'], { cwd: root }).toString().trim();
if (dirty) { console.error('uncommitted changes in the game, docs or tools; commit them first so the build id says what is inside:\n' + dirty); process.exit(1); }
// --rc 3 builds the RC3 package the same way (dist/resurrection-v5-rc3/, its report docs/V5-RC3-REPORT.md)
const RC = (() => { const i = process.argv.indexOf('--rc'); return i >= 0 ? String(process.argv[i + 1]) : '2'; })();
const NAME = 'resurrection-v5-rc' + RC;
const out = path.join(root, 'dist', NAME);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
const R4_DOCS = ['R4-REPORT.md', 'R4-SCRIPT.md', 'R4-CHARACTERS-TIMELINE.md', 'R4-CHAPTER-LINKS.md', 'R4-BLOCKER-FIXES.md', 'R4-TEST-STRATEGY.md', 'R4-SHA256.txt'];
['V5-RC2-REPORT.md', 'V5-LOCAL-TESTING.md'].concat(RC === '4' ? R4_DOCS : RC !== '2' ? ['V5-RC' + RC + '-REPORT.md', 'V5-RC' + RC + '-STORY.md'] : []).forEach((d) => { const f = path.join(root, 'docs', d); if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, 'docs', d)); } else if (RC !== '4') { throw new Error('missing ' + f); } });
if (RC === '4') { fs.copyFileSync(path.join(root, 'RESURRECTION_THEME.md'), path.join(out, 'RESURRECTION_THEME.md')); if (fs.existsSync(path.join(root, 'docs', 'r4-evidence'))) { fs.cpSync(path.join(root, 'docs', 'r4-evidence'), path.join(out, 'evidence'), { recursive: true }); } }
fs.writeFileSync(path.join(out, 'START-HERE.txt'), RC === '4' ? startHere4(build) : RC !== '2' ? startHere3(build) : `Resurrection V5 — RC2 playtest package (build ${build})

What to do first: replay CHAPTER 1 as if you had never seen the game (about 5–10 minutes).
  1. Double-click  Resurrection-V5.html  (Chrome, Edge, Firefox or Safari on a computer; no install, no internet).
     If an old save from RC1 is offered, choose New game.
  2. Do not read anything else first. Play until June's train leaves.
  3. Then answer the questions in CHAPTER-1-RETEST.txt (write them in any file, or tell the developer).

Everything else (as in RC1): Resurrection-V5-Start.html has the six doors (start, continue, technical demo, music, key
scenes, feedback). docs/V5-RC2-REPORT.md says what changed, what passed and what is not tested.
Phone or tablet: these files cannot be opened from a phone directly; in the repository run  npm run v5:lan.
`);
fs.writeFileSync(path.join(out, RC === '4' ? 'PLAYTEST-QUESTIONS.txt' : 'CHAPTER-1-RETEST.txt'), RC === '4' ? retest4(build) : RC !== '2' ? retest3(build) : `Chapter 1 retest (RC2, build ${build})

Before RC2 you got stuck twice: E at the computer did nothing useful, and after the first Tab you did not know where to go.
Please play chapter 1 fresh and note, honestly, for each point: clear / took a while / stuck, and roughly how long.

 1. The first minute: did you know how to move and look without being told by anyone?
 2. The computer: when it asked for a disk, did you know where to find it?
 3. The task bar (top left): did you notice it? Did "Next:" tell you the right thing?
 4. The canal and the bridge: did you know you had to HOLD E?
 5. The pier: did you understand that you must switch years halfway out (1998 deck, 2004 middle part, 1998 far end)?
    Who or what told you: Theo, Mara's remarks at the edges, the task bar, the help arrow or marker, H?
 6. Did the automatic help (an arrow after ~30 s, a spoken hint after ~60 s, a marker after ~90 s) come too early,
    too late, or about right? (It can be turned off in Settings.)
 7. The memory journal (J, or the pause menu): did you open it? Was it worth opening?
 8. Anything on screen that looked broken, covered something, or stayed too long?
 9. Air particles in the study and the snow: still distracting?
10. In one sentence: could a friend who never heard of the game finish chapter 1 alone?

Optional: the playtest build (Resurrection-V5-Playtest.html) records your play on this computer only, if you agree on
its first screen; you can download the record from the pause menu and send it.
`);
const zip = path.join(root, 'dist', NAME + '.zip'); fs.rmSync(zip, { force: true });
try { execFileSync('zip', ['-qrX', zip, NAME], { cwd: path.join(root, 'dist') }); console.log('wrote', path.relative(root, zip)); } catch (e) { console.log('zip not available; folder only'); }
console.log('wrote', path.relative(root, out), 'build', build);

function startHere3(build) {
  return `Resurrection V5 — RC3 playtest package (build ${build})

RC3 answers your RC2 playtest: the chain stall, the mouse, the photo dares, the duet, Shift, and the chapter 1 story.
  1. Double-click  Resurrection-V5.html  (Chrome, Edge, Firefox or Safari on a computer; no install, no internet).
     If an old save is offered, choose New game: chapter 1 has changed.
  2. Play at least until the bike ride reaches the lighthouse (chapters 1-3). Further if you like.
  3. Then answer CHAPTER-1-RETEST.txt (it covers chapters 1-3).

Mouse: click the scene to look around with the mouse (a dot shows where you look). Esc frees the pointer and pauses.
If you prefer a visible pointer all the time: Settings > Mouse > Free pointer (drag to look).
docs/V5-RC3-REPORT.md: what changed, what passed, what is not tested. docs/V5-RC3-STORY.md: the story analysis.
`;
}
function retest3(build) {
  return `RC3 retest (build ${build}) — please answer honestly, short is fine

Story (the reason RC3 exists)
 1. After the study, did you want to know who the girl in the folded photo was? Did that carry you into the town?
 2. When Theo spoke, did you understand who he is and why he matters? Did meeting him still feel random?
 3. On the pier, did the switching mean anything to you this time (whose part of the pier is whose)?
 4. When you became Elena, was it clear who you were and who June was? Did you care about them by the train?
 5. Did you still feel led by the nose, or did it feel like their story? Where exactly did it feel like a task list?

Things that blocked or annoyed you in RC2
 6. The bike chain: did you see what to do? (It now says hold E, no need to move; June fixes it herself after a while.)
 7. The mouse: was it clear when the mouse looks around and when you can click? Did Esc do what you expected?
 8. Photo dares: did you find the lighthouse and the kite? Did the gold frame / arrow help, or make it too easy?
 9. Did anything still look broken or go through something (the guitar duet was changed: they now sit side by side)?
10. Shift: did you notice you can speed up?

One sentence: is this closer to a story you would keep playing, or not yet? What would make you keep playing?
`;
}

function startHere4(build) {
  return `Resurrection V5 — R4 playable candidate (build ${build})

THE WHOLE GAME, OFFLINE. Nothing to install, no internet, no server.
  1. Double-click  Resurrection-V5.html  (Chrome, Edge, Firefox or Safari on a computer).
     If an old save is offered, choose New game: the game now begins in the prologue.
  2. Play from the beginning. The prologue (about 8-12 minutes by design), seven chapters and the epilogue.
     The target is 45-60 minutes in all; nobody has timed a person yet (see docs/R4-REPORT.md).
  3. Controls are taught as you go (W A S D, E, 1/2 for choices, Tab on the old pier, H for a hint, J for the journal).
     Esc pauses; the Settings menu has English/Chinese, subtitles, mouse mode and key remapping.
  4. Then answer PLAYTEST-QUESTIONS.txt (any file, or tell the developer).

The restore tool in the prologue is an INVENTED screen in an INVENTED archive. No real posts or people.

Read next: RESURRECTION_THEME.md (the competition theme and where it is in the game), docs/R4-REPORT.md (what changed, what passed,
what nobody has verified), docs/R4-SCRIPT.md (the prologue and epilogue in English and Chinese), docs/R4-BLOCKER-FIXES.md.
Resurrection-V5-Start.html has the doors (start, continue, technical demo, music, key scenes, feedback).
`;
}
function retest4(build) {
  return `R4 playtest (build ${build}) — please answer honestly, short is fine

The beginning
 1. After the kitchen scene, did you understand Mara's situation: what she wanted, why she left, that this was the last time?
 2. In the empty house, did you understand that Mom has died, without being told in so many words? Did the answering machine land?
 3. Did you want to open the computer? What made you want to (or not)?
 4. The restore tool: did you know what to do at each step? Did the repair feel like something you did, or something that happened?
 5. When you met June on the pier: who did you think she was? Did you want to follow her?
The middle
 6. Did you care about June and Elena by the train? By the lighthouse? When June left?
 7. The beam (chapter 3): could you find June and then the cottage without help? How long did it take?
 8. Did anything block you, hide something, or go through something?
The end
 9. In chapter 6, did you feel that Elena hurt June, without being asked to forgive her?
10. The epilogue: the letter and the unfolded photo. Did it feel like an ending to the whole game, or like an explanation?
11. What does "resurrection" mean after playing: what came back, and what did not?
12. How long did you play, and where did you stop to think, get bored, or get stuck?
`;
}
