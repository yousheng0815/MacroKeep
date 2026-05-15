import type { MealRecord, SavedMealRecord } from "@/types/records";

/**
 * Whether a saved-meals row matches this logged meal as a template.
 * Photo file ids are ignored (saved meals get a copied id on Drive).
 */
function sameSavedMealSnapshot(
  a: Pick<
    SavedMealRecord,
    "food_name" | "calories" | "protein" | "fats" | "carbs"
  >,
  b: Pick<
    SavedMealRecord,
    "food_name" | "calories" | "protein" | "fats" | "carbs"
  >,
): boolean {
  return (
    a.food_name.trim() === b.food_name.trim() &&
    a.calories === b.calories &&
    a.protein === b.protein &&
    a.fats === b.fats &&
    a.carbs === b.carbs
  );
}

/** Another saved row (excluding `excludeId`) already uses this name + macro snapshot. */
export function savedMealDuplicatesExisting(
  candidate: Pick<
    SavedMealRecord,
    "food_name" | "calories" | "protein" | "fats" | "carbs"
  >,
  savedMeals: readonly SavedMealRecord[],
  excludeId?: string,
): boolean {
  return savedMeals.some(
    (s) => s.id !== excludeId && sameSavedMealSnapshot(candidate, s),
  );
}

export function isMealAlreadySavedAsTemplate(
  meal: MealRecord,
  savedMeals: readonly SavedMealRecord[],
): boolean {
  return savedMealDuplicatesExisting(meal, savedMeals);
}
