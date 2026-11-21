# Resurrection V5 — RC2: first-time playability

RC2 fixes what the owner's first play exposed: no teaching of the controls, no visible goal, an unexplained precondition at
the computer, getting lost after the first Tab, a boring stretch with no feedback, and white specks in the air. It adds no
story. Branch `feature/resurrection-v5-complete`; nothing merged, deployed or submitted.

Status words as before: **AUTOMATED PASS** (a machine check), **MANUAL PASS** (a person on real hardware: none yet),
**NOT TESTED**, **BLOCKED**.

## 0 · This build, in one page (read this first)

**What is delivered:** `resurrection-v5-rc2.zip`, built from the commit that contains this report. Its game code is identical to commit `4db8601`, the one GitHub CI ran in full; the commits after it change only documents, tools and the text of two start-page titles (`git diff 4db8601 HEAD -- frontend/v5` shows exactly that). No story or gameplay was added. Nothing was merged, deployed or submitted.

### 0.1 · What was actually fixed (changes to the game)

| # | Problem found | Fix | How it was found |
|---|---|---|---|
| 1 | Chapter 1: the computer needs a disk from the KEEP box; the line said only “that box” | the line names the box, the goal turns to “Find the backup disk”, a marker points at it | owner's first play; reproduced with `tools/v5-repro-ch1.mjs` |
| 2 | Chapter 1 pier: nobody taught “switch years halfway out”; Theo and Iris repeated unrelated lines; help fired only after 22 s without *any* input, so a walking player never got it | Theo explains it; Mara says what each edge is; the task bar follows the player's position; help counts time *without progress* (30/60/90 s) | owner's first play; reproduced in the core |
| 3 | A save made halfway along the pier showed “Switch to 1998” as not done | pier steps are monotone (a later step implies the earlier ones) | my own save/continue test |
| 4 | Touch buttons jumped to the top right in the town (CSS class `era` collided with the year label) | class renamed `can-tab` | Chromium touch screenshots |
| 5 | “✓ Done” and “New goal” notes stayed on screen for the rest of a beat | a `//` comment had swallowed the line that hides them (twice in `guide.js`); a done note is also cleared when the goal changes | whole-game Chromium check |
| 6 | Pause menu: Settings had moved to third place when the journal entry was added | Settings back in second place, journal last (the pad and keyboard menu tests walk Resume → Settings) | CI run 44791668074 |
| 7 | **The task bar, tips, aim hint and prompts were hidden in the train seat (68% of chapter 2 outside dialogue), on the bike (63%) and at the guitar (85% of the duet)** because those cameras were treated as cut-scenes | those three cameras count as play (`PLAY_SHOTS` in `main.js`) | whole-game Chromium check: “no step announced in chapter 2”; then measured in the Node shell |

### 0.2 · What was fixed only in the tests (the game did not change)

| Problem | Fix |
|---|---|
| The “note stays on screen” check in `tools/v5-shell-run.mjs` sat inside a `//` comment and never ran (third swallowed-comment case) | check restored; `tools/v5-lint-swallowed.mjs` plus a Node test now fail if any `//` has code after it (finds all four historic cases, none in the tree now) |
| The whole-game check measured “notes in a row”, so two different notes in a row looked like one stuck note (limit 150 frames, limit now 100 frames per *same* note; a note lasts 84 frames) | the same note and the same goal's badge are measured separately; limit lowered, not raised |
| The Node shell *printed* several values and never failed on them | now failing: stuck moments, all 20 beats, all 22 memories, task bar shown in play, player never off screen, prompts shown, every photo with its picture in the album, HUD visible in play. Shown to fail on a deliberate break: the task-bar check (task bar hidden), the memories check (chapter 3 memories removed) and the HUD check (old code). The other new checks were clean in every mode when added but were not broken on purpose |
| The pier Tab test waited a fixed 600 ms; on a CI runner at 4 fps (worst frame 4.3 s) the game had not read the key yet (failed once, on `f27b347`) | waits until 3 frames have run, same assertions |
| `status` could call a run RUNNING when its PID belonged to another process | a PID only counts as alive if it is this run's runner |

### 0.3 · Test results

**LOCAL = this sandbox (Linux, 8 cores). CI = GitHub Actions. They are separate records.**

