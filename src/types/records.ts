import type { AppLocale } from "@/i18n/config";

export type MealRecord = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  recordedAt: string;
  /** Google Drive file id (App Data folder) for the meal photo. */
  photoFileId?: string;
};

/** Quick-add snapshot in Drive `saved-meals.json` — not tied to a history meal row. */
export type SavedMealRecord = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  /** Google Drive App Data image for this saved meal (optional). */
  photoFileId?: string;
};

export type ProfileGender = "male" | "female";

/** Body height/weight: when {@link UnitsPreference} is `metric`, cm and kg; when `imperial`, total inches and lb. */
export type UnitsPreference = "metric" | "imperial";

export type UserProfile = {
  /** `YYYY-MM-DD` — used for accurate age (not only birth year). */
  birthDate: string;
  gender: ProfileGender;
  unitsPreference: UnitsPreference;
  /** With `metric`: centimetres (whole). With `imperial`: total height in whole inches. */
  height: number;
  /** With `metric`: whole kilograms. With `imperial`: whole pounds. */
  weight: number;
  dailyTargetKcal: number;
  proteinTargetG: number;
  fatsTargetG: number;
  carbsTargetG: number;
};

export type OnboardingMacroGoal =
  | "lose_weight"
  | "maintain_weight"
  | "gain_muscle"
  | "improve_health";

export type OnboardingActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type OnboardingDraft = {
  birthDate: string;
  /** Snapshot for display / APIs; always matches {@link birthDate}. */
  age: number;
  gender: ProfileGender;
  unitsPreference: UnitsPreference;
  /** Same units as {@link UserProfile.height} / {@link UserProfile.weight}. */
  height: number;
  weight: number;
  goal: OnboardingMacroGoal;
  activityLevel: OnboardingActivityLevel;
  suggestedDailyTargetKcal: number;
  suggestedProteinTargetG: number;
  suggestedFatsTargetG: number;
  suggestedCarbsTargetG: number;
  suggestedAt: string;
};

/** Persisted in Drive as `core.json` (profile + optional Gemini key; no meal rows in this file). */
export type RecordsCoreDocument = {
  version: number;
  profile: UserProfile;
  /** BYOK Gemini key — stored only in Drive app-data `core.json`, not in browser storage. */
  geminiApiKey?: string;
  /** Marks whether the first-run tutorial/setup flow has been completed. */
  onboardingCompleted?: boolean;
  /** Saved onboarding result so refresh doesn't lose generated Step 3 targets. */
  onboardingDraft?: OnboardingDraft;
  /** UI language — synced across devices via Drive; also mirrored in localStorage. */
  locale?: AppLocale;
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
  birthDate: "1990-01-01",
  gender: "male",
  unitsPreference: "metric",
  height: 180,
  weight: 72,
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

