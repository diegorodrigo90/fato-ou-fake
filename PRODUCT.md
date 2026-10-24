# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: PWA em HTML/CSS/JS puro servida por Hono (Node), por prioridade de performance e acessibilidade. Android futuro via Capacitor, consumindo `GET /api/pool` (a URL da API fica em `public/config.js`).

## Users

Pessoas comuns no celular, em momentos curtos, que querem testar o que sabem e conferir fontes (público geral, inclusive eleitores de qualquer lado). Quem mantém as cartas é o organizador.

## Product Purpose

Jogo de cartas "Fato ou Fake?": a pessoa arrasta uma afirmação que circulou por aí para Fato ou Fake e vê a checagem, com as fontes e o link para a matéria original. Sucesso é a pessoa acertar mais com o tempo, abrir as fontes e confiar que o baralho é honesto: só checagens de verificadores aprovados, sem nada inventado, sem coletar dados.

## Constraints

- Sem coleta de dados pessoais, sem cookies, sem automação de buscas em segundo plano. Única medição permitida (decisão de 2026-10-24): contagem agregada de acessos pelo Cloudflare Web Analytics, sem cookies nem identificador.
- Prioridades permanentes: segurança, performance, UI, UX e acessibilidade (WCAG 2.2 AA).
- Texto da interface em pt-br com acentuação correta.
- PoC privada. O usuário decidiu (2026-10-20) usar cartas **reais** de verificadores aprovados, e não frases de exemplo; por isso o jogo só pode ser mostrado em teste fechado (acesso com senha, noindex) até o parecer do advogado eleitoral. Nada de divulgação pública antes disso.

## Open decisions

- Nome público, identidade visual e logo (a skill `logo-designer` pode gerar).
- Aviso de privacidade e identificação dos responsáveis (exigência do gate legal).
