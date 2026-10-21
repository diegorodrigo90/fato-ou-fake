// Rodada do dia e conquistas: lógica pura, sem tela e sem armazenamento (o app guarda no aparelho).
export const DAILY_SIZE = 10;

/**
 * Data local no formato AAAA-MM-DD: a rodada vira à meia-noite do aparelho de cada pessoa.
 * @param {Date} [date]
 * @returns {string}
 */
export function dayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** @param {string} text */
function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Sorteio com semente (mulberry32): a mesma semente dá sempre a mesma sequência.
 * @param {string} seed
 * @returns {() => number}
 */
export function seededRng(seed) {
  let a = hash32(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} rng
 * @returns {T[]}
 */
function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pega `n` cartas revezando entre os autores, para nenhum lado dominar a rodada.
 * @template {{author?: string}} T
 * @param {T[]} list
 * @param {number} n
 * @param {() => number} rng
 * @returns {T[]}
 */
function spreadByAuthor(list, n, rng) {
  const groups = new Map();
  for (const card of shuffled(list, rng)) {
    const key = card.author ?? "-";
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  const keys = shuffled([...groups.keys()], rng);
  const out = [];
  while (out.length < n && keys.some((key) => groups.get(key).length > 0)) {
    for (const key of keys) {
      if (out.length < n && groups.get(key).length > 0) out.push(groups.get(key).shift());
    }
  }
  return out;
}

/**
 * Cartas da rodada do dia: iguais para quem tem o mesmo baralho, metade fato e metade fake,
 * revezando os autores. Se um dos vereditos faltar, completa com o outro.
 * @template {{id: string, verdict: string, author?: string}} T
 * @param {T[]} items
 * @param {string} key  dayKey()
 * @param {number} [size]
 * @returns {string[]} ids na ordem de jogo
 */
export function dailyDeck(items, key, size = DAILY_SIZE) {
  const rng = seededRng(`rodada:${key}`);
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const trues = sorted.filter((card) => card.verdict === "verdadeiro");
  const fakes = sorted.filter((card) => card.verdict !== "verdadeiro");
  const half = Math.ceil(size / 2);
  let pickTrue = spreadByAuthor(trues, half, rng);
  let pickFake = spreadByAuthor(fakes, size - half, rng);
  if (pickTrue.length < half) pickFake = spreadByAuthor(fakes, size - pickTrue.length, seededRng(`rodada:${key}:f`));
  else if (pickFake.length < size - half) pickTrue = spreadByAuthor(trues, size - pickFake.length, seededRng(`rodada:${key}:t`));
  return shuffled([...pickTrue, ...pickFake], rng).map((card) => card.id);
}

/**
 * Boato que circulou (post, vídeo, áudio) ou fala de político.
 * @param {{claim: string}} card
 * @returns {"viral" | "fala"}
 */
export function kindOf(card) {
  return /^(Post|Vídeo|Áudio)\b/.test(card.claim) ? "viral" : "fala";
}

const DAY_MS = 86400000;
const dayNumber = (key) => Math.round(Date.UTC(...key.split("-").map((part, i) => (i === 1 ? Number(part) - 1 : Number(part)))) / DAY_MS);

/**
 * Maior sequência de dias seguidos com rodada concluída.
 * @param {string[]} days  chaves AAAA-MM-DD
 * @returns {number}
 */
export function bestDayStreak(days) {
  const numbers = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < numbers.length; i++) {
    run = i > 0 && numbers[i] === numbers[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Sequência de dias que ainda vale hoje: termina hoje ou ontem.
 * @param {string[]} days
 * @param {string} today
 * @returns {number}
 */
export function currentDayStreak(days, today) {
  const set = new Set(days);
  let cursor = dayNumber(today);
  const has = (n) => set.has(new Date(n * DAY_MS).toISOString().slice(0, 10));
  if (!has(cursor)) cursor -= 1;
  let run = 0;
  while (has(cursor)) {
    run += 1;
    cursor -= 1;
  }
  return run;
}

/**
 * Texto para compartilhar a rodada: só a data, a nota e um quadrado por carta, sem nomes de ninguém.
 * @param {string} key
 * @param {boolean[]} results
 * @returns {string}
 */
export function dailyShareText(key, results) {
  const hits = results.filter(Boolean).length;
  const squares = results.map((ok) => (ok ? "🟩" : "🟥")).join("");
  return `Fato ou Fake? Rodada de ${key.split("-").reverse().join("/")}\n${hits}/${results.length} ${squares}`;
}

/**
 * Estrelas da rodada: 3 a partir de 90% de acertos, 2 a partir de 70%, 1 a partir de 40%.
 * @param {number} right
 * @param {number} total
 * @returns {0 | 1 | 2 | 3}
 */
export function starsFor(right, total) {
  if (total <= 0) return 0;
  const ratio = right / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

/**
 * Título da rodada por estrelas. Nunca desanima: mesmo sem estrela, convida para amanhã.
 * @param {0 | 1 | 2 | 3} stars
 * @returns {string}
 */
export function roundRank(stars) {
  return ["Amanhã tem mais", "Na trilha certa", "Olho afiado", "Mestre da checagem"][stars];
}

/**
 * @param {Date} [now]
 * @returns {number} milissegundos até a meia-noite local
 */
export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/**
 * @param {number} ms
 * @returns {string} HH:MM:SS
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const part = (n) => String(n).padStart(2, "0");
  return `${part(Math.floor(total / 3600))}:${part(Math.floor((total % 3600) / 60))}:${part(total % 60)}`;
}

/**
 * Acertos por tipo de carta e por autor, para as conquistas.
 * @param {{id: string, correct: boolean}[]} history
 * @param {(id: string) => ({claim: string, author?: string} | undefined)} byId
 * @returns {{viral: number, fala: number, lula: number, flavio: number}}
 */
export function tallyHits(history, byId) {
  const tally = { viral: 0, fala: 0, lula: 0, flavio: 0 };
  for (const entry of history) {
    if (!entry.correct) continue;
    const card = byId(entry.id);
    if (!card) continue;
    tally[kindOf(card)] += 1;
    if (card.author === "lula") tally.lula += 1;
    if (card.author === "flavio") tally.flavio += 1;
  }
  return tally;
}

/**
 * @typedef {{total: number, hits: number, bestStreak: number, sourcesOpened: number, dailyDays: string[], dailyPerfect: number, viral: number, fala: number, lula: number, flavio: number}} Stats
 * @typedef {{id: string, title: string, desc: string, goal: number, value: (stats: Stats) => number}} Achievement
 */

/** @type {Achievement[]} */
export const ACHIEVEMENTS = [
  { id: "primeira-carta", title: "Primeira carta", desc: "Responda a sua primeira carta.", goal: 1, value: (s) => s.total },
  { id: "dez-acertos", title: "Pegando o jeito", desc: "Acumule 10 acertos.", goal: 10, value: (s) => s.hits },
  { id: "cinquenta-acertos", title: "Olho treinado", desc: "Acumule 50 acertos.", goal: 50, value: (s) => s.hits },
  { id: "sequencia-5", title: "Em chamas", desc: "Acerte 5 cartas seguidas.", goal: 5, value: (s) => s.bestStreak },
  { id: "sequencia-10", title: "Imparável", desc: "Acerte 10 cartas seguidas.", goal: 10, value: (s) => s.bestStreak },
  { id: "foi-conferir", title: "Foi conferir", desc: "Abra o link de uma fonte.", goal: 1, value: (s) => s.sourcesOpened },
  { id: "conferidor", title: "Conferidor", desc: "Abra 10 links de fontes.", goal: 10, value: (s) => s.sourcesOpened },
  { id: "rodada-do-dia", title: "Rodada do dia", desc: "Termine uma rodada do dia.", goal: 1, value: (s) => s.dailyDays.length },
  { id: "rodada-perfeita", title: "Rodada perfeita", desc: "Acerte as 10 cartas de uma rodada do dia.", goal: 1, value: (s) => s.dailyPerfect },
  { id: "tres-dias", title: "Três dias seguidos", desc: "Termine a rodada do dia em 3 dias seguidos.", goal: 3, value: (s) => bestDayStreak(s.dailyDays) },
  { id: "semana-completa", title: "Semana completa", desc: "Termine a rodada do dia em 7 dias seguidos.", goal: 7, value: (s) => bestDayStreak(s.dailyDays) },
  { id: "cacador-de-boatos", title: "Caçador de boatos", desc: "Acerte 5 posts, vídeos ou áudios que circularam.", goal: 5, value: (s) => s.viral },
  { id: "ouvido-atento", title: "Ouvido atento", desc: "Acerte 5 falas de políticos.", goal: 5, value: (s) => s.fala },
  { id: "dois-lados", title: "Olhar dos dois lados", desc: "Acerte 5 cartas sobre cada candidato.", goal: 5, value: (s) => Math.min(s.lula, s.flavio) },
];

/**
 * @param {Stats} stats
 * @returns {Set<string>}
 */
export function unlockedIds(stats) {
  return new Set(ACHIEVEMENTS.filter((a) => a.value(stats) >= a.goal).map((a) => a.id));
}

/**
 * Conquistas que passaram a valer agora, em relação às já guardadas.
 * @param {Stats} stats
 * @param {Set<string>} saved
 * @returns {Achievement[]}
 */
export function newlyUnlocked(stats, saved) {
  const now = unlockedIds(stats);
  return ACHIEVEMENTS.filter((a) => now.has(a.id) && !saved.has(a.id));
}
