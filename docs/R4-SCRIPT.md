# Resurrection V5 — R4 剧本（序章、尾声、章节呼应）

自动生成：`node tools/r4-export-script.mjs`。对白取自游戏本身的对白表和双语词典，改游戏就改这里（`--check` 会发现不同步）。每个场景的制作说明（时间、人物目标、冲突、镜头、声音、结束条件、因果理由）写在生成脚本里。七章的原有剧本见 `V5-SCRIPT.md`，未删减。

**一条因果链**：失去母亲 → 无法和解（厨房）→ 发现秘密（空房子、书房、软盘与折起的照片）→ 认识过去的母亲（恢复工具里的两个署名；1998 年的拍照）→ 见证她与琳（第一至第五章）→ 发现伤害（第六章）→ 恢复被抹去的存在（第七章：署名、艾瑞丝、灯塔）→ 学会面对失去（尾声）。

---

## 序章 PROLOGUE — THE WORDS WE NEVER SAID　《没能说完的话》

### 场景 A · 最后一次争吵 (`P.kitchen`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 2026 年 2 月 15 日，周日晚。妈妈家的厨房，下雨。离埃莱娜去世还有数月；这是母女最后一次见面。 |
| 出场人物 | 玛拉（26，玩家）。埃莱娜（45，灰发盘髻，戴老花镜；玩家看到的是 2026 年的她，与 1998/2004 年的十七岁、二十三岁形象不同）。 |
| 人物当前目标 | 玛拉：问清照片里的女孩，和那台不让她碰的电脑。埃莱娜：保护玛拉，也保护自己，不想在今晚说出口。 |
| 玩家已知信息 | 一无所知，只知道今天要吃晚饭（任务栏：周日，回妈妈家吃晚饭）。 |
| 场景冲突 | 玛拉周一就要去数字档案馆上班，觉得自己终于能认真地追问；埃莱娜一再回避。争吵的真实原因：照片里的女孩是琳，电脑里是她和琳共同做的游戏，以及 2004 年她对琳做过的事。两人都有道理：玛拉被拒之门外，埃莱娜背着无法启齿的亏欠。 |
| 玩家操作 | 自由走动并观察 5 处环境（外套、窗、冰箱、书房门、水壶）；走近埃莱娜按 E 开始对话；三处二选一（轻声问/逼问；你从没信任过我/行，你留着吧；说再见/不说话）；最后走到前门。前门在对话前会说“还不行”。 |
| NPC 主动行为 | 埃莱娜在玩家进门约 2.6 秒后先开口（“你都淋透了”）；玩家在门口停留 15 秒她会催（“打算在门口站一晚上？”）；水壶尖叫时她中断自己的话；对话后走到门边送行。 |
| 镜头与动画 | 稳定的近景切换：玛拉 / 埃莱娜 / 厨房全景；没有手持晃动。表情：埃莱娜在“我做过一件事”处沉下去；玛拉在“你最会留着东西了”处发硬。 |
| 音效和环境 | 雨声（低频底噪＋玻璃上的高频雨点），窗上雨痕向下流，暖色吊灯对冷蓝窗光；音乐几乎没有（cottage04 主题极轻）；水壶尖叫作为打断；关门声。 |
| 场景结束条件 | 玩家走到前门并说完最后一句（或沉默）。屏幕出现“那是我最后一次见到她。” |
| 进入下一场景的因果理由 | 玛拉离开。八个月后她回来清空房子——这是她必须回到这里的现实原因。 |

**选择如何影响后文（不改变事实）**：第一处决定埃莱娜回答的措辞；第二处决定玛拉的指责方式；第三处“妈，我走了”/沉默，会在答录机之后、第五章车站、尾声中以不同措辞再次出现。三种选择都不改变：埃莱娜没有说完，水壶尖叫，玛拉离开，这是最后一次见面。

