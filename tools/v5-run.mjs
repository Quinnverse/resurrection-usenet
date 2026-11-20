// Local test runner for Resurrection V5: runs the same checks as GitHub CI on this machine, in the background, with a
// timeout for every step, a log per step, screenshots and reports from Playwright, and a record of what ran.
//
//   node tools/v5-run.mjs start quick|guide|full [--fg] [--keep-going]   start a run (in the background unless --fg)
//   node tools/v5-run.mjs status [id]                                  where the run is, step by step
//   node tools/v5-run.mjs logs [id] [--step N] [--lines N] [--follow]  the log of the current (or a given) step
//   node tools/v5-run.mjs stop [id]                                    stop a run and everything it started
//   node tools/v5-run.mjs list                                         all local runs on this machine
//   node tools/v5-run.mjs ci                                           the latest GitHub CI runs of this branch (separate record)
//
// A background run is a detached process (its own session): closing the terminal or the agent session that started it
// does not stop it. On macOS it also holds `caffeinate` so the Mac does not sleep during the run.
// Everything is in test-runs/<id>/: run.json (state, PID, commit, steps, exit codes), runner.log, one log per step, and
// out/<step>/ with Playwright's test-results (failure screenshots, traces, videos) and HTML report.
// These are LOCAL results. They are never written into the CI record and are labelled LOCAL wherever they are printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(root, 'test-runs');
const SELF = fileURLToPath(import.meta.url);
const require = createRequire(path.join(root, 'package.json'));

// ---- what each suite runs (the same commands as .github/workflows/test.yml) -------------------------------------------
const shell = (name, args, min) => ({ name, cmd: `node tools/v5-shell-run.mjs ${args}`, timeoutMin: min || 10, required: true });
const pw = (name, args, min) => ({ name, cmd: `npx --no-install playwright test ${args}`, timeoutMin: min, browser: true });
const QUICK = [
  { name: 'node-tests', cmd: 'npm test', timeoutMin: 10, required: true },
  shell('shell-en', '--quiet'), shell('shell-zh-alt', '--quiet --lang zh --alt'), shell('shell-tech', '--tech', 5), shell('shell-bundle', '--quiet --bundle'),
  shell('shell-preview', '--quiet --preview end', 5), shell('shell-preview-snow', '--quiet --preview snow', 5), shell('shell-bench', '--quiet --bench low', 10),
  shell('shell-device-kbm', '--quiet --device kbm'), shell('shell-device-pad', '--quiet --device pad'), shell('shell-device-touch', '--quiet --device touch'),
  { name: 'guide-audit', cmd: 'node tools/v5-guide-audit.mjs && node tools/v5-guide-audit.mjs --alt', timeoutMin: 10, required: true },
  { name: 'preview-saves-current', cmd: 'node tools/v5-preview-saves.mjs --check', timeoutMin: 5, required: true }
];
const SUITES = {
  // checks the runner itself in a few seconds: a pass, a failure (exit 3) and a timeout that has to kill a whole process tree
  selftest: { about: 'the runner itself: a passing step, a failing step, a step that times out', steps: [
    { name: 'passes', cmd: 'echo ok', timeoutMin: 1, required: true }, { name: 'fails', cmd: 'echo failing; exit 3', timeoutMin: 1, required: true },
    { name: 'times-out', cmd: 'sh -c "sleep 300" & sleep 300', timeoutMin: 0.05, required: true }] },
  quick: { about: 'Node tests, the real main.js in the Node shell (both languages, single-file build, previews, frame-time tour, three input devices), the guide audit', steps: QUICK },
  guide: { about: 'real Chromium: chapter 1 in two orders (video), the pier and Tab, the task bar, notes going away, the journal, save and continue, pad/touch/Chinese guide', steps: [pw('chromium-guide', 'e2e/v5-rc2.spec.js', 90)] },
  full: {
    about: 'quick, then real Chromium: the whole game EN and ZH with the guide checked every frame, every beat, remap, touch, pad and keyboard menus, audio, tech; the whole game with only keyboard+mouse, only a simulated pad, only emulated touch; the RC1 and RC2 suites',
    steps: QUICK.concat([
      pw('chromium-main', 'e2e/v5.spec.js --grep-invert "device: "', 150),
      pw('chromium-device-kbm', 'e2e/v5.spec.js --grep "device: kbm"', 100),
      pw('chromium-device-pad', 'e2e/v5.spec.js --grep "device: pad"', 100),
      pw('chromium-device-touch', 'e2e/v5.spec.js --grep "device: touch"', 100),
      pw('chromium-rc1-rc2', 'e2e/v5-rc.spec.js e2e/v5-rc2.spec.js', 120)
    ])
  }
};
// GitHub-hosted runner durations of the same steps (for orientation before the first local run; not this machine)
const CI_REFERENCE_MIN = { 'chromium-main': 74, 'chromium-device-kbm': 36, 'chromium-device-pad': 12, 'chromium-device-touch': 15, 'chromium-rc1-rc2': 27, 'chromium-guide': 22 };

