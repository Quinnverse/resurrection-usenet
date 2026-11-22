# Resurrection V5 — RC3 report

RC3 answers the Owner's RC2 playtest: the checklist passed, but the experience did not. It fixes the blockers the Owner
met and reworks the story so that the player has a reason to care, chapters 1 and 2 first. Branch
`feature/resurrection-v5-complete`. Nothing merged, deployed or submitted.

Read this with `V5-RC3-STORY.md`, which has the chapter-by-chapter "problem → change → expected experience" tables.

**Three separate kinds of claim, never mixed:**
- **FIXED**: the code changed, and the cause was reproduced first.
- **AUTOMATED PASS**: a machine check passed (Node, or Chromium with a software GPU on GitHub Actions). These checks say
  nothing about whether the game is engaging.
- **NOT VERIFIED BY A PERSON**: everything about immersion, caring about the characters, pacing and fun. No one has played RC3.

## 1 · The Owner's blockers

| Owner's report | Cause found | Fix | Checked by |
|---|---|---|---|
| Stuck at the bike chain | The ride never moved the player's body, so the "Hold E · Fix the chain" prompt was drawn at the start of the road, behind the camera. It was off screen for 60 of 60 checks. The task bar said "by her bike", but the player cannot walk while the bike is stopped. | The prompt and the marker are at June's bike. The text says no walking is needed. The hints at 30/60/90 s are about the chain, and June speaks them. After 100 s untouched, June fixes it herself. | Node tests (hold, tap, idle to 100 s, the ride continues). Chromium with the real W and E keys: the prompt is on screen, not pinned to an edge, and E fixes the chain. Screenshot `rc3-01-chain-prompt`. |
| The mouse can't be used; no visible pointer | One click captured the pointer for good, nothing said so, and Esc was inconsistent. | Exploring: a click captures the pointer and a dot shows where you look. Esc frees the pointer and pauses. Menus and the journal show the pointer. Settings › Mouse › Free pointer lets you drag to look. The look tip explains this. | Chromium with the real mouse: a click captured the pointer, the dot showed, Esc gave the pause menu with the pointer free. With Free pointer, a drag turned the view (0.84 rad) without capturing. Screenshot `rc3-07`. |
| The lighthouse never showed up for the photo | It was in the windows for 16 s out of every 55 s, the view started facing away, and the frame that counted was smaller than the frame drawn. | Slower, on a shorter loop (20 s out of every 43 s), and coming into view when the dare starts. The view turns toward the subject. What counts is exactly the drawn frame. The frame turns gold when a photo would count, says when to wait for June, and has an arrow toward a subject outside it. | Node: a player who only follows the frame finishes all three dares. **Chromium with the real mouse found a further bug** (below). |
| Photographing June meant turning round and round | The seat view started facing away from her. | The view turns to her when her dare starts. | Node |
| Models go through each other | The duet: seated face to face 1.0–1.5 m apart, so the legs crossed. CI screenshots then showed June standing up and turning into Elena while waiting, with her stool left at the old spot. | Side by side. June stays seated, facing forward, on a stool placed under her in both seats. | Node (leg distance, seated, facing). Chromium (June sits). Screenshot `rc3-05`. **Other clipping was not audited.** |
| Shift could say "speed up" | There was no teaching, and the game called it "sprint" (冲刺). | A tip on the first longer walk, and "speed up" (加速) everywhere. | Chromium with the real keys: the tip appeared while walking, and holding Shift+W ended it. Screenshot `rc3-08`. |

**Found only by the real-mouse browser test (CI run 44915549889).** The player held the right mouse button without
moving. The lighthouse dare never turned gold. The view was pitched up at the carriage ceiling, and the arrow could only
say "to the left", so following it would never have reached the lighthouse.
- Fixed: the arrow now also says up or down, whichever miss is larger.
- Also changed, on a suspicion that is not proven: Chromium's first mouse movements right after the pointer is captured
  are ignored (the likely cause of the fling).
- The browser test now plays like a person: it follows the arrow with the real mouse until the frame turns gold, then
  clicks.
- The result of that test is in §3.

## 2 · Story changes (detail in `V5-RC3-STORY.md`)

