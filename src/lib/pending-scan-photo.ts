const PENDING_SCAN_PHOTO_KEY = "openmacro:pending_scan_photo:v1";
const PENDING_SCAN_MAX_AGE_MS = 5 * 60 * 1000;

export type PendingScanPhoto = {
  base64: string;
  mimeType: string;
  createdAt: number;
};

export function enqueuePendingScanPhoto(photo: {
  base64: string;
  mimeType: string;
}): void {
  const payload: PendingScanPhoto = {
    base64: photo.base64,
    mimeType: photo.mimeType || "image/jpeg",
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(PENDING_SCAN_PHOTO_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage write failures */
  }
}

export function consumePendingScanPhoto(): {
  base64: string;
  mimeType: string;
} | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SCAN_PHOTO_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_SCAN_PHOTO_KEY);
    const parsed = JSON.parse(raw) as Partial<PendingScanPhoto>;
    if (
      !parsed ||
      typeof parsed.base64 !== "string" ||
      typeof parsed.mimeType !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.createdAt > PENDING_SCAN_MAX_AGE_MS) {
      return null;
    }
    return { base64: parsed.base64, mimeType: parsed.mimeType };
  } catch {
    return null;
  }
}
