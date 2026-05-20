import { Card } from "@/components/Card";
import {
  buildFeedbackMailtoUrl,
  type FeedbackKind,
} from "@/lib/feedback";
import { Bug, ChevronRight, Lightbulb, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const FEEDBACK_LINKS: {
  kind: FeedbackKind;
  labelKey: string;
  subjectKey: string;
  bodyKey: string;
  Icon: typeof Bug;
}[] = [
  {
    kind: "bug",
    labelKey: "settings.feedback.reportBug",
    subjectKey: "settings.feedback.bugSubject",
    bodyKey: "settings.feedback.bugBody",
    Icon: Bug,
  },
  {
    kind: "feature",
    labelKey: "settings.feedback.requestFeature",
    subjectKey: "settings.feedback.featureSubject",
    bodyKey: "settings.feedback.featureBody",
    Icon: Lightbulb,
  },
  {
    kind: "other",
    labelKey: "settings.feedback.sendFeedback",
    subjectKey: "settings.feedback.otherSubject",
    bodyKey: "settings.feedback.otherBody",
    Icon: MessageSquare,
  },
];

export function FeedbackCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const hrefs = useMemo(
    () =>
      Object.fromEntries(
        FEEDBACK_LINKS.map(({ kind, subjectKey, bodyKey }) => [
          kind,
          buildFeedbackMailtoUrl(t(subjectKey), t(bodyKey), locale),
        ]),
      ) as Record<FeedbackKind, string>,
    [locale, t],
  );

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">
        {t("settings.feedback.title")}
      </h2>
      <p className="mt-1 text-sm text-mk-muted">{t("settings.feedback.blurb")}</p>

      <ul className="mt-4 space-y-2">
        {FEEDBACK_LINKS.map(({ kind, labelKey, Icon }) => (
          <li key={kind}>
            <a
              href={hrefs[kind]}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-left text-sm transition hover:bg-zinc-900"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon
                  className="size-5 shrink-0 text-zinc-400"
                  aria-hidden
                />
                <span className="font-medium text-zinc-100">{t(labelKey)}</span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-zinc-500"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
