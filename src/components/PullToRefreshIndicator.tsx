import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Loader2 } from "lucide-react";

export function PullToRefreshIndicator({
  pullPx,
  refreshing,
  thresholdPx,
}: {
  pullPx: number;
  refreshing: boolean;
  thresholdPx: number;
}) {
  const visible = pullPx > 0 || refreshing;
  const progress = Math.min(1, pullPx / thresholdPx);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={refreshing}
      aria-label={refreshing ? "Refreshing" : undefined}
      className="pointer-events-none fixed left-1/2 z-25 flex size-9 items-center justify-center rounded-full border border-mk-border bg-mk-bg/95 text-emerald-400 shadow-md backdrop-blur transition-[transform,opacity] duration-150 ease-out lg:hidden"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 3.25rem)",
        transform: `translate(-50%, ${visible ? pullPx * 0.35 : -48}px)`,
        opacity: visible ? Math.max(0.35, progress) : 0,
      }}
    >
      {refreshing ? (
        <ButtonSpinner size="md" />
      ) : (
        <Loader2
          className="size-5"
          style={{ transform: `rotate(${progress * 300}deg)` }}
          aria-hidden
        />
      )}
    </div>
  );
}
