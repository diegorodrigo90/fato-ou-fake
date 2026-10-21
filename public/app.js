import { CONTEST_URL, POOL_URL, SOURCES_URL } from "./config.js";
import {
  verdictLabel,
  artSvg, categoryOf, subjectOf, diffNew, feedbackLine, judge, levelFor, milestoneFor, nextBalanced, nextStreak,
  pointsFor, rarityOf, shareCaption, shareEndless, swipeDecision, swipeDismiss,
} from "./lib.js";
import * as sfx from "./sound.js";
import * as music from "./music.js";
import * as settings from "./settings.js";
import { burst, dealEvent, shuffleIntro } from "./events.js";
import { albumView, rowsFor } from "./album.js";
import { renderDailyShareImage, renderShareImage } from "./share.js";
import { ACHIEVEMENTS, DAILY_SIZE, bestDayStreak, currentDayStreak, dailyDeck, dailyShareText, dayKey, kindOf, formatCountdown, msUntilNextDay, newlyUnlocked, roundRank, starsFor, tallyHits, unlockedIds } from "./daily.js";

const THRESHOLD = 90;
const POLL_MS = 60_000;
const RANK_LABEL = { rara: "★ Rara", epica: "✦ Épica" };
const TYPE_LABEL = { agencia: "agência", oficial: "oficial" };
const TIPS = [
  "Dica: toque nas fontes para conferir a checagem.",
  "Dica: arraste a carta para a direita se for fato.",
  "Dica: cartas raras e épicas têm mais fontes e dão mais pontos.",
  "Dica: acertos seguidos valem cada vez mais.",
];

const $ = (id) => document.getElementById(id);
const el = Object.fromEntries(
  [
    "title", "tip", "play-btn", "play-label", "title-stats", "ts-level", "ts-points", "ts-best", "tab-home", "tab-play", "tab-score", "tab-album", "tab-settings", "tab-sound", "howto-btn", "error", "retry", "about-btn", "play",
    "lvl-name", "xp", "xp-fill", "pts", "streak", "streak-chip", "fresh", "card", "tilt", "rank", "cat-icon",
    "cat-label", "subject", "num", "art", "art-icon", "kicker", "claim", "quote", "verdict", "explain", "clue",
    "status", "sources", "rank-note", "foil", "glare", "drag-call", "answers", "fake", "true", "next", "milestone",
    "milestone-text", "settings", "set-sfx", "set-music", "set-volume", "set-haptics", "set-motion", "set-tilt", "set-drag", "set-palette", "set-text", "set-phone", "set-reset", "share-card", "share-card-msg", "details-btn", "details", "details-body", "stop2", "flash", "flash-text", "flash-sub", "banner", "rb-title", "rb-sub", "end", "end-level", "score", "best", "again", "share",
    "open-history2", "share-msg", "empty", "open-history3", "clear2", "history", "history-summary",
    "history-list", "history-back", "clear", "clear-msg", "live", "confirm", "confirm-text", "howto", "about",
    "about-sources", "about-balance", "about-contest", "contest-link", "daily-btn", "daily-label", "daily-pips", "daily-streak", "daily-streak-n", "ach-btn", "ach", "ach-summary", "ach-list", "pips", "album-fill", "album-viewport", "album-track", "album-before", "album-after", "album-filters", "album-prev", "album-next", "album-page", "round-end", "re-date", "re-title", "re-stars", "re-score", "re-rank", "re-grid", "re-kinds", "re-streak", "re-new", "re-countdown", "re-share", "re-again", "re-album", "re-msg", "round-intro", "ri-big", "ri-sub",
  ].map((id) => [id.replace(/-(\w)/g, (_, c) => c.toUpperCase()), $(id)]),
);
const faceAsk = el.card.querySelector(".face.ask");
const faceAnswer = el.card.querySelector(".face.answer");

const sections = ["title", "play", "end", "roundEnd", "empty", "history"];
const TAB_FOR = { title: "tabHome", play: "tabPlay", empty: "tabPlay", end: "tabScore", roundEnd: "tabScore", history: "tabAlbum" };
function show(name) {
  for (const section of sections) el[section].hidden = section !== name;
  for (const tab of ["tabHome", "tabPlay", "tabScore", "tabAlbum"]) {
    if (TAB_FOR[name] === tab) el[tab].setAttribute("aria-current", "page");
    else el[tab].removeAttribute("aria-current");
  }
  music.setMood(name === "play" ? "game" : "menu");
  el.play.dataset.mode = mode === "daily" ? "daily" : "free";
  if (name !== "roundEnd") stopCountdown();
  window.scrollTo(0, 0);
}

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sem armazenamento: o jogo segue sem lembrar o progresso */
    }
  },
};

function loadHistory() {
  const raw = store.get("vf:history");
  return Array.isArray(raw)
    ? raw.filter((entry) => entry && typeof entry.id === "string" && typeof entry.correct === "boolean")
    : [];
}
function loadNumber(key) {
  const value = Number(store.get(key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
function saveStats() {
  store.set("vf:stats", { hits, total, best: bestStreak });
}

const reducedMotion = () => settings.reducedMotion();
const textScale = () => (settings.get("text") === "large" ? 1.12 : 1);
const buzz = (pattern) => {
  if (settings.get("haptics") && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern);
};
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

let items = [];
let history = [];
let incoming = [];
let current = null;
let answeredAt = 0;
let points = 0;
let hits = 0;
let total = 0;
let streak = 0;
let bestStreak = 0;
let firstGame = true;
let started = false;
let busy = false; // resposta em andamento (selo e virada): nada mais deve mexer no jogo
let advancing = false;
let refreshing = false;
let poolTag = null;
let sharePrep = null;
let mode = "free"; // "free" = baralho solto; "daily" = rodada do dia
let daily = null; // { key, ids, results: [{id, correct}] }
let sourcesOpened = 0;
const announced = new Set(); // cartas novas cujo evento de baralho já foi mostrado

const byId = (id) => items.find((item) => item.id === id);
const seenIds = () => new Set(history.map((entry) => entry.id));

// ---------- Rodada do dia e conquistas ----------
const dailyIds = () => (daily ? daily.ids.filter((id) => byId(id)) : []);
const dailyLeft = () => dailyIds().filter((id) => !daily.results.some((r) => r.id === id));
const dailyDone = () => daily !== null && dailyIds().length > 0 && dailyLeft().length === 0;
const loadDays = () => (Array.isArray(store.get("vf:dailyDays")) ? store.get("vf:dailyDays").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);

function ensureDaily() {
  const key = dayKey();
  const saved = store.get("vf:daily");
  if (saved && saved.key === key && Array.isArray(saved.ids) && Array.isArray(saved.results)) {
    daily = { key, ids: saved.ids.filter((id) => typeof id === "string"), results: saved.results.filter((r) => r && typeof r.id === "string" && typeof r.correct === "boolean") };
    return;
  }
  daily = { key, ids: dailyDeck(items, key), results: [] };
  store.set("vf:daily", daily);
}

function achievementStats() {
  return {
    total,
    hits,
    bestStreak,
    sourcesOpened,
    dailyDays: loadDays(),
    dailyPerfect: loadNumber("vf:dailyPerfect"),
    ...tallyHits(history, byId),
  };
}

function savedAchievements() {
  const raw = store.get("vf:ach");
  return raw && typeof raw === "object" ? raw : {};
}

/** Guarda o que acabou de ser conquistado e devolve as conquistas novas. */
function checkAchievements() {
  const fresh = newlyUnlocked(achievementStats(), new Set(Object.keys(savedAchievements())));
  if (fresh.length === 0) return [];
  const saved = savedAchievements();
  for (const a of fresh) saved[a.id] = dayKey();
  store.set("vf:ach", saved);
  return fresh;
}
const achText = (list) => (list.length === 1 ? `Conquista: ${list[0].title}` : `${list.length} conquistas: ${list[0].title} e mais`);

function pipStates() {
  const ids = dailyIds();
  return ids.map((id) => {
    const r = daily.results.find((x) => x.id === id);
    if (r) return r.correct ? "right" : "wrong";
    return mode === "daily" && current?.id === id ? "current" : "pending";
  });
}

function fillPips(list, states) {
  list.replaceChildren(
    ...states.map((state) => {
      const li = document.createElement("li");
      li.className = "pip";
      li.dataset.state = state;
      return li;
    }),
  );
}

function renderPips(popIndex = -1) {
  if (!daily) return;
  fillPips(el.pips, pipStates());
  if (popIndex >= 0 && !reducedMotion()) {
    el.pips.children[popIndex]?.animate([{ transform: "scale(1)" }, { transform: "scale(1.9, 1.5)" }, { transform: "scale(1)" }], { duration: 320, easing: OUT });
  }
}

function renderDailyButton() {
  if (!daily) return;
  const n = dailyIds().length;
  const left = dailyLeft().length;
  const done = dailyDone();
  el.dailyLabel.textContent = done ? "Rodada do dia · feita" : left < n ? `Rodada do dia · ${n - left}/${n}` : "Rodada do dia";
  el.dailyBtn.dataset.state = done ? "done" : left < n ? "progress" : "fresh";
  el.dailyBtn.disabled = n === 0;
  fillPips(el.dailyPips, pipStates());
  const streakDays = currentDayStreak(loadDays(), daily.key);
  el.dailyStreak.hidden = streakDays < 1;
  el.dailyStreakN.textContent = String(streakDays);
}

function openAchievements() {
  const stats = achievementStats();
  const have = unlockedIds(stats);
  el.achSummary.textContent = `${have.size} de ${ACHIEVEMENTS.length} conquistas.`;
  el.achList.replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const li = document.createElement("li");
      const done = have.has(a.id);
      li.dataset.done = String(done);
      const title = document.createElement("strong");
      title.textContent = a.title;
      const desc = document.createElement("span");
      desc.textContent = a.desc;
      const prog = document.createElement("small");
      prog.textContent = done ? "Conquistada" : `${Math.min(a.value(stats), a.goal)} de ${a.goal}`;
      li.append(title, desc, prog);
      return li;
    }),
  );
  el.ach.showModal();
}