**`p.k.talk`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | I start at the archive on Monday. The digital one, by the university. | 我周一去档案馆上班了。大学旁边那家，做数字存档的。 |
| Mom <sub>mother</sub> | That’s good. Somebody should look after old things properly. | 挺好的。旧东西，总得有人好好照看。 |
| Mara <sub>mara</sub> | First thing they told us: nearly everything people put online in the nineties is still somewhere. Somebody kept a copy. | 他们第一天就跟我们说：九十年代人们放到网上的东西，几乎都还在某个地方。总有人留了一份。 |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | Is that so. | 是吗。 |
| Mara <sub>mara</sub> | It made me think of the photo. The girl on the pier, with the camera. You took it out of my hands when I was nine. | 这让我想起那张照片。码头上那个拿相机的女孩。我九岁那年，你从我手里把它抽走了。 |
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | That was a long time ago, Mara. | 那是很久以前的事了，玛拉。 |
| **CHOICE** `pk1` | 1. Ask gently: “Who was she?”<br>2. Push: “Why do you hide everything?” | 1. 轻声问：“她是谁？”<br>2. 逼问：“你为什么什么都要藏？” |

**`p.k.a`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | I’m not angry. I just want to know who she was. | 我没生气。我只是想知道她是谁。 |
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | A friend. We made something together, one summer. It didn’t end well. | 一个朋友。有一年夏天，我们一起做过一样东西。结局不太好。 |

**`p.k.b`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | Why do you hide everything? The photo, that room, your whole life before me. | 你为什么什么都要藏？那张照片，那个房间，你在有我之前的整个人生。 |
| Mom <sub>mother</sub> | I’m not hiding. Some things are just… finished. | 我没在藏。有些事情只是……已经结束了。 |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | She was a friend. We made something, one summer. It didn’t end well. | 她是个朋友。有一年夏天，我们一起做过一样东西。结局不太好。 |

**`p.k.mid`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | Made what? | 做了什么？ |
| Mom <sub>mother</sub> | Nothing that matters now. | 现在都不重要了。 |
| Mara <sub>mara</sub> | Is it on that computer? The one I was never allowed to touch? | 在那台电脑里吗？那台我从来不许碰的电脑？ |
| *pause 1.2 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | Mara. | 玛拉。 |
| **CHOICE** `pk2` | 1. Say: “You’ve never trusted me with anything.”<br>2. Say: “Fine. Keep it.” | 1. 说：“你从来没信任过我。”<br>2. 说：“行。那你就留着吧。” |

**`p.k.c`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | You’ve never trusted me with anything. Not once. Not about you. | 你从来没信任过我。一次都没有。关于你自己的事，一件都没有。 |
| Mom <sub>mother</sub> | That isn’t — it isn’t about trust. | 不是……这跟信不信任没关系。 |

**`p.k.d`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | Fine. Keep it. You’re good at keeping things. | 行。那你就留着吧。你最会留着东西了。 |
| Mom <sub>mother</sub> | That’s not fair. | 这么说不公平。 |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | …It isn’t wrong, either. | ……可也不算说错。 |

**`p.k.kettle`**

| | English | 中文 |
|---|---|---|
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | Back then I did something. To someone. And I have never found a way to say it out loud, not even to — | 那时候我做过一件事。对一个人。我一直找不到办法把它说出口，哪怕是对—— |
| [screen] <sub>kitchen</sub> | (The kettle starts to scream.) | （水壶尖叫起来。） |
| *pause 1.4 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | …Tea? | ……喝茶吗？ |
| Mara <sub>mara</sub> | I’m going. | 我走了。 |
| Mom <sub>mother</sub> | It’s pouring. Stay till it stops. | 外面下这么大。等雨停了再走吧。 |
| Mara <sub>mara</sub> | It won’t stop. | 停不了的。 |

**`p.k.door`**

| | English | 中文 |
|---|---|---|
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| **CHOICE** `pk3` | 1. Say: “Bye, Mom.”<br>2. Say nothing | 1. 说：“妈，我走了。”<br>2. 什么也不说 |

**`p.k.byeA`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | Bye, Mom. | 妈，我走了。 |
| *pause 0.9 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | Take care on the road. | 路上小心。 |

