import {
  GOOGLE_DRIVE_APP_DATA_BLURB,
  GOOGLE_DRIVE_APP_DATA_CONSENT_TITLE,
  LOGIN_WELCOME_BLURB,
  LOGIN_WELCOME_TITLE,
} from "@/components/auth/auth-copy";
import { GoogleAuthPageLayout } from "@/components/auth/GoogleAuthPageLayout";
import { GoogleGMark } from "@/components/auth/GoogleGMark";
import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { useGoogleSession } from "@/contexts/google-session";
import { startGoogleOAuthRedirect } from "@/lib/gapi";
import { Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";

let oauthRetryRedirectStarted = false;

function searchString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function safeNextPath(value: string | null): string {
  if (!value) return "/";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* keep original value */
  }
  return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/";
}

export function LoginPage() {
  const {
    ready,
    sessionReady,
    signedIn,
    hasDriveAppDataScope,
    reconnecting,
    error,
    signIn,
  } = useGoogleSession();

  const navigate = useNavigate();
  const [signInPending, setSignInPending] = useState(false);

  const oauthSearch = useRouterState({
    select: (s) => {
      const search = s.location.search as Record<string, unknown>;
      return {
        error: searchString(search.oauth_error),
        retry: searchString(search.oauth_retry),
        promptConsent: searchString(search.prompt_consent),
        next: searchString(search.next),
      };
    },
  });

  useEffect(() => {
    if (oauthSearch.retry !== "1") return;
    if (oauthRetryRedirectStarted) return;
    oauthRetryRedirectStarted = true;

    const promptConsent = oauthSearch.promptConsent === "1";
    const nextPath = safeNextPath(oauthSearch.next);

    window.history.replaceState(null, "", "/login");
    void navigate({ to: "/login", replace: true });
    void startGoogleOAuthRedirect({ promptConsent, nextPath });
  }, [
    oauthSearch.next,
    oauthSearch.promptConsent,
    oauthSearch.retry,
    navigate,
  ]);

  useEffect(() => {
    if (!oauthSearch.error) return;
    toast.error(oauthSearch.error);
  }, [oauthSearch.error]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const needsConsent = ready && signedIn && !hasDriveAppDataScope;

  if (ready && sessionReady) {
    return <Navigate to="/" replace />;
  }

  if (reconnecting) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Signing you back in…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-mk-bg text-zinc-400">
        <Loader2 className="size-9 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm">Checking Google sign-in…</p>
      </div>
    );
  }

  return (
    <GoogleAuthPageLayout
      title={
        needsConsent ? GOOGLE_DRIVE_APP_DATA_CONSENT_TITLE : LOGIN_WELCOME_TITLE
      }
      description={
        needsConsent ? GOOGLE_DRIVE_APP_DATA_BLURB : LOGIN_WELCOME_BLURB
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
