import { ButtonSpinner } from "@/components/ButtonSpinner";
import { useDrivePhotoUrl } from "@/hooks/use-drive-photo-url";
import type { MealPhotoCachePolicy } from "@/lib/meal-photo-cache";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export function MealPhotoViewerScreen({
  photoFileId,
  src: srcOverride,
  alt,
  cachePolicy,
  onDismiss,
}: {
  photoFileId?: string;
  /** When set, shows this URL instead of loading from Drive. */
  src?: string;
  alt: string;
  cachePolicy?: MealPhotoCachePolicy;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const driveSrc = useDrivePhotoUrl(photoFileId, cachePolicy);
  const src = srcOverride ?? driveSrc;
  const loading = !src;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[92] flex flex-col bg-black pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label={alt || t("common.mealPhoto")}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          aria-label={t("common.closePreview")}
        >
          <ChevronLeft className="size-6" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {t("common.mealPhoto")}
        </h2>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pb-[env(safe-area-inset-bottom)]">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <ButtonSpinner />
            <p className="text-sm">{t("common.loadingImage")}</p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
