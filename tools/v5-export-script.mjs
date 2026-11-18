// Writes the complete V5 script, English and Simplified Chinese side by side, from the game's own data
// (core/game.js DIALOGS and core/i18n.js), in the order a first play meets it.
//   node tools/v5-export-script.mjs > docs/V5-SCRIPT.md
import * as Gm from '../frontend/v5/core/game.js';
import { t } from '../frontend/v5/core/i18n.js';
import { loadArchive } from './v5-playthrough.mjs';
import { playThrough, DT } from '../test/v5-bot.mjs';

const order = []; const seenD = new Set(); const caps = [];
const g = Gm.createGame(loadArchive());
let beat = g.s.beat; const byBeat = { [beat]: [] };
await playThrough(g, { step: (input) => {
  const ev = Gm.tick(g, DT, input);
  ev.forEach((e) => {
    if (e.type === 'beat') { beat = e.beat; byBeat[beat] = byBeat[beat] || []; }
    if (e.type === 'dialog' && !seenD.has(e.id)) { seenD.add(e.id); byBeat[beat].push({ dialog: e.id }); }
    if (e.type === 'caption') { byBeat[beat].push({ caption: e.key, who: e.who }); }
  });
  return ev;
} });
const sp = (who, lang) => (who === 'screen' ? (lang === 'zh' ? '（屏幕）' : '(screen)') : t(lang, 'sp.' + who));
const out = ['# Resurrection V5 — complete script (EN / 简体中文)', '', 'Generated from `frontend/v5/core/game.js` and `frontend/v5/core/i18n.js` by `tools/v5-export-script.mjs`, in the order of one first play (English choices: the first option except where noted). Lines in *italics* are short spoken captions during play. All characters and places are fictional. The Bai Juyi line is from 《琵琶行》 (816), public domain.', ''];
for (const [b, items] of Object.entries(byBeat)) {
  if (!items.length) { continue; }
  out.push(`## ${b} — ${t('en', 'chap.' + Gm.chapterOf(b))} · ${t('zh', 'chap.' + Gm.chapterOf(b))}`, '', '| | English | 中文 |', '|---|---|---|');
  for (const it of items) {
    if (it.caption) { out.push(`| *${sp(it.who, 'en')}* | *${t('en', it.caption)}* | *${t('zh', it.caption)}* |`); continue; }
    for (const ln of Gm.DIALOGS[it.dialog] || []) {
      if (!Array.isArray(ln)) { out.push(`| choice | ${ln.options.map((o) => t('en', o)).join(' / ')} | ${ln.options.map((o) => t('zh', o)).join(' / ')} |`); continue; }
      if (ln[0] === 'pause') { out.push(`| | (silence, ${ln[1]} s) | （沉默 ${ln[1]} 秒） |`); continue; }
      out.push(`| ${sp(ln[0], 'en')} · ${sp(ln[0], 'zh')} | ${t('en', ln[1]).replace(/\|/g, '/')} | ${t('zh', ln[1]).replace(/\|/g, '/')} |`);
    }
  }
  out.push('');
}
// the branches the first play above did not take
const taken = seenD; const other = Object.keys(Gm.DIALOGS).filter((id) => !taken.has(id));
out.push('## Lines from the other choices and optional moments', '', '| | English | 中文 |', '|---|---|---|');
for (const id of other) { for (const ln of Gm.DIALOGS[id]) { if (Array.isArray(ln) && ln[0] !== 'pause') { out.push(`| ${id} · ${sp(ln[0], 'en')} | ${t('en', ln[1])} | ${t('zh', ln[1])} |`); } } }
console.log(out.join('\n'));
