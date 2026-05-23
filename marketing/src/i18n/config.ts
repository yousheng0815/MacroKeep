/** BCP 47 tags for the marketing site (matches app locales). */
export type MarketingLocale = "en" | "zh-TW";

export const DEFAULT_LOCALE: MarketingLocale = "en";

export const SUPPORTED_LOCALES: readonly MarketingLocale[] = [
  "en",
  "zh-TW",
] as const;

export function isMarketingLocale(value: string): value is MarketingLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function documentLangAttr(locale: MarketingLocale): string {
  if (locale === "zh-TW") return "zh-Hant";
  return locale;
}

/** Path without a locale prefix (e.g. `/zh-TW/privacy` → `/privacy`). */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/zh-TW" || pathname.startsWith("/zh-TW/")) {
    const rest = pathname.slice("/zh-TW".length);
    return rest === "" ? "/" : rest;
  }
  return pathname;
}

/** Build a localized path for static marketing routes. */
export function localizedPath(
  locale: MarketingLocale,
  pathname: string,
): string {
  const base = stripLocalePrefix(pathname);
  if (locale === "en") return base;
  if (base === "/") return "/zh-TW";
  return `/zh-TW${base}`;
}
