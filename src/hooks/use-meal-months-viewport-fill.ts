import type { RecordsMealsQueryData } from "@/hooks/use-records";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * When the document does not scroll vertically, the meal list’s “load more”
 * sentinel may never intersect the viewport. Pull older month shards until
 * the page can scroll or every shard is on the client.
 */
export function useMealMonthsViewportFill(options: {
  userId: string;
  allMealShardsLoaded: boolean;
  isMealsLoading: boolean;
  mealsError: unknown;
  loadMoreMealMonths: () => Promise<void>;
  /** When false, the effect is disabled (e.g. History before any day groups exist). */
  when?: boolean;
  /** Re-run when loaded content changes (meal rows, template count, etc.). */
  contentKey: number;
}): void {
  const {
    userId,
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    when = true,
    contentKey,
  } = options;
  const qc = useQueryClient();

  useEffect(() => {
    if (!when) return;
    if (!userId || allMealShardsLoaded || isMealsLoading || mealsError) return;

    let cancelled = false;

    const canWindowScroll = () => {
      const r = document.documentElement;
      return r.scrollHeight > r.clientHeight + 24;
    };

    const allShardsDone = () =>
      qc.getQueryData<RecordsMealsQueryData>(["records-meals", userId])
        ?.allShardsLoaded ?? true;

    const pumpIfShortViewport = async () => {
      let steps = 0;
      while (!cancelled && steps++ < 80) {
        if (allShardsDone()) return;
        if (canWindowScroll()) return;
        await loadMoreMealMonths();
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
    };

    void pumpIfShortViewport();

    const onLayoutMaybe = () => {
      void pumpIfShortViewport();
    };

    const ro = new ResizeObserver(onLayoutMaybe);
    ro.observe(document.documentElement);
    window.addEventListener("resize", onLayoutMaybe);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", onLayoutMaybe);
    };
  }, [
    qc,
    userId,
    when,
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    contentKey,
  ]);
}
