// Developer tool: writes the fictional offline USENET sources used by P5 (frontend/p5/data/).
//   node tools/p5-make-spools.mjs
// Every post, name and host is invented for the game; hosts use the reserved .example domain.
// The files use real formats: an rnews batch ("#! rnews <bytes>") for the mirror and the backup disk,
// and an mbox export for the groups archive. Attachments are uuencoded, as binaries were in 1998.
// The game never reads this script: it parses the generated files with frontend/p5/js/usenet.js.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'frontend', 'p5', 'data');
fs.mkdirSync(out, { recursive: true });

// ---- helpers (independent of the game's parser on purpose) -------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); } return (c ^ 0xffffffff) >>> 0; }
const enc = (n) => String.fromCharCode(n ? n + 32 : 96);
function uuencode(name, buf) {
  const lines = [`begin 644 ${name}`];
  for (let i = 0; i < buf.length; i += 45) {
    const chunk = buf.subarray(i, i + 45); let line = enc(chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const a = chunk[j], b = chunk[j + 1] || 0, c = chunk[j + 2] || 0;
      line += enc(a >> 2) + enc(((a << 4) | (b >> 4)) & 63) + enc(((b << 2) | (c >> 6)) & 63) + enc(c & 63);
    }
    lines.push(line);
  }
  lines.push(enc(0), 'end');
  return lines;
}

// ---- June's bridge (bridge.ll): hand-placed planks, a little wonky on purpose ------------------------------
function bridgeAsset() {
  let s = 1998; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const lines = ['LLASSET 1 bridge', 'by junebug', 'note fixed the sag. planks are hand placed, wonky on purpose. it holds now. -j', 'span 3.20', 'width 2.20', 'rail 0.95'];
  for (let i = 0; i < 15; i++) {
    const z = (i * 0.2133 + 0.02).toFixed(3), d = (0.17 + r() * 0.03).toFixed(3), tilt = ((r() - 0.5) * 0.09).toFixed(3), side = ((r() - 0.5) * 0.08).toFixed(3), len = (2.12 + r() * 0.12).toFixed(3);
    lines.push(`plank ${z} ${d} ${tilt} ${side} ${len}`);
  }
  lines.push('post 0.05', 'post 1.60', 'post 3.15', 'end', '');
  return Buffer.from(lines.join('\n'), 'ascii');
}
const BRIDGE = bridgeAsset();
const BRIDGE_CRC = crc32(BRIDGE).toString(16).padStart(8, '0');
const BRIDGE_ID = '<junebug.19980814.2@inkwell.example>';

