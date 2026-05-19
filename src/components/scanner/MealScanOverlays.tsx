import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type MealScanOverlaysProps = {
  analyzing: boolean;
  /** Primary line under spinner (defaults to neutral meal-estimate copy). */
  title?: string;
  /** Supporting line beneath the title. */
  subtitle?: string;
};

/** Full-screen analyzing blocker (shared Dashboard / Scanner / Describe). */
export function MealScanOverlays({
  analyzing,
  title,
  subtitle,
}: MealScanOverlaysProps) {
  const { t } = useTranslation();
  const displayTitle = title ?? t("addMeal.estimatingTitle");
  const displaySubtitle = subtitle ?? t("addMeal.estimatingSubtitle");
  if (!analyzing) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={displayTitle}
    >
      <Loader2 className="size-12 animate-spin text-emerald-400" />
      <p className="text-center text-sm font-medium text-zinc-100">
        {displayTitle}
      </p>
      <p className="max-w-sm text-center text-sm text-zinc-400">
        {displaySubtitle}
      </p>
    </div>,
    document.body,
  );
}
