import type { SavedMealRecord } from "@/types/records";

export class ArchivedSavedMealMatchError extends Error {
  readonly meal: SavedMealRecord;
  readonly comboRefCount: number;

  constructor(meal: SavedMealRecord, comboRefCount: number) {
    super("archived_saved_meal_match");
    this.name = "ArchivedSavedMealMatchError";
    this.meal = meal;
    this.comboRefCount = comboRefCount;
  }
}

export function isArchivedSavedMealMatchError(
  err: unknown,
): err is ArchivedSavedMealMatchError {
  return err instanceof ArchivedSavedMealMatchError;
}