// ---- the posts ---------------------------------------------------------------------------------------------
const G = 'alt.games.homebrew';
const SKY98 = 'skylark <skylark@summer98.example>', SKY04 = 'skylark <evance@oldnet.example>', JUNE = 'junebug <june@inkwell.example>';
const P = {
  hello: { id: '<ll-0001.skylark@summer98.example>', from: SKY98, date: 'Sat, 18 Apr 1998 22:14:05 -0700', subject: 'Last Light - a small game about a lighthouse (artist wanted)', refs: [], org: 'a bedroom with a 486 in it',
    body: ['I\'m making a little game about a seaside town. There is a lighthouse', 'keeper called Theo. Every night he checks the light. The light does not', 'work yet. Neither does most of the game.', '', 'I can code. I cannot draw a seagull to save my life. Anyone?', '', '-- sky'] },
  pete: { id: '<pixelpete.0419@bbs.example>', from: 'pixelpete <pete@bbs.example>', date: 'Sun, 19 Apr 1998 08:31:12 -0500', subject: 'Re: Last Light - a small game about a lighthouse (artist wanted)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['> The light does not work yet.', '', 'a lighthouse game where the light doesn\'t work. bold.', '', 'pete'] },
  june: { id: '<junebug.19980419.1@inkwell.example>', from: JUNE, date: 'Sun, 19 Apr 1998 10:02:44 -0700', subject: 'Re: Last Light - a small game about a lighthouse (artist wanted)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['> I cannot draw a seagull to save my life.', '', 'I can draw you a seagull. I can draw you the whole town.', 'Also Theo needs a beard.', '', '-- june'] },
  deal: { id: '<ll-0012.skylark@summer98.example>', from: SKY98, date: 'Mon, 20 Apr 1998 19:47:30 -0700', subject: 'Re: Last Light - a small game about a lighthouse (artist wanted)', refs: ['<ll-0001.skylark@summer98.example>', '<junebug.19980419.1@inkwell.example>'],
    body: ['> Also Theo needs a beard.', '', 'deal. you do the town, i do the code. the beard is non-negotiable now.', '', '-- sky'] },
  sag: { id: '<ll-0040.skylark@summer98.example>', from: SKY98, date: 'Wed, 12 Aug 1998 23:58:01 -0700', subject: 'the bridge keeps falling into the canal', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['every build the bridge sags in the middle and theo walks straight into', 'the water. he does not complain, which somehow makes it worse.', '', '-- sky'] },
  bridge: { id: BRIDGE_ID, from: JUNE, date: 'Fri, 14 Aug 1998 23:40:11 -0700', subject: 'Re: the bridge keeps falling into the canal', refs: ['<ll-0001.skylark@summer98.example>', '<ll-0040.skylark@summer98.example>'],
    body: ['> he does not complain, which somehow makes it worse.', '', 'fixed it. i placed the planks by hand so they are a bit wonky,', 'that is on purpose. it holds now. file below.', '', '-- june', '', ...uuencode('bridge.ll', BRIDGE)] },
  summer: { id: '<ll-0815.skylark@summer98.example>', from: SKY98, date: 'Sat, 15 Aug 1998 21:05:00 -0700', subject: 'Last Light 0.9 - summer build (manifest)', refs: ['<ll-0001.skylark@summer98.example>'],
    body: ['summer build! the pier works, the bridge holds (thank you june),', 'and the lighthouse is still half a lighthouse. june is writing the', 'lamp rule. the build will pick it up when she posts it.', '', 'LLMANIFEST 1', 'build 1998', 'title Last Light 0.9 (summer build)', 'credit skylark code', 'credit junebug town art story',
      'asset town inline', 'asset plaza inline', 'asset bakery_sign_1998 inline', 'asset mural_1998 inline', 'asset notice_1998 inline', 'asset bunting inline', 'asset gulls inline',
      `asset bridge attach ${BRIDGE_ID} bridge.ll ${BRIDGE.length} ${BRIDGE_CRC}`, 'asset seawall_gap inline', 'asset pier_old inline', 'asset point_rocks inline', 'asset lighthouse_scaffold inline',
      'asset lighthouse_rule wanted <lighthouse-rule.1998@inkwell.example> trigger=pier_end', 'end', '', '-- sky'] },
  public: { id: '<lastlight-1.0.evance@oldnet.example>', from: SKY04, date: 'Wed, 03 Mar 2004 01:12:40 +0000', subject: 'Last Light 1.0 (public build)', refs: ['<ll-0815.skylark@summer98.example>'],
    body: ['Tidied up the old summer build and put it somewhere it will not disappear.', 'The pier is closed. The lighthouse is finished.', '', 'LLMANIFEST 1', 'build 2004', 'title Last Light 1.0 (public build)', 'credit skylark',
      'asset town inline', 'asset plaza inline', 'asset bakery_sign_2004 inline', 'asset mural_2004 inline', 'asset notice_2004 inline',
      `asset bridge attach ${BRIDGE_ID} bridge.ll ${BRIDGE.length} ${BRIDGE_CRC}`, 'asset seawall inline', 'asset pier_closed inline', 'asset point_path inline', 'asset lighthouse_tower inline', 'end'] },
  cancel: { id: '<cancel.ll-0815@oldnet.example>', from: SKY04, date: 'Wed, 03 Mar 2004 01:14:02 +0000', subject: 'cmsg cancel <ll-0815.skylark@summer98.example>', refs: [], control: 'cancel <ll-0815.skylark@summer98.example>',
    body: ['cancelled by its author'] },
  rule: { id: '<lighthouse-rule.1998@inkwell.example>', from: JUNE, date: 'Sat, 11 Jun 2005 18:30:00 -0700', subject: 'Re: Last Light 1.0 (public build)', refs: ['<ll-0815.skylark@summer98.example>', '<lastlight-1.0.evance@oldnet.example>'],
    body: ['[The text of this article has expired from the archive. Headers are kept.]'], extra: { 'X-Archive': 'body-expired' } }
};