**`p.k.byeB`**

| | English | 中文 |
|---|---|---|
| *pause 1.8 s* | *(silence)* | *（沉默）* |
| Mom <sub>mother</sub> | Take care on the road. | 路上小心。 |

### 场景 B · 葬礼之后 (`P.house`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 2026 年 10 月。同一间厨房，空了、灰了，没有雨。 |
| 出场人物 | 玛拉；答录机里的声音（租房中介、邻居露丝、妈妈）。 |
| 人物当前目标 | 在 10 月 31 日前清空房子，交还钥匙。 |
| 玩家已知信息 | 妈妈已去世（通过环境交代：慰问卡“1981—2026”、中介留言“节哀”、露丝说“追悼会办得很好”、纸箱、挂历停在二月）。没有任何长篇旁白，也没有死亡画面。 |
| 场景冲突 | 玛拉带着怨气回来，却在答录机里听到妈妈 2 月 16 日留下的话——妈妈其实在回应她，而她没有去。 |
| 玩家操作 | 第一次获得完整的自由移动。可看 8 处环境；必须做的只有三件：听答录机、拿钥匙、打开书房。 |
| NPC 主动行为 | 无人在场；答录机的红灯在闪，是房间里唯一“主动”的东西。 |
| 镜头与动画 | 平静的跟随镜头，没有强制特写；灰白日光，色调比序章 A 冷淡、安静。 |
| 音效和环境 | 很轻的房间底噪，没有雨；答录机提示音；开门声。 |
| 场景结束条件 | 听完留言、拿到钥匙、打开书房门。书房门在听留言前会说“答录机还在闪，我先听完”。 |
| 进入下一场景的因果理由 | 钥匙是妈妈留下的；那扇“她总是锁着”的门现在由玛拉自己打开。 |

**`p.h.machine`**

| | English | 中文 |
|---|---|---|
| [screen] | Three messages. | 三条留言。 |
| Answering machine | “Ms Vance, it’s Harbour Lettings. Just a reminder: the house has to be cleared and the keys back by the thirty-first. Sorry again for your loss.” | “万斯女士，这里是港湾租房中介。提醒您一下：房子需要在三十一号之前清空，钥匙也请那天交回。再次为您的不幸致哀。” |
| Answering machine | “Mara, love, it’s Ruth from next door. The service was lovely. She’d have hated the flowers. There are boxes on my porch if you want them.” | “玛拉，孩子，我是隔壁的露丝。追悼会办得很好。那些花她肯定会嫌太多。纸箱我放在门廊上了，要用就来拿。” |
| [screen] | Saved message. Sixteenth of February. | 已保存的留言。二月十六日。 |
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| Answering machine | “It’s me. You left your scarf. …And about the photo. Her name was — (a long breath) — not on a machine. Come Sunday? I’ll make pancakes. I’ll burn them.” | “是我。你围巾落下了。……还有那张照片。她叫——（长长地吸了一口气）——不该在电话里说。周日过来吧？我做松饼。我会烤焦的。” |
| *pause 1.4 s* | *(silence)* | *（沉默）* |
| Mara <sub>mara</sub> | I didn’t go that Sunday. Or the one after. I kept thinking there would be another one. | 那个周日我没去。下一个也没去。我总以为还会有下一个。 |
| Mara <sub>mara</sub> | The last thing I said to her was “Bye, Mom”, like it was any other night. | 我对她说的最后一句话是“妈，我走了”，就好像那只是平常的一个晚上。 |

**`p.h.open`**

| | English | 中文 |
|---|---|---|
| Mara <sub>mara</sub> | You never let me in here, Mom. | 你从来不让我进这里，妈妈。 |
| Mara <sub>mara</sub> | So I’m letting myself in. | 所以这一次，我自己进来了。 |

