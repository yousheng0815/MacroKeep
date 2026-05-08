import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { useGoogleSession } from "@/contexts/google-session";
import { useRecords } from "@/hooks/use-records";
import { DRIVE_APPDATA_SCOPE, getGoogleUserEmail } from "@/lib/gapi";
import type { UserProfile } from "@/types/records";
import { CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

function GeminiKeyCard({
  geminiKey,
  updateGeminiKey,
  isSaving,
}: {
  geminiKey: string;
  updateGeminiKey: (key: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(geminiKey);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            BYOK — Gemini API Key
          </h2>
          <p className="mt-1 text-xs text-om-muted">
            Saved inside your Drive <span className="font-mono text-zinc-400">records.json</span>{" "}
            with your meals — never sent to OpenMacro servers.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {geminiKey.trim() ? (
            <>
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-emerald-400">Connected</span>
            </>
          ) : (
            <span className="text-zinc-400">Not set</span>
          )}
        </div>
      </div>

      <label className="mt-4 block text-xs text-zinc-400">
        API key
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-400/60"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving}
          aria-busy={isSaving}
          onClick={() => void updateGeminiKey(draft)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? <ButtonSpinner /> : null}
          Save key
        </button>
        <a
          className="inline-flex items-center rounded-xl border border-om-border bg-om-bg px-4 py-2 text-sm font-semibold text-blue-400 transition hover:bg-zinc-900"
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
        >
          Get a free key from Google AI Studio
        </a>
      </div>
    </Card>
  );
}

function ProfileCard({
  profile,
  updateProfile,
  isSaving,
}: {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(profile);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">Profile & targets</h2>
      <p className="mt-1 text-xs text-om-muted">
        Defaults ship as requested (1989 birth year, 180cm / 72kg, 2000 kcal).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-zinc-400">
          Birth year
          <input
            inputMode="numeric"
            value={draft.birthYear}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                birthYear: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Height (cm)
          <input
            inputMode="decimal"
            value={draft.heightCm}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                heightCm: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Weight (kg)
          <input
            inputMode="decimal"
            value={draft.weightKg}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                weightKg: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Daily target (kcal)
          <input
            inputMode="numeric"
            value={draft.dailyTargetKcal}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                dailyTargetKcal: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Protein target (g)
          <input
            inputMode="decimal"
            value={draft.proteinTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                proteinTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Fats target (g)
          <input
            inputMode="decimal"
            value={draft.fatsTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                fatsTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">
          Carbs target (g)
          <input
            inputMode="decimal"
            value={draft.carbsTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                carbsTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={isSaving}
        aria-busy={isSaving}
        onClick={() => void updateProfile(draft)}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? <ButtonSpinner /> : null}
        Save profile
      </button>
    </Card>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { sessionReady, signOut } = useGoogleSession();
  const [signOutBusy, setSignOutBusy] = useState(false);
  const {
    records,
    geminiKey,
    updateGeminiKey,
    updateProfile,
    isSaving,
  } = useRecords();

  const email = getGoogleUserEmail();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-om-muted">
          Authentication, AI keys, and your baseline targets.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-white">Google account & Drive</h2>
        <p className="mt-2 text-xs text-om-muted">
          Your diary, targets, and optional Gemini key sync to the hidden{" "}
          <span className="text-zinc-300">App Data</span> folder as{" "}
          <span className="font-mono text-zinc-400">records.json</span>. Only your
          Google OAuth session is stored locally so repeat visits stay signed in.{" "}
          <Link
            to="/drive"
            className="text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
          >
            Browse all app data files
          </Link>
          .
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Signed in as</dt>
            <dd className="mt-0.5 font-medium text-white">
              {email ?? "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Drive scope</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {sessionReady ? (
                <>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  <span className="break-all font-mono text-[11px] text-emerald-400/90">
                    {DRIVE_APPDATA_SCOPE}
                  </span>
                </>
              ) : (
                <span className="text-zinc-400">Not connected</span>
              )}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={signOutBusy}
          aria-busy={signOutBusy}
          onClick={() =>
            void (async () => {
              setSignOutBusy(true);
              try {
                await signOut();
                qc.removeQueries({ queryKey: ["records"] });
              } finally {
                setSignOutBusy(false);
              }
            })()
          }
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signOutBusy ? <ButtonSpinner className="text-zinc-200" /> : null}
          Sign out
        </button>
      </Card>

      <GeminiKeyCard
        key={geminiKey}
        geminiKey={geminiKey}
        updateGeminiKey={updateGeminiKey}
        isSaving={isSaving}
      />

      <ProfileCard
        key={records.updatedAt}
        profile={records.profile}
        updateProfile={updateProfile}
        isSaving={isSaving}
      />
    </div>
  );
}
