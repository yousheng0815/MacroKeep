import {
  ComboEditorForm,
  deleteComboPhotoIfUnreferenced,
  uploadComboCustomPhoto,
} from "@/components/ComboEditorForm";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import {
  beginComboEditDraftSession,
  clearComboDraft,
  comboDraftKey,
  comboEditorReturnTo,
  endComboEditDraftSession,
  isComboEditDraftSessionActive,
} from "@/lib/combo-draft";
import { paths } from "@/lib/routes";
import { exitSubflow } from "@/lib/subflow-nav";
import { isSavedCombo } from "@/types/records";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export function SavedComboEditPage() {
  const { t } = useTranslation();
  const { comboId } = useParams({ strict: false });
  const router = useRouter();
  const {
    savedQuickAdds,
    isSavedMealsLoading,
    savedMealsError,
    updateSavedCombo,
  } = useRecords();
  const [savePending, setSavePending] = useState(false);

  const combo = useMemo(
    () => savedQuickAdds.find((item) => isSavedCombo(item) && item.id === comboId),
    [savedQuickAdds, comboId],
  );

  useEffect(() => {
    if (!comboId) return;
    if (!isComboEditDraftSessionActive(comboId)) {
      clearComboDraft(comboDraftKey({ comboId }));
      beginComboEditDraftSession(comboId);
    }
  }, [comboId]);

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : t("errors.couldNotLoadSavedMealsDrive"),
    );
  }, [savedMealsError, t]);

  const goBackToList = useCallback(() => {
    endComboEditDraftSession();
    exitSubflow(router, paths.add.savedMealsManage);
  }, [router]);

  if (!comboId) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-mk-muted">{t("meals.invalidLink")}</p>
          <Link
            to={paths.add.savedMealsManage}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            {t("meals.backToSavedMealsManage")}
          </Link>
        </div>
      </Card>
    );
  }

  if (isSavedMealsLoading && !combo) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="size-8 animate-spin text-emerald-400" aria-hidden />
          <p className="text-sm text-mk-muted">{t("meals.loadingCombo")}</p>
        </div>
      </Card>
    );
  }

  if (!combo || !isSavedCombo(combo)) {
    return (
      <Card>
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-mk-muted">{t("meals.comboNotFound")}</p>
          <Link
            to={paths.add.savedMealsManage}
            className="btn-mobile-block-lg gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
            {t("meals.backToSavedMealsManage")}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("meals.editComboTitle")}
        onBack={goBackToList}
        backAriaLabel={t("meals.backToSavedMealsManage")}
        subtitle={t("meals.editComboSubtitle")}
      />

      <ComboEditorForm
        comboId={combo.id}
        draftKey={comboDraftKey({ comboId: combo.id })}
        returnTo={comboEditorReturnTo({ comboId: combo.id })}
        itemFlowSearch={{ comboId: combo.id }}
        initialName={combo.name}
        initialItems={combo.items}
        initialPhotoFileId={combo.photoFileId}
        savePending={savePending}
        onSaved={() => endComboEditDraftSession()}
        onSave={async ({ name, items, photo, photoFileId }) => {
          setSavePending(true);
          const oldPhotoId = combo.photoFileId;
          try {
            let nextPhotoFileId: string | null | undefined = photoFileId;
            if (photo) {
              nextPhotoFileId = await uploadComboCustomPhoto(combo.id, photo);
            }
            await updateSavedCombo(combo.id, {
              name,
              items,
              photoFileId: nextPhotoFileId,
            });
            if (
              oldPhotoId &&
              oldPhotoId !== nextPhotoFileId &&
              nextPhotoFileId !== oldPhotoId
            ) {
              await deleteComboPhotoIfUnreferenced(oldPhotoId, savedQuickAdds);
            }
            toast.success(t("errors.saved"));
            goBackToList();
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : t("errors.couldNotSaveChanges"),
            );
          } finally {
            setSavePending(false);
          }
        }}
      />
    </div>
  );
}
