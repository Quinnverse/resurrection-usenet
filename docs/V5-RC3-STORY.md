# Resurrection V5 — RC3: story and play, what changed and why

Written after the Owner's RC2 playtest. The Owner's words: the mother's study works as a prologue; after that you
suddenly meet someone, then switch and switch, and none of it registers; the train is more fun; the player is led by the
nose; as a novel it would not flow; an outsider cannot get into it.

The competition theme stays the centre: **Resurrection**. A dead woman's unfinished game is brought back from USENET
archive copies, and restoring it is how her daughter finds out what she did, and to whom.

**How to read the "experience" column.** Every entry there is a design expectation. **None of it has been confirmed by a
person.** What a machine has checked is listed separately in `V5-RC3-REPORT.md`.

## 1 · Why an outsider stayed outside (the RC2 script, audited)

The full RC2 script of all seven chapters (every line, trigger, choice and transition) was extracted from the code and
read beat by beat. The questions and the answers for RC2:

| Question | RC2 |
|---|---|
| What does the player know when the past opens? | That Mom made a game and kept a backup. Nothing about June; the only hint, a photo on the shelf, was an optional look. |
| Whom does the player care about, and why? | No one yet. Mara's grief was one line ("…I'm asking, Mom"). There was no question to carry. |
| Why does each scene change? | Because a task ended. Study → town when the disk loaded; pier → memory when the post was touched; carve → train because "the train!"; train → bikes with no mention of bikes. |
| What does each character want? | Theo wanted a bridge and a pier; June wanted the next activity done. |
| What do the player's actions change? | Floors. The pier switches were a puzzle about which year has which planks. |
| Lines that only explain a task | Most of chapter 1 after the study, the ride hints, much of chapter 7's Theo. |
| Where is the set-up missing? | Before Elena and June appear (the player suddenly *is* a 17-year-old), before the pier, before the bikes. |
| Where is Mara? | Gone from the end of chapter 1 until chapter 7: six chapters without the person whose question it is. |

**The central finding: events without emotional cause between them**, and the archive, the thing that makes this a
*Resurrection* game, invisible during the story.

## 2 · The structural change: the archive tells the story between the memories

The fictional archive in the game already contained the whole story in the posts' own words (`frontend/v5/data`):
"I cannot draw a seagull. Anyone?" / "I can draw you the whole town"; "sky will hate it. sky will build it"; "june is
going away at the end of the month"; the 2004 public build crediting only skylark, the summer build "cancelled by its
author", and June's reply "My name is not on it any more"; "please do not make her stay". The game parsed these posts
but never showed them.

In RC3, **each memory opens with the post it is rebuilt from**, quoted exactly, with one line from Mara reading it. This
keeps Mara present through the chapters, gives every scene change a reason (the next post), shows the player what is
being resurrected, and creates the information gap the Owner asked for: the player often knows more than Elena does.
Chapter 2 has no matching post and stays as it was.

## 3 · Seven chapters: problem → change → expected experience

Priority was chapters 1 and 2 (the first ten minutes), as asked.

### Chapter 1 · Catch the Summer (the most changed)

| RC2 problem | RC3 change (in the game now) | Expected experience (not verified) |
|---|---|---|
| The player has no question to carry into the past | The KEEP box holds the disk **and a photo folded in half so only Mom shows**. Mara unfolds it: a girl with a camera, laughing at her. On the back: *"junebug & me. The end of the old pier, summer '98. Don't let me forget."* Mara: *"She never once said the word junebug."* The folded photo is now a memory in the journal (it was an optional look) | Curiosity: who is she, and why fold her away? |
| The past opens on nothing | While the disk is read, the first two posts appear: Mom asking a newsgroup for someone to draw a seagull, and junebug replying the next morning *"I can draw you the whole town… Theo needs a beard."* Mara: *"That's how they met. Mom asked a newsgroup for a seagull, and somebody offered her a town."* Then: *"Show me what you **two** made."* | The relationship begins before the player meets either of them; the USENET archive is on screen from the first minute |
| Theo is a random stranger | *"Two girls made me, one summer."* / *"Two girls. Mom… and junebug."* / *"Then they stopped coming. The lighthouse has been almost ready ever since."* Later: *"June. Her name was June. She gave me this beard: 'Theo needs a beard,' she said."* | Theo is a witness who misses them; a character in the game gives the missing girl her name back |
| The three pier switches are a floor puzzle | Theo: *"June built the old pier. Your mother rebuilt the middle, years later, on her own. Neither one reaches the end alone."* Each switch has its own line: *"1998. Her planks — every one a bit wonky, on purpose."* / *"2004. Mom rebuilt this middle part by herself. It's very straight."* / *"June's again. Neither version gets to the end. Together they do."* | The switches tell the whole story in miniature before the player knows it; each Tab means something |
| Suddenly the player *is* someone else | The memory opens with **June taking that photo** at the post: *"Wait — don't move… don't make the face." / "I don't have a face." / "You have exactly one face and you're making it. …Got it. That one's mine."* The card says: *"You are Elena, Mara's mother, at seventeen. The girl with the camera is June."* | The player sees the folded photo being taken, unfolded and happy, and knows something the girls do not |
| June waits to be pressed | If Elena hesitates at the post, June starts carving herself: *"Fine, I'll start. …There. J. Your turn — and try to make the E straight for once."* | June has her own will |
| "The train!" from nowhere | *"The 4:10 to the coast! Miss it and we never see a real lighthouse, and ours stays a white tube."* | A reason to run, and a set-up for the lighthouse dare and chapter 3 |
| The post was just out of reach where the memory starts | Reach widened | No step forward needed to see the prompt |
| Hard cut from the platform into the train | A fade | — |

