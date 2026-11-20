# P5 browser job: baseline comparison

Question: is the failing CI job "Browser end-to-end, P5 slice" a regression introduced by V5?

**Answer: no.** The same 5 of 10 P5 tests fail with the same errors on the commit V5 started from, on the P5 branch
itself, and on the V5 branch. V5 changes no P5 file except a two-line camera/boat tweak that was cherry-picked from the
P5 branch (58e2361), and the baseline without that tweak fails identically.

| Run | Commit | Branch | P5 result |
|---|---|---|---|
| 44356545033 | 1c6cb0b | `p5-narrative-gameplay` (last pushed P5 commit) | 5 fail / 5 pass |
| 44359489831 | f69fa3b | `design/resurrection-v5` (V5 branch point, no V5 code) | 5 fail / 5 pass |
| 44473033172 | 992e055 | `feature/resurrection-v5-complete` | 5 fail / 5 pass |
| 44528076000 | e48dfe7 | `feature/resurrection-v5-complete` (after the input rewrite) | 5 fail / 5 pass |
| 44560809755 | a9a3358 | `feature/resurrection-v5-complete` | 5 fail / 5 pass |
| 44567880188 | e40b4ca | `feature/resurrection-v5-complete` | 5 fail / 5 pass |
| 44696534992 | e3be862 | `feature/resurrection-v5-complete` | 5 fail / 5 pass |
| 44708590327 | 0983c38 | `feature/resurrection-v5-complete` (the full run for RC1) | 5 fail / 5 pass, the same 5 tests and errors |

The same tests fail in all of them, with the same first error lines:

| # | P5 test | Error (identical in every run) |
|---|---|---|
| 1 | English full playthrough | `expect(received).toBeGreaterThanOrEqual(expected)`, `tutorial` stayed at 1 after the mouse-drag step (e2e/p5.spec.js:177) |
| 2 | Simplified Chinese chapter | `locator.click: Test timeout of 600000ms exceeded` |
| 3 | phone: touch stick, archive button, hold the hand | `locator.tap: Test timeout of 400000ms exceeded` |
| 7 | hints and the safe-spot menu | `locator.click: Test timeout of 240000ms exceeded` |
| 9 | reduced motion and settings kept | `locator.click: Test ended` |

Passing in all three: 4, 5, 6, 8, 10.

Files under `frontend/p5/` or `e2e/p5.spec.js` changed between f69fa3b and the V5 head: `frontend/p5/js/main.js` and
`frontend/p5/js/world-town.js`, one line each (commit 58e2361, "over-the-shoulder anomaly shot; move the boat out of the
pier view"). Since f69fa3b fails the same way without it, the failures were already there.

Not done, by instruction: fixing P5. The likely cause (a mouse-drag tutorial step and long timeouts under the software
GPU) should be looked at on the P5 branch, not in V5.

Run 44758500485 (commit b78e03b) did not run the P5 job: the push changed no game file, so the long jobs were skipped (see `V5-RC1-ACCEPTANCE.md`). P5 tests were never deleted, disabled or weakened.
