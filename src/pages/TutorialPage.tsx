import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import {
  HeightWeightFields,
  UnitsPreferenceSegment,
} from "@/components/profile/body-measurement-fields";
import { useRecords } from "@/hooks/use-records";
import {
  ageYearsFromIsoBirthDate,
  isValidIsoBirthDate,
} from "@/lib/birth-date";
import { convertBodyMeasuresToUnits } from "@/lib/units";
import {
  suggestMacroPlanFromProfileBody,
  type MacroPlanSuggestion,
} from "@/lib/macro-plan";
import type {
  OnboardingActivityLevel,
  OnboardingMacroGoal,
  ProfileGender,
  UnitsPreference,
} from "@/types/records";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

type TutorialForm = {
  birthDate: string;
  gender: ProfileGender;
  unitsPreference: UnitsPreference;
  height: number;
  weight: number;
  goal: OnboardingMacroGoal;
  activityLevel: OnboardingActivityLevel;
};

const GOAL_OPTIONS: { value: OnboardingMacroGoal; label: string }[] = [
  { value: "gain_muscle", label: "Gain muscle" },
  { value: "lose_weight", label: "Lose weight" },
  { value: "maintain_weight", label: "Maintain weight" },
  { value: "improve_health", label: "Improve health" },
];

const ACTIVITY_OPTIONS: {
  value: OnboardingActivityLevel;
  label: string;
}[] = [
  { value: "sedentary", label: "Sedentary (little or no exercise)" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very active (hard training/physical job)" },
];

const GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function TutorialPage() {
  const {
    records,
    updateProfile,
    completeOnboarding,
    saveOnboardingDraft,
    clearOnboardingDraft,
    isSaving,
  } = useRecords();
  const navigate = useNavigate();
  const [form, setForm] = useState<TutorialForm>({
    birthDate: records.profile.birthDate,
    gender: records.profile.gender,
    unitsPreference: records.profile.unitsPreference,
    height: records.profile.height,
    weight: records.profile.weight,
    goal: "gain_muscle",
    activityLevel: "moderate",
  });
  const [generatedPlan, setGeneratedPlan] =
    useState<MacroPlanSuggestion | null>(null);
  const [didHydrateFromDraft, setDidHydrateFromDraft] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const step2Ref = useRef<HTMLDivElement>(null);
  const shouldScrollToStep2Ref = useRef(false);

  const canGenerate = useMemo(
    () =>
      isValidIsoBirthDate(form.birthDate) &&
      form.height > 0 &&
      form.weight > 0,
    [form],
  );

  const canApply = useMemo(() => {
    if (!generatedPlan) return false;
    return (
      generatedPlan.dailyTargetKcal > 0 &&
      generatedPlan.proteinTargetG >= 0 &&
      generatedPlan.fatsTargetG >= 0 &&
      generatedPlan.carbsTargetG >= 0
    );
  }, [generatedPlan]);

  useEffect(() => {
    if (didHydrateFromDraft) return;
    const draft = records.onboardingDraft;
    if (!draft) return;
    const timer = window.setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        birthDate: draft.birthDate,
        gender: draft.gender,
        unitsPreference: draft.unitsPreference,
        height: draft.height,
        weight: draft.weight,
        goal: draft.goal,
        activityLevel: draft.activityLevel,
      }));
      setGeneratedPlan({
        dailyTargetKcal: draft.suggestedDailyTargetKcal,
        proteinTargetG: draft.suggestedProteinTargetG,
        fatsTargetG: draft.suggestedFatsTargetG,
        carbsTargetG: draft.suggestedCarbsTargetG,
      });
      setDidHydrateFromDraft(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [didHydrateFromDraft, records.onboardingDraft]);

  useEffect(() => {
    if (!generatedPlan || !shouldScrollToStep2Ref.current) return;
    shouldScrollToStep2Ref.current = false;
    const timer = window.setTimeout(() => {
      step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [generatedPlan]);

  const generatePlan = () => {
    const isRecalculate = generatedPlan !== null;
    const plan = suggestMacroPlanFromProfileBody({
      age: ageYearsFromIsoBirthDate(form.birthDate),
      gender: form.gender,
      unitsPreference: form.unitsPreference,
      height: form.height,
      weight: form.weight,
      goal: form.goal,
      activityLevel: form.activityLevel,
    });
    setIsGeneratingPlan(true);
    void saveOnboardingDraft({
      birthDate: form.birthDate,
      age: ageYearsFromIsoBirthDate(form.birthDate),
      gender: form.gender,
      unitsPreference: form.unitsPreference,
      height: form.height,
      weight: form.weight,
      goal: form.goal,
      activityLevel: form.activityLevel,
      suggestedDailyTargetKcal: plan.dailyTargetKcal,
      suggestedProteinTargetG: plan.proteinTargetG,
      suggestedFatsTargetG: plan.fatsTargetG,
      suggestedCarbsTargetG: plan.carbsTargetG,
      suggestedAt: new Date().toISOString(),
    })
      .then(() => {
        setGeneratedPlan(plan);
        if (!isRecalculate) {
          shouldScrollToStep2Ref.current = true;
        }
      })
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Could not save suggested targets.",
        );
      })
      .finally(() => {
        setIsGeneratingPlan(false);
      });
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <span className="rounded-full border border-om-border bg-om-bg px-2.5 py-1 text-sm font-medium text-zinc-300">
            Setup
          </span>
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-white">
          Set your targets
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-om-muted">
          Enter your profile and goal, generate suggested calories and macros,
          then save them as your daily targets.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-white">
          Step 1: Profile + goal
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Birthday
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, birthDate: e.target.value }))
              }
              className="mt-1 w-full om-text-input"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Gender
            <select
              value={form.gender}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  gender: e.target.value as ProfileGender,
                }))
              }
              className="mt-1 w-full om-text-input"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <span className="text-sm text-zinc-400">Height & weight units</span>
            <UnitsPreferenceSegment
              id="tutorial-units"
              value={form.unitsPreference}
              disabled={isGeneratingPlan}
              onChange={(unitsPreference) =>
                setForm((prev) => {
                  if (unitsPreference === prev.unitsPreference) return prev;
                  const { height, weight } = convertBodyMeasuresToUnits(
                    {
                      unitsPreference: prev.unitsPreference,
                      height: prev.height,
                      weight: prev.weight,
                    },
                    unitsPreference,
                  );
                  return { ...prev, unitsPreference, height, weight };
                })
              }
            />
          </div>
          <HeightWeightFields
            units={form.unitsPreference}
            height={form.height}
            weight={form.weight}
            disabled={isGeneratingPlan}
            onChange={({ height, weight }) =>
              setForm((prev) => ({ ...prev, height, weight }))
            }
          />
          <label className="block text-sm text-zinc-400">
            Goal
            <select
              value={form.goal}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  goal: e.target.value as OnboardingMacroGoal,
                }))
              }
              className="mt-1 w-full om-text-input"
            >
              {GOAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-400 sm:col-span-2">
            Activity level
            <select
              value={form.activityLevel}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  activityLevel: e.target.value as OnboardingActivityLevel,
                }))
              }
              className="mt-1 w-full om-text-input"
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={!canGenerate || isGeneratingPlan}
          aria-busy={isGeneratingPlan}
          onClick={generatePlan}
          className="relative mt-4 btn-mobile-block-lg gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ButtonPendingContents
            pending={isGeneratingPlan}
            spinner={<ButtonSpinner />}
          >
            Calculate suggested targets
          </ButtonPendingContents>
        </button>
      </Card>

      {generatedPlan ? (
        <div ref={step2Ref}>
          <Card>
            <h2 className="text-sm font-semibold text-white">
              Step 2: Apply suggested targets
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-400">
              Daily target (kcal)
              <input
                inputMode="numeric"
                disabled={isGeneratingPlan}
                value={generatedPlan.dailyTargetKcal}
                onChange={(e) =>
                  setGeneratedPlan((plan) =>
                    plan
                      ? {
                          ...plan,
                          dailyTargetKcal: Number(e.target.value),
                        }
                      : plan,
                  )
                }
                className="mt-1 w-full om-text-input"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              Protein target (g)
              <input
                inputMode="decimal"
                disabled={isGeneratingPlan}
                value={generatedPlan.proteinTargetG}
                onChange={(e) =>
                  setGeneratedPlan((plan) =>
                    plan
                      ? {
                          ...plan,
                          proteinTargetG: Number(e.target.value),
                        }
                      : plan,
                  )
                }
                className="mt-1 w-full om-text-input"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              Fats target (g)
              <input
                inputMode="decimal"
                disabled={isGeneratingPlan}
                value={generatedPlan.fatsTargetG}
                onChange={(e) =>
                  setGeneratedPlan((plan) =>
                    plan
                      ? {
                          ...plan,
                          fatsTargetG: Number(e.target.value),
                        }
                      : plan,
                  )
                }
                className="mt-1 w-full om-text-input"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              Carbs target (g)
              <input
                inputMode="decimal"
                disabled={isGeneratingPlan}
                value={generatedPlan.carbsTargetG}
                onChange={(e) =>
                  setGeneratedPlan((plan) =>
                    plan
                      ? {
                          ...plan,
                          carbsTargetG: Number(e.target.value),
                        }
                      : plan,
                  )
                }
                className="mt-1 w-full om-text-input"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={isSaving || !canApply || isGeneratingPlan}
            aria-busy={isSaving}
            onClick={() =>
              void (async () => {
                try {
                  await updateProfile({
                    birthDate: form.birthDate,
                    gender: form.gender,
                    unitsPreference: form.unitsPreference,
                    height: form.height,
                    weight: form.weight,
                    dailyTargetKcal: generatedPlan.dailyTargetKcal,
                    proteinTargetG: generatedPlan.proteinTargetG,
                    carbsTargetG: generatedPlan.carbsTargetG,
                    fatsTargetG: generatedPlan.fatsTargetG,
                  });
                  await clearOnboardingDraft();
                  await completeOnboarding();
                  await navigate({ to: "/" });
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Could not save targets.",
                  );
                }
              })()
            }
            className="relative mt-4 btn-mobile-block-lg gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={isSaving}
              spinner={<ButtonSpinner />}
            >
              Use these targets
            </ButtonPendingContents>
          </button>
        </Card>
        </div>
      ) : null}
    </div>
  );
}
