import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { analyzeFoodPhoto } from "@/lib/gemini";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import type { MealScanDraft } from "@/types/meal-scan";
import { useCallback, useMemo, useState } from "react";

export function useMealScanFlow() {
  const { geminiKey, addMeal, isSaving } = useRecords();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealScanDraft | null>(null);

  const hasKey = useMemo(() => geminiKey.trim().length > 0, [geminiKey]);

  const runAnalyzeSnapshot = useCallback(
    async (base64: string, mimeType: string) => {
      setError(null);
      if (!hasKey) {
        setError("Add your Gemini API key in Settings first.");
        return;
      }
      setAnalyzing(true);
      setDraft(null);
      try {
        const snapshot = await prepareMealPhotoForUpload(base64, mimeType);
        const est = await analyzeFoodPhoto(
          geminiKey,
          snapshot.base64,
          snapshot.mimeType,
        );
        setDraft({ estimate: est, snapshot });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setAnalyzing(false);
      }
    },
    [geminiKey, hasKey],
  );

  const runAnalyzeFromFile = useCallback(
    async (file: File) => {
      try {
        const { base64, mimeType } = await fileToBase64(file);
        await runAnalyzeSnapshot(base64, mimeType);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      }
    },
    [runAnalyzeSnapshot],
  );

  const save = useCallback(async () => {
    if (!draft) return;
    try {
      setError(null);
      await addMeal(
        {
          food_name: draft.estimate.food_name,
          calories: draft.estimate.calories,
          protein: draft.estimate.protein,
          fats: draft.estimate.fats,
          carbs: draft.estimate.carbs,
        },
        { preparedPhoto: draft.snapshot },
      );
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meal");
    }
  }, [addMeal, draft]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    analyzing,
    error,
    draft,
    setDraft,
    hasKey,
    isSaving,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
    save,
    cancelDraft,
    clearError,
  };
}