// ---- small helpers -------------------------------------------------------------------------------------------------
const now = () => new Date().toISOString();
const alive = (pid) => { if (!pid) { return false; } try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return null; } };
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJSON = (f, v) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2)); fs.renameSync(t, f); };
const runDir = (id) => path.join(RUNS, id);
const runFile = (id) => path.join(runDir(id), 'run.json');
const fmt = (s) => { if (s == null) { return '–'; } s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h${String(m).padStart(2, '0')}m` : m ? `${m}m${String(x).padStart(2, '0')}s` : `${x}s`; };
const since = (iso, end) => (iso ? ((end ? new Date(end) : new Date()) - new Date(iso)) / 1000 : null);
function allRuns() { if (!fs.existsSync(RUNS)) { return []; } return fs.readdirSync(RUNS).filter((d) => fs.existsSync(runFile(d))).sort().map((d) => readJSON(runFile(d), null)).filter(Boolean); }
function liveState(r) {
  if ((r.state === 'running' || r.state === 'starting') && !alive(r.pid) && (r.state === 'running' || since(r.createdAt) > 20)) { return 'crashed'; }   // the process is gone without recording an end
  return r.state;
}
function pick(id) { const rs = allRuns(); if (id) { const r = rs.find((x) => x.id === id || x.id.startsWith(id)); if (!r) { die('no local run ' + id); } return r; } if (!rs.length) { die('no local runs yet. Start one: npm run test:full:local'); } return rs[rs.length - 1]; }
function die(m) { console.error(m); process.exit(1); }
const freePort = (start) => new Promise((resolve) => { const tryP = (p) => { const s = net.createServer(); s.once('error', () => tryP(p + 1)); s.once('listening', () => s.close(() => resolve(p))); s.listen(p, '127.0.0.1'); }; tryP(start); });
function machine() {
  const c = os.cpus(); let pwv = null; try { pwv = require('@playwright/test/package.json').version; } catch (e) { pwv = null; }
  return { platform: process.platform, arch: process.arch, os: `${os.type()} ${os.release()}`, cpu: c[0] ? c[0].model : null, cores: c.length, memGB: Math.round(os.totalmem() / 1073741824), node: process.version, playwright: pwv, host: os.hostname() };
}
// For browser suites: Playwright installed in this repository, and its Chromium on this machine (nothing is downloaded)
function preflight(steps) {
  const problems = [];
  if (!steps.some((s) => s.browser)) { return { ok: true, problems, chromium: null }; }
  let chromium = null;
  try { require.resolve('@playwright/test'); } catch (e) { problems.push('Playwright is not installed in this repository: run  npm install'); }
  if (!problems.length) {
    try { const { chromium: c } = require('@playwright/test'); chromium = c.executablePath(); if (!fs.existsSync(chromium)) { problems.push(`Playwright's Chromium is not on this machine (${chromium}): run  npx playwright install chromium`); } } catch (e) { problems.push('could not ask Playwright for its Chromium: ' + e.message); }
  }
  return { ok: !problems.length, problems, chromium };
}

