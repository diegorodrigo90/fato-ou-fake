import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp as build } from "./app.js";
import type { Pool } from "./pool.js";

const ip = { "x-forwarded-for": "198.51.100.1" };
const createApp = (p: Pool, o: Parameters<typeof build>[1] = {}) => build(p, { trustProxy: true, ...o });

const base = {
  verdict: "falso" as const,
  explanation: "Explicação de exemplo.",
  status: "checagem publicada",
  asOf: "2026-10-20",
  sources: [{ label: "Lupa", type: "agencia" as const, url: "https://www.agencialupa.org/x", date: "2026-10-20" }],
};

const pool: Pool = {
  version: 3,
  items: [
    { id: "a", claim: "Exemplo A", ...base },
    { id: "b", claim: "Exemplo B", ...base },
  ],
};

async function publicDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "public-"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>t</title>");
  return dir;
}

describe("createApp", () => {
  it("GET /healthz returns 200 ok", async () => {
    const res = await createApp(pool).request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("GET /api/pool returns the pool as JSON", async () => {
    const res = await createApp(pool).request("/api/pool", { headers: ip });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(pool);
  });

  it("sends security headers", async () => {
    const res = await createApp(pool).request("/healthz");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not enable CORS on /api/pool", async () => {
    const res = await createApp(pool).request("/api/pool", { headers: ip });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rate limits /api to 240 requests per minute per IP", async () => {
    const app = createApp(pool);
    let last = 200;
    for (let i = 0; i < 241; i++) {
      last = (await app.request("/api/pool", { headers: ip })).status;
    }
    expect(last).toBe(429);
  });

  it("keys the limit on the proxy-added (rightmost) hop, not a spoofable leftmost entry", async () => {
    const app = createApp(pool);
    let last = 200;
    for (let i = 0; i < 241; i++) {
      const headers = { "x-forwarded-for": `10.0.0.${i % 250}, 203.0.113.7` };
      last = (await app.request("/api/pool", { headers })).status;
    }
    expect(last).toBe(429);
  });

  it("refuses /api requests it cannot attribute to a client (no proxy trust, no socket)", async () => {
    const res = await build(pool).request("/api/pool", { headers: ip });
    expect(res.status).toBe(400);
  });

  it("serves index.html from the public dir", async () => {
    const res = await createApp(pool, { publicDir: await publicDir() }).request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>t</title>");
  });

  it("compresses /api/pool with gzip", async () => {
    const big: Pool = {
      version: 3,
      items: Array.from({ length: 80 }, (_, i) => ({ id: `i${i}`, claim: `Exemplo ${i}`, ...base })),
    };
    const res = await createApp(big).request("/api/pool", {
      headers: { ...ip, "accept-encoding": "gzip" },
    });
    expect(res.headers.get("content-encoding")).toBe("gzip");
  });

  it("revalidates html, js and css on every load so a deploy never mixes old and new files", async () => {
    const app = createApp(pool, { publicDir: await publicDir() });
    const first = await app.request("/index.html");
    expect(first.headers.get("cache-control")).toBe("no-cache");
    const tag = first.headers.get("etag");
    expect(tag).toBeTruthy();
    const second = await app.request("/index.html", { headers: { "if-none-match": tag! } });
    expect(second.status).toBe(304);
  });

  it("lets images cache for a day", async () => {
    const dir = await publicDir();
    await writeFile(join(dir, "a.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    const res = await createApp(pool, { publicDir: dir }).request("/a.svg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
  });

  it("keeps the private PoC out of search engines", async () => {
    const app = createApp(pool, { publicDir: await publicDir() });
    expect((await app.request("/healthz")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = await app.request("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });

  it("sends a restrictive Permissions-Policy", async () => {
    const res = await createApp(pool).request("/healthz");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });
});

describe("pool freshness", () => {
  it("returns an ETag and answers 304 to a matching If-None-Match", async () => {
    const app = createApp(pool);
    const first = await app.request("/api/pool", { headers: ip });
    const tag = first.headers.get("etag");
    expect(tag).toBeTruthy();
    const second = await app.request("/api/pool", { headers: { ...ip, "if-none-match": tag! } });
    expect(second.status).toBe(304);
  });

  it("serves the latest pool from a live source and changes the ETag", async () => {
    let current = pool;
    const app = createApp({ current: async () => current });
    const a = await app.request("/api/pool", { headers: ip });
    current = { ...pool, items: [...pool.items, { id: "c", claim: "Exemplo C", ...base }] };
    const b = await app.request("/api/pool", { headers: ip });
    expect((await b.json()).items).toHaveLength(3);
    expect(b.headers.get("etag")).not.toBe(a.headers.get("etag"));
  });
});

describe("GET /api/sources", () => {
  it("lists only approved publishers with the reason they were approved", async () => {
    const res = await createApp(pool).request("/api/sources", { headers: ip });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkedOn: string; sources: { name: string; basis: string; ifcn?: { status: string } }[] };
    const names = body.sources.map((s) => s.name);
    expect(names).toContain("Lupa");
    expect(names).toContain("Aos Fatos");
    expect(names).not.toContain("Comprova");
    expect(body.sources.every((s) => s.basis.length > 10)).toBe(true);
    expect(body.sources.find((s) => s.name === "Lupa")?.ifcn?.status).toBe("em renovação");
    expect(body.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
