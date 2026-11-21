# V5 local testing (local first, CI to confirm)

The same checks as GitHub CI (`.github/workflows/test.yml`) can run on your own machine, in the background, with a
timeout per step, one log per step, and Playwright's failure screenshots, traces and videos. The runner is
`tools/v5-run.mjs`. Local results are kept in `test-runs/` (git-ignored) and are always labelled LOCAL. They are never
mixed with CI results: `npm run v5:ci` reads GitHub's own record.

## Commands

| What | Command |
|------|---------|
| Node tests + Node-shell playthroughs (foreground, about 1 min) | `npm run test:quick` |
| Real Chromium: the RC2 guide suite (background) | `npm run test:guide` |
| Everything CI runs for V5 (background) | `npm run test:full:local` |
| Where the current run is, step by step | `npm run v5:status` |
| Log of the current step (live) | `npm run v5:logs -- --follow` |
| Log of step N, last 200 lines | `npm run v5:logs -- --step N --lines 200` |
| Stop the run and everything it started | `npm run v5:stop` |
| All local runs on this machine | `npm run v5:runs` |
| Latest GitHub CI runs of this branch (separate) | `npm run v5:ci` |

`status`, `logs` and `stop` take an optional run id (`npm run v5:status -- <id>`); without one they use the latest run.

## What each suite runs

| Suite | Steps | Timeout per step | CI job it mirrors |
|-------|-------|------------------|-------------------|
| `quick` | `npm test`; `v5-shell-run.mjs` EN, ZH+alt, tech, single-file bundle, previews (end, snow), frame-time tour, kbm/pad/touch; guide audit (both branches); preview saves current | 5–10 min each | "Authoritative suite (npm test)" plus the Node-shell steps of the V5 jobs |
| `guide` | `playwright test e2e/v5-rc2.spec.js` | 90 min | part of "V5 RC1/RC2 review pages, first-time player guide" |
| `full` | `quick`, then `e2e/v5.spec.js` without device tests (150 min); device kbm, pad, touch (100 min each); `e2e/v5-rc.spec.js e2e/v5-rc2.spec.js` (120 min) | as listed | "V5 full game", "V5 whole game on one input device (kbm/pad/touch)", "V5 RC1/RC2 review pages" |

The P5 slice and the older P3/P4 browser tests are not in `full`; they are CI-only (the P5 failure is a known baseline,
see `docs/V5-P5-BASELINE.md`).

Rules of a run:
- Every step runs in its own process group. On timeout or `stop`, the whole tree (server, Chromium, Node) is killed and
  the step is recorded as `timeout` or `stopped`.
- Every browser step gets a free port (`E2E_PORT`) and its own output folder (`E2E_OUT`), so two runs never share a
  server or overwrite each other's reports.
- In `full`, all quick steps always run. If one of them fails, the browser steps are skipped (a broken core makes
  browser results meaningless). `--keep-going` runs them anyway: `node tools/v5-run.mjs start full --keep-going`.
- Assertions are the same as in CI. The runner changes no test and sets no `CI` variable (so screenshots are not
  printed into the logs as base64; they are in the Playwright output folder instead).

## Background runs

`test:guide` and `test:full:local` start a detached process in its own session and return at once. Closing the terminal
or the agent session does not stop the run. On macOS the runner also starts `caffeinate -i -w <pid>` so the Mac does
not sleep during the run (it ends with the run).

Each run is recorded in `test-runs/<id>/`:

| File | Contents |
|------|----------|
| `run.json` | suite, state (`running`, `passed`, `failed`, `stopped`), PID, start/end time, git commit and branch, dirty flag, each step with exit code, seconds and state |
| `runner.log` | the runner's own timeline |
| `step-NN-<name>.log` | full output of step NN |
| `out/<step>/test-results/` | Playwright failure screenshots, traces (`npx playwright show-trace …/trace.zip`), videos |
| `out/<step>/playwright-report/` | HTML report (`npx playwright show-report test-runs/<id>/out/<step>/playwright-report`) |
| `summary.md` | the result table, labelled LOCAL |

