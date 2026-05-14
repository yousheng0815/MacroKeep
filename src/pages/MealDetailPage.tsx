import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { formatLocalDateLabel, formatTime } from "@/lib/date";
import { fileToBase64 } from "@/lib/file-to-base64";
import {
  canSyncToDriveAppData,
  ensureGoogleAccessToken,
} from "@/lib/gapi";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import { paths } from "@/lib/routes";
import {
  Link,
  useNavigate,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  CopyPlus,
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
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

export function MealDetailPage() {
  const { mealId } = useParams({ strict: false });
  const navigate = useNavigate();
  const router = useRouter();
  const { records, addMeal, updateMeal, deleteMeal, ensureMealIdLoaded, addSavedMealFromMeal } =
    useRecords();

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

  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [saveToSavedPending, setSaveToSavedPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPhoto, setEditPhoto] = useState<EditPhotoState>({ mode: "unchanged" });
  const [fileInputKey, setFileInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setEditing(false);
    setEditPhoto((prev) => {
      if (prev.mode === "replacement" && prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { mode: "unchanged" };
    });
  }, [mealId]);

  useEffect(() => {
    if (!editing) return;
    setEditPhoto((prev) => {
      if (prev.mode === "replacement" && prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { mode: "unchanged" };
    });
    setFileInputKey((k) => k + 1);
  }, [editing, mealId]);

  const revokeEditPhotoPreview = useCallback((state: EditPhotoState) => {
    if (state.mode === "replacement" && state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
  }, []);

  const endEditing = useCallback(() => {
    setEditPhoto((prev) => {
      revokeEditPhotoPreview(prev);
      return { mode: "unchanged" };
    });
    setEditing(false);
  }, [revokeEditPhotoPreview]);

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
            className="inline-flex items-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
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
        {editing ? (
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
                  setEditing(false);
                  toast.success("Meal saved");
                } catch (err) {
                  if (orphanUploadId) {
                    try {
                      const token = await ensureGoogleAccessToken();
                      if (token)
                        await deleteDriveFile(token, orphanUploadId);
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
              <span className="mb-1 block text-sm text-om-muted">
                Food name
              </span>
              <input
                name="foodName"
                type="text"
                defaultValue={meal.food_name}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-om-muted">
                Recorded at
              </span>
              <input
                name="recordedAt"
                type="datetime-local"
                defaultValue={toLocalDateTimeInput(meal.recordedAt)}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>

            <div className="space-y-2">
              <span className="block text-sm text-om-muted">Photo</span>
              <input
                key={`cam-${fileInputKey}`}
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPickEditPhoto(e.target.files, e.currentTarget)}
              />
              <input
                key={`lib-${fileInputKey}`}
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickEditPhoto(e.target.files, e.currentTarget)}
              />
              <div className="flex items-start gap-3 rounded-xl border border-om-border bg-om-bg p-3 md:items-center md:gap-5 md:p-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-zinc-700 md:size-28">
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
                      className="size-full shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800"
                    />
                  ) : (
                    <MealPhotoThumb
                      alt="No meal photo"
                      className="size-full shrink-0 overflow-hidden rounded-lg border-0"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
                  <button
                    type="button"
                    disabled={savePending}
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                  >
                    <Camera className="size-4 text-emerald-400 md:size-5" />
                    {meal.photoFileId ? "Retake" : "Take photo"}
                  </button>
                  <button
                    type="button"
                    disabled={savePending}
                    onClick={() => uploadInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                  >
                    <ImagePlus className="size-4 text-orange-500 md:size-5" />
                    {meal.photoFileId
                      ? "Replace from library"
                      : "Upload from library"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm text-om-muted">
                  Calories
                </span>
                <input
                  name="calories"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  defaultValue={meal.calories}
                  className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-om-muted">
                  Protein (g)
                </span>
                <input
                  name="protein"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  defaultValue={meal.protein}
                  className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-om-muted">
                  Fats (g)
                </span>
                <input
                  name="fats"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  defaultValue={meal.fats}
                  className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-om-muted">
                  Carbs (g)
                </span>
                <input
                  name="carbs"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  defaultValue={meal.carbs}
                  className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
                />
              </label>
            </div>

            <div className="btn-pair-row pt-1">
              <button
                type="submit"
                disabled={savePending || deletePending || saveToSavedPending}
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
                disabled={savePending || deletePending || saveToSavedPending}
                onClick={() => endEditing()}
                className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="mb-1 block text-sm text-om-muted">
                Food name
              </span>
              <p className="text-sm text-zinc-100">{meal.food_name}</p>
            </div>

            <div>
              <span className="mb-1 block text-sm text-om-muted">
                Recorded at
              </span>
              <p className="text-sm text-zinc-100">
                {formatLocalDateLabel(new Date(meal.recordedAt))} at{" "}
                {formatTime(new Date(meal.recordedAt))}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <span className="mb-1 block text-sm text-om-muted">Fats (g)</span>
                <p className="text-sm text-zinc-100">{meal.fats}</p>
              </div>
              <div>
                <span className="mb-1 block text-sm text-om-muted">
                  Carbs (g)
                </span>
                <p className="text-sm text-zinc-100">{meal.carbs}</p>
              </div>
            </div>

            <div className="btn-pair-row pt-1">
              <button
                type="button"
                disabled={savePending || deletePending || saveToSavedPending}
                onClick={() => {
                  setEditing(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil className="size-4" />
                Edit meal
              </button>

              <button
                type="button"
                disabled={savePending || deletePending || saveToSavedPending}
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

            <div className="mt-4 border-t border-om-border pt-4">
              <button
                type="button"
                disabled={
                  savePending ||
                  deletePending ||
                  saveToSavedPending ||
                  duplicatePending
                }
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
                  savePending ||
                  deletePending ||
                  saveToSavedPending ||
                  duplicatePending
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
                className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ButtonPendingContents
                  pending={saveToSavedPending}
                  spinner={<ButtonSpinner className="text-amber-200" />}
                >
                  <Bookmark className="size-4" />
                  Add to saved meals
                </ButtonPendingContents>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
