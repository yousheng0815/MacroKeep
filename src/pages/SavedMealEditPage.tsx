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
import { comboEditorReturnTo } from "@/lib/combo-draft";
import { countComboRefsForSavedMeal } from "@/lib/saved-combo-utils";
import type { SavedMealRecord } from "@/types/records";
import { isSavedMeal } from "@/types/records";
import type { ComboItemFlowSearch } from "@/pages/ComboAddSavedMealsPage";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Camera, ImagePlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type EditPhotoState =
  | { mode: "unchanged" }
  | { mode: "replacement"; file: File; previewUrl: string };

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SavedMealEditFormProps = {
  saved: SavedMealRecord;
  comboRefCount: number;
  updateSavedMeal: ReturnType<typeof useRecords>["updateSavedMeal"];
  restoreSavedMeal: ReturnType<typeof useRecords>["restoreSavedMeal"];
  onDone: () => void;
};

function SavedMealEditForm({
  saved,
  comboRefCount,
  updateSavedMeal,
  restoreSavedMeal,
  onDone,
}: SavedMealEditFormProps) {
  const { t } = useTranslation();
  const [savePending, setSavePending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
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
      {saved.archived ? (
        <div className="mb-4 space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-100">
            {t("meals.archivedSavedMealBanner", { count: comboRefCount })}
          </p>
          <button
            type="button"
            disabled={restorePending || savePending}
            aria-busy={restorePending}
            onClick={() => {
              void (async () => {
                setRestorePending(true);
                try {
                  await restoreSavedMeal(saved.id);
                  toast.success(t("meals.restoredToSavedMeals"));
                  onDone();
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : t("errors.couldNotSaveChanges"),
                  );
                } finally {
                  setRestorePending(false);
                }
              })();
            }}
            className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/50 disabled:opacity-50"
          >
            {t("meals.addBackToSavedMeals")}
          </button>
        </div>
      ) : null}
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
                toast.error(t("common.enterFoodName"));
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
                    t("errors.signInForPhoto"),
                  );
                }
                const token = await ensureGoogleAccessToken();
                if (!token) throw new Error(t("errors.missingAccessToken"));
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
              toast.success(t("errors.savedMealUpdated"));
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
                err instanceof Error ? err.message : t("errors.couldNotSaveChanges"),
              );
            } finally {
              setSavePending(false);
            }
          })();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-mk-muted">{t("common.foodName")}</span>
          <input
            name="foodName"
            type="text"
            defaultValue={saved.food_name}
            className="w-full mk-text-input"
          />
        </label>

        <div className="space-y-2">
          <span className="block text-sm text-mk-muted">{t("common.photo")}</span>
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
                <MealPhotoThumb
                  previewSrc={editPhoto.previewUrl}
                  alt={t("common.newMealPhotoPreview")}
                  enlargeOnClick
                  className="size-full shrink-0 overflow-hidden rounded-xl border-0 bg-zinc-800"
                />
              ) : saved.photoFileId ? (
                <MealPhotoThumb
                  photoFileId={saved.photoFileId}
                  alt={saved.food_name}
                  enlargeOnClick
                  cachePolicy={{ tier: "saved" }}
                  className="size-full shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                />
              ) : (
                <MealPhotoThumb
                  alt={t("common.noMealPhoto")}
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
                {t("common.takePhoto")}
              </button>
              <button
                type="button"
                disabled={savePending}
                onClick={() => uploadInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
              >
                <ImagePlus className="size-4 text-orange-500 md:size-5" />
                {t("common.choosePhoto")}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">{t("common.calories")}</span>
            <input
              name="calories"
              type="number"
              inputMode="decimal"
              step="1"
              defaultValue={saved.calories}
              className="w-full mk-text-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">
              {t("common.proteinG")}
            </span>
            <input
              name="protein"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={saved.protein}
              className="w-full mk-text-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">{t("common.fatsG")}</span>
            <input
              name="fats"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={saved.fats}
              className="w-full mk-text-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">{t("common.carbsG")}</span>
            <input
              name="carbs"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={saved.carbs}
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
              {t("common.saveChanges")}
            </ButtonPendingContents>
          </button>

          <button
            type="button"
            disabled={savePending}
            onClick={() => onDone()}
            className="flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function SavedMealEditPage() {
  const { t } = useTranslation();
  const { savedMealId } = useParams({ strict: false });
  const search = useSearch({ strict: false }) as ComboItemFlowSearch;
  const navigate = useNavigate();
  const {
    savedQuickAdds,
    isSavedMealsLoading,
    savedMealsError,
    updateSavedMeal,
    restoreSavedMeal,
  } = useRecords();

  const fromCombo = search.context === "new" || Boolean(search.comboId);
  const returnTo = fromCombo
    ? comboEditorReturnTo(search)
    : paths.add.savedMealsManage;
  const backAriaLabel = fromCombo
    ? t("meals.backToComboEditor")
    : t("meals.backToSavedMealsManage");

  const saved = useMemo(
    () =>
      savedQuickAdds.find(
        (s) => isSavedMeal(s) && s.id === savedMealId,
      ),
    [savedQuickAdds, savedMealId],
  );

  const comboRefCount = useMemo(
    () => (saved ? countComboRefsForSavedMeal(savedQuickAdds, saved.id) : 0),
    [saved, savedQuickAdds],
  );

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : t("errors.couldNotLoadSavedMealsDrive"),
    );
  }, [savedMealsError]);

  const goBack = useCallback(() => {
    void navigate({ to: returnTo });
  }, [navigate, returnTo]);

  if (!savedMealId) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-mk-muted">{t("meals.invalidLink")}</p>
          <Link
            to={returnTo}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            {backAriaLabel}
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
          <p className="text-sm text-mk-muted">{t("meals.loadingSavedMeal")}</p>
        </div>
      </Card>
    );
  }

  if (!saved || !isSavedMeal(saved)) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-mk-muted">
            {t("meals.savedMealNotFound")}
          </p>
          <Link
            to={returnTo}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            {backAriaLabel}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("meals.editSavedMealTitle")}
        onBack={goBack}
        backAriaLabel={backAriaLabel}
        subtitle={t("meals.editSavedMealSubtitle")}
      />

      <SavedMealEditForm
        key={saved.id}
        saved={saved}
        comboRefCount={comboRefCount}
        updateSavedMeal={updateSavedMeal}
        restoreSavedMeal={restoreSavedMeal}
        onDone={goBack}
      />
    </div>
  );
}
