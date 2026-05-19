import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useGoogleSession } from "@/contexts/google-session";
import { useBlobObjectUrl } from "@/hooks/use-blob-object-url";
import { ensureGoogleAccessToken, getGoogleUserId } from "@/lib/gapi";
import {
  downloadAppDataFileBlob,
  downloadAppDataFileText,
  isImagePreviewAppDataFile,
  isJsonAppDataFile,
  listAllAppDataFiles,
  updateAppDataFileText,
  type AppDataDriveFileListItem,
} from "@/lib/google-drive";
import i18n from "@/i18n";
import { intlLocaleTag, type AppLocale } from "@/i18n/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileJson, ImageIcon, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
  return d.toLocaleString(intlLocaleTag(i18n.language as AppLocale) ?? undefined, {
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

function parseJsonDraft(draft: string, invalidMsg: string): { ok: true; text: string } | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(draft) as unknown;
    return { ok: true, text: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false, message: invalidMsg };
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
  const { t } = useTranslation();
  const { sessionReady } = useGoogleSession();
  const userId = getGoogleUserId() ?? "";
  const qc = useQueryClient();
  const [retryBusy, setRetryBusy] = useState(false);
  const [viewerFile, setViewerFile] = useState<AppDataDriveFileListItem | null>(
    null,
  );
  const [jsonEditing, setJsonEditing] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  const closeViewer = useCallback(() => {
    setViewerFile(null);
    setJsonEditing(false);
    setJsonDraft("");
    setJsonParseError(null);
  }, []);

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
    /** Fresh blob per selection; gcTime 0 drops bytes when preview unmounts. */
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error(t("errors.missingGoogleAccessToken"));
      return downloadAppDataFileBlob(token, previewImageFileId!, signal);
    },
  });

  const q = useQuery({
    queryKey: ["drive-app-files", userId],
    enabled: !!userId && sessionReady,
    /** Power-user file browser: refetch on each visit (edits may happen outside the app). */
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error(t("errors.missingGoogleAccessToken"));
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
      if (!token) throw new Error(t("errors.missingGoogleAccessToken"));
      return downloadAppDataFileText(token, viewerFile!.id, signal);
    },
  });

  const displayText = useMemo(() => {
    if (contentQuery.data === undefined) return "";
    return formatJsonForDisplay(contentQuery.data);
  }, [contentQuery.data]);

  const jsonDirty =
    jsonEditing && jsonDraft.length > 0 && jsonDraft !== displayText;

  useEffect(() => {
    if (!viewerFile || !viewerIsJson || viewerJsonOversized) return;
    if (contentQuery.data === undefined) return;
    setJsonEditing(false);
    setJsonParseError(null);
    setJsonDraft(formatJsonForDisplay(contentQuery.data));
  }, [viewerFile?.id, viewerIsJson, viewerJsonOversized, contentQuery.data]);

  const saveJsonMutation = useMutation({
    mutationFn: async () => {
      if (!viewerFile) throw new Error("No file selected");
      const parsed = parseJsonDraft(jsonDraft, t("drive.invalidJson"));
      if (!parsed.ok) throw new Error(parsed.message);
      const token = await ensureGoogleAccessToken();
      if (!token) throw new Error(t("errors.missingGoogleAccessToken"));
      await updateAppDataFileText(token, viewerFile.id, parsed.text);
      return parsed.text;
    },
    onSuccess: (savedText) => {
      setJsonParseError(null);
      setJsonEditing(false);
      setJsonDraft(savedText);
      void qc.invalidateQueries({ queryKey: ["drive-app-files", userId] });
      if (viewerFile) {
        void qc.invalidateQueries({
          queryKey: ["drive-app-file-body", userId, viewerFile.id],
        });
      }
      if (userId) {
        void qc.invalidateQueries({ queryKey: ["records-core", userId] });
        void qc.invalidateQueries({ queryKey: ["records-meals", userId] });
      }
    },
    onError: (err) => {
      setJsonParseError(err instanceof Error ? err.message : String(err));
    },
  });

  const startJsonEdit = useCallback(() => {
    setJsonParseError(null);
    setJsonDraft(displayText || contentQuery.data || "");
    setJsonEditing(true);
  }, [displayText, contentQuery.data]);

  const cancelJsonEdit = useCallback(() => {
    setJsonParseError(null);
    setJsonEditing(false);
    setJsonDraft(displayText);
  }, [displayText]);

  useEffect(() => {
    if (!viewerFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerFile, closeViewer]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("drive.pageTitle")}
        subtitle={t("drive.pageSubtitle")}
      />

      {!sessionReady ? (
        <Card>
          <p className="text-sm text-mk-muted">
            {t("drive.connectDriveToList")}
          </p>
        </Card>
      ) : q.isLoading ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2
              className="size-8 animate-spin text-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-mk-muted">{t("drive.loadingFiles")}</p>
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
              className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ButtonPendingContents
                pending={retryBusy}
                spinner={<ButtonSpinner />}
              >
                {t("common.retry")}
              </ButtonPendingContents>
            </button>
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <p className="text-sm text-mk-muted">{t("drive.noFiles")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-mk-border bg-zinc-900/40 text-sm text-zinc-500">
                  <th className="min-w-0 px-4 py-3 font-medium">{t("drive.tableFile")}</th>
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
                      className={`border-b border-mk-border/60 last:border-0 ${
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
                                className="w-full min-w-0 text-left font-mono text-sm text-emerald-300/95 break-all underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-200 hover:decoration-emerald-400/70"
                                aria-label={t("drive.viewJsonAria", { fileName: f.name })}
                              >
                                {f.name}
                              </button>
                            ) : imageFile ? (
                              <button
                                type="button"
                                onClick={() => setViewerFile(f)}
                                className="w-full min-w-0 text-left font-mono text-sm text-amber-300/95 break-all underline decoration-amber-500/40 underline-offset-2 hover:text-amber-200 hover:decoration-amber-400/70"
                                aria-label={t("drive.previewImageAria", { fileName: f.name })}
                              >
                                {f.name}
                              </button>
                            ) : (
                              <span className="block min-w-0 font-mono text-sm text-white break-all">
                                {f.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 font-mono text-sm text-zinc-600 md:hidden">
                          {f.mimeType ?? "unknown"}
                        </div>
                        <div className="mt-0.5 text-sm text-zinc-600 md:hidden">
                          {formatModified(f.modifiedTime)}
                        </div>
                      </td>
                      <td className="hidden min-w-0 px-4 py-3 align-top text-sm text-zinc-400 break-all sm:table-cell">
                        {f.mimeType ?? "—"}
                      </td>
                      <td className="w-[4.25rem] whitespace-nowrap px-2 py-3 align-top text-sm text-zinc-400 sm:w-auto sm:px-4">
                        {formatBytes(f.size)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 align-top text-sm text-zinc-400 md:table-cell">
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
            aria-label={t("drive.closePreview")}
            onClick={closeViewer}
          />
          <div
            className={`relative z-10 flex max-h-[min(85dvh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-mk-border bg-mk-surface shadow-xl ${
              viewerIsImage ? "max-w-4xl" : "max-w-3xl"
            }`}
          >
            <div className="flex min-w-0 shrink-0 items-start justify-between gap-3 border-b border-mk-border px-4 py-3">
              <h2
                id="drive-viewer-title"
                className="min-w-0 flex-1 font-mono text-sm font-semibold text-white break-all pr-2"
              >
                {viewerFile.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {viewerIsJson ? (
                  <>
                    {jsonEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={saveJsonMutation.isPending}
                          onClick={cancelJsonEdit}
                          className="rounded-xl border border-mk-border bg-mk-bg px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            saveJsonMutation.isPending ||
                            !jsonDirty ||
                            viewerJsonOversized ||
                            contentQuery.isLoading ||
                            !contentQuery.data ||
                            !!contentQuery.error
                          }
                          aria-busy={saveJsonMutation.isPending}
                          onClick={() => saveJsonMutation.mutate()}
                          className="relative rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ButtonPendingContents
                            pending={saveJsonMutation.isPending}
                            spinner={<ButtonSpinner className="text-white" />}
                          >
                            Save
                          </ButtonPendingContents>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={
                            viewerJsonOversized ||
                            contentQuery.isLoading ||
                            !contentQuery.data ||
                            !!contentQuery.error
                          }
                          onClick={startJsonEdit}
                          className="rounded-xl border border-mk-border bg-mk-bg px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
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
                          className="rounded-xl border border-mk-border bg-mk-bg px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Copy
                        </button>
                      </>
                    )}
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="rounded-xl border border-mk-border bg-mk-bg p-2 text-zinc-300 transition hover:bg-zinc-900"
                  aria-label={t("drive.close")}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {viewerIsJson ? (
                viewerJsonOversized ? (
                  <p className="text-sm text-mk-muted">
                    {t("drive.jsonTooLarge", { mb: (MAX_JSON_PREVIEW_BYTES / (1024 * 1024)).toFixed(0) })}
                  </p>
                ) : contentQuery.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2
                      className="size-8 animate-spin text-emerald-400"
                      aria-hidden
                    />
                    <p className="text-sm text-mk-muted">{t("drive.loadingFile")}</p>
                  </div>
                ) : contentQuery.error ? (
                  <p className="text-sm text-red-300">
                    {contentQuery.error instanceof Error
                      ? contentQuery.error.message
                      : t("drive.couldNotLoadFile")}
                  </p>
                ) : jsonEditing ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <textarea
                      value={jsonDraft}
                      onChange={(e) => {
                        setJsonDraft(e.target.value);
                        if (jsonParseError) setJsonParseError(null);
                      }}
                      spellCheck={false}
                      className="min-h-[min(50dvh,480px)] w-full flex-1 resize-y rounded-xl border border-mk-border bg-mk-bg px-3 py-2 font-mono text-sm leading-relaxed text-zinc-200 outline-none ring-emerald-500/40 focus:ring-2"
                      aria-label={t("drive.editJsonAria", { fileName: viewerFile.name })}
                    />
                    {jsonParseError ? (
                      <p className="text-sm text-red-300" role="alert">
                        {jsonParseError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-200">
                    {displayText}
                  </pre>
                )
              ) : viewerImageOversized ? (
                <p className="text-sm text-mk-muted">
                  {t("drive.imageTooLarge", { mb: (MAX_IMAGE_PREVIEW_BYTES / (1024 * 1024)).toFixed(0) })}
                </p>
              ) : imageBlobQuery.isPending ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2
                    className="size-8 animate-spin text-amber-400"
                    aria-hidden
                  />
                  <p className="text-sm text-mk-muted">{t("common.loadingImage")}</p>
                </div>
              ) : imageBlobQuery.error ? (
                <p className="text-sm text-red-300">
                  {imageBlobQuery.error instanceof Error
                    ? imageBlobQuery.error.message
                    : t("drive.couldNotLoadFile")}
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
