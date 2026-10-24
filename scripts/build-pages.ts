// Gera o site estático para o GitHub Pages em dist-pages/: o jogo, as cartas e a lista de fontes como arquivos.
// Valida o baralho com o mesmo zod do servidor, então uma carta fora das regras quebra o build.
import { statSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPool } from "../server/pool.js";
import { IFCN_CHECKED_ON, SOURCES } from "../server/sources.js";

const out = "dist-pages";
const poolPath = process.env.POOL_PATH ?? "data/pool.json";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
// Lista de permissão: só tipos de arquivo do jogo vão para o site; um arquivo qualquer em public/ não é publicado.
const PUBLISHED = /\.(html|css|js|svg|png|webmanifest)$|(^|[\\/])LICENSE$/;
await cp("public", out, {
  recursive: true,
  filter: (src) => statSync(src).isDirectory() || (PUBLISHED.test(src) && !/\.test\.js$|axe\.tmp\.js$/.test(src)),
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
// O Cloudflare Web Analytics entra na política só quando há token em config.js.
const analytics = /ANALYTICS_TOKEN = "[^"]+"/.test(config);
const csp = [
  "default-src 'self'",
  `script-src 'self'${analytics ? " https://static.cloudflareinsights.com" : ""}`,
  "style-src 'self'",
  `connect-src 'self'${analytics ? " https://cloudflareinsights.com" : ""}`,
  "img-src 'self' data:",
  "base-uri 'none'",
].join("; ");
const html = await readFile(join(out, "index.html"), "utf8");
const secured = html.replace(
  '<meta charset="utf-8">',
  `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  <meta name="referrer" content="no-referrer">`,
);
// A troca acima falha em silêncio se o index.html mudar: sem a política no HTML, o build não pode sair.
if (!secured.includes('http-equiv="Content-Security-Policy"') || !secured.includes('name="referrer"')) {
  throw new Error("index.html sem a política de conteúdo: o <meta charset> mudou?");
}
await writeFile(join(out, "index.html"), secured);
await writeFile(join(out, ".nojekyll"), "");

// Sob /nome-do-repo/ qualquer caminho começando com "/" aponta para o lugar errado.
const absolute = /(?:href|src)="\/[^/]|url\(["']?\/[^/]|"(?:start_url|scope|src)": "\//;
for (const name of await readdir(out)) {
  if (!/\.(html|css|js|webmanifest)$/.test(name)) continue;
  const text = await readFile(join(out, name), "utf8");
  if (absolute.test(text)) throw new Error(`caminho absoluto em ${name}: quebra fora da raiz do domínio`);
}
console.log(`dist-pages pronto: ${pool.items.length} cartas`);
