import { Card } from "@/components/Card";
import { MealScanOverlays } from "@/components/scanner/MealScanOverlays";
import { useMealScanFlow } from "@/hooks/use-meal-scan-flow";
import { consumePendingScanPhoto } from "@/lib/pending-scan-photo";
import { Camera, ImagePlus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

export function ScannerPage() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const {
    analyzing,
    error,
    draft,
    setDraft,
    hasKey,
    isSaving,
    runAnalyzeSnapshot,
    runAnalyzeFromFile,
    save,
    cancelDraft,
  } = useMealScanFlow();

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
      <div>
        <h1 className="text-xl font-bold text-white">AI Scanner</h1>
        <p className="mt-1 text-sm text-om-muted">
          Capture or upload a meal photo. Analysis runs in your browser using
          your Gemini key.
        </p>
      </div>

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

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <Camera className="size-5 text-emerald-400" />
            Take photo
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            <ImagePlus className="size-5 text-orange-500" />
            Upload from library
          </button>
        </div>

        {!hasKey ? (
          <p className="mt-4 text-sm text-amber-400">
            Configure your Gemini API key under Settings to enable scanning.
          </p>
        ) : null}

        {error && !analyzing ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : null}
      </Card>

      <MealScanOverlays
        analyzing={analyzing}
        draft={draft}
        setDraft={setDraft}
        isSaving={isSaving}
        onSave={save}
        onCancelDraft={cancelDraft}
      />
    </div>
  );
}
