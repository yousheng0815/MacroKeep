#!/usr/bin/env node
/**
 * Generate PWA icons and Apple splash screens from public brand assets.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "pwa");
const BG = { r: 9, g: 9, b: 11, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** @type {[number, number, number][]} */
const APPLE_SPLASH_SIZES = [
  [1320, 2868, 3],
  [1290, 2796, 3],
  [1284, 2778, 3],
  [1179, 2556, 3],
  [1170, 2532, 3],
  [1125, 2436, 3],
  [828, 1792, 2],
  [750, 1334, 2],
  [640, 1136, 2],
  [2048, 2732, 2],
];

/** Trim uniform margins from `icon-mark.png` (symmetric bbox around the leaf). */
async function loadLeafMark() {
  return sharp(path.join(PUBLIC, "icon-mark.png")).trim({ threshold: 8 });
}

/** Alpha-weighted center — balances asymmetric leaf shapes better than bbox centering. */
async function alphaCentroid(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let sumX = 0;
  let sumY = 0;
  let mass = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 16) {
        sumX += x * a;
        sumY += y * a;
        mass += a;
      }
    }
  }

  return { cx: sumX / mass, cy: sumY / mass, width, height };
}

/**
 * @param {sharp.Sharp} mark
 * @param {number} size
 * @param {{ inset?: number; background?: typeof BG }} [opts]
 */
async function squareMark(mark, size, { inset = 0.12, background = BG } = {}) {
  const trimmed = await mark.png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const inner = Math.floor(size * (1 - inset * 2));
  const scale = inner / Math.max(meta.width ?? 1, meta.height ?? 1);
  const w = Math.round((meta.width ?? 1) * scale);
  const h = Math.round((meta.height ?? 1) * scale);

  const resized = await sharp(trimmed)
    .resize(w, h, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const { cx, cy } = await alphaCentroid(resized);
  const x = Math.round(size / 2 - cx);
  const y = Math.round(size / 2 - cy);

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  }).composite([{ input: resized, left: x, top: y }]);
}

/**
 * @param {string} wordmarkPath
 * @param {number} width
 * @param {number} height
 */
async function splashImage(wordmarkPath, width, height) {
  const maxW = Math.floor(width * 0.76);
  const maxH = Math.floor(height * 0.2);
  const fitted = await sharp(wordmarkPath)
    .resize(maxW, maxH, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  return sharp({
    create: { width, height, channels: 4, background: BG },
  }).composite([
    {
      input: fitted,
      left: Math.floor((width - w) / 2),
      top: Math.floor((height - h) / 2),
    },
  ]);
}

function splashMedia(width, height, scale) {
  const dw = Math.floor(width / scale);
  const dh = Math.floor(height / scale);
  const ratio = scale > 1 ? ` and (-webkit-device-pixel-ratio: ${scale})` : "";
  return `(device-width: ${dw}px) and (device-height: ${dh}px) and (orientation: portrait)${ratio}`;
}

function buildAppleSplashHtml() {
  return (
    APPLE_SPLASH_SIZES.map(([w, h, scale]) => {
      const name = `apple-splash-portrait-${w}x${h}.png`;
      const media = splashMedia(w, h, scale);
      return `    <link rel="apple-touch-startup-image" href="/pwa/${name}" media="${media}" />`;
    }).join("\n") + "\n"
  );
}

async function patchIndexHtml(splashLinks) {
  const indexPath = path.join(ROOT, "index.html");
  let text = await readFile(indexPath, "utf8");
  const start = "    <!-- pwa-apple-splash:start -->";
  const end = "    <!-- pwa-apple-splash:end -->";
  const block = `${start}\n${splashLinks}${end}`;

  if (text.includes(start)) {
    text = text.split(start)[0] + block + text.split(end)[1];
  } else {
    text = text.replace('    <link rel="icon"', `${block}\n    <link rel="icon"`, 1);
  }

  await writeFile(indexPath, text);
}

async function writePng(pipeline, filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await pipeline.png().toFile(filePath);
}

async function main() {
  const mark = await loadLeafMark();
  const wordmarkPath = path.join(PUBLIC, "wordmark.png");

  await writePng(
    await squareMark(mark, 128, { background: TRANSPARENT }),
    path.join(PUBLIC, "favicon.png"),
  );
  await writePng(await squareMark(mark, 180), path.join(OUT, "apple-touch-icon.png"));
  await writePng(await squareMark(mark, 192), path.join(OUT, "icon-192.png"));
  await writePng(await squareMark(mark, 512), path.join(OUT, "icon-512.png"));
  await writePng(await squareMark(mark, 512, { inset: 0.18 }), path.join(OUT, "icon-maskable-512.png"));

  for (const [w, h] of APPLE_SPLASH_SIZES) {
    const name = `apple-splash-portrait-${w}x${h}.png`;
    await writePng(
      await splashImage(wordmarkPath, w, h),
      path.join(OUT, name),
    );
  }

  await patchIndexHtml(buildAppleSplashHtml());
  console.log("Wrote PWA assets to public/pwa/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
