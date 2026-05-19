import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { paths } from "@/lib/routes";
import { Camera, ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function DescribeMealPage() {
  const { t } = useTranslation();
  const { analyzing, runDescribeMeal } = useMealScanFlow();
  const [description, setDescription] = useState("");
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

  const clearPhoto = useCallback(() => {
    setPhotoInputKey((k) => k + 1);
    setPhotoChoice((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (photoChoice?.previewUrl) URL.revokeObjectURL(photoChoice.previewUrl);
    };
  }, [photoChoice?.previewUrl]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("addMeal.describeTitle")}
        backTo={paths.add.root}
        backAriaLabel={t("addMeal.backToAddMeal")}
        subtitle={t("addMeal.describeSubtitle")}
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void runDescribeMeal(description, photoChoice?.file ?? null);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">
              {t("addMeal.description")}
            </span>
            <textarea
              name="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("addMeal.descriptionPlaceholder")}
              autoComplete="off"
              disabled={analyzing}
              className="max-h-[min(16rem,calc(100vh-22rem))] min-h-[7.5rem] w-full resize-y mk-text-input"
            />
          </label>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="block text-sm text-mk-muted">
                {t("common.photo")}{" "}
                <span className="font-normal text-zinc-500">
                  {t("common.optional")}
                </span>
              </span>
              {photoChoice ? (
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={clearPhoto}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                >
                  <X className="size-3.5 shrink-0" aria-hidden />
                  {t("common.clearPhoto")}
                </button>
              ) : null}
            </div>
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
                  <img
                    src={photoChoice.previewUrl}
                    alt={t("common.mealPhotoPreview")}
                    className="size-full object-cover"
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
                  disabled={analyzing}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                >
                  <Camera className="size-4 text-emerald-400 md:size-5" />
                  {t("common.takePhoto")}
                </button>
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
                >
                  <ImagePlus className="size-4 text-orange-500 md:size-5" />
                  {t("common.chooseFromGallery")}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={analyzing || description.trim().length === 0}
            aria-busy={analyzing}
            className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents
              pending={analyzing}
              spinner={<ButtonSpinner />}
            >
              {t("addMeal.estimate")}
            </ButtonPendingContents>
          </button>
        </form>
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
