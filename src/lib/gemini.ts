import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";

/** Stable Flash model for AI Studio / Generative Language API (`generateContent`). */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Disable extended thinking for meal estimates — saves latency and avoids eating
 * the whole output budget before JSON is emitted. (SDK typings omit this; API accepts it.)
 */
type MealScanGenerationConfig = GenerationConfig & {
  thinkingConfig?: { thinkingBudget?: number };
};

/**
 * Lightweight `generateContent` ping using the same model as meal scans.
 * Call before persisting a BYOK key so invalid or restricted keys are not saved.
 */
export async function validateGeminiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) return;

  const genAI = new GoogleGenerativeAI(trimmed);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: 16,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    } as MealScanGenerationConfig,
  });

  try {
    const result = await model.generateContent(
      'Reply with exactly the two letters "ok" in lowercase and nothing else.',
    );
    const text = result.response.text().trim().toLowerCase();
    if (!text.startsWith("ok")) {
      throw new Error(
        "Gemini responded, but the reply was unexpected. Try again or create a new API key.",
      );
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (
      /API[_ ]?KEY|API key not valid|invalid api key|API_KEY_INVALID/i.test(raw)
    ) {
      throw new Error(
        "That key is invalid. Try pasting it again, or create a new one in Google AI Studio.",
      );
    }
    if (/403|PERMISSION_DENIED|permission denied/i.test(raw)) {
      throw new Error(
        "This key cannot call Gemini (blocked or restricted). Check API key restrictions in Google Cloud.",
      );
    }
    if (/404|NOT_FOUND|not found/i.test(raw)) {
      throw new Error(
        "The Gemini model is unavailable for this key or region. Try again later.",
      );
    }
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
      throw new Error(
        "Gemini rate limit or quota exceeded. Wait a bit and try again.",
      );
    }
    throw new Error(raw.length > 220 ? `${raw.slice(0, 220)}…` : raw);
  }
}

export type AiMealEstimate = {
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
};

/** Atwater general factors; calories are derived from these grams for consistency. */
const KCAL_PER_PROTEIN = 4;
const KCAL_PER_CARB = 4;
const KCAL_PER_FAT = 9;

/**
 * Meal-scan instructions: decomposition, assumptions, then one JSON object.
 * Output shape is unchanged — reasoning stays implicit.
 */
const MEAL_SCAN_PROMPT = `You are an expert at estimating nutrition from a single meal photo.

Work through this mentally before you answer (do not output these steps as text):
1) List each distinct food you can see (including sauces, oils, cheese, drinks if they are clearly part of the meal).
2) For each item, estimate plausible grams for the portion actually visible. Account for depth: bowls and layered dishes are often larger than they look from one angle.
3) Sum protein, carbs, and fat in grams across items. Prefer cooked weights unless the food is clearly raw.
4) If cooking fat, dressing, or gravy is visible or very likely, include a realistic amount — this is a common source of underestimation.

Rules for the JSON you return:
- food_name: short human label (e.g. "Chicken rice bowl" or "Toast, eggs, avocado"). Max about 80 characters.
- protein, fats, carbs: non-negative numbers in grams; use your best single estimate (one decimal is fine).
- calories: MUST equal (${KCAL_PER_PROTEIN} × protein) + (${KCAL_PER_CARB} × carbs) + (${KCAL_PER_FAT} × fats) in kilocalories, rounded to the nearest whole number. Do not pick calories independently of these macros.

Return only one JSON object with keys: food_name, calories, protein, fats, carbs.`;

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```[a-zA-Z]*\s*/, "")
      .replace(/```$/, "")
      .trim();
  }
  return t;
}

export function parseAiMealJson(text: string): AiMealEstimate {
  const cleaned = stripCodeFence(text);
  if (!cleaned) {
    throw new Error(
      "Gemini returned no text — often caused by maxOutputTokens being too small for this model.",
    );
  }
  let parsed: Partial<AiMealEstimate>;
  try {
    parsed = JSON.parse(cleaned) as Partial<AiMealEstimate>;
  } catch (e) {
    const hint =
      e instanceof SyntaxError && cleaned.length < 400
        ? cleaned
        : `${cleaned.slice(0, 200)}…`;
    throw new Error(`Could not parse meal JSON: ${hint}`);
  }
  const nonNeg = (n: unknown): number => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return 0;
    return v;
  };
  const food_name = String(parsed.food_name ?? "Meal").trim() || "Meal";
  const protein = nonNeg(parsed.protein);
  const fats = nonNeg(parsed.fats);
  const carbs = nonNeg(parsed.carbs);
  const calories = Math.round(
    KCAL_PER_PROTEIN * protein +
      KCAL_PER_CARB * carbs +
      KCAL_PER_FAT * fats,
  );
  return { food_name, calories, protein, fats, carbs };
}

export async function analyzeFoodPhoto(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<AiMealEstimate> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const mealGenerationConfig: MealScanGenerationConfig = {
    temperature: 0.15,
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        food_name: { type: SchemaType.STRING },
        calories: { type: SchemaType.NUMBER },
        protein: { type: SchemaType.NUMBER },
        fats: { type: SchemaType.NUMBER },
        carbs: { type: SchemaType.NUMBER },
      },
      required: ["food_name", "calories", "protein", "fats", "carbs"],
    },
    thinkingConfig: { thinkingBudget: 0 },
  };
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    generationConfig: mealGenerationConfig,
  });
  const result = await model.generateContent([
    { text: MEAL_SCAN_PROMPT },
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const response = result.response;
  const candidate = response.candidates?.[0];
  let text: string;
  try {
    text = response.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Gemini response blocked: ${msg}`);
  }

  if (!text.trim()) {
    const fr = candidate?.finishReason;
    const thoughts = (
      response as { usageMetadata?: { thoughtsTokenCount?: number } }
    ).usageMetadata?.thoughtsTokenCount;
    if (fr === "MAX_TOKENS") {
      const thoughtHint =
        thoughts != null
          ? ` This response used ${thoughts} internal thought tokens before any visible JSON.`
          : "";
      throw new Error(
        `Gemini hit the output token limit with no JSON in the reply.${thoughtHint} Try again, or use a different photo.`,
      );
    }
    throw new Error(
      "Gemini returned an empty answer. Try another photo or check model/API availability.",
    );
  }

  return parseAiMealJson(text);
}
