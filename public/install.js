// Instalar o jogo como app (PWA): o botão aparece nas Configurações quando o navegador oferece a instalação;
// nos demais casos mostra o passo a passo do navegador. Nada de faixa flutuante, para não cobrir a carta.
let deferred = null;

const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * @param {{group: HTMLElement, button: HTMLButtonElement, hint: HTMLElement}} nodes
 */
export function initInstall({ group, button, hint }) {
  const render = () => {
    const installed = isStandalone();
    group.hidden = installed;
    if (installed) return;
    button.hidden = deferred === null;
    hint.hidden = deferred !== null;
    hint.textContent = isIos()
      ? "No iPhone ou iPad: toque em Compartilhar (o quadrado com a seta) e depois em Adicionar à Tela de Início."
      : "No menu do navegador (⋮), escolha Instalar app ou Adicionar à tela inicial.";
  };
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    render();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    render();
  });
  button.addEventListener("click", async () => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null;
    button.hidden = true;
    await prompt.prompt();
    render();
  });
  render();
}
