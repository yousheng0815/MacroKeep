export type MealRecord = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  recordedAt: string;
  /** Google Drive file id (App Data folder) for the saved meal photo snapshot. */
  photoFileId?: string;
  /** Google Drive file id (App Data folder) for the small list thumbnail snapshot. */
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

/** Persisted in Drive as `records.json` (no `meals`; those live in `meals-YYYY-MM.json`). */
export type RecordsCoreDocument = {
  version: number;
  updatedAt: string;
  profile: UserProfile;
  /** BYOK Gemini key — stored only in Drive `records.json`, not in browser storage. */
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
    updatedAt: new Date().toISOString(),
    profile: { ...DEFAULT_PROFILE },
    meals: [],
  };
}

