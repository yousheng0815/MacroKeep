import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { analyzeFoodPhoto } from "@/lib/gemini";
import { prepareMealPhotoPairForUpload } from "@/lib/meal-photo-compress";
import type { MealScanDraft, PreparedMealPhotoPair } from "@/types/meal-scan";
import { useCallback, useMemo, useRef, useState } from "react";

export function useMealScanFlow() {
  const { geminiKey, addMeal, isSaving } = useRecords();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealScanDraft | null>(null);
  /** Same promise as background prep — save awaits this instead of compressing again. */
  const prepareInflightRef = useRef<Promise<PreparedMealPhotoPair> | null>(null);

  const hasKey = useMemo(() => geminiKey.trim().length > 0, [geminiKey]);

  const runAnalyzeSnapshot = useCallback(
    async (base64: string, mimeType: string) => {
      setError(null);
      if (!hasKey) {
        setError("Add your Gemini API key in Settings first.");
        return;
      }
      setAnalyzing(true);
      prepareInflightRef.current = null;
      setDraft(null);
      try {
        const est = await analyzeFoodPhoto(geminiKey, base64, mimeType);
        const snapshot = { base64, mimeType };
        setDraft({
          estimate: est,
          snapshot,
          preparingPhotos: true,
          preparedPhotos: undefined,
          preparedPhotosError: undefined,
        });

        const prepPromise = prepareMealPhotoPairForUpload(base64, mimeType);
        prepareInflightRef.current = prepPromise;

        void prepPromise
          .then((pair) => {
            setDraft((d) =>
              d &&
              d.snapshot.base64 === snapshot.base64 &&
              d.snapshot.mimeType === snapshot.mimeType
                ? {
                    ...d,
                    preparedPhotos: {
                      full: {
                        base64: pair.full.base64,
                        mimeType: pair.full.mimeType,
                      },
                      thumb: {
                        base64: pair.thumb.base64,
                        mimeType: pair.thumb.mimeType,
                      },
                    },
                    preparingPhotos: false,
                    preparedPhotosError: undefined,
                  }
                : d,
            );
          })
          .catch((err) => {
            if (prepareInflightRef.current === prepPromise) {
              prepareInflightRef.current = null;
            }
            const msg =
              err instanceof Error ? err.message : "Photo optimization failed";
            setDraft((d) =>
              d &&
              d.snapshot.base64 === snapshot.base64 &&
              d.snapshot.mimeType === snapshot.mimeType
                ? {
                    ...d,
                    preparingPhotos: false,
                    preparedPhotosError: msg,
                  }
                : d,
            );
          });
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

      let preparedPhotos: PreparedMealPhotoPair | undefined = draft.preparedPhotos;
      if (!preparedPhotos) {
        const inflight = prepareInflightRef.current;
        if (inflight) {
          try {
            const pair = await inflight;
            preparedPhotos = {
              full: {
                base64: pair.full.base64,
                mimeType: pair.full.mimeType,
              },
              thumb: {
                base64: pair.thumb.base64,
                mimeType: pair.thumb.mimeType,
              },
            };
          } catch {
            preparedPhotos = undefined;
          }
        }
        if (!preparedPhotos) {
          const pair = await prepareMealPhotoPairForUpload(
            draft.snapshot.base64,
            draft.snapshot.mimeType,
          );
          preparedPhotos = {
            full: {
              base64: pair.full.base64,
              mimeType: pair.full.mimeType,
            },
            thumb: {
              base64: pair.thumb.base64,
              mimeType: pair.thumb.mimeType,
            },
          };
        }
      }

      await addMeal(
        {
          food_name: draft.estimate.food_name,
          calories: draft.estimate.calories,
          protein: draft.estimate.protein,
          fats: draft.estimate.fats,
          carbs: draft.estimate.carbs,
        },
        { preparedPhotos },
      );
      prepareInflightRef.current = null;
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meal");
    }
  }, [addMeal, draft]);

  const cancelDraft = useCallback(() => {
    prepareInflightRef.current = null;
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
