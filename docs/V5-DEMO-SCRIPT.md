# V5 tech demo — 3-minute script

Open `http://127.0.0.1:3000/v5/tech` and press **▶ 3-minute walkthrough**. The page moves through the steps on its own
(timer at the top right). Everything shown is computed live by the same modules the game uses. The archive is a
fictional fixture, and the page says so.

| Time | Section | What to say |
|---|---|---|
| 0:00 | 1 · Raw records | Three sources: a public rnews mirror, a public mbox group archive and Elena's backup disk. This is the post that carries `bridge.ll`, uuencoded, as the mirror stored it. |
| 0:25 | 2 · Parse | The parser follows References to rebuild the thread. Cancel control messages apply only in the source that carried them. Copies of one Message-ID whose bodies differ are kept as a conflict, not overwritten. |
| 0:55 | 3 · Build manifests | Objects come from manifests. The 1998 manifest was cancelled on the public mirror, so only the disk still has it. The 2004 manifest lists `bridge.ll`, 710 bytes, CRC-32 `a5055c02`. |
| 1:20 | 4 · Broken bridge | The public copies are truncated (mirror) and stripped (groups). No copy matches, so the bridge is not in the 2004 scene graph. The surviving fragment is drawn dashed and cannot be walked on. |
| 1:45 | 5 · Restore | Restore runs (the page presses it). It finds the disk copy, checks size and CRC, and records the provenance: record, manifest, SHA-256, the decode steps. The 2004 map gains 15 plank floors and the path finder now crosses the canal. The 1998 map is the untouched snapshot. |
| 2:20 | Variant input | The page swaps the disk for `variant-missing-plank.spool`. The 2004 restore is refused (CRC mismatch). The 1998 bridge now has 14 planks and a 0.24 m hole; the path finder stops there. In the game a jump clears it. |
| 2:45 | Back to normal | The variant is switched off. Close by pressing **Play the game →**: in chapter 1 the player does this restore by holding E at the gap, and the bridge appears plank by plank. |

Manual buttons: **Restore bridge**, **Variant input**, **Reset**.

To show the same in the game: start a new game, use the computer in the study, talk to Theo, hold E at the gap in the
bridge, then click the small "source" label at the top right for the provenance panel.
