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
