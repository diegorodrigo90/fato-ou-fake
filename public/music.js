// Trilha sonora do jogo, gerada por código (sem arquivos): um sequenciador de 16 passos em Dó maior (Dó, Lá menor, Fá, Sol).
// No menu: andamento calmo, só base e arpejo suave. No jogo: baixo, bateria leve, arpejo e um tema que se repete.
// Fica mais brilhante com a sequência de acertos, abaixa quando o selo de resultado aparece e para com a aba em segundo plano.
import { audioGraph, musicWanted } from "./sound.js";

const BPM = { menu: 84, game: 112 };
const LOOKAHEAD = 0.3; // segundos agendados à frente
const BARS = [
  { root: 48, third: 4, fifth: 7 }, // Dó
  { root: 45, third: 3, fifth: 7 }, // Lá menor
  { root: 41, third: 4, fifth: 7 }, // Fá
  { root: 43, third: 4, fifth: 7 }, // Sol
];
// Tema (passo de 16 dentro do compasso -> nota MIDI); toca nos 4 primeiros compassos de cada 8.
const THEME = [
  { 0: 76, 3: 79, 6: 81, 8: 79 },
  { 0: 76, 4: 74, 8: 72 },
  { 0: 72, 3: 77, 6: 76, 8: 72 },
  { 0: 74, 4: 79, 8: 76, 12: 74 },
];

let mood = "menu";
let intensity = 0;
let bed = null; // { ctx, melodic, drums, gain, timer, step, next }

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function note(ctx, dest, { at, midi, type = "triangle", dur = 0.3, gain = 0.1, attack = 0.01 }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

let noiseBuffer = null;
function noiseHit(ctx, dest, { at, dur = 0.08, freq = 6000, type = "highpass", gain = 0.1, q = 0.7 }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  src.buffer = noiseBuffer;
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(amp).connect(dest);
  src.start(at);
  src.stop(at + dur + 0.02);
}

function kick(ctx, dest, at, gain) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(130, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.14);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(amp).connect(dest);
  osc.start(at);
  osc.stop(at + 0.25);
}

function snare(ctx, dest, at, gain) {
  noiseHit(ctx, dest, { at, dur: 0.14, freq: 1800, type: "bandpass", gain, q: 0.8 });
  note(ctx, dest, { at, midi: 55, type: "triangle", dur: 0.09, gain: gain * 0.6, attack: 0.002 });
}

/** Agenda tudo o que acontece em um passo (1/16 de compasso). */
function scheduleStep(at, step) {
  const { ctx, melodic, drums } = bed;
  const bar = Math.floor(step / 16);
  const s = step % 16;
  const chord = BARS[bar % 4];
  const game = mood === "game";
  const energy = intensity;

  // Base: acorde longo e macio no começo do compasso
  if (s === 0) {
    for (const interval of [0, chord.third, chord.fifth]) {
      note(ctx, melodic, { at, midi: chord.root + 12 + interval, type: "sine", dur: (16 * 60) / BPM[mood] / 4, gain: game ? 0.05 : 0.07, attack: 0.25 });
    }
  }

  // Baixo: sincopado no jogo, só nos tempos 1 e 3 no menu
  const bassSteps = game ? [0, 3, 6, 8, 11, 14] : [0, 8];
  if (bassSteps.includes(s)) {
    const midi = chord.root - 12 + (s === 11 ? chord.fifth : s === 8 && game ? 12 : 0);
    note(ctx, melodic, { at, midi, type: "triangle", dur: 0.3, gain: game ? 0.3 : 0.18 });
  }

  // Arpejo: colcheias no jogo, semínimas no menu
  if (s % (game ? 2 : 4) === 0) {
    const tones = [0, chord.third, chord.fifth, 12];
    const midi = chord.root + 24 + tones[(s / (game ? 2 : 4)) % 4];
    note(ctx, melodic, { at, midi, type: "triangle", dur: 0.22, gain: game ? 0.06 + energy * 0.03 : 0.05 });
  }

  if (!game) return;

  // Bateria leve
  if (s === 0 || s === 8 || (energy > 0.4 && s === 14)) kick(ctx, drums, at, 0.3 + energy * 0.15);
  if (s === 4 || s === 12) snare(ctx, drums, at, 0.1 + energy * 0.06);
  if (s % 2 === 0) noiseHit(ctx, drums, { at, dur: 0.04, gain: s % 4 === 2 ? 0.05 + energy * 0.03 : 0.025 });
  if (energy > 0.6 && s % 2 === 1) noiseHit(ctx, drums, { at, dur: 0.03, gain: 0.025 });

  // Tema: toca nos 4 primeiros compassos de cada ciclo de 8, deixando o resto respirar
  if (Math.floor(bar / 4) % 2 === 0) {
    const midi = THEME[bar % 4][s];
    if (midi) note(ctx, melodic, { at, midi, type: "square", dur: 0.28, gain: 0.07, attack: 0.008 });
  }
}

function pump() {
  if (!bed) return;
  const { ctx } = bed;
  while (bed.next < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(bed.next, bed.step);
    bed.next += 60 / BPM[mood] / 4;
    bed.step = (bed.step + 1) % (16 * 8);
  }
}

function brightness() {
  return (mood === "game" ? 2600 : 1400) + intensity * 2200;
}

function start() {
  if (bed) return;
  const graph = audioGraph();
  if (!graph) return;
  const { ctx, master } = graph;
  const melodic = ctx.createBiquadFilter();
  melodic.type = "lowpass";
  melodic.frequency.value = brightness();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
  const drums = ctx.createGain();
  melodic.connect(gain);
  drums.connect(gain);
  gain.connect(master);
  bed = { ctx, melodic, drums, gain, timer: 0, step: 0, next: ctx.currentTime + 0.1 };
  pump();
  bed.timer = setInterval(pump, 80);
}

function stop() {
  if (!bed) return;
  const { ctx, gain, timer } = bed;
  clearInterval(timer);
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  bed = null;
}

/** Liga ou desliga a música conforme as configurações e a visibilidade da aba. */
export function sync() {
  if (musicWanted() && !document.hidden) start();
  else stop();
}

/** Muda o clima da trilha: "menu" na tela inicial e nos menus, "game" durante as cartas. */
export function setMood(next) {
  if (next === mood) return;
  mood = next;
  if (bed) bed.melodic.frequency.setTargetAtTime(brightness(), bed.ctx.currentTime, 0.6);
}

/** 0 a 1: quanto mais acertos seguidos, mais brilhante e cheia. */
export function setIntensity(value) {
  intensity = Math.max(0, Math.min(1, value));
  if (bed) bed.melodic.frequency.setTargetAtTime(brightness(), bed.ctx.currentTime, 1.2);
}

/** Abaixa a música por um instante (selo de acerto/erro, evento de baralho). */
export function duck(ms = 1500) {
  if (!bed) return;
  const { ctx, gain } = bed;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.12);
  gain.gain.setTargetAtTime(0.5, ctx.currentTime + ms / 1000, 0.6);
}

document.addEventListener("visibilitychange", sync);
