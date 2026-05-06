/** Longest side (px) after resize — enough for thumbnails/history without huge uploads. */
export const MEAL_PHOTO_MAX_EDGE_PX = 1024;

/** Target upper bound for encoded JPEG bytes (before upload). */
export const MEAL_PHOTO_MAX_BYTES = 512 * 1024;
export const MEAL_THUMB_MAX_EDGE_PX = 320;
export const MEAL_THUMB_MAX_BYTES = 40 * 1024;

function approxDecodedBytesFromBase64(base64: string): number {
  const len = base64.length;
  const pad = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s !== "string") {
        reject(new Error("Unexpected read result"));
        return;
      }
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

async function decodeToBitmap(
  base64: string,
  mimeType: string,
): Promise<ImageBitmap> {
  const mime = (mimeType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  const res = await fetch(`data:${mime};base64,${base64}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

type PreparedPhoto = { base64: string; mimeType: string };

async function encodeBitmapAsJpegWithinBudget(
  bitmap: ImageBitmap,
  maxEdgePx: number,
  maxBytes: number,
): Promise<PreparedPhoto> {
  let w = bitmap.width;
  let h = bitmap.height;
  if (w < 1 || h < 1) throw new Error("Invalid image dimensions");

  if (w > maxEdgePx || h > maxEdgePx) {
    const scale = maxEdgePx / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let cw = w;
  let ch = h;
  let quality = 0.88;

  const draw = () => {
    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(bitmap, 0, 0, cw, ch);
  };

  for (;;) {
    draw();
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      const out = await blobToBase64(blob);
      return { base64: out, mimeType: "image/jpeg" };
    }

    if (quality > 0.52) {
      quality -= 0.07;
      continue;
    }

    if (Math.max(cw, ch) > 960) {
      const scale = 960 / Math.max(cw, ch);
      cw = Math.max(1, Math.round(cw * scale));
      ch = Math.max(1, Math.round(ch * scale));
      quality = 0.85;
      continue;
    }

    if (Math.max(cw, ch) > 640) {
      const scale = 640 / Math.max(cw, ch);
      cw = Math.max(1, Math.round(cw * scale));
      ch = Math.max(1, Math.round(ch * scale));
      quality = 0.82;
      continue;
    }

    if (Math.max(cw, ch) > 480) {
      const scale = 480 / Math.max(cw, ch);
      cw = Math.max(1, Math.round(cw * scale));
      ch = Math.max(1, Math.round(ch * scale));
      quality = 0.78;
      continue;
    }

    draw();
    const last = await canvasToJpegBlob(canvas, 0.42);
    const out = await blobToBase64(last);
    return { base64: out, mimeType: "image/jpeg" };
  }
}

/**
 * Downscales and re-encodes as JPEG so the payload stays under {@link MEAL_PHOTO_MAX_BYTES}
 * when possible. Output is always `image/jpeg` for predictable size.
 */
export async function prepareMealPhotoForUpload(
  base64: string,
  mimeType: string,
): Promise<{ base64: string; mimeType: string }> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeToBitmap(base64, mimeType);
  } catch {
    const raw = approxDecodedBytesFromBase64(base64);
    if (raw <= MEAL_PHOTO_MAX_BYTES) {
      return {
        base64,
        mimeType:
          (mimeType || "image/jpeg").split(";")[0].trim() || "image/jpeg",
      };
    }
    throw new Error(
      "Could not process this photo format. Try another image or export as JPEG/PNG.",
    );
  }

  try {
    return await encodeBitmapAsJpegWithinBudget(
      bitmap,
      MEAL_PHOTO_MAX_EDGE_PX,
      MEAL_PHOTO_MAX_BYTES,
    );
  } finally {
    bitmap?.close();
  }
}

export async function prepareMealPhotoPairForUpload(
  base64: string,
  mimeType: string,
): Promise<{ full: PreparedPhoto; thumb: PreparedPhoto }> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeToBitmap(base64, mimeType);
  } catch {
    const full = await prepareMealPhotoForUpload(base64, mimeType);
    const thumb = full;
    return { full, thumb };
  }

  try {
    const full = await encodeBitmapAsJpegWithinBudget(
      bitmap,
      MEAL_PHOTO_MAX_EDGE_PX,
      MEAL_PHOTO_MAX_BYTES,
    );
    const thumb = await encodeBitmapAsJpegWithinBudget(
      bitmap,
      MEAL_THUMB_MAX_EDGE_PX,
      MEAL_THUMB_MAX_BYTES,
    );
    return { full, thumb };
  } finally {
    bitmap?.close();
  }
}
