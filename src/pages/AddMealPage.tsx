import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { consumePendingScanPhoto } from "@/lib/pending-scan-photo";
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
        subtitle="Use a photo, describe what you had, enter macros yourself—or reuse something you've saved or logged before."
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
            className="om-add-tile-btn"
          >
            <Camera className="size-8 shrink-0 text-emerald-400" aria-hidden />
            <span className="text-balance">Take photo & estimate</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!ensureKeyForPhotoScan()) return;
              uploadInputRef.current?.click();
            }}
            className="om-add-tile-btn"
          >
            <ImagePlus className="size-8 shrink-0 text-orange-500" aria-hidden />
            <span className="text-balance">Choose photo & estimate</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.describe })}
            className="om-add-tile-btn"
          >
            <MessageSquareText
              className="size-8 shrink-0 text-fuchsia-400"
              aria-hidden
            />
            <span className="text-balance">Describe meal</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.manual })}
            className="om-add-tile-btn"
          >
            <PenLine className="size-8 shrink-0 text-sky-400" aria-hidden />
            <span className="text-balance">Enter macros manually</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.savedMeals })}
            className="om-add-tile-btn"
          >
            <Bookmark className="size-8 shrink-0 text-amber-400" aria-hidden />
            <span className="text-balance">From saved meals</span>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.history })}
            className="om-add-tile-btn"
          >
            <History className="size-8 shrink-0 text-violet-400" aria-hidden />
            <span className="text-balance">From history</span>
          </button>
        </div>
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
