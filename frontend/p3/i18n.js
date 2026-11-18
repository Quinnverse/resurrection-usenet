/*
 * P3.2 strings, English (default) and Simplified Chinese. Both dictionaries must have identical keys and
 * placeholders (checked by test/p3-core.test.js). Save data never stores text, only ids, so switching language
 * never loses progress. UMD: window.P3I18n / module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3I18n = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var en = {
    'game.title': 'Resurrection — The Internet Remembers You',
    'game.chapter': 'Chapter 1 · The Summer She Was Seventeen',
    'game.tagline': 'Rebuild a life. Discover the person behind the memories.',
    'ui.start': 'Start', 'ui.continue': 'Continue', 'ui.newGame': 'New game', 'ui.saveNote': 'Progress is saved in this browser.',
    'ui.saveCorrupt': 'The saved progress could not be read, so a new game started.',
    'ui.soundOn': 'Sound: on', 'ui.soundOff': 'Sound: off', 'ui.motionFull': 'Motion: full', 'ui.motionReduced': 'Motion: reduced',
    'ui.volume': 'Volume', 'ui.language': '中文',
    'ui.stars': 'Stars {n}/{total}', 'ui.falls': 'Falls {n}',
    'ui.keys': 'Arrows or A D: move · Space: jump · E: use',
    'ui.touch': 'Use the buttons below the picture.',
    'pad.left': 'Left', 'pad.right': 'Right', 'pad.jump': 'Jump', 'pad.use': 'Use',
    'ui.close': 'Close', 'ui.again': 'Play again', 'ui.next': 'Continue', 'ui.skip': 'Skip',
    'zone.study': 'Mom’s study', 'zone.B': 'Summer meadow', 'zone.C': 'The broken bridge', 'zone.D': 'Old servers', 'zone.E': 'Seaside', 'zone.island': 'Memory island',
    'sp.mara': 'MARA', 'sp.elena': 'ELENA', 'sp.sys': 'SYSTEM',

    'say.intro': 'Mom’s study. Nothing has moved in a year. Except the screen. It’s on.',
    'say.shelf': 'A library book slips out. Overdue since 1997. Classic Mom.',
    'say.tape': 'A tape: “DO NOT RECORD OVER (I MEAN IT)”. I’m taking it.',
    'say.tapeAgain': 'Already in my pocket.',
    'say.photo': 'Mom, maybe seventeen, holding a joystick like a trophy.',
    'say.notes': 'TODO: finish bridge. fix jump. make boss less rude. sleep (optional).',
    'say.lamp': 'Click.',
    'say.monitor': 'SUMMER98.EXE. “Press any key to enter 1998.” Okay, Mom.',
    'say.sign0': 'Arrows to move. Space to jump. If it doesn’t work, the bug is your keyboard.',
    'say.cat': 'Cat is not a feature. Cat is a lifestyle.',
    'say.cat2': 'Purring. In 1998 resolution.',
    'say.sign1': 'Water is wet. I tested it. Many times.',
    'say.sign2': 'Jump a little earlier than you think. I fell here forty times.',
    'say.garden': 'CUT CONTENT: secret garden. Reason: nobody will ever find it. (Hi. You found it.)',
    'say.sign3': 'BRIDGE: coming soon. (After lunch. 1998-08-14.)',
    'say.blueprint': 'The bridge is missing. “Build 3,” it says. A game this old… someone must have kept a copy.',
    'say.bridgeNone': 'Nothing to place yet. Maybe the old servers remember it.',
    'say.door': 'A door in the rock. Something old is humming inside.',
    'say.sign4': 'BEYOND THIS POINT: UNFINISHED. (But lovely.)',
    'say.crab': 'The crab walks sideways. As designed.',
    'say.sign5': 'THE END. (You can stop now.)',
    'say.fall': 'Again!',
    'say.checkpoint': 'Checkpoint.',
    'say.serverIntro': 'Three servers. Three different memories of the same bridge.',
    'say.floppy': 'A floppy: ELENA.BAK. She kept backups! ({n}/3)',
    'say.floppyAll': 'All the backups. Mom, you were organised after all.',
    'say.bridgeDone': 'The bridge remembers itself.',

    'copy.archive': 'Archive', 'copy.lab': 'Lab', 'copy.mirror': 'Mirror',
    'copy.date.m3': 'Mar 1998', 'copy.date.m8': 'Aug 1998', 'copy.build': 'Build {n}',
    'copy.archive.note': 'Tidy. One piece is damaged.', 'copy.lab.note': 'Only part of the bridge survived.', 'copy.mirror.note': 'A whole bridge!',
    'copy.take': 'Take', 'copy.putBack': 'Put back', 'copy.pack': 'Backpack {n}/{max}', 'copy.full': 'Backpack full. Put something back.',
    'copy.hint': 'Compare the copies. You can carry only {max} pieces.',
    'piece.left': 'left span', 'piece.mid': 'middle span', 'piece.right': 'right span', 'piece.arch': 'arched span', 'piece.damaged': 'damaged',

    'restore.title': 'Rebuild the bridge',
    'restore.hint': 'Drag a piece onto a gap. Or tap a piece, then a gap.',
    'restore.need': 'Needs build {n}',
    'restore.slot': 'Gap {n}',
    'restore.tray': 'Your pieces',
    'restore.empty': 'No pieces. Look in the server room.',
    'restore.fits': 'Fits!',
    'restore.take': 'Take back',
    'reason.build': 'Wrong build', 'reason.corrupt': 'Damaged data', 'reason.width': 'Wrong length', 'reason.shape': 'Edges don’t match',
    'restore.done': 'The bridge remembers itself.',

    'end.elena1': 'If you\'re reading this, congratulations. You\'re officially the first person to finish my game.',
    'end.elena2': 'Unless you\'re me. In which case, stop cheating.',
    'end.elena3': 'One day, I\'ll make a real one.',
    'end.mara1': 'You never told me you made games.',
    'end.title': 'A message from the developer',

    'isl.title': 'Memory island',
    'isl.grow1': 'The shore remembers itself.', 'isl.grow2': 'A little house.', 'isl.grow3': 'Trees and flowers.', 'isl.grow4': 'A console that still switches on.', 'isl.grow5': 'And the things she kept.',
    'isl.cabin': 'A little house. The kind she drew in the margins of her notebooks.',
    'isl.tree': 'A tree that grew from one pixel of the old game.',
    'isl.console': 'SUMMER98.EXE — LEVEL 2: coming soon. (I promise.)',
    'isl.console2': 'I’ll hold you to that, Mom.',
    'isl.photo': 'Elena at seventeen, grinning like she had already won.',
    'isl.cassette': 'She taped herself humming. Off-key. Perfect.',
    'isl.cat': 'Still not a feature.',
    'isl.jar': 'Stars kept: {n}.',
    'isl.note': 'Cut content, restored.',
    'isl.done': 'Chapter 1 complete. Thank you for remembering with me.',
    'isl.visited': 'Memories visited {n}/{total}'
  };

  var zh = {
    'game.title': 'Resurrection — 互联网记得你',
    'game.chapter': '第一章 · 她十七岁的那个夏天',
    'game.tagline': '重建一段人生，找到记忆背后的那个人。',
    'ui.start': '开始', 'ui.continue': '继续', 'ui.newGame': '新游戏', 'ui.saveNote': '进度保存在这个浏览器中。',
    'ui.saveCorrupt': '无法读取已保存的进度，已开始新游戏。',
    'ui.soundOn': '声音：开', 'ui.soundOff': '声音：关', 'ui.motionFull': '动态：完整', 'ui.motionReduced': '动态：减少',
    'ui.volume': '音量', 'ui.language': 'English',
    'ui.stars': '星星 {n}/{total}', 'ui.falls': '坠落 {n}',
    'ui.keys': '方向键或 A D：移动 · 空格：跳 · E：互动',
    'ui.touch': '使用画面下方的按钮。',
    'pad.left': '左', 'pad.right': '右', 'pad.jump': '跳', 'pad.use': '互动',
    'ui.close': '关闭', 'ui.again': '再玩一次', 'ui.next': '继续', 'ui.skip': '跳过',
    'zone.study': '妈妈的书房', 'zone.B': '夏日草地', 'zone.C': '断桥峡谷', 'zone.D': '旧服务器', 'zone.E': '海边', 'zone.island': '记忆岛',
    'sp.mara': 'MARA', 'sp.elena': 'ELENA', 'sp.sys': '系统',

    'say.intro': '妈妈的书房。一年了，什么都没动过。除了屏幕——它亮着。',
    'say.shelf': '一本图书馆的书滑了出来。逾期，自 1997 年。很妈妈。',
    'say.tape': '一盘磁带：“不许覆盖录音（说真的）”。我带上它。',
    'say.tapeAgain': '已经在口袋里了。',
    'say.photo': '妈妈，大概十七岁，把游戏手柄举得像奖杯。',
    'say.notes': '待办：做完桥。修好跳跃。让 Boss 别那么没礼貌。睡觉（可选）。',
    'say.lamp': '咔哒。',
    'say.monitor': 'SUMMER98.EXE。“按任意键进入 1998。”好吧，妈妈。',
    'say.sign0': '方向键移动，空格跳。不好使？那是你键盘的 bug。',
    'say.cat': '猫不是功能，猫是生活方式。',
    'say.cat2': '在呼噜。1998 年的分辨率。',
    'say.sign1': '水是湿的。我测试过。很多次。',
    'say.sign2': '起跳比你以为的早一点。我在这摔过四十次。',
    'say.garden': '被砍掉的内容：秘密花园。理由：反正没人会发现。（嗨，你发现了。）',
    'say.sign3': '桥：即将完成。（吃完午饭。1998-08-14。）',
    'say.blueprint': '桥不见了。上面写着“版本 3”。这么老的游戏……一定有人留过副本。',
    'say.bridgeNone': '手上还没有碎片。也许旧服务器还记得它。',
    'say.door': '岩壁里有扇门。里面有什么旧东西在嗡嗡响。',
    'say.sign4': '再往前：未完成。（但很美。）',
    'say.crab': '螃蟹横着走。设计如此。',
    'say.sign5': '完。（你可以停下来了。）',
    'say.fall': '再来！',
    'say.checkpoint': '存档点。',
    'say.serverIntro': '三台服务器，对同一座桥有三种不同的记忆。',
    'say.floppy': '一张软盘：ELENA.BAK。她居然做备份！（{n}/3）',
    'say.floppyAll': '备份全找到了。妈妈，你其实挺有条理的。',
    'say.bridgeDone': '桥想起了自己的样子。',

    'copy.archive': '档案库', 'copy.lab': '实验室', 'copy.mirror': '镜像站',
    'copy.date.m3': '1998 年 3 月', 'copy.date.m8': '1998 年 8 月', 'copy.build': '版本 {n}',
    'copy.archive.note': '很整齐，但有一块损坏了。', 'copy.lab.note': '只留下了一部分桥。', 'copy.mirror.note': '一座完整的桥！',
    'copy.take': '拿走', 'copy.putBack': '放回', 'copy.pack': '背包 {n}/{max}', 'copy.full': '背包满了，先放回一块。',
    'copy.hint': '比较这些副本。最多只能带 {max} 块碎片。',
    'piece.left': '左段', 'piece.mid': '中段', 'piece.right': '右段', 'piece.arch': '拱形段', 'piece.damaged': '已损坏',

    'restore.title': '重建这座桥',
    'restore.hint': '把碎片拖到缺口上，或先点碎片再点缺口。',
    'restore.need': '需要版本 {n}',
    'restore.slot': '缺口 {n}',
    'restore.tray': '你的碎片',
    'restore.empty': '没有碎片。去服务器房间找找。',
    'restore.fits': '合上了！',
    'restore.take': '取回',
    'reason.build': '版本不对', 'reason.corrupt': '数据已损坏', 'reason.width': '长度不对', 'reason.shape': '接口对不上',
    'restore.done': '桥想起了自己的样子。',

    'end.elena1': '如果你看到这里，恭喜！你正式成为第一个通关我游戏的人。',
    'end.elena2': '除非你就是我自己。那不算，禁止作弊。',
    'end.elena3': '总有一天，我要做一款真正的游戏。',
    'end.mara1': '你从没告诉过我，你还做过游戏。',
    'end.title': '来自开发者的留言',

    'isl.title': '记忆岛',
    'isl.grow1': '海岸想起了自己。', 'isl.grow2': '一间小屋。', 'isl.grow3': '树和花。', 'isl.grow4': '一台还能开机的游戏机。', 'isl.grow5': '还有她留下的东西。',
    'isl.cabin': '一间小屋，像她画在笔记本边角的那种。',
    'isl.tree': '一棵树，从旧游戏的一个像素里长出来。',
    'isl.console': 'SUMMER98.EXE — 第二关：即将推出。（我保证。）',
    'isl.console2': '我会让你兑现的，妈妈。',
    'isl.photo': '十七岁的 Elena，笑得像已经赢了。',
    'isl.cassette': '她录下了自己哼的歌。跑调了，却刚刚好。',
    'isl.cat': '依然不是功能。',
    'isl.jar': '留下的星星：{n} 颗。',
    'isl.note': '被砍掉的内容，复原了。',
    'isl.done': '第一章完成。谢谢你陪我一起想起她。',
    'isl.visited': '已看过的记忆 {n}/{total}'
  };

  var dictionaries = { en: en, zh: zh };

  function t(lang, key, vars) {
    var dict = dictionaries[lang] || en;
    var text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : (Object.prototype.hasOwnProperty.call(en, key) ? en[key] : key);
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, function (m, name) { return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m; });
    }
    return text;
  }

  return { languages: ['en', 'zh'], dictionaries: dictionaries, t: t, keysOf: function (d) { return Object.keys(d).sort(); } };
});
