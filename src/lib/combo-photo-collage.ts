import { ensureGoogleAccessToken } from "@/lib/gapi";
import { downloadAppDataFileBlob } from "@/lib/google-drive";
import { comboItemPhotoFileIds } from "@/lib/saved-combo-utils";
import type { PreparedMealPhoto } from "@/types/meal-scan";
import type { SavedComboRecord, SavedQuickAdd } from "@/types/records";

const COLLAGE_EDGE_PX = 512;

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode collage"))),
      "image/jpeg",
      quality,
    );
  });
}

async function blobToBase64Payload(blob: Blob): Promise<PreparedMealPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== "string") {
        reject(new Error("Unexpected read result"));
        return;
      }
      const comma = res.indexOf(",");
      resolve({
        base64: comma >= 0 ? res.slice(comma + 1) : res,
        mimeType: "image/jpeg",
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.max(dw / bitmap.width, dh / bitmap.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;
  ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawCollage(
  ctx: CanvasRenderingContext2D,
  size: number,
  bitmaps: ImageBitmap[],
): void {
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, size, size);

  const count = bitmaps.length;
  if (count === 0) return;

  if (count === 1) {
    drawCover(ctx, bitmaps[0], 0, 0, size, size);
    return;
  }

  if (count === 2) {
    const half = size / 2;
    drawCover(ctx, bitmaps[0], 0, 0, half, size);
    drawCover(ctx, bitmaps[1], half, 0, half, size);
    return;
  }

  if (count === 3) {
    const half = size / 2;
    drawCover(ctx, bitmaps[0], 0, 0, half, size);
    drawCover(ctx, bitmaps[1], half, 0, half, half);
    drawCover(ctx, bitmaps[2], half, half, half, half);
    return;
  }

  const half = size / 2;
  for (let i = 0; i < Math.min(4, count); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawCover(ctx, bitmaps[i], col * half, row * half, half, half);
  }
}

async function loadBitmapsFromDrive(
  token: string,
  photoFileIds: string[],
): Promise<ImageBitmap[]> {
  const ids = photoFileIds.slice(0, 4);
  const bitmaps: ImageBitmap[] = [];
  for (const id of ids) {
    try {
      const blob = await downloadAppDataFileBlob(token, id);
      bitmaps.push(await createImageBitmap(blob));
    } catch {
      /* skip missing photos */
    }
  }
  return bitmaps;
}

export async function buildComboCollagePreparedPhoto(
  photoFileIds: readonly string[],
): Promise<PreparedMealPhoto | null> {
  if (photoFileIds.length === 0) return null;
  const token = await ensureGoogleAccessToken();
  if (!token) return null;

  const bitmaps = await loadBitmapsFromDrive(token, [...photoFileIds]);
  if (bitmaps.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = COLLAGE_EDGE_PX;
  canvas.height = COLLAGE_EDGE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawCollage(ctx, COLLAGE_EDGE_PX, bitmaps);
  for (const bitmap of bitmaps) bitmap.close();

  const blob = await canvasToJpegBlob(canvas, 0.82);
  return blobToBase64Payload(blob);
}

export async function resolveComboLogPhotoOptions(
  combo: SavedComboRecord,
  allItems: readonly SavedQuickAdd[],
): Promise<
  | { photoFileId: string }
  | { preparedPhoto: PreparedMealPhoto }
  | undefined
> {
  if (combo.photoFileId) {
    return { photoFileId: combo.photoFileId };
  }

  const photoFileIds = comboItemPhotoFileIds(combo, allItems);
  if (photoFileIds.length === 0) return undefined;
  if (photoFileIds.length === 1) {
    return { photoFileId: photoFileIds[0] };
  }

  const preparedPhoto = await buildComboCollagePreparedPhoto(photoFileIds);
  return preparedPhoto ? { preparedPhoto } : undefined;
}

/** Visual shell applied to every combo thumbnail (size comes from `className`). */
export const COMBO_THUMB_SHELL =
  "overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 shrink-0";

export const COMBO_ROW_PHOTO_CLASS = `${COMBO_THUMB_SHELL} size-14`;

export function comboThumbClassName(className = COMBO_ROW_PHOTO_CLASS): string {
  if (className.includes("overflow-hidden") && className.includes("rounded-xl")) {
    return className;
  }
  return `${COMBO_THUMB_SHELL} ${className}`.trim();
}
