import type { LandingPageContent, MarketingMessages } from "../i18n/types";
import { APP_URL } from "../site";

const SITE_ORIGIN = "https://macrokeep.com";

function localeToLanguage(locale: MarketingMessages["locale"]): string {
  return locale === "zh-TW" ? "zh-Hant" : "en";
}

function faqAnswerText(item: { answer: string }): string {
  return item.answer || "Contact us at feedback@macrokeep.com";
}

export function buildHomeStructuredData(
  messages: MarketingMessages,
  pageUrl: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: messages.siteTitle,
        description: messages.meta.homeDescription,
        inLanguage: localeToLanguage(messages.locale),
      },
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}#app`,
        name: messages.siteTitle,
        url: APP_URL,
        applicationCategory: "HealthApplication",
        operatingSystem: "All",
        browserRequirements: "Requires HTML5 compatible browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        abstract: messages.meta.schemaAbstract,
        description: messages.meta.homeDescription,
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: messages.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faqAnswerText(item),
          },
        })),
      },
    ],
  };
}

export function buildLandingStructuredData(
  page: LandingPageContent,
  pageUrl: string,
  locale: MarketingMessages["locale"],
  homePath: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: page.title,
        description: page.description,
        inLanguage: localeToLanguage(locale),
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "MacroKeep",
            item: new URL(homePath, SITE_ORIGIN).href,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.headline,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
