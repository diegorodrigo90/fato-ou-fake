import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { compress } from "hono/compress";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";
import { etag } from "hono/etag";
import type { Pool, PoolSource } from "./pool.js";
import { IFCN_CHECKED_ON, SOURCES } from "./sources.js";

export interface AppOptions {
  publicDir?: string;
  /** Only true behind a reverse proxy that appends the real client IP to x-forwarded-for. */
  trustProxy?: boolean;
}

const self = ["'self'"];

// The proxy appends the peer it saw, so the rightmost entry is the only one a client cannot forge.
function rightmostForwarded(header: string | undefined): string | undefined {
  return header?.split(",").at(-1)?.trim() || undefined;
}

function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

export function createApp(source: Pool | PoolSource, opts: AppOptions = {}): Hono {
  const app = new Hono();
  // O JSON do baralho (cerca de 1,3 MB) é serializado uma vez por versão do pool, não a cada requisição.
  const serialized = new WeakMap<object, string>();
  const currentPool = async (): Promise<Pool> => ("current" in source ? source.current() : source);

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: self,
        scriptSrc: self,
        styleSrc: self,
        connectSrc: self,
        imgSrc: ["'self'", "data:"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
      xContentTypeOptions: "nosniff",
      referrerPolicy: "no-referrer",
      permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], usb: [] },
    }),
  );
  // PoC privada: fora dos buscadores até a divulgação (remover junto com o meta robots do index.html).
  app.use("*", async (c, next) => {
    await next();
    c.res.headers.set("X-Robots-Tag", "noindex, nofollow");
  });
  app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
  app.use("*", etag());
  app.use(compress());

  app.use(
    "/api/*",
    rateLimiter({
      windowMs: 60_000,
      limit: 240,
      standardHeaders: "draft-7",
      keyGenerator: (c) => {
        const ip = opts.trustProxy ? rightmostForwarded(c.req.header("x-forwarded-for")) : socketAddress(c);
        if (!ip) throw new HTTPException(400, { message: "client address unavailable" });
        return ip;
      },
    }),
  );

  app.get("/healthz", (c) => c.text("ok"));
  app.get("/api/pool", async (c) => {
    const pool = await currentPool();
    let body = serialized.get(pool);
    if (body === undefined) {
      body = JSON.stringify(pool);
      serialized.set(pool, body);
    }
    return c.body(body, 200, { "Content-Type": "application/json" });
  });
  app.get("/api/sources", (c) =>
    c.json({
      checkedOn: IFCN_CHECKED_ON,
      sources: SOURCES.filter((s) => s.approved).map(({ name, type, basis, ifcn }) => ({ name, type, basis, ifcn })),
    }),
  );

  app.use("*", async (c, next) => {
    await next();
    if (c.res.ok && c.res.headers.has("last-modified")) {
      // Sem hash no nome do arquivo: html, js e css são revalidados a cada carga (ETag), para um deploy
      // nunca misturar arquivos novos e velhos. Imagens mudam raramente e podem ficar um dia no cache.
      const image = /\.(svg|png|woff2?)$/.test(c.req.path);
      c.res.headers.set("Cache-Control", image ? "public, max-age=86400" : "no-cache");
    }
  });
  app.use("*", serveStatic({ root: opts.publicDir ?? "./public" }));

  return app;
}
