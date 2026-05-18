import {
  canSyncToDriveAppData,
  ensureGoogleAccessToken,
  getGoogleUserId,
} from "@/lib/gapi";
import {
  copyAppDataPhotoForSavedMeal,
  deleteAllAppDataFiles,
  deleteDriveFile,
  hydrateMealMonthsForPersist,
  listMealShardFilesSortedDesc,
  monthKeyFromRecordedAt,
  normalizeRecordsDocument,
  persistRecordsToDrive,
  pullMealsFromShardRefs,
  pullRecordsCoreFromDrive,
  pullSavedMealsFromDrive,
  resolveMealsShardDriveFileId,
  uploadMealPhotoToAppData,
  upsertSavedMealsToDrive,
} from "@/lib/google-drive";
import { DRIVE_QUERY_STALE_TIME_MS } from "@/lib/drive-query-cache";
import { removeMealPhotoFromCache } from "@/lib/meal-photo-cache-db";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import {
  isMealAlreadySavedAsTemplate,
  savedMealDuplicatesExisting,
} from "@/lib/saved-meals-snapshot-match";
import type { PreparedMealPhoto } from "@/types/meal-scan";
import type {
  MealRecord,
  OnboardingDraft,
  RecordsCoreDocument,
  RecordsDocument,
  SavedMealRecord,
  UserProfile,
} from "@/types/records";
import { emptyRecords } from "@/types/records";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

/** How many newest month shards to download on first meals sync. */
const INITIAL_MEAL_SHARD_MONTHS = 4;
/** How many additional month shards to fetch per history scroll / batch. */
const MEALS_PAGE_MONTH_COUNT = 3;

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

export type RecordsMealsQueryData = {
  meals: MealRecord[];
  /** Months whose shard JSON was fully downloaded. */
  loadedMonthKeys: string[];
  /** All meal shard files on Drive (metadata only), newest month first. */
  shardsOnDriveDesc: { id: string; monthKey: string }[];
  allShardsLoaded: boolean;
};

function mergeMealRecordsById(a: MealRecord[], b: MealRecord[]): MealRecord[] {
  const byId = new Map<string, MealRecord>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) if (!byId.has(m.id)) byId.set(m.id, m);
  const out = [...byId.values()];
  out.sort((x, y) => Date.parse(y.recordedAt) - Date.parse(x.recordedAt));
  return out;
}

function savedMealsReferencePhoto(
  qc: QueryClient,
  userId: string,
  photoId: string,
): boolean {
  const saved = qc.getQueryData<SavedMealRecord[]>(["saved-meals", userId]);
  return saved?.some((s) => s.photoFileId === photoId) ?? false;
}

