import { useDrivePhotoUrl } from "@/hooks/use-drive-photo-url";
import { ImagePlus } from "lucide-react";

type MealPhotoThumbProps = {
  photoFileId?: string;
  thumbnailFileId?: string;
  alt: string;
  /** Wrapper box (layout + clipping); inner `<img>` uses `size-full object-cover`. */
  className?: string;
};

export function MealPhotoThumb({
  photoFileId,
  thumbnailFileId,
  alt,
  className = "size-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800",
}: MealPhotoThumbProps) {
  const src = useDrivePhotoUrl(thumbnailFileId || photoFileId);

  if (!thumbnailFileId && !photoFileId) {
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

  return (
    <div className={className}>
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
