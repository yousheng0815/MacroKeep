import type { MarketingLocale } from "./config";

export type FaqItem = {
  question: string;
  answer: string;
};

export type FeatureItem = {
  title: string;
  description: string;
};

export type ScreenshotItem = {
  id: "setup" | "today" | "history" | "detail" | "log-meal";
  src: string;
  alt: string;
  label: string;
};

export type HowItWorksStep =
  | string
  | { before: string; highlight: string; after: string };

export type LandingPageSection = {
  heading: string;
  body: string;
};

export type LandingPageContent = {
  path: string;
  title: string;
  description: string;
  headline: string;
  linkLabel: string;
  lead: string;
  sections: LandingPageSection[];
  cta: string;
};

export type MarketingMessages = {
  locale: MarketingLocale;
  htmlLang: string;
  siteTitle: string;
  meta: {
    homeTitle: string;
    homeDescription: string;
    schemaAbstract: string;
    privacyDescription: string;
    termsDescription: string;
  };
  landingPages: {
    aiMealEstimates: LandingPageContent;
    googleDrive: LandingPageContent;
    myfitnesspalAlternative: LandingPageContent;
    howToTrackMacros: LandingPageContent;
  };
  nav: {
    openApp: string;
    openMacroKeep: string;
  };
  footer: {
    privacy: string;
    terms: string;
    guidesLabel: string;
  };
  home: {
    eyebrow: string;
    headline: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  screenshots: {
    heading: string;
    lead: string;
    stripLabel: string;
    items: ScreenshotItem[];
  };
  why: {
    heading: string;
    body: string;
  };
  features: {
    heading: string;
    items: FeatureItem[];
  };
  howItWorks: {
    heading: string;
    steps: HowItWorksStep[];
  };
  faq: {
    heading: string;
    items: FaqItem[];
    ctaPrimary: string;
  };
  legal: {
    homeLink: string;
    effectiveDateLabel: string;
    privacyTitle: string;
    termsTitle: string;
  };
  langSwitcher: {
    label: string;
    en: string;
    zhTW: string;
  };
};
