import { MealPhotoViewerScreen } from "@/components/MealPhotoViewerScreen";
import { useDrivePhotoUrl } from "@/hooks/use-drive-photo-url";
import { useHistoryOverlay } from "@/hooks/use-history-overlay";
import type { MealPhotoCachePolicy } from "@/lib/meal-photo-cache";
import type { MealPhotoViewerState } from "@/lib/routes";
import { paths } from "@/lib/routes";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ImagePlus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

type MealPhotoThumbProps = {
  photoFileId?: string;
  /** Local object URL (add/edit flows before Drive upload). Full-screen overlay, same URL. */
  previewSrc?: string;
  alt: string;
  /** Wrapper box (layout + clipping); inner `<img>` uses `size-full object-cover`. */
  className?: string;
  /**
   * `saved`: persist all saved-meal images until sign-out.
   * `log` + `recordedAt`: persist logged meals from today/yesterday (local).
   */
  cachePolicy?: MealPhotoCachePolicy;
  /** When true, tap opens the full-screen viewer. Off for list rows. */
  enlargeOnClick?: boolean;
};

export function MealPhotoThumb({
  photoFileId,
  previewSrc,
  alt,
  className = "size-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800",
  cachePolicy,
  enlargeOnClick = false,
}: MealPhotoThumbProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const returnTo = useRouterState({ select: (s) => s.location.pathname });
  const driveSrc = useDrivePhotoUrl(photoFileId, cachePolicy);
  const src = previewSrc ?? driveSrc;

  const [localViewerOpen, setLocalViewerOpen] = useState(false);
  const closeLocalViewer = useCallback(() => setLocalViewerOpen(false), []);
  const dismissLocalViewer = useHistoryOverlay(localViewerOpen, closeLocalViewer);

  const canEnlargeDrive = enlargeOnClick && !!photoFileId && !!driveSrc && !previewSrc;
  const canEnlargeLocal = enlargeOnClick && !!previewSrc;

  const openDriveViewer = useCallback(() => {
    if (!photoFileId) return;
    const mealPhoto: MealPhotoViewerState = {
      alt,
      cachePolicy,
      returnTo,
    };
    void router.navigate({
      to: paths.mealPhoto,
      params: { photoFileId },
      state: { mealPhoto },
    });
  }, [alt, cachePolicy, photoFileId, returnTo, router]);

  const enlargeClassName = `block cursor-zoom-in transition hover:ring-2 hover:ring-emerald-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${className}`;

  if (!photoFileId && !previewSrc) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        {...(alt
          ? { role: "img" as const, "aria-label": alt }
          : { "aria-hidden": true as const })}
      >
        <ImagePlus
          className="aspect-square w-[42%] max-w-10 min-w-3 shrink-0 text-zinc-600"
          aria-hidden
        />
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse ${className}`} aria-hidden />;
  }

  const image = (
    <img
      src={src}
      alt={alt}
      className="size-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );

  if (canEnlargeLocal) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLocalViewerOpen(true)}
          className={enlargeClassName}
          aria-label={t("common.viewMealPhoto")}
        >
          {image}
        </button>
        {localViewerOpen ? (
          <MealPhotoViewerScreen
            src={previewSrc}
            alt={alt}
            onDismiss={dismissLocalViewer}
          />
        ) : null}
      </>
    );
  }

  if (canEnlargeDrive) {
    return (
      <button
        type="button"
        onClick={openDriveViewer}
        className={enlargeClassName}
        aria-label={t("common.viewMealPhoto")}
      >
        {image}
      </button>
    );
  }

  return <div className={className}>{image}</div>;
}
