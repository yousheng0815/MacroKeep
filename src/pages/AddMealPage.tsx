import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Camera,
  History,
  ImagePlus,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

export function AddMealPage() {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { analyzing, runAnalyzeFromFile, ensureKeyForPhotoScan } =
    useMealScanFlow();

  const onPick = useCallback(
    async (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file) return;
      await runAnalyzeFromFile(file);
    },
    [runAnalyzeFromFile],
  );

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("addMeal.pageTitle")}
        subtitle={t("addMeal.pageSubtitle")}
      />

      <Card>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onPick(e.target.files, e.currentTarget)}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files, e.currentTarget)}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              if (!ensureKeyForPhotoScan()) return;
              cameraInputRef.current?.click();
            }}
            className="mk-add-tile-btn"
          >
            <Camera className="size-8 shrink-0 text-emerald-400" aria-hidden />
            <span className="text-balance">{t("addMeal.takePhotoEstimate")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!ensureKeyForPhotoScan()) return;
              uploadInputRef.current?.click();
            }}
            className="mk-add-tile-btn"
          >
            <ImagePlus
              className="size-8 shrink-0 text-orange-500"
              aria-hidden
            />
            <span className="text-balance">{t("addMeal.choosePhotoEstimate")}</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.describe })}
            className="mk-add-tile-btn"
          >
            <MessageSquareText
              className="size-8 shrink-0 text-fuchsia-400"
              aria-hidden
            />
            <span className="text-balance">{t("addMeal.describeEstimate")}</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.manual })}
            className="mk-add-tile-btn"
          >
            <PenLine className="size-8 shrink-0 text-sky-400" aria-hidden />
            <span className="text-balance">{t("addMeal.enterManually")}</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.savedMeals })}
            className="mk-add-tile-btn"
          >
            <Bookmark className="size-8 shrink-0 text-amber-400" aria-hidden />
            <span className="text-balance">{t("addMeal.fromSavedMeals")}</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.history })}
            className="mk-add-tile-btn"
          >
            <History className="size-8 shrink-0 text-violet-400" aria-hidden />
            <span className="text-balance">{t("addMeal.fromHistory")}</span>
          </button>
        </div>
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
