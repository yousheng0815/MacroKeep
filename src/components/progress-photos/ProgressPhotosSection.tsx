import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { ProgressPhotoCaptureScreen } from "@/components/progress-photos/ProgressPhotoCaptureScreen";
import { ProgressPhotoViewerScreen } from "@/components/progress-photos/ProgressPhotoViewerScreen";
import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import { useProgressPhotos } from "@/hooks/use-progress-photos";
import type { ProgressPhotoRecord } from "@/types/progress-photos";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Camera, ChevronLeft, Play } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";

function overlayFromSearch(search: Record<string, unknown>) {
  return {
    capture: search.capture === "1",
    view: typeof search.view === "string" ? search.view : undefined,
  };
}

function ProgressPhotoThumb({
  photo,
  alt,
}: {
  photo: ProgressPhotoRecord;
  alt: string;
}) {
  const url = useBlobObjectUrl(photo.blob);

  return (
    <Link
      to="/progress"
      search={{ view: photo.id }}
      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-zinc-700 transition hover:ring-emerald-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          className="size-full max-h-full max-w-full object-cover"
        />
      ) : (
        <span className="block size-full bg-zinc-800" aria-hidden />
      )}
    </Link>
  );
}

function ViewerFallbackChrome({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
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
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {title}
        </h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </div>
  );
}

export function ProgressPhotosSection({
  className = "",
}: {
  className?: string;
}) {
  const navigate = useNavigate();
  const searchRecord = useRouterState({ select: (s) => s.location.search });
  const { capture, view } = useMemo(
    () => overlayFromSearch(searchRecord),
    [searchRecord],
  );

  const dismissOverlay = useCallback(() => {
    window.history.back();
  }, []);

  const { photos, loading, error, remove, addPhoto } = useProgressPhotos();

  const viewIndex = useMemo(
    () => (view ? photos.findIndex((p) => p.id === view) : -1),
    [photos, view],
  );

  const handleViewerDelete = useCallback(
    async (id: string) => {
      const idx = photos.findIndex((p) => p.id === id);
      const remaining = photos.filter((p) => p.id !== id);
      await remove(id);
      if (remaining.length === 0) {
        void navigate({
          to: "/progress",
          search: {},
          replace: true,
        });
        return;
      }
      const nextId =
        idx >= remaining.length
          ? remaining[remaining.length - 1].id
          : remaining[idx].id;
      void navigate({
        to: "/progress",
        search: { view: nextId },
        replace: true,
      });
    },
    [photos, remove, navigate],
  );

  const showViewerShell = Boolean(view) && !capture;
  const viewerReady = showViewerShell && viewIndex >= 0 && !error;

  return (
    <>
      <Card className={`max-w-full min-w-0 overflow-hidden ${className}`}>
        <h2 className="text-sm font-semibold text-white">
          Body progress photos
        </h2>
        <p className="mt-1 text-xs text-om-muted">
          Capture photos of your body progress.
        </p>

        <div className="mt-4">
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-om-muted">
              <ButtonSpinner />
              Loading photos…
            </div>
          ) : photos.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No photos yet — capture your first check-in.
            </p>
          ) : (
            <div className="min-h-0 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <div className="flex w-max flex-nowrap gap-2 py-2">
                {photos.map((p, i) => (
                  <ProgressPhotoThumb
                    key={p.id}
                    photo={p}
                    alt={`Progress photo ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-om-border pt-4">
          <Link
            to="/progress"
            search={{ capture: "1" }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 sm:flex-none"
          >
            <Camera className="size-5" />
            Add photo
          </Link>
          {photos.length < 2 ? (
            <span
              className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-om-border px-4 py-3 text-sm font-semibold text-white opacity-40 sm:flex-none"
              aria-disabled
            >
              <Play className="size-5 text-emerald-400" />
              Play back
            </span>
          ) : (
            <Link
              to="/progress/photos/slideshow"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-om-border px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900 sm:flex-none"
            >
              <Play className="size-5 text-emerald-400" />
              Play back
            </Link>
          )}
        </div>
      </Card>

      {capture ? (
        <ProgressPhotoCaptureScreen
          photosForGhost={photos}
          savePhoto={addPhoto}
          onDismiss={dismissOverlay}
        />
      ) : null}

      {showViewerShell && loading && photos.length === 0 ? (
        <div className="fixed inset-0 z-[92] flex flex-col items-center justify-center gap-3 bg-black pt-[env(safe-area-inset-top)] text-zinc-400">
          <ButtonSpinner />
          <p className="text-sm">Loading photo…</p>
        </div>
      ) : null}

      {showViewerShell && error ? (
        <ViewerFallbackChrome title="Progress photo" onDismiss={dismissOverlay}>
          <p className="max-w-sm text-center text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={dismissOverlay}
            className="mt-6 text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Go back
          </button>
        </ViewerFallbackChrome>
      ) : null}

      {showViewerShell && !loading && !error && view && viewIndex < 0 ? (
        <ViewerFallbackChrome title="Progress photo" onDismiss={dismissOverlay}>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            This photo was not found. It may have been removed or the link is
            outdated.
          </p>
          <button
            type="button"
            onClick={dismissOverlay}
            className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Go back
          </button>
        </ViewerFallbackChrome>
      ) : null}

      {viewerReady ? (
        <ProgressPhotoViewerScreen
          photos={photos}
          index={viewIndex}
          onDismiss={dismissOverlay}
          onIndexChange={(next) => {
            const id = photos[next]?.id;
            if (id) {
              void navigate({
                to: "/progress",
                search: { view: id },
                replace: true,
              });
            }
          }}
          onDelete={handleViewerDelete}
        />
      ) : null}
    </>
  );
}
