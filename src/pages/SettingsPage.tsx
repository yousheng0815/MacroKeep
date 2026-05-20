import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import {
  HeightWeightFields,
  UnitsPreferenceSegment,
} from "@/components/profile/body-measurement-fields";
import { InstallAppCard } from "@/components/settings/InstallAppCard";
import { FeedbackCard } from "@/components/settings/FeedbackCard";
import { LanguageCard } from "@/components/settings/LanguageCard";
import { useGoogleSession } from "@/contexts/google-session";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { getGoogleUserEmail } from "@/lib/gapi";
import { validateGeminiApiKey } from "@/lib/gemini";
import { convertBodyMeasuresToUnits } from "@/lib/units";
import type { ProfileGender, UserProfile } from "@/types/records";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

type ProfileBodyDraft = Pick<
  UserProfile,
  "birthDate" | "gender" | "unitsPreference" | "height" | "weight"
>;

type MacroTargetsDraft = Pick<
  UserProfile,
  "dailyTargetKcal" | "proteinTargetG" | "fatsTargetG" | "carbsTargetG"
>;

function profileBodyFromUser(profile: UserProfile): ProfileBodyDraft {
  return {
    birthDate: profile.birthDate,
    gender: profile.gender,
    unitsPreference: profile.unitsPreference,
    height: profile.height,
    weight: profile.weight,
  };
}

function profileBodySyncKey(profile: UserProfile): string {
  return [
    profile.birthDate,
    profile.gender,
    profile.unitsPreference,
    profile.height,
    profile.weight,
  ].join("|");
}

function macroTargetsFromUser(profile: UserProfile): MacroTargetsDraft {
  return {
    dailyTargetKcal: profile.dailyTargetKcal,
    proteinTargetG: profile.proteinTargetG,
    fatsTargetG: profile.fatsTargetG,
    carbsTargetG: profile.carbsTargetG,
  };
}

function macroTargetsSyncKey(profile: UserProfile): string {
  return [
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
  const { t } = useTranslation();
  const [draft, setDraft] = useState(geminiKey);
  const [keyFlowBusy, setKeyFlowBusy] = useState(false);
  const aiStudioLink = (
    <a
      className="font-medium text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300"
      href="https://aistudio.google.com/app/apikey"
      target="_blank"
      rel="noreferrer"
    />
  );
  const stepEmphasis = <span className="text-zinc-300" />;
  const stepMono = <span className="font-mono text-zinc-400" />;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {t("settings.geminiApiKey")}
          </h2>
          <p className="mt-1 text-sm text-mk-muted">{t("settings.geminiBlurb")}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {geminiKey.trim() && (
            <>
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-emerald-400">{t("common.connected")}</span>
            </>
          )}
        </div>
      </div>

      {!geminiKey.trim() && (
        <div className="mt-4 rounded-xl border border-mk-border bg-zinc-950/40 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("settings.howToGetKey")}
          </h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-mk-muted marker:text-zinc-500">
            <li>
              <Trans
                i18nKey="settings.howToStep1"
                components={{ 1: aiStudioLink }}
              />
            </li>
            <li>
              <Trans
                i18nKey="settings.howToStep2"
                components={{ 1: stepEmphasis }}
              />
            </li>
            <li>
              <Trans
                i18nKey="settings.howToStep3"
                components={{ 1: stepMono }}
              />
            </li>
            <li>
              <Trans
                i18nKey="settings.howToStep4"
                components={{ 1: stepEmphasis }}
              />
            </li>
          </ol>
        </div>
      )}

      <label className="mt-4 block text-sm text-zinc-400">
        {t("settings.apiKeyLabel")}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          placeholder={t("settings.apiKeyPlaceholder")}
          autoComplete="off"
          className="mt-1 w-full mk-text-input font-mono"
        />
      </label>

      <div className="btn-pair-row mt-3">
        <button
          type="button"
          disabled={isSaving || keyFlowBusy}
          aria-busy={isSaving || keyFlowBusy}
          onClick={() =>
            void (async () => {
              const trimmed = draft.trim();
              if (!trimmed) {
                await updateGeminiKey("");
                toast.success(t("errors.apiKeyRemoved"));
                return;
              }
              setKeyFlowBusy(true);
              try {
                await validateGeminiApiKey(trimmed);
                await updateGeminiKey(trimmed);
                toast.success(t("errors.apiKeySaved"));
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : t("errors.couldNotVerifyKey"),
                );
              } finally {
                setKeyFlowBusy(false);
              }
            })()
          }
          className="relative flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ButtonPendingContents
            pending={isSaving || keyFlowBusy}
            spinner={<ButtonSpinner />}
          >
            {t("settings.saveKey")}
          </ButtonPendingContents>
        </button>
        <a
          className="flex items-center justify-center rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-blue-400 transition hover:bg-zinc-900"
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
        >
          {t("settings.openGoogleAiStudio")}
        </a>
      </div>
    </Card>
  );
}

