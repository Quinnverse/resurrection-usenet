// Writes docs/V5-AUDIO-CHECKLIST.md from the cue list. Verdict columns are left empty: they are for a person listening.
//   node tools/v5-audio-checklist.mjs > docs/V5-AUDIO-CHECKLIST.md
import { THEMES, EFFECTS } from '../frontend/v5/core/audio-cues.js';
const o = ['# V5 audio listening checklist · 音频试听清单', '',
  '**Status: NOT TESTED by ear.** Nobody has listened to the V5 audio yet. The automated browser test only shows that every theme and effect produces a signal and does not clip (see `docs/V5-TEST-REPORT.md`).', '',
  'How to listen: open `Resurrection-V5-Audio.html` from the RC1 package (double-click), or run `npm run v5` and open `/v5/audio`. Each music row has ▶ 8 s, ▶ loop (until you press stop) and a link that opens the scene where it is heard; every row has a verdict menu and a notes field; “Download results” saves them as JSON. Listen once on speakers and once on headphones, at a normal volume. Then play chapter 4 in the game for the duet, which is not on the page.', '',
  '试听方法：运行游戏后打开 `/v5/audio`。每行有播放按钮、结论下拉框和备注栏，可下载结果。请分别用音箱和耳机各听一遍；第 4 章的二重奏需要在游戏中试听。', '',
  '## Music (one melody, Elena\'s tune.ll from the archive, arranged per place and year)', '', '| id | Plays in | Intended effect | Speakers | Headphones | Notes |', '|---|---|---|---|---|---|'];
Object.entries(THEMES).forEach(([k, v]) => o.push(`| \`${k}\` | ${v.where} | ${v.want} | | | |`));
o.push('| duet (in game) | Ch4 4.duet: Elena plays, the background music stops | Guitar notes from the archive tune; each hit adds June\'s hum, then a harmony; misses still sound, softly | | | |');
o.push('', '## Ambience', '', '| id | Plays in | Intended effect | Verdict | Notes |', '|---|---|---|---|---|');
[['sea', 'town, station', 'gentle waves under everything'], ['room', 'study, cottage', 'near silence, a little air'], ['train', 'carriage', 'rhythmic rumble'], ['wind', 'coast', 'steady wind on the cliff'], ['winter', 'town after the snow', 'quiet, muffled']].forEach(([a, b, c]) => o.push(`| \`${a}\` | ${b} | ${c} | | |`));
o.push('', '## Sound effects', '', '| id | Where | Verdict | Notes |', '|---|---|---|---|');
Object.entries(EFFECTS).forEach(([k, v]) => o.push(`| \`${k}\` | ${v} | | |`));
o.push('', '## Questions for the listener', '', '- Does any music cover or fight a line of dialogue (especially chapter 6)?', '- Is the 2004 music clearly emptier than 1998, and the winter clearly new?', '- Is anything harsh, too loud relative to the rest, or repetitive enough to annoy over 5 minutes?', '- Volume sliders (Esc → Settings) behave as expected?');
console.log(o.join('\n'));
