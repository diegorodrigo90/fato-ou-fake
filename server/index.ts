import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createPoolSource } from "./pool.js";

const port = Number(process.env.PORT ?? 3000);
const poolPath = process.env.POOL_PATH ?? "data/pool.json";

try {
  const source = await createPoolSource(poolPath);
  const server = serve({ fetch: createApp(source, { trustProxy: process.env.TRUST_PROXY === "true" }).fetch, port }, (info) => {
    console.log(`fato-ou-fake listening on :${info.port}`);
  });
  // Encerra limpo no deploy: o Docker manda SIGTERM e o Node como PID 1 não trata isso sozinho.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
