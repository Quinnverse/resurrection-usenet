/*
 * P3 strings in English (en) and Chinese (zh). Both languages must have the same keys
 * (checked by test/p3-level.test.js). UMD: window.P3I18n in the browser, module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.P3I18n = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var en = {
    title: 'A Life in Fragments',
    subtitle: 'A short level about a game your mother left behind.',
    start: 'Start',
    continueGame: 'Continue',
    newGame: 'New game',
    resetSave: 'Erase saved progress',
    languageButton: '中文',

    roomIntro: 'Your mother\u2019s room. Dust on the desk. The old computer in the corner still hums when you press the power button. The screen lights up: "Welcome back."',
    roomHint: 'Walk to the computer and press E (or tap Use).',
    roomUse: 'Use',
    computerTitle: 'Moonlight Hop (1998)',
    computerBody: 'Her game is still on the disk. Jump across the night sky and collect the stars. Something about the last part of the map is wrong.',
    computerPlay: 'Play',
    computerBack: 'Back to room',

    signText: 'Stars are for keeping. Press the arrow keys to walk, Space to jump.',
    hiddenStar: 'A star nobody drew on the map. She must have hidden it for someone.',
    wallText: 'The game stops here. The part of the level past this wall is missing.',
    wallHint: 'Open the server console (R) to look for it.',
    gapText: 'The lab route ends in empty air. The rest of the level is still on the archive server.',
    fallText: 'You fell. Back to the last solid ground.',
    starCount: 'Stars: {n}',
    deathCount: 'Falls: {n}',

    consoleTitle: 'Two servers still remember this game',
    consoleLab: 'Lab server',
    consoleLabBody: 'Keeps the first half of the level: the path past the wall.',
    consoleArchive: 'Archive server',
    consoleArchiveBody: 'Keeps the ending: the house, and the door at the end.',
    statusMissing: 'Missing',
    statusRestored: 'Restored',
    restoreLab: 'Restore lab route',
    restoreArchive: 'Restore archive',
    consoleClose: 'Close',
    archiveLocked: 'The archive cannot answer until the lab route is back.',
    logLabRestored: 'Lab route restored. The wall is gone.',
    logArchiveRestored: 'Archive ending restored.',
    logAlready: 'Already restored.',

    noteTitle: 'A note from the developer',
    noteBody: 'Mom wanted to be a game designer. She drew this level, hid a star in the sky, and wrote an ending she never got to play.',
    noteJoke: 'If someone really made it this far, then my game is at least not so bad that nobody finished it.',
    noteNext: 'Continue',

    islandTitle: 'The island',
    islandBody: 'The world grew while you walked. Everything here came from fragments you put back.',
    islandTree: 'A tree from the lab seed',
    islandHouse: 'The house from the archive',
    islandMemory: 'Her photo, found in the hidden star',
    islandConsole: 'A console. It still turns on.',
    consoleMessage: 'Thank you for coming back for me. Shall we go on the next adventure together?',
    consoleReadAgain: 'Read again',
    completeTitle: 'Level complete',
    completeReward: 'Reward unlocked: the island.',
    replayButton: 'Play again',

    controlsKeyboard: 'Keyboard: \u2190 \u2192 move, Space jump, E use, R server console',
    controlsTouch: 'Touch: use the buttons below the game',
    touchLeft: 'Left',
    touchRight: 'Right',
    touchJump: 'Jump',
    touchUse: 'Use',
    touchConsole: 'Servers',
    skipScene: 'Skip',
    saveNotice: 'Progress is saved in this browser.',
    saveCorrupt: 'The saved progress could not be read, so a new game started.',
    langLabel: 'Language',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    motionFull: 'Motion: full',
    motionReduced: 'Motion: reduced',
    roomPromptComputer: 'Press E to use the computer.',
    roomPromptPhoto: 'Press E to look at the photo.',
    photoCaption: 'A photo of her at this desk, sketching a level on graph paper. In the corner of the sketch she wrote: "a star for someone".'
  };

  var zh = {
    title: '碎片中的一生',
    subtitle: '一个关于母亲留下的旧游戏的短关卡。',
    start: '开始',
    continueGame: '继续',
    newGame: '新游戏',
    resetSave: '清除存档',
    languageButton: 'English',

    roomIntro: '母亲的房间。书桌上落满灰尘。角落里那台旧电脑按下电源后还在嗡嗡作响，屏幕亮起：「欢迎回来。」',
    roomHint: '走到电脑旁，按 E（或点击“使用”）。',
    roomUse: '使用',
    computerTitle: '月光跳跳（1998）',
    computerBody: '她的游戏还在磁盘里。在夜空中跳跃，收集星星。地图的最后一段好像不对劲。',
    computerPlay: '开始玩',
    computerBack: '回到房间',

    signText: '星星是用来收藏的。方向键移动，空格跳跃。',
    hiddenStar: '地图上没有画的一颗星。她一定是特意为某个人藏的。',
    wallText: '游戏在这里停住了。墙后面的那一段关卡不见了。',
    wallHint: '打开服务器控制台（R），去找找看。',
    gapText: '实验室路线在这里变成了空白。剩下的关卡还在档案服务器上。',
    fallText: '你掉下去了。回到最近的地面。',
    starCount: '星星：{n}',
    deathCount: '坠落：{n}',

    consoleTitle: '还有两台服务器记得这个游戏',
    consoleLab: '实验室服务器',
    consoleLabBody: '保存游戏的前半段：墙后面的那条路。',
    consoleArchive: '档案服务器',
    consoleArchiveBody: '保存结局：房子，以及尽头的门。',
    statusMissing: '缺失',
    statusRestored: '已恢复',
    restoreLab: '恢复实验室路线',
    restoreArchive: '恢复档案结局',
    consoleClose: '关闭',
    archiveLocked: '档案服务器要先等实验室路线恢复后才能回应。',
    logLabRestored: '实验室路线已恢复。墙不见了。',
    logArchiveRestored: '档案中的结局已恢复。',
    logAlready: '已经恢复过了。',

    noteTitle: '开发者留言',
    noteBody: '妈妈想当游戏设计师。她画了这一关，在天上藏了一颗星，还写好了一个她没能玩到的结局。',
    noteJoke: '如果有人真的玩到了这里，说明我的游戏至少没有烂到没人通关。',
    noteNext: '继续',

    islandTitle: '小岛',
    islandBody: '你走的每一步，这个世界都在长大。这里的一切，都来自你找回的碎片。',
    islandTree: '从实验室种子长出的树',
    islandHouse: '从档案里找回的房子',
    islandMemory: '在隐藏星星里找到的她的照片',
    islandConsole: '一台控制台。它还能开机。',
    consoleMessage: '谢谢你为我回来。我们下一次一起去冒险，好吗？',
    consoleReadAgain: '再读一遍',
    completeTitle: '关卡完成',
    completeReward: '奖励解锁：小岛。',
    replayButton: '再玩一次',

    controlsKeyboard: '键盘：← → 移动，空格跳跃，E 使用，R 服务器控制台',
    controlsTouch: '触屏：使用游戏下方的按钮',
    touchLeft: '左',
    touchRight: '右',
    touchJump: '跳',
    touchUse: '使用',
    touchConsole: '服务器',
    skipScene: '跳过',
    saveNotice: '进度保存在这个浏览器中。',
    saveCorrupt: '无法读取已保存的进度，已开始新游戏。',
    langLabel: '语言',
    soundOn: '声音：开',
    soundOff: '声音：关',
    motionFull: '动态：完整',
    motionReduced: '动态：减少',
    roomPromptComputer: '按 E 使用电脑。',
    roomPromptPhoto: '按 E 仔细看照片。',
    photoCaption: '照片里她坐在这张桌前，在方格纸上画关卡。草图角落写着：「一颗给某个人的星」。'
  };

  var dictionaries = { en: en, zh: zh };

  // Returns the string for a key, with {name} placeholders replaced from vars. Missing keys return the key itself.
  function t(lang, key, vars) {
    var dict = dictionaries[lang] || en;
    var text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, function (m, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
      });
    }
    return text;
  }

  function keysOf(dict) {
    return Object.keys(dict).sort();
  }

  return {
    languages: ['en', 'zh'],
    dictionaries: dictionaries,
    t: t,
    keysOf: keysOf
  };
});
