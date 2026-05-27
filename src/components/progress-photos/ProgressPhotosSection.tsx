import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { ProgressPhotoCaptureScreen } from "@/components/progress-photos/ProgressPhotoCaptureScreen";
import { ProgressPhotoViewerScreen } from "@/components/progress-photos/ProgressPhotoViewerScreen";
import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import {
  useProgressPhotos,
  useProgressPhotosBatchSize,
} from "@/hooks/use-progress-photos";
import { paths } from "@/lib/routes";
import {
  progressPhotoCaptureRoute,
  progressPhotoRoute,
} from "@/router";
import type { ProgressPhotoItem } from "@/types/progress-photos";
import { Link, useMatch, useNavigate, useRouter } from "@tanstack/react-router";
import { Camera, ChevronLeft, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "@/lib/app-toast";
import { useTranslation } from "react-i18next";

function ProgressPhotoThumb({
  photo,
  alt,
}: {
  photo: ProgressPhotoItem;
  alt: string;
}) {
  const url = useBlobObjectUrl(photo.blob);

  return (
    <Link
      to={paths.progress.photo}
      params={{ photoId: photo.id }}
      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-700 transition hover:border-emerald-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          className="size-full max-h-full max-w-full object-cover"
        />
      ) : (
        <span
          className="block size-full animate-pulse bg-zinc-800"
          aria-hidden
        />
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
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[92] flex flex-col bg-black pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          aria-label={t("common.back")}
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const capture = !!useMatch({
    from: progressPhotoCaptureRoute.id,
    shouldThrow: false,
  });
  const photoMatch = useMatch({
    from: progressPhotoRoute.id,
    shouldThrow: false,
  });
  const view = photoMatch?.params.photoId;

  const dismissOverlay = useCallback(() => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void navigate({ to: paths.progress.root });
  }, [navigate, router.history]);

  const batchSize = useProgressPhotosBatchSize();
  const [stripVisibleCount, setStripVisibleCount] = useState(batchSize);

  const { photos, loading, error, remove, addPhoto } = useProgressPhotos({
    prefetchPhotoId: view,
    displayLimit: stripVisibleCount,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const photoIdsKey = useMemo(
    () => photos.map((p) => p.id).join("\0"),
    [photos],
  );

  /** Reset paging when the manifest identity changes. */
  useEffect(() => {
    if (photos.length === 0) {
      setStripVisibleCount(0);
      return;
    }
    setStripVisibleCount(Math.min(batchSize, photos.length));
  }, [photoIdsKey, batchSize, photos.length]);

  const stripPhotos = useMemo(
    () => photos.slice(0, stripVisibleCount),
    [photos, stripVisibleCount],
  );

  const stripScrollRef = useRef<HTMLDivElement>(null);
  const photosLenRef = useRef(photos.length);
  photosLenRef.current = photos.length;
  const batchSzRef = useRef(batchSize);
  batchSzRef.current = batchSize;
  const stripCountRef = useRef(stripVisibleCount);
  stripCountRef.current = stripVisibleCount;
  /** After scrolling back from the end, allow another “near end” expansion. */
  const stripAwayFromEndRef = useRef(true);

  useEffect(() => {
    stripAwayFromEndRef.current = true;
  }, [photoIdsKey]);

  /**
   * Ultrawide / tall layouts: if rendered thumbs fit without horizontal scrolling,
   * `scroll` never reaches “near end”. Grow one page at a time until the strip
   * overflows or the catalog is fully shown.
   */
  const growStripWhenNothingToScroll = useCallback(() => {
    setStripVisibleCount((c) => {
      const node = stripScrollRef.current;
      if (!node) return c;
      const len = photosLenRef.current;
      const bs = batchSzRef.current;
      if (c >= len) return c;
      if (node.scrollWidth > node.clientWidth + 8) return c;
      return Math.min(len, c + bs);
    });
  }, []);

  useLayoutEffect(() => {
    if (photos.length === 0 || loading) return;
    growStripWhenNothingToScroll();
  }, [
    stripVisibleCount,
    stripPhotos.length,
    photoIdsKey,
    photos.length,
    loading,
    growStripWhenNothingToScroll,
  ]);

  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el || photos.length === 0) return;

    growStripWhenNothingToScroll();
    const ro = new ResizeObserver(() => {
      growStripWhenNothingToScroll();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [photoIdsKey, photos.length, growStripWhenNothingToScroll]);

  /**
   * Append the next page when the user scrolls near the right edge (not on mount).
   * Uses a crossing gate so layout growth while still “at the end” does not chain-expand.
   */
  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el) return;

    const NEAR_END_PX = 140;

    const onScroll = () => {
      const len = photosLenRef.current;
      const count = stripCountRef.current;
      if (count >= len) return;

      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = Math.max(0, scrollWidth - clientWidth);
      const nearEnd = maxScroll > 0 && scrollLeft >= maxScroll - NEAR_END_PX;

      if (nearEnd && stripAwayFromEndRef.current) {
        stripAwayFromEndRef.current = false;
        const bs = batchSzRef.current;
        setStripVisibleCount((c) => Math.min(len, c + bs));
      } else if (!nearEnd) {
        stripAwayFromEndRef.current = true;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [photoIdsKey]);

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
          to: paths.progress.root,
          replace: true,
        });
        return;
      }
      const nextId =
        idx >= remaining.length
          ? remaining[remaining.length - 1].id
          : remaining[idx].id;
      void navigate({
        to: paths.progress.photo,
        params: { photoId: nextId },
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
          {t("progress.bodyProgressPhotos")}
        </h2>
        <p className="mt-1 text-sm text-mk-muted">
          {t("progress.bodyProgressBlurb")}
        </p>

        <div className="mt-4">
          {error ? (
            <p className="text-sm text-mk-muted">
              Couldn&apos;t load progress photos. Try again later.
            </p>
          ) : (
            <div className="min-h-28">
              {loading ? (
                <div className="min-h-0 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
                  <div
                    className="flex w-max flex-nowrap items-center gap-2 py-2"
                    aria-busy="true"
                    aria-label={t("common.loadingPhotos")}
                  >
                    {Array.from({ length: batchSize }).map((_, i) => (
                      <div
                        key={`photo-placeholder-${i}`}
                        className="h-24 w-24 shrink-0 animate-pulse rounded-xl border border-zinc-700 bg-zinc-700"
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
              ) : photos.length === 0 ? (
                <div className="flex min-h-28 items-center">
                  <p className="text-sm text-zinc-400">
                    {t("progress.noPhotosYet")}
                  </p>
                </div>
              ) : (
                <div
                  ref={stripScrollRef}
                  className="min-h-0 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
                >
                  <div className="flex w-max flex-nowrap items-center gap-2 py-2">
                    {stripPhotos.map((p, i) => (
                      <ProgressPhotoThumb
                        key={p.id}
                        photo={p}
                        alt={t("progress.progressPhotoN", { n: i + 1 })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="btn-pair-row mt-4 border-t border-mk-border pt-4">
          <Link
            to={paths.progress.capture}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            <Camera className="size-5" />
            {t("progress.addPhoto")}
          </Link>
          {photos.length < 2 ? (
            <span
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-white opacity-40"
              aria-disabled
            >
              <Play className="size-5 text-emerald-400" />
              {t("progress.playBack")}
            </span>
          ) : (
            <Link
              to={paths.progress.slideshow}
              className="flex items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
            >
              <Play className="size-5 text-emerald-400" />
              {t("progress.playBack")}
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
          <p className="text-sm">{t("progress.loadingPhoto")}</p>
        </div>
      ) : null}

      {showViewerShell && error ? (
        <ViewerFallbackChrome title={t("progress.progressPhoto")} onDismiss={dismissOverlay}>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            Couldn&apos;t open this photo. Check the notification for details.
          </p>
          <button
            type="button"
            onClick={dismissOverlay}
            className="mt-6 text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            {t("common.goBack")}
          </button>
        </ViewerFallbackChrome>
      ) : null}

      {showViewerShell && !loading && !error && view && viewIndex < 0 ? (
        <ViewerFallbackChrome title={t("progress.progressPhoto")} onDismiss={dismissOverlay}>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            {t("progress.photoNotFound")}
          </p>
          <button
            type="button"
            onClick={dismissOverlay}
            className="mt-6 btn-mobile-block-lg rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            {t("common.goBack")}
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
                to: paths.progress.photo,
                params: { photoId: id },
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
