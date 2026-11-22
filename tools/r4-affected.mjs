// Which tests does this change need? Reads the files changed since a commit (default: the last commit that is
// already pushed, else HEAD~1) plus the working tree, and maps them to the smallest set of checks that can tell.
//
//   node tools/r4-affected.mjs              print the plan
//   node tools/r4-affected.mjs --run        run it (stops at the first failure)
//   node tools/r4-affected.mjs --since <rev>
//
// Rules (first match wins for a file, all matches are added up):
//   docs, reports, screenshots, releases, markdown, test-runs ... nothing (never a whole-game test)
//   prologue / epilogue files (prologue.js, kitchen.js, i18n-r4.js, layout.js, study.js, objectives.js) ... node tests + prologue + epilogue in Chromium
//   beam files (scenes.js, town.js) ......... node tests + the two beam checks
//   game.js, main.js, guide.js, people.js ... node tests + Node shell + every R4 Chromium check (about 7 minutes)
//   tests, tools, bot ....................... node tests + Node shell
//   anything else under frontend/ ........... node tests + Node shell
// The whole-game tests in CI (the full suite) are never chosen here: they run once, when the version is frozen.
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2); const RUN = args.includes('--run');
const si = args.indexOf('--since');
const sh = (...a) => { try { return execFileSync('git', a, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };
const since = si >= 0 ? args[si + 1] : (sh('rev-parse', '--verify', '@{u}') || 'HEAD~1');
const files = [...new Set([...sh('diff', '--name-only', since, 'HEAD').split('\n'), ...sh('diff', '--name-only', 'HEAD').split('\n'), ...sh('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))];

const NOTHING = /^(docs\/|release\/|test-runs\/|dist\/|.*\.md$|LICENSE$|\.gitignore$|frontend\/v5\/rc\/shots\/)/;
const PROLOGUE = /^frontend\/v5\/(core\/(prologue|i18n-r4|chapters)\.js|render\/kitchen\.js)$/;
const BEAM = /^frontend\/v5\/render\/(scenes|town)\.js$/;
const CENTRAL = /^frontend\/v5\/(main|guide|home)\.js$|^frontend\/v5\/core\/(game|objectives|layout|journal|companion|physics|toys)\.js$|^frontend\/v5\/render\/(people|people-p4|study|audio)\.js$/;
const need = new Set(); const why = [];
for (const f of files) {
  if (NOTHING.test(f)) { continue; }
  need.add('node'); why.push(f);
  if (PROLOGUE.test(f)) { need.add('prologue'); need.add('epilogue'); }
  else if (BEAM.test(f)) { need.add('beam'); }
  else if (CENTRAL.test(f)) { need.add('shell'); need.add('prologue'); need.add('epilogue'); need.add('beam'); need.add('chase'); }
  else if (/^(test|tools|e2e)\//.test(f) || /^frontend\//.test(f)) { need.add('shell'); }
}
const STEPS = {
  node: ['npm test'],
  shell: ['node tools/v5-lint-swallowed.mjs', 'node tools/v5-preview-saves.mjs --check', 'node tools/v5-shell-run.mjs --quiet'],
  prologue: ['node tools/r4-browser.mjs prologue'],
  epilogue: ['node tools/r4-browser.mjs epilogue'],
  beam: ['node tools/r4-browser.mjs beam town-beam'],
  chase: ['node tools/r4-browser.mjs chase train chain']
};
const order = ['node', 'shell', 'prologue', 'epilogue', 'beam', 'chase'].filter((k) => need.has(k));
console.log(`changed since ${since}: ${files.length} file(s), ${why.length} that can change the game`);
if (!order.length) { console.log('nothing to run: documents, reports, screenshots and releases never need a game test'); process.exit(0); }
const cmds = order.flatMap((k) => STEPS[k]);
cmds.forEach((c) => console.log('  ' + c));
if (!RUN) { process.exit(0); }
for (const c of cmds) {
  const t0 = Date.now(); const r = spawnSync(c, { shell: true, stdio: 'inherit' });
  console.log(`-- ${c}: ${r.status === 0 ? 'ok' : 'FAILED'} in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (r.status !== 0) { process.exit(r.status || 1); }
}
