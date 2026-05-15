import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { formatLocalDateLabel, formatTime } from "@/lib/date";
import type { MealDetailNavFrom } from "@/lib/routes";
import { paths } from "@/lib/routes";
import { isMealAlreadySavedAsTemplate } from "@/lib/saved-meals-snapshot-match";
import {
  Link,
  useNavigate,
  useParams,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  Check,
  CopyPlus,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function MealDetailPage() {
  const { mealId } = useParams({ strict: false });
  const navigate = useNavigate();
  const router = useRouter();
  const navFrom = useRouterState({
    select: (s) =>
      (s.location.state as { navFrom?: MealDetailNavFrom } | undefined)
        ?.navFrom,
  });
  const navFromResolved = navFrom ?? paths.history;

  const {
    records,
    addMeal,
    deleteMeal,
    ensureMealIdLoaded,
    addSavedMealFromMeal,
    savedMeals,
    isSavedMealsLoading,
    savedMealsError,
  } = useRecords();

  const [mealLookup, setMealLookup] = useState<"pending" | "ready">("pending");

  useEffect(() => {
    if (!mealId) {
      void Promise.resolve().then(() => {
        setMealLookup("ready");
      });
      return;
    }
    void Promise.resolve().then(() => {
      setMealLookup("pending");
    });
    let cancelled = false;
    void (async () => {
      await ensureMealIdLoaded(mealId);
      if (!cancelled) {
        void Promise.resolve().then(() => {
          setMealLookup("ready");
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealId, ensureMealIdLoaded]);

  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
    } else {
      void navigate({ to: paths.history });
    }
  };
  const meal = useMemo(
    () => records.meals.find((m) => m.id === mealId),
    [records.meals, mealId],
  );

  const [deletePending, setDeletePending] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [saveToSavedPending, setSaveToSavedPending] = useState(false);

  const alreadySavedTemplate = useMemo(() => {
    if (!meal || isSavedMealsLoading || savedMealsError) return false;
    return isMealAlreadySavedAsTemplate(meal, savedMeals);
  }, [meal, savedMeals, isSavedMealsLoading, savedMealsError]);

  if (!meal) {
    if (mealLookup === "pending") {
      return (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2
              className="size-8 animate-spin text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-om-muted">Loading meal…</p>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-om-muted">This meal could not be found.</p>
          <Link
            to={paths.history}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            Back to history
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Meal Details"
        onBack={handleBack}
        backAriaLabel="Go back"
      />

      <Card>
        <div className="flex items-start gap-4">
          <MealPhotoThumb
            photoFileId={meal.photoFileId}
            alt={meal.food_name}
            className="size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
          />
          <div className="min-w-0">
            <h1 className="min-w-0 break-words text-xl font-bold text-white">
              {meal.food_name}
            </h1>
            <p className="mt-1 text-sm text-om-muted">
              {formatLocalDateLabel(new Date(meal.recordedAt))} at{" "}
              {formatTime(new Date(meal.recordedAt))}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Nutrition</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-sm text-om-muted">
                  Calories
                </span>
                <p className="text-sm text-zinc-100">{meal.calories}</p>
              </div>
              <div>
                <span className="mb-1 block text-sm text-om-muted">
                  Protein (g)
                </span>
                <p className="text-sm text-zinc-100">{meal.protein}</p>
              </div>
              <div>
                <span className="mb-1 block text-sm text-om-muted">
                  Fats (g)
                </span>
                <p className="text-sm text-zinc-100">{meal.fats}</p>
              </div>
              <div>
                <span className="mb-1 block text-sm text-om-muted">
                  Carbs (g)
                </span>
                <p className="text-sm text-zinc-100">{meal.carbs}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-om-border pt-4">
            <div className="btn-pair-row">
              <button
                type="button"
                disabled={
                  deletePending || saveToSavedPending || duplicatePending
                }
                onClick={() => {
                  void navigate({
                    to: paths.mealEdit,
                    params: { mealId: meal.id },
                    state: { navFrom: navFromResolved },
                  });
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil className="size-4" />
                Edit meal
              </button>

              <button
                type="button"
                disabled={deletePending || saveToSavedPending}
                aria-busy={deletePending}
                className="relative flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  if (!window.confirm("Delete this meal?")) return;
                  void (async () => {
                    setDeletePending(true);
                    try {
                      await deleteMeal(meal.id);
                      await navigate({ to: paths.history });
                    } finally {
                      setDeletePending(false);
                    }
                  })();
                }}
              >
                <ButtonPendingContents
                  pending={deletePending}
                  spinner={<ButtonSpinner className="text-red-200" />}
                >
                  <Trash2 className="size-4" />
                  Delete meal
                </ButtonPendingContents>
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-white">Use again</h2>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            disabled={deletePending || saveToSavedPending || duplicatePending}
            aria-busy={duplicatePending}
            onClick={() => {
              void (async () => {
                setDuplicatePending(true);
                try {
                  await addMeal(
                    {
                      food_name: meal.food_name,
                      calories: meal.calories,
                      protein: meal.protein,
                      fats: meal.fats,
                      carbs: meal.carbs,
                    },
                    meal.photoFileId
                      ? { photoFileId: meal.photoFileId }
                      : undefined,
                  );
                  toast.success("Meal logged again");
                  await navigate({ to: paths.history });
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Could not add this meal again.",
                  );
                } finally {
                  setDuplicatePending(false);
                }
              })();
            }}
            className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents
              pending={duplicatePending}
              spinner={<ButtonSpinner className="text-emerald-200" />}
            >
              <CopyPlus className="size-4" />
              Add this meal again
            </ButtonPendingContents>
          </button>
          <button
            type="button"
            disabled={
              deletePending ||
              saveToSavedPending ||
              duplicatePending ||
              isSavedMealsLoading ||
              alreadySavedTemplate
            }
            title={
              isSavedMealsLoading
                ? "Loading saved meals…"
                : alreadySavedTemplate
                  ? "A saved meal with the same name and macros is already on your list."
                  : undefined
            }
            aria-busy={saveToSavedPending}
            onClick={() => {
              void (async () => {
                setSaveToSavedPending(true);
                try {
                  await addSavedMealFromMeal(meal);
                  toast.success("Added to saved meals", {
                    description:
                      "Use Add → Add from saved meals to log it again anytime.",
                  });
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Could not add to saved meals.",
                  );
                } finally {
                  setSaveToSavedPending(false);
                }
              })();
            }}
            className={
              alreadySavedTemplate
                ? "relative flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-om-border bg-zinc-900/35 px-4 py-3 text-sm font-semibold text-om-muted opacity-90"
                : "relative flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/35 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            <ButtonPendingContents
              pending={saveToSavedPending}
              spinner={<ButtonSpinner className="text-amber-200" />}
            >
              {alreadySavedTemplate ? (
                <>
                  <Check className="size-4 shrink-0 text-zinc-400" />
                  Already saved
                </>
              ) : (
                <>
                  <Bookmark className="size-4 shrink-0" />
                  Add to saved meals
                </>
              )}
            </ButtonPendingContents>
          </button>
        </div>
      </Card>
    </div>
  );
}
