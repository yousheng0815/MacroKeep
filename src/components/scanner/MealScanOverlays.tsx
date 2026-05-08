import { Loader2 } from "lucide-react";

type MealScanOverlaysProps = {
  analyzing: boolean;
};

/** Full-screen analyzing blocker (shared Dashboard / Scanner). */
export function MealScanOverlays({
  analyzing,
}: MealScanOverlaysProps) {
  return (
    <>
      {analyzing ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label="Analyzing meal photo"
        >
          <Loader2 className="size-12 animate-spin text-emerald-400" />
          <p className="text-center text-base font-medium text-zinc-100">
            AI analyzing…
          </p>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            Stay on this screen — almost done.
          </p>
        </div>
      ) : null}
    </>
  );
}
