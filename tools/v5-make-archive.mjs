// Developer tool: writes the FICTIONAL offline archive fixture used by Resurrection V5 (frontend/v5/data/).
//   node tools/v5-make-archive.mjs
// Every post, person, address and host is invented for the game. Hosts use the reserved .example domain and every
// article carries "X-Fixture: fictional sample for Resurrection V5". Nothing here is a real historical post.
// Formats are real: rnews batches, an mbox export, uuencoded 1998 attachments, a MIME multipart 2004 post.
// The game never runs this script; it parses the generated files with frontend/v5/core/usenet.js.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'frontend', 'v5', 'data');
fs.mkdirSync(out, { recursive: true });
const FIX = 'fictional sample for Resurrection V5';

// ---- helpers, independent of the game's parser --------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) { c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); } return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0'); };
const enc = (n) => String.fromCharCode(n ? n + 32 : 96);
function uuencode(name, buf) {
  const lines = [`begin 644 ${name}`];
  for (let i = 0; i < buf.length; i += 45) { const ch = buf.subarray(i, i + 45); let l = enc(ch.length); for (let j = 0; j < ch.length; j += 3) { const a = ch[j], b = ch[j + 1] || 0, c = ch[j + 2] || 0; l += enc(a >> 2) + enc(((a << 4) | (b >> 4)) & 63) + enc(((b << 2) | (c >> 6)) & 63) + enc(c & 63); } lines.push(l); }
  lines.push(enc(0), 'end'); return lines;
}
const b64lines = (buf) => (buf.toString('base64').match(/.{1,72}/g) || []);
let seed = 1998; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const asset = (lines) => Buffer.from(lines.join('\n') + '\n', 'ascii');

// ---- the assets ---------------------------------------------------------------------------------------------
// June's bridge: fifteen hand-placed planks.
function bridgeLines(omit) {
  seed = 1998;
  const l = ['LLASSET 1 bridge', 'by junebug', 'note planks are hand placed, wonky on purpose. it holds now. -j', 'span 3.20', 'width 2.20', 'rail 0.95'];
  for (let i = 0; i < 15; i++) { const z = (i * 0.2133 + 0.02).toFixed(3), d = (0.17 + rnd() * 0.03).toFixed(3), tilt = ((rnd() - 0.5) * 0.09).toFixed(3), side = ((rnd() - 0.5) * 0.08).toFixed(3), len = (2.12 + rnd() * 0.12).toFixed(3); if (!(omit || []).includes(i)) { l.push(`plank ${z} ${d} ${tilt} ${side} ${len}`); } }
  l.push('post 0.05', 'post 1.60', 'post 3.15', 'end'); return l;
}
const BRIDGE = asset(bridgeLines());
// June's crooked window for the lighthouse: an outline that leans, and a mullion that is not centred.
const WINDOW = asset(['LLASSET 1 window', 'by junebug', 'note it leans. on purpose. do not straighten it. -j', 'width 1.10', 'height 1.40',
  'point -0.52 -0.70', 'point 0.55 -0.66', 'point 0.47 0.70', 'point -0.58 0.62', 'mullion -0.06 -0.68 0.02 0.66', 'mullion -0.55 0.05 0.51 0.12', 'finish sea honey chalk', 'end']);
// Elena's melody: the tune of the whole game. Notes are MIDI numbers, beats in quarter notes.
const TUNE = asset(['LLASSET 1 tune', 'by skylark', 'note it is not finished. neither am i. -sky', 'tempo 88',
  'phrase 64:1 67:1 69:2 71:1 69:1 67:2', 'phrase 64:1 67:1 72:2 71:1 69:1 67:2', 'phrase 69:1 71:1 72:1 74:1 76:2 74:1 72:1', 'phrase 71:1 69:1 67:1 64:1 67:4', 'end']);
// The lighthouse lamp, as Elena coded it in 1998.
const LAMP = asset(['LLASSET 1 lamp', 'by skylark', 'color ffd27a', 'speed 0.6', 'beam 30', 'sweep town pier bakery station', 'end']);
// June's Iris: a baker who decides to leave town at the end of summer.
const IRIS98 = asset(['LLASSET 1 npc iris', 'by junebug', 'note iris does not stay. she was never going to. -j', 'state bake bakery', 'state walk harbor', 'say iris.harbor', 'state board boat', 'ending leaves', 'end']);
// Elena's 2004 change to Iris: the departure is gone; she bakes forever.
const IRIS04 = asset(['LLASSET 1 npc iris', 'by skylark', 'state bake bakery', 'loop', 'end']);

