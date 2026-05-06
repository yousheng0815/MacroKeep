import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Logo } from "@/components/Logo";
import { useGoogleSession } from "@/contexts/google-session";
import { DRIVE_APPDATA_SCOPE } from "@/lib/gapi";
import { Loader2 } from "lucide-react";
import { Navigate } from "@tanstack/react-router";

export function LoginPage() {
  const {
    ready,
    clientId,
    sessionReady,
    signedIn,
    hasDriveAppDataScope,
    oauthSilentRefreshPending,
    error,
    signInPending,
    signIn,
  } = useGoogleSession();

  const needsConsent = ready && !!clientId && signedIn && !hasDriveAppDataScope;

  if (ready && clientId && sessionReady) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-om-bg px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="scale-125" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to OpenMacro
          </h1>
          <p className="text-sm leading-relaxed text-om-muted">
            Sign in with Google so your diary, profile, and optional Gemini key live in
            your Drive{" "}
            <strong className="font-medium text-zinc-300">App Data</strong> folder (
            <span className="font-mono text-xs text-zinc-400">records.json</span>
            ). Only a small OAuth session is kept in{" "}
            <strong className="font-medium text-zinc-300">localStorage</strong> so you
            don&apos;t have to sign in on every visit.
          </p>
        </div>

        {!clientId ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Add{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
              VITE_GOOGLE_CLIENT_ID
            </code>{" "}
            to your{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
              .env
            </code>{" "}
            file and restart the dev server.
          </div>
        ) : null}

        {error ? (
          <p className="text-center text-sm text-red-400">{error}</p>
        ) : null}

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-10 animate-spin text-emerald-400" />
          </div>
        ) : oauthSilentRefreshPending && signedIn && !needsConsent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-10 animate-spin text-emerald-400" aria-hidden />
            <p className="text-center text-sm text-zinc-400">Refreshing Google access…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {needsConsent ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
                <p className="font-medium text-amber-50">Drive permission needed</p>
                <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
                  OpenMacro needs{" "}
                  <span className="break-all font-mono text-[11px] text-amber-100/90">
                    {DRIVE_APPDATA_SCOPE}
                  </span>{" "}
                  to save your data in the hidden app folder. Tap below to grant
                  access.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!clientId || signInPending || !ready}
              aria-busy={signInPending}
              onClick={() =>
                signIn(needsConsent ? { promptConsent: true } : undefined)
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signInPending ? <ButtonSpinner /> : null}
              {needsConsent ? "Grant Drive app data access" : "Continue with Google"}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-zinc-500">
              By continuing, you agree to connect Google Drive App Data for sync.
              No OpenMacro backend — keys and meals stay on-device except your own
              Google account storage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
