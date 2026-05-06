import { getAccessToken } from "@/lib/gapi";
import { useEffect, useState } from "react";

const DRIVE_MEDIA = "https://www.googleapis.com/drive/v3/files";
const blobUrlCache = new Map<string, string>();
const inflightFetches = new Map<string, Promise<string | null>>();

async function fetchDrivePhotoBlobUrl(fileId: string): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  const url = `${DRIVE_MEDIA}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobUrlCache.set(fileId, objectUrl);
  return objectUrl;
}

export function useDrivePhotoUrl(fileId: string | undefined) {
  const [loaded, setLoaded] = useState<{ fileId: string; src: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!fileId) return;
    const cached = blobUrlCache.get(fileId);
    if (cached) return;

    let cancelled = false;

    void (async () => {
      try {
        const pending =
          inflightFetches.get(fileId) ?? fetchDrivePhotoBlobUrl(fileId);
        if (!inflightFetches.has(fileId)) {
          inflightFetches.set(fileId, pending);
        }
        const objectUrl = await pending;
        inflightFetches.delete(fileId);
        if (!cancelled) setLoaded({ fileId, src: objectUrl });
      } catch {
        inflightFetches.delete(fileId);
        if (!cancelled) setLoaded({ fileId, src: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!fileId) return null;
  return blobUrlCache.get(fileId) ?? (loaded?.fileId === fileId ? loaded.src : null);
}
