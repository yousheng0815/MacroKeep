import { isInstalledPwa } from "@/lib/pwa";
import packageJson from "../../package.json";

export const FEEDBACK_EMAIL = "feedback@macrokeep.com";

export type FeedbackKind = "bug" | "feature" | "other";

function feedbackDiagnostics(locale: string): string {
  const lines = [
    "---",
    `Version: ${packageJson.version}`,
    `Locale: ${locale}`,
    `PWA: ${isInstalledPwa() ? "yes" : "no"}`,
    `User-Agent: ${navigator.userAgent}`,
  ];
  return lines.join("\n");
}

/** Opens the user's mail client to feedback@macrokeep.com with subject and body prefilled. */
export function buildFeedbackMailtoUrl(
  subject: string,
  bodyPrompt: string,
  locale: string,
): string {
  const body = `${bodyPrompt}\n\n${feedbackDiagnostics(locale)}`;
  // encodeURIComponent (not URLSearchParams) so spaces are %20, not +.
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
