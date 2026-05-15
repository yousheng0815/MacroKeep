import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import { compressProgressPhotoBlob } from "@/lib/progress-photo-compress";
import type { ProgressPhotoItem, ProgressPhotoRecord } from "@/types/progress-photos";
import {
  Camera,
  Check,
  ChevronLeft,
  RotateCcw,
  SwitchCamera,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/app-toast";

export function ProgressPhotoCaptureScreen({
  onDismiss,
  onSaved,
  savePhoto,
  photosForGhost,
}: {
  onDismiss: () => void;
  onSaved?: () => void;
  savePhoto: (record: ProgressPhotoRecord) => Promise<void>;
  photosForGhost: ProgressPhotoItem[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ghostEnabled, setGhostEnabled] = useState(true);
  /** 0–1 opacity for the ghost image when overlaid on the live preview */
  const [ghostOverlayOpacity, setGhostOverlayOpacity] = useState(0.38);
  const [phase, setPhase] = useState<"live" | "preview">("live");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ghostBlob = useMemo(() => {
    return photosForGhost[0]?.blob ?? null;
  }, [photosForGhost]);

  const ghostSourceBlob = ghostEnabled && phase === "live" ? ghostBlob : null;
  const ghostDisplayUrl = useBlobObjectUrl(ghostSourceBlob);

  const previewUrl = useBlobObjectUrl(previewBlob);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") {
      const prev = streamRef.current;
      streamRef.current = null;
      prev?.getTracks().forEach((t) => t.stop());
      const vStop = videoRef.current;
      if (vStop) vStop.srcObject = null;
      return;
    }

    let cancelled = false;
    let streamLocal: MediaStream | null = null;
    let videoAttach: HTMLVideoElement | null = null;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamLocal = stream;
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          videoAttach = v;
          v.srcObject = stream;
          await v.play().catch(() => {
            /* autoplay policies — user gesture usually present */
          });
        }
        if (!cancelled) setCameraError(null);
      } catch {
        if (!cancelled) {
          setCameraError(
            "Camera unavailable. Allow camera access in your browser settings and reload.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const toStop = streamRef.current ?? streamLocal;
      streamRef.current = null;
      toStop?.getTracks().forEach((t) => t.stop());
      if (videoAttach) videoAttach.srcObject = null;
      videoAttach = null;
    };
  }, [cameraFacing, phase]);

  const mirrorPreview = cameraFacing === "user";

  const captureFromVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not capture");

    if (mirrorPreview) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const raw = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
        "image/jpeg",
        0.92,
      );
    });
    const compressed = await compressProgressPhotoBlob(raw);
    setPreviewBlob(compressed);
    setPhase("preview");
  }, [mirrorPreview]);

  const onSave = useCallback(async () => {
    if (!previewBlob) return;
    setBusy(true);
    try {
      const record: ProgressPhotoRecord = {
        id: crypto.randomUUID(),
        capturedAt: Date.now(),
        blob: previewBlob,
      };
      await savePhoto(record);
      onSaved?.();
      onDismiss();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save this photo.",
      );
    } finally {
      setBusy(false);
    }
  }, [previewBlob, onDismiss, onSaved, savePhoto]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          aria-label="Back"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">
            Progress photo
          </h2>
          <p className="text-sm text-zinc-500">
            Synced to Google Drive (hidden app data folder, same account as
            meals).
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.25rem))]">
        {phase === "live" ? (
          <>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              {cameraError ? (
                <div className="flex size-full items-center justify-center px-6 text-center">
                  <p className="text-sm text-zinc-300">{cameraError}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className={`size-full object-cover${mirrorPreview ? " scale-x-[-1]" : ""}`}
                    playsInline
                    muted
                    autoPlay
                  />
                  <button
                    type="button"
                    disabled={!!cameraError || busy}
                    onClick={() =>
                      setCameraFacing((facing) =>
                        facing === "user" ? "environment" : "user",
                      )
                    }
                    className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full border border-zinc-700/80 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 disabled:opacity-40"
                    aria-label="Switch camera"
                  >
                    <SwitchCamera className="size-5" />
                  </button>
                  {ghostDisplayUrl ? (
                    <img
                      src={ghostDisplayUrl}
                      alt=""
                      style={{ opacity: ghostOverlayOpacity }}
                      className="pointer-events-none absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                </>
              )}
            </div>

            <div className="mx-auto flex w-full max-w-md flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={ghostEnabled}
                  onChange={(e) => setGhostEnabled(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900"
                />
                Show last photo as ghost overlay
              </label>
              {ghostBlob ? (
                <label className="flex flex-col gap-1.5 px-0.5">
                  <span className="flex items-center justify-between text-sm text-zinc-500">
                    <span>Overlay opacity</span>
                    <span className="tabular-nums text-zinc-400">
                      {Math.round(ghostOverlayOpacity * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    step={1}
                    value={Math.round(ghostOverlayOpacity * 100)}
                    disabled={!ghostEnabled || !!cameraError}
                    onChange={(e) =>
                      setGhostOverlayOpacity(Number(e.target.value) / 100)
                    }
                    className="w-full accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </label>
              ) : null}
            </div>

            <div className="mx-auto mt-auto flex w-full max-w-md flex-wrap gap-3 border-t border-zinc-800 pt-6">
              <button
                type="button"
                disabled={!!cameraError || busy}
                onClick={() =>
                  void captureFromVideo().catch(() =>
                    toast.error("Could not capture frame."),
                  )
                }
                className="flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
              >
                <Camera className="size-5 shrink-0" />
                Capture
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <div className="btn-pair-row mx-auto mt-auto w-full max-w-md border-t border-zinc-800 pt-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPreviewBlob(null);
                  setPhase("live");
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-600 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
              >
                <RotateCcw className="size-4 shrink-0" />
                Retake
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="relative flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
              >
                <ButtonPendingContents
                  pending={busy}
                  spinner={<ButtonSpinner />}
                >
                  <Check className="size-5 shrink-0" />
                  Save
                </ButtonPendingContents>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