| Check | Result | Where / evidence |
|---|---|---|
| `npm run test:quick` (Node tests 260/260, Node-shell whole game EN + ZH, single-file bundle, previews, frame-time tour, kbm/pad/touch, guide audit) | **LOCAL PASS**, 56 s, last on the final tree | `test-runs/` (git-ignored) |
| `npm run test:guide`, `npm run test:full:local` (real Chromium) | **NOT RUN here**: the sandbox has no Chromium and cannot install Playwright (npm and the Playwright CDN answer 403); the runner refuses to start and says so. **Not run on a Mac either** | `docs/V5-LOCAL-TESTING.md` |
| The zip, unzipped into a fresh folder: files present, no external requests, links exist, scripts parse, one build id, and **the extracted game page played from the title to the credits in English and in Chinese** | **LOCAL PASS**, 35/35 checks | `node tools/v5-verify-package.mjs dist/resurrection-v5-rc2.zip` |
| CI run `44876053433` on `4db8601` (the last run of the game code) | **9 of 10 jobs PASS; the old P5 job FAILS** (table below) | GitHub Actions |

CI run `44876053433`, job by job:

| Job | Result | What it ran | Time |
|---|---|---|---|
| Authoritative suite (npm test) | **PASS** | 260 Node tests | under 1 min |
| Container smoke | **PASS** | build, health, restart recovery, no tokens in logs | 1 min |
| Did the game change? | **PASS** | decides which long jobs run (game changed: yes) | 0 min |
| V5 full game (Playwright) | **PASS**, 14/14 tests | the whole game in English and in Chinese with the task bar compared with the real state in every frame (12,039 and 12,037 checks, 0 mismatches, 0 marker errors, 98 uses of a marker, a step note in every one of the 7 chapters, journal opened and closed in every chapter), key remapping, touch, pad menus, keyboard menus, audio, tech demo, old pages still load | 56 min |
| V5 RC1/RC2 review pages, first-time guide, packages | **PASS**, 15/15 tests | review tooling, single files opened from disk, owner start page, touch layout, chapter 1 path A and B, pier help at 30/60/90 s, save and continue halfway through a goal, Chinese guide, particles | 35 min |
| V5 whole game, keyboard + mouse only | **PASS** | the whole game through one input device | 33 min |
| V5 whole game, pad only (simulated) | **PASS** | same | 14 min |
| V5 whole game, touch only (emulated) | **PASS** | same | 15 min |
| Browser end-to-end (older pages) | **PASS** | the earlier browser suite | 24 min |
| Browser end-to-end, P5 slice | **FAIL, old (not V5)** | the same 5 of 10 P5 tests with the same error types as in `docs/V5-P5-BASELINE.md` (tests 1, 2, 3, 7, 9); fails identically on the P5 branch itself, before V5 existed | 30 min |

Workflow result: **failure**, caused only by the P5 job. No job was cancelled. **No V5 regression in this run; no infrastructure failure in this run.** P5 was not touched, because it is old code and outside this task.

Runs before it, for the record: on `f27b347` the whole-game English and Chinese Chromium tests, the RC review job and all three device jobs passed (12,040 task-bar checks in English and 12,046 in Chinese, no mismatch, every step note gone within 84 frames); its one failure was the pier Tab test described in 0.2, fixed in `4db8601`. On `457f256` the keyboard job failed with “The runner has received a shutdown signal”, which is infrastructure, not the game. The P5 job fails in every run since before V5 (`docs/V5-P5-BASELINE.md`); it is old code that V5 does not touch.

The commits made after `4db8601` (this report, the packer, the verifier, two titles) were pushed afterwards. They change no game file, so the long jobs are skipped for them by design; their light run is reported in the hand-over message, not here, because a report cannot contain the result of its own commit.

### 0.4 · The two chapter 1 paths, the Tab dead end, the HUD, saves

