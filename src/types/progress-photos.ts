/** Metadata row in Drive manifest `progress-photos.json` (image stored as a separate file). */
export type ProgressPhotoDriveMeta = {
  id: string;
  driveFileId: string;
  capturedAt: number;
};

export type ProgressPhotoRecord = {
  id: string;
  capturedAt: number;
  /** JPEG blob (downloaded from Drive for display; not persisted locally long-term). */
  blob: Blob;
};

/** Result of loading progress photos from Drive (manifest + images). */
export type ProgressPhotosPullResult = {
  photos: ProgressPhotoRecord[];
};
