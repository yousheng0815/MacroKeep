import { GoogleAuthPageLayout } from "@/components/auth/GoogleAuthPageLayout";
import { GoogleGMark } from "@/components/auth/GoogleGMark";
import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { useGoogleSession } from "@/contexts/google-session";
import { shouldPromptConsentForSignIn } from "@/lib/gapi";
import { useRecords } from "@/hooks/use-records";
import { getGoogleUserEmail, getGoogleUserId } from "@/lib/gapi";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";
import { useTranslation } from "react-i18next";

function recordsLoadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
  }
  return fallback;
}

function RecordsReadyGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isRecordsReady, records, error, refetch } = useRecords();
  const [retryPending, setRetryPending] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isRecordsReady) {
    if (error) {
      const msg = recordsLoadErrorMessage(
        error,
        t("auth.couldntLoadDiaryDefault"),
      );
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-mk-bg px-6 text-center text-zinc-100">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              {t("auth.couldntLoadDiaryTitle")}
            </h1>
            <p className="text-sm leading-relaxed text-mk-muted">{msg}</p>
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
              {t("auth.tryAgain")}
            </ButtonPendingContents>
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">{t("auth.loadingDiary")}</p>
      </div>
    );
  }

  if (!records.onboardingCompleted && pathname !== "/tutorial") {
    return <Navigate to="/tutorial" replace />;
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">{t("auth.checkingSignIn")}</p>
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
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
          <Loader2
            className="size-9 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm">{t("auth.signingBackIn")}</p>
        </div>
      );
    }

    return (
      <GoogleAuthPageLayout
        title={
          needsConsent
            ? t("auth.driveConsentTitle")
            : t("auth.signInAgainTitle")
        }
        description={
          needsConsent ? (
            t("auth.driveConsentBlurb")
          ) : (
            <>
              <span className="block">{t("auth.sessionExpiredLead")}</span>
              {rememberedEmail ? (
                <span className="mt-2 block text-zinc-500">
                  {t("auth.reconnectingAs", { email: rememberedEmail })}
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
              signIn(
                needsConsent || shouldPromptConsentForSignIn()
                  ? { promptConsent: true }
                  : undefined,
              );
            }}
            className="relative btn-mobile-block-lg gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={signInPending}
              spinner={<ButtonSpinner />}
            >
              <GoogleGMark />
              {t("auth.continueWithGoogle")}
            </ButtonPendingContents>
          </button>
        </div>
      </GoogleAuthPageLayout>
    );
  }

  if (!uid) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">{t("auth.loadingAccount")}</p>
      </div>
    );
  }

  return <RecordsReadyGate>{children}</RecordsReadyGate>;
}