* **Two chapter 1 paths in real Chromium**: section 4.1 (CI run `44797009323`). Computer first reached the carving at 59 s; exploring first and then 95 s lost on the pier reached it at 160 s; neither had a stuck moment. Screenshots: `docs/v5-evidence/rc2/ch1-path-A-*`, `ch1-path-B-*`. The two videos are in that run's `resurrection-v5-rc-evidence` artifact (downloading artifacts is blocked from the sandbox, so they are not in the repository).
* **Tab dead end**: root cause in 4.2 (no deadlock; an unexplained spatial puzzle plus a help system that never spoke to a walking player). Verified by the core tests, by path B (the help arrow, the spoken hint and the marker appear at 30, 60 and 90 s: `ch1-path-B-help-level-1/2/3`), and by the pier Tab test.
* **HUD**: the task bar, tips and prompts must be visible whenever the player is in control. A cut-scene camera may hide them and is never required to show them: the three places that do (`5.depart` photo moment, `5.alone` platform photo, `7.town` seasons sequence) are exempt, and are listed in the Node-shell report as “story camera”. On the code before the fix the check fails (train 123, bike 117, guitar 8 + 124 checks); on the fixed code it finds 0.
* **Save and continue**: a save made at each step of the pier shows the same goal and the same steps done (Node test `saving halfway along the pier…` and a Chromium test `save and continue halfway through a goal`, in the RC review job); journal entries survive save and load.

### 0.5 · Known limits (what this does not show)

1. **No person has played RC2.** Everything above is machine checking. Whether the tips and the help feel right is exactly what the Owner's replay of chapter 1 has to answer.
2. **No real GPU, Safari, Firefox, real controller, real phone, real speakers.** CI uses Chromium with a software renderer at 4–10 frames per second.
3. **The zip itself was not opened in a browser by me.** The package check plays the extracted page's own script in Node, with only three.js's WebGL layer replaced, so it proves the shipped file contains a complete, working game, but not that a given browser draws it. CI's review job builds the packages from the pushed commit with the same scripts and opens the single-file pages from disk in Chromium.
4. **The local runner has never run a browser suite on a Mac**, and the software-GL flags used by the specs are unverified on macOS.
5. **The playtest page (`Resurrection-V5-Playtest.html`) is only checked structurally here**; the game page was played in full.
6. The pier is still a puzzle; chapters 2–7 got the task bar, help and journal but no content changes (section 5).

## 1 · What was actually wrong in chapter 1 (reproduced in the core)

`node tools/v5-repro-ch1.mjs` plays the three situations in the real game core and prints what happened. Before the fix:

| Situation | What the game did | Kind of problem |
|---|---|---|
| Straight to the computer, E again and again | Every press: “She never let me touch this computer.” / “insert the backup disk to continue.” / “A backup disk. She kept everything in **that box**…” Same answer each time (deterministic), but nothing said *which* box, the box was 5.2 m away and nothing marked it. | **Hidden precondition**: the disk in the KEEP box. Not a dead end, but unexplained. |
| Exploring first, then the computer | Opening the KEEP box gave the disk; the computer then worked. | Same story, different order: the difference the owner saw is the disk, which one path found by chance. |
| After Theo says “Press Tab”, talking to Theo and Iris | Theo: “The lamp is still out. Tradition.” Iris: “Fresh bread! The boat leaves tomorrow.” In both years, every time. | **No feedback / wrong guidance**: the two people in reach said nothing about the pier. |
| Walking out along the pier | 1998: the player stops silently at the end of the near deck (z 18.0). 2004: stops at the fence. Nothing says why. | **Hidden spatial puzzle**: the pier is only crossable by switching years *halfway out* (1998 near deck → 2004 middle section → 1998 far end). Nothing taught that. |
| Wandering around for 90 s | **No hint at all.** The automatic hint fired only after 22 s *without any input*; a lost player keeps walking, so it never fired. H worked, but nothing said H exists. | **Root cause of “completely stuck”**: the help system measured idleness, not lack of progress. |

There is **no state-machine deadlock** in chapter 1: every state has a way forward, and the automated playthroughs prove it.
The block was that the way forward was invisible. The Tab problem is the pier puzzle plus a help system that never spoke to a
moving player.

## 2 · What RC2 changes

