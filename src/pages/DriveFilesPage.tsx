import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { useGoogleSession } from "@/contexts/google-session";
import { getAccessToken, getGoogleUserId } from "@/lib/gapi";
import {
  downloadAppDataFileText,
  isJsonAppDataFile,
  listAllAppDataFiles,
  type AppDataDriveFileListItem,
} from "@/lib/google-drive";
import { useQuery } from "@tanstack/react-query";
import { FileJson, ImageIcon, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Skip in-browser preview for very large JSON (Drive `size` is bytes as string). */
const MAX_JSON_PREVIEW_BYTES = 2 * 1024 * 1024;

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

  const viewerOversized = useMemo(() => {
    if (!viewerFile || !isJsonAppDataFile(viewerFile)) return false;
    const n = viewerFile.size !== undefined ? Number(viewerFile.size) : NaN;
    return Number.isFinite(n) && n > MAX_JSON_PREVIEW_BYTES;
  }, [viewerFile]);

  const q = useQuery({
    queryKey: ["drive-app-files", userId],
    enabled: !!userId && sessionReady,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const token = getAccessToken();
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
      !viewerOversized,
    queryFn: async ({ signal }) => {
      const token = getAccessToken();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Drive app data</h1>
          <p className="mt-1 text-sm text-om-muted">
            Files OpenMacro stores in your Google Drive{" "}
            <span className="text-zinc-400">App Data</span> folder (hidden from
            My Drive).
          </p>
        </div>
        <button
          type="button"
          disabled={!sessionReady || q.isFetching}
          aria-busy={q.isFetching}
          onClick={() => void q.refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {q.isFetching ? <ButtonSpinner className="text-zinc-300" /> : null}
          {!q.isFetching ? <RefreshCw className="size-4" aria-hidden /> : null}
          Refresh
        </button>
      </div>

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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retryBusy ? <ButtonSpinner /> : null}
              Retry
            </button>
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <p className="text-sm text-om-muted">No files in app data yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-om-border bg-zinc-900/40 text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Type
                  </th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const jsonFile = isJsonAppDataFile(f);
                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-om-border/60 last:border-0 ${
                        jsonFile
                          ? "hover:bg-zinc-900/40"
                          : "hover:bg-zinc-900/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fileKindIcon(f)}
                          {jsonFile ? (
                            <button
                              type="button"
                              onClick={() => setViewerFile(f)}
                              className="text-left font-mono text-xs text-emerald-300/95 break-all underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-200 hover:decoration-emerald-400/70"
                              aria-label={`View JSON contents of ${f.name}`}
                            >
                              {f.name}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-white break-all">
                              {f.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-600 md:hidden">
                          {f.mimeType ?? "unknown"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-600 md:hidden">
                          {formatModified(f.modifiedTime)}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-zinc-400 sm:table-cell">
                        {f.mimeType ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatBytes(f.size)}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-zinc-400 md:table-cell">
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

      {viewerFile && isJsonAppDataFile(viewerFile) ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-json-viewer-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close preview"
            onClick={closeViewer}
          />
          <div className="relative z-10 flex max-h-[min(85dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-om-border bg-om-surface shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-om-border px-4 py-3">
              <h2
                id="drive-json-viewer-title"
                className="font-mono text-sm font-semibold text-white break-all pr-2"
              >
                {viewerFile.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={
                    viewerOversized ||
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
              {viewerOversized ? (
                <p className="text-sm text-om-muted">
                  This file is larger than{" "}
                  {(MAX_JSON_PREVIEW_BYTES / (1024 * 1024)).toFixed(0)}&nbsp;MB.
                  In-app preview is disabled to keep the tab responsive.
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
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
