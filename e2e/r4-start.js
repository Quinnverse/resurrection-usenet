// R4: a new game now starts in Mom's kitchen (the prologue). The older tests below were written when a new game started
// in the study, and what they check (the first goal in the study, the KEEP box, the computer, chapter 1) is unchanged.
// This helper loads the game exactly as a player would get there: Continue from a save made at the start of the study
// (the one the scripted player writes: the kitchen argument and the empty house are behind it).
const fs = require('node:fs');
const path = require('node:path');
const SAVE = JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'v5', 'data', 'preview-saves.json'), 'utf8')).saves['1.study']);

async function openAtStudy(page, expect, beat) {
  await page.addInitScript((v) => { if (!sessionStorage.getItem('r4set')) { localStorage.setItem('v5.save.v1', v); sessionStorage.setItem('r4set', '1'); } }, SAVE);
  await page.goto('/v5/');
  await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 });
  await page.keyboard.press('Enter');
}
module.exports = { openAtStudy, STUDY_SAVE: SAVE };
