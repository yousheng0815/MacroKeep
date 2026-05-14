import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { canSyncToDriveAppData, ensureGoogleAccessToken } from "@/lib/gapi";
import { analyzeFoodPhoto } from "@/lib/gemini";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

export const MISSING_GEMINI_API_KEY_ERROR =
  "To estimate macros from a photo, add your Gemini API key in Settings.";

export function useMealScanFlow() {
  const { geminiKey, addMeal } = useRecords();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);

  const hasKey = useMemo(() => geminiKey.trim().length > 0, [geminiKey]);

  const showMissingGeminiKeyToast = useCallback(() => {
    toast.error(MISSING_GEMINI_API_KEY_ERROR, {
      action: {
        label: "Open Settings",
        onClick: () => {
          void navigate({ to: paths.settings });
        },
      },
    });
  }, [navigate]);

  const runAnalyzeSnapshot = useCallback(
    async (base64: string, mimeType: string) => {
      if (!hasKey) {
        showMissingGeminiKeyToast();
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
        toast.error(e instanceof Error ? e.message : "Analysis failed");
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
    [addMeal, geminiKey, hasKey, navigate, showMissingGeminiKeyToast],
  );

  const runAnalyzeFromFile = useCallback(
    async (file: File) => {
      try {
        const { base64, mimeType } = await fileToBase64(file);
        await runAnalyzeSnapshot(base64, mimeType);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Analysis failed");
      }
    },
    [runAnalyzeSnapshot],
  );

  const ensureKeyForPhotoScan = useCallback(() => {
    if (hasKey) return true;
    showMissingGeminiKeyToast();
    return false;
  }, [hasKey, showMissingGeminiKeyToast]);

  return {
    analyzing,
    hasKey,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
    ensureKeyForPhotoScan,
  };
}
