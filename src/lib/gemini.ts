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

export type AiMealEstimate = {
  food_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
};

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
  const food_name = String(parsed.food_name ?? "Meal");
  const calories = Number(parsed.calories ?? 0);
  const protein = Number(parsed.protein ?? 0);
  const fats = Number(parsed.fats ?? 0);
  const carbs = Number(parsed.carbs ?? 0);
  return { food_name, calories, protein, fats, carbs };
}

export async function analyzeFoodPhoto(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<AiMealEstimate> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const mealGenerationConfig: MealScanGenerationConfig = {
    temperature: 0.2,
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
  const prompt =
    "You are a nutrition assistant. Estimate the meal in the image.\n" +
    "Return a JSON object with: food_name (short label), calories (whole number kcal), protein / fats / carbs (grams, numbers).\n" +
    "Use reasonable estimates for the serving visible.";

  const result = await model.generateContent([
    { text: prompt },
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
