import {
  canSyncToDriveAppData,
  fetchGoogleProfileBirthDate,
  getAccessToken,
  getGoogleUserId,
} from "@/lib/gapi";
import {
  deleteAllAppDataFiles,
  deleteDriveFile,
  monthKeyFromRecordedAt,
  normalizeRecordsDocument,
  persistRecordsToDrive,
  pullMealsFromDriveShards,
  pullRecordsCoreFromDrive,
  resolveMealsShardDriveFileId,
  uploadMealPhotoToAppData,
} from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import type { PreparedMealPhoto } from "@/types/meal-scan";
import type {
  MealRecord,
  OnboardingDraft,
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

type RecordsCoreQueryData = {
  core: RecordsCoreDocument;
  coreOnPrimaryDriveFile: boolean;
};

export function useRecords() {
  const qc = useQueryClient();
  const [mealWriteBusy, setMealWriteBusy] = useState(false);

  const userId = getGoogleUserId() ?? "";

  const coreQuery = useQuery({
    queryKey: ["records-core", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<RecordsCoreQueryData> => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing Google access token");

      const pulled = await pullRecordsCoreFromDrive(token);
      if (!pulled.core) {
        const initial = emptyRecords();
        const googleBirth = await fetchGoogleProfileBirthDate(token);
        if (googleBirth) initial.profile.birthDate = googleBirth;
        await persistRecordsToDrive(token, initial);
        return {
          core: splitNormalized(initial).core,
          coreOnPrimaryDriveFile: true,
        };
      }
      return {
        core: pulled.core,
        coreOnPrimaryDriveFile: pulled.coreOnPrimaryDriveFile,
      };
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
      mealsOnly?: boolean;
      mealMonthKeysToSync?: string[];
      shardFileIdsPrefetched?: Readonly<Record<string, string | null>>;
    }) => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = getAccessToken();
      if (!token) throw new Error("Missing access token");
      const uid = getGoogleUserId() ?? "";
      const boot = qc.getQueryData<RecordsCoreQueryData>(["records-core", uid]);
      await persistRecordsToDrive(token, payload.next, {
        coreOnly: payload.coreOnly,
        mealsOnly: payload.mealsOnly,
        mealMonthKeysToSync: payload.mealMonthKeysToSync,
        skipLegacyCoreMigration:
          !!(payload.mealsOnly && boot?.coreOnPrimaryDriveFile),
        shardFileIdsPrefetched: payload.shardFileIdsPrefetched,
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
      qc.setQueryData<RecordsCoreQueryData>(["records-core", uid], {
        core,
        coreOnPrimaryDriveFile: true,
      });
      qc.setQueryData(["records-meals", uid], meals);
    },
  });

  const records = useMemo((): RecordsDocument => {
    const boot = coreQuery.data;
    if (!boot) return emptyRecords();
    const meals = mealsQuery.data ?? [];
    return normalizeRecordsDocument({ ...boot.core, meals });
  }, [coreQuery.data, mealsQuery.data]);

  const geminiKey = coreQuery.data?.core.geminiApiKey ?? "";

  const getCurrentRecords = useCallback((): RecordsDocument => {
    const uid = getGoogleUserId();
    if (!uid) return emptyRecords();
    const boot = qc.getQueryData<RecordsCoreQueryData>(["records-core", uid]);
    if (!boot?.core) return emptyRecords();
    const meals = qc.getQueryData<MealRecord[]>(["records-meals", uid]);
    return normalizeRecordsDocument({ ...boot.core, meals: meals ?? [] });
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
        /**
         * Optional id for multi-phase flows (e.g. upload photo in parallel with AI).
         * When omitted, `addMeal` generates one.
         */
        id?: string;
        recordedAt?: string;
      },
      options?: {
        photo?: { base64: string; mimeType: string };
        /** When set, skips photo upload (photo already exists in Drive App Data). */
        photoFileId?: string;
        /** Skips re-encoding when the scan flow already ran {@link prepareMealPhotoForUpload}. */
        preparedPhoto?: PreparedMealPhoto;
      },
    ): Promise<string> => {
      setMealWriteBusy(true);
      await yieldForUiPaint();
      try {
        const prev = getCurrentRecords();
        const id = meal.id ?? crypto.randomUUID?.() ?? String(Date.now());
        const recordedAt = meal.recordedAt ?? new Date().toISOString();
        const mealMonthKey = monthKeyFromRecordedAt(recordedAt);

        if (options?.photoFileId) {
          if (!canSyncToDriveAppData()) {
            throw new Error("Not signed in or Drive scope unavailable");
          }
          const token = getAccessToken();
          if (!token) throw new Error("Missing access token");
          const shardDriveId = await resolveMealsShardDriveFileId(token, mealMonthKey);

          const rowWithPhoto: MealRecord = {
            id,
            food_name: meal.food_name,
            calories: meal.calories,
            protein: meal.protein,
            fats: meal.fats,
            carbs: meal.carbs,
            recordedAt,
            photoFileId: options.photoFileId,
            ...(meal.isFavorite ? { isFavorite: true } : {}),
            ...(meal.sourceFavoriteMealId
              ? { sourceFavoriteMealId: meal.sourceFavoriteMealId }
              : {}),
          };

          const nextWithPhoto: RecordsDocument = {
            ...prev,
            meals: [rowWithPhoto, ...prev.meals],
          };

          await replaceMutation.mutateAsync({
            next: nextWithPhoto,
            mealsOnly: true,
            mealMonthKeysToSync: [mealMonthKey],
            shardFileIdsPrefetched: { [mealMonthKey]: shardDriveId },
          });
          return id;
        }

        if (options?.preparedPhoto || options?.photo) {
          if (!canSyncToDriveAppData()) {
            throw new Error("Not signed in or Drive scope unavailable");
          }
          const token = getAccessToken();
          if (!token) throw new Error("Missing access token");
          const prepared = options.preparedPhoto
            ? options.preparedPhoto
            : await prepareMealPhotoForUpload(
                options.photo!.base64,
                options.photo!.mimeType,
              );
          const [uploadedPhotoId, shardDriveId] = await Promise.all([
            uploadMealPhotoToAppData(
              token,
              id,
              prepared.base64,
              prepared.mimeType,
            ),
            resolveMealsShardDriveFileId(token, mealMonthKey),
          ]);

          const rowWithPhoto: MealRecord = {
            id,
            food_name: meal.food_name,
            calories: meal.calories,
            protein: meal.protein,
            fats: meal.fats,
            carbs: meal.carbs,
            recordedAt,
            photoFileId: uploadedPhotoId,
            ...(meal.isFavorite ? { isFavorite: true } : {}),
            ...(meal.sourceFavoriteMealId
              ? { sourceFavoriteMealId: meal.sourceFavoriteMealId }
              : {}),
          };

          const nextWithPhoto: RecordsDocument = {
            ...prev,
            meals: [rowWithPhoto, ...prev.meals],
          };

          await replaceMutation.mutateAsync({
            next: nextWithPhoto,
            mealsOnly: true,
            mealMonthKeysToSync: [mealMonthKey],
            shardFileIdsPrefetched: { [mealMonthKey]: shardDriveId },
          });
          return id;
        }

        const row: MealRecord = {
          id,
          food_name: meal.food_name,
          calories: meal.calories,
          protein: meal.protein,
          fats: meal.fats,
          carbs: meal.carbs,
          recordedAt,
          ...(meal.isFavorite ? { isFavorite: true } : {}),
          ...(meal.sourceFavoriteMealId
            ? { sourceFavoriteMealId: meal.sourceFavoriteMealId }
            : {}),
        };

        const next: RecordsDocument = {
          ...prev,
          meals: [row, ...prev.meals],
        };
        await replaceMutation.mutateAsync({
          next,
          mealsOnly: true,
          mealMonthKeysToSync: [mealMonthKey],
        });
        return id;
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
      if (!removed) throw new Error("Meal not found");
      const photoId = removed.photoFileId;
      const thumbId = removed.thumbnailFileId;
      const next: RecordsDocument = {
        ...prev,
        meals: prev.meals.filter((m) => m.id !== id),
      };
      await replaceMutation.mutateAsync({
        next,
        mealsOnly: true,
        mealMonthKeysToSync: [monthKeyFromRecordedAt(removed.recordedAt)],
      });
      if ((photoId || thumbId) && canSyncToDriveAppData()) {
        const token = getAccessToken();
        if (token) {
          try {
            const photoStillReferenced =
              !!photoId &&
              next.meals.some(
                (m) => m.photoFileId === photoId || m.thumbnailFileId === photoId,
              );
            const thumbStillReferenced =
              !!thumbId &&
              next.meals.some(
                (m) => m.thumbnailFileId === thumbId || m.photoFileId === thumbId,
              );
            if (photoId && !photoStillReferenced) await deleteDriveFile(token, photoId);
            if (thumbId && !thumbStillReferenced) await deleteDriveFile(token, thumbId);
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
          | "food_name"
          | "calories"
          | "protein"
          | "fats"
          | "carbs"
          | "recordedAt"
          | "isFavorite"
          | "sourceFavoriteMealId"
        >
      > & {
        /** New Drive file id, or `null` / empty string to drop the meal photo. */
        photoFileId?: string | null;
        thumbnailFileId?: string | null;
      },
    ) => {
      const prev = getCurrentRecords();
      const hasTarget = prev.meals.some((m) => m.id === id);
      if (!hasTarget) throw new Error("Meal not found");
      const prevMeal = prev.meals.find((m) => m.id === id)!;
      const oldPhotoId = prevMeal.photoFileId;
      const oldThumbId = prevMeal.thumbnailFileId;

      const {
        photoFileId: patchPhoto,
        thumbnailFileId: patchThumb,
        ...scalarPatch
      } = patch;

      const updated: MealRecord = { ...prevMeal, ...scalarPatch };

      if ("photoFileId" in patch) {
        if (patchPhoto === null || patchPhoto === "") {
          delete updated.photoFileId;
          delete updated.thumbnailFileId;
        } else if (typeof patchPhoto === "string") {
          updated.photoFileId = patchPhoto;
          delete updated.thumbnailFileId;
        }
      } else if ("thumbnailFileId" in patch) {
        if (patchThumb === null || patchThumb === "") {
          delete updated.thumbnailFileId;
        } else if (typeof patchThumb === "string") {
          updated.thumbnailFileId = patchThumb;
        }
      }

      const monthKeys = new Set<string>();
      monthKeys.add(
        monthKeyFromRecordedAt(
          patch.recordedAt ?? updated.recordedAt ?? prevMeal.recordedAt,
        ),
      );
      if (
        patch.recordedAt !== undefined &&
        patch.recordedAt !== prevMeal.recordedAt
      ) {
        monthKeys.add(monthKeyFromRecordedAt(prevMeal.recordedAt));
      }
      const next: RecordsDocument = {
        ...prev,
        meals: prev.meals.map((m) => (m.id === id ? updated : m)),
      };
      await replaceMutation.mutateAsync({
        next,
        mealsOnly: true,
        mealMonthKeysToSync: [...monthKeys],
      });

      const newPhotoId = updated.photoFileId;
      const newThumbId = updated.thumbnailFileId;
      const photoRefsChanged =
        oldPhotoId !== newPhotoId || oldThumbId !== newThumbId;
      if (photoRefsChanged && canSyncToDriveAppData()) {
        const token = getAccessToken();
        if (token) {
          const mealsAfter = next.meals;
          const deleteIfUnreferenced = async (
            fileId: string | undefined,
            replacementPrimary: string | undefined,
          ) => {
            if (!fileId || fileId === replacementPrimary) return;
            const still = mealsAfter.some(
              (m) => m.photoFileId === fileId || m.thumbnailFileId === fileId,
            );
            if (!still) {
              try {
                await deleteDriveFile(token, fileId);
              } catch {
                /* best-effort */
              }
            }
          };
          await deleteIfUnreferenced(oldPhotoId, newPhotoId);
          await deleteIfUnreferenced(oldThumbId, newThumbId);
        }
      }
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

  const completeOnboarding = useCallback(async () => {
    const prev = getCurrentRecords();
    if (prev.onboardingCompleted) return;
    const next: RecordsDocument = {
      ...prev,
      onboardingCompleted: true,
    };
    delete next.onboardingDraft;
    await replaceMutation.mutateAsync({ next, coreOnly: true });
  }, [getCurrentRecords, replaceMutation]);

  const saveOnboardingDraft = useCallback(
    async (draft: OnboardingDraft) => {
      const prev = getCurrentRecords();
      const next: RecordsDocument = {
        ...prev,
        onboardingDraft: draft,
      };
      await replaceMutation.mutateAsync({ next, coreOnly: true });
    },
    [getCurrentRecords, replaceMutation],
  );

  const clearOnboardingDraft = useCallback(async () => {
    const prev = getCurrentRecords();
    if (!prev.onboardingDraft) return;
    const next: RecordsDocument = {
      ...prev,
    };
    delete next.onboardingDraft;
    await replaceMutation.mutateAsync({ next, coreOnly: true });
  }, [getCurrentRecords, replaceMutation]);

  const resetLocal = useCallback(async () => {
    const prev = getCurrentRecords();
    const fresh: RecordsDocument = {
      ...emptyRecords(),
      ...(prev.geminiApiKey ? { geminiApiKey: prev.geminiApiKey } : {}),
    };
    await replaceMutation.mutateAsync({ next: fresh });
  }, [getCurrentRecords, replaceMutation]);

  const wipeAllRemoteData = useCallback(async () => {
    if (!canSyncToDriveAppData()) {
      throw new Error("Not signed in or Drive scope unavailable");
    }
    const token = getAccessToken();
    if (!token) throw new Error("Missing access token");
    const { deleted, failures } = await deleteAllAppDataFiles(token);
    if (failures.length > 0) {
      throw new Error(
        `Deleted ${deleted} file(s), but ${failures.length} failed (e.g. ${failures[0].name}: ${failures[0].message}).`,
      );
    }
    const uid = getGoogleUserId();
    if (uid) {
      qc.invalidateQueries({ queryKey: ["records-core", uid] });
      qc.invalidateQueries({ queryKey: ["records-meals", uid] });
      qc.invalidateQueries({ queryKey: ["drive-app-files", uid] });
    }
  }, [qc]);

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
    /** True once core Drive JSON (`core.json`) has been loaded or created for this account. */
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
    completeOnboarding,
    saveOnboardingDraft,
    clearOnboardingDraft,
    resetLocal,
    wipeAllRemoteData,
    isSaving: replaceMutation.isPending || mealWriteBusy,
  };
}
