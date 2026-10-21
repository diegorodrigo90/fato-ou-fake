import { describe, expect, it } from "vitest";
import { albumView, rowsFor } from "./album.js";

const items = Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, verdict: i % 2 ? "falso" : "verdadeiro" }));
const history = [
  { id: "c1", correct: true },
  { id: "c2", correct: false },
  { id: "c5", correct: true },
  { id: "zzz", correct: true },
  { id: "c2", correct: true },
];

describe("albumView", () => {
  it("lists every card in pool order, marking answered ones and locking the rest", () => {
    const view = albumView(items, history, { perPage: 6 });
    expect(view.slots.map((s) => s.card.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(view.slots.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(view.slots.map((s) => s.state)).toEqual(["right", "right", "locked", "locked", "right", "locked"]);
  });

  it("counts collected, right, wrong and missing, ignoring cards no longer in the pool", () => {
    const view = albumView(items, [{ id: "c1", correct: true }, { id: "c3", correct: false }, { id: "gone", correct: true }], { perPage: 6 });
    expect(view.counts).toEqual({ all: 20, right: 1, wrong: 1, missing: 18 });
    expect(view.collected).toBe(2);
  });

  it("filters by result and paginates the filtered list", () => {
    const view = albumView(items, history, { filter: "missing", perPage: 6 });
    expect(view.total).toBe(17);
    expect(view.pages).toBe(3);
    expect(view.slots).toHaveLength(6);
    expect(view.slots.every((s) => s.state === "locked")).toBe(true);
    const last = albumView(items, history, { filter: "missing", perPage: 6, page: 2 });
    expect(last.slots).toHaveLength(5);
  });

  it("clamps the page and always has at least one page", () => {
    expect(albumView(items, history, { perPage: 6, page: 99 }).page).toBe(3);
    expect(albumView(items, history, { perPage: 6, page: -4 }).page).toBe(0);
    const empty = albumView(items, [], { filter: "right", perPage: 6 });
    expect(empty.pages).toBe(1);
    expect(empty.slots).toEqual([]);
  });

  it("uses the latest answer when a card was answered more than once", () => {
    const view = albumView(items, history, { filter: "right", perPage: 6 });
    expect(view.slots.map((s) => s.card.id)).toEqual(["c1", "c2", "c5"]);
  });
});

describe("rowsFor", () => {
  it("fits as many 3-column rows as the screen height allows, never fewer than two nor more than four", () => {
    expect(rowsFor(568, 320)).toBe(2);
    expect(rowsFor(668, 360)).toBe(2);
    expect(rowsFor(915, 412)).toBe(3);
    expect(rowsFor(1366, 1024)).toBe(4);
    expect(rowsFor(300, 320)).toBe(2);
  });
});