// ---- start ---------------------------------------------------------------------------------------------------------
async function start(suite, flags) {
  const S = SUITES[suite]; if (!S) { die(`unknown suite "${suite}" (quick, guide, full)`); }
  const active = allRuns().find((r) => liveState(r) === 'running');
  if (active) { die(`a local run is still going: ${active.id} (PID ${active.pid}). See it with  npm run v5:status  or stop it with  npm run v5:stop`); }
  const pre = preflight(S.steps); if (!pre.ok) { die('cannot start:\n  ' + pre.problems.join('\n  ')); }
  const sha = git('rev-parse', 'HEAD') || 'unknown'; const dirty = !!git('status', '--porcelain');
  const stamp = now().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const id = `${stamp}-${suite}-${sha.slice(0, 7)}${dirty ? '-dirty' : ''}`;
  fs.mkdirSync(runDir(id), { recursive: true });
  const prev = lastDurations(suite);
  const run = {
    id, kind: 'local', label: 'LOCAL (this machine, not GitHub CI)', suite, about: S.about, commit: sha, commitSubject: git('log', '-1', '--format=%s'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), dirty,
    machine: machine(), chromium: pre.chromium, createdAt: now(), startedAt: null, endedAt: null, state: 'starting', pid: null, keepGoing: !!flags.keepGoing, current: null,
    steps: S.steps.map((s, i) => ({ i: i + 1, name: s.name, cmd: s.cmd, timeoutMin: s.timeoutMin, required: !!s.required, browser: !!s.browser, state: 'waiting', log: `step-${String(i + 1).padStart(2, '0')}-${s.name}.log`, expectSec: prev[s.name] || (CI_REFERENCE_MIN[s.name] ? CI_REFERENCE_MIN[s.name] * 60 : null), expectFrom: prev[s.name] ? 'last passing local run' : (CI_REFERENCE_MIN[s.name] ? 'GitHub CI runner' : null) }))
  };
  writeJSON(runFile(id), run);
  if (flags.fg) { console.log(`LOCAL run ${id} (foreground)`); process.exitCode = await execute(id); return; }
  const out = fs.openSync(path.join(runDir(id), 'runner.log'), 'a');
  const child = spawn(process.execPath, [SELF, '__run', id], { cwd: root, detached: true, stdio: ['ignore', out, out], env: process.env });
  child.unref(); run.pid = child.pid; writeJSON(runFile(id), run);   // known at once, even if the runner were to die before it writes anything
  if (process.platform === 'darwin') { try { spawn('caffeinate', ['-i', '-w', String(child.pid)], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { /* not available */ } }
  console.log(`LOCAL run started in the background: ${id}`);
  console.log(`  PID ${child.pid} · commit ${sha.slice(0, 7)}${dirty ? ' (with uncommitted changes)' : ''} · ${S.steps.length} steps`);
  console.log(`  folder  ${path.relative(root, runDir(id))}/`);
  const est = run.steps.reduce((a, s) => a + (s.expectSec || 0), 0); if (est) { console.log(`  expected about ${fmt(est)} (${prev && Object.keys(prev).length ? 'from the last passing run on this machine' : 'browser steps from GitHub CI runner times; this machine may differ'})`); }
  console.log('  progress  npm run v5:status    log  npm run v5:logs -- --follow    stop  npm run v5:stop');
}
function lastDurations(suite) {
  const out = {}; allRuns().filter((r) => r.kind === 'local').forEach((r) => (r.steps || []).forEach((s) => { if (s.state === 'passed' && s.seconds) { out[s.name] = s.seconds; } })); void suite; return out;
}

// ---- the run itself (the detached process) -------------------------------------------------------------------------
let currentChild = null, stopping = false;
async function execute(id) {
  const file = runFile(id); const run = readJSON(file, null); if (!run) { die('no run ' + id); }
  if (run.state !== 'starting') { die(`run ${id} was already started (${run.state})`); }
  run.pid = process.pid; run.startedAt = now(); run.state = 'running'; writeJSON(file, run);
  const log = (m) => console.log(`[${now()}] ${m}`);
  const finish = (state) => { run.state = state; run.endedAt = now(); run.seconds = Math.round(since(run.startedAt, run.endedAt)); run.current = null; writeJSON(file, run); fs.appendFileSync(path.join(RUNS, 'history.jsonl'), JSON.stringify({ id: run.id, kind: 'local', suite: run.suite, commit: run.commit, dirty: run.dirty, state, startedAt: run.startedAt, endedAt: run.endedAt, seconds: run.seconds, machine: run.machine, steps: run.steps.map((s) => ({ name: s.name, state: s.state, seconds: s.seconds, exitCode: s.exitCode })) }) + '\n'); fs.writeFileSync(path.join(runDir(id), 'summary.md'), report(run)); log(`run ${state} after ${fmt(run.seconds)}`); };
  const onSignal = (sig) => { if (stopping) { return; } stopping = true; log(`${sig}: stopping`); killChild(); setTimeout(() => { const r = readJSON(file, run); const st = r.steps.find((s) => s.state === 'running'); if (st) { st.state = 'stopped'; st.endedAt = now(); st.seconds = Math.round(since(st.startedAt, st.endedAt)); } Object.assign(run, { steps: r.steps }); finish('stopped'); process.exit(130); }, 1500); };
  process.on('SIGTERM', () => onSignal('SIGTERM')); process.on('SIGINT', () => onSignal('SIGINT')); process.on('SIGHUP', () => { /* a closed terminal does not stop the run */ });
  log(`LOCAL run ${id}: ${run.suite} at ${run.commit.slice(0, 7)} on ${run.machine.cpu} (${run.machine.platform}/${run.machine.arch})`);
  for (const st of run.steps) {
    if (stopping) { break; }
    // the quick steps all run (they are cheap and each says something); the long browser steps are skipped when one of
    // them failed, because a broken core makes the browser results meaningless (--keep-going runs them anyway)
    if (st.browser && !run.keepGoing && run.steps.some((x) => x.required && ['failed', 'timeout'].includes(x.state))) { st.state = 'skipped'; writeJSON(file, run); continue; }
    const env = Object.assign({}, process.env, { FORCE_COLOR: '0', V5_LOCAL_RUN: id });
    let cmd = st.cmd;
    if (st.browser) {
      const port = await freePort(3999 + st.i * 10); env.E2E_PORT = String(port); env.E2E_OUT = path.join(runDir(id), 'out', st.name);
      cmd += ` --global-timeout=${(st.timeoutMin - 2) * 60000}`;
    }
    st.state = 'running'; st.startedAt = now(); st.cmdRun = cmd; run.current = st.i; writeJSON(file, run);
    log(`step ${st.i}/${run.steps.length} ${st.name}: ${cmd}  (timeout ${st.timeoutMin} min)`);
    const out = fs.openSync(path.join(runDir(id), st.log), 'a'); fs.writeSync(out, `# ${now()} ${cmd}\n# LOCAL run ${id}, commit ${run.commit}\n`);
    const code = await new Promise((resolve) => {
      const child = spawn('/bin/sh', ['-c', cmd], { cwd: root, env, detached: true, stdio: ['ignore', out, out] }); currentChild = child; st.pgid = child.pid; writeJSON(file, run);
      const timer = setTimeout(() => { st.timedOut = true; fs.writeSync(out, `\n# TIMEOUT after ${st.timeoutMin} min: stopping the step\n`); killChild(); }, st.timeoutMin * 60000);
      child.on('exit', (c, sig) => { clearTimeout(timer); currentChild = null; resolve(c === null ? (sig ? 128 + (os.constants.signals[sig] || 1) : 1) : c); });
      child.on('error', (e) => { clearTimeout(timer); fs.writeSync(out, `\n# could not start: ${e.message}\n`); resolve(127); });
    });
    fs.closeSync(out);
    if (stopping) { return 130; }
    st.endedAt = now(); st.seconds = Math.round(since(st.startedAt, st.endedAt)); st.exitCode = code; st.state = st.timedOut ? 'timeout' : code === 0 ? 'passed' : 'failed';
    st.lastLine = lastProgress(path.join(runDir(id), st.log));
    writeJSON(file, run); log(`step ${st.i} ${st.name}: ${st.state.toUpperCase()} in ${fmt(st.seconds)} (exit ${code})`);
  }
  const state = run.steps.every((s) => s.state === 'passed') ? 'passed' : 'failed';
  finish(state); return state === 'passed' ? 0 : 1;
}
function killChild() {
  const c = currentChild; if (!c) { return; }
  try { process.kill(-c.pid, 'SIGTERM'); } catch (e) { /* gone */ }
  setTimeout(() => { try { process.kill(-c.pid, 'SIGKILL'); } catch (e) { /* gone */ } }, 10000).unref();
}
function lastProgress(f) {
  try {
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => /✓|✘|passed|failed|flaky|"ok":|# (tests|pass|fail)|TIMEOUT|Error/.test(l));
    return (lines[lines.length - 1] || '').replace(/\s+/g, ' ').slice(0, 200);
  } catch (e) { return ''; }
}

// ---- status, logs, stop, list, report -------------------------------------------------------------------------------
function status(id) {
  const r = pick(id); const state = liveState(r); const icon = { passed: '✓', failed: '✗', running: '▶', waiting: '·', skipped: '–', timeout: '⏱', stopped: '■' };
  console.log(`${r.label}`);
  console.log(`run      ${r.id}`);
  console.log(`suite    ${r.suite}: ${r.about}`);
  console.log(`commit   ${r.commit.slice(0, 7)}${r.dirty ? ' + uncommitted changes' : ''}  ${r.commitSubject || ''}`.slice(0, 160));
  console.log(`machine  ${r.machine.cpu}, ${r.machine.cores} cores, ${r.machine.memGB} GB, ${r.machine.os}, Node ${r.machine.node}, Playwright ${r.machine.playwright || '–'}`);
  console.log(`state    ${state.toUpperCase()}${state === 'crashed' ? ' (the runner process is gone without finishing: the machine slept, rebooted or the process was killed)' : ''}   PID ${r.pid || '–'}   started ${r.startedAt || r.createdAt}   ${r.endedAt ? 'took ' + fmt(r.seconds) : 'running for ' + fmt(since(r.startedAt))}`);
  let remain = 0;
  r.steps.forEach((s) => {
    const dur = s.seconds != null ? fmt(s.seconds) : s.state === 'running' ? fmt(since(s.startedAt)) + '…' : '';
    const exp = s.expectSec ? ` (expected ~${fmt(s.expectSec)}${s.expectFrom === 'GitHub CI runner' ? ' on a CI runner' : ''})` : '';
    if (s.state === 'waiting') { remain += s.expectSec || 0; } if (s.state === 'running' && s.expectSec) { remain += Math.max(0, s.expectSec - since(s.startedAt)); }
    console.log(`  ${icon[s.state] || '?'} ${String(s.i).padStart(2)} ${s.name.padEnd(24)} ${s.state.padEnd(8)} ${dur.padEnd(9)}${s.state === 'waiting' || s.state === 'running' ? exp : (s.exitCode != null ? ` exit ${s.exitCode}` : '')}`);
    if (s.state === 'running') { const lp = lastProgress(path.join(runDir(r.id), s.log)); if (lp) { console.log(`       latest: ${lp}`); } }
    if (s.state === 'failed' || s.state === 'timeout') { console.log(`       log: ${path.relative(root, path.join(runDir(r.id), s.log))}${s.browser ? `   screenshots and report: ${path.relative(root, path.join(runDir(r.id), 'out', s.name))}/` : ''}`); if (s.lastLine) { console.log(`       last: ${s.lastLine}`); } }
  });
  if (state === 'running' && remain) { console.log(`about ${fmt(remain)} left (estimate)`); }
  console.log('GitHub CI is a separate record: npm run v5:ci');
}
function logs(id, flags) {
  const r = pick(id); const n = flags.lines || 40;
  const st = flags.step ? r.steps.find((s) => s.i === Number(flags.step)) : (r.steps.find((s) => s.state === 'running') || [...r.steps].reverse().find((s) => s.state !== 'waiting' && s.state !== 'skipped'));
  const f = st ? path.join(runDir(r.id), st.log) : path.join(runDir(r.id), 'runner.log');
  console.log(`== LOCAL ${r.id} · ${st ? `step ${st.i} ${st.name} (${st.state})` : 'runner'} · ${path.relative(root, f)}`);
  const tail = () => { try { return fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^V5_SHOT /.test(l)); } catch (e) { return []; } };
  const lines = tail(); console.log(lines.slice(-n).join('\n'));
  if (!flags.follow) { return; }
  let shown = lines.length; const iv = setInterval(() => { const l = tail(); if (l.length > shown) { process.stdout.write(l.slice(shown).join('\n') + '\n'); shown = l.length; } const rr = readJSON(runFile(r.id), r); if (liveState(rr) !== 'running' || (st && readJSON(runFile(r.id), r).steps[st.i - 1].state !== 'running')) { clearInterval(iv); console.log(`== ${liveState(rr) === 'running' ? 'step finished; run  npm run v5:logs -- --follow  again for the next step' : 'run ' + liveState(rr)}`); } }, 1000);
}
function stop(id) {
  const r = pick(id); const state = liveState(r);
  if (state !== 'running' && state !== 'crashed') { console.log(`run ${r.id} is not running (${state})`); return; }
  if (alive(r.pid)) { process.kill(r.pid, 'SIGTERM'); console.log(`asked run ${r.id} (PID ${r.pid}) to stop; it stops its current step and records "stopped"`); return; }
  const st = r.steps.find((s) => s.state === 'running'); if (st && st.pgid) { try { process.kill(-st.pgid, 'SIGTERM'); } catch (e) { /* gone */ } }
  r.state = 'stopped'; r.endedAt = now(); if (st) { st.state = 'stopped'; } writeJSON(runFile(r.id), r); console.log(`run ${r.id}: the runner was already gone; its last step was stopped and the run marked stopped`);
}
function list() {
  const rs = allRuns(); if (!rs.length) { console.log('no local runs yet'); return; }
  console.log('LOCAL runs on this machine (not GitHub CI)');
  rs.forEach((r) => { const st = liveState(r); const passed = r.steps.filter((s) => s.state === 'passed').length; console.log(`  ${r.id.padEnd(44)} ${st.padEnd(8)} ${String(passed).padStart(2)}/${r.steps.length} steps  ${r.seconds ? fmt(r.seconds) : fmt(since(r.startedAt))}`); });
}
function report(r) {
  const L = [`# LOCAL test run ${r.id}`, '', `**${r.label}.** Not a GitHub CI result.`, '', `- suite: ${r.suite} (${r.about})`, `- commit: ${r.commit}${r.dirty ? ' (with uncommitted changes)' : ''}`, `- machine: ${r.machine.cpu}, ${r.machine.cores} cores, ${r.machine.memGB} GB, ${r.machine.os}, Node ${r.machine.node}, Playwright ${r.machine.playwright || '–'}`, `- started ${r.startedAt}, ended ${r.endedAt}, ${fmt(r.seconds)}, result **${String(r.state).toUpperCase()}**`, '', '| # | Step | Result | Time | Exit |', '|---|---|---|---|---|'];
  r.steps.forEach((s) => L.push(`| ${s.i} | ${s.name} | ${s.state} | ${s.seconds != null ? fmt(s.seconds) : '–'} | ${s.exitCode != null ? s.exitCode : '–'} |`));
  return L.join('\n') + '\n';
}
function ci() {
  console.log('GitHub CI (separate from local runs)');
  const br = git('rev-parse', '--abbrev-ref', 'HEAD'); const url = 'https://github.com/Quinnverse/resurrection-usenet/actions?query=branch%3A' + encodeURIComponent(br || '');
  try {
    const out = execFileSync('gh', ['api', `repos/Quinnverse/resurrection-usenet/actions/runs?branch=${br}&per_page=3`, '--jq', '.workflow_runs[]|[.id,.head_sha[0:7],.status,(.conclusion//"-"),.created_at]|@tsv'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    out.split('\n').forEach((l) => { const [rid, sha, st, con, at] = l.split('\t'); console.log(`  run ${rid}  ${sha}  ${st}/${con}  ${at}`); });
    const first = out.split('\t')[0];
    if (first) { const jobs = execFileSync('gh', ['api', `repos/Quinnverse/resurrection-usenet/actions/runs/${first}/jobs?per_page=50`, '--jq', '.jobs[]|[.name,.status,(.conclusion//"-")]|@tsv']).toString().trim(); jobs.split('\n').forEach((l) => console.log('    ' + l.replace(/\t/g, '  '))); }
  } catch (e) { console.log('  (the GitHub CLI is not available here) ' + url); }
}

// ---- command line ----------------------------------------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const flags = { fg: rest.includes('--fg'), keepGoing: rest.includes('--keep-going'), follow: rest.includes('--follow') || rest.includes('-f') };
const val = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
flags.step = val('--step'); flags.lines = val('--lines') ? Number(val('--lines')) : null;
const pos = rest.filter((x, i) => !x.startsWith('-') && !['--step', '--lines'].includes(rest[i - 1]));
if (cmd === 'start') { await start(pos[0], flags); }
else if (cmd === '__run') { process.exitCode = await execute(pos[0]); }
else if (cmd === 'status') { status(pos[0]); }
else if (cmd === 'logs') { logs(pos[0], flags); }
else if (cmd === 'stop') { stop(pos[0]); }
else if (cmd === 'list') { list(); }
else if (cmd === 'ci') { ci(); }
else { console.log(fs.readFileSync(SELF, 'utf8').split('\n').filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); }