`test-runs/history.jsonl` keeps one line per finished run.

If the runner process disappears without finishing (the Mac slept without `caffeinate`, a reboot, a killed process),
`status` says **CRASHED** instead of RUNNING; it checks that the PID still belongs to this run's runner, not just that the
number exists. `npm run v5:stop` then marks the run stopped and kills what is left of its last step.

Verified so far (Linux sandbox, 2026-11-21): a `quick` run whose launching shell and process group were killed with
SIGKILL kept running, and `status`, `logs` and `summary.md` read from new processes showed it pass in 56 s. In the agent's
sandbox each command runs in its own short-lived container, so a run cannot outlive that one command there; it was
reported as CRASHED, which is how this check was found. On a normal Mac or Linux machine a background run is an ordinary
process and outlives the terminal.

## First time on a Mac (Apple silicon)

1. `npm install` in the repository (installs `@playwright/test`; the runner uses `npx --no-install` and never
   downloads anything itself).
2. `npx playwright install chromium` if Playwright's Chromium is not on the machine yet. The runner checks this before
   it starts and prints the exact command if it is missing.
3. `npm run test:quick` (foreground) to see that the core passes.
4. `npm run test:full:local`, then `npm run v5:status` whenever you want to see progress.

Not yet verified on macOS: the specs launch Chromium with `--use-angle=swiftshader` (software WebGL, as on the CI
runners). This flag set is documented for macOS too, but no run on a Mac has been recorded yet. If the first browser
step fails while creating the WebGL context, that is the place to look; please send the step log.

## Measured durations

| Where | Suite / step | Duration |
|-------|--------------|----------|
| Linux sandbox (8-core AMD EPYC), LOCAL | `quick` | 56 s |
| GitHub-hosted runner, CI | V5 full game job | about 74 min |
| GitHub-hosted runner, CI | device kbm / pad / touch | 21–54 / 8–14 / 11–15 min |
| GitHub-hosted runner, CI | RC1/RC2 review pages + guide | about 27–35 min |
| Mac M4 | any browser step | not measured yet |

`npm run v5:status` shows the CI reference time next to each running browser step for orientation. Your own times are
then in `run.json` and `history.jsonl`.

## Local PASS vs CI PASS

A local PASS means the checks passed on that machine at the recorded commit (and the `dirty` flag says whether there were
uncommitted changes). It is not a CI PASS. Before a release, one GitHub CI run on the pushed commit is still required,
and reports quote both separately.

## Building and checking the RC2 package

| What | Command |
|------|---------|
| Build the single-file pages, the playtest folder and the RC2 zip, then check the zip | `npm run v5:rc2` (needs a clean tree: the build id in the pages is the commit hash) |
| Check any package zip again | `node tools/v5-verify-package.mjs dist/resurrection-v5-rc2.zip --commit <short hash>` |
| Play the script of one shipped page in the Node shell | `node tools/v5-shell-run.mjs --quiet --html path/to/Resurrection-V5.html [--lang zh --alt]` |

`tools/v5-rc2-pack.mjs` takes the RC1 review build (`tools/v5-rc-pack.mjs`) and adds the RC2 report, this document,
`START-HERE.txt` and `CHAPTER-1-RETEST.txt`; it writes `dist/resurrection-v5-rc2/` and `dist/resurrection-v5-rc2.zip`
(`dist/` is git-ignored, the zip is not committed). `tools/v5-verify-package.mjs` unzips into a new temporary folder and
checks only the extracted files: expected files, no request outside the folder, links between pages (including the ones
the start page builds in script), inline scripts parse, one build id everywhere, and the extracted game page played from
the title to the credits in English and in Chinese. It replaces only three.js's WebGL layer; it does not show that a
browser draws the page. Opening the extracted `Resurrection-V5.html` in a real browser is still a manual step.