// ---------- Abertura e carregamento ----------
let tipTimer = null;
function startTips() {
  let i = 0;
  clearInterval(tipTimer);
  tipTimer = setInterval(() => {
    if (el.title.classList.contains("loading")) return;
    i = (i + 1) % TIPS.length;
    el.tip.textContent = TIPS[i];
  }, 3200);
}

function titleReady() {
  el.title.classList.remove("loading");
  el.playBtn.disabled = false;
  el.playLabel.textContent = started || history.length ? "Continuar" : "Jogar";
  const lv = levelFor(points);
  el.titleStats.hidden = points === 0 && total === 0 && history.length === 0;
  el.tsLevel.textContent = `Nv ${lv.level} ${lv.name}`;
  el.tsPoints.textContent = `${points} pts`;
  el.tsBest.textContent = `Melhor ${bestStreak}`;
  el.tip.textContent = `${items.length.toLocaleString("pt-BR")} cartas no baralho · ${levelFor(points).name}`;
  renderDailyButton();
}

async function loadPool() {
  el.error.hidden = true;
  el.title.classList.add("loading");
  el.playBtn.disabled = true;
  el.playLabel.textContent = "Embaralhando…";
  el.tip.textContent = "Embaralhando as cartas…";
  try {
    const res = await fetch(POOL_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pool = await res.json();
    if (!Array.isArray(pool.items) || pool.items.length === 0) throw new Error("empty pool");
    items = pool.items;
    poolTag = res.headers.get("etag");
    history = loadHistory();
    points = loadNumber("vf:points");
    const stats = store.get("vf:stats") ?? {};
    hits = Number.isFinite(stats.hits) ? stats.hits : 0;
    total = Number.isFinite(stats.total) ? stats.total : 0;
    bestStreak = Number.isFinite(stats.best) ? stats.best : 0;
    sourcesOpened = loadNumber("vf:sources");
    ensureDaily();
    titleReady();
    el.live.textContent = "Cartas prontas. Toque em Jogar.";
    startTips();
  } catch {
    el.title.classList.remove("loading");
    el.tip.textContent = "";
    el.playLabel.textContent = "Jogar";
    el.error.hidden = false;
  }
}

function cardWidth() {
  const visible = el.card.getBoundingClientRect().width;
  if (visible > 0) return visible;
  const rem = 16;
  return Math.max(15 * rem, Math.min(innerWidth * 0.84, 21 * rem, ((innerHeight - 24 * rem) * 5) / 7));
}

async function startGame() {
  if (mode === "daily") {
    mode = "free";
    if (current && !daily.results.some((r) => r.id === current.id)) current = null; // volta ao baralho solto sem carregar a carta da rodada
  }
  started = true;
  sfx.play(firstGame ? "tick" : "start");
  music.sync();
  el.playBtn.disabled = true;
  if (firstGame) {
    firstGame = false;
    await shuffleIntro(cardWidth());
  }
  show("play");
  renderHud(false);
  nextCard();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function showRoundIntro() {
  const ids = dailyIds();
  const trues = ids.filter((id) => byId(id).verdict === "verdadeiro").length;
  el.riBig.textContent = `${ids.length} cartas`;
  el.riSub.textContent = `${dayKey().split("-").reverse().join("/")} · ${trues} ${trues === 1 ? "fato" : "fatos"} e ${ids.length - trues} fakes`;
  el.roundIntro.hidden = false;
  el.live.textContent = `Rodada do dia: ${ids.length} cartas.`;
  sfx.play("start");
  music.sync();
  if (reducedMotion()) {
    await wait(900);
  } else {
    const card = el.roundIntro.firstElementChild;
    const skip = new Promise((resolve) => el.roundIntro.addEventListener("pointerdown", resolve, { once: true }));
    card.animate([{ transform: "rotate(-3deg) scale(0.3)", opacity: 0 }, { transform: "rotate(-3deg) scale(1.08)", opacity: 1, offset: 0.6 }, { transform: "rotate(-3deg) scale(1)", opacity: 1 }], { duration: 420, easing: OUT });
    await Promise.race([wait(1500), skip]);
    await card.animate([{ opacity: 1 }, { opacity: 0, transform: "rotate(-3deg) scale(0.9)" }], { duration: 160, fill: "forwards" }).finished.catch(() => {});
  }
  el.roundIntro.hidden = true;
}

async function startDaily() {
  if (busy || !daily || el.dailyBtn.disabled) return;
  if (dailyDone()) {
    mode = "daily";
    return showRoundEnd([], false);
  }
  mode = "daily";
  current = null;
  started = true;
  firstGame = false;
  el.dailyBtn.disabled = true;
  await showRoundIntro();
  el.dailyBtn.disabled = false;
  nextCard();
}

function finishDaily() {
  const days = loadDays();
  if (!days.includes(daily.key)) {
    store.set("vf:dailyDays", [...days, daily.key]);
    if (daily.results.every((r) => r.correct)) store.set("vf:dailyPerfect", loadNumber("vf:dailyPerfect") + 1);
  }
  showRoundEnd(checkAchievements(), true);
}

// ---------- Fim da rodada ----------
let countdownTimer = 0;
let endToken = 0;
function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = 0;
  endToken += 1;
}
function startCountdown() {
  const tick = () => {
    el.reCountdown.textContent = formatCountdown(msUntilNextDay());
    if (msUntilNextDay() > 86399000 && daily && daily.key !== dayKey()) location.reload(); // virou o dia com a tela aberta: carrega a rodada nova
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function showRoundEnd(fresh, animate) {
  const ids = dailyIds();
  const results = ids.map((id) => daily.results.find((r) => r.id === id)).filter(Boolean);
  const right = results.filter((r) => r.correct).length;
  const stars = starsFor(right, results.length);
  show("roundEnd");
  const token = endToken;
  const instant = !animate || reducedMotion();
  let skipped = false;
  el.roundEnd.addEventListener("pointerdown", () => (skipped = true), { once: true });
  const pause = (ms) => (instant || skipped ? Promise.resolve() : wait(ms));
  const alive = () => token === endToken;

  el.reDate.textContent = dayKey().split("-").reverse().join("/");
  el.reStars.setAttribute("aria-label", `${stars} de 3 estrelas`);
  [...el.reStars.children].forEach((star) => (star.dataset.on = "false"));
  el.reScore.textContent = `0/${results.length}`;
  el.reRank.textContent = "";
  el.reRank.style.opacity = "0";
  el.reGrid.replaceChildren(
    ...results.map(() => {
      const li = document.createElement("li");
      li.className = "re-cell";
      return li;
    }),
  );
  const kinds = { viral: [0, 0], fala: [0, 0] };
  for (const r of results) {
    const k = kindOf(byId(r.id));
    kinds[k][1] += 1;
    if (r.correct) kinds[k][0] += 1;
  }
  const parts = [];
  if (kinds.fala[1]) parts.push(`Falas: ${kinds.fala[0]}/${kinds.fala[1]}`);
  if (kinds.viral[1]) parts.push(`Boatos: ${kinds.viral[0]}/${kinds.viral[1]}`);
  el.reKinds.textContent = parts.join(" · ");
  const streakDays = currentDayStreak(loadDays(), daily.key);
  el.reStreak.hidden = streakDays < 2;
  el.reStreak.textContent = `🔥 ${streakDays} dias seguidos`;
  el.reNew.hidden = true;
  el.reMsg.textContent = "";
  startCountdown();

  // 1) as respostas aparecem uma a uma, com um som por carta
  let hitsSoFar = 0;
  for (let i = 0; i < results.length; i++) {
    const cell = el.reGrid.children[i];
    cell.dataset.state = results[i].correct ? "right" : "wrong";
    if (results[i].correct) hitsSoFar += 1;
    if (!instant && !skipped) {
      cell.animate([{ transform: "scale(0.2)", opacity: 0 }, { transform: "scale(1.25)", opacity: 1, offset: 0.65 }, { transform: "scale(1)", opacity: 1 }], { duration: 260, easing: OUT });
      sfx.play(results[i].correct ? "pip" : "pipMiss", hitsSoFar - 1);
    }
    await pause(110);
    if (!alive()) return;
  }
  // 2) nota, estrelas e título
  el.reScore.textContent = `${right}/${results.length}`;
  if (!instant && !skipped) el.reScore.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 360, easing: OUT });
  for (let i = 0; i < 3; i++) {
    const star = el.reStars.children[i];
    if (i < stars) {
      star.dataset.on = "true";
      if (!instant && !skipped) {
        star.animate([{ transform: "scale(0.2) rotate(-40deg)" }, { transform: "scale(1.3) rotate(8deg)", offset: 0.65 }, { transform: "scale(1) rotate(0)" }], { duration: 380, easing: OUT });
        sfx.play("chime", i * 3);
      }
      await pause(220);
      if (!alive()) return;
    }
  }
  el.reRank.textContent = roundRank(stars);
  el.reRank.style.opacity = "1";
  if (!instant && !skipped) el.reRank.animate([{ opacity: 0, transform: "translateY(0.5rem)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: OUT });
  if (!instant) {
    sfx.play("fanfare", stars, skipped ? 0 : 120);
    if (stars >= 2 && !skipped) burst(el.roundEnd, { y: "28%", count: stars === 3 ? 26 : 16 });
    if (stars === 3) buzz([20, 40, 60]);
  }
  // 3) conquistas novas
  if (fresh.length > 0) {
    await pause(500);
    if (!alive()) return;
    el.reNew.replaceChildren(
      ...fresh.slice(0, 2).map((a) => {
        const li = document.createElement("li");
        li.textContent = a.title;
        return li;
      }),
    );
    if (fresh.length > 2) {
      const more = document.createElement("li");
      more.textContent = `+${fresh.length - 2} conquistas`;
      el.reNew.append(more);
    }
    el.reNew.hidden = false;
    if (!instant) {
      el.reNew.animate([{ opacity: 0, transform: "translateY(0.5rem)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: OUT });
      sfx.play("trophy");
    }
  }
  el.live.textContent = `Rodada concluída. ${right} de ${results.length} certas, ${stars} de 3 estrelas. ${roundRank(stars)}.`;
  el.reShare.focus({ preventScroll: true });
}

async function shareDaily() {
  if (!daily) return;
  const results = dailyIds().map((id) => daily.results.find((r) => r.id === id)?.correct === true);
  const text = `${dailyShareText(daily.key, results)}\n${location.origin}`;
  el.reShare.disabled = true;
  el.reMsg.textContent = "Preparando a imagem…";
  try {
    const right = results.filter(Boolean).length;
    const stars = starsFor(right, results.length);
    const blob = await renderDailyShareImage({ key: daily.key, results, stars, rank: roundRank(stars), streakDays: currentDayStreak(loadDays(), daily.key), origin: location.origin });
    const file = new File([blob], "fato-ou-fake-rodada.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      el.reMsg.textContent = "";
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      el.reMsg.textContent = "Abrimos o WhatsApp com o resultado. A imagem só vai pelo celular.";
    }
  } catch (error) {
    el.reMsg.textContent = error?.name === "AbortError" ? "" : "Não foi possível compartilhar agora.";
  } finally {
    el.reShare.disabled = false;
  }
}

// ---------- HUD ----------
function renderHud(animate = true, from = points) {
  const lv = levelFor(points);
  el.play.dataset.mode = mode === "daily" ? "daily" : "free";
  if (mode === "daily") renderPips();
  el.lvlName.textContent = mode === "daily" && daily ? `Rodada do dia · ${Math.max(1, dailyIds().indexOf(current?.id) + 1 || daily.results.length + 1)}/${dailyIds().length}` : `Nv ${lv.level} · ${lv.name}`;
  el.xpFill.style.setProperty("--xp", String(lv.progress));
  el.xp.setAttribute("aria-valuenow", String(Math.round(lv.progress * 100)));
  el.streak.textContent = String(streak);
  el.streakChip.dataset.hot = String(streak >= 3);
  if (!animate || reducedMotion() || from === points) {
    el.pts.textContent = String(points);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 450);
    el.pts.textContent = String(Math.round(from + (points - from) * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function banner(text, level = 1) {
  el.milestoneText.textContent = text;
  el.milestone.hidden = false;
  sfx.play("streak", level, 380);
  buzz([30, 40, 30]);
  if (reducedMotion()) {
    setTimeout(() => (el.milestone.hidden = true), 1800);
    return;
  }
  const anim = el.milestone.animate(
    [
      { transform: "translateY(-1.5rem) scale(0.8)", opacity: 0 },
      { transform: "none", opacity: 1, offset: 0.2 },
      { transform: "none", opacity: 1, offset: 0.8 },
      { transform: "translateY(-0.75rem)", opacity: 0 },
    ],
    { duration: 2000, easing: OUT },
  );
  anim.finished.then(() => (el.milestone.hidden = true)).catch(() => {});
}

// Pontos ganhos: aparecem junto do contador no topo e somem, sem cobrir o texto da carta.
function popup(text) {
  const node = document.createElement("span");
  node.className = "popup";
  node.textContent = text;
  node.setAttribute("aria-hidden", "true");
  el.pts.parentElement.append(node);
  if (reducedMotion()) return setTimeout(() => node.remove(), 1000);
  node
    .animate(
      [
        { transform: "translateY(0.75rem) scale(0.6)", opacity: 0 },
        { transform: "translateY(0) scale(1.2)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-0.25rem) scale(1)", opacity: 1, offset: 0.7 },
        { transform: "translateY(-0.75rem) scale(1)", opacity: 0 },
      ],
      { duration: 1100, easing: OUT },
    )
    .finished.then(() => node.remove())
    .catch(() => node.remove());
}

// ---------- Cartas novas (evento de baralho) ----------
function renderFresh(animate = false) {
  const n = incoming.length;
  el.fresh.hidden = n === 0;
  el.fresh.textContent = n === 1 ? "1 carta nova no baralho!" : `${n} cartas novas no baralho!`;
  if (animate && n > 0) {
    sfx.play("chime");
    buzz(30);
    if (!reducedMotion()) {
      el.fresh.animate(
        [{ transform: "translateY(-0.75rem) scale(0.9)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 380, easing: OUT },
      );
    }
  }
}

async function refreshPool() {
  if (items.length === 0 || refreshing) return;
  refreshing = true;
  try {
    const res = await fetch(POOL_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const tag = res.headers.get("etag");
    if (tag && tag === poolTag) return;
    const pool = await res.json();
    if (!Array.isArray(pool.items) || pool.items.length === 0) return;
    // Troca sempre o baralho inteiro: uma carta corrigida ou retirada chega a quem está jogando.
    const fresh = diffNew(pool.items, new Set(items.map((item) => item.id)));
    items = pool.items;
    poolTag = tag;
    if (fresh.length === 0) return;
    incoming = [...new Set([...incoming, ...fresh.map((item) => item.id)])];
    renderFresh(true);
    if (!el.empty.hidden) await advance();
  } catch {
    /* sem rede agora: tenta de novo no próximo ciclo */
  } finally {
    refreshing = false;
  }
}

async function advance() {
  if (advancing || busy) return;
  advancing = true;
  try {
    const fresh = mode === "daily" ? [] : incoming.filter((id) => !announced.has(id)).map(byId).filter(Boolean);
    if (fresh.length > 0) {
      fresh.forEach((card) => announced.add(card.id));
      await dealEvent({
        cards: fresh.slice(0, 5).map((card) => ({
          rank: rarityOf(card),
          icon: categoryOf(card).icon,
          label: { comum: "Comum", rara: "Rara", epica: "Épica" }[rarityOf(card)],
        })),
        extra: Math.max(0, fresh.length - 5),
        cw: cardWidth(),
      });
    }
    nextCard();
  } finally {
    advancing = false;
  }
}

// ---------- Carta ----------
function fitText(node, face, maxPx, minPx) {
  let size = maxPx;
  node.style.fontSize = `${size}px`;
  while (size > minPx && face.scrollHeight > face.clientHeight + 1) {
    size -= 1;
    node.style.fontSize = `${size}px`;
  }
  return face.scrollHeight <= face.clientHeight + 1;
}

// Texto nunca abaixo do piso legível: se mesmo no piso não couber, some o que é secundário.
function fitAnswer() {
  // Em cartas estreitas o piso é 14 px (ainda legível em negrito); nas demais, 15 px.
  const floor = (el.card.getBoundingClientRect().width < 300 ? 14 : 15) * textScale();
  faceAnswer.classList.remove("tight", "tighter", "tightest");
  for (const step of ["", "tight", "tighter", "tightest"]) {
    if (step) faceAnswer.classList.add(step);
    if (fitText(faceAnswer, faceAnswer, 17 * textScale(), floor)) return;
  }
  // Explicação longa demais para a carta: mostra as primeiras frases e deixa o texto inteiro em "Detalhes".
  const sentences = (current?.explanation ?? "").split(/(?<=[.!?])\s+/);
  while (sentences.length > 1 && faceAnswer.scrollHeight > faceAnswer.clientHeight + 1) {
    sentences.pop();
    el.explain.textContent = `${sentences.join(" ")} …`;
    fitText(faceAnswer, faceAnswer, floor, floor);
  }
}

function dressCard(card, rank, isNew) {
  sfx.play("deal");
  const cat = categoryOf(card);
  el.catIcon.style.setProperty("--icon", `url(icons/${cat.icon}.svg)`);
  el.artIcon.style.setProperty("--icon", `url(icons/${cat.icon}.svg)`);
  el.catLabel.textContent = cat.label;
  el.art.style.setProperty("--art", `url("${artSvg(card.id, rank)}")`);
  const position = items.findIndex((item) => item.id === card.id) + 1;
  el.num.textContent = `Nº ${String(position).padStart(3, "0")}`;
  el.subject.textContent = subjectOf(card);
  el.subject.hidden = !el.subject.textContent;
  el.subject.dataset.badge = subjectOf(card).replace("Sobre ", "").charAt(0);
  el.kicker.textContent = isNew ? "Carta nova" : "Circulou por aí";
}

function entrance(rank) {
  el.card.classList.remove("shine");
  if (reducedMotion()) return;
  el.tilt.animate(
    [{ opacity: 0, translate: "0 1rem", scale: "0.96" }, { opacity: 1, translate: "0", scale: "1" }],
    { duration: rank === "comum" ? 180 : 260, easing: OUT },
  );
  if (rank === "comum") return;
  void el.card.offsetWidth;
  el.card.classList.add("shine");
  if (rank === "rara") sfx.play("chime", 3, 120);
  if (rank === "epica") {
    sfx.play("epic", undefined, 120);
    el.card.animate(
      [{ translate: "0" }, { translate: "-4px" }, { translate: "4px" }, { translate: "-3px" }, { translate: "3px" }, { translate: "0" }],
      { duration: 320, easing: "ease-in-out" },
    );
    setTimeout(() => burst(el.card.parentElement), 320);
    buzz([20, 40, 60]);
  }
}

function nextCard() {
  if (mode === "daily") {
    const nextId = dailyLeft()[0];
    if (!nextId) return finishDaily();
    current = byId(nextId);
    renderHud(false);
    return presentCard(current, false);
  }
  const pending = items.filter((item) => incoming.includes(item.id));
  const lastId = current ? current.id : null;
  const lastWasTrue = current ? current.verdict === "verdadeiro" : null;
  const fromIncoming = nextBalanced(pending, seenIds(), lastId, lastWasTrue);
  const card = fromIncoming ?? nextBalanced(items, seenIds(), lastId, lastWasTrue);
  const isNew = fromIncoming !== null;
  if (isNew) incoming = incoming.filter((id) => id !== card.id);
  renderFresh();
  if (!card) {
    show("empty");
    el.clear2.focus({ preventScroll: true });
    return;
  }
  current = card;
  renderHud(false);
  presentCard(card, isNew);
}

function presentCard(card, isNew) {
  if (flyAnim) {
    flyAnim.cancel();
    flyAnim = null;
  }
  show("play");
  const rank = rarityOf(card);
  el.card.dataset.rank = rank;
  el.rank.hidden = rank === "comum";
  el.rank.textContent = RANK_LABEL[rank] ?? "";
  dressCard(card, rank, isNew);
  el.card.dataset.state = "ask";
  delete el.card.dataset.result;
  el.card.style.setProperty("--dx", "0");
  el.card.style.setProperty("--p", "0");
  el.dragCall.style.setProperty("--p", "0");
  el.claim.textContent = card.claim;
  fitText(el.claim, faceAsk, 21 * textScale(), 16 * textScale());
  el.fake.disabled = false;
  el.true.disabled = false;
  el.answers.hidden = false;
  el.next.hidden = true;
  el.shareCard.hidden = true;
  el.detailsBtn.hidden = true;
  el.shareCardMsg.textContent = "";
  el.card.focus({ preventScroll: true });
  entrance(rank);
  const rankSpeech = rank === "comum" ? "" : `Carta ${rank === "epica" ? "épica" : "rara"}. `;
  el.live.textContent = `${isNew ? "Carta nova. " : ""}${rankSpeech}`.trim();
}

// Selo grande de acerto ou erro, em 3D e com tempo para ler, antes de a carta virar. Um toque pula.
async function flash(correct, saidTrue, verdict, line) {
  sfx.play(correct ? "right" : "wrong");
  music.duck(1900);
  el.flash.dataset.result = correct ? "right" : "wrong";
  el.flashText.textContent = correct ? "Acertou!" : "Errou!";
  el.flashSub.textContent = `${line} Era ${verdict}.`;
  el.flash.hidden = false;
  if (reducedMotion()) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    el.flash.hidden = true;
    return;
  }
  if (correct) {
    burst(el.card.parentElement);
    setTimeout(() => burst(el.card.parentElement, { count: 12 }), 450);
  } else {
    el.card.animate(
      [{ translate: "0" }, { translate: "-7px" }, { translate: "7px" }, { translate: "-5px" }, { translate: "4px" }, { translate: "0" }],
      { duration: 340, easing: "ease-in-out" },
    );
    buzz(40);
  }
  const badge = el.flash.firstElementChild;
  const anims = [
    el.flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], { duration: 1700, easing: "linear" }),
    badge.animate(
      [
        { transform: "scale(0.3) rotateY(-100deg)" },
        { transform: "scale(1.18) rotateY(14deg)", offset: 0.2 },
        { transform: "scale(1) rotateY(-9deg)", offset: 0.34 },
        { transform: "scale(1) rotateY(9deg) rotateX(4deg)", offset: 0.6 },
        { transform: "scale(1) rotateY(-5deg)", offset: 0.82 },
        { transform: "scale(1.15) rotateY(0deg)", offset: 1 },
      ],
      { duration: 1700, easing: OUT },
    ),
  ];
  const skip = () => anims.forEach((anim) => anim.finish());
  const onKey = (event) => {
    if (["Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      skip();
    }
  };
  el.flash.style.pointerEvents = "auto";
  el.flash.addEventListener("pointerdown", skip, { once: true });
  document.addEventListener("keydown", onKey);
  await Promise.all(anims.map((anim) => anim.finished.catch(() => {})));
  document.removeEventListener("keydown", onKey);
  el.flash.style.pointerEvents = "none";
  el.flash.hidden = true;
}

async function answer(saidTrue) {
  if (el.card.dataset.state !== "ask" || busy) return;
  busy = true;
  el.card.dataset.state = "locked";
  const card = current;
  const rank = rarityOf(card);
  const correct = judge(card, saidTrue);
  total += 1;
  if (correct) hits += 1;
  streak = nextStreak(streak, correct);
  bestStreak = Math.max(bestStreak, streak);
  music.setIntensity(streak / 8);
  const gained = pointsFor(correct, streak, rank);
  const before = points;
  const levelBefore = levelFor(before).level;
  points += gained;
  store.set("vf:points", points);
  if (!seenIds().has(card.id)) history = [...history, { id: card.id, correct }];
  store.set("vf:history", history);
  if (mode === "daily" && daily && !daily.results.some((r) => r.id === card.id)) {
    daily.results = [...daily.results, { id: card.id, correct }];
    store.set("vf:daily", daily);
    renderPips(dailyIds().indexOf(card.id));
  }
  saveStats();
  el.fake.disabled = true;
  el.true.disabled = true;
  el.answers.hidden = true;

  el.quote.textContent = card.claim;
  el.verdict.textContent = verdictLabel(card);
  el.verdict.dataset.verdict = card.verdict;
  const line = feedbackLine(correct, total);
  el.card.dataset.result = correct ? "right" : "wrong";
  el.banner.dataset.result = correct ? "right" : "wrong";
  el.rbTitle.textContent = correct ? "Acertou!" : "Errou!";
  el.rbSub.textContent = `Você marcou ${saidTrue ? "Fato" : "Fake"}`;
  el.explain.textContent = card.explanation;
  el.clue.hidden = !card.clue;
  el.clue.textContent = card.clue ? `O que denunciava: ${card.clue}` : "";
  el.status.textContent = card.status;
  el.sources.replaceChildren(
    ...card.sources.slice(0, 3).map((source) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = source.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `${source.label} ↗`;
      if (source.type) {
        const tag = document.createElement("small");
        tag.textContent = TYPE_LABEL[source.type] ?? "";
        a.append(tag);
      }
      li.append(a);
      return li;
    }),
  );
  const n = card.sources.length;
  el.rankNote.textContent = `${rank === "epica" ? "Épica" : rank === "rara" ? "Rara" : "Comum"} · ${n} ${n === 1 ? "fonte" : "fontes"} · checagem de ${card.sources[0].date.split("-").reverse().join("/")}`;

  el.card.style.setProperty("--dx", "0");
  await flash(correct, saidTrue, verdictLabel(card), line);
  sfx.play("flip");
  if (!reducedMotion()) {
    await el.card.animate([{ rotate: "y 0deg" }, { rotate: "y 90deg" }], { duration: 130, easing: "ease-in" }).finished;
  }
  el.card.dataset.state = "answer";
  answeredAt = Date.now();
  fitAnswer();
  el.detailsBtn.hidden = false;
  if (!reducedMotion()) {
    el.card.animate([{ rotate: "y -90deg" }, { rotate: "y 0deg" }], { duration: 240, easing: OUT });
    el.verdict.animate(
      [{ transform: "scale(2.2) rotate(-12deg)", opacity: 0 }, { transform: "scale(0.94) rotate(-2deg)", opacity: 1, offset: 0.7 }, { transform: "scale(1) rotate(-3deg)", opacity: 1 }],
      { duration: 380, easing: OUT },
    );
  }
  sfx.play("stamp");
  if (correct) {
    popup(`+${gained}`);
    if (!reducedMotion()) el.tilt.animate([{ scale: "1" }, { scale: "1.04" }, { scale: "1" }], { duration: 280, easing: OUT });
  }
  renderHud(true, before);
  const lv = levelFor(points);
  if (lv.level > levelBefore) {
    banner(`Nível ${lv.level}! ${lv.name}`, 3);
    burst(el.card.parentElement);
  } else {
    const milestone = correct ? milestoneFor(streak) : null;
    if (milestone) banner(`Sequência ${streak} · ${milestone.label}`, milestone.level);
  }
  busy = false;
  const nextText = mode === "daily" && dailyLeft().length === 0 ? "Ver resultado" : "Próxima carta";
  el.next.textContent = nextText;
  const unlocked = checkAchievements();
  if (unlocked.length > 0 && !(lv.level > levelBefore) && !(correct && milestoneFor(streak))) {
    banner(achText(unlocked), 2);
    sfx.play("trophy", undefined, 300);
  }
  el.next.hidden = false;
  el.shareCard.hidden = false;
  // Prepara a imagem agora: no toque, o compartilhamento sai na hora (Safari exige o gesto do usuário).
  sharePrep = renderShareImage(card, { origin: location.origin }).catch(() => null);
  el.next.focus({ preventScroll: true });
  el.live.textContent = [`${correct ? "Você acertou" : "Você errou"}.`, `Você marcou ${saidTrue ? "fato" : "fake"} e é ${verdictLabel(card)}.`, card.explanation, correct ? `Mais ${gained} pontos.` : "", `${points} pontos.`].filter(Boolean).join(" ");
}

// ---------- Detalhes da checagem ----------
const dateBR = (iso) => iso.split("-").reverse().join("/");
function openDetails(card) {
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };
  const verdict = node("p", verdictLabel(card), "det-verdict");
  verdict.dataset.verdict = card.verdict;
  const list = document.createElement("ul");
  for (const source of card.sources) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = source.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `${source.label}${source.type ? ` (${TYPE_LABEL[source.type] ?? source.type})` : ""}, checagem de ${dateBR(source.date)} ↗`;
    li.append(a);
    list.append(li);
  }
  const parts = [
    verdict,
    node("blockquote", card.claim),
    node("p", card.explanation),
  ];
  if (card.clue) parts.push(node("p", `O que denunciava: ${card.clue}`));
  parts.push(node("p", card.status, "det-meta"), list);
  el.detailsBody.replaceChildren(...parts);
  el.details.showModal();
}

// ---------- Placar, álbum, menu ----------
function showScore() {
  if (busy) return;
  const lv = levelFor(points);
  show("end");
  el.endLevel.textContent = `Nível ${lv.level} · ${lv.name} · ${points} pontos`;
  el.score.textContent = total === 0 ? "Ainda sem jogadas" : `${hits} de ${total} certas (${Math.round((hits / total) * 100)}%)`;
  el.best.textContent = `Melhor sequência: ${bestStreak} · sequência atual: ${streak}`;
  el.shareMsg.textContent = "";
  el.share.disabled = total === 0;
  el.again.focus({ preventScroll: true });
}

function goPlay() {
  if (busy) return;
  if (!started) return startGame();
  if (current && ["ask", "answer"].includes(el.card.dataset.state)) show("play");
  else nextCard();
}

function showMenu() {
  if (busy) return;
  show("title");
  titleReady();
  el.playBtn.focus({ preventScroll: true });
}

let albumFilter = "all";
let albumPage = 0;
let suppressAlbumClick = 0;
let albumPages = 1;
const albumPerPage = () => 3 * rowsFor(innerHeight, innerWidth);

function albumSlot(slot) {
  const { card, position, state } = slot;
  const rank = rarityOf(card);
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mini-card";
  btn.dataset.state = state;
  btn.dataset.rank = rank;
  const num = document.createElement("span");
  num.className = "mc-num";
  num.textContent = `Nº ${String(position).padStart(3, "0")}`;
  btn.append(num);
  if (state === "locked") {
    btn.disabled = true;
    btn.setAttribute("aria-label", `Carta ${position}, ainda não respondida`);
    const mark = document.createElement("span");
    mark.className = "mc-lock";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "?";
    btn.append(mark);
  } else {
    const cat = categoryOf(card);
    btn.setAttribute("aria-label", `Carta ${position}, ${verdictLabel(card)}, você ${state === "right" ? "acertou" : "errou"}. Ver detalhes`);
    btn.style.setProperty("--art", `url("${artSvg(card.id, rank)}")`);
    const art = document.createElement("span");
    art.className = "mc-art";
    art.setAttribute("aria-hidden", "true");
    const icon = document.createElement("span");
    icon.className = "icon";
    icon.style.setProperty("--icon", `url(icons/${cat.icon}.svg)`);
    art.append(icon);
    const result = document.createElement("span");
    result.className = "mc-result";
    result.setAttribute("aria-hidden", "true");
    result.textContent = state === "right" ? "✓" : "✕";
    const stamp = document.createElement("span");
    stamp.className = "mc-stamp";
    stamp.dataset.verdict = card.verdict;
    stamp.setAttribute("aria-hidden", "true");
    stamp.textContent = verdictLabel(card);
    btn.append(art, result, stamp);
    btn.addEventListener("click", () => openDetails(card));
  }
  li.append(btn);
  return li;
}

function fillAlbumGrid(list, view) {
  list.replaceChildren(...view.slots.map(albumSlot));
}

function renderAlbum(direction = 0) {
  const options = { filter: albumFilter, perPage: albumPerPage() };
  const view = albumView(items, history, { ...options, page: albumPage });
  albumPage = view.page;
  albumPages = view.pages;
  el.historySummary.innerHTML = "";
  const big = document.createElement("b");
  big.textContent = String(view.collected);
  el.historySummary.append(big, ` de ${items.length.toLocaleString("pt-BR")} cartas`);
  el.albumFill.style.setProperty("--xp", String(items.length ? view.collected / items.length : 0));
  for (const button of el.albumFilters.querySelectorAll(".album-filter")) {
    const key = button.dataset.filter;
    button.setAttribute("aria-pressed", String(key === albumFilter));
    button.querySelector("b").textContent = String(view.counts[key]);
  }
  el.historyList.dataset.empty = String(view.slots.length === 0);
  fillAlbumGrid(el.historyList, view);
  // As páginas vizinhas ficam prontas ao lado, para aparecerem enquanto o dedo arrasta.
  el.albumBefore.replaceChildren();
  el.albumAfter.replaceChildren();
  if (view.page > 0) fillAlbumGrid(el.albumBefore, albumView(items, history, { ...options, page: view.page - 1 }));
  if (view.page < view.pages - 1) fillAlbumGrid(el.albumAfter, albumView(items, history, { ...options, page: view.page + 1 }));
  if (view.slots.length === 0) {
    const li = document.createElement("li");
    li.className = "album-empty";
    li.textContent = albumFilter === "right" ? "Nenhum acerto ainda." : albumFilter === "wrong" ? "Nenhum erro por enquanto." : albumFilter === "missing" ? "Você respondeu todas as cartas." : "Responda uma carta para guardá-la aqui.";
    el.historyList.append(li);
  }
  el.albumPage.textContent = `Página ${view.page + 1} de ${view.pages}`;
  el.albumPrev.disabled = view.page === 0;
  el.albumNext.disabled = view.page >= view.pages - 1;
  if (direction !== null && !reducedMotion()) {
    [...el.historyList.children].forEach((node, i) => {
      node.animate(
        [{ opacity: 0, transform: `translate(${direction * 1.5}rem, 0.75rem) scale(0.92)` }, { opacity: 1, transform: "none" }],
        { duration: 240, delay: i * 40, easing: OUT, fill: "backwards" },
      );
    });
  }
}

let albumSliding = false;
const albumWidth = () => el.albumViewport.getBoundingClientRect().width;
const setTrack = (px) => {
  el.albumTrack.style.transform = px === 0 ? "" : `translate3d(${px}px, 0, 0)`;
};

/** Desliza a trilha até a página vizinha e só então troca o conteúdo: sem pulo, porque a vizinha já estava ao lado. */
async function slideAlbum(step, from = 0) {
  if (albumSliding) return;
  const canGo = step === 1 ? albumPage < albumPages - 1 : albumPage > 0;
  if (!canGo) {
    await springAlbum(from);
    return;
  }
  albumSliding = true;
  const width = albumWidth();
  const to = -step * width;
  if (!reducedMotion()) {
    await el.albumTrack
      .animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${to}px,0,0)` }], { duration: Math.round(120 + 160 * (1 - Math.min(1, Math.abs(from - to) / width))), easing: OUT, fill: "forwards" })
      .finished.catch(() => {});
  }
  albumPage += step;
  renderAlbum(null);
  el.albumTrack.getAnimations().forEach((animation) => animation.cancel());
  setTrack(0);
  sfx.play("deal");
  albumSliding = false;
}

async function springAlbum(from) {
  setTrack(0);
  if (reducedMotion() || from === 0) return;
  await el.albumTrack.animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: "translate3d(0,0,0)" }], { duration: 260, easing: OUT }).finished.catch(() => {});
}

function flipAlbum(step) {
  slideAlbum(step, 0);
}

function showHistory() {
  if (busy) return;
  show("history");
  el.clearMsg.textContent = "";
  renderAlbum();
}

function askClear(then) {
  if (busy) return;
  const n = history.length;
  if (n === 0 && points === 0) {
    el.live.textContent = "Não há nada para zerar: seu progresso já está vazio.";
    return;
  }
  const right = history.filter((entry) => entry.correct).length;
  const lv = levelFor(points);
  afterClear = then;
  el.confirmText.textContent = `Você vai perder ${n} ${n === 1 ? "carta" : "cartas"} do álbum (${right} ${right === 1 ? "certa" : "certas"}), ${points} pontos, o nível ${lv.level} (${lv.name}) e seu recorde de sequência. As cartas poderão aparecer de novo. Não dá para desfazer.`;
  el.confirm.returnValue = "";
  el.confirm.showModal();
}
function resetProgress() {
  history = [];
  points = 0;
  hits = 0;
  total = 0;
  streak = 0;
  bestStreak = 0;
  incoming = [];
  current = null;
  mode = "free";
  sourcesOpened = 0;
  for (const key of ["vf:history", "vf:points", "vf:best", "vf:stats", "vf:daily", "vf:dailyDays", "vf:dailyPerfect", "vf:ach", "vf:sources"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* sem armazenamento: nada a apagar */
    }
  }
  ensureDaily();
  renderHud(false);
}
el.confirm.addEventListener("close", () => {
  if (el.confirm.returnValue !== "yes") return;
  const n = history.length;
  resetProgress();
  const then = afterClear;
  afterClear = null;
  if (then) then(n);
});

// Compartilhar a carta: imagem com veredito + fontes (e a legenda com o link da fonte). Só quando a pessoa toca.
async function shareCard() {
  const card = current;
  if (!card || el.card.dataset.state !== "answer") return;
  el.shareCard.disabled = true;
  el.shareCardMsg.textContent = "Preparando a imagem…";
  const caption = shareCaption(card, location.origin);
  try {
    const blob = (await sharePrep) ?? (await renderShareImage(card, { origin: location.origin }));
    const file = new File([blob], "fato-ou-fake.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: caption });
      el.shareCardMsg.textContent = "";
    } else {
      // Sem compartilhamento de arquivo (computador): abre o WhatsApp com a legenda e os links.
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank", "noopener");
      el.shareCardMsg.textContent = "Abrimos o WhatsApp com o texto e os links. A imagem só vai pelo celular.";
    }
  } catch (error) {
    el.shareCardMsg.textContent = error?.name === "AbortError" ? "" : "Não foi possível compartilhar agora.";
  } finally {
    el.shareCard.disabled = false;
  }
}

async function shareScore() {
  const text = shareEndless(hits, total, bestStreak);
  try {
    if (navigator.share) {
      await navigator.share({ text, url: location.origin });
    } else {
      await navigator.clipboard.writeText(`${text}\n${location.origin}`);
      el.shareMsg.textContent = "Placar copiado.";
    }
  } catch {
    el.shareMsg.textContent = "Não foi possível compartilhar.";
  }
}

// ---------- Sobre as fontes ----------
async function openAbout() {
  el.about.showModal();
  const counts = { flavio: [0, 0], lula: [0, 0], terceiros: [0, 0], outros: [0, 0] };
  for (const item of items) counts[item.author ?? "outros"][item.verdict === "verdadeiro" ? 0 : 1] += 1;
  const name = { flavio: "ditas por Flávio", lula: "ditas por Lula", terceiros: "que circularam por terceiros", outros: "de outros temas" };
  const parts = Object.entries(counts)
    .filter(([, [t, f]]) => t + f > 0)
    .map(([key, [t, f]]) => `${t + f} ${name[key]} (${t} fatos, ${f} fakes)`);
  const trues = Object.values(counts).reduce((sum, [t]) => sum + t, 0);
  el.aboutBalance.textContent = `${items.length} cartas: ${parts.join("; ")}. No total, ${trues} fatos e ${items.length - trues} fakes. O baralho junta falas de Lula e de Flávio Bolsonaro, de toda a carreira política de cada um, que os verificadores classificaram como fato ou fake, e boatos sobre os dois que eles desmentiram. Ele não é simétrico e não prova que um lado fala mais verdades que o outro: são poucas cartas, só as de classificação simples. Mostramos os números para você avaliar.`;
  el.aboutContest.hidden = !CONTEST_URL;
  if (CONTEST_URL) el.contestLink.href = CONTEST_URL;
  try {
    const res = await fetch(SOURCES_URL);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    el.aboutSources.replaceChildren(
      ...data.sources.map((source) => {
        const li = document.createElement("li");
        li.textContent = source.name;
        const small = document.createElement("small");
        const status = source.ifcn ? ` IFCN: ${source.ifcn.status}${source.ifcn.verifiedOn ? `, verificada em ${source.ifcn.verifiedOn.split("-").reverse().join("/")}` : ""}.` : "";
        small.textContent = `${source.basis}${status}`;
        li.append(small);
        return li;
      }),
    );
  } catch {
    el.aboutSources.textContent = "Não foi possível carregar a lista agora.";
  }
}

// ---------- Inclinação 3D, arrasto, teclado ----------
const TILT_MAX = 7;
const tiltState = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
function tiltStep() {
  const t = tiltState;
  t.x += (t.tx - t.x) * 0.16;
  t.y += (t.ty - t.y) * 0.16;
  el.tilt.style.transform = `perspective(900px) rotateX(${(-t.y * TILT_MAX).toFixed(2)}deg) rotateY(${(t.x * TILT_MAX).toFixed(2)}deg)`;
  el.glare.style.transform = `translate(${(t.x * 24).toFixed(1)}%, ${(t.y * 24).toFixed(1)}%)`;
  el.glare.style.opacity = String(0.18 + Math.min(1, Math.hypot(t.x, t.y)) * 0.5);
  el.foil.style.transform = `translate(${(t.x * 22).toFixed(1)}%, ${(t.y * 8).toFixed(1)}%)`;
  el.foil.style.opacity = String((Math.min(1, Math.hypot(t.x, t.y)) * 0.9).toFixed(2));
  const settled = Math.abs(t.tx - t.x) + Math.abs(t.ty - t.y) < 0.003;
  t.raf = settled ? 0 : requestAnimationFrame(tiltStep);
}
function tiltTo(nx, ny) {
  if (reducedMotion() || !settings.get("tilt")) return;
  tiltState.tx = nx;
  tiltState.ty = ny;
  if (!tiltState.raf) tiltState.raf = requestAnimationFrame(tiltStep);
}
el.card.addEventListener("pointermove", (event) => {
  const box = el.card.getBoundingClientRect();
  tiltTo(
    Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1)),
    Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1)),
  );
});
["pointerleave", "pointerup", "pointercancel"].forEach((name) => el.card.addEventListener(name, () => tiltTo(0, 0)));

// Só soltar além do limite responde; toque, arrasto curto e gesto cancelado voltam ao centro.
let drag = null;
let wasArmed = false;
function resetCard() {
  el.card.style.setProperty("--dx", "0");
  el.card.style.setProperty("--p", "0");
  el.dragCall.style.setProperty("--p", "0");
  el.card.classList.remove("dragging", "armed");
  wasArmed = false;
}
let flyAnim = null;
let suppressClickUntil = 0;
// Depois da resposta, arrastar para qualquer lado manda a carta embora e mostra a próxima.
function flyOut(dx) {
  const dir = dx > 0 ? 1 : -1;
  el.card.classList.remove("dragging", "armed");
  sfx.play("flip");
  if (reducedMotion()) {
    resetCard();
    advance();
    return;
  }
  flyAnim = el.card.animate(
    [{ translate: "0", opacity: 1 }, { translate: `${dir * innerWidth}px`, opacity: 0 }],
    { duration: 180, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" },
  );
  flyAnim.finished.then(() => {
    resetCard();
    advance();
  }).catch(() => resetCard());
  setTimeout(() => {
    if (flyAnim && el.card.dataset.state === "answer") {
      flyAnim.cancel();
      flyAnim = null;
    }
  }, 1500);
}
el.card.addEventListener("pointerdown", (event) => {
  const answered = el.card.dataset.state === "answer";
  if (!settings.get("drag") || (el.card.dataset.state !== "ask" && !answered) || event.target.closest("a")) return;
  if (answered && Date.now() - answeredAt < 400) return;
  drag = { x: event.clientX, dx: 0, answered };
  el.card.setPointerCapture(event.pointerId);
  el.card.classList.add("dragging");
});
el.card.addEventListener("pointermove", (event) => {
  if (!drag) return;
  drag.dx = event.clientX - drag.x;
  el.card.style.setProperty("--dx", String(drag.dx));
  if (drag.answered) return;
  const progress = String(Math.max(-1, Math.min(1, drag.dx / THRESHOLD)));
  el.card.style.setProperty("--p", progress);
  el.dragCall.style.setProperty("--p", progress);
  const armed = swipeDecision(drag.dx, THRESHOLD) !== null;
  el.card.classList.toggle("armed", armed);
  if (armed && !wasArmed) {
    sfx.play("tick");
    buzz(8);
  }
  wasArmed = armed;
});
el.card.addEventListener("pointerup", () => {
  if (!drag) return;
  const { dx, answered } = drag;
  drag = null;
  if (Math.abs(dx) > 8) suppressClickUntil = Date.now() + 150;
  if (answered) {
    if (swipeDismiss(dx, THRESHOLD)) flyOut(dx);
    else resetCard();
    return;
  }
  const decision = swipeDecision(dx, THRESHOLD);
  resetCard();
  if (decision !== null) answer(decision);
});
el.card.addEventListener("pointercancel", () => {
  drag = null;
  resetCard();
});
el.card.addEventListener("lostpointercapture", () => {
  if (drag) {
    drag = null;
    resetCard();
  }
});

el.card.addEventListener("keydown", (event) => {
  const arrow = event.key === "ArrowRight" || event.key === "ArrowLeft";
  if (arrow && el.card.dataset.state === "answer" && Date.now() - answeredAt >= 400) return advance();
  if (event.key === "ArrowRight") answer(true);
  if (event.key === "ArrowLeft") answer(false);
  if ((event.key === "Enter" || event.key === " ") && event.target === el.card && el.card.dataset.state === "answer") {
    event.preventDefault();
    advance();
  }
});
// Depois de conferir a checagem, tocar na carta também avança (atalho; o botão Próxima carta é o caminho principal).
// Ignora toques nos links das fontes e exige uma pausa curta para um toque duplo não pular a leitura.
el.card.addEventListener("click", (event) => {
  if (el.card.dataset.state !== "answer" || event.target.closest("a")) return;
  if (Date.now() - answeredAt < 400 || Date.now() < suppressClickUntil) return;
  advance();
});

// ---------- Som e configurações ----------
function renderSound() {
  const muted = settings.get("muted");
  el.tabSound.setAttribute("aria-pressed", String(!muted));
}
el.tabSound.addEventListener("click", () => {
  settings.set("muted", !settings.get("muted"));
  music.sync();
  if (!settings.get("muted")) sfx.play("chime");
});

const switches = {
  "set-sfx": ["sfx", (v) => v, (v) => v],
  "set-music": ["music", (v) => v, (v) => v],
  "set-haptics": ["haptics", (v) => v, (v) => v],
  "set-motion": ["motion", (v) => v === "reduce", (on) => (on ? "reduce" : "system")],
  "set-tilt": ["tilt", (v) => v, (v) => v],
  "set-drag": ["drag", (v) => v, (v) => v],
  "set-palette": ["palette", (v) => v === "cb", (on) => (on ? "cb" : "normal")],
  "set-text": ["text", (v) => v === "large", (on) => (on ? "large" : "normal")],
};
function syncSettingsUI() {
  for (const [id, [key, toChecked]] of Object.entries(switches)) {
    el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())].checked = toChecked(settings.get(key));
  }
  el.setVolume.value = String(settings.get("volume"));
  el.setPhone.hidden = typeof navigator.vibrate !== "function";
  renderSound();
}
for (const [id, [key, , fromChecked]] of Object.entries(switches)) {
  const input = el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())];
  input.addEventListener("change", () => {
    settings.set(key, fromChecked(input.checked));
    if (key === "sfx" && input.checked) sfx.play("chime");
    if (key === "haptics" && input.checked) navigator.vibrate?.(20);
    music.sync();
  });
}
el.setVolume.addEventListener("input", () => settings.set("volume", Number(el.setVolume.value)));
el.setVolume.addEventListener("change", () => sfx.play("chime"));
function openSettings() {
  if (busy) return;
  syncSettingsUI();
  el.settings.showModal();
}
el.setReset.addEventListener("click", () => {
  el.settings.close();
  askClear(() => showMenu());
});
settings.subscribe(() => {
  renderSound();
  if (typeof el.setVolume.value === "string") syncSettingsUI();
});
syncSettingsUI();

// ---------- Janelas ----------
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) dialog.close("cancel");
  });
}

// ---------- Ligações ----------
el.playBtn.addEventListener("click", startGame);
el.tabSettings.addEventListener("click", openSettings);
el.tabHome.addEventListener("click", showMenu);
el.tabPlay.addEventListener("click", goPlay);
el.tabScore.addEventListener("click", showScore);
el.tabAlbum.addEventListener("click", showHistory);
el.howtoBtn.addEventListener("click", () => el.howto.showModal());
el.aboutBtn.addEventListener("click", openAbout);
el.retry.addEventListener("click", loadPool);
el.true.addEventListener("click", () => answer(true));
el.fake.addEventListener("click", () => answer(false));
el.next.addEventListener("click", advance);
el.stop2.addEventListener("click", showScore);
el.again.addEventListener("click", () => {
  if (mode === "daily") {
    mode = "free";
    if (current && !daily.results.some((r) => r.id === current.id)) current = null;
  }
  if (current && el.card.dataset.state === "ask") show("play");
  else nextCard();
});
el.dailyBtn.addEventListener("click", startDaily);
el.reShare.addEventListener("click", shareDaily);
el.reAgain.addEventListener("click", () => {
  mode = "free";
  if (current && !daily.results.some((r) => r.id === current.id)) current = null;
  if (current && el.card.dataset.state === "ask") show("play");
  else nextCard();
});
el.reAlbum.addEventListener("click", showHistory);
el.achBtn.addEventListener("click", openAchievements);
el.openHistory2.addEventListener("click", showHistory);
el.openHistory3.addEventListener("click", showHistory);
el.albumPrev.addEventListener("click", () => flipAlbum(-1));
el.albumNext.addEventListener("click", () => flipAlbum(1));
el.albumFilters.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest(".album-filter") : null;
  if (!button) return;
  albumFilter = button.dataset.filter;
  albumPage = 0;
  sfx.play("tick");
  renderAlbum();
});
{
  // Arrastar a trilha: as páginas vizinhas seguem o dedo, sem espera. Ao soltar, avança ou volta com a inércia do gesto.
  let swipe = null;
  const surface = el.albumViewport;
  surface.addEventListener("pointerdown", (event) => {
    if (albumSliding) return;
    swipe = { x: event.clientX, y: event.clientY, trail: [{ x: event.clientX, t: performance.now() }], dx: 0, active: false, id: event.pointerId };
  });
  surface.addEventListener("pointermove", (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swipe.active = true;
      surface.setPointerCapture(swipe.id);
      el.albumTrack.classList.add("dragging");
    }
    swipe.trail.push({ x: event.clientX, t: performance.now() });
    if (swipe.trail.length > 12) swipe.trail.shift();
    const atEdge = (dx > 0 && albumPage === 0) || (dx < 0 && albumPage >= albumPages - 1);
    swipe.dx = atEdge ? dx * 0.3 : dx;
    setTrack(swipe.dx);
  });
  const release = (cancelled) => {
    if (!swipe) return;
    const { dx, active, trail } = swipe;
    swipe = null;
    // velocidade nos últimos ~100 ms antes de soltar, em px/ms
    const last = trail[trail.length - 1];
    const ref = trail.find((point) => last.t - point.t <= 100) ?? last;
    const v = last.t > ref.t ? (last.x - ref.x) / (last.t - ref.t) : 0;
    if (!active) return;
    el.albumTrack.classList.remove("dragging");
    suppressAlbumClick = Date.now() + 250;
    const width = albumWidth();
    const step = dx < 0 ? 1 : -1;
    const flung = Math.abs(v) > 0.45 && Math.sign(v) === -step;
    const go = !cancelled && (Math.abs(dx) > width * 0.3 || flung);
    if (go) slideAlbum(step, dx);
    else springAlbum(dx);
  };
  surface.addEventListener("pointerup", () => release(false));
  surface.addEventListener("pointercancel", () => release(true));
  surface.addEventListener("click", (event) => {
    if (Date.now() < suppressAlbumClick) event.stopPropagation();
  }, true);
}
addEventListener("resize", () => {
  if (!el.history.hidden) renderAlbum();
});
el.clear2.addEventListener("click", () => askClear(() => nextCard()));
el.share.addEventListener("click", shareScore);
el.shareCard.addEventListener("click", shareCard);
el.detailsBtn.addEventListener("click", () => current && openDetails(current));
for (const box of [el.sources, el.detailsBody]) {
  box.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href^='http']") : null;
    if (!link) return;
    sourcesOpened += 1;
    store.set("vf:sources", sourcesOpened);
    const unlocked = checkAchievements();
    if (unlocked.length > 0) {
      banner(achText(unlocked), 2);
      sfx.play("trophy", undefined, 300);
    }
  });
}

loadPool();
setInterval(refreshPool, POLL_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshPool();
});

// Navegadores só liberam áudio depois de um toque: o primeiro toque na tela inicial liga a trilha do menu.
document.addEventListener("pointerdown", () => music.sync(), { once: true });
