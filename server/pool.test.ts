import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPoolSource, loadPool } from "./pool.js";

async function poolFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pool-"));
  const path = join(dir, "pool.json");
  await writeFile(path, content);
  return path;
}

const item = (id: string, claim: string, extra: Record<string, unknown> = {}) => ({
  id,
  claim,
  verdict: "falso",
  explanation: "A checagem não encontrou registro que sustente a afirmação.",
  status: "checagem publicada",
  asOf: "2026-10-20",
  sources: [{ label: "STF", type: "oficial", url: "https://portal.stf.jus.br/a", date: "2022-01-01" }],
  ...extra,
});
const pool = (items: unknown[]) => JSON.stringify({ version: 3, items });

describe("loadPool", () => {
  it("loads a valid pool", async () => {
    const loaded = await loadPool("data/pool.json");
    expect(loaded.version).toBeGreaterThanOrEqual(3);
    expect(loaded.items.length).toBeGreaterThan(0);
  });

  it("keeps verdict, explanation, status, asOf and sources on each item", async () => {
    const path = await poolFile(pool([item("a", "um")]));
    const [first] = (await loadPool(path)).items;
    expect(first.verdict).toBe("falso");
    expect(first.explanation).toContain("checagem");
    expect(first.status).toBe("checagem publicada");
    expect(first.asOf).toBe("2026-10-20");
    expect(first.sources[0].url).toBe("https://portal.stf.jus.br/a");
  });

  it("rejects an item without status", async () => {
    const path = await poolFile(pool([item("a", "um", { status: "" })]));
    await expect(loadPool(path)).rejects.toThrow(/status/);
  });

  it("accepts an optional clue and rejects an empty one", async () => {
    const ok = await loadPool(await poolFile(pool([item("a", "um", { clue: "O número foi alterado." })])));
    expect(ok.items[0].clue).toBe("O número foi alterado.");
    await expect(loadPool(await poolFile(pool([item("a", "um", { clue: "" })])))).rejects.toThrow(/clue/);
  });

  it("accepts an optional source type and rejects an unknown one", async () => {
    const good = [{ label: "STF", type: "oficial", url: "https://portal.stf.jus.br/a", date: "2022-01-01" }];
    const ok = await loadPool(await poolFile(pool([item("a", "um", { sources: good })])));
    expect(ok.items[0].sources[0].type).toBe("oficial");
    const bad = [{ label: "STF", type: "imprensa", url: "https://portal.stf.jus.br/a", date: "2022-01-01" }];
    await expect(loadPool(await poolFile(pool([item("a", "um", { sources: bad })])))).rejects.toThrow(/type/);
  });

  it("accepts an author of flavio, lula or terceiros and rejects anything else", async () => {
    for (const author of ["flavio", "lula", "terceiros"]) {
      const ok = await loadPool(await poolFile(pool([item("a", "um", { author })])));
      expect(ok.items[0].author).toBe(author);
    }
    await expect(loadPool(await poolFile(pool([item("a", "um", { author: "outro" })])))).rejects.toThrow(/author/);
  });

  it("accepts a known category and rejects an unknown one", async () => {
    const ok = await loadPool(await poolFile(pool([item("a", "um", { category: "tribunal" })])));
    expect(ok.items[0].category).toBe("tribunal");
    await expect(loadPool(await poolFile(pool([item("a", "um", { category: "esporte" })])))).rejects.toThrow(/category/);
  });

  it("rejects enganoso and any verdict other than verdadeiro or falso, so every card has a clear answer", async () => {
    for (const verdict of ["talvez", "enganoso"]) {
      const path = await poolFile(pool([item("a", "um", { verdict })]));
      await expect(loadPool(path)).rejects.toThrow(/verdict/);
    }
  });

  it("rejects an item without an explanation", async () => {
    const path = await poolFile(pool([item("a", "um", { explanation: "" })]));
    await expect(loadPool(path)).rejects.toThrow(/explanation/);
  });

  it("rejects an item without sources", async () => {
    const path = await poolFile(pool([item("a", "um", { sources: [] })]));
    await expect(loadPool(path)).rejects.toThrow(/sources/);
  });

  it("rejects a source url that is not https", async () => {
    const sources = [{ label: "STF", url: "http://portal.stf.jus.br/a", date: "2022-01-01" }];
    await expect(loadPool(await poolFile(pool([item("a", "um", { sources })])))).rejects.toThrow(/url/);
  });

  it("rejects asOf that is not a YYYY-MM-DD date", async () => {
    const path = await poolFile(pool([item("a", "um", { asOf: "20/10/2026" })]));
    await expect(loadPool(path)).rejects.toThrow(/asOf/);
  });

  it("rejects an empty items array", async () => {
    await expect(loadPool(await poolFile(pool([])))).rejects.toThrow(/items/);
  });

  it("rejects duplicate ids", async () => {
    const path = await poolFile(pool([item("a", "um"), item("a", "dois")]));
    await expect(loadPool(path)).rejects.toThrow(/duplicate/i);
  });

  it("rejects a claim longer than 160 chars", async () => {
    const path = await poolFile(pool([item("a", "x".repeat(161))]));
    await expect(loadPool(path)).rejects.toThrow(/claim/);
  });

  it("rejects a claim containing http:// or https://", async () => {
    for (const text of ["veja http://x.com", "veja https://x.com"]) {
      await expect(loadPool(await poolFile(pool([item("a", text)])))).rejects.toThrow(/claim/);
    }
  });

  it("rejects malformed JSON", async () => {
    await expect(loadPool(await poolFile("{nope"))).rejects.toThrow(/JSON/);
  });
});

