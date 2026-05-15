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
import { paths } from "@/lib/routes";
import type { SavedMealRecord } from "@/types/records";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Camera, ImagePlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EditPhotoState =
  | { mode: "unchanged" }
  | { mode: "replacement"; file: File; previewUrl: string };

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SavedMealEditFormProps = {
  saved: SavedMealRecord;
  updateSavedMeal: ReturnType<typeof useRecords>["updateSavedMeal"];
  onDone: () => void;
};

function SavedMealEditForm({
  saved,
  updateSavedMeal,
  onDone,
}: SavedMealEditFormProps) {
  const [savePending, setSavePending] = useState(false);
  const [editPhoto, setEditPhoto] = useState<EditPhotoState>({
    mode: "unchanged",
  });
  const [fileInputKey, setFileInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (editPhoto.mode === "replacement" && editPhoto.previewUrl) {
        URL.revokeObjectURL(editPhoto.previewUrl);
      }
    };
  }, [editPhoto]);

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

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setSavePending(true);
            let orphanUploadId: string | null = null;
            try {
              const form = new FormData(e.currentTarget);
              const foodName = String(form.get("foodName") ?? "").trim();
              if (!foodName) {
                toast.error("Enter a food name.");
                return;
              }
              const calories = String(form.get("calories") ?? "0");
              const protein = String(form.get("protein") ?? "0");
              const fats = String(form.get("fats") ?? "0");
              const carbs = String(form.get("carbs") ?? "0");

              const basePatch = {
                food_name: foodName,
                calories: parseNumber(calories),
                protein: parseNumber(protein),
                fats: parseNumber(fats),
                carbs: parseNumber(carbs),
              };

              if (editPhoto.mode === "replacement") {
                if (!canSyncToDriveAppData()) {
                  throw new Error(
                    "Sign in with Google Drive access to attach a meal photo.",
                  );
                }
                const token = await ensureGoogleAccessToken();
                if (!token) throw new Error("Missing access token");
                const { base64, mimeType } = await fileToBase64(editPhoto.file);
                const prepared = await prepareMealPhotoForUpload(
                  base64,
                  mimeType,
                );
                const newPhotoId = await uploadMealPhotoToAppData(
                  token,
                  saved.id,
                  prepared.base64,
                  prepared.mimeType,
                );
                orphanUploadId = newPhotoId;
                await updateSavedMeal(saved.id, {
                  ...basePatch,
                  photoFileId: newPhotoId,
                });
              } else {
                await updateSavedMeal(saved.id, basePatch);
              }

              orphanUploadId = null;
              revokeEditPhotoPreview(editPhoto);
              setEditPhoto({ mode: "unchanged" });
              toast.success("Saved meal updated");
              onDone();
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
                err instanceof Error ? err.message : "Could not save changes.",
              );
            } finally {
              setSavePending(false);
            }
          })();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-om-muted">Food name</span>
          <input
            name="foodName"
            type="text"
            defaultValue={saved.food_name}
            className="w-full om-text-input"
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
          <div className="om-photo-field-panel">
            <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-700 md:size-32">
              {editPhoto.mode === "replacement" ? (
                <img
                  src={editPhoto.previewUrl}
                  alt="New meal photo preview"
                  className="size-full object-cover"
                />
              ) : saved.photoFileId ? (
                <MealPhotoThumb
                  photoFileId={saved.photoFileId}
                  alt={saved.food_name}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
              >
                <Camera className="size-4 text-emerald-400 md:size-5" />
                Take a photo
              </button>
              <button
                type="button"
                disabled={savePending}
                onClick={() => uploadInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
              >
                <ImagePlus className="size-4 text-orange-500 md:size-5" />
                Choose a photo
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-om-muted">Calories</span>
            <input
              name="calories"
              type="number"
              inputMode="decimal"
              step="1"
              defaultValue={saved.calories}
              className="w-full om-text-input"
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
              defaultValue={saved.protein}
              className="w-full om-text-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-om-muted">Fats (g)</span>
            <input
              name="fats"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={saved.fats}
              className="w-full om-text-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-om-muted">Carbs (g)</span>
            <input
              name="carbs"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={saved.carbs}
              className="w-full om-text-input"
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
            onClick={() => onDone()}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

export function SavedMealEditPage() {
  const { savedMealId } = useParams({ strict: false });
  const navigate = useNavigate();
  const {
    savedMeals,
    isSavedMealsLoading,
    savedMealsError,
    updateSavedMeal,
  } = useRecords();

  const saved = useMemo(
    () => savedMeals.find((s) => s.id === savedMealId),
    [savedMeals, savedMealId],
  );

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : "Could not load saved meals from Drive.",
    );
  }, [savedMealsError]);

  const goBackToList = useCallback(() => {
    void navigate({ to: paths.add.savedMeals });
  }, [navigate]);

  if (!savedMealId) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-om-muted">Invalid link.</p>
          <Link
            to={paths.add.savedMeals}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            Back to saved meals
          </Link>
        </div>
      </Card>
    );
  }

  if (isSavedMealsLoading && !saved) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2
            className="size-8 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-om-muted">Loading saved meal…</p>
        </div>
      </Card>
    );
  }

  if (!saved) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-om-muted">
            This saved meal could not be found.
          </p>
          <Link
            to={paths.add.savedMeals}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            Back to saved meals
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Edit saved meal"
        onBack={goBackToList}
        backAriaLabel="Back to saved meals"
        subtitle="Update the name, macros, or photo for this quick-add entry."
      />

      <SavedMealEditForm
        key={saved.id}
        saved={saved}
        updateSavedMeal={updateSavedMeal}
        onDone={goBackToList}
      />
    </div>
  );
}
