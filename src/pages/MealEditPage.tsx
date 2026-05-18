import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { fileToBase64 } from "@/lib/file-to-base64";
import { canSyncToDriveAppData, ensureGoogleAccessToken } from "@/lib/gapi";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import { paths, type MealDetailNavFrom } from "@/lib/routes";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Camera, ImagePlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EditPhotoState =
  | { mode: "unchanged" }
  | { mode: "replacement"; file: File; previewUrl: string };

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

export function MealEditPage() {
  const { mealId } = useParams({ strict: false });
  const navigate = useNavigate();
  const navFrom = useRouterState({
    select: (s) =>
      (s.location.state as { navFrom?: MealDetailNavFrom } | undefined)
        ?.navFrom,
  });

  const {
    records,
    updateMeal,
    ensureMealIdLoaded,
    isMealsLoading,
    isLoadingMoreMeals,
  } = useRecords();

  const [mealLookup, setMealLookup] = useState<"pending" | "ready">("pending");
  const [savePending, setSavePending] = useState(false);
  const [editPhoto, setEditPhoto] = useState<EditPhotoState>({
    mode: "unchanged",
  });
  const [fileInputKey, setFileInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setEditPhoto((prev) => {
      if (prev.mode === "replacement" && prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { mode: "unchanged" };
    });
    setFileInputKey((k) => k + 1);
  }, [mealId]);

  const meal = useMemo(
    () => records.meals.find((m) => m.id === mealId),
    [records.meals, mealId],
  );

  const navFromResolved = navFrom ?? paths.history;

  const goToDetail = useCallback(() => {
    if (!mealId) return;
    void navigate({
      to: paths.mealDetail,
      params: { mealId },
      replace: true,
      state: { navFrom: navFromResolved },
    });
  }, [mealId, navigate, navFromResolved]);

  const onPickEditPhoto = useCallback(
    (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setFileInputKey((k) => k + 1);
      setEditPhoto((prev) => {
        if (prev.mode === "replacement" && prev.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return {
          mode: "replacement",
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
    },
    [],
  );

  const revokeEditPhotoPreview = useCallback((state: EditPhotoState) => {
    if (state.mode === "replacement" && state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
  }, []);

  const mealStillLoading =
    mealLookup === "pending" || isMealsLoading || isLoadingMoreMeals;

  if (!meal) {
    if (mealStillLoading) {
      return (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2
              className="size-8 animate-spin text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-mk-muted">Loading meal…</p>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-mk-muted">This meal could not be found.</p>
          <Link
            to={paths.history}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
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
        title="Edit meal"
        onBack={goToDetail}
        backAriaLabel="Back to meal details"
      />

      <Card>
        <form
          key={meal.id}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setSavePending(true);
              let orphanUploadId: string | null = null;
              try {
                const form = new FormData(e.currentTarget);
                const foodName = String(form.get("foodName") ?? "").trim();
                const calories = String(form.get("calories") ?? "0");
                const protein = String(form.get("protein") ?? "0");
                const fats = String(form.get("fats") ?? "0");
                const carbs = String(form.get("carbs") ?? "0");
                const recordedAtLocal = String(form.get("recordedAt") ?? "");

                const basePatch = {
                  food_name: foodName || meal.food_name,
                  calories: parseNumber(calories),
                  protein: parseNumber(protein),
                  fats: parseNumber(fats),
                  carbs: parseNumber(carbs),
                  recordedAt: toIsoFromLocalDateTimeInput(recordedAtLocal),
                };

                if (editPhoto.mode === "replacement") {
                  if (!canSyncToDriveAppData()) {
                    throw new Error(
                      "Sign in with Google Drive access to attach a meal photo.",
                    );
                  }
                  const token = await ensureGoogleAccessToken();
                  if (!token) throw new Error("Missing access token");
                  const { base64, mimeType } = await fileToBase64(
                    editPhoto.file,
                  );
                  const prepared = await prepareMealPhotoForUpload(
                    base64,
                    mimeType,
                  );
                  const newPhotoId = await uploadMealPhotoToAppData(
                    token,
                    meal.id,
                    prepared.base64,
                    prepared.mimeType,
                  );
                  orphanUploadId = newPhotoId;
                  await updateMeal(meal.id, {
                    ...basePatch,
                    photoFileId: newPhotoId,
                  });
                } else {
                  await updateMeal(meal.id, basePatch);
                }

                orphanUploadId = null;
                revokeEditPhotoPreview(editPhoto);
                setEditPhoto({ mode: "unchanged" });
                toast.success("Meal saved");
                goToDetail();
              } catch (err) {
                if (orphanUploadId) {
                  try {
                    const token = await ensureGoogleAccessToken();
                    if (token) await deleteDriveFile(token, orphanUploadId);
                  } catch {
                    /* best-effort */
                  }
                }
                toast.error(
                  err instanceof Error ? err.message : "Could not save meal.",
                );
              } finally {
                setSavePending(false);
              }
            })();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">Food name</span>
            <input
              name="foodName"
              type="text"
              defaultValue={meal.food_name}
              className="w-full mk-text-input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">Recorded at</span>
            <input
              name="recordedAt"
              type="datetime-local"
              defaultValue={toLocalDateTimeInput(meal.recordedAt)}
              className="w-full mk-text-input"
            />
          </label>

          <div className="space-y-2">
            <span className="block text-sm text-mk-muted">Photo</span>
            <input
              key={`cam-${fileInputKey}`}
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) =>
                onPickEditPhoto(e.target.files, e.currentTarget)
              }
            />
            <input
              key={`lib-${fileInputKey}`}
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                onPickEditPhoto(e.target.files, e.currentTarget)
              }
            />
            <div className="mk-photo-field-panel">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-700 md:size-32">
                {editPhoto.mode === "replacement" ? (
                  <img
                    src={editPhoto.previewUrl}
                    alt="New meal photo preview"
                    className="size-full object-cover"
                  />
                ) : meal.photoFileId ? (
                  <MealPhotoThumb
                    photoFileId={meal.photoFileId}
                    alt={meal.food_name}
                    cachePolicy={{
                      tier: "log",
                      recordedAt: meal.recordedAt,
                    }}
                    className="size-full shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                  />
                ) : (
                  <MealPhotoThumb
                    alt="No meal photo"
                    className="size-full shrink-0 overflow-hidden rounded-xl border-0"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
                <button
                  type="button"
                  disabled={savePending}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                >
                  <Camera className="size-4 text-emerald-400 md:size-5" />
                  Take a photo
                </button>
                <button
                  type="button"
                  disabled={savePending}
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                >
                  <ImagePlus className="size-4 text-orange-500 md:size-5" />
                  Choose a photo
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">Calories</span>
              <input
                name="calories"
                type="number"
                inputMode="decimal"
                step="1"
                defaultValue={meal.calories}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                Protein (g)
              </span>
              <input
                name="protein"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.protein}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">Fats (g)</span>
              <input
                name="fats"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.fats}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                Carbs (g)
              </span>
              <input
                name="carbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={meal.carbs}
                className="w-full mk-text-input"
              />
            </label>
          </div>

          <div className="btn-pair-row pt-1">
            <button
              type="submit"
              disabled={savePending}
              aria-busy={savePending}
              className="relative flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ButtonPendingContents
                pending={savePending}
                spinner={<ButtonSpinner />}
              >
                Save changes
              </ButtonPendingContents>
            </button>

            <button
              type="button"
              disabled={savePending}
              onClick={() => goToDetail()}
              className="flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
