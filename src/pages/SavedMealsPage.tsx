import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { BrowseRow } from "@/components/saved-quick-add/SavedQuickAddListRows";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { resolveComboLogPhotoOptions } from "@/lib/combo-photo-collage";
import { paths } from "@/lib/routes";
import {
  resolveComboItems,
  sumResolvedMacros,
} from "@/lib/saved-combo-utils";
import type { SavedComboRecord, SavedMealRecord } from "@/types/records";
import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function SavedMealsPage() {
  const { t } = useTranslation();
  const {
    visibleSavedQuickAdds,
    savedQuickAdds,
    addMeal,
    isSavedMealsLoading,
    savedMealsError,
  } = useRecords();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : t("errors.couldNotLoadSavedMealsDrive"),
    );
  }, [savedMealsError, t]);

  const onPickSaved = async (item: SavedMealRecord) => {
    setPendingId(item.id);
    try {
      await addMeal(
        {
          food_name: item.food_name,
          calories: item.calories,
          protein: item.protein,
          fats: item.fats,
          carbs: item.carbs,
        },
        item.photoFileId ? { photoFileId: item.photoFileId } : undefined,
      );
      toast.success(t("errors.mealAdded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotAddMeal"));
    } finally {
      setPendingId(null);
    }
  };

  const onPickCombo = async (combo: SavedComboRecord) => {
    setPendingId(combo.id);
    try {
      const resolved = resolveComboItems(combo, savedQuickAdds);
      if (resolved.length === 0) {
        throw new Error(t("errors.comboHasNoItems"));
      }
      const totals = sumResolvedMacros(resolved);
      const photoOptions = await resolveComboLogPhotoOptions(combo, savedQuickAdds);
      await addMeal(
        {
          food_name: combo.name,
          calories: totals.calories,
          protein: totals.protein,
          fats: totals.fats,
          carbs: totals.carbs,
          savedComboId: combo.id,
        },
        photoOptions,
      );
      toast.success(t("errors.mealAdded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotAddMeal"));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title={t("meals.addFromSavedTitle")}
        backTo={paths.add.root}
        backAriaLabel={t("addMeal.backToAddMeal")}
        subtitle={t("meals.addFromSavedSubtitle")}
      />

      <Card>
        <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            {t("meals.savedMealsSection")}
          </h2>
          {!isSavedMealsLoading && !savedMealsError ? (
            <Link
              to={paths.add.savedMealsManage}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300"
            >
              <Settings2 className="size-4" aria-hidden />
              {t("meals.manageSavedMealsLink")}
            </Link>
          ) : null}
        </div>

        {isSavedMealsLoading ? (
          <p className="text-sm text-mk-muted">{t("meals.loadingSavedMeals")}</p>
        ) : savedMealsError ? (
          <p className="text-sm text-mk-muted">{t("meals.couldntLoadSaved")}</p>
        ) : visibleSavedQuickAdds.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-mk-muted">{t("meals.noSavedMealsBrowse")}</p>
            <Link
              to={paths.add.savedMealsManage}
              className="btn-mobile-block-lg flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              <Settings2 className="size-4 text-sky-400" aria-hidden />
              {t("meals.manageSavedMealsLink")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {visibleSavedQuickAdds.map((item) => (
              <BrowseRow
                key={item.id}
                item={item}
                allItems={savedQuickAdds}
                pendingId={pendingId}
                onPickMeal={onPickSaved}
                onPickCombo={onPickCombo}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
