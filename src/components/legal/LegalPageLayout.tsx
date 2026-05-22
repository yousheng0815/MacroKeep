import { Logo } from "@/components/Logo";
import { paths } from "@/lib/routes";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-mk-bg text-zinc-100">
      <header className="border-b border-zinc-800/80 px-6 py-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Link
            to={paths.login}
            className="inline-flex items-center gap-2 text-sm text-mk-muted transition hover:text-white"
          >
            <Logo variant="mark" className="size-8" />
            <span>{t("legal.backToApp")}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <div className="mt-8">{children}</div>
        <footer className="mt-12 border-t border-zinc-800/80 pt-6">
          <LegalPageFooterLinks />
        </footer>
      </main>
    </div>
  );
}

export function LegalPageFooterLinks() {
  const { t } = useTranslation();

  return (
    <nav
      className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-mk-muted"
      aria-label={t("legal.footerNavAria")}
    >
      <Link to={paths.privacy} className="underline-offset-2 hover:text-white hover:underline">
        {t("legal.privacyPolicy")}
      </Link>
      <Link to={paths.terms} className="underline-offset-2 hover:text-white hover:underline">
        {t("legal.termsOfService")}
      </Link>
    </nav>
  );
}
