import { profileBodyToMetric } from "@/lib/units";
import type {
  OnboardingActivityLevel,
  OnboardingMacroGoal,
  ProfileGender,
  UnitsPreference,
} from "@/types/records";

export type MacroPlanInput = {
  age: number;
  gender: ProfileGender;
  heightCm: number;
  weightKg: number;
  goal: OnboardingMacroGoal;
  activityLevel: OnboardingActivityLevel;
};

export type MacroPlanSuggestion = {
  dailyTargetKcal: number;
  proteinTargetG: number;
  fatsTargetG: number;
  carbsTargetG: number;
};

const ACTIVITY_MULTIPLIER: Record<OnboardingActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function mifflinStJeorBmr(input: MacroPlanInput): number {
  const { weightKg, heightCm, age, gender } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

function goalCalorieMultiplier(goal: OnboardingMacroGoal): number {
  switch (goal) {
    case "lose_weight":
      return 0.85;
    case "gain_muscle":
      return 1.1;
    case "improve_health":
      return 0.95;
    default:
      return 1;
  }
}

function proteinGramsPerKg(goal: OnboardingMacroGoal): number {
  switch (goal) {
    case "gain_muscle":
      return 2;
    case "lose_weight":
      return 2;
  }
  return 1.6;
}

/** Uses {@link profileBodyToMetric} so stored height/weight match {@link UnitsPreference}. */
export function suggestMacroPlanFromProfileBody(
  input: Omit<MacroPlanInput, "heightCm" | "weightKg"> & {
    unitsPreference: UnitsPreference;
    height: number;
    weight: number;
  },
): MacroPlanSuggestion {
  const { heightCm, weightKg } = profileBodyToMetric(input);
  const { unitsPreference: _u, height: _h, weight: _w, ...rest } = input;
  return suggestMacroPlan({ ...rest, heightCm, weightKg });
}

export function suggestMacroPlan(input: MacroPlanInput): MacroPlanSuggestion {
  const age = Math.max(1, Math.round(input.age));
  const heightCm = Math.max(1, Math.round(input.heightCm));
  const weightKg = Math.max(1, Math.round(input.weightKg));
  const normalized = { ...input, age, heightCm, weightKg };

  const bmr = mifflinStJeorBmr(normalized);
  const tdee = Math.round(
    bmr * ACTIVITY_MULTIPLIER[normalized.activityLevel],
  );
  const minKcal = normalized.gender === "female" ? 1200 : 1500;
  const dailyTargetKcal = Math.max(
    minKcal,
    Math.round(tdee * goalCalorieMultiplier(normalized.goal)),
  );

  const proteinTargetG = Math.round(
    weightKg * proteinGramsPerKg(normalized.goal),
  );
  const fatsTargetG = Math.max(
    0,
    Math.round((dailyTargetKcal * 0.3) / 9),
  );
  const proteinKcal = proteinTargetG * 4;
  const fatsKcal = fatsTargetG * 9;
  const carbsTargetG = Math.max(
    0,
    Math.round((dailyTargetKcal - proteinKcal - fatsKcal) / 4),
  );

  return {
    dailyTargetKcal,
    proteinTargetG,
    fatsTargetG,
    carbsTargetG,
  };
}
