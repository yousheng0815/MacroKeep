import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import { paths } from "@/lib/routes";
import { isArchivedSavedMealMatchError } from "@/lib/saved-quick-add-errors";
import { exitSubflow } from "@/lib/subflow-nav";
import { useRouter } from "@tanstack/react-router";
import { Camera, ImagePlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SavedMealNewPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addSavedMeal, restoreSavedMeal } = useRecords();
  const [savePending, setSavePending] = useState(false);
  const [restoreOffer, setRestoreOffer] = useState<{
    mealId: string;
    foodName: string;
    comboRefCount: number;
  } | null>(null);
  const [photoChoice, setPhotoChoice] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = useCallback(
    (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setPhotoInputKey((k) => k + 1);
      setPhotoChoice((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (photoChoice?.previewUrl) URL.revokeObjectURL(photoChoice.previewUrl);
    };
  }, [photoChoice?.previewUrl]);

  return (
    <div className="min-w-0 space-y-6">
      <ConfirmDialog
        open={restoreOffer !== null}
        title={t("meals.restoreSavedMealTitle")}
        description={
          restoreOffer ? (
            <div className="space-y-2">
              <p>
                {t("meals.restoreSavedMealBody", {
                  foodName: restoreOffer.foodName,
                  count: restoreOffer.comboRefCount,
                })}
              </p>
            </div>
          ) : null
        }
        confirmLabel={t("meals.restoreSavedMealAction")}
        cancelLabel={t("common.cancel")}
        pending={savePending}
        onConfirm={() => {
          if (!restoreOffer) return;
          void (async () => {
            setSavePending(true);
            try {
              await restoreSavedMeal(restoreOffer.mealId);
              toast.success(t("meals.restoredToSavedMeals"));
              setRestoreOffer(null);
              exitSubflow(router, paths.add.savedMealsManage);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : t("errors.couldNotSaveChanges"),
              );
            } finally {
              setSavePending(false);
            }
          })();
        }}
        onCancel={() => setRestoreOffer(null)}
      />

      <PageHeader
        title={t("meals.addSavedMealPageTitle")}
        onBack={() => exitSubflow(router, paths.add.savedMealsManage)}
        backAriaLabel={t("meals.backToSavedMealsManage")}
        subtitle={t("meals.addSavedMealSubtitle")}
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
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
              setSavePending(true);
              try {
                const photoOpts = photoChoice
                  ? { photo: await fileToBase64(photoChoice.file) }
                  : undefined;
                await addSavedMeal(
                  {
                    food_name: foodName,
                    calories: parseNumber(calories),
                    protein: parseNumber(protein),
                    fats: parseNumber(fats),
                    carbs: parseNumber(carbs),
                  },
                  photoOpts,
                );
                toast.success(t("errors.savedMealAdded"));
                exitSubflow(router, paths.add.savedMealsManage);
              } catch (err) {
                if (isArchivedSavedMealMatchError(err)) {
                  setRestoreOffer({
                    mealId: err.meal.id,
                    foodName: err.meal.food_name,
                    comboRefCount: err.comboRefCount,
                  });
                  return;
                }
                toast.error(
                  err instanceof Error
                    ? err.message
                    : t("errors.couldNotAddSavedMeal"),
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
              autoComplete="off"
              placeholder={t("common.placeholderFoodName")}
              className="w-full mk-text-input"
            />
          </label>

          <div className="space-y-2">
            <span className="block text-sm text-mk-muted">
              {t("common.photoOptional")}
            </span>
            <input
              key={`cam-${photoInputKey}`}
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
            />
            <input
              key={`lib-${photoInputKey}`}
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
            />
            <div className="mk-photo-field-panel">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-700 md:size-32">
                {photoChoice ? (
                  <MealPhotoThumb
                    previewSrc={photoChoice.previewUrl}
                    alt={t("common.mealPhotoPreview")}
                    enlargeOnClick
                    className="size-full shrink-0 overflow-hidden rounded-xl border-0 bg-zinc-800/80"
                  />
                ) : (
                  <MealPhotoThumb
                    alt={t("common.noMealPhotoYet")}
                    className="size-full shrink-0 overflow-hidden rounded-xl border-0 bg-zinc-800/80"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-none md:flex-row md:flex-wrap md:gap-3">
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
                defaultValue={0}
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
                defaultValue={0}
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
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                {t("common.carbsG")}
              </span>
              <input
                name="carbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={savePending}
            aria-busy={savePending}
            className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents
              pending={savePending}
              spinner={<ButtonSpinner />}
            >
              {t("common.save")}
            </ButtonPendingContents>
          </button>
        </form>
      </Card>
    </div>
  );
}
