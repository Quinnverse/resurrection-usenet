// The key scenes of the RC1 review hub (frontend/v5/rc.js): the story moment, what to look at, and its screenshots
// (frontend/v5/rc/shots/<beat>-1.jpg, -2.jpg: software-rendered CI frames, not a real GPU). `beat` is a key of
// data/preview-saves.json, opened with /v5/?preview=<beat>.
export const SCENES = [
  { beat: '2.train', en: 'Elena and June on the train', zh: '火车上的 Elena 与 June', look: 'June’s faces while she dares Elena and sketches her; the carriage window light; the shoulder camera and the tunnel.', imgs: 2 },
  { beat: '3.ride', en: 'The coast ride', zh: '海岸骑行', look: 'Speed and camera behind the bikes (W pedal, A/D steer, Shift sprint, E bell); the road, the sea line, June ahead.', imgs: 2 },
  { beat: '3.beam', en: 'The lighthouse, together', zh: '灯塔合作', look: 'The lamp and its beam over the headland; turning the beam with A/D to find June; the framing from above.', imgs: 2 },
  { beat: '4.porch', en: 'Night on the porch (night music)', zh: '夜晚的门廊（夜晚音乐）', look: 'Stars and the sea at night, June’s face against the dark; the “night” theme (very soft bells, low pad) should not cover the lines.', imgs: 2 },
  { beat: '4.duet', en: 'The guitar duet', zh: '吉他二重奏', look: 'The background music stops while Elena plays; hits add June’s humming, then a harmony.', imgs: 2 },
  { beat: '6.beach', en: '2004 — the standoff on the beach', zh: '2004 年的对峙', look: 'Elena’s and June’s faces and distance in the argument; no comforting music; the choice that changes words, not the outcome.', imgs: 2 },
  { beat: 'end', en: 'The first snow', zh: '最终的初雪', look: 'Snow and the winter theme over the square and the pier; the new pale planks; the last light.', imgs: 2 }
];