| Where | Change |
|---|---|
| Chapter 1, study | The KEEP box holds a photo folded so only Mom shows. Unfolded, there is a girl with a camera; on the back, "junebug & me… Don't let me forget". While the disk is read, the first two archive posts appear: Mom asking for someone to draw a seagull, and junebug offering "the whole town… Theo needs a beard". |
| Chapter 1, town and pier | Theo knew them ("Two girls made me, one summer. Then they stopped coming.") and gives June her name back. Each pier switch says whose part of the pier it is. |
| Chapter 1, the memory | It opens with June taking that photo. The card says the player is Elena, Mara's mother, at seventeen, and that the girl is June. June starts the carving herself if Elena hesitates. The train has a reason: to see a real lighthouse. |
| Chapter 2 | Kept. The dares are now moments rather than a search. The bikes have a reason (Grandma left them at the station). |
| Chapters 3–7 | Each memory opens with the archive post it was rebuilt from, quoted exactly, with one line from Mara. The posts cover the crooked window, the unfinished song, "june is going away at the end of the month", the 2004 public build crediting one name plus the cancel and June's reply, and "please do not make her stay". Chapter 7 ends the drafts scene with the photo unfolded. |
| Task bar | In the memories, the "Next" line fades after 10 s without change. It comes back with the help (30 s without progress), after pressing H, or with "Show steps". It never fades in the present scenes or in the train chase. |

All new lines exist in English and Chinese (51 keys each in `core/i18n-rc3.js`). No new mechanics, no new scenes.

## 3 · Test results

Local (this sandbox, Linux): `npm run test:quick` passes, 278 Node tests, in 59 s. Real Chromium cannot run here.

GitHub Actions, run 44915549889 on `911ff8a` (the story pass):

| Job | Result |
|---|---|
| Authoritative suite, Container smoke, change detection | PASS |
| V5 full game, 14 tests: the whole game in English and Chinese, task bar compared with the state every frame | PASS |
| V5 whole game on keyboard + mouse / pad / touch | PASS / PASS / PASS |
| Browser end-to-end (older pages) | PASS |
| V5 RC1/RC2/RC3 review job: 21 of 22 tests | FAIL: the real-mouse photo dare (§1), fixed in `275ba4b` |
| P5 slice | FAIL, the known baseline (`V5-P5-BASELINE.md`); old code, not V5 |

On the same run, chapter 1 in real Chromium: path A (computer first) reached the carving at 65 s, and path B (explore,
then 95 s lost on the pier) at 166 s. Neither had a stuck moment. Both are 6 s longer than in RC2 because of the new
lines.

Final run on `40adaa4`, GitHub Actions run `44987957801` (the code of the RC3 package):

| Job | Result |
|---|---|
| Authoritative suite (npm test), container smoke, change detection | PASS |
| V5 full game, 14 of 14 tests: whole game EN (540 game s, 11,647 task-bar checks, 0 mismatches) and ZH (537 game s, 11,651 checks, 0 mismatches), 7 chapters with the journal opened and closed in each, Tab on the pier, key remapping, touch, pad, keyboard menus, audio, tech demo, old pages | PASS |
| V5 RC1/RC2/RC3 review pages, first-time guide, packages (including the real-mouse photo dares and the chain and Shift checks) | PASS |
| V5 whole game on one input device: keyboard + mouse, pad, touch | PASS, PASS, PASS |
| Browser end-to-end (older pages) | PASS |
| Browser end-to-end, P5 slice | FAIL, the known baseline (`V5-P5-BASELINE.md`), old code, not V5 |

Earlier failures in this series, each fixed in a later commit: on `275ba4b` (run `44920729504`) the Shift tip covered the
first "press E" tip and the pier help test lost its turn (fixed in `9552a32`); on `9552a32` (run `44985849604`) a click made
with the camera raised was dropped when the right button was released in the same frame (fixed in `40adaa4`).

## 4 · Not verified by a person

1. **Whether any of the story changes work.** Does the folded photo make an outsider care? Do the posts read as story or
   as interruptions? Does Mara's voice in the 1998 chapters help or distract? Does the fading "Next" line leave people
   lost? All of this is design expectation.
2. **Time.** The scripted player needs 9.0 min with every line skipped. The Owner's target is 35–45 min of real play.
   Unknown.
3. **Real GPU, Safari, Firefox, a real controller, a real phone, sound.**
4. **Clipping other than the duet.** It was not audited.
5. **Characters still mostly wait between prompts** (`V5-RC3-STORY.md` §5).