### 场景 C · 母亲的书房 (`1.study`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 同一天傍晚，书房，黄昏光线。 |
| 出场人物 | 玛拉。 |
| 人物当前目标 | 弄清楚妈妈瞒了她什么。起初是带着怨气的“检查”，慢慢变成“认识她”。 |
| 玩家已知信息 | 照片里的女孩；“给 M.，等她问起的时候”；那台电脑；妈妈最后一通电话。 |
| 场景冲突 | 玛拉发现自己对母亲了解得很少：一本有两种笔迹的设计手稿、一个写着“J.”的空信封、她六岁时画的歪歪的灯塔——妈妈说“你画的才是对的”。 |
| 玩家操作 | 自由探索（顺序不限，没有强制收集）：书架、照片、窗、画、台灯、手稿、信封；KEEP 盒里有备份软盘、纸条和折起的照片；最后走到电脑前。 |
| NPC 主动行为 | 无（物件之间互相呼应：手稿里的“Theo needs a beard!!”呼应 1998 年的帖子；“J.”信封呼应尾声）。 |
| 镜头与动画 | 第三人称，距离略近；窗光压低；CRT 屏幕开机闪烁。 |
| 音效和环境 | 房间底噪，旧电脑开机声。 |
| 场景结束条件 | 拿到软盘后在电脑前按 E，打开恢复工具。 |
| 进入下一场景的因果理由 | 玛拉说出了问题：“妈妈，你为什么从来不提她的名字？”答案只能在这台电脑里。 |

（对白见 RC3 剧本 `c1.disk`；R4 改动：玛拉在展开照片时认出“我九岁时妈妈从我手里抽走的那张”；新增“我问过的。二月那天。她去烧了水。”）

### 场景 D · 恢复档案 (`P.restore`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 书房，Mom 的 CRT 电脑前（固定在玛拉身侧的近景）。屏幕上是游戏内虚构的“LAST LIGHT 档案工具 v0.3”，并明确写着“游戏内虚构：虚构的恢复工具与虚构的档案”。 |
| 出场人物 | 玛拉（画外）。 |
| 人物当前目标 | 读出软盘里还剩下什么。 |
| 玩家已知信息 | 软盘、两份公开副本、被折起的照片。 |
| 场景冲突 | 1998 年的夏季版已从公开档案撤销（2004-03-03 01:14 的取消通知）；公开档案里残存的附件副本被截断或剥掉，只有软盘完好。两个版本的署名对不上：1998 年是 skylark 与 junebug，2004 年只剩 skylark。 |
| 玩家操作 | 按住 E 读取软盘 → 用 W/S 选择记录、E 打开（找到两人如何相识的两条帖子）→ 选中损坏的夏季版，按住 E 修复（屏幕上的乱码一点点恢复成署名行）→ 打开 2004 年公开版，对照署名 → 可选：打开“被移除的记录” → 玛拉提出两个问题 → 按住 E 运行夏季版。 |
| NPC 主动行为 | 无；屏幕自己在“说话”：损坏记录呈红色、乱码，修复时逐字恢复。 |
| 镜头与动画 | 固定在玛拉身侧偏后；CRT 绿光与书房暖光对比；记录列表与进度条是 DOM 叠层。 |
| 音效和环境 | 开机闪烁、拨号“modem”声、修复提示音、“被拒绝”的短音。 |
| 场景结束条件 | 按住 E 运行 summer-0.9。 |
| 进入下一场景的因果理由 | 玛拉的两个问题：“为什么妈妈从未提起 June？为什么后来的游戏只留下 Elena 的名字？”想要答案，就得走进 1998 年。 |

**`p.r.met`**

