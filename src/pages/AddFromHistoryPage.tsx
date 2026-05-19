import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useMealMonthsViewportFill } from "@/hooks/use-meal-months-viewport-fill";
import { useRecords } from "@/hooks/use-records";
import { paths } from "@/lib/routes";
import type { MealRecord } from "@/types/records";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/app-toast";

type HistoryTemplate = {
  key: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  sourcePhotoFileId?: string;
  sourceRecordedAt: string;
};

function getHistoryTemplates(meals: MealRecord[]): HistoryTemplate[] {
  const seenNames = new Set<string>();
  return [...meals]
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .filter((m) => {
      const key = m.food_name.trim().toLowerCase();
      if (!key) return false;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .map((m) => ({
      key: `history:${m.id}`,
      food_name: m.food_name,
      calories: m.calories,
      protein: m.protein,
      fats: m.fats,
      carbs: m.carbs,
      sourcePhotoFileId: m.photoFileId,
      sourceRecordedAt: m.recordedAt,
    }));
}

export function AddFromHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    records,
    userId,
    addMeal,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    allMealShardsLoaded,
    isLoadingMoreMeals,
  } = useRecords();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const templates = useMemo(
    () => getHistoryTemplates(records.meals),
    [records.meals],
  );

  useEffect(() => {
    if (!mealsError) return;
    toast.error(
      mealsError instanceof Error
        ? mealsError.message
        : t("errors.couldNotLoadMealsDrive"),
    );
  }, [mealsError]);

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

  useMealMonthsViewportFill({
    userId,
    allMealShardsLoaded,
    isMealsLoading,
    mealsError,
    loadMoreMealMonths,
    when: true,
    contentKey: records.meals.length + templates.length,
  });

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
    templates.length,
    records.meals.length,
  ]);

  const onPickHistoryMeal = async (template: HistoryTemplate) => {
    setPendingKey(template.key);
    try {
      await addMeal(
        {
          food_name: template.food_name,
          calories: template.calories,
          protein: template.protein,
          fats: template.fats,
          carbs: template.carbs,
        },
        template.sourcePhotoFileId
          ? { photoFileId: template.sourcePhotoFileId }
          : undefined,
      );
      toast.success(t("errors.mealAdded"));
      await navigate({ to: paths.history });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotAddMeal"));
    } finally {
      setPendingKey(null);
    }
  };

  const showTail =
    !isMealsLoading && (!allMealShardsLoaded || isLoadingMoreMeals);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title={t("addMeal.addFromHistoryTitle")}
        backTo={paths.add.root}
        backAriaLabel={t("addMeal.backToAddMeal")}
        subtitle={t("addMeal.addFromHistorySubtitle")}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{t("addMeal.pastMeals")}</div>
          </div>
        </div>
        {isMealsLoading ? (
          <p className="text-sm text-mk-muted">{t("addMeal.loadingMeals")}</p>
        ) : mealsError ? (
          <p className="text-sm text-mk-muted">
            {t("addMeal.couldntLoadHistory")}
          </p>
        ) : allMealShardsLoaded && templates.length === 0 ? (
          <p className="text-sm text-mk-muted">
            {t("addMeal.nothingLoggedAddFirst")}
          </p>
        ) : templates.length > 0 ? (
          <ul className="divide-y divide-zinc-800">
            {templates.map((item) => (
              <li key={item.key} className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  disabled={pendingKey !== null}
                  aria-busy={pendingKey === item.key}
                  onClick={() => void onPickHistoryMeal(item)}
                  className="flex w-full max-w-full min-w-0 items-start gap-3 py-3 overflow-hidden text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MealPhotoThumb
                    photoFileId={item.sourcePhotoFileId}
                    alt={item.food_name}
                    enlargeOnClick={false}
                    cachePolicy={{
                      tier: "log",
                      recordedAt: item.sourceRecordedAt,
                    }}
                    className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                  />
                  <div className="w-0 flex-1 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="block max-w-full truncate font-medium text-white">
                          {item.food_name}
                        </div>
                      </div>
                      {pendingKey === item.key ? (
                        <ButtonSpinner className="mt-0.5 shrink-0 text-zinc-200" />
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-sm text-mk-muted">
                      {Math.round(item.calories)} kcal
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2
              className="size-7 animate-spin text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-mk-muted">
              {t("addMeal.loadingOlderMonths")}
            </p>
          </div>
        )}
        {showTail ? (
          <div
            ref={sentinelRef}
            className="flex min-h-12 flex-col items-center justify-center gap-2 py-6"
          >
            {isLoadingMoreMeals ? (
              <>
                <Loader2
                  className="size-6 animate-spin text-emerald-400"
                  aria-hidden
                />
                <p className="text-xs text-mk-muted">{t("addMeal.loadingOlderMeals")}</p>
              </>
            ) : (
              <p className="text-xs text-mk-muted">{t("addMeal.scrollForMore")}</p>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
