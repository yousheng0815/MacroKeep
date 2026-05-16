type LogoProps = {
  className?: string;
  /** App icon (`favicon.png`) — compact nav chrome. */
  variant?: "mark" | "wordmark";
  /** Larger wordmark for centered auth / onboarding. */
  prominent?: boolean;
};

export function Logo({
  className = "",
  variant = "wordmark",
  prominent = false,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <img
        src="/favicon.png"
        alt="MacroKeep"
        width={128}
        height={128}
        className={`size-8 shrink-0 rounded-lg object-contain ${className}`}
        decoding="async"
      />
    );
  }

  const wordmarkClass = prominent
    ? `h-9 w-auto max-w-[min(280px,85vw)] object-contain object-left sm:h-10 ${className}`
    : `h-7 w-auto min-w-0 max-w-[min(220px,55vw)] object-contain object-left sm:h-8 sm:max-w-[260px] ${className}`;

  return (
    <img
      src="/wordmark.png"
      alt="MacroKeep"
      className={wordmarkClass}
      decoding="async"
    />
  );
}
