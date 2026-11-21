# Resurrection V5 — RC2 release folder

`resurrection-v5-rc2.zip` was built from commit `0715d01` (see the build id in `START-HERE.txt` and in every page). Its game
code is identical to commit `4db8601`, which GitHub CI ran in full (`docs/V5-RC2-REPORT.md`, section 0.3). Not merged,
deployed or submitted. `SHA256SUMS` holds the checksum (`sha256sum -c SHA256SUMS`).

| File | For | Open |
|---|---|---|
| `resurrection-v5-rc2.zip` | the owner | unzip, double-click **`Resurrection-V5.html`** and replay chapter 1 (`START-HERE.txt`, `CHAPTER-1-RETEST.txt`). `Resurrection-V5-Start.html` has the six doors (game, continue, technical demo, music, key scenes, feedback). Needs only a browser; no install, no server, no internet. |

Checked: the zip was unzipped into a new folder and its files verified (35 checks, `node tools/v5-verify-package.mjs`), including
the extracted game page played from the title to the credits in English and Chinese in Node. **Not checked:** opening the
page in a real browser, a real GPU, sound, a real controller or phone, and a person who has never seen the game.
