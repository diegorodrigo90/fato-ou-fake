import { describe, expect, it } from "vitest";
import { isHttpsUrl, isRealDay, SETTINGS_DEFAULTS, verdictLabel, artSvg, categoryOf, diffNew, feedbackLine, judge, levelFor, middleEllipsis, milestoneFor, normalizeSettings, nextBalanced, nextStreak, nextUnseen, pointsFor, rarityOf, subjectOf, shareCaption, shareEndless, swipeDecision, swipeDismiss, wrapLines } from "./lib.js";

describe("judge", () => {
  it("counts a 'true' answer correct only for a verdadeiro card", () => {
    expect(judge({ verdict: "verdadeiro" }, true)).toBe(true);
    expect(judge({ verdict: "falso" }, true)).toBe(false);
    expect(judge({ verdict: "enganoso" }, true)).toBe(false);
  });

  it("counts a 'fake' answer correct for falso and enganoso cards", () => {
    expect(judge({ verdict: "falso" }, false)).toBe(true);
    expect(judge({ verdict: "enganoso" }, false)).toBe(true);
    expect(judge({ verdict: "verdadeiro" }, false)).toBe(false);
  });
});

describe("nextStreak", () => {
  it("grows on a correct answer and resets on a wrong one", () => {
    expect(nextStreak(2, true)).toBe(3);
    expect(nextStreak(5, false)).toBe(0);
  });
});

describe("nextUnseen", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  it("never returns a card that was already seen", () => {
    const seen = new Set(["a", "b", "c"]);
    for (let n = 0; n < 100; n++) {
      expect(["d", "e"]).toContain(nextUnseen(items, seen, null).id);
    }
  });

  it("returns null when every card was seen", () => {
    expect(nextUnseen(items, new Set(items.map((i) => i.id)), null)).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(nextUnseen([], new Set(), null)).toBeNull();
  });

  it("avoids the card just shown when another unseen one exists", () => {
    const seen = new Set(["a", "b", "c"]);
    for (let n = 0; n < 100; n++) {
      expect(nextUnseen(items, seen, "d").id).toBe("e");
    }
  });

  it("still returns the last card when it is the only unseen one", () => {
    expect(nextUnseen(items, new Set(["a", "b", "c", "e"]), "d").id).toBe("d");
  });

  it("does not mutate the seen set", () => {
    const seen = new Set(["a"]);
    nextUnseen(items, seen, null);
    expect([...seen]).toEqual(["a"]);
  });
});

describe("shareEndless", () => {
  it("shows hits, total and best streak with no personal data", () => {
    expect(shareEndless(17, 22, 9)).toBe("Fato ou Fake? ∞\n17/22 certas · melhor sequência 9");
  });
});

describe("swipeDecision", () => {
  it("does nothing for a tap or a short drag, in either direction", () => {
    expect(swipeDecision(0, 90)).toBeNull();
    expect(swipeDecision(89, 90)).toBeNull();
    expect(swipeDecision(-89, 90)).toBeNull();
  });

  it("answers true at or past the threshold to the right", () => {
    expect(swipeDecision(90, 90)).toBe(true);
    expect(swipeDecision(240, 90)).toBe(true);
  });

  it("answers fake at or past the threshold to the left", () => {
    expect(swipeDecision(-90, 90)).toBe(false);
    expect(swipeDecision(-240, 90)).toBe(false);
  });

  it("does nothing for a non-finite offset", () => {
    expect(swipeDecision(Number.NaN, 90)).toBeNull();
  });
});

describe("diffNew", () => {
  it("returns only the cards whose id is not known yet, in order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(diffNew(items, new Set(["b"])).map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("returns nothing when all are known", () => {
    expect(diffNew([{ id: "a" }], new Set(["a"]))).toEqual([]);
  });
});

describe("rarityOf", () => {
  const src = (label, type) => ({ label, type, url: "https://example.org/", date: "2026-10-20" });

  it("is comum with a single source", () => {
    expect(rarityOf({ sources: [src("Lupa", "agencia")] })).toBe("comum");
    expect(rarityOf({ sources: [src("TSE", "oficial")] })).toBe("comum");
  });

  it("is rara with two different sources", () => {
    expect(rarityOf({ sources: [src("Lupa", "agencia"), src("Aos Fatos", "agencia")] })).toBe("rara");
  });

  it("does not count the same publisher twice", () => {
    expect(rarityOf({ sources: [src("Lupa", "agencia"), src("Lupa", "agencia")] })).toBe("comum");
  });

  it("is epica when two sources include an official primary one", () => {
    expect(rarityOf({ sources: [src("STF", "oficial"), src("Lupa", "agencia")] })).toBe("epica");
  });

  it("counts the same publisher once even when the label adds a qualifier in parentheses", () => {
    expect(rarityOf({ sources: [src("Comprova", "agencia"), src("Comprova (Lula)", "agencia")] })).toBe("comum");
  });

  it("is comum when there are no sources", () => {
    expect(rarityOf({ sources: [] })).toBe("comum");
  });
});

