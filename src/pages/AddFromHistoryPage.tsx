import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { paths } from "@/lib/routes";
import type { MealRecord } from "@/types/records";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

type HistoryTemplate = {
  key: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  sourcePhotoFileId?: string;
  sourceFavoriteMealId?: string;
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
      sourceFavoriteMealId: m.isFavorite ? m.id : m.sourceFavoriteMealId,
    }));
}

export function AddFromHistoryPage() {
  const navigate = useNavigate();
  const { records, addMeal } = useRecords();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = useMemo(
    () => getHistoryTemplates(records.meals),
    [records.meals],
  );

  const onPickHistoryMeal = async (template: HistoryTemplate) => {
    setError(null);
    setPendingKey(template.key);
    try {
      const mealId = await addMeal(
        {
          food_name: template.food_name,
          calories: template.calories,
          protein: template.protein,
          fats: template.fats,
          carbs: template.carbs,
          ...(template.sourceFavoriteMealId
            ? { sourceFavoriteMealId: template.sourceFavoriteMealId }
            : {}),
        },
        {
          photoFileId: template.sourcePhotoFileId,
        },
      );
      await navigate({
        to: paths.mealDetail,
        params: { mealId },
        state: { navFrom: paths.add.root },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add meal.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        title="Add From History"
        backTo={paths.add.root}
        backAriaLabel="Back to add meal"
        subtitle="Pick a past meal to quickly log it again."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Past meals</div>
          </div>
        </div>
        {templates.length > 0 ? (
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
                    <div className="mt-1 truncate text-sm text-om-muted">
                      {Math.round(item.calories)} kcal · P{" "}
                      {Math.round(item.protein)} g · F {Math.round(item.fats)} g
                      · C {Math.round(item.carbs)} g
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-om-muted">
            No past meals yet. Log a meal first, then you can reuse it from
            here.
          </p>
        )}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </Card>
    </div>
  );
}
