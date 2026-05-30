import { Card } from "@/components/Card";
import { COMBO_ROW_PHOTO_CLASS } from "@/components/ComboPhotoThumb";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import {
  appendSavedMealToComboItems,
  comboDraftKey,
  comboEditorReturnTo,
  readComboDraft,
  writeComboDraft,
} from "@/lib/combo-draft";
import { paths } from "@/lib/routes";
import { activeSavedMeals } from "@/lib/saved-combo-utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type ComboItemFlowSearch = {
  context?: "new";
  comboId?: string;
};

function parseComboItemFlowSearch(
  search: Record<string, unknown>,
): ComboItemFlowSearch {
  return {
    context: search.context === "new" ? "new" : undefined,
    comboId: typeof search.comboId === "string" ? search.comboId : undefined,
  };
}

export type { ComboItemFlowSearch };
export { parseComboItemFlowSearch };

export function ComboAddSavedMealsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ComboItemFlowSearch;
  const { savedQuickAdds } = useRecords();

  const draftKey = comboDraftKey(search);
  const returnTo = comboEditorReturnTo(search);
  const draft = readComboDraft(draftKey);

  const pickableMeals = useMemo(
    () => activeSavedMeals(savedQuickAdds),
    [savedQuickAdds],
  );

  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader
          title={t("meals.addSavedMealToComboPageTitle")}
          backTo={paths.add.savedComboNew}
          backAriaLabel={t("meals.backToComboEditor")}
        />
        <Card>
          <p className="text-sm text-mk-muted">{t("meals.comboDraftExpired")}</p>
        </Card>
      </div>
    );
  }

  const onPick = (mealId: string) => {
    setPendingId(mealId);
    writeComboDraft(draftKey, {
      ...draft,
      items: appendSavedMealToComboItems(draft.items, mealId),
      returnTo,
    });
    void navigate({ to: returnTo }).finally(() => setPendingId(null));
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("meals.addSavedMealToComboPageTitle")}
        backTo={returnTo}
        backAriaLabel={t("meals.backToComboEditor")}
        subtitle={t("meals.addSavedMealToComboSubtitle")}
      />

      <Card>
        {pickableMeals.length === 0 ? (
          <p className="text-sm text-mk-muted">{t("meals.noSavedMealsForCombo")}</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {pickableMeals.map((meal) => (
              <li key={meal.id}>
                <button
                  type="button"
                  disabled={pendingId !== null}
                  aria-busy={pendingId === meal.id}
                  onClick={() => onPick(meal.id)}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MealPhotoThumb
                    photoFileId={meal.photoFileId}
                    alt={meal.food_name}
                    enlargeOnClick={false}
                    cachePolicy={{ tier: "saved" }}
                    className={COMBO_ROW_PHOTO_CLASS}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-white">
                    {meal.food_name}
                  </span>
                  <span className="shrink-0 text-sm text-mk-muted">
                    {Math.round(meal.calories)} kcal
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-zinc-500"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
