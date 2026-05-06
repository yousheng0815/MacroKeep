import { ButtonSpinner } from "@/components/ButtonSpinner";
import { useGoogleSession } from "@/contexts/google-session";
import { useRecords } from "@/hooks/use-records";
import { getGoogleUserEmail, getGoogleUserId } from "@/lib/gapi";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

function recordsLoadErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
  }
  return "Could not load your diary from Google Drive.";
}

function RecordsReadyGate({ children }: { children: ReactNode }) {
  const { isRecordsReady, error, refetch } = useRecords();
  const [retryPending, setRetryPending] = useState(false);

  if (!isRecordsReady) {
    if (error) {
      const msg = recordsLoadErrorMessage(error);
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-om-bg px-6 text-center text-zinc-100">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Couldn&apos;t load diary
            </h1>
            <p className="text-sm leading-relaxed text-om-muted">{msg}</p>
          </div>
          <button
            type="button"
            disabled={retryPending}
            aria-busy={retryPending}
            onClick={() =>
              void (async () => {
                setRetryPending(true);
                try {
                  await refetch();
                } finally {
                  setRetryPending(false);
                }
              })()
            }
            className="flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retryPending ? <ButtonSpinner /> : null}
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Loading your diary…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const {
    ready,
    sessionReady,
    clientId,
    signedIn,
    signIn,
    signInPending,
    error,
    hasDriveAppDataScope,
    oauthSilentRefreshPending,
  } = useGoogleSession();
  const uid = getGoogleUserId();
  const rememberedEmail = getGoogleUserEmail();

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Checking Google sign-in…</p>
      </div>
    );
  }

  if (!clientId || !signedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!sessionReady) {
    const needsConsent = signedIn && !hasDriveAppDataScope;
    if (oauthSilentRefreshPending) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
          <Loader2
            className="size-9 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-zinc-300">Refreshing Google access…</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-om-bg px-6 text-center text-zinc-100">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            {needsConsent ? "Drive permission needed" : "Reconnect to Google"}
          </h1>
          <p className="text-sm leading-relaxed text-om-muted">
            {needsConsent
              ? "Grant Drive app data access again so OpenMacro can load and save your diary."
              : hasDriveAppDataScope
                ? "This device remembers your account and Drive permission, but Google has not issued a fresh access token for OpenMacro yet. Automatic renewal only works when you stay signed into Google in this browser; otherwise tap Continue once—you should not need to grant Drive again."
                : "Google couldn’t renew your session automatically (e.g. signed out of Google in this browser). Continue once — your Drive consent stays saved."}
          </p>
          {!needsConsent && rememberedEmail ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              Reconnecting as <span className="font-medium text-zinc-400">{rememberedEmail}</span>
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="max-w-md text-sm text-red-400">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={signInPending || !clientId}
          aria-busy={signInPending}
          onClick={() =>
            signIn(needsConsent ? { promptConsent: true } : undefined)
          }
          className="flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {signInPending ? <ButtonSpinner /> : null}
          {needsConsent ? "Grant Drive app data access" : "Continue with Google"}
        </button>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Loading account…</p>
      </div>
    );
  }

  return <RecordsReadyGate>{children}</RecordsReadyGate>;
}
