/** @typedef {{ id: string, verdict: "verdadeiro" | "falso" | "enganoso" }} Card */

/**
 * @param {{verdict: Card["verdict"]}} card
 * @param {boolean} saidTrue the player swiped "Fato"
 * @returns {boolean} whether the player was right; "enganoso" counts as not true
 */
export function judge(card, saidTrue) {
  return saidTrue === (card.verdict === "verdadeiro");
}

/**
 * @param {number} streak
 * @param {boolean} correct
 * @returns {number}
 */
export function nextStreak(streak, correct) {
  return correct ? streak + 1 : 0;
}

/**
 * Next card the player has never answered, or null when none is left.
 * @template {{id: string}} T
 * @param {T[]} items
 * @param {Set<string>} seen ids already answered
 * @param {string | null} lastId card just shown, avoided when another unseen one exists
 * @param {() => number} [rng]
 * @returns {T | null}
 */
export function nextUnseen(items, seen, lastId, rng = Math.random) {
  let pool = items.filter((item) => !seen.has(item.id));
  if (pool.length > 1) pool = pool.filter((item) => item.id !== lastId);
  return pool.length === 0 ? null : pool[Math.floor(rng() * pool.length)];
}

/**
 * Rótulo do veredito para o jogador: o dado continua "verdadeiro"/"falso", a tela diz "fato"/"fake".
 * @param {{verdict: string}} card
 * @returns {"fato" | "fake"}
 */
export function verdictLabel(card) {
  return card.verdict === "verdadeiro" ? "fato" : "fake";
}

/**
 * @param {number} correct
 * @param {number} total
 * @param {number} bestStreak
 * @returns {string}
 */
export function shareEndless(correct, total, bestStreak) {
  return `Fato ou Fake? ∞\n${correct}/${total} certas · melhor sequência ${bestStreak}`;
}

/**
 * Only a drag that ends past the threshold answers; a tap or a short drag never does.
 * @param {number} dx horizontal offset of the card when released
 * @param {number} threshold
 * @returns {boolean | null} true = Fato, false = Fake, null = no answer
 */
export function swipeDecision(dx, threshold) {
  if (!Number.isFinite(dx)) return null;
  if (dx >= threshold) return true;
  if (dx <= -threshold) return false;
  return null;
}

/**
 * After the answer is shown, a swipe to either side past the threshold moves on to the next card.
 * @param {number} dx horizontal offset of the card when released
 * @param {number} threshold
 * @returns {boolean}
 */
export function swipeDismiss(dx, threshold) {
  return Number.isFinite(dx) && Math.abs(dx) >= threshold;
}

/**
 * @template {{id: string}} T
 * @param {T[]} items
 * @param {Set<string>} knownIds
 * @returns {T[]} cards not seen by the client before, in pool order
 */
export function diffNew(items, knownIds) {
  return items.filter((item) => !knownIds.has(item.id));
}

/**
 * Rank from the evidence itself: comum = one source, rara = two different publishers,
 * epica = two publishers including an official primary source.
 * @param {{sources: {label: string, type?: string}[]}} card
 * @returns {"comum" | "rara" | "epica"}
 */
export function rarityOf(card) {
  const labels = new Set(card.sources.map((source) => source.label.replace(/\s*\(.*\)$/, "")));
  if (labels.size < 2) return "comum";
  return card.sources.some((source) => source.type === "oficial") ? "epica" : "rara";
}

const CATEGORIES = {
  tribunal: { icon: "scale", label: "Tribunal" },
  dinheiro: { icon: "banknote", label: "Dinheiro" },
  urna: { icon: "vote", label: "Eleição" },
  documento: { icon: "file-text", label: "Documento" },
  discurso: { icon: "mic", label: "Discurso" },
  instituicao: { icon: "landmark", label: "Instituição" },
  lei: { icon: "gavel", label: "Lei" },
};
const GENERIC_CATEGORY = { icon: "circle-help", label: "Geral" };

/**
 * @param {{category?: string}} card
 * @returns {{icon: string, label: string}}
 */
export function categoryOf(card) {
  return CATEGORIES[card.category ?? ""] ?? GENERIC_CATEGORY;
}

