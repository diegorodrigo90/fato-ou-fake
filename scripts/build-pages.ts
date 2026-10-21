// Gera o site estático para o GitHub Pages em dist-pages/: o jogo, as cartas e a lista de fontes como arquivos.
// Valida o baralho com o mesmo zod do servidor, então uma carta fora das regras quebra o build.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPool } from "../server/pool.js";
import { IFCN_CHECKED_ON, SOURCES } from "../server/sources.js";

const out = "dist-pages";
const poolPath = process.env.POOL_PATH ?? "data/pool.json";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp("public", out, {
  recursive: true,
  filter: (src) => !/\.test\.js$|axe\.tmp\.js$/.test(src),
});

const pool = await loadPool(poolPath);
await writeFile(join(out, "pool.json"), JSON.stringify(pool));
await writeFile(
  join(out, "sources.json"),
  JSON.stringify({
    checkedOn: IFCN_CHECKED_ON,
    sources: SOURCES.filter((s) => s.approved).map(({ name, type, basis, ifcn }) => ({ name, type, basis, ifcn })),
  }),
);

const config = await readFile(join(out, "config.js"), "utf8");
await writeFile(
  join(out, "config.js"),
  config
    .replace(/export const POOL_URL = .*;/, 'export const POOL_URL = "./pool.json";')
    .replace(/export const SOURCES_URL = .*;/, 'export const SOURCES_URL = "./sources.json";'),
);

// O Pages não envia cabeçalhos, então a política de conteúdo vai no próprio HTML.
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'";
const html = await readFile(join(out, "index.html"), "utf8");
await writeFile(
  join(out, "index.html"),
  html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`),
);
await writeFile(join(out, ".nojekyll"), "");

// Sob /nome-do-repo/ qualquer caminho começando com "/" aponta para o lugar errado.
const absolute = /(?:href|src)="\/[^/]|url\(["']?\/[^/]|"(?:start_url|scope|src)": "\//;
for (const name of await readdir(out)) {
  if (!/\.(html|css|js|webmanifest)$/.test(name)) continue;
  const text = await readFile(join(out, name), "utf8");
  if (absolute.test(text)) throw new Error(`caminho absoluto em ${name}: quebra fora da raiz do domínio`);
}
console.log(`dist-pages pronto: ${pool.items.length} cartas`);
