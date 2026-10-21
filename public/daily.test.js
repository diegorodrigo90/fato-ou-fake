import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, DAILY_SIZE, bestDayStreak, currentDayStreak, dailyDeck, dailyShareText, dayKey, formatCountdown, kindOf, msUntilNextDay, newlyUnlocked, roundRank, starsFor, tallyHits, unlockedIds } from "./daily.js";

const card = (id, verdict, author, claim = "Segundo Lula, algo.") => ({ id, verdict, author, claim });
const pool = [
  ...Array.from({ length: 12 }, (_, i) => card(`lt${i}`, "verdadeiro", i % 2 ? "lula" : "flavio")),
  ...Array.from({ length: 12 }, (_, i) => card(`lf${i}`, "falso", ["lula", "flavio", "terceiros"][i % 3], i % 3 === 2 ? "Post viral: x." : "Segundo Flávio, y.")),
];

describe("dayKey", () => {
  it("uses the local calendar date as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
    expect(dayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("dailyDeck", () => {
  it("is the same for the same day and the same pool, whatever the pool order", () => {
    const a = dailyDeck(pool, "2026-10-21");
    const b = dailyDeck([...pool].reverse(), "2026-10-21");
    expect(a).toEqual(b);
    expect(a).toHaveLength(DAILY_SIZE);
    expect(new Set(a).size).toBe(DAILY_SIZE);
  });

  it("changes from one day to the next", () => {
    expect(dailyDeck(pool, "2026-10-21")).not.toEqual(dailyDeck(pool, "2026-10-22"));
  });

  it("is balanced: half fato and half fake", () => {
    const ids = dailyDeck(pool, "2026-10-21");
    const trues = ids.filter((id) => pool.find((c) => c.id === id).verdict === "verdadeiro").length;
    expect(trues).toBe(DAILY_SIZE / 2);
  });

  it("spreads the authors instead of favouring one", () => {
    const ids = dailyDeck(pool, "2026-10-21");
    const count = (author) => ids.filter((id) => pool.find((c) => c.id === id).author === author).length;
    expect(Math.abs(count("lula") - count("flavio"))).toBeLessThanOrEqual(2);
  });

  it("returns every card when the pool is smaller than a round, and nothing for an empty pool", () => {
    expect(dailyDeck(pool.slice(0, 3), "2026-10-21")).toHaveLength(3);
    expect(dailyDeck([], "2026-10-21")).toEqual([]);
  });

  it("still fills the round when one verdict runs short", () => {
    const mostlyFake = [card("t0", "verdadeiro", "lula"), ...Array.from({ length: 12 }, (_, i) => card(`f${i}`, "falso", "flavio"))];
    expect(dailyDeck(mostlyFake, "2026-10-21")).toHaveLength(DAILY_SIZE);
  });
});

describe("kindOf", () => {
  it("separates viral posts, videos and audios from politicians' statements", () => {
    expect(kindOf({ claim: "Post viral: x." })).toBe("viral");
    expect(kindOf({ claim: "Vídeo viral: x." })).toBe("viral");
    expect(kindOf({ claim: "Áudio viral: x." })).toBe("viral");
    expect(kindOf({ claim: "Post viral com print da CNN: x." })).toBe("viral");
    expect(kindOf({ claim: "Segundo Lula, x." })).toBe("fala");
  });
});

describe("bestDayStreak", () => {
  it("counts the longest run of consecutive days", () => {
    expect(bestDayStreak([])).toBe(0);
    expect(bestDayStreak(["2026-10-21"])).toBe(1);
    expect(bestDayStreak(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-25"])).toBe(3);
    expect(bestDayStreak(["2026-10-21", "2026-10-19", "2026-10-20", "2026-10-20"])).toBe(3);
    expect(bestDayStreak(["2026-02-28", "2026-03-01"])).toBe(2);
  });
});

describe("dailyShareText", () => {
  it("shows the date, the score and one square per card, with no names", () => {
    const text = dailyShareText("2026-10-21", [true, false, true]);
    expect(text).toContain("21/10/2026");
    expect(text).toContain("2/3");
    expect(text).toContain("🟩🟥🟩");
    expect(text).not.toMatch(/Lula|Flávio/);
  });
});

describe("tallyHits", () => {
  it("counts right answers by kind and by author, ignoring unknown cards and wrong answers", () => {
    const cards = [card("a", "falso", "lula", "Post viral: x."), card("b", "verdadeiro", "flavio"), card("c", "falso", "lula")];
    const byId = (id) => cards.find((c) => c.id === id);
    const history = [{ id: "a", correct: true }, { id: "b", correct: true }, { id: "c", correct: false }, { id: "zzz", correct: true }];
    expect(tallyHits(history, byId)).toEqual({ viral: 1, fala: 1, lula: 1, flavio: 1 });
  });
});

const base = { total: 0, hits: 0, bestStreak: 0, sourcesOpened: 0, dailyDays: [], dailyPerfect: 0, viral: 0, fala: 0, lula: 0, flavio: 0 };

describe("achievements", () => {
  it("has unique ids, titles and descriptions", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.desc.length).toBeGreaterThan(8);
      expect(a.goal).toBeGreaterThan(0);
    }
  });

  it("starts with nothing unlocked", () => {
    expect(unlockedIds(base).size).toBe(0);
  });

  it("unlocks the first-answer, streak, source, daily and kind achievements at their goals", () => {
    const ids = unlockedIds({ ...base, total: 1, hits: 10, bestStreak: 5, sourcesOpened: 1, dailyDays: ["2026-10-21"], dailyPerfect: 1, viral: 5, fala: 5 });
    for (const id of ["primeira-carta", "dez-acertos", "sequencia-5", "foi-conferir", "rodada-do-dia", "rodada-perfeita", "cacador-de-boatos", "ouvido-atento"]) expect(ids.has(id)).toBe(true);
    expect(ids.has("sequencia-10")).toBe(false);
  });

  it("unlocks 'dois lados' only when both candidates have enough right answers", () => {
    expect(unlockedIds({ ...base, lula: 9, flavio: 4 }).has("dois-lados")).toBe(false);
    expect(unlockedIds({ ...base, lula: 5, flavio: 5 }).has("dois-lados")).toBe(true);
  });

  it("unlocks day-streak achievements from consecutive days", () => {
    const days = ["2026-10-19", "2026-10-20", "2026-10-21"];
    expect(unlockedIds({ ...base, dailyDays: days }).has("tres-dias")).toBe(true);
    expect(unlockedIds({ ...base, dailyDays: ["2026-10-19", "2026-10-21"] }).has("tres-dias")).toBe(false);
  });

  it("reports only what is new compared with what was already saved", () => {
    const stats = { ...base, total: 3, hits: 1 };
    expect(newlyUnlocked(stats, new Set()).map((a) => a.id)).toEqual(["primeira-carta"]);
    expect(newlyUnlocked(stats, new Set(["primeira-carta"]))).toEqual([]);
  });
});

describe("currentDayStreak", () => {
  it("counts the run that ends today or yesterday, and drops to zero after a missed day", () => {
    expect(currentDayStreak([], "2026-10-21")).toBe(0);
    expect(currentDayStreak(["2026-10-20", "2026-10-21"], "2026-10-21")).toBe(2);
    expect(currentDayStreak(["2026-10-19", "2026-10-20"], "2026-10-21")).toBe(2);
    expect(currentDayStreak(["2026-10-18", "2026-10-19"], "2026-10-21")).toBe(0);
    expect(currentDayStreak(["2026-02-28", "2026-03-01"], "2026-03-01")).toBe(2);
  });
});

describe("starsFor and roundRank", () => {
  it("gives 3 stars from 90%, 2 from 70%, 1 from 40%, and none below", () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(8, 10)).toBe(2);
    expect(starsFor(7, 10)).toBe(2);
    expect(starsFor(6, 10)).toBe(1);
    expect(starsFor(4, 10)).toBe(1);
    expect(starsFor(3, 10)).toBe(0);
    expect(starsFor(0, 0)).toBe(0);
  });

  it("names every star level with a kind, never discouraging, title", () => {
    const titles = [0, 1, 2, 3].map(roundRank);
    expect(new Set(titles).size).toBe(4);
    for (const t of titles) expect(t.length).toBeGreaterThan(4);
  });
});

describe("msUntilNextDay and formatCountdown", () => {
  it("counts down to the next local midnight", () => {
    expect(msUntilNextDay(new Date(2026, 9, 21, 23, 0, 0))).toBe(3600000);
    expect(msUntilNextDay(new Date(2026, 9, 21, 0, 0, 0))).toBe(86400000);
  });

  it("formats hours, minutes and seconds with two digits", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(3661000)).toBe("01:01:01");
    expect(formatCountdown(86399000)).toBe("23:59:59");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});
