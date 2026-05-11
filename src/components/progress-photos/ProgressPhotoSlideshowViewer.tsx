import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import type {
  ProgressPhotoItem,
  ProgressPhotoRecord,
} from "@/types/progress-photos";
import { ChevronLeft, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export function ProgressPhotoSlideshowViewer({
  photos,
  onClose,
}: {
  photos: ProgressPhotoItem[];
  onClose: () => void;
}) {
  const sorted = useMemo(() => {
    const ready: ProgressPhotoRecord[] = [];
    for (const p of photos) {
      if (!p.blob) continue;
      ready.push({
        id: p.id,
        capturedAt: p.capturedAt,
        blob: p.blob,
      });
    }
    return ready.sort((a, b) => a.capturedAt - b.capturedAt);
  }, [photos]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(500);

  const displayIndex =
    sorted.length === 0 ? 0 : Math.min(index, sorted.length - 1);
  const slide = sorted[displayIndex];

  const url = useBlobObjectUrl(slide?.blob);

  useEffect(() => {
    if (!playing || sorted.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % sorted.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [playing, sorted.length, intervalMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && sorted.length > 0)
        setIndex((i) => (i + 1) % sorted.length);
      if (e.key === "ArrowLeft" && sorted.length > 0)
        setIndex((i) => (i - 1 + sorted.length) % sorted.length);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted.length, onClose]);

  const label = useMemo(() => {
    if (!slide) return "";
    return new Date(slide.capturedAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [slide]);

  const goPrev = useCallback(() => {
    if (sorted.length === 0) return;
    setIndex((i) => (i - 1 + sorted.length) % sorted.length);
  }, [sorted.length]);

  const goNext = useCallback(() => {
    if (sorted.length === 0) return;
    setIndex((i) => (i + 1) % sorted.length);
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center pb-4">
        {url ? (
          <img
            src={url}
            alt={`Progress photo ${displayIndex + 1} of ${sorted.length}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : null}

        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm text-zinc-300 backdrop-blur-sm">
          <span className="tabular-nums">
            {displayIndex + 1} / {sorted.length}
          </span>
        </div>

        {sorted.length > 1 ? (
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
      </div>

      <div className="shrink-0 px-4 pb-3 text-center">
        <p className="truncate text-sm text-zinc-500">{label}</p>
      </div>

      <footer className="shrink-0 space-y-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={sorted.length < 2}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? (
              <>
                <Pause className="size-4" /> Pause
              </>
            ) : (
              <>
                <Play className="size-4" /> Play
              </>
            )}
          </button>
        </div>

        <div className="mx-auto flex max-w-md flex-col gap-2">
          <label className="flex items-center justify-between text-sm text-zinc-500">
            <span>Slide interval</span>
            <span className="tabular-nums text-zinc-400">{intervalMs} ms</span>
          </label>
          <input
            type="range"
            min={50}
            max={3000}
            step={50}
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className="w-full accent-emerald-400"
          />
        </div>
      </footer>
    </div>
  );
}
