import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { Footer } from "@/components/Footer";
import { MacroSummary } from "@/components/MacroSummary";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { ProgressArc } from "@/components/ProgressArc";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { useRecords } from "@/hooks/use-records";
import { formatTime, isSameLocalDay, startOfLocalDay } from "@/lib/date";
import { paths } from "@/lib/routes";
import type { MealRecord } from "@/types/records";
import { Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

function sumToday(meals: MealRecord[]): {
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
} {
  const day = startOfLocalDay(new Date());
  return meals.reduce(
    (acc, m) => {
      const d = new Date(m.recordedAt);
      if (!isSameLocalDay(d, day)) return acc;
      return {
        kcal: acc.kcal + m.calories,
        protein: acc.protein + m.protein,
        fats: acc.fats + m.fats,
        carbs: acc.carbs + m.carbs,
      };
    },
    { kcal: 0, protein: 0, fats: 0, carbs: 0 },
  );
}

function MealsLoadErrorBanner({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void | Promise<unknown>;
}) {
  const [retryPending, setRetryPending] = useState(false);
  const msg =
    error instanceof Error ? error.message : "Could not load meals from Drive.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/25 bg-red-950/35 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left"
    >
      <p className="text-sm text-red-300">{msg}</p>
      <button
        type="button"
        disabled={retryPending}
        aria-busy={retryPending}
        onClick={() =>
          void (async () => {
            setRetryPending(true);
            try {
              await onRetry();
            } finally {
              setRetryPending(false);
            }
          })()
        }
        className="relative btn-mobile-block-sm shrink-0 gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ButtonPendingContents
          pending={retryPending}
          spinner={<ButtonSpinner />}
        >
          Retry
        </ButtonPendingContents>
      </button>
    </div>
  );
}

function MealDerivedPlaceholder({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void | Promise<unknown>;
  children: ReactNode;
}) {
  const [retryPending, setRetryPending] = useState(false);
  if (loading) {
    return (
      <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 py-10">
        <Loader2 className="size-8 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm text-om-muted">Loading meals…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <p className="text-sm text-red-300">
          {error instanceof Error
            ? error.message
            : "Could not load meals from Drive."}
        </p>
        <button
          type="button"
          disabled={retryPending}
          aria-busy={retryPending}
          onClick={() =>
            void (async () => {
              setRetryPending(true);
              try {
                await onRetry();
              } finally {
                setRetryPending(false);
              }
            })()
          }
          className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ButtonPendingContents
            pending={retryPending}
            spinner={<ButtonSpinner />}
          >
            Retry
          </ButtonPendingContents>
        </button>
      </div>
    );
  }
  return children;
}

export function DashboardPage() {
  const { records, geminiKey, isMealsLoading, mealsError, refetchMeals } =
    useRecords();
  const quickCameraInputRef = useRef<HTMLInputElement>(null);
  const { analyzing, runAnalyzeFromFile, ensureKeyForPhotoScan } =
    useMealScanFlow();
  const today = sumToday(records.meals);
  const target = records.profile.dailyTargetKcal;
  const connected = geminiKey.trim().length > 0;

  const mealsToday = useMemo(() => {
    const day = startOfLocalDay(new Date());
    return [...records.meals]
      .filter((m) => isSameLocalDay(new Date(m.recordedAt), day))
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  }, [records.meals]);

  const onQuickCapture = useCallback(
    async (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file) return;
      await runAnalyzeFromFile(file);
    },
    [runAnalyzeFromFile],
  );

  const consumptionPending = isMealsLoading && !mealsError;

  return (
    <div className="min-w-0 space-y-6 pb-6 lg:pb-0">
      {mealsError ? (
        <MealsLoadErrorBanner error={mealsError} onRetry={refetchMeals} />
      ) : null}

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <ProgressArc
              consumed={today.kcal}
              target={target}
              consumptionPending={consumptionPending}
            />
          </Card>

          <Card className="lg:hidden">
            <h2 className="mb-4 text-sm font-semibold text-white">
              Macros today
            </h2>
            <MacroSummary
              proteinG={today.protein}
              fatsG={today.fats}
              carbsG={today.carbs}
              targets={{
                p: records.profile.proteinTargetG,
                f: records.profile.fatsTargetG,
                c: records.profile.carbsTargetG,
              }}
              variant="compact"
              consumptionPending={consumptionPending}
            />
          </Card>

          <Card className="hidden lg:block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Gemini API Key
                </h2>
                <p className="mt-1 text-sm text-om-muted">
                  Needed for photo meal scanning. Configure under Settings —
                  saved with your Drive diary file.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {connected ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-emerald-400">Connected</span>
                  </>
                ) : (
                  <span className="text-zinc-400">Not set</span>
                )}
              </div>
            </div>
            {!connected && (
              <Link
                to={paths.settings}
                className="mt-4 inline-block text-sm text-blue-400 underline underline-offset-4 hover:text-blue-300"
              >
                Add your API key in Settings
              </Link>
            )}
          </Card>
        </div>

        <div className="mt-6 space-y-6 lg:mt-0">
          <Card className="hidden lg:block">
            <h2 className="mb-4 text-sm font-semibold text-white">
              Macros today
            </h2>
            <MacroSummary
              proteinG={today.protein}
              fatsG={today.fats}
              carbsG={today.carbs}
              targets={{
                p: records.profile.proteinTargetG,
                f: records.profile.fatsTargetG,
                c: records.profile.carbsTargetG,
              }}
              variant="expanded"
              consumptionPending={consumptionPending}
            />
          </Card>

          <Card className="lg:mt-0">
            <h2 className="mb-4 text-sm font-semibold text-white">
              Today&apos;s meals
            </h2>
            <MealDerivedPlaceholder
              loading={isMealsLoading}
              error={mealsError}
              onRetry={refetchMeals}
            >
              <ul className="divide-y divide-zinc-800">
                {mealsToday.length === 0 ? (
                  <li className="py-6 text-center text-sm text-om-muted">
                    No meals logged today yet.
                  </li>
                ) : (
                  mealsToday.map((m) => (
                    <li key={m.id}>
                      <Link
                        to={paths.mealDetail}
                        params={{ mealId: m.id }}
                        state={{ navFrom: paths.home }}
                        className="flex items-center gap-3 py-3 transition hover:bg-zinc-900/40"
                      >
                        <MealPhotoThumb
                          photoFileId={m.photoFileId}
                          alt={m.food_name}
                          cachePolicy={{
                            tier: "log",
                            recordedAt: m.recordedAt,
                          }}
                        />
                        <div className="w-0 flex-1">
                          <div className="truncate font-medium text-white">
                            {m.food_name}
                          </div>
                          <div className="text-sm text-om-muted">
                            {formatTime(new Date(m.recordedAt))} ·{" "}
                            {Math.round(m.calories)} kcal
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-zinc-600" />
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </MealDerivedPlaceholder>
          </Card>
        </div>
      </div>

      <input
        ref={quickCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onQuickCapture(e.target.files, e.currentTarget)}
      />
      <button
        type="button"
        onClick={() => {
          if (!ensureKeyForPhotoScan()) return;
          quickCameraInputRef.current?.click();
        }}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-30 inline-flex items-center gap-2 rounded-full bg-emerald-400 p-4 text-sm font-semibold text-black shadow-lg transition hover:bg-emerald-300 lg:hidden"
        aria-label="Quick scan meal photo"
      >
        <Camera className="size-6" />
      </button>

      <MealScanOverlays analyzing={analyzing} />

      <div className="lg:hidden">
        <Footer />
      </div>
    </div>
  );
}
