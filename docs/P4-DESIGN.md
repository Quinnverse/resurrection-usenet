# P4 — "The Lighthouse": 3D third-person vertical slice

P4 is a separate, stylized low-poly 3D build at `/p4/`. It does not replace anything: `/` (the four-act game) and `/p3/` (the P3.2 pixel game) still load and keep their own saves.

- Engine: Three.js r170, vendored as `frontend/p4/vendor/three.module.min.js` (MIT, license next to it). No CDN, no build step, no paid API.
- All art and audio are generated in code: primitive meshes, canvas textures, WebAudio tones and noise.
- Languages: English by default. A full Simplified Chinese version is one click away (`中文` button, top right, also on the title screen).
- Save: autosave to `localStorage` key `p4.save.v1` every 4 s and at every story step. "Continue" resumes the same scene, position and camera yaw. "New Game" asks before erasing.

## Player and controls

| | Desktop | Phone / tablet |
|---|---|---|
| Move | W A S D or arrow keys (Shift to walk faster) | Left stick |
| Look | Hold mouse button and drag | Drag on the right side of the screen |
| Use / talk / continue | E (also F or Enter; Space in dialogue; or click the prompt) | Hand button |
| Leave an archived copy | Esc, or the "Return to the present" button | The button |

The camera follows Mara from behind and never rotates by itself. It pulls in when a wall is between it and Mara. Settings: sound on/off, volume, motion full/reduced (reduced is also taken from the OS setting), language.

## Flow and guidance

The current objective is always shown in the top-left panel. It flashes "NEW OBJECTIVE" and plays a chime when it changes. A soft gold ring on the floor marks the current target. Things that can be used glow and show an `[E] verb · name` prompt when Mara is close.

The first-time tutorial is three tips, shown one at a time at the bottom of the screen: move, look, use. Each tip clears when the player has done it. The tutorial is remembered (`p4.tutorial.v1`).

### Scene A — Mom's study (evening)

| Step | Objective | How the player is guided |
|---|---|---|
| A1 | Pack up Mom's study. Look through her things. | Opening lines: "Mom died last spring." The KEEP box is next to the spawn point, with the gold ring on it. |
| A2 | Mom's old computer just turned on by itself. Check it. | Reading any item wakes the CRT: a green glow, a hum, and the camera turns toward the desk. The ring moves to the computer. |

Optional items: the photo on the cork board ("J. — don't let them forget you."), a postcard, the shelf, the window, and the floor lamp (which switches on and off). Using the computer shows the screen: one unread message in `alt.games.homebrew`. A modem sound and a white fade lead into the archive.

### Scene B — the old-internet archive (night, digital rain)

| Step | Objective | How the player is guided |
|---|---|---|
| B1 | Find Mom's old account somewhere in this archive. | A lit causeway leads to the newsgroup plaza. On arrival: "Thousands of voices. One of them is hers." The `alt.games.homebrew` tower glows amber and a warm guide tone gets louder as Mara approaches it. Other posts (pete, owl, junebug, mirrorbot) can be read and add context. |
| B2 | Follow skylark's link. | Reading skylark's post ("everyone in it is someone I love. — E.") makes Mara realise skylark was Mom. The far gate opens with light and sound, and the camera glances at it. |

### Scene C — Summer Town (a seaside town Elena built at seventeen)

| Step | Objective | What happens |
|---|---|---|
| C1 | Explore the town Mom made. Someone is waiting by the lighthouse. | Theo stands by the dark lighthouse. He first mistakes Mara for Elena ("You just have her eyes"), then explains: Elena promised to come back and light the lamp for the evening ferry, but one night the lamp was "cut out of the world". She used to say the town lives in more than one place, and there are two copies in the square. |
| C2 | Check both copies of the town (n/2). | Two kiosks in the plaza each switch the whole town to one archived copy. **1998, summer98.net:** warm sky, lamp present, "JUNE'S BAKERY" sign, intact mural, bunting, gulls. **2004, mirror.oldnet.org:** cold grey, no lamp, the bakery sign reads "[deleted]", one face scraped off the mural. |
| C3 | Restore the lighthouse lamp from the copy that still has it. | At the lighthouse while viewing the 1998 copy, the prompt becomes "Restore the lamp from this copy". Trying it from the 2004 copy says "Nothing to restore." |
| C4 | Tell Theo the lamp is back. | The lamp assembles piece by piece and the town returns to the present with the lamp in place, still dark. |
| C5 | Talk to Theo at the lighthouse. | Theo walks into the lighthouse and lights it, which he could not do before ("Twenty-eight years. And it lit on the first try."). The beam sweeps the sea. Theo tells Mara that June wrote all the music, that someone erased her from the newer copies, and that if anyone is still out there, it's June. |
| END | To be continued. | A new message arrives from junebug, dated today: "Who turned the lighthouse back on? / Elena? Is that you?" Title card "To be continued · Chapter 2 · June". The player can keep exploring the town or return to the title. |

## Code map

| File | Role |
|---|---|
| `frontend/p4/index.html` | Page, CSS-only HUD, loads `js/main.js` |
| `js/main.js` | Renderer, adaptive quality, controller, follow camera, HUD, tutorial, dialogue, scene changes, title/intro/ending, read-only `window.P4Debug.snapshot()` |
| `js/story.js` | Pure story state machine (steps, flags, objectives, save parse/repair) |
| `js/levels.js` | Walkable areas, blockers, interaction points, routes and the town walking graph |
| `js/world-study.js`, `js/world-archive.js`, `js/world-town.js` | The three scenes |
| `js/people.js` | Mara and Theo, procedural animation |
| `js/kit.js` | Palette and geometry/texture helpers |
| `js/audio.js` | WebAudio sound effects and ambience |
| `js/i18n.js` | English and Simplified Chinese text |

## Running it

```
npm start            # or: node combined-server/server.js (Node 20+, no runtime dependencies)
# open http://127.0.0.1:3000/p4/
# the older versions stay at http://127.0.0.1:3000/ and http://127.0.0.1:3000/p3/
```

Tests: `npm test` runs the Node suite, including `test/p4-core.test.mjs`. `npx playwright test e2e/p4.spec.js` runs the browser playthroughs (Chromium; uses SwiftShader WebGL in CI). See `docs/P4-TEST-REPORT.md`.
