// The memory journal: fragments of what happened in 1998 and 2004, found by playing. Like the task list, each fragment
// is a test on the game's own state (a flag, a dialogue seen, something restored from the archive), so it is found the
// moment the story records it, survives saving and loading for free, and can never be missed for good: everything the
// story needs is a required step of a chapter, and the journal only reads it. Optional fragments add context.
//
//   fragments(g) -> [{ id, chapter, year, who, found, optional, provenance }]
// Text keys: 'mem.<id>.t' (title) and 'mem.<id>.d' (one or two sentences).
const seen = (g, id) => g.s.seen.indexOf(id) >= 0;
const prov = (g, id) => { const p = g.s.restored[id]; if (!p) { return null; } return { record: p.recordId || null, source: p.source || null, status: p.status || null, file: p.file || null, crc32: p.crc32 || null, evidence: Array.isArray(p.evidence) ? p.evidence.map((e) => `${e.source}: ${e.status}`) : null }; };

export const FRAGMENTS = [
  { id: 'disk', chapter: 1, year: 1998, who: ['elena', 'mara'], when: (g) => !!g.s.flags.disk },
  { id: 'platformPhoto', chapter: 1, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.looked_photo, optional: true },
  { id: 'bridge', chapter: 1, year: 1998, who: ['june'], when: (g) => !!g.s.restored.bridge, prov: 'bridge' },
  { id: 'carving', chapter: 1, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.carved },
  { id: 'trainHand', chapter: 1, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.chased },
  { id: 'sketch', chapter: 2, year: 1998, who: ['june', 'elena'], when: (g) => !!g.s.flags.sketched },
  { id: 'juneSnap', chapter: 2, year: 1998, who: ['june', 'elena'], when: (g) => !!g.s.flags.juneSnap },
  { id: 'window', chapter: 3, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.window.placed },
  { id: 'lamp98', chapter: 3, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.lit },
  { id: 'portfolio', chapter: 4, year: 1998, who: ['june'], when: (g) => seen(g, 'c4.sketches') || !!g.s.flags.boat },
  { id: 'duet', chapter: 4, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.duet1 },
  { id: 'stars', chapter: 4, year: 1998, who: ['elena', 'june'], when: (g) => !!g.s.flags.stars },
  { id: 'news', chapter: 5, year: 1998, who: ['june', 'elena'], when: (g) => !!g.s.flags.c5talk },
  { id: 'letter1999', chapter: 6, year: 1999, who: ['june'], when: (g) => seen(g, 'c6.letter'), optional: true },
  { id: 'gamebox', chapter: 6, year: 2004, who: ['elena', 'june'], when: (g) => !!g.s.flags.looked_gamebox, optional: true },
  { id: 'answered', chapter: 6, year: 2004, who: ['elena', 'june'], when: (g) => !!g.s.flags.beachTalk1 },
  { id: 'careful', chapter: 6, year: 2004, who: ['june', 'elena'], when: (g) => !!g.s.flags.beachTalk3 },
  { id: 'drafts', chapter: 7, year: 2004, who: ['elena', 'mara'], when: (g) => !!g.s.flags.letterRead },
  { id: 'credits', chapter: 7, year: 1998, who: ['june', 'elena', 'mara'], when: (g) => !!g.s.edition.credits_restored, prov: 'credits' },
  { id: 'iris', chapter: 7, year: 1998, who: ['iris', 'june'], when: (g) => !!g.s.edition.iris_revived, prov: 'iris' },
  { id: 'lampRestored', chapter: 7, year: 1998, who: ['elena', 'mara'], when: (g) => !!g.s.restored.lamp, prov: 'lamp' },
  { id: 'snow', chapter: 7, year: null, who: ['mara'], when: (g) => !!g.s.edition.seasons }
];

export function fragments(g) {
  return FRAGMENTS.map((f) => ({ id: f.id, chapter: f.chapter, year: f.year, who: f.who.slice(), optional: !!f.optional, found: !!f.when(g), provenance: f.prov ? prov(g, f.prov) : null }));
}
export function counts(g) {
  const all = fragments(g); const by = {};
  all.forEach((f) => { const c = by[f.chapter] = by[f.chapter] || { found: 0, of: 0 }; c.of += 1; if (f.found) { c.found += 1; } });
  return { found: all.filter((f) => f.found).length, of: all.length, byChapter: by };
}
