# Resurrection V5 — R4 candidate release folder

`resurrection-v5-rc4.zip` (6607234 bytes) is built from commit `6a7c311` (the build id is in `START-HERE.txt` and on every page).

**SHA-256** `b2ef961552b224952222a41c98d6487d321d482a025fe136950a31205a0e2ceb`  (check: `sha256sum -c SHA256SUMS`)

| File | For | Open |
|---|---|---|
| `resurrection-v5-rc4.zip` | the Owner | unzip, double-click **`Resurrection-V5.html`** (offline; no server, no install). Choose **New game** if an old save is offered: the game now begins in the prologue. Questions after playing: `PLAYTEST-QUESTIONS.txt`. Theme: `RESURRECTION_THEME.md`. Report: `docs/R4-REPORT.md`. |

## What the tests say, and what they do not

Its game code is the code GitHub CI ran in full on run **45047974678** (commit `280e07a`, `[ci full]`); the game files are identical (same fingerprint `f55f12c5ed78bef685d249ed`). **That run was not green:**

- passed: quick checks, the whole game in English and in Chinese (prologue, seven chapters, epilogue), keyboard+mouse, pad and touch whole-game jobs, every beat/menus/audio/tech, the review pages, the older pages and the old game, the container;
- failed: the **P5 slice** (the known baseline failure of old code, `docs/V5-P5-BASELINE.md`; same 5 failures as before) and **two of my own R4 browser checks** (Chinese prologue, epilogue);
- the two R4 check failures were diagnosed as a **race in the test script** (a fixed wait after pressing E on a slow machine; the game did receive the key and start the dialogue 626 ms later, see `docs/r4-evidence/diagnosis/`). The script was fixed and passes locally under slow conditions. **It has not been re-run on GitHub.**

Verified locally: 285 Node tests; the real `main.js` in Node for keyboard, pad and touch paths in both languages; 8 real-Chromium checks with the real keyboard; this zip, unzipped into a fresh folder (35 checks with `--commit 6a7c311`, `node tools/v5-verify-package.mjs`), and its single-file game page played to the credits in English and Chinese (25 beats).

**Not checked by a person:** everything about whether the story moves a player, the pacing, the playing time (target 45–60 minutes; the scripted player needs about 10.7 minutes), real browsers and GPUs (all browser tests use a software GPU), sound, a real controller or phone, and the Chinese text (no native reviewer). Not merged, deployed or submitted.