function article(p, pathHost) {
  const h = [
    `Path: ${pathHost}`, `From: ${p.from}`, `Newsgroups: ${p.control ? G + '.ctl' : G}`, `Subject: ${p.subject}`, `Date: ${p.date}`,
    `Message-ID: ${p.id}`
  ];
  if (p.refs.length) {
    // fold long References over two lines, as newsreaders did
    h.push(p.refs.length > 1 ? `References: ${p.refs[0]}\n\t${p.refs.slice(1).join(' ')}` : `References: ${p.refs[0]}`);
  }
  if (p.control) { h.push(`Control: ${p.control}`); }
  if (p.org) { h.push(`Organization: ${p.org}`); }
  Object.entries(p.extra || {}).forEach(([k, v]) => h.push(`${k}: ${v}`));
  h.push(`Lines: ${p.body.length}`);
  return h.join('\n') + '\n\n' + p.body.join('\n') + '\n';
}
const rnews = (arts) => arts.map((a) => `#! rnews ${Buffer.byteLength(a, 'ascii')}\n${a}`).join('');
function truncateAttachment(p, keep) {
  // the mirror copied the bridge post while the transfer was failing: the attachment stops part way, no "end"
  const at = p.body.findIndex((l) => l.startsWith('begin 644'));
  const lines = p.body.slice(at + 1, p.body.length - 2);
  return Object.assign({}, p, { body: p.body.slice(0, at + 1).concat(lines.slice(0, keep)) });
}
function stripAttachment(p) {
  const at = p.body.findIndex((l) => l.startsWith('begin 644'));
  return Object.assign({}, p, { body: p.body.slice(0, at).concat(['[binary attachment removed by the archive]']) });
}

// mirror.oldnet.example: copied in 2004, before 2005, so it has no reply from June. The bridge copy is truncated.
const mirrorPath = (host) => `mirror.oldnet.example!${host}!not-for-mail`;
const mirror = [P.hello, P.pete, P.june, P.deal, P.sag, truncateAttachment(P.bridge, 9), P.summer, P.public, P.cancel]
  .map((p) => article(p, mirrorPath(p.from.includes('oldnet') ? 'oldnet.example' : p.from.includes('inkwell') ? 'inkwell.example' : p.from.includes('bbs') ? 'bbs.example' : 'summer98.example')));
fs.writeFileSync(path.join(out, 'mirror.oldnet.example.spool'), rnews(mirror));

// groups.archive.example: a web archive that keeps text, strips binaries, and lets old bodies expire.
const mbox = (arts) => arts.map(([p, d]) => `From ${p.from.match(/<([^>]+)>/)[1]} ${d}\n` + article(p, `groups.archive.example!not-for-mail`).replace(/^From /gm, '>From ')).join('\n');
const groups = [[P.hello, 'Sat Apr 18 22:14:05 1998'], [P.pete, 'Sun Apr 19 08:31:12 1998'], [P.june, 'Sun Apr 19 10:02:44 1998'], [P.deal, 'Mon Apr 20 19:47:30 1998'],
  [P.sag, 'Wed Aug 12 23:58:01 1998'], [stripAttachment(P.bridge), 'Fri Aug 14 23:40:11 1998'], [P.summer, 'Sat Aug 15 21:05:00 1998'], [P.public, 'Wed Mar 03 01:12:40 2004'],
  [P.cancel, 'Wed Mar 03 01:14:02 2004'], [P.rule, 'Sat Jun 11 18:30:00 2005']];
fs.writeFileSync(path.join(out, 'groups.archive.example.mbox'), mbox(groups));

// skylark's backup disk: the 1998 thread as her newsreader saved it, attachment intact, no cancel.
const disk = [P.hello, P.june, P.deal, P.sag, P.bridge, P.summer].map((p) => article(p, `summer98.example!not-for-mail`));
fs.writeFileSync(path.join(out, 'skylark-backup.spool'), rnews(disk));

console.log('bridge.ll', BRIDGE.length, 'bytes, crc32', BRIDGE_CRC);
for (const f of fs.readdirSync(out)) { console.log(f, fs.statSync(path.join(out, f)).size, 'bytes'); }