| Area | Change | Where |
|---|---|---|
| **Task bar** (top left) | Chapter, goal, progress (e.g. 1/3), **Next:** what to do and how, with the player's own controls. “✓ Done: …” when a step is done, “New goal” when the goal changes. “Show steps” expands the list. Hidden in dialogue so it never covers faces or lines. | `frontend/v5/guide.js`, `core/objectives.js` |
| **Bound to the real state** | There is no quest data. Each step is a test on the same flags, dialogues, restorations and positions the story uses, for **all 20 beats of the 7 chapters**. Finished steps never come back (tested over a whole playthrough). The instruction follows where the player is (on the pier: fence, deck end, middle section, far end). | `core/objectives.js` |
| **Help that grows** | Time *without progress* (walking around does not count; dialogue and menus do not count): **30 s** an arrow at the screen edge toward the next place; **60 s** the companion says the next step and the task bar pulses; **90 s** the full hint and a marker over the place, plus “H · hint”. Any progress resets it. “Automatic help” can be turned off in Settings; H always works. | `core/objectives.js` (`track`), `guide.js` |
| **Tips, one at a time** | Walk (W A S D) → look → “when a name appears, press E” → where the goal is and H → holding E → Tab (only when Tab unlocks) → the journal (with the first memory) → Esc. Each tip ends when the player has done it. They name the player's keys after remapping, the pad buttons once a pad is used, or the on-screen buttons on a touch screen. “Tips” can be turned off (turning them on again starts them over). | `guide.js` |
| **Every instruction follows the controls** | 40 texts that named fixed keys (“hold E”, “Shift”, “right mouse”) now use tokens filled in at display time: remapping Use to F makes every hint say F; a pad says X / Y / LB…; touch says “the ⇄ button”. | `core/i18n-rc2.js`, `guide.js` |
| **Chapter 1 computer** | The disk line names the box: “the box marked KEEP, by the armchair”. After the computer asks, the goal becomes “Find the backup disk” with a marker on the box at once. Pressing E again gives the same answer. | `i18n-rc2.js`, `objectives.js`, `guide.js` |
| **Chapter 1 pier** | Theo now explains it after “Press Tab”: “The summer pier has a hole in the middle. The newer pier is only the middle. Walk out in one, switch, keep walking.” Talking to him on the pier repeats that. Pushing against the deck end, the 2004 fence or the end of the middle section makes Mara say what it is and which year to try. Iris no longer restarts her lines when the year changes. | `core/game.js` |
| **Memory journal** | 22 memories (19 found by the story itself, 3 optional for looking around), each with a title, the chapter, the year, the people, a short description and, for anything restored from the archive, its record: status, file, CRC-32, source and the state of every copy (e.g. `RESTORED · bridge.ll · crc32 a5055c02 · disk · [mirror: truncated, groups: stripped, disk: ok]`). The first snow is marked CREATED, not restored. A “New memory” note appears when one is found. Open with **J**, the pad's **D-pad ↑**, the **📖** touch button, or the pause menu. It never gates progress: a player who skips everything optional still finds all required memories (tested). | `core/journal.js`, `guide.js` |
| **Air particles** | The study had 140 bright square points through the room; now 46 faint, warm, round motes only in the sunbeam column. The 2004 cottage dust is halved and faint. Snow is round, white and larger, so it cannot be mistaken for dust. | `render/kit.js` (`softPoints`), `study.js`, `scenes.js`, `town.js` |
| **HUD in the played cameras** | Found by the Chromium whole-game check (no step announced in chapter 2): the train seat, the bike and the guitar cameras counted as cut-scenes, so the task bar, the tips, the aim hint and the prompts were hidden for 68% of chapter 2, 63% of the ride and 85% of the duet, outside any dialogue. These cameras now count as play. The Node shell fails a run if any beat hides the HUD outside dialogue for more than 20% of its frames. | `main.js` (`PLAY_SHOTS`), `tools/v5-shell-run.mjs` |
| **Touch layout** | The era button pushed the jump and E buttons up over the year label; every touch button now has a fixed place. The task bar is smaller on phones. | `index.html` |

## 3 · Goals of all seven chapters

Generated from a real playthrough of the core (`node tools/v5-objective-table.mjs`). ✓ = the step was seen done; → = the last
step, done by moving on to the next beat. “Marker” = how often the goal had a place to point at (seated scenes have none: the
activity itself is on screen).

