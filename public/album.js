// Álbum como fichário de cartas: ordem fixa do baralho, cartas ainda não respondidas viradas e páginas curtas.

/**
 * @typedef {{card: any, position: number, state: "right" | "wrong" | "locked"}} Slot
 * @typedef {"all" | "right" | "wrong" | "missing"} Filter
 */

/**
 * @param {any[]} items cartas do baralho, na ordem do baralho
 * @param {{id: string, correct: boolean}[]} history respostas, da mais antiga à mais nova
 * @param {{filter?: Filter, page?: number, perPage?: number}} [options]
 * @returns {{slots: Slot[], page: number, pages: number, total: number, counts: {all: number, right: number, wrong: number, missing: number}, collected: number}}
 */
export function albumView(items, history, { filter = "all", page = 0, perPage = 6 } = {}) {
  const result = new Map();
  for (const entry of history) result.set(entry.id, entry.correct);
  /** @type {Slot[]} */
  const entries = items.map((card, i) => ({
    card,
    position: i + 1,
    state: result.has(card.id) ? (result.get(card.id) ? "right" : "wrong") : "locked",
  }));
  const right = entries.filter((e) => e.state === "right").length;
  const wrong = entries.filter((e) => e.state === "wrong").length;
  const counts = { all: entries.length, right, wrong, missing: entries.length - right - wrong };
  const wanted = { all: null, right: "right", wrong: "wrong", missing: "locked" }[filter];
  const filtered = wanted ? entries.filter((e) => e.state === wanted) : entries;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const at = Math.max(0, Math.min(pages - 1, page));
  return { slots: filtered.slice(at * perPage, at * perPage + perPage), page: at, pages, total: filtered.length, counts, collected: right + wrong };
}

/**
 * Linhas de cartas por página (3 por linha): quantas cabem na altura da tela sem rolar.
 * A carta tem proporção 5:7 e a largura segue a coluna do álbum (no máximo 24rem).
 * @param {number} viewportHeight
 * @param {number} viewportWidth
 * @returns {number}
 */
export function rowsFor(viewportHeight, viewportWidth) {
  const gridWidth = Math.min(viewportWidth - 32, 384);
  const cellHeight = (((gridWidth - 16) / 3) * 7) / 5;
  const overhead = 290; // margens, título, barra, filtros, paginação e barra de menu
  const rows = Math.floor((viewportHeight - overhead) / (cellHeight + 8));
  return Math.max(2, Math.min(4, rows));
}
