import type { LegalDocument } from "./types";

/** English privacy policy — public URL for OAuth / Google API Services User Data Policy. */
export const privacyPolicyEn: LegalDocument = {
  title: "Privacy Policy",
  effectiveDate: "May 19, 2026",
  intro: [
    'MacroKeep ("we," "us," or "the app") is a web application for calorie and macro tracking. The marketing site is at macrokeep.com; the app is at app.macrokeep.com (and related domains). This Privacy Policy explains how we access, use, store, and share information when you use MacroKeep.',
    "By using MacroKeep, you agree to this Privacy Policy. If you do not agree, do not use the app.",
  ],
  sections: [
    {
      title: "Summary",
      paragraphs: [
        "Your food log, settings, progress photos, and optional Gemini API key are stored in your own Google Drive application data folder—not on MacroKeep servers. We use Google Sign-In only to identify your account and access that folder. Our hosting may process OAuth tokens transiently to complete sign-in and refresh access; we do not operate a user database that stores your meal data.",
      ],
    },
    {
      title: "Information we access",
      paragraphs: ["When you sign in with Google, MacroKeep may access:"],
      bullets: [
        "Basic profile information (Google account ID, email address, and profile information) via OpenID Connect scopes openid, email, and profile.",
        "Your Google Drive application data (scope drive.appdata): files MacroKeep creates in a hidden app-specific folder. This includes meal entries, macro targets, profile settings, saved meals, progress photo metadata and images, and your optional Google Gemini API key. MacroKeep does not request access to your other Google Drive files or folders visible in My Drive.",
      ],
    },
    {
      title: "Where your data is stored",
      paragraphs: [
        "Primary storage: Google Drive application data associated with your Google account. In MacroKeep Settings, tap your signed-in email repeatedly to show advanced options, then open the Drive app data browser to view files or use Delete all Drive data to remove everything in your app folder.",
        "On your device: OAuth tokens and account identifiers may be stored in your browser’s local storage so you stay signed in. Meal and progress photo thumbnails may be cached in your browser’s IndexedDB for performance. Language preference may be stored locally and synced with your Drive profile.",
        "Our hosting: We run OAuth start and callback endpoints and an access-token refresh endpoint on infrastructure we use to serve the app. During sign-in, tokens are passed to your browser; refresh tokens are kept on your device. When refreshing an access token, your browser sends your refresh token to our server, which forwards the request to Google and returns a short-lived access token. We do not design our service to persist your refresh token or meal data on our servers.",
      ],
    },
    {
      title: "Optional Gemini API key",
      paragraphs: [
        "If you choose to add a Google Gemini API key, it is saved with your other MacroKeep data in your Drive app data folder. Photo and text meal analysis requests are sent directly from your browser to Google’s Generative Language API using your key. MacroKeep does not store your Gemini key on our servers. Your use of Gemini is also subject to Google’s terms and policies for that service.",
      ],
    },
    {
      title: "How we use information",
      paragraphs: ["We use the information above only to:"],
      bullets: [
        "Authenticate you and maintain your session.",
        "Read and write your MacroKeep data in Drive app data.",
        "Provide calorie/macro tracking, history, progress photos, and optional AI-assisted meal estimates when you supply a Gemini key.",
        "Remember UI preferences such as language where applicable.",
      ],
    },
    {
      title: "Sharing and disclosure",
      paragraphs: [
        "We do not sell your personal information. We do not share your Google user data with third parties except:",
      ],
      bullets: [
        "Google, when you use Google Sign-In, Google Drive, or the Gemini API (under their policies).",
        "Infrastructure providers that host our website and API, which may process network requests according to their privacy policies.",
        "When required by law or to protect rights, safety, and security.",
      ],
    },
    {
      title: "Feedback and support",
      paragraphs: [
        "If you email us at feedback@macrokeep.com (for example via the in-app feedback links), you choose what to include in your message. Our mail client templates may attach non-personal diagnostics such as app version, language, whether the app is installed as a PWA, and browser user-agent string to help us troubleshoot.",
      ],
    },
    {
      title: "Retention and deletion",
      paragraphs: [
        "Data in Google Drive remains until you delete it in MacroKeep or remove MacroKeep’s access in your Google Account security settings. Signing out clears OAuth tokens stored in your browser. To delete all MacroKeep cloud data in the app, unlock advanced Drive options in Settings (tap your signed-in email repeatedly), then use Delete all Drive data. Local caches may remain until cleared by your browser or the app.",
      ],
    },
    {
      title: "Security",
      paragraphs: [
        "We use HTTPS for production traffic. You are responsible for securing your Google account and device. No method of transmission or storage is completely secure.",
      ],
    },
    {
      title: "Children",
      paragraphs: [
        "MacroKeep is not directed at children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal information from children.",
      ],
    },
    {
      title: "International users",
      paragraphs: [
        "Your data may be processed in countries where Google and our hosting providers operate. By using the app, you understand that these locations may have different data protection laws than your country.",
      ],
    },
    {
      title: "Changes to this policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. We will post the revised policy at this URL with an updated effective date. Continued use after changes means you accept the updated policy.",
      ],
    },
    {
      title: "Google API Services disclosure",
      paragraphs: [
        "MacroKeep’s use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      ],
    },
    {
      title: "Contact",
      paragraphs: [
        "Questions about this Privacy Policy: feedback@macrokeep.com",
      ],
    },
  ],
};
