import type { AiMealEstimate } from "@/lib/gemini";

/** JPEG from {@link prepareMealPhotoForUpload} — ready for Gemini and Drive. */
export type PreparedMealPhoto = {
  base64: string;
  mimeType: string;
};

export type MealScanDraft = {
  estimate: AiMealEstimate;
  /** Same pixels as sent to Gemini and saved to Drive. */
  snapshot: PreparedMealPhoto;
};
