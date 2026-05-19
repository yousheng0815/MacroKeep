import { Card } from "@/components/Card";
import {
  getMobileInstallPlatform,
  isInstalledPwa,
  type MobileInstallPlatform,
} from "@/lib/pwa";
import { MoreHorizontal, MoreVertical, Share } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

function InstallSteps({ platform }: { platform: MobileInstallPlatform }) {
  const menuIcon = (
    <span className="inline-flex items-center gap-1 text-zinc-300">
      <MoreHorizontal className="size-3.5 shrink-0" aria-hidden />
    </span>
  );
  const shareIcon = (
    <span className="inline-flex items-center gap-1 text-zinc-300">
      <Share className="size-3.5 shrink-0" aria-hidden />
    </span>
  );
  const androidMenuIcon = (
    <span className="inline-flex items-center gap-1 text-zinc-300">
      <MoreVertical className="size-3.5 shrink-0" aria-hidden />
    </span>
  );

  if (platform === "ios") {
    return (
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mk-muted marker:text-zinc-500">
        <li>
          <Trans i18nKey="install.iosStep1" components={{ 1: menuIcon }} />
        </li>
        <li>
          <Trans i18nKey="install.iosStep2" components={{ 1: shareIcon }} />
        </li>
        <li>
          <Trans i18nKey="install.iosStep3" components={{ 1: menuIcon }} />
        </li>
        <li>
          <Trans
            i18nKey="install.iosStep4"
            components={{ 1: <span className="text-zinc-300" /> }}
          />
        </li>
        <li>
          <Trans
            i18nKey="install.iosStep5"
            components={{ 1: <span className="text-zinc-300" /> }}
          />
        </li>
        <li>
          <Trans i18nKey="install.iosStep6" />
        </li>
      </ol>
    );
  }

  return (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mk-muted marker:text-zinc-500">
      <li>
        <Trans i18nKey="install.androidStep1" components={{ 1: androidMenuIcon }} />
      </li>
      <li>
        <Trans
          i18nKey="install.androidStep2"
          components={{
            1: <span className="text-zinc-300" />,
            2: <span className="text-zinc-300" />,
          }}
        />
      </li>
      <li>
        <Trans i18nKey="install.androidStep3" />
      </li>
      <li>
        <Trans i18nKey="install.androidStep4" />
      </li>
    </ol>
  );
}

export function InstallAppCard() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<MobileInstallPlatform | null>(null);

  useLayoutEffect(() => {
    if (isInstalledPwa()) return;
    setPlatform(getMobileInstallPlatform());
  }, []);

  if (!platform) return null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">
            {t("install.title")}
          </h2>
          <p className="mt-1 text-sm text-mk-muted">{t("install.blurb")}</p>
        </div>
      </div>
      <InstallSteps platform={platform} />
    </Card>
  );
}
