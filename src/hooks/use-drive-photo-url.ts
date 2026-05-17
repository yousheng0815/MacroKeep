import { ensureGoogleAccessToken } from "@/lib/gapi";
import { downloadAppDataFileBlob } from "@/lib/google-drive";
import {
  expiresAtMsForPolicy,
  mealPhotoCacheTierFromPolicy,
  shouldPersistMealPhoto,
  type MealPhotoCachePolicy,
} from "@/lib/meal-photo-cache";
import {
  getMealPhotoFromCache,
  putMealPhotoInCache,
  removeMealPhotoFromCache,
  sweepExpiredMealPhotosFromCache,
} from "@/lib/meal-photo-cache-db";
import {
  getMealPhotoBlobUrl,
  mealPhotoInflightFetches,
  rememberMealPhotoBlobUrl,
} from "@/lib/meal-photo-cache-memory";
import { useEffect, useState } from "react";

export { clearMealPhotoCache } from "@/lib/meal-photo-cache-memory";
export { removeMealPhotoFromCache };

let sweepScheduled = false;

function scheduleMealPhotoCacheSweep(): void {
  if (sweepScheduled) return;
  sweepScheduled = true;
  void sweepExpiredMealPhotosFromCache().finally(() => {
    sweepScheduled = false;
  });
}

async function fetchDrivePhotoBlobUrl(
  fileId: string,
  cachePolicy: MealPhotoCachePolicy | undefined,
): Promise<string | null> {
  scheduleMealPhotoCacheSweep();

  const cachedUrl = getMealPhotoBlobUrl(fileId);
  if (cachedUrl) return cachedUrl;

  try {
    const disk = await getMealPhotoFromCache(fileId);
    if (disk) return rememberMealPhotoBlobUrl(fileId, disk.blob);
  } catch {
    /* fall through to Drive */
  }

  const token = await ensureGoogleAccessToken();
  if (!token) return null;

  try {
    const blob = await downloadAppDataFileBlob(token, fileId);

    if (shouldPersistMealPhoto(cachePolicy)) {
      const tier = mealPhotoCacheTierFromPolicy(cachePolicy);
      void putMealPhotoInCache({
        fileId,
        tier,
        expiresAtMs: expiresAtMsForPolicy(cachePolicy),
        blob,
      }).catch(() => {
        /* quota or IDB errors — still show image */
      });
    }

    return rememberMealPhotoBlobUrl(fileId, blob);
  } catch {
    return null;
  }
}

export function useDrivePhotoUrl(
  fileId: string | undefined,
  cachePolicy?: MealPhotoCachePolicy,
) {
  const [loaded, setLoaded] = useState<{ fileId: string; src: string | null } | null>(
    null,
  );

  const policyKey =
    cachePolicy === undefined
      ? ""
      : cachePolicy.tier === "saved"
        ? "saved"
        : `log:${cachePolicy.recordedAt}`;

  useEffect(() => {
    if (!fileId) return;
    if (getMealPhotoBlobUrl(fileId)) return;

    let cancelled = false;

    void (async () => {
      try {
        const pending =
          mealPhotoInflightFetches.get(fileId) ??
          fetchDrivePhotoBlobUrl(fileId, cachePolicy);
        if (!mealPhotoInflightFetches.has(fileId)) {
          mealPhotoInflightFetches.set(fileId, pending);
        }
        const objectUrl = await pending;
        mealPhotoInflightFetches.delete(fileId);
        if (!cancelled) setLoaded({ fileId, src: objectUrl });
      } catch {
        mealPhotoInflightFetches.delete(fileId);
        if (!cancelled) setLoaded({ fileId, src: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, policyKey]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleMealPhotoCacheSweep();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!fileId) return null;
  return (
    getMealPhotoBlobUrl(fileId) ??
    (loaded?.fileId === fileId ? loaded.src : null)
  );
}
