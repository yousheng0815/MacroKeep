import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useMealMonthsViewportFill } from "@/hooks/use-meal-months-viewport-fill";
import { useRecords } from "@/hooks/use-records";
import {
  formatLocalDateLabel,
  formatTime,
  isSameLocalDay,
  startOfLocalDay,
} from "@/lib/date";
import { paths } from "@/lib/routes";
import type { MealRecord } from "@/types/records";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

function groupByDay(meals: MealRecord[]): Map<number, MealRecord[]> {
  const map = new Map<number, MealRecord[]>();
  const sorted = [...meals].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  );
  for (const m of sorted) {
    const day = startOfLocalDay(new Date(m.recordedAt)).getTime();
    const arr = map.get(day) ?? [];
    arr.push(m);
    map.set(day, arr);
  }
  return map;
}

export function HistoryPage() {
  const {
    records,
    userId,
    isMealsLoading,
    mealsError,
    refetchMeals,
    loadMoreMealMonths,
    allMealShardsLoaded,
    isLoadingMoreMeals,
  } = useRecords();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const groups = groupByDay(records.meals);

  useEffect(() => {
    if (allMealShardsLoaded || isMealsLoading || mealsError) return;
    if (records.meals.length > 0) return;
    void loadMoreMealMonths();
  }, [
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    records.meals.length,
    loadMoreMealMonths,
  ]);

  useEffect(() => {
    if (allMealShardsLoaded || isMealsLoading || mealsError) return;
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        void loadMoreMealMonths();
      },
      { root: null, rootMargin: "240px", threshold: 0 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    groups.size,
  ]);

  useMealMonthsViewportFill({
    userId,
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    when: groups.size > 0,
    contentKey: records.meals.length + groups.size,
  });

  let body: ReactNode;
  if (isMealsLoading) {
    body = (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2
            className="size-8 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-mk-muted">Loading meal history…</p>
        </div>
      </Card>
    );
  } else if (mealsError) {
    const msg =
      mealsError instanceof Error
        ? mealsError.message
        : "Could not load meals from Drive.";
    body = (
      <Card>
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
          <p className="text-sm text-red-300">{msg}</p>
          <button
            type="button"
            disabled={retryPending}
            aria-busy={retryPending}
            onClick={() =>
              void (async () => {
                setRetryPending(true);
                try {
                  await refetchMeals();
                } finally {
                  setRetryPending(false);
                }
              })()
            }
            className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents
              pending={retryPending}
              spinner={<ButtonSpinner />}
            >
              Retry
            </ButtonPendingContents>
          </button>
        </div>
      </Card>
    );
  } else if (groups.size === 0 && !allMealShardsLoaded) {
    body = (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2
            className="size-8 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-mk-muted">Loading meal history…</p>
        </div>
      </Card>
    );
  } else if (groups.size === 0) {
    body = (
      <Card>
        <p className="py-10 text-center text-sm text-mk-muted">
          Nothing logged yet.
        </p>
      </Card>
    );
  } else {
    body = (
      <div className="space-y-5">
        {[...groups.entries()].map(([dayTs, items]) => {
          const dayDate = new Date(dayTs);
          const totals = items.reduce(
            (acc, m) => ({
              kcal: acc.kcal + m.calories,
              p: acc.p + m.protein,
              f: acc.f + m.fats,
              c: acc.c + m.carbs,
            }),
            { kcal: 0, p: 0, f: 0, c: 0 },
          );
          const today = isSameLocalDay(dayDate, new Date());

          return (
            <Card key={dayTs}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {today ? "Today" : formatLocalDateLabel(dayDate)}
                  </div>
                  <div className="mt-1 text-sm text-mk-muted">
                    {Math.round(totals.kcal)} kcal
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-zinc-800">
                {items.map((m) => (
                  <li key={m.id} className="min-w-0 overflow-hidden">
                    <Link
                      to={paths.mealDetail}
                      params={{ mealId: m.id }}
                      state={{ navFrom: paths.history }}
                      className="flex w-full max-w-full min-w-0 items-start gap-3 py-3 overflow-hidden transition hover:bg-zinc-900/40"
                    >
                      <MealPhotoThumb
                        photoFileId={m.photoFileId}
                        alt={m.food_name}
                        cachePolicy={{
                          tier: "log",
                          recordedAt: m.recordedAt,
                        }}
                        className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                      />
                      <div className="w-0 flex-1 overflow-hidden">
                        <div className="min-w-0">
                          <div className="block max-w-full truncate font-medium text-white">
                            {m.food_name}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-sm text-mk-muted">
                          {formatTime(new Date(m.recordedAt))} ·{" "}
                          {Math.round(m.calories)} kcal
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        {!allMealShardsLoaded || isLoadingMoreMeals ? (
          <div
            ref={sentinelRef}
            className="flex min-h-14 flex-col items-center justify-center gap-2 py-8"
          >
            {isLoadingMoreMeals ? (
              <>
                <Loader2
                  className="size-6 animate-spin text-emerald-400"
                  aria-hidden
                />
                <p className="text-xs text-mk-muted">Loading more meals…</p>
              </>
            ) : (
              <p className="text-xs text-mk-muted">Scroll for more history</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="History"
        subtitle="Meals grouped by day with macro totals."
      />

      {body}
    </div>
  );
}
