# Deploy no Coolify

## Criar o recurso

1. Novo recurso, repositório Git (privado), branch `main`.
2. Build pack: **Dockerfile** (na raiz).
3. Porta exposta: `3000`.
4. Domínio: o seu, com HTTPS automático (Let's Encrypt via Traefik do Coolify).
5. Health check: caminho `/healthz`, porta `3000`.

## Variáveis de ambiente

| Variável | Valor | Por quê |
|---|---|---|
| `TRUST_PROXY` | `true` | O Traefik adiciona o IP real do cliente ao fim de `x-forwarded-for`. Sem isso o rate limit usa o IP do socket, que atrás do proxy é sempre o do Traefik. |
| `PORT` | `3000` | Padrão; só mude se alterar a porta exposta. |
| `POOL_PATH` | `data/pool.json` | Padrão. |

Nunca ligue `TRUST_PROXY=true` com a porta do container exposta direto à internet, porque aí o cliente forja o cabeçalho.

## Logs de acesso e IP (LGPD)

O IP é dado pessoal. O app não grava IP: o rate limit guarda a chave só em memória, por 60 s. O Traefik, porém, pode gravar logs de acesso.

No Coolify, em **Servers → seu servidor → Proxy → Configuration**, deixe o Traefik sem `--accesslog=true` (o padrão do Coolify é não ligar), ou, se ligado, adicione `--accesslog.fields.names.ClientAddr=drop` e `--accesslog.fields.names.ClientHost=drop`. Confira com `docker logs coolify-proxy` que as linhas de acesso não trazem o IP.

## Teste fechado com amigos (recomendado antes de qualquer divulgação)

1. **Proteja o acesso.** No recurso do Coolify, ligue a **autenticação básica** (usuário e senha) e passe a senha só aos amigos. O jogo traz conteúdo sobre candidatos do 2º turno; link aberto não é teste fechado.
2. O servidor já manda `X-Robots-Tag: noindex, nofollow` e `robots.txt` com `Disallow: /`, e o `index.html` tem `<meta name="robots" content="noindex, nofollow">`. Tire os três só na divulgação pública.
3. **Receber opiniões:** o botão "Contestar uma carta" em "Sobre as cartas" abre uma issue do repositório (`CONTEST_URL` em `public/config.js`).
4. **Atualizar cartas sem novo deploy:** monte um volume do Coolify em `/app/data`. O servidor relê `pool.json` sozinho quando o arquivo muda, e o jogo recebe as cartas novas ao vivo.

## Verificar depois do deploy

```bash
curl -i https://SEU-DOMINIO/healthz
curl -sI https://SEU-DOMINIO/ | grep -iE "content-security-policy|x-content-type-options|referrer-policy"
```

Esperado: `200`, e os três cabeçalhos presentes.

## Antes de divulgar

Siga `docs/pre-launch-checklist.md`. Mantenha o repositório e o domínio privados até a revisão de advogado eleitoral.