function pickInitialMealShards(
  sortedDesc: { id: string; monthKey: string }[],
  initialCount: number,
): { id: string; monthKey: string }[] {
  if (sortedDesc.length === 0) return [];
  const byKey = new Map(sortedDesc.map((s) => [s.monthKey, s]));
  const picked = new Map<string, { id: string; monthKey: string }>();
  for (let i = 0; i < Math.min(initialCount, sortedDesc.length); i++) {
    const s = sortedDesc[i];
    picked.set(s.monthKey, s);
  }
  const currentMk = monthKeyFromRecordedAt(new Date().toISOString());
  const cur = byKey.get(currentMk);
  if (cur) picked.set(currentMk, cur);
  return [...picked.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function computeAllShardsLoaded(
  shardsOnDriveDesc: readonly { monthKey: string }[],
  loadedMonthKeys: readonly string[],
): boolean {
  if (shardsOnDriveDesc.length === 0) return true;
  const loaded = new Set(loadedMonthKeys);
  return shardsOnDriveDesc.every((s) => loaded.has(s.monthKey));
}

type ReplaceMutationResult = {
  doc: RecordsDocument;
  hydratedMonthKeysForSync: string[];
};

export function useRecords() {
  const qc = useQueryClient();
  const [mealWriteBusy, setMealWriteBusy] = useState(false);

  const userId = getGoogleUserId() ?? "";

  const coreQuery = useQuery({
    queryKey: ["records-core", userId],
    enabled: !!userId,
    staleTime: DRIVE_QUERY_STALE_TIME_MS,
    queryFn: async (): Promise<RecordsCoreDocument> => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");

      const pulled = await pullRecordsCoreFromDrive(token);
      if (!pulled) {
        const initial = emptyRecords();
        await persistRecordsToDrive(token, initial);
        return splitNormalized(initial).core;
      }
      return pulled;
    },
  });

  const mealsQuery = useQuery({
    queryKey: ["records-meals", userId],
    enabled: !!userId && coreQuery.isSuccess,
    staleTime: DRIVE_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<RecordsMealsQueryData> => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      const shardsOnDriveDesc = await listMealShardFilesSortedDesc(token, signal);
      const initialRefs = pickInitialMealShards(
        shardsOnDriveDesc,
        INITIAL_MEAL_SHARD_MONTHS,
      );
      const meals =
        initialRefs.length > 0
          ? await pullMealsFromShardRefs(token, initialRefs, signal)
          : [];
      const loadedMonthKeys = initialRefs.map((r) => r.monthKey);
      return {
        meals,
        loadedMonthKeys,
        shardsOnDriveDesc,
        allShardsLoaded: computeAllShardsLoaded(shardsOnDriveDesc, loadedMonthKeys),
      };
    },
  });

  const savedMealsQuery = useQuery({
    queryKey: ["saved-meals", userId],
    enabled: !!userId && coreQuery.isSuccess,
    staleTime: DRIVE_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return pullSavedMealsFromDrive(token, signal);
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (payload: {
      next: RecordsDocument;
      coreOnly?: boolean;
      mealsOnly?: boolean;
      mealMonthKeysToSync?: string[];
      shardFileIdsPrefetched?: Readonly<Record<string, string | null>>;
    }): Promise<ReplaceMutationResult> => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      const uid = getGoogleUserId() ?? "";
      let nextDoc = payload.next;
      let hydratedMonthKeysForSync: string[] = [];
      if (payload.mealsOnly && payload.mealMonthKeysToSync?.length) {
        const mealsState = qc.getQueryData<RecordsMealsQueryData>([
          "records-meals",
          uid,
        ]);
        if (mealsState) {
          const { meals: merged, hydratedMonthKeys } =
            await hydrateMealMonthsForPersist(
              token,
              nextDoc.meals,
              payload.mealMonthKeysToSync,
              new Set(mealsState.loadedMonthKeys),
              mealsState.shardsOnDriveDesc,
            );
          nextDoc = { ...nextDoc, meals: merged };
          hydratedMonthKeysForSync = hydratedMonthKeys;
        }
      }

      await persistRecordsToDrive(token, nextDoc, {
        coreOnly: payload.coreOnly,
        mealsOnly: payload.mealsOnly,
        mealMonthKeysToSync: payload.mealMonthKeysToSync,
        shardFileIdsPrefetched: payload.shardFileIdsPrefetched,
      });
      return { doc: nextDoc, hydratedMonthKeysForSync };
    },
    onMutate: async () => {
      const uid = getGoogleUserId();
      if (uid) await qc.cancelQueries({ queryKey: ["records-meals", uid] });
    },
    onSuccess: (data, variables) => {
      const uid = getGoogleUserId();
      if (!uid) return;
      const doc = data.doc;
      const { core, meals } = splitNormalized(doc);
      qc.setQueryData<RecordsCoreDocument>(["records-core", uid], core);

      if (!variables.coreOnly && !variables.mealsOnly) {
        void qc.invalidateQueries({ queryKey: ["records-meals", uid] });
        return;
      }

      if (variables.coreOnly) {
        qc.setQueryData<RecordsMealsQueryData>(["records-meals", uid], (prev) => {
          if (!prev) {
            return {
              meals,
              loadedMonthKeys: [],
              shardsOnDriveDesc: [],
              allShardsLoaded: true,
            };
          }
          return { ...prev, meals };
        });
        return;
      }

      const touched = variables.mealMonthKeysToSync ?? [];
      const loaded = new Set([
        ...(qc.getQueryData<RecordsMealsQueryData>(["records-meals", uid])
          ?.loadedMonthKeys ?? []),
        ...touched,
        ...data.hydratedMonthKeysForSync,
      ]);

      qc.setQueryData<RecordsMealsQueryData>(["records-meals", uid], (prev) => {
        const shards = prev?.shardsOnDriveDesc ?? [];
        const loadedMonthKeys = [...loaded];
        return {
          meals,
          loadedMonthKeys,
          shardsOnDriveDesc: shards,
          allShardsLoaded: computeAllShardsLoaded(shards, loadedMonthKeys),
        };
      });

      void (async () => {
        try {
          const token = await ensureGoogleAccessToken();
          if (!token) return;
          const sorted = await listMealShardFilesSortedDesc(token);
          qc.setQueryData<RecordsMealsQueryData>(["records-meals", uid], (prev) => {
            if (!prev) return prev;
            const loadedMonthKeys = [
              ...new Set([...prev.loadedMonthKeys, ...touched]),
            ];
            return {
              ...prev,
              shardsOnDriveDesc: sorted,
              allShardsLoaded: computeAllShardsLoaded(sorted, loadedMonthKeys),
            };
          });
        } catch {
          /* keep prior shard index */
        }
      })();
    },
  });

  const records = useMemo((): RecordsDocument => {
    const boot = coreQuery.data;
    if (!boot) return emptyRecords();
    const meals = mealsQuery.data?.meals ?? [];
    return normalizeRecordsDocument({ ...boot, meals });
  }, [coreQuery.data, mealsQuery.data]);

  const geminiKey = coreQuery.data?.geminiApiKey ?? "";

  const getCurrentRecords = useCallback((): RecordsDocument => {
    const uid = getGoogleUserId();
    if (!uid) return emptyRecords();
    const boot = qc.getQueryData<RecordsCoreDocument>(["records-core", uid]);
    if (!boot) return emptyRecords();
    const mealsState = qc.getQueryData<RecordsMealsQueryData>(["records-meals", uid]);
    return normalizeRecordsDocument({
      ...boot,
      meals: mealsState?.meals ?? [],
    });
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
        "id" | "recordedAt" | "photoFileId"
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
          const token = await ensureGoogleAccessToken();
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
          const token = await ensureGoogleAccessToken();
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
      const next: RecordsDocument = {
        ...prev,
        meals: prev.meals.filter((m) => m.id !== id),
      };
      await replaceMutation.mutateAsync({
        next,
        mealsOnly: true,
        mealMonthKeysToSync: [monthKeyFromRecordedAt(removed.recordedAt)],
      });
      if (photoId && canSyncToDriveAppData()) {
        const token = await ensureGoogleAccessToken();
        if (token) {
          try {
            const uid = getGoogleUserId() ?? "";
            const photoStillReferenced =
              next.meals.some((m) => m.photoFileId === photoId) ||
              savedMealsReferencePhoto(qc, uid, photoId);
            if (!photoStillReferenced) {
              await deleteDriveFile(token, photoId);
              void removeMealPhotoFromCache(photoId);
            }
          } catch {
            /* Snapshot may remain orphaned in App Data if delete fails. */
          }
        }
      }
    },
    [getCurrentRecords, replaceMutation, qc],
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
        >
      > & {
        /** New Drive file id, or `null` / empty string to drop the meal photo. */
        photoFileId?: string | null;
      },
    ) => {
      const prev = getCurrentRecords();
      const hasTarget = prev.meals.some((m) => m.id === id);
      if (!hasTarget) throw new Error("Meal not found");
      const prevMeal = prev.meals.find((m) => m.id === id)!;
      const oldPhotoId = prevMeal.photoFileId;

      const { photoFileId: patchPhoto, ...scalarPatch } = patch;

      const updated: MealRecord = { ...prevMeal, ...scalarPatch };

      if ("photoFileId" in patch) {
        if (patchPhoto === null || patchPhoto === "") {
          delete updated.photoFileId;
        } else if (typeof patchPhoto === "string") {
          updated.photoFileId = patchPhoto;
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
      if (oldPhotoId !== newPhotoId && canSyncToDriveAppData()) {
        const token = await ensureGoogleAccessToken();
        if (token && oldPhotoId && oldPhotoId !== newPhotoId) {
          const uid = getGoogleUserId() ?? "";
          const still =
            next.meals.some((m) => m.photoFileId === oldPhotoId) ||
            savedMealsReferencePhoto(qc, uid, oldPhotoId);
          if (!still) {
            try {
              await deleteDriveFile(token, oldPhotoId);
              void removeMealPhotoFromCache(oldPhotoId);
            } catch {
              /* best-effort */
            }
          }
        }
      }
    },
    [getCurrentRecords, replaceMutation, qc],
  );

  const addSavedMeal = useCallback(
    async (
      snapshot: Pick<
        SavedMealRecord,
        "food_name" | "calories" | "protein" | "fats" | "carbs"
      >,
      options?: {
        id?: string;
        photo?: { base64: string; mimeType: string };
        preparedPhoto?: PreparedMealPhoto;
        /** Existing App Data photo id (e.g. copied from a logged meal). */
        photoFileId?: string;
      },
    ): Promise<string> => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      const uid = getGoogleUserId() ?? "";
      const foodName = snapshot.food_name.trim();
      if (!foodName) throw new Error("Enter a food name.");

      const newId = options?.id ?? crypto.randomUUID?.() ?? String(Date.now());
      let photoFileId = options?.photoFileId;

      if (options?.preparedPhoto || options?.photo) {
        const prepared = options.preparedPhoto
          ? options.preparedPhoto
          : await prepareMealPhotoForUpload(
              options.photo!.base64,
              options.photo!.mimeType,
            );
        photoFileId = await uploadMealPhotoToAppData(
          token,
          newId,
          prepared.base64,
          prepared.mimeType,
        );
      }

      const row: SavedMealRecord = {
        id: newId,
        food_name: foodName,
        calories: snapshot.calories,
        protein: snapshot.protein,
        fats: snapshot.fats,
        carbs: snapshot.carbs,
        ...(photoFileId ? { photoFileId } : {}),
      };

      const prev = await pullSavedMealsFromDrive(token);
      if (savedMealDuplicatesExisting(row, prev)) {
        throw new Error(
          "A saved meal with the same name and macros is already on your list.",
        );
      }

      const next = [row, ...prev];
      await upsertSavedMealsToDrive(token, next);
      qc.setQueryData<SavedMealRecord[]>(["saved-meals", uid], next);
      return newId;
    },
    [qc],
  );

  const addSavedMealFromMeal = useCallback(
    async (meal: MealRecord) => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      const prev = await pullSavedMealsFromDrive(token);
      if (isMealAlreadySavedAsTemplate(meal, prev)) {
        throw new Error("This meal is already in your saved meals.");
      }
      const newId = crypto.randomUUID?.() ?? String(Date.now());
      let photoFileId = meal.photoFileId;
      if (photoFileId) {
        photoFileId = await copyAppDataPhotoForSavedMeal(token, photoFileId, newId);
      }
      await addSavedMeal(
        {
          food_name: meal.food_name,
          calories: meal.calories,
          protein: meal.protein,
          fats: meal.fats,
          carbs: meal.carbs,
        },
        { id: newId, photoFileId },
      );
    },
    [addSavedMeal],
  );

  const updateSavedMeal = useCallback(
    async (
      id: string,
      patch: {
        food_name: string;
        calories: number;
        protein: number;
        fats: number;
        carbs: number;
        /** New Drive file id, or `null` / empty string to drop the photo. */
        photoFileId?: string | null;
      },
    ) => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      const uid = getGoogleUserId() ?? "";
      const prev = await pullSavedMealsFromDrive(token);
      const prevRow = prev.find((s) => s.id === id);
      if (!prevRow) throw new Error("Saved meal not found");
      const oldPhotoId = prevRow.photoFileId;

      const foodName = patch.food_name.trim();
      if (!foodName) throw new Error("Enter a food name.");

      const updated: SavedMealRecord = {
        ...prevRow,
        food_name: foodName,
        calories: patch.calories,
        protein: patch.protein,
        fats: patch.fats,
        carbs: patch.carbs,
      };

      if ("photoFileId" in patch) {
        if (patch.photoFileId === null || patch.photoFileId === "") {
          delete updated.photoFileId;
        } else if (typeof patch.photoFileId === "string") {
          updated.photoFileId = patch.photoFileId;
        }
      }

      if (savedMealDuplicatesExisting(updated, prev, id)) {
        throw new Error(
          "A saved meal with the same name and macros is already on your list.",
        );
      }

      const next = prev.map((s) => (s.id === id ? updated : s));
      await upsertSavedMealsToDrive(token, next);
      qc.setQueryData<SavedMealRecord[]>(["saved-meals", uid], next);

      const newPhotoId = updated.photoFileId;
      if (oldPhotoId !== newPhotoId && canSyncToDriveAppData()) {
        const t = await ensureGoogleAccessToken();
        if (t && oldPhotoId && oldPhotoId !== newPhotoId) {
          const meals = getCurrentRecords().meals;
          const still =
            meals.some((m) => m.photoFileId === oldPhotoId) ||
            next.some((s) => s.photoFileId === oldPhotoId);
          if (!still) {
            try {
              await deleteDriveFile(t, oldPhotoId);
              void removeMealPhotoFromCache(oldPhotoId);
            } catch {
              /* best-effort */
            }
          }
        }
      }
    },
    [qc, getCurrentRecords],
  );

  /**
   * Replaces the full saved-meals list on Drive (order + removals in one write).
   * Rows are re-read from the server by id so client payloads stay in sync.
   */
  const commitSavedMeals = useCallback(
    async (nextFromClient: SavedMealRecord[]) => {
      if (!canSyncToDriveAppData()) {
        throw new Error("Not signed in or Drive scope unavailable");
      }
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing access token");
      const uid = getGoogleUserId() ?? "";
      const prev = await pullSavedMealsFromDrive(token);
      const prevById = new Map(prev.map((s) => [s.id, s]));
      const seen = new Set<string>();
      const merged: SavedMealRecord[] = [];
      for (const row of nextFromClient) {
        if (seen.has(row.id)) {
          throw new Error("Invalid order: duplicate entries.");
        }
        seen.add(row.id);
        const fresh = prevById.get(row.id);
        if (!fresh) {
          throw new Error("Saved meals list changed; try again.");
        }
        merged.push(fresh);
      }
      const nextIds = new Set(merged.map((s) => s.id));
      const removed = prev.filter((s) => !nextIds.has(s.id));
      await upsertSavedMealsToDrive(token, merged);
      qc.setQueryData<SavedMealRecord[]>(["saved-meals", uid], merged);

      for (const r of removed) {
        const photoId = r.photoFileId;
        if (!photoId) continue;
        try {
          const meals = getCurrentRecords().meals;
          const stillReferenced =
            meals.some((m) => m.photoFileId === photoId) ||
            merged.some((s) => s.photoFileId === photoId);
          if (!stillReferenced) {
            await deleteDriveFile(token, photoId);
            void removeMealPhotoFromCache(photoId);
          }
        } catch {
          /* best-effort */
        }
      }
    },
    [qc, getCurrentRecords],
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
    const token = await ensureGoogleAccessToken();
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
      qc.invalidateQueries({ queryKey: ["saved-meals", uid] });
      qc.invalidateQueries({ queryKey: ["drive-app-files", uid] });
    }
  }, [qc]);

  const [loadingMoreMeals, setLoadingMoreMeals] = useState(false);
  /**
   * Serializes `loadMoreMealMonths` so overlapping callers queue instead of
   * racing duplicate Drive fetches.
   */
  const loadMoreMealsSerialRef = useRef<Promise<void>>(Promise.resolve());

  const loadMoreMealMonths = useCallback(async () => {
    const task = async (): Promise<void> => {
      const uid = getGoogleUserId();
      if (!uid) return;
      const prev = qc.getQueryData<RecordsMealsQueryData>(["records-meals", uid]);
      if (!prev || prev.allShardsLoaded) return;
      const loaded = new Set(prev.loadedMonthKeys);
      const toFetch = prev.shardsOnDriveDesc
        .filter((s) => !loaded.has(s.monthKey))
        .slice(0, MEALS_PAGE_MONTH_COUNT);
      if (toFetch.length === 0) return;

      setLoadingMoreMeals(true);
      try {
        const token = await ensureGoogleAccessToken();
        if (!token) throw new Error("Missing access token");
        const newMeals = await pullMealsFromShardRefs(token, toFetch);
        qc.setQueryData<RecordsMealsQueryData>(["records-meals", uid], (cur) => {
          if (!cur) return cur;
          const merged = mergeMealRecordsById(cur.meals, newMeals);
          const loadedMonthKeys = [
            ...new Set([...cur.loadedMonthKeys, ...toFetch.map((t) => t.monthKey)]),
          ];
          return {
            ...cur,
            meals: merged,
            loadedMonthKeys,
            allShardsLoaded: computeAllShardsLoaded(
              cur.shardsOnDriveDesc,
              loadedMonthKeys,
            ),
          };
        });
      } finally {
        setLoadingMoreMeals(false);
      }
    };

    const next = loadMoreMealsSerialRef.current.then(task, task);
    loadMoreMealsSerialRef.current = next;
    await next;
  }, [qc]);

  const ensureMealIdLoaded = useCallback(
    async (mealId: string | undefined): Promise<boolean> => {
      if (!mealId) return false;
      const uid = getGoogleUserId();
      if (!uid) return false;
      const hasMeal = () =>
        qc
          .getQueryData<RecordsMealsQueryData>(["records-meals", uid])
          ?.meals.some((m) => m.id === mealId) ?? false;
      if (hasMeal()) return true;
      for (;;) {
        const prev = qc.getQueryData<RecordsMealsQueryData>(["records-meals", uid]);
        if (!prev) return false;
        if (prev.meals.some((m) => m.id === mealId)) return true;
        if (prev.allShardsLoaded) return false;
        await loadMoreMealMonths();
        if (hasMeal()) return true;
        const next = qc.getQueryData<RecordsMealsQueryData>(["records-meals", uid]);
        if (!next) return false;
        if (next.allShardsLoaded) return false;
        if (next.loadedMonthKeys.length === prev.loadedMonthKeys.length) return false;
      }
    },
    [qc, loadMoreMealMonths],
  );

  const refetch = useCallback(async () => {
    const cr = await coreQuery.refetch();
    if (cr.error) return cr;
    void savedMealsQuery.refetch();
    return mealsQuery.refetch();
  }, [coreQuery, mealsQuery, savedMealsQuery]);

  const isMealsLoading =
    coreQuery.isSuccess &&
    (!mealsQuery.isFetched || mealsQuery.isFetching);

  const isSavedMealsLoading =
    coreQuery.isSuccess &&
    (!savedMealsQuery.isFetched || savedMealsQuery.isFetching);

  const allMealShardsLoaded = mealsQuery.data?.allShardsLoaded ?? false;

  return {
    records,
    userId,
    savedMeals: savedMealsQuery.data ?? [],
    /** True once core Drive JSON (`core.json`) has been loaded or created for this account. */
    isRecordsReady: coreQuery.isSuccess,
    /** Meal shards still syncing from Drive — show placeholders for meal-derived UI. */
    isMealsLoading,
    /** `saved-meals.json` still loading from Drive. */
    isSavedMealsLoading,
    savedMealsError: savedMealsQuery.error,
    refetchSavedMeals: savedMealsQuery.refetch,
    /** True when every meal month shard on Drive has been downloaded into the client cache. */
    allMealShardsLoaded,
    /** Fetches the next batch of older month shards from Drive (for infinite history). */
    loadMoreMealMonths,
    /** Loads older shards until the given meal id appears, or returns false if it does not exist. */
    ensureMealIdLoaded,
    /** True while a background batch of older meal months is loading. */
    isLoadingMoreMeals: loadingMoreMeals,
    mealsError: mealsQuery.error,
    refetchMeals: mealsQuery.refetch,
    isLoading: coreQuery.isLoading,
    isFetching:
      coreQuery.isFetching ||
      mealsQuery.isFetching ||
      savedMealsQuery.isFetching ||
      loadingMoreMeals,
    refetch,
    error: coreQuery.error,
    geminiKey,
    updateGeminiKey,
    addMeal,
    addSavedMeal,
    addSavedMealFromMeal,
    updateSavedMeal,
    commitSavedMeals,
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
