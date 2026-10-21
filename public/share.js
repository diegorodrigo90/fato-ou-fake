// Imagem para compartilhar (WhatsApp etc.): sempre com o veredito grande, a checagem e as fontes em texto.
import { verdictLabel, categoryOf, middleEllipsis, rarityOf, wrapLines } from "./lib.js";

const W = 1080;
const H = 1350;
const INK = "#12186b";
const SOFT = "#3b4180";
const PALETTE = {
  comum: { body: "#ffd23f", frame: "#12186b" },
  rara: { body: "#8fc2ff", frame: "#1b2bd1" },
  epica: { body: "#a98bff", frame: "#3d1d99" },
};
const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TYPE_LABEL = { agencia: "agência de checagem", oficial: "órgão oficial" };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// Monta a lista de desenhos para uma escala e devolve a altura usada; reduz a escala até caber.
function layout(g, card, scale, origin) {
  const x0 = 96;
  const innerW = W - 2 * x0;
  let y = 96;
  const ops = [];
  const font = (px, weight = 800) => `${weight} ${Math.round(px * scale)}px ${FONT}`;
  const measure = (px, weight) => {
    g.font = font(px, weight);
    return (t) => g.measureText(t).width;
  };
  const lines = (text, px, weight, width) => wrapLines(text, width, measure(px, weight));

  const label = (text, color = INK) => {
    const at = y;
    ops.push(() => {
      g.font = font(28, 800);
      g.fillStyle = color;
      g.textBaseline = "top";
      g.fillText(text.toUpperCase(), x0, at);
    });
    y += 28 * scale * 1.5;
  };

  const box = (blocks) => {
    const pad = 28 * scale;
    const laid = blocks.map(({ text, px, weight, color }) => {
      const wrapped = lines(text, px, weight, innerW - 2 * pad);
      return { wrapped, px, weight, color, lh: px * scale * 1.22 };
    });
    const height = laid.reduce((sum, b) => sum + b.wrapped.length * b.lh + 8 * scale, 0) + 2 * pad - 8 * scale;
    const top = y;
    ops.push(() => {
      roundRect(g, x0, top, innerW, height, 28);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = PALETTE[rarityOf(card)].frame;
      g.stroke();
      let cy = top + pad;
      for (const block of laid) {
        g.font = font(block.px, block.weight);
        g.fillStyle = block.color;
        g.textBaseline = "top";
        block.wrapped.forEach((line, i) => g.fillText(line, x0 + pad, cy + i * block.lh));
        cy += block.wrapped.length * block.lh + 8 * scale;
      }
    });
    y += height + 22 * scale;
  };

  // cabeçalho
  const cat = categoryOf(card);
  const headTop = y;
  ops.push(() => {
    g.fillStyle = INK;
    g.textBaseline = "top";
    g.font = font(40, 800);
    g.fillText("FATO OU FAKE?", x0, headTop);
    g.font = font(32, 800);
    g.textAlign = "right";
    g.fillText(cat.label.toUpperCase(), x0 + innerW, headTop + 4 * scale);
    g.textAlign = "left";
  });
  y += 70 * scale;

  // carimbo do veredito
  const stampH = 190 * scale;
  const stampTop = y;
  const isTrue = card.verdict === "verdadeiro";
  ops.push(() => {
    g.save();
    g.translate(W / 2, stampTop + stampH / 2);
    g.rotate((-4 * Math.PI) / 180);
    g.font = font(isTrue ? 120 : 150, 800);
    const text = verdictLabel(card).toUpperCase();
    const textW = g.measureText(text).width;
    roundRect(g, -textW / 2 - 40, -stampH / 2, textW + 80, stampH, 28);
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = (isTrue ? css.getPropertyValue("--true") : css.getPropertyValue("--fake")).trim() || (isTrue ? "#3ddc97" : "#ff5fa2");
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = INK;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 6 * scale);
    g.restore();
  });
  y += stampH + 40 * scale;

  label("Afirmação");
  box([{ text: card.claim, px: 50, weight: 800, color: INK }]);
  label("Checagem");
  box([
    { text: card.explanation, px: 40, weight: 700, color: INK },
    { text: card.status, px: 30, weight: 700, color: SOFT },
  ]);
  label("Fontes");
  box(
    card.sources.slice(0, 3).flatMap((source) => [
      { text: `${source.label} · ${TYPE_LABEL[source.type] ?? "fonte"}`, px: 34, weight: 800, color: INK },
      { text: middleEllipsis(source.url, 60), px: 28, weight: 700, color: "#1b2bd1" },
    ]),
  );

  const date = card.sources[0].date.split("-").reverse().join("/");
  const footTop = y;
  ops.push(() => {
    g.fillStyle = INK;
    g.textBaseline = "top";
    g.font = font(30, 800);
    g.fillText(`Checagem de ${date}`, x0, footTop);
    g.font = font(26, 700);
    g.fillText(`Fatos com fonte. Não é propaganda. ${origin.replace(/^https?:\/\//, "")}`, x0, footTop + 40 * scale);
  });
  y += 80 * scale;
  return { ops, bottom: y };
}