### Chapter 2 · You Are the View (kept, as the Owner liked it)

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| The lighthouse never showed up; June meant turning round and round | The lighthouse is slower and on a shorter loop and is coming into view when the dare starts; the view turns to each subject; what counts is exactly the drawn frame; the frame turns gold when a picture would count, an arrow points at a subject outside it, and it says "wait until she looks out of the window" for June | The dares become moments with June instead of a search |
| The bikes come from nowhere | June, waking: *"Next stop's ours. Grandma left the bikes at the station. Last one to the real lighthouse fixes the bridge."* | The race starts from a promise |
| The checklist sits over the scene | In the memories the "Next" line shows for 10 s when something changes, then fades; it returns with the help (30 s without progress), after H, or with "Show steps" | Less "led by the nose", without losing the safety net |
| — | Script otherwise unchanged | — |

### Chapter 3 · Our Lighthouse

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| Stuck at the chain | The prompt was off screen behind the camera. It is now at June's bike, says hold E with no need to move, the hints are about the chain, and June fixes it herself after 100 s (*"Some mechanic you are." / "I was supervising."*) | No dead end; a joke if you wait |
| The ride hints were spoken by Elena but said "my chain" | June speaks them | — |
| Fixing a lighthouse with no context | The yard opens with June's post *"the lighthouse gets one crooked window. sky will hate it. sky will build it."* and Mara: *"Mom's reply, nine days later: 'built it. it is still crooked.' This is the day it went in."* | The window becomes their running joke and a promise, before June hands it over |
| The glide line named Space whatever the controls | Uses the player's jump control | — |

### Chapter 4 · A Song Only for You

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| The duet: legs through each other | Side by side on a stool beside her; June stays seated facing forward (she used to stand up and turn into Elena) | — |
| The song has no history | The cottage opens with skylark's post *"wrote a melody for the lighthouse. it does not end properly yet."* Mara: *"She never finished it. I've heard her hum the first half my whole life."* | The porch line *"It still doesn't have an ending"* now lands on both the song and the two of them |

### Chapter 5 · Don't Leave Yourself Here

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| June's news is a surprise to everyone, including the player | The station opens with the summer-build post: *"…june is going away at the end of the month."* Mara: *"She knew. She wrote it down like a bug report."* | Dramatic irony: the player watches the last afternoon knowing it is the last |

### Chapter 6 · You Remember, So Do I

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| The 2004 confrontation starts cold | The cottage opens with the 2004 posts: the public build credited only to skylark, *"The pier is closed. The lighthouse is finished."*, the summer build "cancelled by its author", and June's reply *"The window is mine. Iris is mine. Half of this town is mine. My name is not on it any more."* Mara: *"Four days later. Then Mom drove out to the cottage."* | The player arrives knowing the harm; June's coldness is understood, not unexplained |

### Chapter 7 · Let Summer End

| RC2 problem | RC3 change | Expected experience |
|---|---|---|
| Restoring Iris was a task | After the drafts, June's own post: *"Iris bakes all summer and then she gets on the boat. that is her ending. please do not make her stay."* Mara: *"And in 2004 Mom made her stay. That I can give back too."* | Giving Iris her ending is keeping June's wish |
| The opening question is never closed | *"I unfold the photo and stand it against the screen. Both of them, this time."* (whichever choice about the drafts) | The folded photo, the first image of the game, is the last act before the town |
| Theo's lines in this chapter are still mostly instructions | **Not changed** | — |

## 4 · Pacing

Bot time is the scripted player's game time, with dialogue skipped as fast as possible. **It is not human time.**

| Ch | Beats (bot time, RC3 final) | Carrying interaction |
|---|---|---|
| 1 | study 13 s, town 24 s, pier 15 s, carve 7 s, chase 9 s | unfold the photo; read how they met; give the bridge back; the pier that only reaches the end in both versions; the photo, the carving; catch her hand |
| 2 | train 47 s | the dares with June; holding still for her sketch; her hand in the tunnel |
| 3 | ride 63 s, yard 30 s, beam 13 s, cliff 13 s | the race and the chain; her crooked window; finding her with the beam |
| 4 | cottage 15 s, duet 49 s, porch 11 s | the boat she guides; the duet; the stars; "June, I—" / "I know." |
| 5 | depart 54 s, alone 14 s | her suitcase; the last words; the same bench, alone |
| 6 | cottage 19 s, beach 46 s | her boxes; the letter; walking beside her |
| 7 | study 5 s, town 96 s | the drafts; her name back; Iris's ending; the lamp; snow made new; the new planks |

Total bot time 9.0 min (the bot skips every line at once, so the new archive lines barely show here). The Owner's target is 35–45 min of real play. Whether RC3 reaches it is **unknown** until a
person plays it (the playtest page records chapter times locally).

## 5 · What RC3 still does not do

1. **No person has read any of it.** Whether the folded photo and the posts make an outsider care is the question for
   the Owner's next play.
2. **Characters still mostly wait.** June now starts the carving on her own and fixes her chain if left alone, but in
   most scenes nobody acts between prompts. This is the largest remaining gap.
3. **The photo dares are now easy.** They were a search; they are a moment. A photo as a choice of which memory to keep
   would be new gameplay and is not in RC3.
4. **The pier still needs three switches.** Each now has a meaning; the layout itself was not changed.
5. **Chapter 7's Theo and the 2004 talks are unchanged.**
6. **Model clipping was fixed only where the Owner saw it (the duet).** No full audit on a real GPU.
