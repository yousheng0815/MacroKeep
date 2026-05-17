import { startOfLocalDay } from "@/lib/date";

/** Logged meals: today and yesterday (local calendar). */
export const LOG_MEAL_PHOTO_CACHE_DAYS = 2;

export type MealPhotoCacheTier = "saved" | "recent";

export type MealPhotoCachePolicy =
  | { tier: "saved" }
  | { tier: "log"; recordedAt: string };

export function isLogMealWithinPhotoCacheWindow(recordedAt: string): boolean {
  const mealDay = startOfLocalDay(new Date(recordedAt));
  const oldest = startOfLocalDay(new Date());
  oldest.setDate(oldest.getDate() - (LOG_MEAL_PHOTO_CACHE_DAYS - 1));
  return mealDay.getTime() >= oldest.getTime();
}

/** Local midnight after the last cached calendar day for this meal. */
export function logMealPhotoCacheExpiresAtMs(recordedAt: string): number {
  const day = startOfLocalDay(new Date(recordedAt));
  day.setDate(day.getDate() + LOG_MEAL_PHOTO_CACHE_DAYS);
  return day.getTime();
}

export function shouldPersistMealPhoto(
  policy: MealPhotoCachePolicy | undefined,
): policy is MealPhotoCachePolicy {
  if (!policy) return false;
  if (policy.tier === "saved") return true;
  return isLogMealWithinPhotoCacheWindow(policy.recordedAt);
}

export function mealPhotoCacheTierFromPolicy(
  policy: MealPhotoCachePolicy,
): MealPhotoCacheTier {
  return policy.tier === "saved" ? "saved" : "recent";
}

export function expiresAtMsForPolicy(policy: MealPhotoCachePolicy): number {
  if (policy.tier === "saved") return Number.MAX_SAFE_INTEGER;
  return logMealPhotoCacheExpiresAtMs(policy.recordedAt);
}
