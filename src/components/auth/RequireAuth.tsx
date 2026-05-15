import {
  GOOGLE_DRIVE_APP_DATA_BLURB,
  GOOGLE_DRIVE_APP_DATA_CONSENT_TITLE,
} from "@/components/auth/auth-copy";
import { GoogleAuthPageLayout } from "@/components/auth/GoogleAuthPageLayout";
import { GoogleGMark } from "@/components/auth/GoogleGMark";
import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { useGoogleSession } from "@/contexts/google-session";
import { useRecords } from "@/hooks/use-records";
import { getGoogleUserEmail, getGoogleUserId } from "@/lib/gapi";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";

function recordsLoadErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
  }
  return "Could not load your diary from Google Drive.";
}

function RecordsReadyGate({ children }: { children: ReactNode }) {
  const { isRecordsReady, records, error, refetch } = useRecords();
  const [retryPending, setRetryPending] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
            className="relative btn-mobile-block-lg gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-[220px]"
          >
            <ButtonPendingContents
              pending={retryPending}
              spinner={<ButtonSpinner />}
            >
              Try again
            </ButtonPendingContents>
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

  if (!records.onboardingCompleted && pathname !== "/tutorial") {
    return <Navigate to="/tutorial" replace />;
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const {
    ready,
    sessionReady,
    signedIn,
    reconnecting,
    signIn,
    error,
    hasDriveAppDataScope,
  } = useGoogleSession();
  const uid = getGoogleUserId();
  const rememberedEmail = getGoogleUserEmail();
  const [signInPending, setSignInPending] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    if (sessionReady) return;
    if (!error) return;
    toast.error(error);
  }, [signedIn, sessionReady, error]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Checking Google sign-in…</p>
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!sessionReady) {
    const needsConsent = signedIn && !hasDriveAppDataScope;

    if (reconnecting) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-om-bg text-zinc-400">
          <Loader2
            className="size-9 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm">Signing you back in…</p>
        </div>
      );
    }

    return (
      <GoogleAuthPageLayout
        title={
          needsConsent ? GOOGLE_DRIVE_APP_DATA_CONSENT_TITLE : "Sign in again"
        }
        description={
          needsConsent ? (
            GOOGLE_DRIVE_APP_DATA_BLURB
          ) : (
            <>
              <span className="block">
                Your session may have expired. Continue to sign in with Google
                again.
              </span>
              {rememberedEmail ? (
                <span className="mt-2 block text-zinc-500">
                  Reconnecting as{" "}
                  <span className="font-medium text-zinc-400">
                    {rememberedEmail}
                  </span>
                </span>
              ) : null}
            </>
          )
        }
      >
        <div className="space-y-4">
          <button
            type="button"
            disabled={signInPending}
            aria-busy={signInPending}
            onClick={() => {
              setSignInPending(true);
              signIn(needsConsent ? { promptConsent: true } : undefined);
            }}
            className="relative btn-mobile-block-lg gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={signInPending}
              spinner={<ButtonSpinner />}
            >
              <GoogleGMark />
              Continue with Google
            </ButtonPendingContents>
          </button>
        </div>
      </GoogleAuthPageLayout>
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
