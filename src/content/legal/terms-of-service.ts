import type { LegalDocument } from "./types";

/** English terms of service — public URL for OAuth consent screen. */
export const termsOfServiceEn: LegalDocument = {
  title: "Terms of Service",
  effectiveDate: "May 23, 2026",
  intro: [
    'These Terms of Service ("Terms") govern your use of MacroKeep ("we," "us," or "the app"), a web application for tracking nutrition and related wellness data. By accessing or using MacroKeep, you agree to these Terms and to our Privacy Policy.',
    "If you do not agree, do not use MacroKeep.",
  ],
  sections: [
    {
      title: "The service",
      paragraphs: [
        "MacroKeep lets you log meals, macros, progress photos, and related settings. The app stores your data in your Google Drive application data folder using your Google account. Features may change, be added, or removed over time.",
      ],
    },
    {
      title: "Eligibility and your account",
      paragraphs: [
        "You must have a Google account and permission to use Google Drive and Sign-In. You are responsible for activity under your Google account and for keeping your credentials secure. You must provide accurate information when using the app.",
      ],
    },
    {
      title: "Google services",
      paragraphs: [
        "MacroKeep depends on Google Sign-In, Google Drive (application data), and optionally Google Gemini if you provide an API key. Your use of those services is subject to Google’s terms and policies. We are not responsible for outages, changes, or actions by Google.",
      ],
    },
    {
      title: "Optional AI features",
      paragraphs: [
        "Meal photo and description analysis uses a Gemini API key you supply (bring your own key). Google’s Gemini API includes a free tier with rate limits; you are responsible for any charges if you enable billing on the key’s Google Cloud project. AI outputs are estimates only, not medical, dietary, or professional advice. You are responsible for verifying nutrition information and for how you use AI results. We do not guarantee accuracy or availability of AI features.",
      ],
    },
    {
      title: "Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Use MacroKeep for unlawful purposes or in violation of applicable laws.",
        "Attempt to access other users’ data or Google accounts.",
        "Interfere with or disrupt the app, servers, or networks.",
        "Reverse engineer or misuse the service except where permitted by law.",
        "Upload malicious content or abuse feedback channels.",
      ],
    },
    {
      title: "Your content and data",
      paragraphs: [
        "You retain ownership of content you store via MacroKeep in your Google account. You grant us only the technical permission needed to operate the app (through Google OAuth scopes you approve). You are responsible for backups and for content you choose to store.",
      ],
    },
    {
      title: "Disclaimer of warranties",
      paragraphs: [
        'MacroKeep is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the app will be uninterrupted, error-free, or secure.',
      ],
    },
    {
      title: "Limitation of liability",
      paragraphs: [
        "To the maximum extent permitted by law, MacroKeep and its operators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or goodwill, arising from your use of the app. Our total liability for any claim related to the service is limited to the greater of (a) amounts you paid us for MacroKeep in the twelve months before the claim, or (b) fifty US dollars (USD $50), if you have not paid us anything.",
        "Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted by law.",
      ],
    },
    {
      title: "Health disclaimer",
      paragraphs: [
        "MacroKeep is a general wellness tool, not a medical device or professional health service. Always consult qualified professionals for medical or dietary decisions. Do not rely on the app for diagnosis or treatment.",
      ],
    },
    {
      title: "Termination",
      paragraphs: [
        "You may stop using MacroKeep at any time by signing out and deleting your data. We may suspend or discontinue the service at any time. Sections that by their nature should survive termination will survive.",
      ],
    },
    {
      title: "Changes to these Terms",
      paragraphs: [
        "We may modify these Terms by posting an updated version at this URL with a new effective date. Your continued use after changes constitutes acceptance.",
      ],
    },
    {
      title: "Governing law",
      paragraphs: [
        "These Terms are governed by the laws applicable where MacroKeep is operated, without regard to conflict-of-law rules, except where mandatory consumer protections in your country apply.",
      ],
    },
    {
      title: "Contact",
      paragraphs: ["Questions about these Terms: feedback@macrokeep.com"],
    },
  ],
};
