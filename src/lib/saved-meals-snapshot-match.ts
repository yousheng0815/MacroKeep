import type { MealRecord, SavedMealRecord, SavedQuickAdd } from "@/types/records";
import { isSavedMeal } from "@/types/records";

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

function isActiveSavedMeal(row: SavedQuickAdd): row is SavedMealRecord {
  return isSavedMeal(row) && !row.archived;
}

/** Another active saved row (excluding `excludeId`) already uses this name + macro snapshot. */
export function savedMealDuplicatesExisting(
  candidate: Pick<
    SavedMealRecord,
    "food_name" | "calories" | "protein" | "fats" | "carbs"
  >,
  savedItems: readonly SavedQuickAdd[],
  excludeId?: string,
): boolean {
  return savedItems.some(
    (s) =>
      isActiveSavedMeal(s) &&
      s.id !== excludeId &&
      sameSavedMealSnapshot(candidate, s),
  );
}

export function findArchivedSavedMealMatch(
  candidate: Pick<
    SavedMealRecord,
    "food_name" | "calories" | "protein" | "fats" | "carbs"
  >,
  savedItems: readonly SavedQuickAdd[],
): SavedMealRecord | undefined {
  return savedItems.find(
    (s): s is SavedMealRecord =>
      isSavedMeal(s) &&
      !!s.archived &&
      sameSavedMealSnapshot(candidate, s),
  );
}

export function isMealAlreadySavedAsTemplate(
  meal: MealRecord,
  savedItems: readonly SavedQuickAdd[],
): boolean {
  return savedMealDuplicatesExisting(meal, savedItems);
}
