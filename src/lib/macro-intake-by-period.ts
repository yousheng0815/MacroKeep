import i18n from "@/i18n";
import { intlLocaleTag, type AppLocale } from "@/i18n/config";
import { startOfLocalDay } from "@/lib/date";
import type { MealRecord, UserProfile } from "@/types/records";

export type MacroDayPoint = {
  /** Local midnight for this bucket. */
  dayStartMs: number;
  /** Short label for the x-axis. */
  label: string;
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
};

export type MacroMetricKey = "kcal" | "protein" | "fats" | "carbs";

export function macroTargetForMetric(
  profile: UserProfile,
  metric: MacroMetricKey,
): number {
  switch (metric) {
    case "kcal":
      return profile.dailyTargetKcal;
    case "protein":
      return profile.proteinTargetG;
    case "fats":
      return profile.fatsTargetG;
    case "carbs":
      return profile.carbsTargetG;
    default: {
      const _x: never = metric;
      return _x;
    }
  }
}

/** Oldest day first, ending on today (local). */
export function buildMacroDaySeries(
  meals: MealRecord[],
  numDays: number,
): MacroDayPoint[] {
  const n = Math.max(1, Math.min(90, Math.floor(numDays)));
  const today = startOfLocalDay(new Date());
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(startOfLocalDay(d));
  }

  const totals = new Map<
    number,
    { kcal: number; protein: number; fats: number; carbs: number }
  >();
  for (const d of days) {
    totals.set(d.getTime(), { kcal: 0, protein: 0, fats: 0, carbs: 0 });
  }

  if (days.length === 0) return [];

  const minT = days[0].getTime();
  const maxT = days[days.length - 1].getTime();

  for (const m of meals) {
    const t = startOfLocalDay(new Date(m.recordedAt)).getTime();
    if (t < minT || t > maxT) continue;
    const row = totals.get(t);
    if (!row) continue;
    row.kcal += m.calories;
    row.protein += m.protein;
    row.fats += m.fats;
    row.carbs += m.carbs;
  }

  return days.map((d) => {
    const row = totals.get(d.getTime())!;
    return {
      dayStartMs: d.getTime(),
      label: d.toLocaleDateString(
        intlLocaleTag(i18n.language as AppLocale) ?? undefined,
        {
          month: "short",
          day: "numeric",
        },
      ),
      ...row,
    };
  });
}

export function intakeRatio(
  value: number,
  target: number,
  cap: number,
): number {
  const t = Math.max(1, target);
  return Math.min(cap, value / t);
}
