import type { MarketingLocale } from "./config";
import { messagesEn } from "./en";
import { messagesZhTw } from "./zh-TW";
import type { MarketingMessages } from "./types";

const MESSAGES: Record<MarketingLocale, MarketingMessages> = {
  en: messagesEn,
  "zh-TW": messagesZhTw,
};

export function getMessages(locale: MarketingLocale): MarketingMessages {
  return MESSAGES[locale];
}

export { messagesEn, messagesZhTw };
export type { MarketingMessages } from "./types";
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  documentLangAttr,
  localizedPath,
  stripLocalePrefix,
} from "./config";
export type { MarketingLocale } from "./config";
