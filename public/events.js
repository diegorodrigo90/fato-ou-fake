// Eventos de baralho: embaralhar ao abrir e a chegada de cartas novas (o baralho vira, as cartas saem dele e voltam ao jogo).
import { play } from "./sound.js";
import { reducedMotion } from "./settings.js";

const reduced = () => reducedMotion();
const SPRING = CSS.supports("animation-timing-function", "linear(0, 1)")
  ? "linear(0, 0.4 10%, 0.93 22%, 1.1 34%, 1.04 46%, 0.99 60%, 1.005 78%, 1)"
  : "cubic-bezier(0.22, 1, 0.36, 1)";
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const div = (className) => {
  const node = document.createElement("div");
  node.className = className;
  return node;
};

function makeStage(cw) {
  const root = div("event");
  root.setAttribute("aria-hidden", "true");
  const dim = div("event-dim");
  const stage = div("event-stage");
  stage.style.setProperty("--cw", `${cw}px`);
  root.append(dim, stage);
  document.body.append(root);
  // O jogo fica inerte atrás do evento: teclado e leitor de tela não agem sobre o que não se vê.
  document.querySelector("main")?.setAttribute("inert", "");
  root.tabIndex = -1;
  root.focus({ preventScroll: true });
  return { root, dim, stage };
}

