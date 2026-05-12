import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { consumePendingScanPhoto } from "@/lib/pending-scan-photo";
import { paths } from "@/lib/routes";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, History, ImagePlus, PenLine, Star } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

export function AddMealPage() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { analyzing, error, hasKey, runAnalyzeSnapshot, runAnalyzeFromFile } =
    useMealScanFlow();

  useEffect(() => {
    const pending = consumePendingScanPhoto();
    if (!pending) return;
    const timer = window.setTimeout(() => {
      void runAnalyzeSnapshot(pending.base64, pending.mimeType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runAnalyzeSnapshot]);

  const onPick = useCallback(
    async (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file) return;
      await runAnalyzeFromFile(file);
    },
    [runAnalyzeFromFile],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Meal"
        subtitle="Estimate macros from a photo, type them in yourself, or reuse a past or saved meal."
      />

      <Card>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onPick(e.target.files, e.currentTarget)}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files, e.currentTarget)}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full items-center justify-start gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <Camera className="size-5 shrink-0 text-emerald-400" />
            Take photo to estimate
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex w-full items-center justify-start gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <ImagePlus className="size-5 shrink-0 text-orange-500" />
            Choose photo to estimate
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.favorites })}
            className="flex w-full items-center justify-start gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <Star className="size-5 shrink-0 text-amber-400" />
            Add from favorites
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.history })}
            className="flex w-full items-center justify-start gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <History className="size-5 shrink-0 text-violet-400" />
            Add from history
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: paths.add.manual })}
            className="flex w-full items-center justify-start gap-3 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <PenLine className="size-5 shrink-0 text-sky-400" />
            Enter macros manually
          </button>
        </div>

        {!hasKey ? (
          <p className="mt-4 text-sm text-amber-400">
            Configure your Gemini API key under{" "}
            <Link to={paths.tutorial} className="underline underline-offset-2">
              Setup Tutorial
            </Link>{" "}
            (or Settings) to enable photo scanning. Manual entry, history, and
            favorites do not need it.
          </p>
        ) : null}

        {error && !analyzing ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : null}
      </Card>

      <MealScanOverlays analyzing={analyzing} />
    </div>
  );
}