describe("categoryOf", () => {
  it("maps a known category to its icon and label", () => {
    expect(categoryOf({ category: "tribunal" })).toEqual({ icon: "scale", label: "Tribunal" });
    expect(categoryOf({ category: "urna" })).toEqual({ icon: "vote", label: "Eleição" });
  });
  it("falls back to a generic category when missing or unknown", () => {
    expect(categoryOf({})).toEqual({ icon: "circle-help", label: "Geral" });
    expect(categoryOf({ category: "inventada" })).toEqual({ icon: "circle-help", label: "Geral" });
  });
});

describe("artSvg", () => {
  it("is deterministic for the same id and rank", () => {
    expect(artSvg("abc", "comum")).toBe(artSvg("abc", "comum"));
  });
  it("differs between ids and between ranks", () => {
    expect(artSvg("abc", "comum")).not.toBe(artSvg("abd", "comum"));
    expect(artSvg("abc", "comum")).not.toBe(artSvg("abc", "epica"));
  });
  it("is an inline SVG data URI with no script or external reference", () => {
    const uri = artSvg("abc", "rara");
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
    expect(svg).toContain("<svg");
    const withoutNamespace = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
    expect(withoutNamespace).not.toMatch(/script|href|http|url\(/i);
  });
});

describe("nextBalanced", () => {
  const items = [
    { id: "t1", verdict: "verdadeiro" },
    { id: "t2", verdict: "verdadeiro" },
    { id: "f1", verdict: "falso" },
    { id: "f2", verdict: "falso" },
    { id: "f3", verdict: "falso" },
  ];
  // rng scripted: the first value is the dice for the preference, the next ones pick the card
  const script = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
  };

  it("when the dice favor the preference, picks from the opposite group", () => {
    expect(nextBalanced(items, new Set(), "f1", false, script(0.1, 0)).verdict).toBe("verdadeiro");
    expect(nextBalanced(items, new Set(), "t1", true, script(0.1, 0)).verdict).toBe("falso");
  });

  it("when the dice do not favor it, any unseen card can come, even the same kind", () => {
    const pick = nextBalanced(items, new Set(), "f1", false, script(0.9, 0.99));
    expect(pick.id).toBe("f3");
  });

  it("is not a strict alternation: about 65% opposite over many draws", () => {
    let opposite = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      if (nextBalanced(items, new Set(), "f1", false).verdict === "verdadeiro") opposite += 1;
    }
    const rate = opposite / N;
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(0.85);
  });

  it("falls back to the other group when the preferred one is exhausted", () => {
    const seen = new Set(["t1", "t2"]);
    expect(nextBalanced(items, seen, "f1", false, script(0.1, 0)).verdict).toBe("falso");
  });

  it("starts without a preference when there is no previous card", () => {
    expect(nextBalanced(items, new Set(), null, null)).not.toBeNull();
  });

  it("returns null when every card was seen", () => {
    expect(nextBalanced(items, new Set(items.map((i) => i.id)), null, null)).toBeNull();
  });
});

describe("milestoneFor", () => {
  it("is silent between milestones and on zero", () => {
    for (const n of [0, 1, 2, 4, 6, 9, 11, 14]) expect(milestoneFor(n)).toBeNull();
  });
  it("names the first milestones", () => {
    expect(milestoneFor(3)).toEqual({ level: 1, label: "Aquecendo" });
    expect(milestoneFor(5)).toEqual({ level: 2, label: "Em chamas" });
    expect(milestoneFor(10)).toEqual({ level: 3, label: "Imparável" });
  });
  it("keeps celebrating every 5 after 10 without inventing new names", () => {
    expect(milestoneFor(15)).toEqual({ level: 3, label: "Imparável" });
    expect(milestoneFor(20)).toEqual({ level: 3, label: "Imparável" });
  });
});

