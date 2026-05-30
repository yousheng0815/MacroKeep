import { ComboEditorForm } from "@/components/ComboEditorForm";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import {
  beginNewComboDraftSession,
  clearComboDraft,
  comboDraftKey,
  endNewComboDraftSession,
  isNewComboDraftSessionActive,
} from "@/lib/combo-draft";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const DRAFT_KEY = comboDraftKey({ context: "new" });

export function SavedComboNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addSavedCombo } = useRecords();
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (!isNewComboDraftSessionActive()) {
      clearComboDraft(DRAFT_KEY);
      beginNewComboDraftSession();
    }
  }, []);

  const leaveNewCombo = useCallback(() => {
    endNewComboDraftSession();
    void navigate({ to: paths.add.savedMealsManage });
  }, [navigate]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("meals.addComboPageTitle")}
        onBack={leaveNewCombo}
        backAriaLabel={t("meals.backToSavedMealsManage")}
        subtitle={t("meals.addComboSubtitle")}
      />

      <ComboEditorForm
        draftKey={DRAFT_KEY}
        returnTo={paths.add.savedComboNew}
        itemFlowSearch={{ context: "new" }}
        initialName=""
        initialItems={[]}
        savePending={savePending}
        onSaved={() => endNewComboDraftSession()}
        onSave={async ({ name, items, photo, photoFileId }) => {
          setSavePending(true);
          try {
            const id = await addSavedCombo({
              name,
              items,
              ...(photo ? { photo } : {}),
              ...(photoFileId ? { photoFileId } : {}),
            });
            void id;
            toast.success(t("errors.savedComboAdded"));
            await navigate({ to: paths.add.savedMealsManage });
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : t("errors.couldNotAddCombo"),
            );
          } finally {
            setSavePending(false);
          }
        }}
      />
    </div>
  );
}