function ProfileBodyCard({
  profile,
  onSave,
  formsDisabled,
  savePending,
}: {
  profile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => Promise<void>;
  formsDisabled: boolean;
  savePending: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileBodyDraft>(() =>
    profileBodyFromUser(profile),
  );

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">{t("settings.profile")}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          {t("common.birthday")}
          <input
            type="date"
            disabled={formsDisabled}
            value={draft.birthDate}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                birthDate: e.target.value,
              }))
            }
            className="mt-1 w-full mk-text-input"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          {t("common.gender")}
          <select
            value={draft.gender}
            disabled={formsDisabled}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                gender: e.target.value as ProfileGender,
              }))
            }
            className="mt-1 w-full mk-text-input"
          >
            <option value="male">{t("common.male")}</option>
            <option value="female">{t("common.female")}</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <span className="text-sm text-zinc-400">{t("common.units")}</span>
          <UnitsPreferenceSegment
            id="settings-profile-units"
            value={draft.unitsPreference}
            disabled={formsDisabled}
            onChange={(unitsPreference) =>
              setDraft((p) => {
                if (unitsPreference === p.unitsPreference) return p;
                const { height, weight } = convertBodyMeasuresToUnits(
                  {
                    unitsPreference: p.unitsPreference,
                    height: p.height,
                    weight: p.weight,
                  },
                  unitsPreference,
                );
                return { ...p, unitsPreference, height, weight };
              })
            }
          />
        </div>
        <HeightWeightFields
          units={draft.unitsPreference}
          height={draft.height}
          weight={draft.weight}
          disabled={formsDisabled}
          onChange={({ height, weight }) =>
            setDraft((p) => ({ ...p, height, weight }))
          }
        />
      </div>

      <button
        type="button"
        disabled={formsDisabled}
        aria-busy={savePending}
        onClick={() => void onSave(draft)}
        className="relative mt-4 btn-mobile-block-lg gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ButtonPendingContents
          pending={savePending}
          spinner={<ButtonSpinner />}
        >
          {t("settings.saveProfile")}
        </ButtonPendingContents>
      </button>
    </Card>
  );
}

function MacroTargetsCard({
  profile,
  onSave,
  formsDisabled,
  savePending,
}: {
  profile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => Promise<void>;
  formsDisabled: boolean;
  savePending: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MacroTargetsDraft>(() =>
    macroTargetsFromUser(profile),
  );

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">
        {t("settings.macroTargets")}
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          {t("common.dailyTargetKcal")}
          <input
            inputMode="numeric"
            disabled={formsDisabled}
            value={draft.dailyTargetKcal}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                dailyTargetKcal: Number(e.target.value),
              }))
            }
            className="mt-1 w-full mk-text-input"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          {t("common.proteinTargetG")}
          <input
            inputMode="decimal"
            disabled={formsDisabled}
            value={draft.proteinTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                proteinTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full mk-text-input"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          {t("common.fatsTargetG")}
          <input
            inputMode="decimal"
            disabled={formsDisabled}
            value={draft.fatsTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                fatsTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full mk-text-input"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          {t("common.carbsTargetG")}
          <input
            inputMode="decimal"
            disabled={formsDisabled}
            value={draft.carbsTargetG}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                carbsTargetG: Number(e.target.value),
              }))
            }
            className="mt-1 w-full mk-text-input"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-3">
        <button
          type="button"
          disabled={formsDisabled}
          aria-busy={savePending}
          onClick={() => void onSave(draft)}
          className="relative btn-mobile-block-lg gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ButtonPendingContents
            pending={savePending}
            spinner={<ButtonSpinner />}
          >
            {t("settings.saveTargets")}
          </ButtonPendingContents>
        </button>

        <Link
          to="/tutorial"
          className="relative btn-mobile-block-lg cursor-pointer gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
        >
          {t("settings.recalculateTargets")}
        </Link>
      </div>
    </Card>
  );
}