// ---- the posts ------------------------------------------------------------------------------------------------
const G = 'alt.games.homebrew';
const SKY98 = 'skylark <skylark@summer98.example>', SKY04 = 'skylark <evance@oldnet.example>', JUNE = 'junebug <june@inkwell.example>';
const at = (lines, name, buf) => lines.concat(['', ...uuencode(name, buf)]);
const manifest98 = (b) => ['LLMANIFEST 1', 'build summer-0.9', 'era 1998', 'title Last Light 0.9 (summer build)', 'credit skylark programming music', 'credit junebug art story',
  'asset town inline', 'asset station inline', 'asset bunting inline', 'asset gulls inline', 'asset bakery_1998 inline', 'asset notice_1998 inline',
  `asset bridge attach <junebug.19980814.2@inkwell.example> bridge.ll ${b.length} ${crc32(b)}`,
  `asset window attach <junebug.19980721.1@inkwell.example> window.ll ${WINDOW.length} ${crc32(WINDOW)}`,
  `asset tune attach <ll-0702.skylark@summer98.example> tune.ll ${TUNE.length} ${crc32(TUNE)}`,
  `asset lamp attach <ll-0730.skylark@summer98.example> lamp.ll ${LAMP.length} ${crc32(LAMP)}`,
  `asset iris attach <junebug.19980809.1@inkwell.example> iris.npc ${IRIS98.length} ${crc32(IRIS98)}`,
  'asset seawall_gap inline', 'asset pier_old inline', 'asset pier_gap inline', 'asset point_rocks inline', 'asset lighthouse_scaffold inline', 'end'];
