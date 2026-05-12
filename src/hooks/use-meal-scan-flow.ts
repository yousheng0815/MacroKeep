import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { analyzeFoodPhoto } from "@/lib/gemini";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import {
  canSyncToDriveAppData,
  ensureGoogleAccessToken,
} from "@/lib/gapi";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

export function useMealScanFlow() {
  const { geminiKey, addMeal } = useRecords();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKey = useMemo(() => geminiKey.trim().length > 0, [geminiKey]);

  const runAnalyzeSnapshot = useCallback(
    async (base64: string, mimeType: string) => {
      setError(null);
      if (!hasKey) {
        setError("Add your Gemini API key in Settings first.");
        return;
      }
      setAnalyzing(true);
      let nextMealId: string | null = null;
      let uploadedPhotoId: string | null = null;
      try {
        const snapshot = await prepareMealPhotoForUpload(base64, mimeType);

        if (!canSyncToDriveAppData()) {
          throw new Error("Not signed in or Drive scope unavailable");
        }
        const token = await ensureGoogleAccessToken();
        if (!token) throw new Error("Missing access token");

        const mealId = crypto.randomUUID?.() ?? String(Date.now());
        const recordedAt = new Date().toISOString();

        // Parallelize AI analysis + Drive upload to reduce end-to-end scan latency.
        const [analysisRes, uploadRes] = await Promise.allSettled([
          analyzeFoodPhoto(geminiKey, snapshot.base64, snapshot.mimeType),
          uploadMealPhotoToAppData(
            token,
            mealId,
            snapshot.base64,
            snapshot.mimeType,
          ),
        ]);

        if (analysisRes.status === "rejected") {
          // Avoid orphaning an uploaded image when Gemini fails.
          if (uploadRes.status === "fulfilled" && uploadRes.value) {
            uploadedPhotoId = uploadRes.value;
            try {
              await deleteDriveFile(token, uploadedPhotoId);
            } catch {
              /* best-effort */
            }
          }
          throw analysisRes.reason;
        }

        const est = analysisRes.value;
        if (uploadRes.status === "fulfilled") uploadedPhotoId = uploadRes.value;

        nextMealId = await addMeal(
          {
            id: mealId,
            recordedAt,
            food_name: est.food_name,
            calories: est.calories,
            protein: est.protein,
            fats: est.fats,
            carbs: est.carbs,
          },
          { photoFileId: uploadedPhotoId ?? undefined },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
        // If the photo uploaded but meal persistence failed, best-effort clean up.
        if (uploadedPhotoId) {
          try {
            const token = await ensureGoogleAccessToken();
            if (token) await deleteDriveFile(token, uploadedPhotoId);
          } catch {
            /* best-effort */
          }
        }
      } finally {
        setAnalyzing(false);
      }

      if (nextMealId) {
        void navigate({
          to: paths.mealDetail,
          params: { mealId: nextMealId },
          state: { navFrom: paths.add.root },
        });
      }
    },
    [addMeal, geminiKey, hasKey, navigate],
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

  const clearError = useCallback(() => setError(null), []);

  return {
    analyzing,
    error,
    hasKey,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
    clearError,
  };
}
