import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { checkSource } from "./sources.js";

const sourceSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["agencia", "oficial"]).optional(),
  url: z.string().url().startsWith("https://"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
}).superRefine((source, ctx) => {
  const problem = checkSource(source);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const noUrl = (text: string) => !/https?:\/\//i.test(text);

/** Teto do arquivo de cartas: uma escrita errada no volume não deve estourar a memória do servidor. */
export const MAX_POOL_BYTES = 8 * 1024 * 1024;

const itemSchema = z.object({
  id: z.string().min(1),
  claim: z
    .string()
    .min(1)
    .max(160)
    .refine((claim) => !/https?:\/\//i.test(claim), "claim must not contain a URL"),
  verdict: z.enum(["verdadeiro", "falso"]),
  author: z.enum(["flavio", "lula", "terceiros"]).optional(),
  /** Edição especial a que a carta pertence (ex.: debate da Globo). */
  event: z.enum(["debate-globo"]).optional(),
  explanation: z.string().min(1).max(400).refine(noUrl, "explanation must not contain a URL"),
  clue: z.string().min(1).max(200).refine(noUrl, "clue must not contain a URL").optional(),
  category: z
    .enum(["tribunal", "dinheiro", "urna", "documento", "discurso", "instituicao", "lei"])
    .optional(),
  status: z.string().min(1).max(300).refine(noUrl, "status must not contain a URL"),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD"),
  sources: z.array(sourceSchema).min(1),
});

const poolSchema = z
  .object({
    version: z.number().int(),
    items: z.array(itemSchema).min(1),
  })
  .refine((pool) => new Set(pool.items.map((i) => i.id)).size === pool.items.length, {
    message: "duplicate item ids",
    path: ["items"],
  });

export type PoolItem = z.infer<typeof itemSchema>;
export type Pool = z.infer<typeof poolSchema>;

export async function loadPool(path: string): Promise<Pool> {
  if ((await stat(path)).size > MAX_POOL_BYTES) throw new Error(`Pool file ${path} is larger than ${MAX_POOL_BYTES} bytes`);
  const raw = await readFile(path, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`);
  }
  const parsed = poolSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "pool"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid pool in ${path}: ${detail}`);
  }
  return parsed.data;
}

export interface PoolSource {
  current(): Promise<Pool>;
}

/**
 * Loads the pool once (throws if invalid) and re-reads the file when its mtime changes.
 * A file that turns invalid never replaces the last good pool, and a slow older read
 * never overwrites a newer one (each reload carries a sequence number).
 */
export async function createPoolSource(path: string): Promise<PoolSource> {
  let pool = await loadPool(path);
  let mtime = (await stat(path)).mtimeMs;
  let latest = 0;
  return {
    async current() {
      try {
        const next = (await stat(path)).mtimeMs;
        if (next !== mtime) {
          mtime = next;
          const mine = ++latest;
          const loaded = await loadPool(path);
          if (mine === latest) pool = loaded;
        }
      } catch (error) {
        console.error(`pool reload failed, keeping the last valid pool: ${(error as Error).message}`);
      }
      return pool;
    },
  };
}
