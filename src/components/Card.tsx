import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-mk-border bg-mk-surface p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
