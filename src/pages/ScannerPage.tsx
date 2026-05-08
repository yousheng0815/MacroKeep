import { Card } from "@/components/Card";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { useRecords } from "@/hooks/use-records";
import { consumePendingScanPhoto } from "@/lib/pending-scan-photo";
import type { MealRecord } from "@/types/records";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QuickAddTemplate = {
  key: string;
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  sourceFavoriteMealId: string;
  sourcePhotoFileId?: string;
};

function getQuickAddTemplates(meals: MealRecord[]): QuickAddTemplate[] {
  const seenFavoriteNames = new Set<string>();
  return [...meals]
    .sort(
      (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
    )
    .filter((m) => m.isFavorite)
    .filter((m) => {
      const key = m.food_name.trim().toLowerCase();
      if (!key) return false;
      if (seenFavoriteNames.has(key)) return false;
      seenFavoriteNames.add(key);
      return true;
    })
    .slice(0, 8)
    .map((m) => ({
      key: `fav:${m.id}`,
      food_name: m.food_name,
      calories: m.calories,
      protein: m.protein,
      fats: m.fats,
      carbs: m.carbs,
      sourceFavoriteMealId: m.id,
      // Prefer primary id; fallback to legacy thumbnail-only records.
      sourcePhotoFileId: m.photoFileId ?? m.thumbnailFileId,
    }));
}

export function ScannerPage() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { records, addMeal } = useRecords();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddPendingKey, setQuickAddPendingKey] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const {
    analyzing,
    error,
    hasKey,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
  } = useMealScanFlow();
  const quickAddTemplates = useMemo(
    () => getQuickAddTemplates(records.meals),
    [records.meals],
  );

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

  const onQuickAdd = useCallback(
    async (template: QuickAddTemplate) => {
      setQuickAddError(null);
      setQuickAddPendingKey(template.key);
      try {
        const mealId = await addMeal({
          food_name: template.food_name,
          calories: template.calories,
          protein: template.protein,
          fats: template.fats,
          carbs: template.carbs,
          sourceFavoriteMealId: template.sourceFavoriteMealId,
          // Favorite meals are source meals; newly logged instances stay regular meals.
        }, {
          photoFileId: template.sourcePhotoFileId,
        });
        await navigate({
          to: "/meals/$mealId",
          params: { mealId },
        });
      } catch (e) {
        setQuickAddError(e instanceof Error ? e.message : "Could not add meal.");
      } finally {
        setQuickAddPendingKey(null);
      }
    },
    [addMeal, navigate],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Add Meal</h1>
        <p className="mt-1 text-sm text-om-muted">
          Add meals by scanning a photo or selecting one from your favorite
          meals.
        </p>
      </div>

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

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <Camera className="size-5 text-emerald-400" />
            Take photo
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <ImagePlus className="size-5 text-orange-500" />
            Upload from library
          </button>
          <button
            type="button"
            onClick={() => setShowQuickAdd((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <Star className="size-5 text-amber-400" />
            Add from favorites
          </button>
        </div>

        {showQuickAdd ? (
          <div className="mt-4 space-y-3 rounded-xl border border-om-border bg-om-bg/70 p-3">
            {quickAddTemplates.length > 0 ? (
              quickAddTemplates.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={quickAddPendingKey !== null}
                  onClick={() => void onQuickAdd(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 px-3 py-2 text-left transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {item.food_name}
                    </div>
                    <div className="mt-0.5 text-xs text-om-muted">
                      {Math.round(item.calories)} kcal · P {Math.round(item.protein)} g
                      · F {Math.round(item.fats)} g · C {Math.round(item.carbs)} g
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-300">
                    {quickAddPendingKey === item.key ? "Adding..." : null}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-om-muted">
                No favorite meals yet. Open a meal in History and mark it as
                favorite to build quick-add options.
              </p>
            )}
            {quickAddError ? (
              <p className="text-sm text-red-400">{quickAddError}</p>
            ) : null}
          </div>
        ) : null}

        {!hasKey ? (
          <p className="mt-4 text-sm text-amber-400">
            Configure your Gemini API key under{" "}
            <Link to="/tutorial" className="underline underline-offset-2">
              Setup Tutorial
            </Link>{" "}
            (or Settings) to enable scanning.
          </p>
        ) : null}

        {error && !analyzing ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : null}
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