/**
 * @param {object} card pool item
 * @param {{origin: string}} options
 * @returns {Promise<Blob>} PNG 1080x1350
 */
export async function renderShareImage(card, { origin }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const pal = PALETTE[rarityOf(card)];

  const bg = g.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.35, H);
  bg.addColorStop(0, "#3a4cf5");
  bg.addColorStop(0.5, "#1b2bd1");
  bg.addColorStop(1, "#0c1580");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  roundRect(g, 48, 48, W - 96, H - 96, 56);
  g.fillStyle = pal.body;
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = pal.frame;
  g.stroke();

  let scale = 1;
  let result = layout(g, card, scale, origin);
  while (result.bottom > H - 96 && scale > 0.55) {
    scale -= 0.05;
    result = layout(g, card, scale, origin);
  }
  for (const op of result.ops) op();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas vazio"))), "image/png"));
}

function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/**
 * Imagem da rodada do dia: nota, estrelas e um quadrado por carta. Sem nomes de candidatos e sem texto de cartas.
 * @param {{key: string, results: boolean[], stars: number, rank: string, streakDays: number, origin: string}} data
 * @returns {Promise<Blob>} PNG 1080x1350
 */
export async function renderDailyShareImage({ key, results, stars, rank, streakDays, origin }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const bg = g.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.35, H);
  bg.addColorStop(0, "#3a4cf5");
  bg.addColorStop(0.5, "#1b2bd1");
  bg.addColorStop(1, "#0c1580");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  roundRect(g, 48, 48, W - 96, H - 96, 56);
  g.fillStyle = "#ffd23f";
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = INK;
  g.stroke();

  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `800 64px ${FONT}`;
  g.fillText("FATO OU FAKE?", W / 2, 190);
  g.font = `800 38px ${FONT}`;
  g.fillStyle = SOFT;
  g.fillText(`RODADA DO DIA · ${key.split("-").reverse().join("/")}`, W / 2, 252);

  // estrelas
  for (let i = 0; i < 3; i++) {
    const cx = W / 2 + (i - 1) * 190;
    starPath(g, cx, 400, 84);
    g.fillStyle = i < stars ? "#ff9f1c" : "rgb(18 24 107 / 0.18)";
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.stroke();
  }

  const right = results.filter(Boolean).length;
  g.fillStyle = INK;
  g.font = `800 230px ${FONT}`;
  g.fillText(`${right}/${results.length}`, W / 2, 680);
  g.font = `800 58px ${FONT}`;
  g.fillText(rank, W / 2, 770);

  // um quadrado por carta
  const cols = Math.min(5, results.length) || 1;
  const size = 120;
  const gap = 22;
  const rows = Math.ceil(results.length / cols);
  const gridW = cols * size + (cols - 1) * gap;
  const x0 = (W - gridW) / 2;
  const y0 = 840;
  results.forEach((ok, i) => {
    const x = x0 + (i % cols) * (size + gap);
    const y = y0 + Math.floor(i / cols) * (size + gap);
    roundRect(g, x, y, size, size, 24);
    g.fillStyle = ok ? "#3ddc97" : "#ff5fa2";
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 16;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    if (ok) {
      g.moveTo(x + 32, y + 62);
      g.lineTo(x + 52, y + 84);
      g.lineTo(x + 90, y + 38);
    } else {
      g.moveTo(x + 36, y + 36);
      g.lineTo(x + 84, y + 84);
      g.moveTo(x + 84, y + 36);
      g.lineTo(x + 36, y + 84);
    }
    g.stroke();
  });

  let footY = y0 + rows * (size + gap) + 20;
  if (streakDays >= 2) {
    g.fillStyle = INK;
    g.font = `800 44px ${FONT}`;
    g.fillText(`${streakDays} dias seguidos`, W / 2, footY + 30);
    footY += 60;
  }
  g.fillStyle = INK;
  g.font = `700 30px ${FONT}`;
  g.fillText(`Fatos com fonte. Não é propaganda. ${origin.replace(/^https?:\/\//, "")}`, W / 2, H - 100);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas vazio"))), "image/png"));
}
