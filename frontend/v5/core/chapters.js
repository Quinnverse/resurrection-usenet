// R4: which chapter a beat belongs to. The prologue (chapter 0) is the kitchen, the empty house, Mom's study, the archive
// restore and the first memory; the epilogue (chapter 8) is the study after the archive. '1.study' keeps its old id so
// saves and tools keep working, but it is now the third scene of the prologue.
export const PROLOGUE_BEATS = ['P.kitchen', 'P.house', '1.study', 'P.restore', 'P.summer'];
export const EPILOGUE_BEATS = ['E.study'];
export function chapterOf(beat) {
  if (PROLOGUE_BEATS.indexOf(beat) >= 0) { return 0; }
  if (EPILOGUE_BEATS.indexOf(beat) >= 0) { return 8; }
  if (beat === 'end') { return 7; }
  const n = parseInt(beat, 10); return isFinite(n) ? n : 0;
}
