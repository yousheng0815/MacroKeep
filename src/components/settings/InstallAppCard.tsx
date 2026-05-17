import { Card } from "@/components/Card";
import {
  getMobileInstallPlatform,
  isInstalledPwa,
  type MobileInstallPlatform,
} from "@/lib/pwa";
import { MoreHorizontal, MoreVertical, Share } from "lucide-react";
import { useLayoutEffect, useState } from "react";

function InstallSteps({ platform }: { platform: MobileInstallPlatform }) {
  if (platform === "ios") {
    return (
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mk-muted marker:text-zinc-500">
        <li>
          In Safari, tap the{" "}
          <span className="inline-flex items-center gap-1 text-zinc-300">
            menu
            <MoreHorizontal className="size-3.5 shrink-0" aria-hidden />
          </span>{" "}
          (three dots) in the bottom-right corner.
        </li>
        <li>
          Tap the{" "}
          <span className="inline-flex items-center gap-1 text-zinc-300">
            <Share className="size-3.5 shrink-0" aria-hidden />
            Share
          </span>{" "}
          button.
        </li>
        <li>
          Tap the{" "}
          <span className="inline-flex items-center gap-1 text-zinc-300">
            more
            <MoreHorizontal className="size-3.5 shrink-0" aria-hidden />
          </span>{" "}
          (three dots) button or scroll the sheet down.
        </li>
        <li>
          Tap <span className="text-zinc-300">Add to Home Screen</span>.
        </li>
        <li>
          Tap <span className="text-zinc-300">Add</span> in the top-right
          corner.
        </li>
        <li>
          Open MacroKeep from your home screen for the full app experience.
        </li>
      </ol>
    );
  }

  return (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mk-muted marker:text-zinc-500">
      <li>
        In Chrome, tap the{" "}
        <span className="inline-flex items-center gap-1 text-zinc-300">
          menu
          <MoreVertical className="size-3.5 shrink-0" aria-hidden />
        </span>{" "}
        (three dots) in the top-right corner.
      </li>
      <li>
        Tap <span className="text-zinc-300">Install app</span> or{" "}
        <span className="text-zinc-300">Add to Home screen</span>.
      </li>
      <li>Confirm when prompted.</li>
      <li>Open MacroKeep from your home screen for the full app experience.</li>
    </ol>
  );
}

export function InstallAppCard() {
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
            Install MacroKeep
          </h2>
          <p className="mt-1 text-sm text-mk-muted">
            Add MacroKeep to your home screen for a better experience.
          </p>
        </div>
      </div>
      <InstallSteps platform={platform} />
    </Card>
  );
}