describe("createPoolSource", () => {
  const bump = async (path: string) => {
    const later = new Date(Date.now() + 5000);
    await utimes(path, later, later);
  };

  it("serves the pool loaded at startup", async () => {
    const path = await poolFile(pool([item("a", "um")]));
    const source = await createPoolSource(path);
    expect((await source.current()).items.map((i) => i.id)).toEqual(["a"]);
  });

  it("picks up a changed file on the next read", async () => {
    const path = await poolFile(pool([item("a", "um")]));
    const source = await createPoolSource(path);
    await writeFile(path, pool([item("a", "um"), item("b", "dois")]));
    await bump(path);
    expect((await source.current()).items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("keeps the last valid pool when the file becomes invalid", async () => {
    const path = await poolFile(pool([item("a", "um")]));
    const source = await createPoolSource(path);
    await writeFile(path, "{quebrado");
    await bump(path);
    expect((await source.current()).items.map((i) => i.id)).toEqual(["a"]);
  });

  it("rejects at startup when the file is invalid", async () => {
    await expect(createPoolSource(await poolFile("{quebrado"))).rejects.toThrow(/JSON/);
  });
});

describe("approved source registry", () => {
  const withSource = (label: string, url: string, type?: string) =>
    pool([item("a", "um", { sources: [{ label, url, date: "2026-10-20", ...(type ? { type } : {}) }] })]);

  it("accepts an approved fact-checker on its own domain, with or without a qualifier", async () => {
    const url = "https://www.agencialupa.org/checagem/x";
    expect((await loadPool(await poolFile(withSource("Lupa", url, "agencia")))).items).toHaveLength(1);
    expect((await loadPool(await poolFile(withSource("Lupa (debate)", url, "agencia")))).items).toHaveLength(1);
  });

  it("rejects a page outside the fact-check section of a publisher's site", async () => {
    await expect(
      loadPool(await poolFile(withSource("Lupa", "https://www.agencialupa.org/opiniao/x", "agencia"))),
    ).rejects.toThrow(/path/);
    await expect(
      loadPool(await poolFile(withSource("Estadão Verifica", "https://www.estadao.com.br/politica/coluna-x", "agencia"))),
    ).rejects.toThrow(/path/);
  });

  it("accepts the fact-check section of those sites", async () => {
    const ok = await loadPool(
      await poolFile(withSource("Estadão Verifica", "https://www.estadao.com.br/estadao-verifica/x", "agencia")),
    );
    expect(ok.items).toHaveLength(1);
  });

  it("rejects a publisher that is not in the registry", async () => {
    await expect(loadPool(await poolFile(withSource("Blog do Fulano", "https://blog.example.org/x")))).rejects.toThrow(/publisher/);
  });

  it("rejects a publisher that is listed but not approved (Comprova)", async () => {
    await expect(
      loadPool(await poolFile(withSource("Comprova", "https://projetocomprova.com.br/x", "agencia"))),
    ).rejects.toThrow(/not approved/);
  });

  it("rejects a link whose domain does not belong to the publisher", async () => {
    await expect(loadPool(await poolFile(withSource("Lupa", "https://example.org/x", "agencia")))).rejects.toThrow(/domain/);
  });

  it("rejects a type that contradicts the registry", async () => {
    await expect(
      loadPool(await poolFile(withSource("Lupa", "https://www.agencialupa.org/checagem/x", "oficial"))),
    ).rejects.toThrow(/type/);
  });
});
