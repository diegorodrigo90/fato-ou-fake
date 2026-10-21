# Política de segurança

## Como reportar uma falha

Abra um [relato privado de vulnerabilidade](../../security/advisories/new) neste repositório (aba **Security**, botão **Report a vulnerability**). Se não conseguir, abra uma issue pedindo um canal privado, sem detalhar a falha.

Responda com o que você encontrou, como reproduzir e o impacto. Eu leio, confirmo e corrijo o quanto antes.

## O que o projeto já faz

- Sem coleta de dados pessoais, sem cookies, sem analytics.
- CSP restrita, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e limite de requisições.
- Entrada validada com zod; cartas com fonte fora do registro aprovado não sobem.
- Imagem Docker com usuário sem privilégios e `npm audit --omit=dev` sem vulnerabilidades.

## Fora do escopo

Erro de conteúdo em uma carta (fato, atribuição, link) não é falha de segurança: abra uma issue normal.
