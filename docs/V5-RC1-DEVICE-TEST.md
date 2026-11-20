# RC1 — real-device test procedure

For the owner, on the Mac (and phone and gamepad if you have them). The sandbox where RC1 was built has no screen, no
GPU and no browser, so **none of this has been done yet**. Each section says what to write down and where. Leave a
result blank rather than guess. A blank stays NOT TESTED in `V5-RC1-ACCEPTANCE.md`.

Total time: about 90 minutes for Chrome plus the checks; the full play-through is a further 35–45 minutes.

## 0 · Before you start

1. Get the package (`resurrection-v5-rc1.zip`) and unzip it, or run `npm run v5` in the repository. Open **`Resurrection-V5-RC.html`** (or `http://127.0.0.1:8090/v5/rc`).
2. In section 3 of the hub (“This device”) check: *WebGL 2*, the *graphics card* name is your real GPU (not “SwiftShader”, “llvmpipe” or “Basic Render”), the *display refresh* is what you expect. If it says software rendering, hardware acceleration is off: fix that first, or the numbers mean nothing.
3. Plug in the charger and close heavy apps. Use the same window size for each browser (full screen, or the same size).
4. Fill in this table once:

| | |
|---|---|
| Mac model, chip, RAM | |
| macOS version | |
| Display (resolution, scaling, refresh Hz, external?) | |
| Power (charger on / battery, low-power mode off?) | |
| Build (commit shown in the report; `git rev-parse --short HEAD`) | |

## 1 · Frame-time test (all three quality levels)

For each browser (Chrome, Safari, Firefox if installed): hub → **Frame-time test, all three quality levels**. Do not switch tabs while it runs (about 5 minutes). At the end press **Copy markdown** and paste the result into `V5-RC1-PERF.md` under that browser; also **Download JSON** and keep it.

What to look at in the table:

| Column | Meaning | Worry if |
|---|---|---|
| Avg FPS | frames per second over 8 s | below 30 on *low*, or far below the refresh rate on *high* |
| **1% low FPS** | frame rate of the slowest 1% of frames | below 24: it will feel stuttery |
| p99 ms / Worst ms | the slow tail | worst above 250 |
| Hitches / Severe | frames over 100 ms / over 250 ms | any “Severe” inside a scene (the first frame of a new scene is excluded: it is in *Load ms*) |
| Load ms | building the scene and drawing its first frame | above 3000 |
| Heap MB | JS memory (Chrome only; “n/a” elsewhere) | above 500 or growing from scene to scene |
| Draw calls / Triangles | how much is drawn per frame | for comparing quality levels |

**Memory outside Chrome and for the GPU:** the page cannot see it. Read it from the system while the game runs: Chrome → *Window → Task Manager* (or Shift+Esc), Safari → Activity Monitor, *Safari Web Content (…)* row, Firefox → `about:processes`. Write the largest number you saw after a full play (section 2) in `V5-RC1-PERF.md`.

## 2 · Full play-through (Chrome first)

1. Open **`Resurrection-V5-Playtest.html`** (or hub → *Play with the playtest recorder*). Type `OWNER` as the tester id. Play all seven chapters on *high*. Do not read the script first: this is also your own first-impression playtest (section 7).
2. Press **F3** once now and then: it shows fps, frame time and heap. Note any place that stutters, with the chapter.
3. At the end (or in the pause menu) press **Download playtest log**. It has per chapter: real time, start and end clock time, average fps, the approximate 1% low, the worst frame, the heap, pauses, hints, skipped lines, stalls and exits.
4. Summarise with `node tools/v5-playtest-summary.mjs OWNER.json` and paste the *Time per chapter* and *Frame rate* tables into `V5-RC1-PERF.md`.
5. Record: did it finish? Did anything crash, freeze, soft-lock or look broken? (Screenshots welcome, with the chapter.)

Repeat a shorter run for **Safari** (and Firefox): start, walk, talk, restore the bridge, save, quit the tab and *Continue*, then use the hub to open chapter 3 (ride and beam), chapter 4 (duet and porch), chapter 6 and the last scene, and finish the game from the last scene. Note anything different from Chrome: audio not starting until a click, the Esc key leaving full screen instead of pausing, the mouse look feeling different, text or layout differences, `n/a` memory.