describe("pointsFor", () => {
  it("gives nothing for a wrong answer", () => {
    expect(pointsFor(false, 0, "epica")).toBe(0);
  });
  it("gives 10 for a right answer and 2 more per extra streak step, up to +10", () => {
    expect(pointsFor(true, 1, "comum")).toBe(10);
    expect(pointsFor(true, 3, "comum")).toBe(14);
    expect(pointsFor(true, 6, "comum")).toBe(20);
    expect(pointsFor(true, 40, "comum")).toBe(20);
  });
  it("rewards reading well-sourced cards: +5 rara, +10 epica", () => {
    expect(pointsFor(true, 1, "rara")).toBe(15);
    expect(pointsFor(true, 1, "epica")).toBe(20);
  });
});

describe("levelFor", () => {
  it("starts at level 1 with progress toward the next", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Curioso", next: 60, progress: 0 });
    expect(levelFor(30).progress).toBeCloseTo(0.5);
  });
  it("moves up at each threshold", () => {
    expect(levelFor(60).name).toBe("Checador");
    expect(levelFor(160).name).toBe("Detetive");
    expect(levelFor(320).name).toBe("Caçador de Fakes");
    expect(levelFor(560).name).toBe("Mestre da Checagem");
  });
  it("stays at the top level with full progress", () => {
    expect(levelFor(5000)).toMatchObject({ level: 5, next: null, progress: 1 });
  });
});

describe("feedbackLine", () => {
  it("rotates through different lines so it does not repeat every card", () => {
    const lines = new Set([0, 1, 2, 3].map((n) => feedbackLine(true, n)));
    expect(lines.size).toBe(4);
  });
  it("is never discouraging after a wrong answer", () => {
    for (let n = 0; n < 8; n++) {
      expect(feedbackLine(false, n)).not.toMatch(/burro|errou feio|péssimo|fracasso/i);
      expect(feedbackLine(false, n).length).toBeGreaterThan(3);
    }
  });
});

describe("wrapLines", () => {
  const len = (text) => text.length;
  it("wraps greedily on word boundaries", () => {
    expect(wrapLines("a bb ccc dddd", 5, len)).toEqual(["a bb", "ccc", "dddd"]);
  });
  it("breaks a single word that is wider than the line", () => {
    expect(wrapLines("abcdefgh", 3, len)).toEqual(["abc", "def", "gh"]);
  });
  it("keeps short text on one line and drops empty input", () => {
    expect(wrapLines("oi mundo", 20, len)).toEqual(["oi mundo"]);
    expect(wrapLines("", 20, len)).toEqual([]);
  });
});

describe("middleEllipsis", () => {
  it("leaves short text alone", () => {
    expect(middleEllipsis("agencialupa.org", 30)).toBe("agencialupa.org");
  });
  it("shortens in the middle, keeping the start and the end of the link", () => {
    const url = "https://www.agencialupa.org/checagem/2026/10/18/ao-vivo-checagem-do-debate";
    const out = middleEllipsis(url, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.startsWith("https://www.")).toBe(true);
    expect(out.endsWith("do-debate")).toBe(true);
    expect(out).toContain("…");
  });
});

describe("shareCaption", () => {
  const card = {
    claim: "Lula: o Brasil cresceu 7,5% em 2010.",
    verdict: "verdadeiro",
    explanation: "Pela série histórica do IBGE, o Brasil terminou 2010 com crescimento de 7,5%.",
    asOf: "2026-10-20",
    sources: [{ label: "Lupa", url: "https://www.agencialupa.org/checagem/x", date: "2026-10-18" }],
  };
  it("leads with the verdict so a false claim never travels without its stamp", () => {
    const text = shareCaption({ ...card, verdict: "falso" }, "https://jogo.example");
    expect(text.split("\n")[0].startsWith("FALSO")).toBe(true);
  });
  it("includes the claim, the explanation, the first source link, the date and the game link", () => {
    const text = shareCaption(card, "https://jogo.example");
    expect(text).toContain(card.claim);
    expect(text).toContain(card.explanation);
    expect(text).toContain("https://www.agencialupa.org/checagem/x");
    expect(text).toContain("Checagem de 18/10/2026");
    expect(text).not.toContain("20/10/2026");
    expect(text).toContain("https://jogo.example");
  });
});

