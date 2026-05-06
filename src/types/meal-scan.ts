import type { AiMealEstimate } from "@/lib/gemini";

/** JPEG payloads ready for Drive upload (no further client compression needed). */
export type PreparedMealPhotoPair = {
  full: { base64: string; mimeType: string };
  thumb: { base64: string; mimeType: string };
};

export type MealScanDraft = {
  estimate: AiMealEstimate;
  snapshot: { base64: string; mimeType: string };
  /** True while full + thumbnail JPEG compression runs in the background after scan. */
  preparingPhotos?: boolean;
  preparedPhotos?: PreparedMealPhotoPair;
  preparedPhotosError?: string | null;
};
