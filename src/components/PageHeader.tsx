import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Fixed destination (ignored when `onBack` is set). */
  backTo?: string;
  backAriaLabel?: string;
  /** Prefer history-style back instead of linking to `backTo`. */
  onBack?: () => void;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  backTo,
  backAriaLabel = "Go back",
  onBack,
  actions,
}: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backAriaLabel}
              className="om-pwa-no-select inline-flex items-center rounded-xl p-1.5 text-zinc-300 transition hover:bg-zinc-900/60 hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : backTo ? (
            <Link
              to={backTo}
              aria-label={backAriaLabel}
              className="om-pwa-no-select inline-flex items-center rounded-xl p-1.5 text-zinc-300 transition hover:bg-zinc-900/60 hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}
          <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {subtitle ? (
        <p className="text-sm leading-relaxed text-om-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}
