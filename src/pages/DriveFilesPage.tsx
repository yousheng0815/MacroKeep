import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useGoogleSession } from "@/contexts/google-session";
import { ensureGoogleAccessToken, getGoogleUserId } from "@/lib/gapi";
import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import {
  downloadAppDataFileBlob,
  downloadAppDataFileText,
  isImagePreviewAppDataFile,
  isJsonAppDataFile,
  listAllAppDataFiles,
  type AppDataDriveFileListItem,
} from "@/lib/google-drive";
import { useQuery } from "@tanstack/react-query";
import { FileJson, ImageIcon, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function DrivePreviewImage({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useBlobObjectUrl(blob);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="max-h-[min(70dvh,640px)] max-w-full rounded-lg object-contain"
    />
  );
}

/** Skip in-browser preview for very large JSON (Drive `size` is bytes as string). */
const MAX_JSON_PREVIEW_BYTES = 2 * 1024 * 1024;

/** Skip in-browser image preview above this size (Drive `size` is bytes as string). */
const MAX_IMAGE_PREVIEW_BYTES = 20 * 1024 * 1024;

function formatBytes(size: string | undefined): string {
  if (!size) return "—";
  const n = Number(size);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function formatModified(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatJsonForDisplay(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
  } catch {
    return raw;
  }
}

function fileKindIcon(f: AppDataDriveFileListItem) {
  const mime = (f.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) {
    return <ImageIcon className="size-4 shrink-0 text-amber-400" aria-hidden />;
  }
  if (mime.includes("json") || f.name.endsWith(".json")) {
    return (
      <FileJson className="size-4 shrink-0 text-emerald-400" aria-hidden />
    );
  }
  return <FileJson className="size-4 shrink-0 text-zinc-500" aria-hidden />;
}

export function DriveFilesPage() {
  const { sessionReady } = useGoogleSession();
  const userId = getGoogleUserId() ?? "";
  const [retryBusy, setRetryBusy] = useState(false);
  const [viewerFile, setViewerFile] = useState<AppDataDriveFileListItem | null>(
    null,
  );

  const closeViewer = useCallback(() => setViewerFile(null), []);

  const viewerJsonOversized = useMemo(() => {
    if (!viewerFile || !isJsonAppDataFile(viewerFile)) return false;
    const n = viewerFile.size !== undefined ? Number(viewerFile.size) : NaN;
    return Number.isFinite(n) && n > MAX_JSON_PREVIEW_BYTES;
  }, [viewerFile]);

  const viewerImageOversized = useMemo(() => {
    if (!viewerFile || !isImagePreviewAppDataFile(viewerFile)) return false;
    const n = viewerFile.size !== undefined ? Number(viewerFile.size) : NaN;
    return Number.isFinite(n) && n > MAX_IMAGE_PREVIEW_BYTES;
  }, [viewerFile]);

  const viewerIsJson = !!(viewerFile && isJsonAppDataFile(viewerFile));
  const viewerIsImage = !!(viewerFile && isImagePreviewAppDataFile(viewerFile));

  const previewImageFileId =
    viewerFile &&
    isImagePreviewAppDataFile(viewerFile) &&
    !viewerImageOversized &&
    sessionReady
      ? viewerFile.id
      : undefined;

  const imageBlobQuery = useQuery({
    queryKey: ["drive-app-image-preview", userId, previewImageFileId],
    enabled: !!userId && !!previewImageFileId,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return downloadAppDataFileBlob(token, previewImageFileId!, signal);
    },
  });

  const q = useQuery({
    queryKey: ["drive-app-files", userId],
    enabled: !!userId && sessionReady,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return listAllAppDataFiles(token, signal);
    },
  });

  const files = q.data ?? [];
  const errMsg =
    q.error instanceof Error
      ? q.error.message
      : q.error
        ? String(q.error)
        : null;

  const contentQuery = useQuery({
    queryKey: ["drive-app-file-body", userId, viewerFile?.id],
    enabled:
      !!userId &&
      sessionReady &&
      !!viewerFile &&
      isJsonAppDataFile(viewerFile) &&
      !viewerJsonOversized,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error("Missing Google access token");
      return downloadAppDataFileText(token, viewerFile!.id, signal);
    },
  });

  const displayText = useMemo(() => {
    if (contentQuery.data === undefined) return "";
    return formatJsonForDisplay(contentQuery.data);
  }, [contentQuery.data]);

  useEffect(() => {
    if (!viewerFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerFile, closeViewer]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drive app data"
        subtitle={
          <>
            Files OpenMacro stores in your Google Drive{" "}
            <span className="text-zinc-400">App Data</span> folder (hidden from
            My Drive).
          </>
        }
        actions={
          <button
            type="button"
            disabled={!sessionReady || q.isFetching}
            aria-busy={q.isFetching}
            onClick={() => void q.refetch()}
            className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={q.isFetching}
              spinner={<ButtonSpinner className="text-zinc-300" />}
            >
              <RefreshCw className="size-4" aria-hidden />
              Refresh
            </ButtonPendingContents>
          </button>
        }
      />

      {!sessionReady ? (
        <Card>
          <p className="text-sm text-om-muted">
            Connect your Google account with Drive access to list app data
            files.
          </p>
        </Card>
      ) : q.isLoading ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2
              className="size-8 animate-spin text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-om-muted">Loading files from Drive…</p>
          </div>
        </Card>
      ) : errMsg ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
            <p className="text-sm text-red-300">{errMsg}</p>
            <button
              type="button"
              disabled={retryBusy}
              aria-busy={retryBusy}
              onClick={() =>
                void (async () => {
                  setRetryBusy(true);
                  try {
                    await q.refetch();
                  } finally {
                    setRetryBusy(false);
                  }
                })()
              }
              className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ButtonPendingContents
                pending={retryBusy}
                spinner={<ButtonSpinner />}
              >
                Retry
              </ButtonPendingContents>
            </button>
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <p className="text-sm text-om-muted">No files in app data yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-om-border bg-zinc-900/40 text-xs text-zinc-500">
                  <th className="min-w-0 px-4 py-3 font-medium">File</th>
                  <th className="hidden min-w-0 px-4 py-3 font-medium sm:table-cell sm:w-[28%]">
                    Type
                  </th>
                  <th className="w-[3.5rem] whitespace-nowrap px-2 py-3 font-medium sm:w-[5.5rem] sm:px-4">
                    Size
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-medium md:table-cell md:w-[11rem]">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const jsonFile = isJsonAppDataFile(f);
                  const imageFile = isImagePreviewAppDataFile(f);
                  const previewable = jsonFile || imageFile;
                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-om-border/60 last:border-0 ${
                        previewable
                          ? "hover:bg-zinc-900/40"
                          : "hover:bg-zinc-900/30"
                      }`}
                    >
                      <td className="min-w-0 px-4 py-3 align-top">
                        <div className="flex min-w-0 items-start gap-2">
                          {fileKindIcon(f)}
                          <div className="min-w-0 flex-1">
                            {jsonFile ? (
                              <button
                                type="button"
                                onClick={() => setViewerFile(f)}
                                className="w-full min-w-0 text-left font-mono text-xs text-emerald-300/95 break-all underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-200 hover:decoration-emerald-400/70"
                                aria-label={`View JSON contents of ${f.name}`}
                              >
                                {f.name}
                              </button>
                            ) : imageFile ? (
                              <button
                                type="button"
                                onClick={() => setViewerFile(f)}
                                className="w-full min-w-0 text-left font-mono text-xs text-amber-300/95 break-all underline decoration-amber-500/40 underline-offset-2 hover:text-amber-200 hover:decoration-amber-400/70"
                                aria-label={`Preview image ${f.name}`}
                              >
                                {f.name}
                              </button>
                            ) : (
                              <span className="block min-w-0 font-mono text-xs text-white break-all">
                                {f.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-600 md:hidden">
                          {f.mimeType ?? "unknown"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-600 md:hidden">
                          {formatModified(f.modifiedTime)}
                        </div>
                      </td>
                      <td className="hidden min-w-0 px-4 py-3 align-top text-xs text-zinc-400 break-all sm:table-cell">
                        {f.mimeType ?? "—"}
                      </td>
                      <td className="w-[4.25rem] whitespace-nowrap px-2 py-3 align-top text-xs text-zinc-400 sm:w-auto sm:px-4">
                        {formatBytes(f.size)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-400 md:table-cell">
                        {formatModified(f.modifiedTime)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewerFile && (viewerIsJson || viewerIsImage) ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-viewer-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close preview"
            onClick={closeViewer}
          />
          <div
            className={`relative z-10 flex max-h-[min(85dvh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-om-border bg-om-surface shadow-xl ${
              viewerIsImage ? "max-w-4xl" : "max-w-3xl"
            }`}
          >
            <div className="flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-om-border px-4 py-3">
              <h2
                id="drive-viewer-title"
                className="min-w-0 flex-1 font-mono text-sm font-semibold text-white break-all pr-2"
              >
                {viewerFile.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {viewerIsJson ? (
                  <button
                    type="button"
                    disabled={
                      viewerJsonOversized ||
                      contentQuery.isLoading ||
                      !contentQuery.data ||
                      !!contentQuery.error
                    }
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        displayText || contentQuery.data || "",
                      )
                    }
                    className="rounded-xl border border-om-border bg-om-bg px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="rounded-xl border border-om-border bg-om-bg p-2 text-zinc-300 transition hover:bg-zinc-900"
                  aria-label="Close"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {viewerIsJson ? (
                viewerJsonOversized ? (
                  <p className="text-sm text-om-muted">
                    This file is larger than{" "}
                    {(MAX_JSON_PREVIEW_BYTES / (1024 * 1024)).toFixed(0)}
                    &nbsp;MB. In-app preview is disabled to keep the tab
                    responsive.
                  </p>
                ) : contentQuery.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2
                      className="size-8 animate-spin text-emerald-400"
                      aria-hidden
                    />
                    <p className="text-sm text-om-muted">Loading file…</p>
                  </div>
                ) : contentQuery.error ? (
                  <p className="text-sm text-red-300">
                    {contentQuery.error instanceof Error
                      ? contentQuery.error.message
                      : "Could not load file."}
                  </p>
                ) : (
                  <pre className="font-mono text-[11px] leading-relaxed text-zinc-200 whitespace-pre-wrap break-words sm:text-xs">
                    {displayText}
                  </pre>
                )
              ) : viewerImageOversized ? (
                <p className="text-sm text-om-muted">
                  This image is larger than{" "}
                  {(MAX_IMAGE_PREVIEW_BYTES / (1024 * 1024)).toFixed(0)}
                  &nbsp;MB. In-app preview is disabled to keep the tab
                  responsive.
                </p>
              ) : imageBlobQuery.isPending ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2
                    className="size-8 animate-spin text-amber-400"
                    aria-hidden
                  />
                  <p className="text-sm text-om-muted">Loading image…</p>
                </div>
              ) : imageBlobQuery.error ? (
                <p className="text-sm text-red-300">
                  {imageBlobQuery.error instanceof Error
                    ? imageBlobQuery.error.message
                    : "Could not load image."}
                </p>
              ) : imageBlobQuery.data ? (
                <div className="flex justify-center">
                  <DrivePreviewImage
                    key={previewImageFileId}
                    blob={imageBlobQuery.data}
                    alt={viewerFile.name}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