| | English | 中文 |
|---|---|---|
| [screen] | alt.games.homebrew · skylark · 18 Apr 1998 · “Last Light — a small game about a lighthouse (artist wanted)”: “I can code and I can write music. I cannot draw a seagull. Anyone?” | alt.games.homebrew · skylark · 1998 年 4 月 18 日 ·《Last Light——一个关于灯塔的小游戏（征美术）》：“我会写代码，也会写曲子。我画不出一只海鸥。有人吗？” |
| [screen] | junebug · the next morning: “I can draw you a seagull. I can draw you the whole town, and I will write the people in it. Theo needs a beard. Also a baker.” | junebug · 第二天早上：“我能给你画海鸥。我能给你画整个小镇，还会把镇上的人写出来。西奥需要一把胡子。还要一个面包师。” |
| Mara | That’s how they met. Mom asked a newsgroup for a seagull, and somebody offered her a town. | 她们就是这样认识的。妈妈在新闻组里求一只海鸥，有人送了她一整座小镇。 |
| Mara | skylark was Mom’s name online. And junebug… is the girl in the photo. | skylark 是妈妈在网上的名字。而 junebug……就是照片里那个女孩。 |

**`p.r.b98`**

| | English | 中文 |
|---|---|---|
| [screen] | LLMANIFEST build summer-0.9 · era 1998 · credit skylark: programming, music · credit junebug: art, story | LLMANIFEST 构建 summer-0.9 · 年代 1998 · 署名 skylark：程序、音乐 · 署名 junebug：美术、故事 |
| Mara | Two names. skylark is Mom. junebug — art, story. The whole town was hers. | 两个名字。skylark 是妈妈。junebug——美术、故事。整座小镇都是她画的。 |

**`p.r.b04`**

| | English | 中文 |
|---|---|---|
| [screen] | LLMANIFEST build public-1.0 · era 2004 · credit skylark: programming, music, art, story | LLMANIFEST 构建 public-1.0 · 年代 2004 · 署名 skylark：程序、音乐、美术、故事 |
| Mara | Six years later there’s one name. Hers. Art and story too. | 六年后，只剩一个名字。她的。连美术和故事也写在她名下。 |

**`p.r.gone`**

| | English | 中文 |
|---|---|---|
| [screen] | The summer build was taken out of the public archive two minutes after 1.0 went up. Only this disk still has it. | 1.0 发布两分钟后，夏季版就从公开档案里被撤掉了。只有这张软盘里还留着。 |
| Mara | Somebody didn’t want the two versions side by side. | 有人不想让这两个版本并排摆在一起。 |

**`p.r.question`**

| | English | 中文 |
|---|---|---|
| *pause 0.8 s* | *(silence)* | *（沉默）* |
| Mara | Why did you never say her name, Mom? | 妈妈，你为什么从来不提她的名字？ |
| Mara | And why is only yours on the later one? | 后来那一版，为什么只剩你的名字？ |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mara | “For M., when she asks.” I asked. You put the kettle on. | “给 M.，等她问起的时候。”我问过了。你去烧了水。 |
| Mara | Okay, Mom. Show me what you two made. | 好吧，妈妈。给我看看你们俩做了什么。 |
| [screen] | RUN summer build 0.9 from the backup? The public copies are damaged; the disk build reaches the end of the old pier. | 从备份运行夏季版 0.9？公开副本已损坏；软盘里的版本能走到旧码头的尽头。 |

