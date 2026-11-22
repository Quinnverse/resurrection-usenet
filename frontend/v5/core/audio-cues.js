// Where each piece of V5 music and each sound effect plays, and what it is meant to do. Used by the listening page
// (audio.html) and by tools/v5-audio-checklist.mjs. Keep in step with themeFor() in main.js and FX in render/audio.js.
export const THEMES = {
  study: { where: 'Prologue, Ch7, epilogue · Mom\'s house after the funeral, the study, the restore tool (P.house, 1.study, P.restore, 7.study, E.study)', want: 'Quiet, low, a little lonely; plucked melody an octave down with a soft pad. Mara alone with her mother\'s things.' },
  summer: { where: 'Ch1 town in 1998, the carving (1.carve); Ch4 cottage and between the duets (4.cottage, 4.duet)', want: 'Bright and warm, bass and bells; the summer as Elena remembers it.' },
  train: { where: 'Ch1 the chase (1.chase); Ch2 the train (2.train)', want: 'Quick and bouncing, oom-pah under the tune; running, laughing, the carriage moving.' },
  coast: { where: 'Ch3 the ride, yard, beam, cliff (3.ride … 3.cliff)', want: 'Open and moving, hum underneath; wind, speed, building something together.' },
  night: { where: 'Ch4 the porch and the stars (4.porch)', want: 'Very soft bells, low pad; night, closeness, the almost-confession.' },
  parting: { where: 'Ch5 the last afternoon at the station (5.depart)', want: 'Slow, lowered a step, pad; tender, not tragic yet.' },
  y2004: { where: 'Ch1/Ch7 town in the 2004 build (1.town, 1.pier, 7.town before the snow); Ch5 six years later (5.alone)', want: 'Sparse, notes missing, cool sine; something that used to be whole.' },
  cottage04: { where: 'Ch6 the cottage and the beach in 2004 (6.cottage, 6.beach)', want: 'Barely there, notes dropped; no comfort. It should not cover the conversation.' },
  winter: { where: 'Ch7 after the seasons are made, the snow, the pier (7.town winter, end)', want: 'Bells, bass, pad and hum; new, fuller, a little hopeful. Clearly different from the 1998 summer.' },
  ending: { where: 'Credits', want: 'Calm plucked melody with bells; an ending, not a fade-out.' }
};
export const EFFECTS = {
  step: 'footstep, one per stride on the ground (R4)', jump: 'jump', land: 'landing', click: 'pick up / carry', open: 'opening the KEEP box (Ch1)', blip: 'subtitle line appears', crtWake: 'old computer wakes (Ch1)',
  modem: 'archive rebuild screen (Ch1)', restoreStart: 'restore begins (bridge, Ch1)', plank: 'each bridge plank lands', restored: 'restore complete', to98: 'Tab to 1998', to04: 'Tab to 2004',
  denied: 'Tab refused / restore refused', whistle: 'train leaves (Ch1, Ch5)', caught: 'catching June\'s hand (Ch1)', shutter: 'camera shutter (Ch2, Ch5)', bell: 'bicycle bell (Ch3)',
  crank: 'lamp crank (Ch3)', lit: 'the lamp lights (Ch3)', door: 'doors', page: 'letter, sketch, drawing', choice: 'a choice is made', season: 'seasons created (Ch7)', credit: 'names restored (Ch7)',
  iris: 'Iris revived (Ch7)', lamp: 'study lamp switch', hint: 'a hint is given', can: 'soda can (Ch5)', chain: 'June\'s bike chain (Ch3)', rope: 'Iris\'s rope (Ch7)', touch: 'reaching for June\'s hand in the tunnel (Ch2)',
  express: 'tunnel / the express that does not stop (Ch2, Ch5)', star: 'a star joined (Ch4)', dot: 'a dot reached while drawing (Ch4)', carve: 'carving the post (Ch1)', tuned: 'string in tune (Ch4)',
  kettle: 'the kettle screams in the middle of the argument (prologue)', machine: 'the answering machine beeps (prologue)', glitch: 'the summer memory breaks where the record does (prologue)', unfold: 'the photo unfolded for good (epilogue)',
  detuned: 'string out of tune (Ch4)', found: 'the beam finds June / the cottage / the pier', lens: 'lens fitted (Ch3)', gate: 'ribbon gate (Ch3)'
};

