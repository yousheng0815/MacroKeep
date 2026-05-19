import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  documentLangAttr,
  persistLocale,
  readStoredLocale,
  resolveLocaleFromNavigator,
  type AppLocale,
} from "./config";
import en from "./locales/en.json";
import zhTW from "./locales/zh-TW.json";

function initialLocale(): AppLocale {
  return readStoredLocale() ?? resolveLocaleFromNavigator();
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-TW": { translation: zhTW },
  },
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

function syncDocumentLang(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = documentLangAttr(locale as AppLocale);
}

syncDocumentLang(i18n.language);

i18n.on("languageChanged", (locale) => {
  syncDocumentLang(locale);
  persistLocale(locale as AppLocale);
});

export default i18n;
