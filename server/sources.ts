export type SourceType = "agencia" | "oficial";

export interface SourceInfo {
  name: string;
  type: SourceType;
  domains: string[];
  /** Prefixos de caminho aceitos no site (o domínio sozinho aceitaria colunas de opinião). Vazio = qualquer caminho. */
  paths?: string[];
  approved: boolean;
  /** Por que esta fonte entra ou não entra. Mostrado ao jogador. */
  basis: string;
  /** Situação na lista de signatários da IFCN, quando for um verificador de fatos. */
  ifcn?: { status: "ativo" | "em renovação" | "não listado"; verifiedOn?: string };
}

/** Consulta à lista pública da IFCN: https://ifcncodeofprinciples.poynter.org/signatories */
export const IFCN_CHECKED_ON = "2026-10-20";

const OFFICIAL = "Órgão oficial: dado ou decisão primária, sem edição jornalística.";

export const SOURCES: SourceInfo[] = [
  {
    name: "Aos Fatos",
    type: "agencia",
    domains: ["aosfatos.org"],
    paths: ["/noticias/"],
    approved: true,
    basis: "Verificador signatário do código de princípios da IFCN (apartidarismo, transparência de fontes, de financiamento e de método).",
    ifcn: { status: "ativo", verifiedOn: "2026-05-20" },
  },
  {
    name: "Estadão Verifica",
    type: "agencia",
    domains: ["estadao.com.br"],
    paths: ["/estadao-verifica/"],
    approved: true,
    basis: "Verificador signatário do código de princípios da IFCN.",
    ifcn: { status: "ativo", verifiedOn: "2025-10-23" },
  },
  {
    name: "Lupa",
    type: "agencia",
    domains: ["agencialupa.org"],
    // /jornalismo/ e /noticias/: a Lupa publicou checagens antigas nesses caminhos; só entram cartas com classificação da própria Lupa.
    paths: ["/checagem/", "/verificacao/", "/jornalismo/", "/noticias/"],
    approved: true,
    basis: "Verificador signatário da IFCN; a verificação está em renovação na lista pública.",
    ifcn: { status: "em renovação", verifiedOn: "2024-01-19" },
  },
  {
    name: "UOL Confere",
    type: "agencia",
    domains: ["noticias.uol.com.br"],
    paths: ["/confere/"],
    approved: true,
    basis: "Verificador signatário da IFCN; a verificação está em renovação na lista pública.",
    ifcn: { status: "em renovação", verifiedOn: "2025-02-27" },
  },
  {
    name: "Comprova",
    type: "agencia",
    domains: ["projetocomprova.com.br"],
    approved: false,
    basis: "Projeto colaborativo de redações; não consta na lista de signatários da IFCN. Fora até confirmação.",
    ifcn: { status: "não listado" },
  },
  { name: "TSE", type: "oficial", domains: ["tse.jus.br"], approved: true, basis: OFFICIAL },
  { name: "TSE Dados Abertos", type: "oficial", domains: ["tse.jus.br"], approved: true, basis: OFFICIAL },
  { name: "STF", type: "oficial", domains: ["stf.jus.br"], approved: true, basis: OFFICIAL },
  { name: "STJ", type: "oficial", domains: ["stj.jus.br"], approved: true, basis: OFFICIAL },
  { name: "Senado", type: "oficial", domains: ["senado.leg.br", "senado.gov.br"], approved: true, basis: OFFICIAL },
  { name: "Câmara", type: "oficial", domains: ["camara.leg.br"], approved: true, basis: OFFICIAL },
  { name: "Alerj", type: "oficial", domains: ["alerj.rj.gov.br"], approved: true, basis: OFFICIAL },
  { name: "Banco Central", type: "oficial", domains: ["bcb.gov.br"], approved: true, basis: OFFICIAL },
  { name: "IBGE", type: "oficial", domains: ["ibge.gov.br"], approved: true, basis: OFFICIAL },
  { name: "TCU", type: "oficial", domains: ["tcu.gov.br"], approved: true, basis: OFFICIAL },
  { name: "Planalto", type: "oficial", domains: ["planalto.gov.br"], approved: true, basis: OFFICIAL },
];

/** "Lupa (debate)" e "Lupa" são o mesmo publicador. */
export function publisherName(label: string): string {
  return label.replace(/\s*\(.*\)$/, "").trim();
}

/** Devolve uma mensagem de erro, ou null quando a fonte é aceita. */
export function checkSource(source: { label: string; url: string; type?: string }): string | null {
  const info = SOURCES.find((s) => s.name === publisherName(source.label));
  if (!info) return `unknown publisher "${publisherName(source.label)}": not in the approved source registry`;
  if (!info.approved) return `publisher "${info.name}" is not approved: ${info.basis}`;
  let host: string;
  let path: string;
  try {
    const parsed = new URL(source.url);
    if (parsed.username || parsed.password || parsed.port) return "url must not carry credentials or a custom port";
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname;
  } catch {
    return "invalid url";
  }
  if (!info.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
    return `domain "${host}" does not belong to publisher "${info.name}"`;
  }
  if (info.paths && !info.paths.some((prefix) => path.startsWith(prefix))) {
    return `path "${path}" is outside the fact-check section of "${info.name}" (${info.paths.join(", ")})`;
  }
  if (source.type && source.type !== info.type) {
    return `type "${source.type}" contradicts the registry ("${info.type}") for "${info.name}"`;
  }
  return null;
}
