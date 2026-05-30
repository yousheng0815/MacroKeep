import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import {
  ManageRow,
  SortableReorderRow,
} from "@/components/saved-quick-add/SavedQuickAddListRows";
import { BLOCK_PULL_TO_REFRESH_ATTR } from "@/hooks/use-pull-to-refresh";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { endNewComboDraftSession } from "@/lib/combo-draft";
import { paths } from "@/lib/routes";
import {
  countComboRefsForSavedMeal,
  getCombosReferencingSavedMeal,
} from "@/lib/saved-combo-utils";
import { isSavedMeal, type SavedQuickAdd } from "@/types/records";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

function sameOrderAndIds(
  a: readonly SavedQuickAdd[],
  b: readonly SavedQuickAdd[],
): boolean {
  return a.length === b.length && a.every((row, i) => row.id === b[i]?.id);
}

type ListMode = "manage" | "reorder";

const HEADER_ACTION_BTN =
  "inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold";

export function SavedMealsManagePage() {
  const { t } = useTranslation();
  const {
    visibleSavedQuickAdds,
    savedQuickAdds,
    commitSavedMeals,
    isSavedMealsLoading,
    savedMealsError,
  } = useRecords();
  const [listMode, setListMode] = useState<ListMode>("manage");
  const [draft, setDraft] = useState<SavedQuickAdd[] | null>(null);
  const sessionBaselineRef = useRef<SavedQuickAdd[]>([]);
  const [committing, setCommitting] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    endNewComboDraftSession();
  }, []);

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : t("errors.couldNotLoadSavedMealsDrive"),
    );
  }, [savedMealsError, t]);

  const beginSession = useCallback(() => {
    sessionBaselineRef.current = [...visibleSavedQuickAdds];
    setDraft([...visibleSavedQuickAdds]);
  }, [visibleSavedQuickAdds]);

  useEffect(() => {
    beginSession();
  }, [beginSession]);

  const exitDiscard = useCallback(() => {
    setListMode("manage");
    beginSession();
    setArchiveConfirmOpen(false);
  }, [beginSession]);

  const mealsToArchiveOnCommit = useMemo(() => {
    if (!draft) return [];
    const draftIds = new Set(draft.map((row) => row.id));
    return sessionBaselineRef.current.filter((row) => {
      if (draftIds.has(row.id)) return false;
      return isSavedMeal(row) && countComboRefsForSavedMeal(savedQuickAdds, row.id) > 0;
    });
  }, [draft, savedQuickAdds]);

  const performCommit = useCallback(async () => {
    if (!draft) return;
    setCommitting(true);
    try {
      await commitSavedMeals(draft);
      toast.success(t("errors.saved"));
      sessionBaselineRef.current = [...draft];
      setListMode("manage");
      setArchiveConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotSaveChanges"));
    } finally {
      setCommitting(false);
    }
  }, [draft, commitSavedMeals, t]);

  const exitDone = useCallback(async () => {
    if (!draft) return;
    if (sameOrderAndIds(draft, sessionBaselineRef.current)) {
      setListMode("manage");
      return;
    }
    if (mealsToArchiveOnCommit.length > 0) {
      setArchiveConfirmOpen(true);
      return;
    }
    await performCommit();
  }, [draft, mealsToArchiveOnCommit.length, performCommit]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((cur) => {
      if (!cur) return cur;
      const oldIndex = cur.findIndex((s) => s.id === active.id);
      const newIndex = cur.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return cur;
      return arrayMove(cur, oldIndex, newIndex);
    });
  }, []);

  const removeFromDraft = (id: string) => {
    setDraft((cur) => (cur ? cur.filter((s) => s.id !== id) : cur));
  };

  const list = draft ?? visibleSavedQuickAdds;
  const inReorder = listMode === "reorder";
  const showActions = !isSavedMealsLoading && !savedMealsError;
  const canReorder = list.length >= 2;
  const hasUnsavedChanges =
    draft !== null && !sameOrderAndIds(draft, sessionBaselineRef.current);

  const archiveConfirmDescription = useMemo(() => {
    if (mealsToArchiveOnCommit.length === 0) return null;
    const lines = mealsToArchiveOnCommit.map((meal) => {
      if (!isSavedMeal(meal)) return null;
      const combos = getCombosReferencingSavedMeal(savedQuickAdds, meal.id);
      return t("meals.archiveConfirmLine", {
        foodName: meal.food_name,
        count: combos.length,
      });
    });
    return (
      <div className="space-y-2">
        <p>{t("meals.archiveConfirmIntro")}</p>
        <ul className="list-disc space-y-1 pl-5">
          {lines.filter(Boolean).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>{t("meals.archiveConfirmOutro")}</p>
      </div>
    );
  }, [mealsToArchiveOnCommit, savedQuickAdds, t]);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title={t("meals.manageSavedMealsTitle")}
        backTo={paths.add.savedMeals}
        backAriaLabel={t("meals.backToSavedMeals")}
        subtitle={t("meals.manageSavedMealsSubtitle")}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        title={t("meals.archiveConfirmTitle")}
        description={archiveConfirmDescription}
        confirmLabel={t("meals.archiveConfirmAction")}
        cancelLabel={t("common.cancel")}
        pending={committing}
        onConfirm={() => void performCommit()}
        onCancel={() => setArchiveConfirmOpen(false)}
      />

      <Card>
        <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            {t("meals.savedMealsSection")}
          </h2>
          {showActions && inReorder ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={committing}
                onClick={exitDiscard}
                className={`${HEADER_ACTION_BTN} text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={committing}
                aria-busy={committing}
                onClick={() => void exitDone()}
                className={`${HEADER_ACTION_BTN} relative text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {committing ? (
                  <ButtonSpinner className="size-5 text-sky-300" />
                ) : (
                  t("common.done")
                )}
              </button>
            </div>
          ) : showActions && canReorder ? (
            <button
              type="button"
              onClick={() => setListMode("reorder")}
              className={`${HEADER_ACTION_BTN} text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300`}
            >
              {t("meals.reorder")}
            </button>
          ) : null}
        </div>

        {isSavedMealsLoading ? (
          <p className="text-sm text-mk-muted">{t("meals.loadingSavedMeals")}</p>
        ) : savedMealsError ? (
          <p className="text-sm text-mk-muted">{t("meals.couldntLoadSaved")}</p>
        ) : inReorder && draft ? (
          <div {...{ [BLOCK_PULL_TO_REFRESH_ATTR]: "" }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={draft.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y divide-zinc-800">
                  {draft.map((item) => (
                    <SortableReorderRow
                      key={item.id}
                      item={item}
                      allItems={savedQuickAdds}
                      committing={committing}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="space-y-4">
            {list.length === 0 ? (
              <p className="text-sm text-mk-muted">{t("meals.noSavedMealsManage")}</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {list.map((item) => (
                  <ManageRow
                    key={item.id}
                    item={item}
                    allItems={savedQuickAdds}
                    committing={committing}
                    onRemove={removeFromDraft}
                    editDisabled={false}
                  />
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to={paths.add.savedMealNew}
                className="btn-mobile-block-lg flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
              >
                <Plus className="size-4 text-emerald-400" aria-hidden />
                {t("meals.addSavedMeal")}
              </Link>
              <Link
                to={paths.add.savedComboNew}
                className="btn-mobile-block-lg flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
              >
                <Plus className="size-4 text-orange-400" aria-hidden />
                {t("meals.addCombo")}
              </Link>
            </div>
            {hasUnsavedChanges ? (
              <div className="btn-pair-row border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  disabled={committing}
                  onClick={() => setDraft([...sessionBaselineRef.current])}
                  className="flex items-center justify-center rounded-xl border border-mk-border px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={committing}
                  aria-busy={committing}
                  onClick={() => void performCommit()}
                  className="relative flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {committing ? (
                    <ButtonSpinner className="text-black" />
                  ) : (
                    t("common.saveChanges")
                  )}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