### 场景 E · 进入 1998 年 (`P.summer`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 1998 年夏，旧码头尽头，傍晚。画面从灰暗的现实淡入明亮的暖色（整屏去饱和 → 彩色的渐变）。 |
| 出场人物 | 十七岁的埃莱娜（玩家）、琳（十七岁，拿着相机）、画外的玛拉。 |
| 人物当前目标 | 琳：给埃莱娜拍那张照片。埃莱娜：别被拍。 |
| 玩家已知信息 | 这是 Elena 的过去；琳是和她共同做游戏的人；玛拉正通过恢复的档案重新认识母亲（卡片：“你是埃莱娜，玛拉的妈妈，十七岁……这是重建，不是录像”）。 |
| 场景冲突 | 很轻：一个想被拍、一个不想被拍。真正的冲突在后面：玩家知道照片后来被折起，女孩被藏了起来；两个人此刻并不知道。 |
| 玩家操作 | 走向码头尽头的琳，按 E；对话中二选一（答应搭好码头 / 逗她先画海鸥）；然后跟着琳沿木板往回走。 |
| NPC 主动行为 | 琳先喊“Sky！这边——快点，光线正好！”；举起相机，开玩笑（“你只有一个表情，现在正做着呢”）；拍完主动带路；站着也会自己说话。 |
| 镜头与动画 | 琳的特写；快门声与一次白闪；玛拉的画外音（“就是那张照片”）用双人镜头。 |
| 音效和环境 | 夏季主题（暖、有铃声）、海浪、快门。记录断裂时：故障音＋画面抖动＋色相偏移（减弱动效时只做灰度）。 |
| 场景结束条件 | 玩家跟着琳走回码头，记录在这里断了（“读取错误：summer-0.9 无法单独运行，它要从 public-1.0 载入小镇，而 public-1.0 里没有那座桥”）。 |
| 进入下一场景的因果理由 | 玛拉决定进入 2004 年的版本，把缺的东西放回去，从琳的桥开始——这直接接上第一章（`1.town`）。玩家既想知道两人的关系如何发展，也想知道她们后来为什么决裂。 |

**`p.s.photo`**

| | English | 中文 |
|---|---|---|
| June <sub>june</sub> | Wait — don’t move. Stand by the post. And don’t make the face. | 等一下——别动。站到柱子旁边。别做那个表情。 |
| Elena <sub>elena</sub> | I don’t have a face. | 我哪有什么表情。 |
| June <sub>june</sub> | You have exactly one face and you’re making it. …Got it. That one’s mine. | 你就只有一个表情，现在正做着呢。……拍到了。这张归我。 |
| *pause 0.7 s* | *(silence)* | *（沉默）* |
| Mara <sub>twoshot</sub> | That’s the photo. The one she folded in half. I’m watching it being taken. | 就是那张照片。被她对折起来的那张。我正看着它被拍下来。 |
| June <sub>june</sub> | Look. Theo has his beard now. Two whole pages of beard. | 你看。西奥有胡子了。整整两页的胡子。 |
| Elena <sub>elena</sub> | And I got the lighthouse to compile. It’s a white tube. | 我也把灯塔编译通过了。是根白管子。 |
| June <sub>june</sub> | It’s a very confident white tube. | 一根非常自信的白管子。 |
| Elena <sub>elena</sub> | The pier’s still only half there. | 码头还是只有一半。 |
| June <sub>june</sub> | Then build me the middle. I’ll draw the end, so it has somewhere to go. | 那你把中间给我搭起来。我把尽头画好，让它有个地方可去。 |
| **CHOICE** `ps` | 1. Promise: “I’ll build it.”<br>2. Tease: “Draw me a seagull first.” | 1. 答应她：“我会搭好的。”<br>2. 逗她：“你先给我画只海鸥。” |

**`p.s.a`**

| | English | 中文 |
|---|---|---|
| Elena <sub>elena</sub> | I’ll build it. Promise. | 我会搭好的。说好了。 |
| June <sub>june</sub> | Good. I’m writing that down. In pen. | 很好。我记下来了。用钢笔。 |
| June <sub>june</sub> | Come on, I’ll show you where the planks should go. | 走，我带你看木板该铺在哪儿。 |

**`p.s.b`**

| | English | 中文 |
|---|---|---|
| Elena <sub>elena</sub> | Draw me a seagull first. | 你先给我画只海鸥。 |
| June <sub>june</sub> | I drew you a whole town, Elena. You owe me a pier. | 我给你画了一整座镇子，埃莱娜。你欠我一条码头。 |
| June <sub>june</sub> | Come on, I’ll show you where the planks should go. | 走，我带你看木板该铺在哪儿。 |

**`p.s.break`**