const P = {
  hello: { id: '<ll-0001.skylark@summer98.example>', from: SKY98, date: 'Sat, 18 Apr 1998 22:14:05 -0700', subject: 'Last Light - a small game about a lighthouse (artist wanted)', refs: [],
    body: ['I am making a little game about a seaside town with a lighthouse keeper', 'called Theo. The light does not work yet. Neither does most of the game.', '', 'I can code and I can write music. I cannot draw a seagull. Anyone?', '', '-- sky'] },
  june: { id: '<junebug.19980419.1@inkwell.example>', from: JUNE, date: 'Sun, 19 Apr 1998 10:02:44 -0700', subject: 'Re: Last Light - a small game about a lighthouse (artist wanted)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['> I cannot draw a seagull.', '', 'I can draw you a seagull. I can draw you the whole town, and I will', 'write the people in it. Theo needs a beard. Also a baker.', '', '-- june'] },
  tune: { id: '<ll-0702.skylark@summer98.example>', from: SKY98, date: 'Thu, 02 Jul 1998 23:31:10 -0700', subject: 'the town has a song now', refs: ['<ll-0001.skylark@summer98.example>'],
    body: at(['wrote a melody for the lighthouse. it does not end properly yet.', '', '-- sky'], 'tune.ll', TUNE) },
  window: { id: '<junebug.19980721.1@inkwell.example>', from: JUNE, date: 'Tue, 21 Jul 1998 16:12:51 -0700', subject: 'lighthouse window (do not fix it)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: at(['the lighthouse gets one crooked window. sky will hate it. sky will build it.', '', '-- june'], 'window.ll', WINDOW) },
  lamp: { id: '<ll-0730.skylark@summer98.example>', from: SKY98, date: 'Thu, 30 Jul 1998 21:40:00 -0700', subject: 'Re: lighthouse window (do not fix it)', refs: ['<ll-0001.skylark@summer98.example>', '<junebug.19980721.1@inkwell.example>'],
    body: at(['> sky will hate it. sky will build it.', '', 'built it. it is still crooked. the lamp works now, mostly.', '', '-- sky'], 'lamp.ll', LAMP) },
  iris: { id: '<junebug.19980809.1@inkwell.example>', from: JUNE, date: 'Sun, 09 Aug 1998 11:05:30 -0700', subject: 'Iris (the baker)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: at(['Iris bakes all summer and then she gets on the boat. that is her ending.', 'please do not make her stay. -- june'], 'iris.npc', IRIS98) },
  sag: { id: '<ll-0040.skylark@summer98.example>', from: SKY98, date: 'Wed, 12 Aug 1998 23:58:01 -0700', subject: 'the bridge keeps falling into the canal', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['every build the bridge sags and theo walks into the water. he does not complain.', '', '-- sky'] },
  bridge: { id: '<junebug.19980814.2@inkwell.example>', from: JUNE, date: 'Fri, 14 Aug 1998 23:40:11 -0700', subject: 'Re: the bridge keeps falling into the canal', refs: ['<ll-0001.skylark@summer98.example>', '<ll-0040.skylark@summer98.example>'],
    body: at(['fixed it. hand placed planks, a bit wonky on purpose. it holds now.', '', '-- june'], 'bridge.ll', BRIDGE) },
  summer: { id: '<ll-0815.skylark@summer98.example>', from: SKY98, date: 'Sat, 15 Aug 1998 21:05:00 -0700', subject: 'Last Light 0.9 - summer build (manifest)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['summer build. the pier is half done, the lighthouse is half a lighthouse,', 'june is going away at the end of the month. -- sky', '', ...manifest98(BRIDGE)] },
  cancel: { id: '<cancel.ll-0815@oldnet.example>', from: SKY04, date: 'Wed, 03 Mar 2004 01:14:02 +0000', subject: 'cmsg cancel <ll-0815.skylark@summer98.example>', refs: [], control: 'cancel <ll-0815.skylark@summer98.example>', body: ['cancelled by its author'] },
  juneReply: { id: '<junebug.20040307.1@inkwell.example>', from: JUNE, date: 'Sun, 07 Mar 2004 09:20:00 -0800', subject: 'Re: Last Light 1.0 (public build)', refs: ['<ll-0815.skylark@summer98.example>', '<lastlight-1.0.evance@oldnet.example>'],
    body: ['The window is mine. Iris is mine. Half of this town is mine.', 'My name is not on it any more, and the studio that wanted to see it', 'has stopped answering me. -- june'] }
};
// 2004: a MIME post with the public build manifest and Elena's changed Iris.
function publicBuild() {
  const B = 'LL-1.0-boundary';
  const man = ['LLMANIFEST 1', 'build public-1.0', 'era 2004', 'parent <ll-0815.skylark@summer98.example>', 'title Last Light 1.0 (public build)', 'credit skylark programming music art story',
    'asset town inline', 'asset station inline', 'asset bakery_2004 inline', 'asset notice_2004 inline',
    `asset bridge attach <junebug.19980814.2@inkwell.example> bridge.ll ${BRIDGE.length} ${crc32(BRIDGE)}`,
    `asset window attach <junebug.19980721.1@inkwell.example> window.ll ${WINDOW.length} ${crc32(WINDOW)}`,
    `asset tune attach <ll-0702.skylark@summer98.example> tune.ll ${TUNE.length} ${crc32(TUNE)}`,
    `asset iris attach <lastlight-1.0.evance@oldnet.example> iris-2004.npc ${IRIS04.length} ${crc32(IRIS04)}`,
    'asset seawall inline', 'asset pier_closed inline', 'asset point_path inline', 'asset lighthouse_tower inline', 'end'];
  return { id: '<lastlight-1.0.evance@oldnet.example>', from: SKY04, date: 'Wed, 03 Mar 2004 01:12:40 +0000', subject: 'Last Light 1.0 (public build)', refs: ['<ll-0815.skylark@summer98.example>'],
    extra: { 'MIME-Version': '1.0', 'Content-Type': `multipart/mixed; boundary="${B}"` },
    body: [`--${B}`, 'Content-Type: text/plain; charset=us-ascii', '', 'Tidied up the old summer build. The pier is closed. The lighthouse is finished.', '', ...man, '', `--${B}`,
      'Content-Type: application/x-lastlight', 'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="iris-2004.npc"', '', ...b64lines(IRIS04), `--${B}--`] };
}
P.public = publicBuild();

function article(p, pathHost, extraHeaders) {
  const h = [`Path: ${pathHost}`, `From: ${p.from}`, `Newsgroups: ${p.control ? G + '.ctl' : G}`, `Subject: ${p.subject}`, `Date: ${p.date}`, `Message-ID: ${p.id}`];
  if (p.refs.length) { h.push(p.refs.length > 1 ? `References: ${p.refs[0]}\n\t${p.refs.slice(1).join(' ')}` : `References: ${p.refs[0]}`); }
  if (p.control) { h.push(`Control: ${p.control}`); }
  Object.entries(Object.assign({}, p.extra || {}, extraHeaders || {})).forEach(([k, v]) => h.push(`${k}: ${v}`));
  h.push(`X-Fixture: ${FIX}`, `Lines: ${p.body.length}`);
  return h.join('\n') + '\n\n' + p.body.join('\n') + '\n';
}
const rnews = (arts) => arts.map((a) => `#! rnews ${Buffer.byteLength(a, 'ascii')}\n${a}`).join('');
function truncate(p, keep) { const i = p.body.findIndex((l) => l.startsWith('begin 644')); const enc2 = p.body.slice(i + 1, p.body.length - 2); return Object.assign({}, p, { body: p.body.slice(0, i + 1).concat(enc2.slice(0, keep)) }); }
function strip(p) { const i = p.body.findIndex((l) => l.startsWith('begin 644')); return Object.assign({}, p, { body: p.body.slice(0, i).concat(['[binary attachment removed by the archive]']) }); }
const hostOf = (p) => (p.from.includes('oldnet') ? 'oldnet.example' : p.from.includes('inkwell') ? 'inkwell.example' : 'summer98.example');

// Elena's backup disk: the 1998 thread as her newsreader saved it, every attachment intact.
const DISK = [P.hello, P.june, P.tune, P.window, P.lamp, P.iris, P.sag, P.bridge, P.summer];
fs.writeFileSync(path.join(out, 'skylark-backup.spool'), rnews(DISK.map((p) => article(p, 'summer98.example!not-for-mail'))));
// The public mirror (2004): the bridge file cut off in transfer, the summer manifest cancelled, the public build.
const MIRROR = [P.hello, P.june, P.tune, P.window, P.lamp, P.iris, P.sag, truncate(P.bridge, 9), P.summer, P.public, P.cancel];
fs.writeFileSync(path.join(out, 'mirror.oldnet.example.spool'), rnews(MIRROR.map((p) => article(p, `mirror.oldnet.example!${hostOf(p)}!not-for-mail`))));
// The groups archive: keeps text, strips binaries, processed the cancel, and added its own footer to one post
// (a divergent copy of the same Message-ID, which the parser must report rather than overwrite).
const footer = (p) => Object.assign({}, p, { body: p.body.concat(['', '-- archived by groups.archive.example --']) });
const GROUPS = [[footer(P.hello), 'Sat Apr 18 22:14:05 1998'], [P.june, 'Sun Apr 19 10:02:44 1998'], [strip(P.tune), 'Thu Jul 02 23:31:10 1998'], [strip(P.window), 'Tue Jul 21 16:12:51 1998'],
  [P.sag, 'Wed Aug 12 23:58:01 1998'], [strip(P.bridge), 'Fri Aug 14 23:40:11 1998'], [P.summer, 'Sat Aug 15 21:05:00 1998'], [P.cancel, 'Wed Mar 03 01:14:02 2004'], [P.juneReply, 'Sun Mar 07 09:20:00 2004']];
fs.writeFileSync(path.join(out, 'groups.archive.example.mbox'), GROUPS.map(([p, d]) => `From ${p.from.match(/<([^>]+)>/)[1]} ${d}\n` + article(p, 'groups.archive.example!not-for-mail').replace(/^From /gm, '>From ')).join('\n'));

// A variant disk with one plank left out, for the provenance test and the technical demo ("change the input, see the scene change").
const BRIDGE14 = asset(bridgeLines([7]));
const VARIANT = [Object.assign({}, P.bridge, { body: at(['fixed it. hand placed planks, a bit wonky on purpose. it holds now.', '', '-- june'], 'bridge.ll', BRIDGE14) }),
  Object.assign({}, P.summer, { body: P.summer.body.slice(0, P.summer.body.indexOf('LLMANIFEST 1')).concat(manifest98(BRIDGE14)) })];
fs.writeFileSync(path.join(out, 'variant-missing-plank.spool'), rnews(VARIANT.map((p) => article(p, 'summer98.example!not-for-mail'))));

// The present-day edition: NOT a USENET record. Newly created work by Mara, kept in its own namespace.
fs.writeFileSync(path.join(out, 'edition-present.txt'), ['LLMANIFEST 1', 'build present-restoration', 'era 2026', 'parent <ll-0815.skylark@summer98.example>', 'title Last Light: restored edition',
  'credit skylark programming music', 'credit junebug art story', 'credit mara restoration seasons',
  'asset credits_restored created', 'asset iris_revived created', 'asset seasons created', 'asset snow created', 'asset winter_theme created', 'end', ''].join('\n'));
// Elena's local drafts. Never posted, never sent.
fs.writeFileSync(path.join(out, 'drafts-unsent.txt'), ['X-Fixture: ' + FIX, 'Folder: drafts (never sent)', '',
  'To: june', 'Status: draft 7, not sent', '', 'June,', 'I took your name off the thing we made, and Iris\'s ending, and I let the studio think it was all me.',
  'That was wrong, and it cost you work I can\'t give back. Your name belongs on it.', 'I miss you. That isn\'t an excuse. It\'s just true.',
  'A lighthouse isn\'t there to keep the ships in place. It\'s there so she can go wherever she wants.', '-- E.', ''].join('\n'));
fs.writeFileSync(path.join(out, 'README.txt'), ['FICTIONAL SAMPLE ARCHIVE for Resurrection V5.', 'Every post, person, address and host here is invented. Hosts use the reserved .example domain.',
  'Generated by tools/v5-make-archive.mjs. Formats: rnews batch, mbox, uuencode, MIME multipart/base64.', ''].join('\n'));

console.log('bridge.ll', BRIDGE.length, crc32(BRIDGE), '| window.ll', WINDOW.length, '| tune.ll', TUNE.length, '| iris 1998', IRIS98.length, '2004', IRIS04.length);
for (const f of fs.readdirSync(out)) { console.log(f, fs.statSync(path.join(out, f)).size); }
