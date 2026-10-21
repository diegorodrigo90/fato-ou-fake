// Vazio = mesma origem. No app empacotado (Capacitor), usar a URL absoluta da API.
export const API_BASE = "";
// De onde vêm as cartas e a lista de fontes. No GitHub Pages o build troca por arquivos estáticos.
export const POOL_URL = `${API_BASE}/api/pool`;
export const SOURCES_URL = `${API_BASE}/api/sources`;
// Onde contestar uma carta. Vazio = o botão "Contestar" não aparece.
export const CONTEST_URL = "https://github.com/diegorodrigo90/fato-ou-fake/issues/new";