| | English | 中文 |
|---|---|---|
| [screen] | READ ERROR · summer-0.9 cannot run on its own. It loads the town from public-1.0 — and public-1.0 has no bridge. | 读取错误 · summer-0.9 无法单独运行。它要从 public-1.0 载入小镇——而 public-1.0 里没有那座桥。 |
| Mara | Wait — no. It stops here. | 等等——不。到这里就断了。 |
| Mara | So I go into the 2004 version and put the pieces back. Her bridge first. | 那我就进 2004 年的版本，把缺的东西一块块放回去。先从她的桥开始。 |
| Mara | If I put back what’s missing, maybe the rest of that afternoon comes back too. | 要是我把缺的补回去，也许那个下午剩下的部分也会回来。 |


---

## 七章中的回应与新增（原有剧情、事件、互动、结局全部保留）

| 位置 | R4 的改动 | 对白键 |
|---|---|---|
| 第一章 · 镇子 | 回到 2004 年版本时，玛拉说“2004 年的副本。完工了，整整齐齐，大门上只有一个名字。没有 junebug。”随后才是西奥的呼喊。 | `r4.c1.back` |
| 第一章 · 码头 | 西奥不再等玩家按 E：玩家站着不动时他会说话。 | `r4.amb.1.pier.*` |
| 第二章 · 火车 | 琳主动说话（数奶牛、威胁画胡子、担心真灯塔会失望）。对话近景改为过道固定镜头，不再贴到琳身上。 | `r4.amb.2.train.*` |
| 第三章 · 光束 | 琳先说“给我十秒——我去礁石那边。用灯光找到我！”；提示、光圈和目标环都指向真实判定点；A/D 的方向由游戏状态给出。 | `r4.c3.runRocks`, `r4.ui.beam.*` |
| 第三章 · 工地 / 第四章 · 小屋 / 第五章 · 车站 / 第六章 · 小屋 | 琳在玩家停下来时有自己的话，不是任务提示。 | `r4.amb.*` |
| 第五章 · 长凳 | 玛拉回应序章的最后一别：“谁也不知道哪一次是最后一次。”措辞随序章里的选择而变。 | `r4.c5.lastA`, `r4.c5.lastB` |
| 第六章 · 离开小屋 | 琳说“路上小心”之后，玛拉：这是妈妈对我说的最后一句话，原来是琳先说的；以及：“知道她为什么这么做，并不会让这件事变小。琳还是失去了那些年。” | `r4.c6.echo`, `r4.c6.harm` |
| 第七章 · 信与照片 | 玛拉不再在这里展开照片：“照片再折一会儿吧。先把名字放回去。” | `r4.c7.notYet` |

**`c6.echo`**

| | English | 中文 |
|---|---|---|
| Mara | “Take care on the road.” The last thing Mom ever said to me. I never knew they were June’s words first. | “路上小心。”这是妈妈对我说的最后一句话。我从来不知道，这句话最早是琳说的。 |
| Mara | Knowing why she did it doesn’t make it smaller. June still lost those years. | 知道她为什么这么做，并不会让这件事变小。琳还是失去了那些年。 |

---

## 尾声 EPILOGUE — BOTH OF THEM　《照片里的两个人》

### 场景 F · 照片里的两个人 (`E.study`)

| 项目 | 内容 |
|---|---|
| 时间与地点 | 现在（第七章之后的同一个晚上），书房，窗外的天黑下来，台灯亮着。 |
| 出场人物 | 玛拉。 |
| 人物当前目标 | 把这一晚收尾；决定怎么对待那张照片。 |
| 玩家已知信息 | 全部七章：埃莱娜如何爱她、如何伤害她；署名已恢复；艾瑞丝已离开；初雪是新创作，不是复活。 |
| 场景冲突 | 玛拉没有“原谅一切”的捷径：信里没有求原谅，也没有说“妈妈没有错”。她要做的是认识一个真实而不完美的人。 |
| 玩家操作 | 按住 E 展开折起的照片；打开 KEEP 盒的衬布，读信；在电脑前按 E 结束。屏幕上的版本列表写着：1998 未改动、2004 未改动、2026 现世版署名两人加修复者。 |
| NPC 主动行为 | 无人；墙上、桌上的东西早已安排好。 |
| 镜头与动画 | 照片展开动画（缩放、略微旋转），最后立在屏幕旁；关灯。 |
| 音效和环境 | 书房底噪，旧电脑，展开的纸声＋三个轻轻的上行音；灯关掉的“咔”。 |
| 场景结束条件 | 玩家在电脑前按 E，说完最后的话，字幕滚动。 |
| 进入下一场景的因果理由 | 序章提出的问题全部有了回答，但没有一个靠超自然手段：信是二月十六日（打完电话的第二天）写的，一直压在箱子衬布下面。 |

