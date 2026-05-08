import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  backTo?: string;
  backAriaLabel?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  backTo,
  backAriaLabel = "Go back",
  actions,
}: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backTo ? (
            <Link
              to={backTo}
              aria-label={backAriaLabel}
              className="inline-flex items-center rounded-md p-1 text-zinc-300 transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {subtitle ? <p className="text-sm text-om-muted">{subtitle}</p> : null}
    </div>
  );
}
