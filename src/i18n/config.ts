export const LOCALE_STORAGE_KEY = "macrokeep:locale";

/** BCP 47 tags supported by the app UI. */
export type AppLocale = "en" | "zh-TW";

export const DEFAULT_LOCALE: AppLocale = "en";

export const SUPPORTED_LOCALES: readonly AppLocale[] = [
  "en",
  "zh-TW",
] as const;

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
};

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Map browser language tags to a supported app locale. */
export function resolveLocaleFromNavigator(
  languages: readonly string[] = typeof navigator !== "undefined"
    ? navigator.languages
    : [],
): AppLocale {
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    if (lower === "zh-tw" || lower === "zh-hant" || lower.startsWith("zh-hant")) {
      return "zh-TW";
    }
    if (lower.startsWith("zh") && (lower.includes("tw") || lower.includes("hk"))) {
      return "zh-TW";
    }
    if (lower === "en" || lower.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(): AppLocale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "ja") {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
      return null;
    }
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

/** `Intl` / `toLocaleString` tag for the active app locale. */
export function intlLocaleTag(locale: AppLocale): string | undefined {
  if (locale === "en") return undefined;
  return locale;
}

export function documentLangAttr(locale: AppLocale): string {
  if (locale === "zh-TW") return "zh-Hant";
  return locale;
}
