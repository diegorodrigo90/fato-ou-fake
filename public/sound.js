// Sons sintetizados na hora com Web Audio: nenhum arquivo, nenhum peso extra.
import * as settings from "./settings.js";

let ctx = null;
let master = null;

/** Efeitos sonoros efetivamente audíveis agora. */
export const soundOn = () => !settings.get("muted") && settings.get("sfx");
export const musicWanted = () => !settings.get("muted") && settings.get("music");

/** Cria (uma vez) o contexto de áudio; só funciona depois de um toque do jogador. */
export function audioGraph() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  master.gain.value = 0.18 * (settings.get("volume") / 70);
  if (ctx.state === "suspended") ctx.resume();
  return { ctx, master };
}

settings.subscribe((key) => {
  if (master && (key === "volume" || key === "*")) master.gain.value = 0.18 * (settings.get("volume") / 70);
});

function audio() {
  if (!soundOn()) return null;
  return audioGraph()?.ctx ?? null;
}

function tone(c, base, { f, f2, t = 0, d = 0.15, type = "sine", g = 0.5 }) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  const at = base + t;
  osc.type = type;
  osc.frequency.setValueAtTime(f, at);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, at + d);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(g, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + d);
  osc.connect(amp).connect(master);
  osc.start(at);
  osc.stop(at + d + 0.02);
}

let noiseBuffer = null;
function noise(c, base, { t = 0, d = 0.1, f = 1200, f2, q = 1, g = 0.4, type = "bandpass" }) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const amp = c.createGain();
  const at = base + t;
  src.buffer = noiseBuffer;
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f, at);
  if (f2) filter.frequency.exponentialRampToValueAtTime(f2, at + d);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(g, at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + d);
  src.connect(filter).connect(amp).connect(master);
  src.start(at);
  src.stop(at + d + 0.02);
}

const NOTES = [523, 659, 784, 1047, 1319];

const recipes = {
  tick: (c, b) => tone(c, b, { f: 1300, d: 0.035, type: "square", g: 0.1 }),
  flip: (c, b) => noise(c, b, { d: 0.16, f: 600, f2: 2800, q: 0.8, g: 0.35 }),
  whoosh: (c, b) => noise(c, b, { d: 0.35, f: 300, f2: 3200, q: 0.6, g: 0.4 }),
  stamp: (c, b) => {
    tone(c, b, { f: 150, f2: 55, d: 0.18, type: "triangle", g: 0.9 });
    noise(c, b, { d: 0.05, f: 2400, q: 1.2, g: 0.3 });
  },
  // Acerto: arpejo maior subindo, brilhante, com brilho agudo no fim ("ta-da-ding")
  right: (c, b) => {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(c, b, { f, t: i * 0.085, d: i === 3 ? 0.5 : 0.2, type: "triangle", g: 0.75 });
      tone(c, b, { f: f * 2, t: i * 0.085, d: i === 3 ? 0.4 : 0.14, g: 0.18 });
    });
    noise(c, b, { t: 0.255, d: 0.35, f: 7000, type: "highpass", g: 0.1 });
  },
  // Erro: buzzer grave descendente, áspero e seco ("bzzzt"), bem diferente do acerto
  wrong: (c, b) => {
    tone(c, b, { f: 196, f2: 130, d: 0.42, type: "sawtooth", g: 0.55 });
    tone(c, b, { f: 208, f2: 123, d: 0.42, type: "square", g: 0.3 });
    tone(c, b, { f: 98, f2: 65, t: 0.02, d: 0.4, type: "triangle", g: 0.7 });
  },
  // Início de partida: baralho embaralhando e fanfarra curta subindo
  start: (c, b) => {
    recipes.riffle(c, b);
    [392, 523, 659, 784].forEach((f, i) => tone(c, b, { f, t: 0.72 + i * 0.09, d: i === 3 ? 0.5 : 0.18, type: "triangle", g: 0.6 }));
  },
  // Carta nova entrando na mesa
  deal: (c, b) => noise(c, b, { d: 0.1, f: 900, f2: 2800, q: 0.9, g: 0.45 }),
  streak: (c, b, level = 1) => {
    NOTES.slice(0, 2 + level).forEach((f, i) => tone(c, b, { f, t: i * 0.07, d: 0.22, type: "triangle", g: 0.45 }));
  },
  chime: (c, b, i = 0) => {
    const f = 784 * 2 ** (i / 12);
    tone(c, b, { f, d: 0.34, g: 0.4 });
    tone(c, b, { f: f * 2, d: 0.2, g: 0.15 });
  },
  epic: (c, b) => {
    [1319, 1568, 2093, 2637].forEach((f, i) => tone(c, b, { f, t: i * 0.06, d: 0.36, g: 0.3 }));
    noise(c, b, { d: 0.4, f: 6000, type: "highpass", g: 0.12 });
  },
  // Rodada do dia: um som por resposta (sobe a cada acerto), abafado no erro
  pip: (c, b, i = 0) => {
    const step = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][i % 10];
    tone(c, b, { f: 523 * 2 ** (step / 12), d: 0.16, type: "triangle", g: 0.5 });
    tone(c, b, { f: 1046 * 2 ** (step / 12), d: 0.09, g: 0.12 });
  },
  pipMiss: (c, b) => tone(c, b, { f: 220, f2: 165, d: 0.18, type: "triangle", g: 0.45 }),
  // Fim da rodada: mais estrelas, fanfarra maior; sem estrela, um convite suave para voltar
  fanfare: (c, b, stars = 0) => {
    const sets = [[349, 392], [392, 523, 659], [523, 659, 784, 1047], [523, 659, 784, 1047, 1319, 1568]];
    const notes = sets[Math.max(0, Math.min(3, stars))];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      tone(c, b, { f, t: i * 0.1, d: last ? 0.7 : 0.2, type: "triangle", g: 0.6 });
      if (stars > 0) tone(c, b, { f: f * 2, t: i * 0.1, d: last ? 0.5 : 0.14, g: 0.16 });
    });
    if (stars >= 2) noise(c, b, { t: notes.length * 0.1 - 0.05, d: 0.5, f: 7000, type: "highpass", g: 0.12 });
  },
  // Conquista nova: brilho rápido subindo
  trophy: (c, b) => {
    [1319, 1568, 2093, 2637].forEach((f, i) => tone(c, b, { f, t: i * 0.07, d: 0.3, type: "triangle", g: 0.35 }));
    noise(c, b, { t: 0.2, d: 0.35, f: 8000, type: "highpass", g: 0.1 });
  },
  // Embaralhar: dezenas de estalos de papel que aceleram, fecham com uma batida surda do monte
  riffle: (c, b) => {
    const flaps = 26;
    for (let i = 0; i < flaps; i++) {
      const t = 0.62 * (1 - (1 - i / flaps) ** 1.6);
      noise(c, b, { t, d: 0.035, f: 2200 + (i % 5) * 450, q: 2.5, g: 0.55 });
    }
    noise(c, b, { t: 0.66, d: 0.09, f: 380, type: "lowpass", g: 0.6 });
  },
};

/** Toca um som; `delayMs` agenda em relação a agora. Silencioso quando o som está desligado. */
export function play(name, arg, delayMs = 0) {
  const c = audio();
  if (!c || !recipes[name]) return;
  recipes[name](c, c.currentTime + delayMs / 1000, arg);
}