// Reúne as animações para que um toque (ou Esc, Enter, Espaço) pule o evento inteiro.
function runner(root) {
  const anims = [];
  let skipped = false;
  const skip = () => {
    skipped = true;
    anims.forEach((anim) => {
      try {
        anim.finish();
      } catch {
        /* animação já terminada */
      }
    });
  };
  const onKey = (event) => {
    if (["Escape", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      skip();
    }
  };
  root.addEventListener("pointerdown", skip);
  document.addEventListener("keydown", onKey);
  return {
    run(node, frames, options) {
      const anim = node.animate(frames, { fill: "both", ...options });
      anims.push(anim);
      return anim.finished.catch(() => {});
    },
    skipped: () => skipped,
    done() {
      document.removeEventListener("keydown", onKey);
      document.querySelector("main")?.removeAttribute("inert");
      root.remove();
    },
  };
}

export function burst(host, { x = "50%", y = "50%", count = 16 } = {}) {
  if (reduced()) return;
  const css = getComputedStyle(document.documentElement);
  const colors = ["#ffd23f", css.getPropertyValue("--true").trim() || "#3ddc97", css.getPropertyValue("--fake").trim() || "#ff5fa2", "#ffffff"];
  const layer = div("burst");
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--bx", x);
  layer.style.setProperty("--by", y);
  for (let i = 0; i < count; i++) {
    const dot = div("spark");
    dot.style.background = colors[i % colors.length];
    layer.append(dot);
    const angle = (i / count) * 2 * Math.PI;
    const dist = 80 + (i % 3) * 35;
    dot.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0.3)`, opacity: 0 },
      ],
      { duration: 800 + (i % 4) * 90, easing: OUT, fill: "forwards" },
    );
  }
  host.append(layer);
  setTimeout(() => layer.remove(), 1300);
}

/** Embaralhar ao abrir: duas passadas de intercalação e o monte se recolhe. */
export async function shuffleIntro(cw) {
  if (reduced()) {
    play("riffle");
    return;
  }
  const { root, dim, stage } = makeStage(cw);
  const r = runner(root);
  const backs = Array.from({ length: 8 }, (_, i) => {
    const card = div("ecard");
    card.style.zIndex = String(i);
    stage.append(card);
    return card;
  });
  play("riffle");
  play("riffle", undefined, 520);
  r.run(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  const moves = [];
  for (let pass = 0; pass < 2; pass++) {
    backs.forEach((card, i) => {
      const side = i % 2 ? 1 : -1;
      moves.push(
        r.run(
          card,
          [
            { transform: "translateX(0) rotate(0deg)" },
            { transform: `translateX(${side * cw * 0.42}px) rotate(${side * 9}deg)`, offset: 0.45 },
            { transform: "translateX(0) rotate(0deg)" },
          ],
          { duration: 420, delay: 120 + pass * 520 + i * 26, easing: OUT },
        ),
      );
    });
  }
  await Promise.all(moves);
  await Promise.all([
    r.run(stage, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.9) translateY(30px)" }], { duration: 260, easing: OUT }),
    r.run(dim, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 60 }),
  ]);
  r.done();
}

/**
 * Chegada de cartas novas: o baralho vem ao centro e vira, as cartas saem dele em leque,
 * se abrem mostrando só a raridade (sem revelar a pergunta) e voltam ao baralho.
 * @param {{cards: {rank: string, icon: string, label: string}[], extra?: number, cw: number}} options
 */
export async function dealEvent({ cards, extra = 0, cw }) {
  play("riffle");
  if (reduced()) return;
  const { root, dim, stage } = makeStage(cw);
  const r = runner(root);
  const total = cards.length + extra;
  const title = div("event-title");
  title.textContent = total === 1 ? "Carta nova!" : `${total} cartas novas!`;
  root.append(title);

  const stack = Array.from({ length: 6 }, (_, i) => {
    const card = div("ecard");
    card.style.zIndex = String(i);
    stage.append(card);
    return card;
  });
  r.run(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
  stack.forEach((card, i) =>
    r.run(
      card,
      [
        { transform: "translate(0, 40px) scale(0.8)", opacity: 0 },
        { transform: `translate(0, ${-i * 1.5}px) scale(1)`, opacity: 1 },
      ],
      { duration: 480, delay: 60 + i * 30, easing: SPRING },
    ),
  );
  r.run(title, [{ transform: "translateY(-30px) scale(0.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, delay: 260, easing: SPRING });
  play("whoosh", undefined, 520);

  // o baralho vira
  await r.run(
    stage,
    [
      { transform: "rotateY(0deg) scale(1)" },
      { transform: "rotateY(180deg) scale(1.12)", offset: 0.5 },
      { transform: "rotateY(360deg) scale(1)" },
    ],
    { duration: 760, delay: 560, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
  );

  // as cartas saem em leque e se abrem
  const spread = Math.min(cw * 0.62, 150);
  const minis = cards.map((card, k) => {
    const mini = div("mini");
    mini.dataset.rank = card.rank;
    const flip = div("flip");
    const back = div("mb");
    const front = div("mf");
    const icon = document.createElement("span");
    icon.className = "icon icon-xl";
    icon.style.setProperty("--icon", `url(icons/${card.icon}.svg)`);
    const name = document.createElement("span");
    name.className = "mf-rank";
    name.textContent = card.label;
    front.append(icon, name);
    flip.append(back, front);
    mini.append(flip);
    stage.append(mini);
    return { mini, flip, card, k };
  });
  const offset = (k) => k - (cards.length - 1) / 2;
  const reveals = minis.map(({ mini, flip, card, k }) => {
    const tx = offset(k) * spread;
    const ty = -Math.abs(offset(k)) * 10;
    const t = k * 170;
    play("chime", k, t + 520);
    if (card.rank === "epica") {
      play("epic", undefined, t + 560);
      setTimeout(() => {
        if (!r.skipped()) burst(stage, { x: `calc(50% + ${tx}px)`, y: `calc(50% + ${ty}px)` });
      }, t + 560);
    }
    return Promise.all([
      r.run(
        mini,
        [
          { transform: "translate(0, 0) scale(0.5) rotate(0deg)", opacity: 0 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.62) rotate(${offset(k) * 12}deg)`, opacity: 1 },
        ],
        { duration: 520, delay: t, easing: SPRING },
      ),
      r.run(flip, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: 380, delay: t + 420, easing: OUT }),
    ]);
  });
  await Promise.all(reveals);
  await r.run(dim, [{ opacity: 1 }, { opacity: 1 }], { duration: 650 });

  // tudo volta ao baralho e o jogo continua
  await Promise.all([
    ...minis.map(({ mini }) =>
      r.run(mini, [{ opacity: 1 }, { transform: "translate(0, 0) scale(0.5) rotate(0deg)", opacity: 0 }], { duration: 280, easing: OUT }),
    ),
    r.run(title, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-20px)" }], { duration: 260 }),
    r.run(stage, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.88) translateY(40px)", opacity: 0 }], { duration: 320, delay: 160, easing: OUT }),
    r.run(dim, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 200 }),
  ]);
  r.done();
}