| Ch | Beat | Goal | Steps (✓ = seen done in the playthrough; the last step of a beat is done by moving on) | Marker |
|---|---|---|---|---|
| 1 | 1.study | Open Mom’s game archive | ✓ Switch on Mom’s computer<br>✓ Find the backup disk<br>→ Load the disk | 100% of the time |
| 1 | 1.town | Bring back June’s bridge | ✓ Talk to Theo across the canal<br>✓ Restore the bridge from the archive<br>→ Meet Theo on this side | 100% of the time |
| 1 | 1.pier | Reach the end of the old pier | ✓ Switch to 1998<br>✓ Walk to the end of the 1998 deck<br>✓ Switch to 2004 over the gap<br>✓ Cross, then switch back to 1998<br>→ Touch the last post | 100% of the time |
| 1 | 1.carve | Carve the last post with June | ✓ Carve your initials | 100% of the time |
| 1 | 1.chase | Catch June’s train | ✓ Take June’s hand | 100% of the time |
| 2 | 2.train | June’s photo dares | ✓ Take a picture<br>✓ Photograph the lighthouse<br>✓ Photograph the kite<br>✓ Sit still while June draws you<br>✓ Photograph June when she isn’t looking<br>✓ Through the tunnel<br>→ Let June sleep | none (seated / camera) |
| 3 | 3.ride | Race June to the lighthouse | ✓ Ride after June along the coast<br>✓ Fix June’s chain<br>→ Ride on to the lighthouse<br>✓ Ride through June’s ribbons *(optional)* | none (seated / camera) |
| 3 | 3.yard | Light the lighthouse together | ✓ Take the window from June’s cart<br>✓ Fit the window into the lighthouse<br>✓ Pull the lens up to June<br>✓ Crank the lamp | 100% of the time |
| 3 | 3.beam | Find June with the beam | ✓ Find June<br>✓ Light the cottage on the beach | none (seated / camera) |
| 3 | 3.cliff | Get down to the cottage | ✓ Get down to the beach<br>→ Go into the cottage | 100% of the time |
| 4 | 4.cottage | June’s evening | ✓ Look at June’s portfolio<br>✓ Draw a boat<br>✓ Tune the guitar | 100% of the time |
| 4 | 4.duet | Play the song together | ✓ Play the melody<br>→ Play it once more | 15% of the time |
| 4 | 4.porch | Make a window of stars | ✓ Connect the five stars | none (seated / camera) |
| 5 | 5.depart | June’s last afternoon | ✓ Carry June’s suitcase to the train<br>✓ Walk with June to the end of the platform<br>✓ Talk to June<br>→ Say goodbye<br>✓ Two sodas from the machine *(optional)*<br>✓ A last photo of June *(optional)* | 44% of the time |
| 5 | 5.alone | Six years later | ✓ Sit on the bench<br>✓ Try the soda machine *(optional)* | 100% of the time |
| 6 | 6.cottage | Pack June’s cottage | ✓ Carry June’s boxes to the door<br>→ Talk to June<br>✓ Read the letter on the table *(optional)* | 100% of the time |
| 6 | 6.beach | Walk with June | ✓ Walk beside June until she speaks<br>✓ Keep walking with her<br>✓ Up to the dark lighthouse<br>→ Take the road home | 100% of the time |
| 7 | 7.study | Mom’s drafts | → Read the drafts on the computer | 100% of the time |
| 7 | 7.town | Let summer end | ✓ Read the 1998 sign<br>✓ Put June’s name back<br>✓ Give Iris her ending<br>✓ Untie Iris’s boat<br>✓ Restore the lighthouse lamp<br>✓ Make the seasons nobody made<br>✓ Turn the beam to the pier<br>✓ Lay new planks at the pier foot<br>→ Walk to the end of the pier | 83% of the time |
| 7 | end | The town is yours |  | none (seated / camera) |

Memories found in this playthrough: 22 of 22 (3 optional).

## 4 · Evidence