describe("normalizeSettings", () => {
  it("returns the defaults for missing or garbage input", () => {
    for (const raw of [undefined, null, 5, "x", [], {}]) {
      expect(normalizeSettings(raw)).toEqual(SETTINGS_DEFAULTS);
    }
  });

  it("keeps valid values", () => {
    const raw = { muted: true, sfx: false, music: true, volume: 30, haptics: false, motion: "reduce", tilt: false, drag: false, palette: "cb", text: "large" };
    expect(normalizeSettings(raw)).toEqual(raw);
  });

  it("replaces invalid values one by one without touching the valid ones", () => {
    const out = normalizeSettings({ sfx: "sim", music: true, volume: "alto", motion: "sempre", palette: "cb", text: 3 });
    expect(out.sfx).toBe(SETTINGS_DEFAULTS.sfx);
    expect(out.music).toBe(true);
    expect(out.volume).toBe(SETTINGS_DEFAULTS.volume);
    expect(out.motion).toBe(SETTINGS_DEFAULTS.motion);
    expect(out.palette).toBe("cb");
    expect(out.text).toBe(SETTINGS_DEFAULTS.text);
  });

  it("clamps and rounds the volume to 0-100", () => {
    expect(normalizeSettings({ volume: 250 }).volume).toBe(100);
    expect(normalizeSettings({ volume: -5 }).volume).toBe(0);
    expect(normalizeSettings({ volume: 33.6 }).volume).toBe(34);
  });

  it("starts with sound effects on, music on and system motion", () => {
    expect(SETTINGS_DEFAULTS).toMatchObject({ muted: false, sfx: true, music: true, motion: "system", palette: "normal", text: "normal", haptics: true, tilt: true, drag: true });
  });
});

describe("subjectOf", () => {
  it("dá o mesmo formato neutro para cada autor", () => {
    expect(subjectOf({ author: "flavio" })).toBe("Sobre Flávio");
    expect(subjectOf({ author: "lula" })).toBe("Sobre Lula");
    expect(subjectOf({ author: "terceiros" })).toBe("Outras pessoas");
    expect(subjectOf({})).toBe("");
  });
});

describe("verdictLabel", () => {
  it("shows fato for verdadeiro and fake for falso", () => {
    expect(verdictLabel({ verdict: "verdadeiro" })).toBe("fato");
    expect(verdictLabel({ verdict: "falso" })).toBe("fake");
  });
});

describe("swipeDismiss", () => {
  it("goes to the next card on a swipe to either side past the threshold, not on a tap or short drag", () => {
    expect(swipeDismiss(90, 90)).toBe(true);
    expect(swipeDismiss(-90, 90)).toBe(true);
    expect(swipeDismiss(200, 90)).toBe(true);
    expect(swipeDismiss(89, 90)).toBe(false);
    expect(swipeDismiss(-89, 90)).toBe(false);
    expect(swipeDismiss(0, 90)).toBe(false);
    expect(swipeDismiss(Number.NaN, 90)).toBe(false);
  });
});

describe("nextBalanced across authors", () => {
  const skewed = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, verdict: "verdadeiro", author: "lula" })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, verdict: "falso", author: "flavio" })),
    ...Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, verdict: "falso", author: "terceiros" })),
  ];

  it("does not let the biggest group drown the others", () => {
    let seedState = 7;
    const rng = () => ((seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const counts = { lula: 0, flavio: 0, terceiros: 0 };
    for (let i = 0; i < 300; i++) counts[nextBalanced(skewed, new Set(), null, null, rng).author] += 1;
    expect(counts.lula).toBeGreaterThan(60);
    expect(counts.flavio).toBeGreaterThan(60);
    expect(counts.terceiros).toBeLessThan(180);
  });

  it("falls back to the remaining groups when one runs out", () => {
    const seen = new Set(["l0", "l1", "l2"]);
    for (let i = 0; i < 20; i++) expect(nextBalanced(skewed, seen, null, null).author).not.toBe("lula");
  });
});

describe("isHttpsUrl", () => {
  it("accepts https links and rejects other schemes and junk", () => {
    expect(isHttpsUrl("https://www.aosfatos.org/noticias/x/")).toBe(true);
    expect(isHttpsUrl("http://www.aosfatos.org/")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("data:text/html,<b>x</b>")).toBe(false);
    expect(isHttpsUrl("//aosfatos.org/x")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(isHttpsUrl(42)).toBe(false);
  });
});

describe("isRealDay", () => {
  it("accepts calendar days and rejects impossible dates and junk", () => {
    expect(isRealDay("2026-10-24")).toBe(true);
    expect(isRealDay("2028-02-29")).toBe(true);
    expect(isRealDay("2026-02-29")).toBe(false);
    expect(isRealDay("2026-13-99")).toBe(false);
    expect(isRealDay("2026-1-5")).toBe(false);
    expect(isRealDay("")).toBe(false);
    expect(isRealDay(20261024)).toBe(false);
  });
});
