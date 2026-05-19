import i18n from "@/i18n";
import { intlLocaleTag, type AppLocale } from "@/i18n/config";

function intlLocale(): string | undefined {
  const lng = i18n.language;
  if (lng === "en" || lng === "zh-TW") {
    return intlLocaleTag(lng as AppLocale);
  }
  return undefined;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatLocalDateLabel(d: Date): string {
  const locale = intlLocale();
  if (i18n.language === "zh-TW") {
    const datePart = d.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const weekday = d.toLocaleDateString(locale, { weekday: "short" });
    return `${datePart} ${weekday}`;
  }
  return d.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(intlLocale(), {
    hour: "numeric",
    minute: "2-digit",
  });
}
