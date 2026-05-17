import { DRIVE_QUERY_STALE_TIME_MS } from "@/lib/drive-query-cache";
import {
  canSyncToDriveAppData,
  ensureGoogleAccessToken,
  getGoogleUserId,
} from "@/lib/gapi";
import {
  addProgressPhotoToDrive,
  deleteProgressPhotoFromDrive,
  downloadAppDataFileBlob,
  syncProgressPhotosManifestFromDrive,
} from "@/lib/google-drive";
import type {
  ProgressPhotoDriveMeta,
  ProgressPhotoItem,
  ProgressPhotoRecord,
} from "@/types/progress-photos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** Matches Tailwind `md` — viewport at or below this uses smaller batches (phones). */
const MOBILE_MAX_WIDTH_PX = 767;
const BATCH_SIZE_DESKTOP = 12;
const BATCH_SIZE_MOBILE = 4;

export function useProgressPhotosBatchSize(): number {
  const query = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      window.matchMedia(query).matches ? BATCH_SIZE_MOBILE : BATCH_SIZE_DESKTOP,
    () => BATCH_SIZE_DESKTOP,
  );
}

function pickNextBatch(
  meta: ProgressPhotoDriveMeta[],
  loaded: Record<string, Blob | undefined>,
  skipped: ReadonlySet<string>,
  max: number,
): ProgressPhotoDriveMeta[] {
  const out: ProgressPhotoDriveMeta[] = [];
  for (const m of meta) {
    if (out.length >= max) break;
    if (!loaded[m.id] && !skipped.has(m.id)) out.push(m);
  }
  return out;
}

export type UseProgressPhotosOptions = {
  /** Load this photo first when opening the viewer before lazy batches catch up. */
  prefetchPhotoId?: string | null;
  /** Keep requesting batches until every blob is loaded or skipped (e.g. slideshow has no horizontal strip). */
  continuousBlobFetch?: boolean;
  /**
   * Horizontal strip: only fetch thumbnails for the first N manifest rows.
   * Omit or pass `undefined` when loading the full library (slideshow).
   */
  displayLimit?: number;
};

