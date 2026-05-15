import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { consumePendingScanPhoto } from "@/lib/pending-scan-photo";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark, Camera, History, ImagePlus, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

export function AddMealPage() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const {
    analyzing,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
    ensureKeyForPhotoScan,
  } = useMealScanFlow();

  useEffect(() => {
    const pending = consumePendingScanPhoto();
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void runAnalyzeSnapshot(pending.base64, pending.mimeType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runAnalyzeSnapshot]);

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
        title="Add Meal"
        subtitle="Estimate macros from a photo, type them in yourself, or reuse a past or saved meal."
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

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              if (!ensureKeyForPhotoScan()) return;
              cameraInputRef.current?.click();
            }}
            className="om-list-row-btn"
          >
            <Camera className="size-5 shrink-0 text-emerald-400" />
            Take a photo to estimate
          </button>
          <button
            type="button"
            onClick={() => {
              if (!ensureKeyForPhotoScan()) return;
              uploadInputRef.current?.click();
            }}
            className="om-list-row-btn"
          >
            <ImagePlus className="size-5 shrink-0 text-orange-500" />
            Choose a photo to estimate
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.savedMeals })}
            className="om-list-row-btn"
          >
            <Bookmark className="size-5 shrink-0 text-amber-400" />
            Add from saved meals
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.history })}
            className="om-list-row-btn"
          >
            <History className="size-5 shrink-0 text-violet-400" />
            Add from history
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.manual })}
            className="om-list-row-btn"
          >
            <PenLine className="size-5 shrink-0 text-sky-400" />
            Enter macros manually
          </button>
        </div>
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
