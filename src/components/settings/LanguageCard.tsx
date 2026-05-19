import { Card } from "@/components/Card";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/i18n/config";
import i18n from "@/i18n";
import { useTranslation } from "react-i18next";

export function LanguageCard() {
  const { t } = useTranslation();
  const current = i18n.language as AppLocale;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">
        {t("common.language")}
      </h2>
      <p className="mt-1 text-sm text-mk-muted">{t("common.languageSubtitle")}</p>

      <div
        className="mt-4 grid gap-2"
        role="radiogroup"
        aria-label={t("common.language")}
      >
        {SUPPORTED_LOCALES.map((locale) => {
          const label = LOCALE_LABELS[locale];
          const selected = current === locale;
          return (
            <label
              key={locale}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                selected
                  ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                  : "border-mk-border bg-mk-bg text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <span className="min-w-0 font-medium">{label}</span>
              <input
                type="radio"
                name="app-locale"
                value={locale}
                checked={selected}
                onChange={() => void i18n.changeLanguage(locale)}
                className="size-4 shrink-0 accent-emerald-400"
              />
            </label>
          );
        })}
      </div>
    </Card>
  );
}
