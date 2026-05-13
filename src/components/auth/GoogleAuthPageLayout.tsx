import { Logo } from "@/components/Logo";
import type { ReactNode } from "react";

export type GoogleAuthPageLayoutProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
};

export function GoogleAuthPageLayout({
  title,
  description,
  children,
}: GoogleAuthPageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-om-bg px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="scale-125" />
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm leading-relaxed text-om-muted">{description}</p>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
