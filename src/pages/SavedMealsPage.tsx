import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { paths } from "@/lib/routes";
import type { SavedMealRecord } from "@/types/records";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SavedMealsPage() {
  const navigate = useNavigate();
  const {
    savedMeals,
    addMeal,
    isSavedMealsLoading,
    savedMealsError,
  } = useRecords();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : "Could not load saved meals from Drive.",
    );
  }, [savedMealsError]);

  const onPickSaved = async (item: SavedMealRecord) => {
    setPendingId(item.id);
    try {
      await addMeal(
        {
          food_name: item.food_name,
          calories: item.calories,
          protein: item.protein,
          fats: item.fats,
          carbs: item.carbs,
        },
        item.photoFileId ? { photoFileId: item.photoFileId } : undefined,
      );
      toast.success("Meal added");
      await navigate({ to: paths.history });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add meal.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        title="Add From Saved Meals"
        backTo={paths.add.root}
        backAriaLabel="Back to add meal"
        subtitle="Pick a saved meal to quickly log it again."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark
              className="size-4 shrink-0 text-amber-400"
              aria-hidden
            />
            <div className="text-sm font-semibold text-white">Saved meals</div>
          </div>
        </div>
        {isSavedMealsLoading ? (
          <p className="text-sm text-om-muted">Loading saved meals…</p>
        ) : savedMealsError ? (
          <p className="text-sm text-om-muted">
            Couldn&apos;t load saved meals. Check your connection or try
            refreshing the app.
          </p>
        ) : savedMeals.length === 0 ? (
          <p className="text-sm text-om-muted">
            No saved meals yet. Open a meal, then use &quot;Add to saved
            meals&quot; on the meal details screen to build your quick-add list.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {savedMeals.map((item) => (
              <li key={item.id} className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  disabled={pendingId !== null}
                  aria-busy={pendingId === item.id}
                  onClick={() => void onPickSaved(item)}
                  className="flex w-full max-w-full min-w-0 items-start gap-3 py-3 overflow-hidden text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MealPhotoThumb
                    photoFileId={item.photoFileId}
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
                      {pendingId === item.id ? (
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
        )}
      </Card>
    </div>
  );
}
