// Configurações do jogador, guardadas só neste aparelho.
import { SETTINGS_DEFAULTS, normalizeSettings } from "./lib.js";

const KEY = "vf:settings";
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return normalizeSettings(JSON.parse(raw));
    // Migração: o interruptor de som antigo guardava "off" em outra chave.
    if (localStorage.getItem("vf:sound") === "off") return normalizeSettings({ muted: true });
  } catch {
    /* armazenamento indisponível ou corrompido: usa os padrões */
  }
  return { ...SETTINGS_DEFAULTS };
}

let current = load();

export const get = (key) => current[key];
export const all = () => ({ ...current });

export function apply() {
  const root = document.documentElement;
  root.dataset.palette = current.palette;
  root.dataset.text = current.text;
  root.dataset.motion = current.motion;
}

export function set(key, value) {
  current = normalizeSettings({ ...current, [key]: value });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* vale só nesta sessão */
  }
  apply();
  listeners.forEach((listener) => listener(key));
}

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function reset() {
  current = { ...SETTINGS_DEFAULTS };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada a apagar */
  }
  apply();
  listeners.forEach((listener) => listener("*"));
}

/** Respeita o sistema e também a escolha do jogador. */
export const reducedMotion = () =>
  current.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;

apply();
