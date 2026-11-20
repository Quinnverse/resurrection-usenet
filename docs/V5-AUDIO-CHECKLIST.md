# V5 audio listening checklist · 音频试听清单

**Status: NOT TESTED by ear.** Nobody has listened to the V5 audio yet. The automated browser test only shows that every theme and effect produces a signal and does not clip (see `docs/V5-TEST-REPORT.md`).

How to listen: open `Resurrection-V5-Audio.html` from the RC1 package (double-click), or run `npm run v5` and open `/v5/audio`. Each music row has ▶ 8 s, ▶ loop (until you press stop) and a link that opens the scene where it is heard; every row has a verdict menu and a notes field; “Download results” saves them as JSON. Listen once on speakers and once on headphones, at a normal volume. Then play chapter 4 in the game for the duet, which is not on the page.

试听方法：运行游戏后打开 `/v5/audio`。每行有播放按钮、结论下拉框和备注栏，可下载结果。请分别用音箱和耳机各听一遍；第 4 章的二重奏需要在游戏中试听。

## Music (one melody, Elena's tune.ll from the archive, arranged per place and year)

| id | Plays in | Intended effect | Speakers | Headphones | Notes |
|---|---|---|---|---|---|
| `study` | Ch1 & Ch7 · Mara's study (1.study, 7.study) | Quiet, low, a little lonely; plucked melody an octave down with a soft pad. Mara alone with her mother's things. | | | |
| `summer` | Ch1 town in 1998, the carving (1.carve); Ch4 cottage and between the duets (4.cottage, 4.duet) | Bright and warm, bass and bells; the summer as Elena remembers it. | | | |
| `train` | Ch1 the chase (1.chase); Ch2 the train (2.train) | Quick and bouncing, oom-pah under the tune; running, laughing, the carriage moving. | | | |
| `coast` | Ch3 the ride, yard, beam, cliff (3.ride … 3.cliff) | Open and moving, hum underneath; wind, speed, building something together. | | | |
| `night` | Ch4 the porch and the stars (4.porch) | Very soft bells, low pad; night, closeness, the almost-confession. | | | |
| `parting` | Ch5 the last afternoon at the station (5.depart) | Slow, lowered a step, pad; tender, not tragic yet. | | | |
| `y2004` | Ch1/Ch7 town in the 2004 build (1.town, 1.pier, 7.town before the snow); Ch5 six years later (5.alone) | Sparse, notes missing, cool sine; something that used to be whole. | | | |
| `cottage04` | Ch6 the cottage and the beach in 2004 (6.cottage, 6.beach) | Barely there, notes dropped; no comfort. It should not cover the conversation. | | | |
| `winter` | Ch7 after the seasons are made, the snow, the pier (7.town winter, end) | Bells, bass, pad and hum; new, fuller, a little hopeful. Clearly different from the 1998 summer. | | | |
| `ending` | Credits | Calm plucked melody with bells; an ending, not a fade-out. | | | |
| duet (in game) | Ch4 4.duet: Elena plays, the background music stops | Guitar notes from the archive tune; each hit adds June's hum, then a harmony; misses still sound, softly | | | |

## Ambience

| id | Plays in | Intended effect | Verdict | Notes |
|---|---|---|---|---|
| `sea` | town, station | gentle waves under everything | | |
| `room` | study, cottage | near silence, a little air | | |
| `train` | carriage | rhythmic rumble | | |
| `wind` | coast | steady wind on the cliff | | |
| `winter` | town after the snow | quiet, muffled | | |

## Sound effects

| id | Where | Verdict | Notes |
|---|---|---|---|
| `step` | footstep (not used yet) | | |
| `jump` | jump | | |
| `land` | landing | | |
| `click` | pick up / carry | | |
| `open` | opening the KEEP box (Ch1) | | |
| `blip` | subtitle line appears | | |
| `crtWake` | old computer wakes (Ch1) | | |
| `modem` | archive rebuild screen (Ch1) | | |
| `restoreStart` | restore begins (bridge, Ch1) | | |
| `plank` | each bridge plank lands | | |
| `restored` | restore complete | | |
| `to98` | Tab to 1998 | | |
| `to04` | Tab to 2004 | | |
| `denied` | Tab refused / restore refused | | |
| `whistle` | train leaves (Ch1, Ch5) | | |
| `caught` | catching June's hand (Ch1) | | |
| `shutter` | camera shutter (Ch2, Ch5) | | |
| `bell` | bicycle bell (Ch3) | | |
| `crank` | lamp crank (Ch3) | | |
| `lit` | the lamp lights (Ch3) | | |
| `door` | doors | | |
| `page` | letter, sketch, drawing | | |
| `choice` | a choice is made | | |
| `season` | seasons created (Ch7) | | |
| `credit` | names restored (Ch7) | | |
| `iris` | Iris revived (Ch7) | | |
| `lamp` | study lamp switch | | |
| `hint` | a hint is given | | |
| `can` | soda can (Ch5) | | |
| `chain` | June's bike chain (Ch3) | | |
| `rope` | Iris's rope (Ch7) | | |
| `touch` | reaching for June's hand in the tunnel (Ch2) | | |
| `express` | tunnel / the express that does not stop (Ch2, Ch5) | | |
| `star` | a star joined (Ch4) | | |
| `dot` | a dot reached while drawing (Ch4) | | |
| `carve` | carving the post (Ch1) | | |
| `tuned` | string in tune (Ch4) | | |
| `detuned` | string out of tune (Ch4) | | |
| `found` | the beam finds June / the cottage / the pier | | |
| `lens` | lens fitted (Ch3) | | |
| `gate` | ribbon gate (Ch3) | | |

## Questions for the listener

- Does any music cover or fight a line of dialogue (especially chapter 6)?
- Is the 2004 music clearly emptier than 1998, and the winter clearly new?
- Is anything harsh, too loud relative to the rest, or repetitive enough to annoy over 5 minutes?
- Volume sliders (Esc → Settings) behave as expected?