## 3 · Quality levels in play

On the *low*, *medium* and *high* settings (pause → Settings → Quality) ride the bike in chapter 3 (`?preview=3.ride`) for a minute and look at the town in chapter 1 (`?preview=1.town`) with F3 on. Does *low* look acceptable? Does *high* hold the refresh rate? Which level should be the default on this Mac?

## 4 · Input devices

**Keyboard and mouse.** Finish the game once (section 2). Then pause → Settings → Keys:
- bind *Forward* to a key another action uses (e.g. **D**): the two should swap and a note should say so;
- try Esc, F5 and the **1** key: all refused; Esc cancels;
- quit the tab, return: the bindings are kept; *Reset keys* restores W A S D.

**Gamepad** (connect it, press a button, then open the hub):
1. Section 4 of the hub must show your pad. Write down its name and the *mapping*: only “standard” is supported; anything else needs a note on what is wrong.
2. With **only the pad** (do not touch keyboard or mouse): start from the title, move, look, jump (A), interact and hold (X), pick dialogue choices (D-pad + A), skip a seen line (B), hint (Back), pause (Start), move through Settings with the D-pad, leave the pause menu (Start or B), *New game* confirm, quit and *Continue*, and play to a chapter end. If you can play a whole chapter (or the whole game) with the pad alone, say which.

| Action | Works? | Note |
|---|---|---|
| Title: Start / Continue | | |
| Move, look, jump, sprint | | |
| Interact, hold to restore | | |
| Dialogue: continue, choose, skip | | |
| Pause, Settings, Resume | | |
| Train camera and shutter (ch. 2) | | |
| Bike, beam, tuning, duet (ch. 3–4) | | |
| Save, quit, Continue | | |
| Ending and credits, back to title | | |

**Phone** (`npm run v5:lan`, open the printed address, hub → *Play*): portrait and landscape.

| Check | Portrait | Landscape |
|---|---|---|
| Title and menus fit; nothing cut off | | |
| Touch buttons reachable with thumbs, none hidden by the notch or the browser bars | | |
| Stick moves, right side looks around, jump and E work | | |
| Dialogue choices tappable | | |
| Rotating keeps the picture and the buttons right | | |
| Sound starts after the first tap (and the ringer switch is not muting it on iPhone) | | |
| Frame rate (hub → quick frame-time test, or F3 is not available on a phone: use the test), device gets hot? | | |
| Pause, Settings, save and Continue | | |

## 5 · Key scenes and sound

Open each scene from hub section 2, in the language you prefer. For each write a short verdict (good / needs work, and what). The screenshots on the cards are software-rendered, so judge by the live picture.

| Scene | Picture (faces, framing, light) | Camera | Music and sound | Notes |
|---|---|---|---|---|
| Train, Elena and June | | | | |
| Coast ride | | | | |
| Lighthouse together | | | | |
| Porch at night (night music) | | | | |
| Guitar duet | | | | |
| 2004 on the beach | | | | |
| The first snow | | | | |

Then open **Music and sound** and listen to every row on speakers and on headphones (verdict menu and notes, then **Download results**). Nobody has listened to this audio yet; the level column is not a quality measure.

## 6 · Report

- Paste the frame-time tables and the system memory notes into `V5-RC1-PERF.md`.
- Mark each row of `V5-RC1-ACCEPTANCE.md` that you tested as PASS / FAIL with a date, browser and device.
- Add every problem you found to `V5-RC1-BLOCKERS.md` (what, where, how to reproduce, severity).

## 7 · Your own play, then others

Before inviting anyone else, play once yourself with the recorder (section 2) and note, without opening the script:
what you understood about June and 2004, where you hesitated, where you would have given up. Then use `playtest/README.md`
for 5–8 other players. The facilitator guide and the player folder (`resurrection-v5-playtest.zip`) need no development
environment. Nothing from a player leaves their browser unless they choose to send the file.
