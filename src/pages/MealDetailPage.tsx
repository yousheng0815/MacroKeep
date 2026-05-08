import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { formatLocalDateLabel, formatTime } from "@/lib/date";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Star, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalDateTimeInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MealDetailPage() {
  const { mealId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { records, updateMeal, deleteMeal } = useRecords();
  const meal = useMemo(
    () => records.meals.find((m) => m.id === mealId),
    [records.meals, mealId],
  );

  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  if (!meal) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-om-muted">This meal could not be found.</p>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            Back to history
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meal Details"
        backTo="/history"
        backAriaLabel="Back to history"
      />

      <Card>
        <div className="flex items-start gap-4">
          <MealPhotoThumb
            photoFileId={meal.photoFileId}
            thumbnailFileId={meal.thumbnailFileId}
            alt={meal.food_name}
            className="size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-zinc-700"
          />
          <div className="min-w-0">
            <h1 className="min-w-0 break-words text-xl font-bold text-white">
              {meal.food_name}
            </h1>
            <p className="mt-1 text-xs text-om-muted">
              {formatLocalDateLabel(new Date(meal.recordedAt))} at{" "}
              {formatTime(new Date(meal.recordedAt))}
            </p>
            {meal.sourceFavoriteMealId ? (
              <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Tag className="size-3.5" />
                From favorite
              </div>
            ) : (
              <button
                type="button"
                disabled={savePending || deletePending || favoritePending}
                onClick={() => {
                  void (async () => {
                    setFavoritePending(true);
                    setSaveNotice(null);
                    try {
                      await updateMeal(meal.id, {
                        isFavorite: !meal.isFavorite,
                      });
                      setSaveNotice(
                        !meal.isFavorite
                          ? "Added to favorites"
                          : "Removed from favorites",
                      );
                    } finally {
                      setFavoritePending(false);
                    }
                  })();
                }}
                className={`mt-2 inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  meal.isFavorite
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20"
                    : "border-om-border bg-om-bg text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Star
                  className={`size-3.5 ${meal.isFavorite ? "fill-current" : ""}`}
                />
                {meal.isFavorite ? "Favorite" : "Add to favorites"}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <form
          key={meal.id}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setSavePending(true);
              setSaveNotice(null);
              try {
                const form = new FormData(e.currentTarget);
                const foodName = String(form.get("foodName") ?? "").trim();
                const calories = String(form.get("calories") ?? "0");
                const protein = String(form.get("protein") ?? "0");
                const fats = String(form.get("fats") ?? "0");
                const carbs = String(form.get("carbs") ?? "0");
                const recordedAtLocal = String(form.get("recordedAt") ?? "");
                await updateMeal(meal.id, {
                  food_name: foodName || meal.food_name,
                  calories: parseNumber(calories),
                  protein: parseNumber(protein),
                  fats: parseNumber(fats),
                  carbs: parseNumber(carbs),
                  recordedAt: toIsoFromLocalDateTimeInput(recordedAtLocal),
                });
                setSaveNotice("Saved");
              } finally {
                setSavePending(false);
              }
            })();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-om-muted">Food name</span>
            <input
              name="foodName"
              type="text"
              defaultValue={meal.food_name}
              className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-om-muted">
              Recorded at
            </span>
            <input
              name="recordedAt"
              type="datetime-local"
              defaultValue={toLocalDateTimeInput(meal.recordedAt)}
              className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-om-muted">Calories</span>
              <input
                name="calories"
                type="number"
                inputMode="decimal"
                step="1"
                defaultValue={meal.calories}
                className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-om-muted">
                Protein (g)
              </span>
              <input
                name="protein"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.protein}
                className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-om-muted">Fats (g)</span>
              <input
                name="fats"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.fats}
                className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-om-muted">
                Carbs (g)
              </span>
              <input
                name="carbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.carbs}
                className="w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={savePending || deletePending || favoritePending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savePending ? <ButtonSpinner /> : null}
              Save changes
            </button>

            <button
              type="button"
              disabled={savePending || deletePending || favoritePending}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (!window.confirm("Delete this meal?")) return;
                void (async () => {
                  setDeletePending(true);
                  try {
                    await deleteMeal(meal.id);
                    await navigate({ to: "/history" });
                  } finally {
                    setDeletePending(false);
                  }
                })();
              }}
            >
              {deletePending ? (
                <ButtonSpinner className="text-red-200" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete meal
            </button>

            {saveNotice ? (
              <span className="text-xs text-emerald-400">{saveNotice}</span>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
