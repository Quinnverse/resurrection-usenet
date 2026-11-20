# Resurrection V5 — RC2: first-time playability

RC2 fixes what the owner's first play exposed: no teaching of the controls, no visible goal, an unexplained precondition at
the computer, getting lost after the first Tab, a boring stretch with no feedback, and white specks in the air. It adds no
story. Branch `feature/resurrection-v5-complete`; nothing merged, deployed or submitted.

Status words as before: **AUTOMATED PASS** (a machine check), **MANUAL PASS** (a person on real hardware: none yet),
**NOT TESTED**, **BLOCKED**.

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
| Whole game with only keyboard and mouse / only a pad / only touch, with the new HUD | AUTOMATED PASS when the CI device jobs pass (see the run in the final report) | CI device jobs |
| Particles before and after | screenshots | before: `docs/v5-evidence/rc1/` (RC1 run, study and snow); after: `rc2-13-study-dust-after`, `rc2-14-snow-after` |
| A person who never saw the game understands the controls, the goal and the next step | **NOT TESTED** | needs the owner and other players |

Screenshots are from GitHub Actions Chromium with software rendering, in `docs/v5-evidence/rc2/`.

## 5 · Still open (honestly)

1. **Nobody has played RC2.** Whether the tips are the right amount, whether the help comes too early or too late, and whether the task bar feels like a game or a checklist are questions for players.
2. **The pier is still a puzzle.** It is now explained three ways (Theo, Mara at each edge, the task bar), but it remains the one place where the player must think in two years at once. If players still stall there, the next step is a visible ghost of the other year's pier while standing at an edge.
3. **Chapters 2–7 got the same task bar, help and journal, but only chapter 1 got content fixes.** The core tests show no dead end anywhere; stalls a person meets elsewhere are not known yet.
4. **Exploration is still thin.** RC2 gives goals, feedback and memories; it does not add new small events or reactions in the scenes (no new story, as asked). The memory journal is the first place to add meaning to looking around.
5. **The marker is a simple floating diamond and ring.** It is clear but not beautiful; it should be restyled with the art pass.
6. Real GPU, Safari, Firefox, a real controller and a real phone: still not tested (see `V5-RC1-BLOCKERS.md`).

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
