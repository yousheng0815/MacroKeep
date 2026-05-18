import type { UnitsPreference } from "@/types/records";

/** US customary: total inches and pounds vs metric cm and kg. */

const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.2046226218;

export function cmFromInches(totalInches: number): number {
  return totalInches * CM_PER_INCH;
}

export function inchesFromCm(cm: number): number {
  return cm / CM_PER_INCH;
}

export function kgFromLb(lb: number): number {
  return lb / LB_PER_KG;
}

export function lbFromKg(kg: number): number {
  return kg * LB_PER_KG;
}

export function totalInchesFromFeetInches(feet: number, inches: number): number {
  const totalIn = Math.round(feet) * 12 + Math.round(inches);
  if (!Number.isFinite(totalIn) || totalIn <= 0) return 0;
  return totalIn;
}

/** Convert stored profile/draft body fields to cm/kg for formulas (e.g. Mifflin–St Jeor). */
export function profileBodyToMetric(body: {
  unitsPreference: UnitsPreference;
  height: number;
  weight: number;
}): { heightCm: number; weightKg: number } {
  if (body.unitsPreference === "imperial") {
    return {
      heightCm: cmFromInches(Math.round(body.height)),
      weightKg: kgFromLb(Math.round(body.weight)),
    };
  }
  return {
    heightCm: Math.round(body.height),
    weightKg: Math.round(body.weight),
  };
}

/** When the user switches units, convert the stored numbers to the new system. */
export function convertBodyMeasuresToUnits(
  current: { unitsPreference: UnitsPreference; height: number; weight: number },
  nextUnits: UnitsPreference,
): { height: number; weight: number } {
  if (current.unitsPreference === nextUnits) {
    return {
      height: Math.round(current.height),
      weight: Math.round(current.weight),
    };
  }
  const { heightCm, weightKg } = profileBodyToMetric(current);
  if (nextUnits === "imperial") {
    return {
      height: Math.round(inchesFromCm(heightCm)),
      weight: Math.round(lbFromKg(weightKg)),
    };
  }
  return {
    height: Math.round(heightCm),
    weight: Math.round(weightKg),
  };
}
