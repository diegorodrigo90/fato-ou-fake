import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createPoolSource } from "./pool.js";

const port = Number(process.env.PORT ?? 3000);
const poolPath = process.env.POOL_PATH ?? "data/pool.json";

try {
  const source = await createPoolSource(poolPath);
  const server = serve(
    {
      fetch: createApp(source, { trustProxy: process.env.TRUST_PROXY === "true" }).fetch,
      port,
      // Limites explícitos: conexões lentas não ficam presas dependendo do padrão da versão do Node.
      serverOptions: { headersTimeout: 10_000, requestTimeout: 30_000 },
    },
    (info) => {
      console.log(`fato-ou-fake listening on :${info.port}`);
    },
  );
  // Encerra limpo no deploy: o Docker manda SIGTERM e o Node como PID 1 não trata isso sozinho.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// Erro que ninguém tratou: registra e sai, para o Docker reiniciar o processo em vez de seguir em estado incerto.
for (const event of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(event, (error) => {
    console.error(`${event}:`, error);
    process.exit(1);
  });
}