| What | Status | Evidence |
|---|---|---|
| Chapter 1, computer first: same answer on every press, the goal turns to the KEEP box, a marker on it | AUTOMATED PASS | `test/v5-rc2.test.mjs` (core) and `e2e/v5-rc2.spec.js` with real keys in Chromium; screenshots `rc2-02`, `rc2-03` |
| Chapter 1, exploring first: no dead end, never asked for a disk it already has, same next step | AUTOMATED PASS | `test/v5-rc2.test.mjs` |
| The pier: Theo explains it; fence, deck end and middle section say what to try; instruction follows position; Tab completes the steps | AUTOMATED PASS | `test/v5-rc2.test.mjs` |
| Wandering on the pier: help at 30, 60 and 90 s (arrow, spoken step, marker and H), reset by progress, off when turned off, dialogue does not count | AUTOMATED PASS | core tests; Chromium with a virtual clock, screenshots `rc2-07-pier-help-30s/60s/90s` |
| Tips one at a time, with real keys; remapping Use to F changes every instruction | AUTOMATED PASS | `e2e/v5-rc2.spec.js`, screenshots `rc2-01`, `rc2-06` |
| Gamepad and touch: the same instructions with their buttons; the task bar does not cover any touch button; the journal opens from the touch button | AUTOMATED PASS (simulated pad, emulated touch) | screenshots `rc2-08`, `rc2-09`, `rc2-10` |
| Chinese task bar, tips, journal | AUTOMATED PASS | screenshots `rc2-11`, `rc2-12` |
| Save in the middle of a goal and load it: same goal, same steps done | AUTOMATED PASS | `test/v5-rc2.test.mjs` |
| Journal: found as the story records it, kept through save and load, never lost, never required | AUTOMATED PASS | `test/v5-rc2.test.mjs` |
| Every goal, step and instruction exists in English and Chinese; every control token is a real control | AUTOMATED PASS | `test/v5-rc2.test.mjs`; the Node shell also checks the live task bar every 10 frames of the whole game |
| Whole game with only keyboard and mouse / only a pad / only touch, with the new HUD | AUTOMATED PASS (simulated pad, emulated touch) | CI jobs “V5 whole game on one input device” on `4db8601`, see 0.3 |
| Particles before and after | screenshots | before: `docs/v5-evidence/rc1/` (RC1 run, study and snow); after: `rc2-13-study-dust-after`, `rc2-14-snow-after` |
| A person who never saw the game understands the controls, the goal and the next step | **NOT TESTED** | needs the owner and other players |

Screenshots are from GitHub Actions Chromium with software rendering, in `docs/v5-evidence/rc2/`.

### 4.1 · Chapter 1 in real Chromium, two orders (screenshots from CI run 44797009323, commit e8ac70e; the same timeline was produced again on the final game code, run 44876053433, commit 4db8601: A 59 s, B 160 s, no stuck moment)

Both paths are played with real key presses (`e2e/v5-rc2.spec.js`, “chapter 1, path A / path B”); the timeline is what the
task bar said at each moment (game seconds on a virtual 30 fps clock, not human time). Video: `video.webm` of each test in
the run's `resurrection-v5-rc-evidence` artifact. Continuous screenshots (every 3 s in the run; every 15 s plus every named
moment copied here): `docs/v5-evidence/rc2/ch1-path-A-*.jpg`, `ch1-path-B-*.jpg`.

**Path A, computer first** (AUTOMATED PASS, reached 1.carve at 59 s, no step stuck):

| t | What the player did | Task bar “Next” afterwards |
|---|---|---|
| 0 s | start in the study | Walk to the desk and press E at the computer. |
| 3–8 s | E at the computer, three times (same answer each time) | It’s in the open box marked KEEP, by the armchair. E to open it. |
| 13 s | opened the KEEP box | Back to the desk: E at the computer. |
| 16 s | loaded the disk → town | Walk to the water and press E when his name appears. |
| 28 s | talked to Theo | Stand at the edge of the canal and hold E. |
| 32 s | restored the bridge | Theo is coming across. Wait for him. |
| 40 s | on the pier | Press Tab. In 1998 the near half of the pier is open. |
| 50 s | Tab → 1998 | Walk out along the pier until the planks stop. |
| 52 s | end of the 1998 deck | At the end of the deck press Tab: in 2004 a middle section covers the gap. |
| 53 s | Tab → 2004 | Walk along the 2004 section to its far end. |
| 55 s | end of the 2004 section, Tab → 1998 | Walk to the end and press E at the last post. |
| 59 s | the last post | Hold E at the post until the bar fills. (beat 1.carve) |

**Path B, explore first, then lost on the pier** (AUTOMATED PASS, reached 1.carve at 160 s including 95 s of deliberate
wandering, no step stuck):

