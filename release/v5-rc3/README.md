# Resurrection V5 — RC3 release folder

`resurrection-v5-rc3.zip` is built from commit `40adaa4` (the build id is in `START-HERE.txt` and on every page).
Its game code is the code that GitHub CI ran in full on run `44987957801`: the whole game in English and Chinese passed, the
review pages passed, and the keyboard/mouse, pad and touch whole-game jobs passed. The P5 browser job fails as it does on
every V5 commit (`docs/V5-P5-BASELINE.md`); it is old code. Not merged, deployed or submitted.

| File | For | Open |
|---|---|---|
| `resurrection-v5-rc3.zip` | the Owner | unzip, double-click **`Resurrection-V5.html`**. Choose New game if an old save is offered: chapter 1 changed. Retest sheet: `CHAPTER-1-RETEST.txt`. What changed: `docs/V5-RC3-REPORT.md`, `docs/V5-RC3-STORY.md`. |

Checksum: `sha256sum -c SHA256SUMS`.

Checked automatically: the zip was unzipped into a new folder and verified (35 checks, `node tools/v5-verify-package.mjs`); the extracted game page was played from the title to the credits in English and Chinese in Node.

**Not checked by a person:** whether the story and the play now draw a player in, real browsers and GPUs, sound, a real controller or phone, and the playing time (the scripted player takes about 9 minutes with dialogue skipped; the target is 35–45 minutes).
