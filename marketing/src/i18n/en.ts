import type { MarketingMessages } from "./types";

export const messagesEn: MarketingMessages = {
  locale: "en",
  htmlLang: "en",
  siteTitle: "MacroKeep",
  meta: {
    homeTitle: "MacroKeep — Free Macro & Calorie Tracking with AI",
    homeDescription:
      "Free macro and calorie tracking with AI meal estimates from photos or text. Syncs through Google Drive with your own Gemini API key.",
    schemaAbstract:
      "Free calorie and macro tracking with optional AI meal estimates, synced through Google Drive with your own Gemini API key.",
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
    guidesLabel: "Guides",
  },
  home: {
    eyebrow: "Calorie & macro tracking",
    headline: "Free macro & calorie tracking with AI",
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
  landingPages: {
    aiMealEstimates: {
      path: "/features/ai-meal-estimates",
      title: "AI Meal Estimates for Macro Tracking",
      description:
        "Estimate protein, carbs, and fat from meal photos or text with MacroKeep and your own free Gemini API key.",
      headline: "AI meal estimates without a subscription",
      linkLabel: "AI meal estimates",
      lead: "Snap a photo or describe your meal. MacroKeep uses Google Gemini with your own API key to suggest macros — no paid scan feature required.",
      sections: [
        {
          heading: "Photo and text logging",
          body: "Log meals by taking a picture, typing what you ate, or entering macros manually. When you want help, Gemini can estimate calories and macros from photos and short descriptions.",
        },
        {
          heading: "Your key, your control",
          body: "MacroKeep stores your Gemini API key in your private Google Drive app folder alongside your food log. You bring your own free key from Google AI Studio, so you stay in control of usage and cost.",
        },
        {
          heading: "Simple daily totals",
          body: "Accepted estimates flow into your daily diary with protein, carbs, fat, and calories against your targets — the same clean Today view as manual entries.",
        },
      ],
      cta: "Try MacroKeep free",
    },
    googleDrive: {
      path: "/features/google-drive",
      title: "Macro Tracking Stored in Google Drive",
      description:
        "MacroKeep saves your food log in a private Google Drive app folder — not on MacroKeep servers.",
      headline: "Your food log stays in Google Drive",
      linkLabel: "Google Drive storage",
      lead: "MacroKeep has no database of your meals. Everything lives in a hidden app-specific folder tied to your Google account.",
      sections: [
        {
          heading: "Private app data folder",
          body: "Meal entries, macro targets, saved meals, and progress photos are stored in Google Drive application data — separate from the files you see in My Drive.",
        },
        {
          heading: "No MacroKeep servers for your diary",
          body: "We do not host or sell your personal food data. Sign in with Google, and your log syncs through Drive APIs directly between your browser and your account.",
        },
        {
          heading: "Access anywhere",
          body: "Open MacroKeep in a browser on phone or desktop, or install it to your home screen. Your data follows your Google account.",
        },
      ],
      cta: "Open MacroKeep",
    },
    myfitnesspalAlternative: {
      path: "/compare/myfitnesspal-alternative",
      title: "Free MyFitnessPal Alternative for Macro Tracking",
      description:
        "MacroKeep is a free, ad-free macro and calorie tracker with optional AI meal estimates and Google Drive storage.",
      headline: "A free alternative for macro tracking",
      linkLabel: "Free MFP alternative",
      lead: "If you want daily macro totals without clutter, ads, or paywalled meal scans, MacroKeep is built for that.",
      sections: [
        {
          heading: "Free core tracking",
          body: "Log meals, set targets, browse history, and view progress charts at no cost. No subscription is required for the diary itself.",
        },
        {
          heading: "Optional AI when you want it",
          body: "Photo and text estimates use your own Gemini API key instead of locking scans behind a premium tier.",
        },
        {
          heading: "Clean, focused interface",
          body: "MacroKeep prioritizes a simple Today view, clear macro bars, and fast logging — not upsells on every screen.",
        },
      ],
      cta: "Start tracking for free",
    },
    howToTrackMacros: {
      path: "/guides/how-to-track-macros",
      title: "How to Track Macros: A Simple Guide",
      description:
        "Learn how to track protein, carbs, and fat daily with MacroKeep — set targets, log meals, and review progress.",
      headline: "How to track macros",
      linkLabel: "How to track macros",
      lead: "Macro tracking means logging what you eat and comparing protein, carbohydrates, and fat to daily targets. Here is a straightforward way to start.",
      sections: [
        {
          heading: "1. Set your targets",
          body: "Enter your profile and let MacroKeep suggest daily calories and macros, or set your own protein, carbs, and fat goals in Settings.",
        },
        {
          heading: "2. Log every meal",
          body: "After you eat, add the meal with a photo, a short description, or manual macro entry. Consistency matters more than perfect estimates.",
        },
        {
          heading: "3. Review your day",
          body: "Use the Today screen to see remaining calories and macros. Check History for patterns and Progress for charts over time.",
        },
        {
          heading: "4. Adjust over time",
          body: "Update targets as your goals change. Saved meals make repeat entries faster once you know your usual portions.",
        },
      ],
      cta: "Open MacroKeep and log your first meal",
    },
  },
};