| t | What the player did | Task bar “Next” / what the game did |
|---|---|---|
| 2–10 s | looked at the photo, drawing, shelf, window | Walk to the desk and press E at the computer. |
| 13 s | opened the KEEP box before the computer asked | Back to the desk: E at the computer. (never asks for a disk it already has) |
| 16–40 s | same as A | same as A |
| 51 s | walked into the 2004 fence | The 2004 pier is fenced off. Press Tab for 1998. Mara says so (`ch1-path-B-says-c1.mara.fence`) |
| 54 s | asked Theo | Theo explains the pier again (`ch1-path-B-says-c1.theo.pierIdle`) |
| 54–149 s | wandered without progress | help level 1 (edge arrow), 2 (companion line, task bar pulse), 3 (marker and “H · hint”): `ch1-path-B-help-level-1/2/3` |
| 150–160 s | Tab → 1998, deck end, Tab → 2004, far end, Tab → 1998, last post | same instructions as A; beat 1.carve |

### 4.2 · Why players got stuck after Tab (root cause, short)

There was no state-machine deadlock. After Theo said “Press Tab”, the way forward was a spatial puzzle nobody explained: the
pier can only be crossed by switching years halfway out (1998 near deck, then 2004 middle section, then 1998 far end). Theo
and Iris repeated unrelated lines, the player stopped silently at the deck end or the fence, and the automatic hint fired
only after 22 s *without any input*, so a player who kept walking never got it. RC2 fixes all three: Theo explains it, each
edge says what to try, the task bar follows the player's position, and help is based on time without progress (30/60/90 s).

## 5 · Still open (honestly)

1. **Nobody has played RC2.** Whether the tips are the right amount, whether the help comes too early or too late, and whether the task bar feels like a game or a checklist are questions for players.
2. **The pier is still a puzzle.** It is now explained three ways (Theo, Mara at each edge, the task bar), but it remains the one place where the player must think in two years at once. If players still stall there, the next step is a visible ghost of the other year's pier while standing at an edge.
3. **Chapters 2–7 got the same task bar, help and journal, but only chapter 1 got content fixes.** The core tests show no dead end anywhere; stalls a person meets elsewhere are not known yet.
4. **Exploration is still thin.** RC2 gives goals, feedback and memories; it does not add new small events or reactions in the scenes (no new story, as asked). The memory journal is the first place to add meaning to looking around.
5. **The marker is a simple floating diamond and ring.** It is clear but not beautiful; it should be restyled with the art pass.
6. Real GPU, Safari, Firefox, a real controller and a real phone: still not tested (see `V5-RC1-BLOCKERS.md`).
7. **Local browser runs are untested on the Owner's Mac** (`npm run test:guide`, `npm run test:full:local`): the runner, its timeouts, logs and `status`/`logs`/`stop` were verified on Linux only, with Node-only suites; browser steps there are refused because no Chromium can be installed.
8. **Package verification is Node-only** (see 0.5 item 3).

## 6 · Art direction: what to do next (recommendation)

**Not “Disney style.”** A Disney look means hand-rigged characters with squash-and-stretch animation and film lighting. The
game builds its people from code in the browser; imitating Disney with that would look like a cheap copy, it borrows a
famous brand's look, and judges reward originality. The criteria are value, use of Kiro and creativity, and in a three-minute
video what wins is a **coherent, recognisable look that serves the idea**.

**Recommended: a warm storybook diorama, with each year having its own light, and the USENET archive as the signature image.**

| Element | Direction | Reference points |
|---|---|---|
| World | Stylised low-poly kept, but softer: fog for depth, rim light on characters, fewer and larger props, rounder shapes | *A Short Hike*, *Alba: A Wildlife Adventure*, *Monument Valley* |
| Time as colour | 1998 golden hour (warm, saturated); 2004 cold and grey-green (desaturated); the present dusk, then winter blue | the year must be readable from one frame of the video |
| Characters | Bigger heads and hands, outlines, simpler faces with stronger expressions (eyes and brows do the acting) | storybook illustration, not film animation |
| The archive | Period-true 1998 newsreader screens (green or amber text, threads, uuencoded attachments decoding live) on Mara's CRT, and the moment a decoded file becomes a plank, a lamp or a song | this is what makes it “Resurrection” and nobody else has it |

That is achievable in the time left, on the existing renderer, and it also fixes the main weakness for the judges: the USENET
part becomes visible on screen instead of only in the technical demo. It needs the owner's eyes on a real GPU to judge.
