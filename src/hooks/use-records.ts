import { canSyncToDriveAppData, getAccessToken, getGoogleUserId } from "@/lib/gapi";
import {
  deleteDriveFile,
  normalizeRecordsDocument,
  persistRecordsToDrive,
  pullMealsFromDriveShards,
  pullRecordsCoreFromDrive,
  uploadMealPhotoToAppData,
} from "@/lib/google-drive";
import { prepareMealPhotoPairForUpload } from "@/lib/meal-photo-compress";
import type { PreparedMealPhotoPair } from "@/types/meal-scan";
import type {
  MealRecord,
  RecordsCoreDocument,
  RecordsDocument,
  UserProfile,
} from "@/types/records";
import { emptyRecords } from "@/types/records";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

/** Lets React paint loading UI before CPU-heavy image encode / network upload in `addMeal`. */
function yieldForUiPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function splitNormalized(doc: RecordsDocument): {
  core: RecordsCoreDocument;
  meals: MealRecord[];
} {
  const n = normalizeRecordsDocument(doc);
  const { meals, ...core } = n;
  return { core, meals };
}

export function useRecords() {
  const qc = useQueryClient();
  const [mealWriteBusy, setMealWriteBusy] = useState(false);

  const userId = getGoogleUserId() ?? "";

  const coreQuery = useQuery({
    queryKey: ["records-core", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecordsCoreDocument> => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing Google access token");

      const remote = await pullRecordsCoreFromDrive(token);
      if (!remote) {
        const initial = emptyRecords();
        await persistRecordsToDrive(token, initial);
        return splitNormalized(initial).core;
      }
      return remote;
    },
  });

  const mealsQuery = useQuery({
    queryKey: ["records-meals", userId],
    enabled: !!userId && coreQuery.isSuccess,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<MealRecord[]> => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return pullMealsFromDriveShards(token, signal);
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (payload: {
      next: RecordsDocument;
      coreOnly?: boolean;
    }) => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = getAccessToken();
      if (!token) throw new Error("Missing access token");
      await persistRecordsToDrive(token, payload.next, {
        coreOnly: payload.coreOnly,
      });
      return payload.next;
    },
    onMutate: async () => {
      const uid = getGoogleUserId();
      if (uid) await qc.cancelQueries({ queryKey: ["records-meals", uid] });
    },
    onSuccess: (doc) => {
      const uid = getGoogleUserId();
      if (!uid) return;
      const { core, meals } = splitNormalized(doc);
      qc.setQueryData(["records-core", uid], core);
      qc.setQueryData(["records-meals", uid], meals);
    },
  });

  const records = useMemo((): RecordsDocument => {
    const core = coreQuery.data;
    if (!core) return emptyRecords();
    const meals = mealsQuery.data ?? [];
    return normalizeRecordsDocument({ ...core, meals });
  }, [coreQuery.data, mealsQuery.data]);

  const geminiKey = coreQuery.data?.geminiApiKey ?? "";

  const getCurrentRecords = useCallback((): RecordsDocument => {
    const uid = getGoogleUserId();
    if (!uid) return emptyRecords();
    const core = qc.getQueryData<RecordsCoreDocument>(["records-core", uid]);
    const meals = qc.getQueryData<MealRecord[]>(["records-meals", uid]);
    if (!core) return emptyRecords();
    return normalizeRecordsDocument({ ...core, meals: meals ?? [] });
  }, [qc]);

  const updateGeminiKey = useCallback(
    async (key: string) => {
      const prev = getCurrentRecords();
      const trimmed = key.trim();
      const next: RecordsDocument = { ...prev };
      if (trimmed) next.geminiApiKey = trimmed;
      else delete next.geminiApiKey;
      await replaceMutation.mutateAsync({ next, coreOnly: true });
    },
    [getCurrentRecords, replaceMutation],
  );

  const addMeal = useCallback(
    async (
      meal: Omit<
        MealRecord,
        "id" | "recordedAt" | "photoFileId" | "thumbnailFileId"
      > & {
        recordedAt?: string;
      },
      options?: {
        photo?: { base64: string; mimeType: string };
        /** When set, skips compression — uploads these blobs only (see meal scan flow). */
        preparedPhotos?: PreparedMealPhotoPair;
      },
    ) => {
      setMealWriteBusy(true);
      await yieldForUiPaint();
      try {
        const prev = getCurrentRecords();
        const id = crypto.randomUUID?.() ?? String(Date.now());

        let photoFileId: string | undefined;
        let thumbnailFileId: string | undefined;
        if (options?.preparedPhotos || options?.photo) {
          if (!canSyncToDriveAppData()) {
            throw new Error("Not signed in or Drive scope unavailable");
          }
          const token = getAccessToken();
          if (!token) throw new Error("Missing access token");
          const prepared = options.preparedPhotos
            ? options.preparedPhotos
            : await prepareMealPhotoPairForUpload(
                options.photo!.base64,
                options.photo!.mimeType,
              );
          photoFileId = await uploadMealPhotoToAppData(
            token,
            id,
            prepared.full.base64,
            prepared.full.mimeType,
            "full",
          );
          thumbnailFileId = await uploadMealPhotoToAppData(
            token,
            id,
            prepared.thumb.base64,
            prepared.thumb.mimeType,
            "thumb",
          );
        }

        const row: MealRecord = {
          id,
          food_name: meal.food_name,
          calories: meal.calories,
          protein: meal.protein,
          fats: meal.fats,
          carbs: meal.carbs,
          recordedAt: meal.recordedAt ?? new Date().toISOString(),
        };
        if (photoFileId) row.photoFileId = photoFileId;
        if (thumbnailFileId) row.thumbnailFileId = thumbnailFileId;

        const next: RecordsDocument = {
          ...prev,
          meals: [row, ...prev.meals],
        };
        await replaceMutation.mutateAsync({ next });
      } finally {
        setMealWriteBusy(false);
      }
    },
    [getCurrentRecords, replaceMutation],
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      const prev = getCurrentRecords();
      const removed = prev.meals.find((m) => m.id === id);
      const photoId = removed?.photoFileId;
      const thumbId = removed?.thumbnailFileId;
      const next: RecordsDocument = {
        ...prev,
        meals: prev.meals.filter((m) => m.id !== id),
      };
      await replaceMutation.mutateAsync({ next });
      if ((photoId || thumbId) && canSyncToDriveAppData()) {
        const token = getAccessToken();
        if (token) {
          try {
            if (photoId) await deleteDriveFile(token, photoId);
            if (thumbId) await deleteDriveFile(token, thumbId);
          } catch {
            /* Snapshot may remain orphaned in App Data if delete fails. */
          }
        }
      }
    },
    [getCurrentRecords, replaceMutation],
  );

  const updateMeal = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          MealRecord,
          "food_name" | "calories" | "protein" | "fats" | "carbs" | "recordedAt"
        >
      >,
    ) => {
      const prev = getCurrentRecords();
      const hasTarget = prev.meals.some((m) => m.id === id);
      if (!hasTarget) throw new Error("Meal not found");
      const next: RecordsDocument = {
        ...prev,
        meals: prev.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      };
      await replaceMutation.mutateAsync({ next });
    },
    [getCurrentRecords, replaceMutation],
  );

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const prev = getCurrentRecords();
      const next: RecordsDocument = {
        ...prev,
        profile: { ...prev.profile, ...patch },
      };
      await replaceMutation.mutateAsync({ next, coreOnly: true });
    },
    [getCurrentRecords, replaceMutation],
  );

  const resetLocal = useCallback(async () => {
    const prev = getCurrentRecords();
    const fresh: RecordsDocument = {
      ...emptyRecords(),
      ...(prev.geminiApiKey ? { geminiApiKey: prev.geminiApiKey } : {}),
    };
    await replaceMutation.mutateAsync({ next: fresh });
  }, [getCurrentRecords, replaceMutation]);

  const refetch = useCallback(async () => {
    const cr = await coreQuery.refetch();
    if (cr.error) return cr;
    return mealsQuery.refetch();
  }, [coreQuery, mealsQuery]);

  const isMealsLoading =
    coreQuery.isSuccess &&
    (!mealsQuery.isFetched || mealsQuery.isFetching);

  return {
    records,
    userId,
    /** True once `records.json` has been loaded or created for this account. */
    isRecordsReady: coreQuery.isSuccess,
    /** Meal shards still syncing from Drive — show placeholders for meal-derived UI. */
    isMealsLoading,
    mealsError: mealsQuery.error,
    refetchMeals: mealsQuery.refetch,
    isLoading: coreQuery.isLoading,
    isFetching: coreQuery.isFetching || mealsQuery.isFetching,
    refetch,
    error: coreQuery.error,
    geminiKey,
    updateGeminiKey,
    addMeal,
    deleteMeal,
    updateMeal,
    updateProfile,
    resetLocal,
    isSaving: replaceMutation.isPending || mealWriteBusy,
  };
}
