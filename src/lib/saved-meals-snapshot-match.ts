import type { MealRecord, SavedMealRecord } from "@/types/records";

/**
 * Whether a saved-meals row matches this logged meal as a template.
 * Photo file ids are ignored (saved meals get a copied id on Drive).
 */
export function isMealAlreadySavedAsTemplate(
  meal: MealRecord,
  savedMeals: readonly SavedMealRecord[],
): boolean {
  const name = meal.food_name.trim();
  return savedMeals.some(
    (s) =>
      s.food_name.trim() === name &&
      s.calories === meal.calories &&
      s.protein === meal.protein &&
      s.fats === meal.fats &&
      s.carbs === meal.carbs,
  );
}
