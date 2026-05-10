import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { useRecords } from "@/hooks/use-records";
import { ageYearsFromIsoBirthDate, isValidIsoBirthDate } from "@/lib/birth-date";
import {
  ensureGoogleAccessToken,
  fetchGoogleProfileBirthDate,
  getGoogleProfileBirthDate,
} from "@/lib/gapi";
import {
  suggestMacroPlan,
  type ActivityLevel,
  type MacroGoal,
  type MacroPlanSuggestion,
} from "@/lib/gemini";
import { DEFAULT_PROFILE } from "@/types/records";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

type TutorialForm = {
  geminiApiKey: string;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  goal: MacroGoal;
  activityLevel: ActivityLevel;
  notes: string;
};

const GOAL_OPTIONS: { value: MacroGoal; label: string }[] = [
  { value: "gain_muscle", label: "Gain muscle" },
  { value: "lose_weight", label: "Lose weight" },
  { value: "maintain_weight", label: "Maintain weight" },
  { value: "improve_health", label: "Improve health" },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary (little or no exercise)" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very active (hard training/physical job)" },
];

export function TutorialPage() {
  const {
    records,
    geminiKey,
    updateGeminiKey,
    updateProfile,
    completeOnboarding,
    saveOnboardingDraft,
    clearOnboardingDraft,
    isSaving,
  } = useRecords();
  const navigate = useNavigate();
  const [form, setForm] = useState<TutorialForm>({
    geminiApiKey: geminiKey,
    birthDate: records.profile.birthDate,
    heightCm: records.profile.heightCm,
    weightKg: records.profile.weightKg,
    goal: "gain_muscle",
    activityLevel: "moderate",
    notes: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] =
    useState<MacroPlanSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [didHydrateFromDraft, setDidHydrateFromDraft] = useState(false);
  const savedGeminiKey = geminiKey.trim();
  const hasSavedKey = savedGeminiKey.length > 0;

  const canGenerate = useMemo(
    () =>
      hasSavedKey &&
      isValidIsoBirthDate(form.birthDate) &&
      form.heightCm > 0 &&
      form.weightKg > 0 &&
      !isGenerating,
    [form, hasSavedKey, isGenerating],
  );

  useEffect(() => {
    if (didHydrateFromDraft) return;
    if (records.onboardingDraft) return;
    if (records.profile.birthDate !== DEFAULT_PROFILE.birthDate) return;

    let cancelled = false;
    void (async () => {
      const token = await ensureGoogleAccessToken();
      if (!token) return;
      await fetchGoogleProfileBirthDate(token);
      if (cancelled) return;
      const google = getGoogleProfileBirthDate();
      if (google) setForm((prev) => ({ ...prev, birthDate: google }));
    })();
    return () => {
      cancelled = true;
    };
  }, [didHydrateFromDraft, records.onboardingDraft, records.profile.birthDate]);

  useEffect(() => {
    if (didHydrateFromDraft) return;
    const draft = records.onboardingDraft;
    if (!draft) return;
    const timer = window.setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        birthDate: draft.birthDate,
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        goal: draft.goal,
        activityLevel: draft.activityLevel,
        notes: draft.notes ?? "",
      }));
      setGeneratedPlan({
        dailyTargetKcal: draft.suggestedDailyTargetKcal,
        proteinTargetG: draft.suggestedProteinTargetG,
        fatsTargetG: draft.suggestedFatsTargetG,
        carbsTargetG: draft.suggestedCarbsTargetG,
        rationale: draft.suggestedRationale,
      });
      setDidHydrateFromDraft(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [didHydrateFromDraft, records.onboardingDraft]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="rounded-2xl border border-om-border bg-om-surface px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Logo className="text-base" />
          <span className="rounded-full border border-om-border bg-om-bg px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            Setup
          </span>
        </div>
        <h1 className="mt-3 text-xl font-bold text-white">Set your targets</h1>
        <p className="mt-1 text-sm text-om-muted">
          Add your Gemini API key, describe your goal, generate suggested
          calories/macros, then save them as your daily targets.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-white">
          Step 1: Gemini API key
        </h2>
        <p className="mt-1 text-xs text-om-muted">
          Need a key?{" "}
          <a
            className="text-blue-400 underline-offset-2 hover:underline"
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
          >
            Create one in Google AI Studio
          </a>
          .
        </p>
        <label className="mt-3 block text-xs text-zinc-400">
          API key
          <input
            value={form.geminiApiKey}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))
            }
            placeholder="AIza..."
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <button
          type="button"
          disabled={isSaving}
          aria-busy={isSaving}
          onClick={() =>
            void (async () => {
              setError(null);
              try {
                await updateGeminiKey(form.geminiApiKey);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save Gemini API key.",
                );
              }
            })()
          }
          className="relative mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ButtonPendingContents
            pending={isSaving}
            spinner={<ButtonSpinner />}
          >
            Save key
          </ButtonPendingContents>
        </button>
      </Card>

      {hasSavedKey && (
        <Card>
          <h2 className="text-sm font-semibold text-white">
            Step 2: Profile + goal
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Birthday
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, birthDate: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Height (cm)
              <input
                inputMode="decimal"
                value={form.heightCm}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    heightCm: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Weight (kg)
              <input
                inputMode="decimal"
                value={form.weightKg}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    weightKg: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Goal
              <select
                value={form.goal}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    goal: e.target.value as MacroGoal,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              >
                {GOAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Activity level
              <select
                value={form.activityLevel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    activityLevel: e.target.value as ActivityLevel,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              >
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Extra notes (optional)
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Example: vegetarian, 4 lifting sessions/week"
                rows={3}
                className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/60"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={!canGenerate}
            aria-busy={isGenerating}
            onClick={() =>
              void (async () => {
                setError(null);
                setGeneratedPlan(null);
                setIsGenerating(true);
                try {
                  const plan = await suggestMacroPlan(savedGeminiKey, {
                    age: ageYearsFromIsoBirthDate(form.birthDate),
                    heightCm: form.heightCm,
                    weightKg: form.weightKg,
                    goal: form.goal,
                    activityLevel: form.activityLevel,
                    notes: form.notes.trim() || undefined,
                  });
                  await saveOnboardingDraft({
                    birthDate: form.birthDate,
                    age: ageYearsFromIsoBirthDate(form.birthDate),
                    heightCm: form.heightCm,
                    weightKg: form.weightKg,
                    goal: form.goal,
                    activityLevel: form.activityLevel,
                    notes: form.notes.trim() || undefined,
                    suggestedDailyTargetKcal: plan.dailyTargetKcal,
                    suggestedProteinTargetG: plan.proteinTargetG,
                    suggestedFatsTargetG: plan.fatsTargetG,
                    suggestedCarbsTargetG: plan.carbsTargetG,
                    suggestedRationale: plan.rationale,
                    suggestedAt: new Date().toISOString(),
                  });
                  setGeneratedPlan(plan);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not generate macro targets.",
                  );
                } finally {
                  setIsGenerating(false);
                }
              })()
            }
            className="relative mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={isGenerating}
              spinner={<ButtonSpinner />}
            >
              Generate targets with Gemini
            </ButtonPendingContents>
          </button>
        </Card>
      )}

      {generatedPlan ? (
        <Card>
          <h2 className="text-sm font-semibold text-white">
            Step 3: Apply suggested targets
          </h2>
          <p className="mt-2 text-xs text-om-muted">
            {generatedPlan.rationale}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-om-border bg-om-bg p-3 text-sm text-white">
              Calories:{" "}
              <span className="font-semibold">
                {generatedPlan.dailyTargetKcal} kcal
              </span>
            </div>
            <div className="rounded-xl border border-om-border bg-om-bg p-3 text-sm text-white">
              Protein:{" "}
              <span className="font-semibold">
                {generatedPlan.proteinTargetG} g
              </span>
            </div>
            <div className="rounded-xl border border-om-border bg-om-bg p-3 text-sm text-white">
              Carbs:{" "}
              <span className="font-semibold">
                {generatedPlan.carbsTargetG} g
              </span>
            </div>
            <div className="rounded-xl border border-om-border bg-om-bg p-3 text-sm text-white">
              Fats:{" "}
              <span className="font-semibold">
                {generatedPlan.fatsTargetG} g
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={() =>
              void (async () => {
                setError(null);
                try {
                  await updateProfile({
                    birthDate: form.birthDate,
                    heightCm: form.heightCm,
                    weightKg: form.weightKg,
                    dailyTargetKcal: generatedPlan.dailyTargetKcal,
                    proteinTargetG: generatedPlan.proteinTargetG,
                    carbsTargetG: generatedPlan.carbsTargetG,
                    fatsTargetG: generatedPlan.fatsTargetG,
                  });
                  await clearOnboardingDraft();
                  await completeOnboarding();
                  await navigate({ to: "/" });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not save targets.",
                  );
                }
              })()
            }
            className="relative mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={isSaving}
              spinner={<ButtonSpinner />}
            >
              Use these targets
            </ButtonPendingContents>
          </button>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <p className="text-xs text-zinc-500">
        You can always fine tune in Settings.
      </p>
    </div>
  );
}
