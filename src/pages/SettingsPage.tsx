import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useGoogleSession } from "@/contexts/google-session";
import { useRecords } from "@/hooks/use-records";
import { getGoogleUserEmail } from "@/lib/gapi";
import { validateGeminiApiKey } from "@/lib/gemini";
import type { ProfileGender, UserProfile } from "@/types/records";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, FolderOpen } from "lucide-react";
import { useState } from "react";

/** Remount ProfileCard when the persisted profile replaces local drafts. */
function profileSyncKey(profile: UserProfile): string {
  return [
    profile.birthDate,
    profile.gender,
    profile.heightCm,
    profile.weightKg,
    profile.dailyTargetKcal,
    profile.proteinTargetG,
    profile.fatsTargetG,
    profile.carbsTargetG,
  ].join("|");
}

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
  const [keyFlowBusy, setKeyFlowBusy] = useState(false);
  const [keyFlowError, setKeyFlowError] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Gemini API Key</h2>
          <p className="mt-1 text-sm text-om-muted">
            Add an API key to estimate macros from photos. The key is saved in
            your own Google Drive.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {geminiKey.trim() && (
            <>
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-emerald-400">Connected</span>
            </>
          )}
        </div>
      </div>

      {!geminiKey.trim() && (
        <div className="mt-4 rounded-xl border border-om-border bg-zinc-950/40 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            How to get a key
          </h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-om-muted marker:text-zinc-500">
            <li>
              Open{" "}
              <a
                className="font-medium text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300"
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Google AI Studio → API keys
              </a>{" "}
              and sign in with Google.
            </li>
            <li>
              Click <span className="text-zinc-300">Create API key</span>. Pick
              an existing Cloud project or let Google create one when prompted.
            </li>
            <li>
              Copy the new key — it starts with{" "}
              <span className="font-mono text-zinc-400">AIza</span> — then paste
              it in the field below.
            </li>
            <li>
              Press <span className="text-zinc-300">Save key</span>. We verify
              the key with Google before storing it in Drive.
            </li>
          </ol>
        </div>
      )}

      <label className="mt-4 block text-sm text-zinc-400">
        API key
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setKeyFlowError(null);
          }}
          placeholder="AIza…"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 font-mono text-base text-white outline-none focus:border-emerald-400/60"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving || keyFlowBusy}
          aria-busy={isSaving || keyFlowBusy}
          onClick={() =>
            void (async () => {
              setKeyFlowError(null);
              const trimmed = draft.trim();
              if (!trimmed) {
                await updateGeminiKey("");
                return;
              }
              setKeyFlowBusy(true);
              try {
                await validateGeminiApiKey(trimmed);
                await updateGeminiKey(trimmed);
              } catch (e) {
                setKeyFlowError(
                  e instanceof Error ? e.message : "Could not verify key.",
                );
              } finally {
                setKeyFlowBusy(false);
              }
            })()
          }
          className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ButtonPendingContents
            pending={isSaving || keyFlowBusy}
            spinner={<ButtonSpinner />}
          >
            Save key
          </ButtonPendingContents>
        </button>
        <a
          className="inline-flex items-center rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-blue-400 transition hover:bg-zinc-900"
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
        >
          Open Google AI Studio
        </a>
      </div>
      {keyFlowError ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {keyFlowError}
        </p>
      ) : null}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          Birthday
          <input
            type="date"
            value={draft.birthDate}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                birthDate: e.target.value,
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Gender
          <select
            value={draft.gender}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                gender: e.target.value as ProfileGender,
              }))
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="block text-sm text-zinc-400">
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
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={isSaving}
        aria-busy={isSaving}
        onClick={() => void updateProfile(draft)}
        className="relative mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ButtonPendingContents pending={isSaving} spinner={<ButtonSpinner />}>
          Save profile
        </ButtonPendingContents>
      </button>

      <Link
        to="/tutorial"
        className="relative mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
      >
        Calculate suggested targets again
      </Link>
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
    wipeAllRemoteData,
  } = useRecords();
  const email = getGoogleUserEmail();
  const [wipePhrase, setWipePhrase] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeDone, setWipeDone] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Authentication, AI keys, and your baseline targets."
      />

      <GeminiKeyCard
        key={geminiKey}
        geminiKey={geminiKey}
        updateGeminiKey={updateGeminiKey}
        isSaving={isSaving}
      />

      <Card>
        <h2 className="text-sm font-semibold text-white">
          Google account & Drive
        </h2>

        <Link
          to="/drive"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-left text-sm transition hover:bg-zinc-900"
        >
          <span className="flex min-w-0 items-start gap-3">
            <FolderOpen
              className="mt-0.5 size-5 shrink-0 text-zinc-400"
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block font-medium text-zinc-100">
                Drive app data
              </span>
              <span className="mt-0.5 block text-sm font-normal text-om-muted">
                Files in your App Data folder
              </span>
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-zinc-500" aria-hidden />
        </Link>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-sm text-zinc-500">Signed in as</dt>
            <dd className="mt-0.5 font-medium text-white">
              {email ?? "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Drive access</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {sessionReady ? (
                <>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  <span className="text-sm text-emerald-400/90">
                    Access is set up correctly.
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
          className="relative mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ButtonPendingContents
            pending={signOutBusy}
            spinner={<ButtonSpinner className="text-zinc-200" />}
          >
            Sign out
          </ButtonPendingContents>
        </button>

        <div className="mt-8 border-t border-red-500/15 pt-6">
          <h3 className="text-sm font-semibold text-red-300">
            Delete all cloud data
          </h3>
          <p className="mt-1 text-sm text-om-muted">
            Permanently removes every OpenMacro file from this Google
            account&apos;s Drive App Data folder. This cannot be reversed. Type{" "}
            <span className="font-mono text-zinc-300">DELETE</span> to enable
            the button.
          </p>
          <label className="mt-3 block text-sm text-zinc-500">
            Confirmation
            <input
              value={wipePhrase}
              onChange={(e) => {
                setWipePhrase(e.target.value);
                setWipeError(null);
                setWipeDone(false);
              }}
              autoComplete="off"
              placeholder="DELETE"
              disabled={!sessionReady || wipeBusy}
              className="mt-1 w-full max-w-xs rounded-xl border border-om-border bg-om-bg px-4 py-3 font-mono text-base text-white outline-none placeholder:text-zinc-600 focus:border-red-400/50"
            />
          </label>
          {wipeError ? (
            <p className="mt-2 text-sm text-red-300">{wipeError}</p>
          ) : null}
          {wipeDone ? (
            <p className="mt-2 text-sm text-emerald-400">
              All App Data files were removed. Your diary will reload empty.
            </p>
          ) : null}
          <button
            type="button"
            disabled={
              !sessionReady || wipeBusy || wipePhrase !== "DELETE" || isSaving
            }
            aria-busy={wipeBusy}
            onClick={() =>
              void (async () => {
                setWipeError(null);
                setWipeDone(false);
                setWipeBusy(true);
                try {
                  await wipeAllRemoteData();
                  setWipePhrase("");
                  setWipeDone(true);
                } catch (e) {
                  setWipeError(
                    e instanceof Error
                      ? e.message
                      : "Could not delete all data.",
                  );
                } finally {
                  setWipeBusy(false);
                }
              })()
            }
            className="relative mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={wipeBusy}
              spinner={<ButtonSpinner className="text-red-100" />}
            >
              Delete all data in Drive
            </ButtonPendingContents>
          </button>
        </div>
      </Card>

      <ProfileCard
        key={profileSyncKey(records.profile)}
        profile={records.profile}
        updateProfile={updateProfile}
        isSaving={isSaving}
      />
    </div>
  );
}
