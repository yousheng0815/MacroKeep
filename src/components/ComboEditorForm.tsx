import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { ComboPhotoThumb } from "@/components/ComboPhotoThumb";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { canSyncToDriveAppData, ensureGoogleAccessToken } from "@/lib/gapi";
import {
  readComboDraft,
  writeComboDraft,
  type ComboDraft,
} from "@/lib/combo-draft";
import { deleteDriveFile, uploadMealPhotoToAppData } from "@/lib/google-drive";
import { prepareMealPhotoForUpload } from "@/lib/meal-photo-compress";
import { removeMealPhotoFromCache } from "@/lib/meal-photo-cache-db";
import { paths } from "@/lib/routes";
import {
  mealsById,
  resolveComboItem,
  resolveComboItems,
  savedQuickAddReferencesPhoto,
  sumResolvedMacros,
} from "@/lib/saved-combo-utils";
import type { ComboItem, SavedComboRecord } from "@/types/records";
import { Link } from "@tanstack/react-router";
import { Camera, ChevronRight, ImagePlus, Link2, Plus, Trash2, Unlink2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";

type ComboEditorFormProps = {
  comboId?: string;
  draftKey: string;
  returnTo: string;
  itemFlowSearch: { context?: "new"; comboId?: string };
  initialName: string;
  initialItems: ComboItem[];
  initialPhotoFileId?: string;
  savePending: boolean;
  onSave: (payload: {
    name: string;
    items: ComboItem[];
    photoFileId?: string | null;
    photo?: { base64: string; mimeType: string };
  }) => Promise<void>;
  onSaved?: () => void;
};

function draftSnapshot(
  name: string,
  items: ComboItem[],
  customPhotoFileId: string | undefined,
  returnTo: string,
): ComboDraft {
  return {
    name,
    items,
    ...(customPhotoFileId ? { customPhotoFileId } : {}),
    returnTo,
  };
}

export function ComboEditorForm({
  comboId,
  draftKey,
  returnTo,
  itemFlowSearch,
  initialName,
  initialItems,
  initialPhotoFileId,
  savePending,
  onSave,
  onSaved,
}: ComboEditorFormProps) {
  const { t } = useTranslation();
  const { savedQuickAdds } = useRecords();

  const storedDraft = readComboDraft(draftKey);
  const [name, setName] = useState(storedDraft?.name ?? initialName);
  const [items, setItems] = useState<ComboItem[]>(
    storedDraft?.items ?? initialItems,
  );
  const [customPhotoFileId, setCustomPhotoFileId] = useState<string | undefined>(
    storedDraft?.customPhotoFileId ?? initialPhotoFileId,
  );
  const [photoChoice, setPhotoChoice] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeComboDraft(
      draftKey,
      draftSnapshot(name, items, customPhotoFileId, returnTo),
    );
  }, [draftKey, name, items, customPhotoFileId, returnTo]);

  const mealMap = useMemo(() => mealsById(savedQuickAdds), [savedQuickAdds]);

  const resolvedItems = useMemo(() => {
    const draft: SavedComboRecord = {
      id: comboId ?? "draft",
      kind: "combo",
      name: name.trim() || "Combo",
      items,
      ...(customPhotoFileId ? { photoFileId: customPhotoFileId } : {}),
    };
    return resolveComboItems(draft, savedQuickAdds);
  }, [comboId, name, items, customPhotoFileId, savedQuickAdds]);

  const totals = useMemo(() => sumResolvedMacros(resolvedItems), [resolvedItems]);

  const previewCombo: SavedComboRecord = useMemo(
    () => ({
      id: comboId ?? "draft",
      kind: "combo",
      name: name.trim() || t("meals.comboPreviewFallback"),
      items,
      ...(customPhotoFileId ? { photoFileId: customPhotoFileId } : {}),
    }),
    [comboId, name, items, customPhotoFileId, t],
  );

  useEffect(() => {
    return () => {
      if (photoChoice?.previewUrl) URL.revokeObjectURL(photoChoice.previewUrl);
    };
  }, [photoChoice?.previewUrl]);

  const onPickPhoto = useCallback(
    (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setPhotoInputKey((k) => k + 1);
      setPhotoChoice((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
    },
    [],
  );

  const removeCustomPhoto = useCallback(() => {
    setPhotoChoice((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setCustomPhotoFileId(undefined);
  }, []);

  const persistDraftBeforeLeave = useCallback(() => {
    writeComboDraft(
      draftKey,
      draftSnapshot(name, items, customPhotoFileId, returnTo),
    );
  }, [draftKey, name, items, customPhotoFileId, returnTo]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void (async () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      let photoPayload: {
        photo?: { base64: string; mimeType: string };
        photoFileId?: string | null;
      } = {};
      if (photoChoice) {
        photoPayload = { photo: await fileToBase64(photoChoice.file) };
      } else if (customPhotoFileId) {
        photoPayload = { photoFileId: customPhotoFileId };
      } else if (initialPhotoFileId && !customPhotoFileId && !photoChoice) {
        photoPayload = { photoFileId: null };
      }
      await onSave({
        name: trimmed,
        items,
        ...photoPayload,
      });
      onSaved?.();
    })();
  };

  return (
    <Card>
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm text-mk-muted">
            {t("meals.comboNameLabel")}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder={t("meals.comboNamePlaceholder")}
            className="w-full mk-text-input"
          />
        </label>

        <div className="space-y-2">
          <span className="block text-sm text-mk-muted">
            {t("meals.comboPhotoLabel")}
          </span>
          <div className="mk-photo-field-panel">
            <div className="size-20 shrink-0 overflow-hidden rounded-xl md:size-32">
              {photoChoice ? (
                <MealPhotoThumb
                  previewSrc={photoChoice.previewUrl}
                  alt={t("meals.comboPhotoPreview")}
                  enlargeOnClick
                  className="size-full shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                />
              ) : (
                <ComboPhotoThumb
                  combo={previewCombo}
                  allItems={savedQuickAdds}
                  alt={name.trim() || t("meals.comboPhotoPreview")}
                  className="size-full"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-none md:flex-row md:flex-wrap md:gap-3">
              <button
                type="button"
                disabled={savePending}
                onClick={() => cameraInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
              >
                <Camera className="size-4 text-emerald-400 md:size-5" />
                {t("common.takePhoto")}
              </button>
              <button
                type="button"
                disabled={savePending}
                onClick={() => uploadInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[10rem]"
              >
                <ImagePlus className="size-4 text-orange-500 md:size-5" />
                {t("common.choosePhoto")}
              </button>
              {customPhotoFileId || photoChoice ? (
                <button
                  type="button"
                  disabled={savePending}
                  onClick={removeCustomPhoto}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto"
                >
                  {t("meals.useItemPhotosForCombo")}
                </button>
              ) : null}
            </div>
          </div>
          <input
            key={`cam-${photoInputKey}`}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
          />
          <input
            key={`lib-${photoInputKey}`}
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
          />
          {!customPhotoFileId && !photoChoice ? (
            <p className="text-xs text-mk-muted">{t("meals.comboCollageHint")}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {t("meals.comboItemsTitle")}
            </h3>
            <span className="text-sm text-mk-muted">
              {Math.round(totals.calories)} kcal
            </span>
          </div>

          {resolvedItems.length === 0 ? (
            <p className="text-sm text-mk-muted">{t("meals.comboNoItemsYet")}</p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {items.map((item, index) => {
                const resolved = resolveComboItem(item, mealMap);
                if (!resolved) return null;
                const key =
                  item.source === "saved"
                    ? `saved-${item.savedMealId}-${index}`
                    : `inline-${index}-${resolved.food_name}`;
                return (
                  <li
                    key={key}
                    className="flex min-w-0 items-start gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-white">
                        {resolved.food_name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mk-muted">
                        <span>{Math.round(resolved.calories)} kcal</span>
                        {item.source === "saved" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-950/50 px-1.5 py-0.5 text-sky-300">
                            <Link2 className="size-3" aria-hidden />
                            {resolved.archived
                              ? t("meals.comboItemLinkedArchived")
                              : t("meals.comboItemLinked")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                            <Unlink2 className="size-3" aria-hidden />
                            {t("meals.comboItemStandalone")}
                          </span>
                        )}
                      </div>
                      {item.source === "saved" ? (
                        <Link
                          to={paths.add.savedMealEdit}
                          params={{ savedMealId: item.savedMealId }}
                          search={itemFlowSearch}
                          onClick={persistDraftBeforeLeave}
                          className="mt-2 inline-block text-xs font-semibold text-sky-400 hover:text-sky-300"
                        >
                          {t("meals.openLinkedSavedMeal")}
                        </Link>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={savePending}
                      aria-label={t("meals.removeComboItemAria", {
                        foodName: resolved.food_name,
                      })}
                      onClick={() =>
                        setItems((cur) => cur.filter((_, i) => i !== index))
                      }
                      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-900/60 bg-red-950/40 p-2 text-red-400 transition hover:bg-red-950/70 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to={paths.add.comboAddSavedMeals}
              search={itemFlowSearch}
              onClick={persistDraftBeforeLeave}
              className="flex items-center justify-between gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="size-4 text-emerald-400" aria-hidden />
                {t("meals.addSavedMealToCombo")}
              </span>
              <ChevronRight className="size-4 text-zinc-500" aria-hidden />
            </Link>
            <Link
              to={paths.add.comboAddInlineItem}
              search={itemFlowSearch}
              onClick={persistDraftBeforeLeave}
              className="flex items-center justify-between gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="size-4 text-orange-400" aria-hidden />
                {t("meals.addInlineItemToCombo")}
              </span>
              <ChevronRight className="size-4 text-zinc-500" aria-hidden />
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={savePending || !name.trim() || items.length === 0}
          aria-busy={savePending}
          className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ButtonPendingContents
            pending={savePending}
            spinner={<ButtonSpinner />}
          >
            {t("common.save")}
          </ButtonPendingContents>
        </button>
      </form>
    </Card>
  );
}

export async function uploadComboCustomPhoto(
  comboId: string,
  photo: { base64: string; mimeType: string },
): Promise<string> {
  if (!canSyncToDriveAppData()) {
    throw new Error("Not signed in");
  }
  const token = await ensureGoogleAccessToken();
  if (!token) throw new Error("Missing token");
  const prepared = await prepareMealPhotoForUpload(photo.base64, photo.mimeType);
  return uploadMealPhotoToAppData(
    token,
    comboId,
    prepared.base64,
    prepared.mimeType,
  );
}

export async function deleteComboPhotoIfUnreferenced(
  photoId: string,
  savedQuickAdds: ReturnType<typeof useRecords>["savedQuickAdds"],
): Promise<void> {
  if (savedQuickAddReferencesPhoto(savedQuickAdds, photoId)) return;
  if (!canSyncToDriveAppData()) return;
  const token = await ensureGoogleAccessToken();
  if (!token) return;
  try {
    await deleteDriveFile(token, photoId);
    void removeMealPhotoFromCache(photoId);
  } catch {
    /* best-effort */
  }
}
