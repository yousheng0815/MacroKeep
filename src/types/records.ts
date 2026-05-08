export type MealRecord = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  recordedAt: string;
  /** User-marked favorite meal. */
  isFavorite?: boolean;
  /** When present, this entry was created from another favorite meal. */
  sourceFavoriteMealId?: string;
  /** Google Drive file id (App Data folder) for the meal photo. */
  photoFileId?: string;
  /** @deprecated Legacy second file; new saves only set {@link photoFileId}. */
  thumbnailFileId?: string;
};

export type UserProfile = {
  birthYear: number;
  heightCm: number;
  weightKg: number;
  dailyTargetKcal: number;
  proteinTargetG: number;
  fatsTargetG: number;
  carbsTargetG: number;
};

/** Persisted in Drive as `core.json` (profile + optional Gemini key; no meal rows in this file). */
export type RecordsCoreDocument = {
  version: number;
  profile: UserProfile;
  /** BYOK Gemini key — stored only in Drive app-data `core.json`, not in browser storage. */
  geminiApiKey?: string;
};

/** In-memory / UI document: core fields plus meals merged from monthly shards on pull. */
export type RecordsDocument = RecordsCoreDocument & {
  meals: MealRecord[];
};

/** One Drive file `meals-YYYY-MM.json` under App Data. */
export type MealsShardDocument = {
  meals: MealRecord[];
};

export const DEFAULT_PROFILE: UserProfile = {
  birthYear: 1989,
  heightCm: 180,
  weightKg: 72,
  dailyTargetKcal: 2000,
  proteinTargetG: 150,
  fatsTargetG: 65,
  carbsTargetG: 250,
};

export function emptyRecords(): RecordsDocument {
  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE },
    meals: [],
  };
}

