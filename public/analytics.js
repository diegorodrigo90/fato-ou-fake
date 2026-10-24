// Contagem de acessos sem cookies nem identificador (Cloudflare Web Analytics). Só liga se houver token em config.js.
import { ANALYTICS_TOKEN } from "./config.js";

export function startAnalytics() {
  if (!ANALYTICS_TOKEN || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS_TOKEN, spa: false });
  document.head.append(script);
}
