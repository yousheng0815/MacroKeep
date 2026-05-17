import { clearMealPhotoCacheDb } from "@/lib/meal-photo-cache-db";

const blobUrlCache = new Map<string, string>();
export const mealPhotoInflightFetches = new Map<string, Promise<string | null>>();

export function getMealPhotoBlobUrl(fileId: string): string | undefined {
  return blobUrlCache.get(fileId);
}

export function rememberMealPhotoBlobUrl(fileId: string, blob: Blob): string {
  const existing = blobUrlCache.get(fileId);
  if (existing) return existing;
  const objectUrl = URL.createObjectURL(blob);
  blobUrlCache.set(fileId, objectUrl);
  return objectUrl;
}

function revokeBlobUrl(fileId: string): void {
  const url = blobUrlCache.get(fileId);
  if (url) URL.revokeObjectURL(url);
  blobUrlCache.delete(fileId);
}

/** Clears disk + in-memory meal photo URLs (e.g. on sign-out). */
export async function clearMealPhotoCache(): Promise<void> {
  for (const fileId of blobUrlCache.keys()) {
    revokeBlobUrl(fileId);
  }
  mealPhotoInflightFetches.clear();
  try {
    await clearMealPhotoCacheDb();
  } catch {
    /* ignore */
  }
}