const SUBJECTS = { flavio: "Sobre Flávio", lula: "Sobre Lula", terceiros: "Outras pessoas" };

/**
 * Assunto da carta em texto neutro, igual para todos (sem cor por candidato).
 * @param {{author?: string}} card
 * @returns {string}
 */
export function subjectOf(card) {
  return SUBJECTS[card.author ?? ""] ?? "";
}

const ART_PALETTES = {
  comum: ["#ffd23f", "#3ddc97", "#ff5fa2", "#1b2bd1"],
  rara: ["#7fb8ff", "#bfe0ff", "#1b2bd1", "#3ddc97"],
  epica: ["#8b5cff", "#ffd23f", "#3d1d99", "#ff5fa2"],
};

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
 * Procedural card art: the same id and rank always draw the same shapes, no network, no AI.
 * @param {string} id
 * @param {"comum" | "rara" | "epica"} rank
 * @returns {string} an inline SVG data URI
 */
export function artSvg(id, rank) {
  const colors = ART_PALETTES[rank] ?? ART_PALETTES.comum;
  let seed = hash32(`${rank}:${id}`) || 1;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const shapes = [];
  for (let i = 0; i < 6; i++) {
    const cx = Math.round(next() * 200);
    const cy = Math.round(next() * 125);
    const r = 14 + Math.round(next() * 46);
    const fill = colors[Math.floor(next() * colors.length)];
    const opacity = (0.35 + next() * 0.4).toFixed(2);
    shapes.push(
      i % 3 === 2
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fill}" stroke-width="6" opacity="${opacity}"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 125" preserveAspectRatio="xMidYMid slice"><rect width="200" height="125" fill="${colors[3]}" opacity="0.18"/>${shapes.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Draws a group (author) first so a big group cannot drown the small ones, then keeps the game from teaching "everything is fake" without becoming a strict alternation
 * (which a player could exploit without reading): with probability `bias` it prefers the
 * opposite kind of the last card, otherwise any unseen card can come. Falls back to any
 * unseen card when the preferred group is empty.
 * @template {{id: string, verdict: string}} T
 * @param {T[]} items
 * @param {Set<string>} seen
 * @param {string | null} lastId
 * @param {boolean | null} lastWasTrue
 * @param {() => number} [rng]
 * @param {number} [bias]
 * @returns {T | null}
 */
export function nextBalanced(items, seen, lastId, lastWasTrue, rng = Math.random, bias = 0.65) {
  // Primeiro sorteia o grupo (Lula, Flávio, boatos de terceiros): sem isso, o grupo maior afogaria os outros.
  const groups = [...new Set(items.filter((item) => !seen.has(item.id)).map((item) => item.author ?? ""))];
  const group = groups.length > 1 ? groups[Math.floor(rng() * groups.length)] : null;
  const inGroup = group === null ? items : items.filter((item) => (item.author ?? "") === group);
  if (lastWasTrue !== null && rng() < bias) {
    const preferred = inGroup.filter((item) => (item.verdict === "verdadeiro") !== lastWasTrue);
    const pick = nextUnseen(preferred, seen, lastId, rng);
    if (pick) return pick;
  }
  return nextUnseen(inGroup, seen, lastId, rng) ?? nextUnseen(items, seen, lastId, rng);
}

/**
 * Streak milestones: celebrate at 3, 5 and 10, then every 5. Silent otherwise, so it never nags.
 * @param {number} streak
 * @returns {{level: number, label: string} | null}
 */
export function milestoneFor(streak) {
  if (streak === 3) return { level: 1, label: "Aquecendo" };
  if (streak === 5) return { level: 2, label: "Em chamas" };
  if (streak >= 10 && streak % 5 === 0) return { level: 3, label: "Imparável" };
  return null;
}

const RANK_BONUS = { comum: 0, rara: 5, epica: 10 };

/**
 * Score for one answer: 10 for a right one, +2 per extra step of streak (up to +10),
 * plus a bonus for well-sourced cards (rare and epic cards cite more, and more independent, sources).
 * @param {boolean} correct
 * @param {number} streakAfter streak counting this answer
 * @param {"comum" | "rara" | "epica"} rank
 * @returns {number}
 */
export function pointsFor(correct, streakAfter, rank) {
  if (!correct) return 0;
  return 10 + Math.min(Math.max(streakAfter - 1, 0), 5) * 2 + (RANK_BONUS[rank] ?? 0);
}

const LEVELS = [
  { floor: 0, name: "Curioso" },
  { floor: 60, name: "Checador" },
  { floor: 160, name: "Detetive" },
  { floor: 320, name: "Caçador de Fakes" },
  { floor: 560, name: "Mestre da Checagem" },
];

/**
 * @param {number} points
 * @returns {{level: number, name: string, next: number | null, progress: number}}
 */
export function levelFor(points) {
  let index = 0;
  LEVELS.forEach((entry, i) => {
    if (points >= entry.floor) index = i;
  });
  const next = LEVELS[index + 1]?.floor ?? null;
  const floor = LEVELS[index].floor;
  return {
    level: index + 1,
    name: LEVELS[index].name,
    next,
    progress: next === null ? 1 : (points - floor) / (next - floor),
  };
}

const GOOD = ["Boa! Você acertou.", "Mandou bem!", "Na mosca!", "Olho clínico!"];
const BAD = ["Quase! Essa enganou muita gente.", "Pegadinha! Veja a checagem.", "Dessa vez não. Bora aprender.", "Essa é traiçoeira. Confira a fonte."];

/**
 * Game-style feedback that celebrates a hit and teaches on a miss, never shames.
 * @param {boolean} correct
 * @param {number} n counter used to rotate the lines
 * @returns {string}
 */
export function feedbackLine(correct, n) {
  const lines = correct ? GOOD : BAD;
  return lines[((n % lines.length) + lines.length) % lines.length];
}

/**
 * Greedy word wrap for canvas text; `measure` returns the width of a string.
 * A word wider than the line is broken by characters.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(text: string) => number} measure
 * @returns {string[]}
 */
export function wrapLines(text, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const attempt = line ? `${line} ${word}` : word;
    if (measure(attempt) <= maxWidth) {
      line = attempt;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    let rest = word;
    while (measure(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function middleEllipsis(text, max) {
  if (text.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep * 0.55);
  return `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`;
}

/**
 * Message that goes with the shared image. It always leads with the verdict.
 * @param {{claim: string, verdict: string, explanation: string, sources: {label: string, url: string, date: string}[]}} card
 * @param {string} origin
 * @returns {string}
 */
export function shareCaption(card, origin) {
  const [source] = card.sources;
  const date = source.date.split("-").reverse().join("/");
  return [
    `${card.verdict.toUpperCase()}: ${card.claim}`,
    card.explanation,
    `Fonte (${source.label}): ${source.url}`,
    `Checagem de ${date}.`,
    `Jogue o Fato ou Fake?: ${origin}`,
  ].join("\n");
}

export const SETTINGS_DEFAULTS = Object.freeze({
  muted: false,
  sfx: true,
  music: true,
  volume: 70,
  haptics: true,
  motion: "system",
  tilt: true,
  drag: true,
  palette: "normal",
  text: "normal",
});

/**
 * Reads whatever came out of storage and returns a complete, valid settings object.
 * Each field is validated on its own, so one bad value never resets the others.
 * @param {unknown} raw
 * @returns {typeof SETTINGS_DEFAULTS}
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const bool = (key) => (typeof source[key] === "boolean" ? source[key] : SETTINGS_DEFAULTS[key]);
  const choice = (key, allowed) => (allowed.includes(source[key]) ? source[key] : SETTINGS_DEFAULTS[key]);
  const volume = typeof source.volume === "number" && Number.isFinite(source.volume) ? Math.min(100, Math.max(0, Math.round(source.volume))) : SETTINGS_DEFAULTS.volume;
  return {
    muted: bool("muted"),
    sfx: bool("sfx"),
    music: bool("music"),
    volume,
    haptics: bool("haptics"),
    motion: choice("motion", ["system", "reduce"]),
    tilt: bool("tilt"),
    drag: bool("drag"),
    palette: choice("palette", ["normal", "cb"]),
    text: choice("text", ["normal", "large"]),
  };
}
