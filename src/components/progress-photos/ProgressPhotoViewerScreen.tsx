import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import type { ProgressPhotoRecord } from "@/types/progress-photos";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ProgressPhotoViewerScreen({
  photos,
  index,
  onDismiss,
  onIndexChange,
  onDelete,
}: {
  photos: ProgressPhotoRecord[];
  index: number;
  onDismiss: () => void;
  onIndexChange: (next: number) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const record = photos[index] ?? null;

  const url = useBlobObjectUrl(record?.blob);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
      if (e.key === "ArrowRight" && photos.length > 0)
        onIndexChange((index + 1) % photos.length);
      if (e.key === "ArrowLeft" && photos.length > 0)
        onIndexChange((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onDismiss, onIndexChange]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const goPrev = useCallback(() => {
    if (photos.length === 0) return;
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (photos.length === 0) return;
    onIndexChange((index + 1) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const onConfirmDelete = useCallback(() => {
    if (!record || busy) return;
    if (
      !confirm(
        "Delete this progress photo from this device? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    void (async () => {
      try {
        await onDelete(record.id);
      } finally {
        setBusy(false);
      }
    })();
  }, [record, busy, onDelete]);

  if (photos.length === 0 || !record) return null;

  const dateLabel = new Date(record.capturedAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return createPortal(
    <div className="fixed inset-0 z-[92] flex flex-col bg-black pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          aria-label="Back"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">
            Progress photo
          </h2>
          <p className="truncate text-[11px] text-zinc-500">{dateLabel}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirmDelete}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-900/80 text-red-400 hover:bg-red-950/40 disabled:opacity-50"
          aria-label="Delete photo"
        >
          <Trash2 className="size-5" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pb-[env(safe-area-inset-bottom)]">
        {url ? (
          <img
            src={url}
            alt={`Progress photo from ${dateLabel}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : null}

        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-black/50 text-white backdrop-blur hover:bg-black/70 md:left-6"
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-7" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 rotate-180 items-center justify-center rounded-full border border-zinc-700 bg-black/50 text-white backdrop-blur hover:bg-black/70 md:right-6"
              aria-label="Next photo"
            >
              <ChevronLeft className="size-7" />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-zinc-300 backdrop-blur-sm">
          <span className="tabular-nums">
            {index + 1} / {photos.length}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