export function useProgressPhotos(options: UseProgressPhotosOptions = {}) {
  const { prefetchPhotoId, continuousBlobFetch, displayLimit } = options;
  const qc = useQueryClient();
  const userId = getGoogleUserId() ?? "";
  const batchSize = useProgressPhotosBatchSize();

  const manifestQuery = useQuery({
    queryKey: ["progress-photos", userId],
    enabled: !!userId && canSyncToDriveAppData(),
    staleTime: DRIVE_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return syncProgressPhotosManifestFromDrive(token, signal);
    },
  });

  const meta = manifestQuery.data?.photos ?? [];
  const metaIdsKey = useMemo(() => meta.map((m) => m.id).join("\0"), [meta]);

  /** Rows we may fetch for the strip (paged) or full meta for slideshow. */
  const scopedMeta = useMemo(() => {
    if (continuousBlobFetch) return meta;
    const lim =
      displayLimit === undefined
        ? meta.length
        : Math.min(displayLimit, meta.length);
    return meta.slice(0, Math.max(0, lim));
  }, [meta, continuousBlobFetch, displayLimit]);

  const [blobById, setBlobById] = useState<Record<string, Blob>>({});
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());

  const blobByIdRef = useRef(blobById);
  blobByIdRef.current = blobById;

  const skippedIdsRef = useRef(skippedIds);
  skippedIdsRef.current = skippedIds;

  const fetchBatch = useCallback(
    async (batch: ProgressPhotoDriveMeta[], signal: AbortSignal) => {
      if (batch.length === 0) return;
      const token = await ensureGoogleAccessToken();
      if (!token) return;
      const updates: Record<string, Blob> = {};
      const failed: string[] = [];
      try {
        await Promise.all(
          batch.map(async (row) => {
            if (signal.aborted) return;
            try {
              const blob = await downloadAppDataFileBlob(
                token,
                row.driveFileId,
                signal,
              );
              if (signal.aborted) return;
              if (blob?.size) updates[row.id] = blob;
              else failed.push(row.id);
            } catch {
              failed.push(row.id);
            }
          }),
        );
        if (failed.length > 0) {
          setSkippedIds((prev) => {
            const next = new Set(prev);
            for (const id of failed) next.add(id);
            return next;
          });
        }
        if (!signal.aborted && Object.keys(updates).length > 0) {
          setBlobById((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        /* aborted */
      }
    },
    [],
  );

  useEffect(() => {
    if (!manifestQuery.isSuccess || !manifestQuery.data) return;
    const rows = manifestQuery.data.photos;
    const allowed = new Set(rows.map((m) => m.id));
    setBlobById((prev) => {
      const next: Record<string, Blob> = {};
      for (const [id, blob] of Object.entries(prev)) {
        if (allowed.has(id)) next[id] = blob;
      }
      return next;
    });
    setSkippedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
      }
      return next;
    });
  }, [metaIdsKey, manifestQuery.isSuccess]);

  const loadMoreBlobs = useCallback(async (): Promise<boolean> => {
    const batch = pickNextBatch(
      scopedMeta,
      blobByIdRef.current,
      skippedIdsRef.current,
      batchSize,
    );
    if (batch.length === 0) return false;
    const ac = new AbortController();
    await fetchBatch(batch, ac.signal);
    return true;
  }, [scopedMeta, fetchBatch, batchSize]);

  useEffect(() => {
    if (!prefetchPhotoId || !manifestQuery.isSuccess) return;
    const rows = manifestQuery.data?.photos ?? [];
    const row = rows.find((m) => m.id === prefetchPhotoId);
    if (
      !row ||
      blobByIdRef.current[prefetchPhotoId] ||
      skippedIdsRef.current.has(prefetchPhotoId)
    )
      return;
    const ac = new AbortController();
    void fetchBatch([row], ac.signal);
    return () => ac.abort();
  }, [prefetchPhotoId, metaIdsKey, manifestQuery.isSuccess, fetchBatch]);

  /** Strip: keep fetching until the visible window is hydrated. */
  useEffect(() => {
    if (continuousBlobFetch) return;
    const done =
      scopedMeta.length === 0 ||
      scopedMeta.every((m) => Boolean(blobById[m.id]) || skippedIds.has(m.id));
    if (done) return;
    void loadMoreBlobs();
  }, [
    continuousBlobFetch,
    scopedMeta,
    blobById,
    skippedIds,
    loadMoreBlobs,
    displayLimit,
    metaIdsKey,
  ]);

  /** Slideshow: keep downloading until the full library is local. */
  useEffect(() => {
    if (!continuousBlobFetch) return;
    const done =
      meta.length === 0 ||
      meta.every((m) => Boolean(blobById[m.id]) || skippedIds.has(m.id));
    if (done) return;
    void loadMoreBlobs();
  }, [continuousBlobFetch, meta, blobById, skippedIds, loadMoreBlobs]);

  const photos: ProgressPhotoItem[] = useMemo(
    () => meta.map((m) => ({ ...m, blob: blobById[m.id] })),
    [meta, blobById],
  );

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      await deleteProgressPhotoFromDrive(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (record: ProgressPhotoRecord) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      await addProgressPhotoToDrive(token, record);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
  });

  const remove = useCallback(
    async (id: string) => removeMutation.mutateAsync(id),
    [removeMutation],
  );

  const addPhoto = useCallback(
    async (record: ProgressPhotoRecord) => {
      await addMutation.mutateAsync(record);
      setBlobById((prev) => ({ ...prev, [record.id]: record.blob }));
    },
    [addMutation],
  );

  const errorMessage =
    manifestQuery.error instanceof Error
      ? manifestQuery.error.message
      : manifestQuery.error
        ? "Could not load progress photos."
        : null;

  const libraryFullyLoaded =
    meta.length === 0 ||
    meta.every((m) => Boolean(blobById[m.id]) || skippedIds.has(m.id));

  return {
    photos,
    batchSize,
    loading: manifestQuery.isLoading,
    /** Full library (slideshow / counts). */
    allBlobsLoaded: libraryFullyLoaded,
    loadMoreBlobs,
    error: errorMessage,
    remove,
    addPhoto,
    isSavingPhoto: addMutation.isPending,
  };
}
