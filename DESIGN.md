# Design: Fato ou Fake?

Jogo de cartas de mesa. O mundo visual é uma **mesa de feltro azul** com luz no centro, **cartas colecionáveis** de corpo colorido por raridade e caixas brancas só para o texto, e **controles táteis** de jogo. A cor carrega significado; o texto nunca depende só dela.

## Cores
| Papel | Valor | Uso |
|---|---|---|
| Mesa | `#3a4cf5` → `#1b2bd1` → `#0c1580` (escuro: `#232fc4` → `#0b1160` → `#050a3a`) | Fundo com textura de feltro (`felt.svg`, 9%) |
| Tinta | `#12186b` | Todo texto sobre carta e caixas |
| Papel | `#ffffff` | Caixas de texto, nunca fundo de carta |
| Pop | `#ffd23f` | Carta comum, botão principal, destaques |
| Fato | `#3ddc97` | Acerto e "verdadeiro" |
| Fake | `#ff5fa2` | Erro e "falso" |
| Rara | corpo `#8fc2ff`, moldura `#1b2bd1` | 2+ publicadores diferentes |
| Épica | corpo `#a98bff`, moldura `#3d1d99`, filete `#ffd23f` | 2+ publicadores incluindo órgão oficial |

Contraste mínimo medido: 4,7:1 (texto suave sobre a mesa clara); a maioria passa de 7:1.

## Tipografia
Pilha do sistema, arredondada quando existe (`ui-rounded`, `Arial Rounded MT Bold`), peso 800 nos títulos e na carta. Corpo da carta com piso de **15 px** (14 px na menor tela, 320 px); rótulos com piso de 12 px. O texto reduz até caber; se não couber, some o secundário (status, depois pista), nunca sai da carta.

## Carta
Proporção 5:7 (5:7,5 em telas estreitas), moldura dupla, cabeçalho com ícone da categoria e número, janela de arte gerada por código (`artSvg`, sem IA, sem pessoas), caixa de texto branca, rodapé com as setas. Textura por raridade (`tex-*.svg`). Verso (resposta): faixa de ACERTOU/ERROU com o carimbo do veredito, afirmação, checagem, fontes em chips de 36–44 px e data de verificação sempre visível.

## Movimento (WAAPI, só `transform`/`opacity`)
Inclinação 3D que segue o ponteiro; selo 3D de acerto/erro (1,7 s, toque pula); giro da carta; carimbo; pontos que sobem; evento de baralho (virar, cartas saem em leque, voltam). Tudo respeita `prefers-reduced-motion` (sem movimento, mas o selo e os sons continuam). Curvas: saída exponencial `cubic-bezier(0.23, 1, 0.32, 1)` e mola `linear()`.

## Som
Sintetizado com Web Audio (sem arquivos), volume baixo, botão de som sempre visível, lembrado. Erro é suave, nunca punitivo.

## Acessibilidade
WCAG 2.2 AA, h1 em toda tela, regiões `aria-live`, diálogos nativos `<dialog>`, teclado completo (setas, Enter, Espaço, Esc), alvos ≥ 36 px (44 px nos botões principais), acerto/erro por cor + ícone + texto.
