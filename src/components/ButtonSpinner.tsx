import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

const sizeClass = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

export function ButtonSpinner({
  size = "md",
  className = "",
}: {
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  return (
    <Loader2
      className={`${sizeClass[size]} shrink-0 animate-spin ${className}`.trim()}
      aria-hidden
    />
  );
}

/**
 * While `pending`, shows only `spinner` centered; `children` stay in the layout
 * invisibly so the button keeps the same width as when idle. Parent should use
 * `position: relative` (e.g. Tailwind `relative`).
 */
export function ButtonPendingContents({
  pending,
  spinner,
  children,
}: {
  pending: boolean;
  spinner: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <span
        className={
          pending
            ? "invisible inline-flex items-center justify-center gap-2"
            : "inline-flex items-center justify-center gap-2"
        }
        aria-hidden={pending ? true : undefined}
      >
        {children}
      </span>
      {pending ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {spinner}
        </span>
      ) : null}
    </>
  );
}
