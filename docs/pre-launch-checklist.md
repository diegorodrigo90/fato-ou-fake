# Checklist antes de divulgar

## Já dá para fazer: teste fechado com amigos
- [x] Repositório no GitHub sem segredos no código (o jogo não usa chaves nem banco).
- [ ] Deploy no Coolify **com autenticação básica** (senha só para os amigos) e `TRUST_PROXY=true`.
- [x] Contestações pelas issues do GitHub (`CONTEST_URL` em `public/config.js`).
- [ ] Avisar os amigos de que as cartas são checagens de terceiros, com link, e que o jogo é um protótipo.


Marque só o que foi feito. O jogo é uma PoC privada até todos os itens obrigatórios estarem marcados.

## Obrigatórios
- [ ] **Advogado eleitoral** leu o jogo, as cartas e o aviso (propaganda eleitoral, honra, direito de resposta; 2º turno em 25/10/2026).
- [ ] **Fontes**: autorização por escrito dos verificadores para cartas em volume. Com poucas cartas curadas, cada carta cita e linka a matéria.
- [ ] **Responsável identificado**: nome e contato visíveis (a legislação eleitoral veda anonimato). O botão "Contestar uma carta" abre uma issue do repositório.
- [ ] **Deploy** no Coolify com `TRUST_PROXY=true`, HTTPS e logs de acesso sem IP (ver `docs/deploy-coolify.md`).
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas ou críticas.
- [ ] Lighthouse mobile e axe rodados contra a URL de produção.

## Regras do conteúdo (não negociáveis)
- [ ] Só cartas "verdadeiro" ou "falso" (o servidor recusa o resto), de fontes aprovadas em `server/sources.ts`.
- [ ] Reconferir a lista da IFCN antes de divulgar: https://ifcncodeofprinciples.poynter.org/signatories (Lupa e UOL Confere estavam "em renovação" em 20/10/2026; Comprova não constava).
- [ ] Equilíbrio entre os lados visível em "Como escolhemos as fontes"; cuidar para o baralho não ficar viesado.
- [ ] Nenhuma imagem de pessoa real nem conteúdo sintético com voz ou rosto de candidato (a regra do TSE endurece nas 72 horas antes do turno).
- [ ] Sem impulsionamento pago, sem recompensa a quem joga ou compartilha, sem coleta de dados pessoais.
