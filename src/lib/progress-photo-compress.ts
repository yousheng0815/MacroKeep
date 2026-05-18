/**
 * Progress check-ins: fixed **3:4 portrait** (matches capture UI `aspect-[3/4]`),
 * downscaled for upload / Drive — same idea as meal photo prep.
 */
export const PROGRESS_PHOTO_OUT_WIDTH = 768;
export const PROGRESS_PHOTO_OUT_HEIGHT = 1024;

/** Target upper bound for encoded JPEG bytes (upload / Drive). */
export const PROGRESS_PHOTO_MAX_BYTES = 512 * 1024;

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Center-crop to 3:4, resize to {@link PROGRESS_PHOTO_OUT_WIDTH}×{@link PROGRESS_PHOTO_OUT_HEIGHT},
 * then JPEG-encode within byte budget (same pipeline for camera, upload, and Drive).
 */
export async function compressProgressPhotoBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const aw = bitmap.width;
    const ah = bitmap.height;
    if (aw < 2 || ah < 2) throw new Error("Invalid image dimensions");

    const tw = PROGRESS_PHOTO_OUT_WIDTH;
    const th = PROGRESS_PHOTO_OUT_HEIGHT;
    const dstAspect = tw / th;
    const srcAspect = aw / ah;

    let sx = 0;
    let sy = 0;
    let sw = aw;
    let sh = ah;
    if (srcAspect > dstAspect) {
      sh = ah;
      sw = Math.max(1, Math.round(ah * dstAspect));
      sx = Math.max(0, Math.round((aw - sw) / 2));
      sy = 0;
    } else if (srcAspect < dstAspect) {
      sw = aw;
      sh = Math.max(1, Math.round(aw / dstAspect));
      sx = 0;
      sy = Math.max(0, Math.round((ah - sh) / 2));
    }

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, tw, th);

    let quality = 0.86;
    for (;;) {
      const out = await canvasToJpegBlob(canvas, quality);
      if (out.size <= PROGRESS_PHOTO_MAX_BYTES) return out;
      if (quality > 0.52) {
        quality -= 0.06;
        continue;
      }
      return canvasToJpegBlob(canvas, 0.48);
    }
  } finally {
    bitmap.close();
  }
}