const ADVANCED_DRIVE_TAP_WINDOW_MS = 3000;
const ADVANCED_DRIVE_TAP_COUNT = 10;
const ADVANCED_DRIVE_HINT_MIN_TAPS = 5;
const ADVANCED_DRIVE_TAP_HINT_TOAST_ID = "settings-advanced-drive-tap-hint";

function GoogleAccountDriveCard({
  email,
  sessionReady,
  signOut,
  qc,
  isSaving,
  wipeAllRemoteData,
}: {
  email: string | null;
  sessionReady: boolean;
  signOut: () => Promise<void>;
  qc: ReturnType<typeof useQueryClient>;
  isSaving: boolean;
  wipeAllRemoteData: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [wipePhrase, setWipePhrase] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);
  const [advancedDriveUnlocked, setAdvancedDriveUnlocked] = useState(false);
  const advancedDriveTapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      toast.dismiss(ADVANCED_DRIVE_TAP_HINT_TOAST_ID);
    };
  }, []);

  const onSignedInRowTap = useCallback(() => {
    if (advancedDriveUnlocked) return;
    const now = Date.now();
    const cutoff = now - ADVANCED_DRIVE_TAP_WINDOW_MS;
    const recent = advancedDriveTapTimesRef.current.filter((t) => t >= cutoff);
    recent.push(now);
    advancedDriveTapTimesRef.current = recent;

    if (recent.length >= ADVANCED_DRIVE_TAP_COUNT) {
      toast.dismiss(ADVANCED_DRIVE_TAP_HINT_TOAST_ID);
      setAdvancedDriveUnlocked(true);
      advancedDriveTapTimesRef.current = [];
      return;
    }

    if (recent.length >= ADVANCED_DRIVE_HINT_MIN_TAPS) {
      const remaining = ADVANCED_DRIVE_TAP_COUNT - recent.length;
      toast.info(t("settings.advancedTapHint", { count: remaining }), {
        id: ADVANCED_DRIVE_TAP_HINT_TOAST_ID,
        duration: 2200,
      });
    }
  }, [advancedDriveUnlocked, t]);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">
        {t("settings.googleAccountDrive")}
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div
          className="cursor-default"
          onClick={onSignedInRowTap}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSignedInRowTap();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={
            email
              ? t("settings.signedInAsAria", { email })
              : t("settings.signedInAsUnknownAria")
          }
        >
          <dt className="text-sm text-zinc-500">{t("settings.signedInAs")}</dt>
          <dd className="mt-0.5 font-medium text-white">
            {email ?? t("common.unknown")}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">{t("settings.driveAccess")}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            {sessionReady ? (
              <>
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span className="text-sm text-emerald-400/90">
                  {t("settings.driveAccessOk")}
                </span>
              </>
            ) : (
              <span className="text-zinc-400">{t("settings.notConnected")}</span>
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
        className="relative mt-5 btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ButtonPendingContents
          pending={signOutBusy}
          spinner={<ButtonSpinner className="text-zinc-200" />}
        >
          {t("settings.signOut")}
        </ButtonPendingContents>
      </button>

      {advancedDriveUnlocked && (
        <>
          <div className="mt-8 border-t border-mk-border pt-6">
            <Link
              to="/drive"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-left text-sm transition hover:bg-zinc-900"
            >
              <span className="flex min-w-0 items-start gap-3">
                <FolderOpen
                  className="mt-0.5 size-5 shrink-0 text-zinc-400"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block font-medium text-zinc-100">
                    {t("settings.driveAppData")}
                  </span>
                  <span className="mt-0.5 block text-sm font-normal text-mk-muted">
                    {t("settings.driveAppDataSubtitle")}
                  </span>
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-zinc-500"
                aria-hidden
              />
            </Link>
          </div>

          <div className="mt-6 border-t border-red-500/15 pt-6">
            <h3 className="text-sm font-semibold text-red-300">
              {t("settings.deleteAllCloudData")}
            </h3>
            <p className="mt-1 text-sm text-mk-muted">
              <Trans
                i18nKey="settings.deleteAllCloudBlurb"
                components={{
                  1: <span className="font-mono text-zinc-300" />,
                }}
              />
            </p>
            <label className="mt-3 block text-sm text-zinc-500">
              {t("settings.confirmation")}
              <input
                value={wipePhrase}
                onChange={(e) => {
                  setWipePhrase(e.target.value);
                }}
                autoComplete="off"
                placeholder={t("settings.deletePlaceholder")}
                disabled={!sessionReady || wipeBusy}
                className="mt-1 w-full max-w-xs rounded-xl border border-mk-border bg-mk-bg px-4 py-3 font-mono text-base text-white outline-none placeholder:text-zinc-600 focus:border-red-400/50"
              />
            </label>
            <button
              type="button"
              disabled={
                !sessionReady || wipeBusy || wipePhrase !== "DELETE" || isSaving
              }
              aria-busy={wipeBusy}
              onClick={() =>
                void (async () => {
                  setWipeBusy(true);
                  try {
                    await wipeAllRemoteData();
                    setWipePhrase("");
                    toast.success(t("errors.allDriveDataDeleted"), {
                      description: t("errors.allDriveDataDeletedDesc"),
                    });
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : t("errors.couldNotDeleteAllData"),
                    );
                  } finally {
                    setWipeBusy(false);
                  }
                })()
              }
              className="relative mt-3 btn-mobile-block-lg gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ButtonPendingContents
                pending={wipeBusy}
                spinner={<ButtonSpinner className="text-red-100" />}
              >
                {t("settings.deleteAllDataInDrive")}
              </ButtonPendingContents>
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { sessionReady, signOut } = useGoogleSession();
  const {
    records,
    geminiKey,
    updateGeminiKey,
    updateProfile,
    isSaving,
    wipeAllRemoteData,
  } = useRecords();
  const email = getGoogleUserEmail();
  const [profileSavePending, setProfileSavePending] = useState(false);
  const [targetsSavePending, setTargetsSavePending] = useState(false);

  const saveProfilePatch = useCallback(
    async (patch: Partial<UserProfile>) => {
      setProfileSavePending(true);
      try {
        await updateProfile(patch);
      } finally {
        setProfileSavePending(false);
      }
    },
    [updateProfile],
  );

  const saveTargetsPatch = useCallback(
    async (patch: Partial<UserProfile>) => {
      setTargetsSavePending(true);
      try {
        await updateProfile(patch);
      } finally {
        setTargetsSavePending(false);
      }
    },
    [updateProfile],
  );

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("settings.pageTitle")}
        subtitle={t("settings.pageSubtitle")}
      />

      <GeminiKeyCard
        key={geminiKey}
        geminiKey={geminiKey}
        updateGeminiKey={updateGeminiKey}
        isSaving={isSaving}
      />

      <InstallAppCard />

      <GoogleAccountDriveCard
        key={email ?? ""}
        email={email}
        sessionReady={sessionReady}
        signOut={signOut}
        qc={qc}
        isSaving={isSaving}
        wipeAllRemoteData={wipeAllRemoteData}
      />

      <LanguageCard />

      <ProfileBodyCard
        key={profileBodySyncKey(records.profile)}
        profile={records.profile}
        onSave={saveProfilePatch}
        formsDisabled={isSaving}
        savePending={profileSavePending}
      />

      <MacroTargetsCard
        key={macroTargetsSyncKey(records.profile)}
        profile={records.profile}
        onSave={saveTargetsPatch}
        formsDisabled={isSaving}
        savePending={targetsSavePending}
      />

      <FeedbackCard />
    </div>
  );
}
