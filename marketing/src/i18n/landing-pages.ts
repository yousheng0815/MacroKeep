import type { LandingPageContent, MarketingMessages } from "./types";

export function allLandingPages(
  messages: MarketingMessages,
): LandingPageContent[] {
  const { landingPages } = messages;
  return [
    landingPages.aiMealEstimates,
    landingPages.googleDrive,
    landingPages.myfitnesspalAlternative,
    landingPages.howToTrackMacros,
  ];
}

export function localizedLandingPath(
  locale: MarketingMessages["locale"],
  path: string,
): string {
  if (locale === "en") return path;
  if (path === "/") return "/zh-TW";
  return `/zh-TW${path}`;
}
