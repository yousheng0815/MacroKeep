import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { useRecords } from "@/hooks/use-records";
import {
  formatLocalDateLabel,
  formatTime,
  isSameLocalDay,
  startOfLocalDay,
} from "@/lib/date";
import type { MealRecord } from "@/types/records";
import { Link } from "@tanstack/react-router";
import { Loader2, Star, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

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
  const { records, isMealsLoading, mealsError, refetchMeals, updateMeal } =
    useRecords();
  const [retryPending, setRetryPending] = useState(false);
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(
    null,
  );
  const groups = groupByDay(records.meals);

  let body: ReactNode;
  if (isMealsLoading) {
    body = (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2
            className="size-8 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-om-muted">Loading meal history…</p>
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retryPending ? <ButtonSpinner /> : null}
            Retry
          </button>
        </div>
      </Card>
    );
  } else if (groups.size === 0) {
    body = (
      <Card>
        <p className="py-10 text-center text-sm text-om-muted">
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
                  <div className="mt-1 text-xs text-om-muted">
                    {Math.round(totals.kcal)} kcal · P {Math.round(totals.p)} g
                    · F {Math.round(totals.f)} g · C {Math.round(totals.c)} g
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-zinc-800">
                {items.map((m) => (
                  <li key={m.id} className="min-w-0 overflow-hidden">
                    <Link
                      to="/meals/$mealId"
                      params={{ mealId: m.id }}
                      className="flex w-full max-w-full min-w-0 items-start gap-3 py-3 overflow-hidden transition hover:bg-zinc-900/40"
                    >
                      <MealPhotoThumb
                        photoFileId={m.photoFileId}
                        thumbnailFileId={m.thumbnailFileId}
                        alt={m.food_name}
                        className="size-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-zinc-700"
                      />
                      <div className="w-0 flex-1 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="block max-w-full truncate font-medium text-white">
                              {m.food_name}
                            </div>
                          </div>
                          {m.sourceFavoriteMealId ? (
                            <span
                              className="mt-0.5 inline-flex size-5 shrink-0 text-emerald-300"
                              aria-label="Added from favorite meal"
                              title="Added from favorite meal"
                            >
                              <Tag className="size-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={favoritePendingId !== null}
                              aria-label={
                                m.isFavorite
                                  ? "Marked as favorite"
                                  : "Add to favorites"
                              }
                              title={
                                m.isFavorite ? "Favorite" : "Add to favorites"
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void (async () => {
                                  setFavoritePendingId(m.id);
                                  try {
                                    await updateMeal(m.id, {
                                      isFavorite: !m.isFavorite,
                                    });
                                  } finally {
                                    setFavoritePendingId(null);
                                  }
                                })();
                              }}
                              className={`inline-flex shrink-0 items-center justify-center rounded-full p-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                m.isFavorite
                                  ? "text-amber-300 hover:text-amber-200"
                                  : "text-zinc-300 hover:text-zinc-100"
                              }`}
                            >
                              {favoritePendingId === m.id ? (
                                <ButtonSpinner className="size-3" />
                              ) : (
                                <Star
                                  className={`size-3.5 ${m.isFavorite ? "fill-current" : ""}`}
                                />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-om-muted">
                          {formatTime(new Date(m.recordedAt))} ·{" "}
                          {Math.round(m.calories)} kcal · P{" "}
                          {Math.round(m.protein)} · F {Math.round(m.fats)} · C{" "}
                          {Math.round(m.carbs)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-bold text-white">History</h1>
        <p className="mt-1 text-sm text-om-muted">
          Meals grouped by day with macro totals.
        </p>
      </div>

      {body}
    </div>
  );
}
