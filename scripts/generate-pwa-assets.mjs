#!/usr/bin/env node
/**
 * Generate PWA icons and Apple splash screens from public brand assets.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "pwa");
const BG = { r: 9, g: 9, b: 11, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Padding inside square icons — larger = smaller leaf (avoids mask clipping). */
const ICON_INSET = {
  favicon: 0.16,
  touch: 0.2,
  pwa: 0.2,
  maskable: 0.26,
};

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

async function writePng(pipeline, filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await pipeline.png().toFile(filePath);
}

async function main() {
  const mark = await loadLeafMark();

  await writePng(
    await squareMark(mark, 128, {
      background: TRANSPARENT,
      inset: ICON_INSET.favicon,
    }),
    path.join(PUBLIC, "favicon.png"),
  );
  await writePng(
    await squareMark(mark, 180, { inset: ICON_INSET.touch }),
    path.join(OUT, "apple-touch-icon.png"),
  );
  await writePng(
    await squareMark(mark, 192, { inset: ICON_INSET.pwa }),
    path.join(OUT, "icon-192.png"),
  );
  await writePng(
    await squareMark(mark, 512, { inset: ICON_INSET.pwa }),
    path.join(OUT, "icon-512.png"),
  );
  await writePng(
    await squareMark(mark, 512, { inset: ICON_INSET.maskable }),
    path.join(OUT, "icon-maskable-512.png"),
  );

  console.log("Wrote PWA assets to public/pwa/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
