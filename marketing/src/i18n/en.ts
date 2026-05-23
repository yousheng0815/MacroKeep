import type { MarketingMessages } from "./types";

export const messagesEn: MarketingMessages = {
  locale: "en",
  htmlLang: "en",
  siteTitle: "MacroKeep",
  meta: {
    homeDescription:
      "Free macro and calorie tracking with optional AI meal estimates. Your food log stays in Google Drive, not on our servers.",
    privacyDescription:
      "How MacroKeep accesses, uses, and stores your information.",
    termsDescription: "Terms governing your use of MacroKeep.",
  },
  nav: {
    openApp: "Open app",
    openMacroKeep: "Open MacroKeep",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
  },
  home: {
    eyebrow: "Calorie & macro tracking",
    headline: "Track your macros for free",
    lead: "Log what you eat, see your progress, and estimate macros with AI, powered by your own Google Drive and your own API key.",
    ctaPrimary: "Open MacroKeep",
    ctaSecondary: "How it works",
  },
  screenshots: {
    heading: "See the app",
    lead: "A quick look at the app. Simple logging, clear daily totals, and photo meal estimates.",
    stripLabel: "App screenshots",
    items: [
      {
        id: "setup",
        src: "/screenshots/setup-targets.png",
        alt: "Set your targets: profile and suggested macros",
        label: "Setup",
      },
      {
        id: "today",
        src: "/screenshots/today.png",
        alt: "Today screen with calorie ring, macro bars, and meals",
        label: "Today",
      },
      {
        id: "history",
        src: "/screenshots/history.png",
        alt: "History grouped by day with meal thumbnails",
        label: "History",
      },
      {
        id: "detail",
        src: "/screenshots/meal-details.png",
        alt: "Meal details with photo and macro breakdown",
        label: "Meal details",
      },
      {
        id: "log-meal",
        src: "/screenshots/log-meal.png",
        alt: "Log meal with photo, describe, and manual options",
        label: "Log meal",
      },
    ],
  },
  why: {
    heading: "Why MacroKeep exists",
    body: "I got tired of calorie apps that charge extra to scan meals or cram the screen with clutter. I wanted something simple and free, so I built MacroKeep for myself, and kept it clean enough to share.",
  },
  features: {
    heading: "What you can do",
    items: [
      {
        title: "Daily macro diary",
        description:
          "Log meals and see protein, carbs, and fat against your daily targets.",
      },
      {
        title: "Log meals your way",
        description:
          "Snap a photo, describe what you ate, or enter macros yourself. Gemini can estimate from photos and text when you want AI.",
      },
      {
        title: "History & progress",
        description:
          "Browse past days, charts, saved meals, and progress photos.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    steps: [
      "Sign in with Google.",
      {
        before: "Your log lives in a ",
        highlight: "private Google Drive app folder",
        after: ", not on our servers, and separate from My Drive.",
      },
      "Open it in the browser on your phone or desktop, or add it to your home screen.",
    ],
  },
  faq: {
    heading: "FAQ",
    ctaPrimary: "Open MacroKeep",
    items: [
      {
        question: "Is MacroKeep free?",
        answer:
          "Yes, 100%. The app itself has no subscriptions and no ads. For the AI photo/text features, the app connects to your own free Gemini API key from Google AI Studio. It takes less than a minute to set up, costs nothing for personal use, and ensures you retain full control over your AI usage.",
      },
      {
        question: "Why a Gemini API key?",
        answer:
          "Photo and text meal estimates run through Google Gemini. Your key is stored in Drive with your other MacroKeep data.",
      },
      {
        question: "Where is my data?",
        answer: `Your logs live in a secure, hidden Google Drive app folder tied to your personal Google account, separate from your main My Drive. MacroKeep has zero database servers, meaning we never see, store, or sell your personal data.`,
      },
      {
        question: "Questions or feedback?",
        answer: "",
      },
    ],
  },
  legal: {
    homeLink: "← Home",
    effectiveDateLabel: "Effective date:",
    privacyTitle: "Privacy Policy",
    termsTitle: "Terms of Service",
  },
  langSwitcher: {
    label: "Language",
    en: "English",
    zhTW: "繁體中文",
  },
};
