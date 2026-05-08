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

export type MacroGoal =
  | "lose_weight"
  | "maintain_weight"
  | "gain_muscle"
  | "improve_health";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type MacroPlanRequest = {
  age: number;
  heightCm: number;
  weightKg: number;
  goal: MacroGoal;
  activityLevel: ActivityLevel;
  notes?: string;
};

export type MacroPlanSuggestion = {
  dailyTargetKcal: number;
  proteinTargetG: number;
  fatsTargetG: number;
  carbsTargetG: number;
  rationale: string;
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

function parseMacroPlanJson(text: string): MacroPlanSuggestion {
  const cleaned = stripCodeFence(text);
  if (!cleaned) throw new Error("Gemini returned no macro plan JSON.");
  let parsed: Partial<MacroPlanSuggestion>;
  try {
    parsed = JSON.parse(cleaned) as Partial<MacroPlanSuggestion>;
  } catch (e) {
    const hint =
      e instanceof SyntaxError && cleaned.length < 400
        ? cleaned
        : `${cleaned.slice(0, 200)}…`;
    throw new Error(`Could not parse macro plan JSON: ${hint}`);
  }
  const dailyTargetKcal = Number(parsed.dailyTargetKcal ?? 0);
  const proteinTargetG = Number(parsed.proteinTargetG ?? 0);
  const fatsTargetG = Number(parsed.fatsTargetG ?? 0);
  const carbsTargetG = Number(parsed.carbsTargetG ?? 0);
  const rationale = String(parsed.rationale ?? "").trim();

  if (
    !Number.isFinite(dailyTargetKcal) ||
    !Number.isFinite(proteinTargetG) ||
    !Number.isFinite(fatsTargetG) ||
    !Number.isFinite(carbsTargetG)
  ) {
    throw new Error("Gemini returned non-numeric macro targets.");
  }
  return {
    dailyTargetKcal: Math.max(1000, Math.round(dailyTargetKcal)),
    proteinTargetG: Math.max(0, Math.round(proteinTargetG)),
    fatsTargetG: Math.max(0, Math.round(fatsTargetG)),
    carbsTargetG: Math.max(0, Math.round(carbsTargetG)),
    rationale: rationale || "Generated from your profile and goal.",
  };
}

export async function suggestMacroPlan(
  apiKey: string,
  request: MacroPlanRequest,
): Promise<MacroPlanSuggestion> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          dailyTargetKcal: { type: SchemaType.NUMBER },
          proteinTargetG: { type: SchemaType.NUMBER },
          fatsTargetG: { type: SchemaType.NUMBER },
          carbsTargetG: { type: SchemaType.NUMBER },
          rationale: { type: SchemaType.STRING },
        },
        required: [
          "dailyTargetKcal",
          "proteinTargetG",
          "fatsTargetG",
          "carbsTargetG",
          "rationale",
        ],
      },
    },
  });

  const prompt =
    "You are a nutrition coach. Based on user profile, estimate daily calorie and macro targets.\n" +
    "Output strict JSON only.\n" +
    "Rules:\n" +
    "- Keep numbers realistic for healthy adults.\n" +
    "- Protein should generally be 1.4-2.2g per kg for muscle gain, lower end for maintenance.\n" +
    "- Fats should generally be 20-35% of calories.\n" +
    "- Carbs are remaining calories.\n" +
    "- Provide a short rationale in one sentence.\n\n" +
    `User input JSON:\n${JSON.stringify(request)}`;

  const result = await model.generateContent([{ text: prompt }]);
  const text = result.response.text();
  return parseMacroPlanJson(text);
}
