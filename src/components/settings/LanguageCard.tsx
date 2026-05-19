import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/i18n/config";
import i18n from "@/i18n";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

export function LanguageCard() {
  const { t } = useTranslation();
  const { updateLocale } = useRecords();
  const current = i18n.language as AppLocale;
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);
  const busy = pendingLocale !== null;

  const selectLocale = useCallback(
    async (locale: AppLocale) => {
      if (locale === current || busy) return;
      setPendingLocale(locale);
      try {
        await updateLocale(locale);
        toast.success(t("common.languageChanged", { language: LOCALE_LABELS[locale] }));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : t("common.languageChangeFailed"),
        );
      } finally {
        setPendingLocale(null);
      }
    },
    [busy, current, t, updateLocale],
  );

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">
        {t("common.language")}
      </h2>
      <p className="mt-1 text-sm text-mk-muted">{t("common.languageSubtitle")}</p>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400/90">
        {busy ? (
          <>
            <ButtonSpinner size="sm" className="text-emerald-400/90" />
            <span>{t("common.languageSaving")}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            <span>{t("common.languageCurrent", { language: LOCALE_LABELS[current] })}</span>
          </>
        )}
      </p>

      <div
        className="mt-4 grid gap-2"
        role="radiogroup"
        aria-label={t("common.language")}
        aria-busy={busy}
      >
        {SUPPORTED_LOCALES.map((locale) => {
          const label = LOCALE_LABELS[locale];
          const selected = current === locale;
          const saving = pendingLocale === locale;
          return (
            <label
              key={locale}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                selected
                  ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                  : "border-mk-border bg-mk-bg text-zinc-300 hover:bg-zinc-900"
              } ${busy ? "pointer-events-none opacity-70" : ""}`}
            >
              <span className="min-w-0 font-medium">{label}</span>
              {saving ? (
                <ButtonSpinner size="md" className="text-emerald-400" />
              ) : (
                <input
                  type="radio"
                  name="app-locale"
                  value={locale}
                  checked={selected}
                  disabled={busy}
                  onChange={() => void selectLocale(locale)}
                  className="size-4 shrink-0 accent-emerald-400"
                />
              )}
            </label>
          );
        })}
      </div>
    </Card>
  );
}
