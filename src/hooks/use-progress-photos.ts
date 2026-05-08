import { canSyncToDriveAppData, getAccessToken, getGoogleUserId } from "@/lib/gapi";
import {
  addProgressPhotoToDrive,
  deleteProgressPhotoFromDrive,
  pullProgressPhotosFromDrive,
} from "@/lib/google-drive";
import type { ProgressPhotoRecord } from "@/types/progress-photos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
export function useProgressPhotos() {
  const qc = useQueryClient();
  const userId = getGoogleUserId() ?? "";

  const query = useQuery({
    queryKey: ["progress-photos", userId],
    enabled: !!userId && canSyncToDriveAppData(),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return pullProgressPhotosFromDrive(token, signal);
    },
  });

  const pull = query.data;
  const photos = pull?.photos ?? [];

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing access token");
      await deleteProgressPhotoFromDrive(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (record: ProgressPhotoRecord) => {
      const token = getAccessToken();
      if (!token) throw new Error("Missing access token");
      await addProgressPhotoToDrive(token, record);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
  });

  const remove = useCallback(
    async (id: string) => removeMutation.mutateAsync(id),
    [removeMutation],
  );

  const addPhoto = useCallback(
    async (record: ProgressPhotoRecord) => addMutation.mutateAsync(record),
    [addMutation],
  );

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? "Could not load progress photos."
        : null;

  return {
    photos,
    loading: query.isLoading,
    error: errorMessage,
    remove,
    addPhoto,
    isSavingPhoto: addMutation.isPending,
  };
}
