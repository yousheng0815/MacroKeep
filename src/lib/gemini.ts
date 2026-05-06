import { GoogleGenerativeAI } from "@google/generative-ai";

/** Stable Flash model for AI Studio / Generative Language API (`generateContent`). */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function resolveGeminiModelId(): string {
  const fromEnv = import.meta.env.VITE_GEMINI_MODEL?.trim();
  return fromEnv || DEFAULT_GEMINI_MODEL;
}

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
  const parsed = JSON.parse(cleaned) as Partial<AiMealEstimate>;
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
  const model = genAI.getGenerativeModel({ model: resolveGeminiModelId() });
  const prompt =
    "You are a nutrition assistant. Estimate the meal in the image.\n" +
    "Return ONLY valid JSON with keys: food_name (string), calories (number), protein (grams number), fats (grams number), carbs (grams number).\n" +
    "Use reasonable estimates for the serving visible. Round calories to whole numbers. No markdown.";

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const text = result.response.text();
  return parseAiMealJson(text);
}
