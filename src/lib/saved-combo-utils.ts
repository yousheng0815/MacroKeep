import {
  isSavedCombo,
  isSavedMeal,
  type ComboItem,
  type MealRecord,
  type SavedComboRecord,
  type SavedMealRecord,
  type SavedQuickAdd,
} from "@/types/records";

export type ResolvedComboItem = {
  source: ComboItem["source"];
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  photoFileId?: string;
  savedMealId?: string;
  archived?: boolean;
};

export function mealsById(
  items: readonly SavedQuickAdd[],
): Map<string, SavedMealRecord> {
  const map = new Map<string, SavedMealRecord>();
  for (const item of items) {
    if (isSavedMeal(item)) map.set(item.id, item);
  }
  return map;
}

export function resolveComboItem(
  item: ComboItem,
  mealMap: ReadonlyMap<string, SavedMealRecord>,
): ResolvedComboItem | null {
  if (item.source === "inline") {
    const { source: _s, ...rest } = item;
    return { source: "inline", ...rest };
  }
  const meal = mealMap.get(item.savedMealId);
  if (!meal) return null;
  return {
    source: "saved",
    savedMealId: item.savedMealId,
    food_name: meal.food_name,
    calories: meal.calories,
    protein: meal.protein,
    fats: meal.fats,
    carbs: meal.carbs,
    photoFileId: meal.photoFileId,
    archived: meal.archived,
  };
}

export function resolveComboItems(
  combo: SavedComboRecord,
  allItems: readonly SavedQuickAdd[],
): ResolvedComboItem[] {
  const mealMap = mealsById(allItems);
  const out: ResolvedComboItem[] = [];
  for (const item of combo.items) {
    const resolved = resolveComboItem(item, mealMap);
    if (resolved) out.push(resolved);
  }
  return out;
}

export function sumResolvedMacros(items: readonly ResolvedComboItem[]): {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
} {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      fats: acc.fats + item.fats,
      carbs: acc.carbs + item.carbs,
    }),
    { calories: 0, protein: 0, fats: 0, carbs: 0 },
  );
}

export function countComboRefsForSavedMeal(
  items: readonly SavedQuickAdd[],
  savedMealId: string,
): number {
  let count = 0;
  for (const item of items) {
    if (!isSavedCombo(item)) continue;
    for (const ci of item.items) {
      if (ci.source === "saved" && ci.savedMealId === savedMealId) count++;
    }
  }
  return count;
}

export function getCombosReferencingSavedMeal(
  items: readonly SavedQuickAdd[],
  savedMealId: string,
): SavedComboRecord[] {
  return items.filter(
    (item): item is SavedComboRecord =>
      isSavedCombo(item) &&
      item.items.some(
        (ci) => ci.source === "saved" && ci.savedMealId === savedMealId,
      ),
  );
}

export function getVisibleSavedQuickAdds(
  items: readonly SavedQuickAdd[],
): SavedQuickAdd[] {
  return items.filter((item) => isSavedCombo(item) || !item.archived);
}

export function getSavedMealById(
  items: readonly SavedQuickAdd[],
  id: string,
): SavedMealRecord | undefined {
  const row = items.find((item) => isSavedMeal(item) && item.id === id);
  return row && isSavedMeal(row) ? row : undefined;
}

export function purgeOrphanedArchivedMeals(
  items: readonly SavedQuickAdd[],
): SavedQuickAdd[] {
  return items.filter((item) => {
    if (!isSavedMeal(item) || !item.archived) return true;
    return countComboRefsForSavedMeal(items, item.id) > 0;
  });
}

export function activeSavedMeals(
  items: readonly SavedQuickAdd[],
): SavedMealRecord[] {
  return items.filter(
    (item): item is SavedMealRecord => isSavedMeal(item) && !item.archived,
  );
}

export function comboItemPhotoFileIds(
  combo: SavedComboRecord,
  allItems: readonly SavedQuickAdd[],
): string[] {
  return resolveComboItems(combo, allItems)
    .map((item) => item.photoFileId)
    .filter((id): id is string => !!id);
}

export function savedQuickAddReferencesPhoto(
  items: readonly SavedQuickAdd[],
  photoId: string,
): boolean {
  for (const item of items) {
    if (isSavedMeal(item)) {
      if (item.photoFileId === photoId) return true;
      continue;
    }
    if (item.photoFileId === photoId) return true;
    for (const ci of item.items) {
      if (ci.source === "inline" && ci.photoFileId === photoId) return true;
    }
  }
  return false;
}

/** Whether a logged meal row came from (or matches) a saved combo log. */
export function isComboLogMeal(
  meal: MealRecord,
  savedQuickAdds: readonly SavedQuickAdd[],
): boolean {
  if (typeof meal.savedComboId === "string" && meal.savedComboId.length > 0) {
    return true;
  }
  return savedQuickAdds.some((item) => {
    if (!isSavedCombo(item)) return false;
    const resolved = resolveComboItems(item, savedQuickAdds);
    if (resolved.length === 0) return false;
    const totals = sumResolvedMacros(resolved);
    return (
      meal.food_name.trim() === item.name.trim() &&
      meal.calories === totals.calories &&
      meal.protein === totals.protein &&
      meal.fats === totals.fats &&
      meal.carbs === totals.carbs
    );
  });
}