**信的内容与第六章一致**：埃莱娜承认“发行商只要一个名字，我给了他们我的”，承认“这让她丢了一份工作，丢了好几年”，承认“我把她折到照片背后……是为了让自己不必去看我做过的事”；她不求原谅，只说“别把我想得比我本来更好。只是，别再把她折起来了”。

**`p.e.photo`**

| | English | 中文 |
|---|---|---|
| [screen] | (Mara unfolds the photo all the way.) | （玛拉把照片完全展开。） |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mara | Mom on the left, squinting, making the face. June on the right, laughing at her. | 左边是妈妈，眯着眼，正做着那个表情。右边是琳，在笑她。 |
| Mara | I’m not folding it back. | 我不会再把它折回去了。 |

**`p.e.letter`**

| | English | 中文 |
|---|---|---|
| Mara | The felt that lined the box lifts. Under it, an envelope. Not “J.” — “M.” Dated the sixteenth of February. | 箱子里的衬布可以掀起来。下面压着一个信封。写的不是“J.”——是“M.”。日期是二月十六日。 |
| [screen] | “M. — You asked who she was, and I put the kettle on. I’m sorry. Her name is June. We made a game when we were seventeen, and it was the best thing I ever made, because half of it was hers.” | “M.——你问我她是谁，我却去烧了水。对不起。她叫琳。我们十七岁那年一起做了一个游戏，那是我这辈子做过最好的东西，因为它有一半是她的。” |
| [screen] | “In 2004 a publisher wanted one name, and I gave them mine. I told myself it didn’t matter, because I was the one who stayed. It cost her a job, and years. I never put it right.” | “2004 年，发行商只要一个名字，我给了他们我的。我跟自己说这没什么，因为留下来的人是我。可这让她丢了一份工作，丢了好几年。我从来没有弥补过。” |
| [screen] | “I didn’t fold her out of the photo to hide her from you. I did it so I wouldn’t have to look at what I’d done. Don’t make me better than I was. Just don’t fold her away. — Mom” | “我把她折到照片背后，不是为了瞒着你。是为了让自己不必去看我做过的事。别把我想得比我本来更好。只是，别再把她折起来了。——妈妈” |
| *pause 1.4 s* | *(silence)* | *（沉默）* |
| Mara | She wrote it the day after. The same day she called. | 她是第二天写的。就是她打电话来的那天。 |

**`p.e.final`**

| | English | 中文 |
|---|---|---|
| Mara | I came back to this house angry, because you never told me anything. | 我回到这栋房子的时候，满肚子火，因为你什么都不告诉我。 |
| Mara | You did tell me. You just did it the slowest way there is. | 其实你告诉我了。只是用了最慢的那种方式。 |
| Mara | I’m not going to make you better than you were. Or worse. | 我不会把你想得比你本来更好。也不会更坏。 |
| *pause 1 s* | *(silence)* | *（沉默）* |
| Mara | I finally met the real you, Mom. Not perfect. Real. | 妈妈，我终于认识了一个真实而不完美的你。 |
| Mara | Bye, Mom. Properly, this time. | 妈，我走了。这一次，是好好地道别。 |
| [screen] | (She stands the photo against the screen, and switches off the lamp.) | （她把照片立在屏幕前，关掉了台灯。） |

---

## 旧版本的存档

RC3 或更早的存档继续可用：它们的 beat 都在原有的七章内；游戏能识别并继续。新游戏从 `P.kitchen` 开始；“继续”按钮读取旧存档。
