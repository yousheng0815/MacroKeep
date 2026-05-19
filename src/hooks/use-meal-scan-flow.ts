import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { canSyncToDriveAppData, ensureGoogleAccessToken } from "@/lib/gapi";
import { analyzeFoodFromDescription, analyzeFoodPhoto } from "@/lib/gemini";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import i18n from "@/i18n";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

export const MISSING_GEMINI_API_KEY_ERROR = "addMeal.missingGeminiKey";

export function useMealScanFlow() {
  const { geminiKey, addMeal } = useRecords();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);

  const hasKey = useMemo(() => geminiKey.trim().length > 0, [geminiKey]);

  const showMissingGeminiKeyToast = useCallback(() => {
    toast.error(i18n.t(MISSING_GEMINI_API_KEY_ERROR), {
      action: {
        label: i18n.t("addMeal.openSettings"),
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
          throw new Error(i18n.t("errors.notSignedInDrive"));
        }
        const token = await ensureGoogleAccessToken();
        if (!token) throw new Error(i18n.t("errors.missingAccessToken"));

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
        toast.error(
          e instanceof Error ? e.message : i18n.t("addMeal.estimateFailed"),
        );
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

  const runDescribeMeal = useCallback(
    async (description: string, photoFile: File | null) => {
      const trimmed = description.trim();
      if (!trimmed) {
        toast.error(i18n.t("addMeal.describeBeforeEstimate"));
        return;
      }
      if (!hasKey) {
        showMissingGeminiKeyToast();
        return;
      }

      setAnalyzing(true);
      let nextMealId: string | null = null;
      let uploadedPhotoId: string | null = null;
      try {
        if (!canSyncToDriveAppData()) {
          throw new Error(i18n.t("errors.notSignedInDrive"));
        }
        const token = await ensureGoogleAccessToken();
        if (!token) throw new Error(i18n.t("errors.missingAccessToken"));

        const mealId = crypto.randomUUID?.() ?? String(Date.now());
        const recordedAt = new Date().toISOString();

        let imageForModel: { base64: string; mimeType: string } | undefined;
        if (photoFile) {
          const raw = await fileToBase64(photoFile);
          const snapshot = await prepareMealPhotoForUpload(
            raw.base64,
            raw.mimeType,
          );
          imageForModel = {
            base64: snapshot.base64,
            mimeType: snapshot.mimeType,
          };

          const [analysisRes, uploadRes] = await Promise.allSettled([
            analyzeFoodFromDescription(geminiKey, trimmed, imageForModel),
            uploadMealPhotoToAppData(
              token,
              mealId,
              snapshot.base64,
              snapshot.mimeType,
            ),
          ]);

          if (analysisRes.status === "rejected") {
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
        } else {
          const est = await analyzeFoodFromDescription(geminiKey, trimmed);
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
          );
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : i18n.t("addMeal.estimateFailed"),
        );
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
        toast.error(
          e instanceof Error ? e.message : i18n.t("addMeal.estimateFailed"),
        );
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
    runDescribeMeal,
    ensureKeyForPhotoScan,
  };
}
