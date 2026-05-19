import { MealPhotoViewerScreen } from "@/components/MealPhotoViewerScreen";
import { useDrivePhotoUrl } from "@/hooks/use-drive-photo-url";
import type { MealPhotoCachePolicy } from "@/lib/meal-photo-cache";
import { ImagePlus } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

type MealPhotoThumbProps = {
  photoFileId?: string;
  alt: string;
  /** Wrapper box (layout + clipping); inner `<img>` uses `size-full object-cover`. */
  className?: string;
  /**
   * `saved`: persist all saved-meal images until sign-out.
   * `log` + `recordedAt`: persist logged meals from today/yesterday (local).
   */
  cachePolicy?: MealPhotoCachePolicy;
  /** When true (default), tap opens a full-screen viewer. Set false on edit forms if needed. */
  enlargeOnClick?: boolean;
};

export function MealPhotoThumb({
  photoFileId,
  alt,
  className = "size-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800",
  cachePolicy,
  enlargeOnClick = true,
}: MealPhotoThumbProps) {
  const { t } = useTranslation();
  const src = useDrivePhotoUrl(photoFileId, cachePolicy);
  const [viewerOpen, setViewerOpen] = useState(false);

  const canEnlarge = enlargeOnClick && !!photoFileId && !!src;

  const openViewer = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewerOpen(true);
  };

  if (!photoFileId) {
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

  return (
    <>
      {canEnlarge ? (
        <button
          type="button"
          onClick={openViewer}
          className={`block cursor-zoom-in transition hover:ring-2 hover:ring-emerald-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${className}`}
          aria-label={t("common.viewMealPhoto")}
        >
          {image}
        </button>
      ) : (
        <div className={className}>{image}</div>
      )}

      {viewerOpen && photoFileId ? (
        <MealPhotoViewerScreen
          photoFileId={photoFileId}
          alt={alt}
          cachePolicy={cachePolicy}
          onDismiss={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}
