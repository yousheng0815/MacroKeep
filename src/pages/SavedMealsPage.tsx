import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { toast } from "@/lib/app-toast";
import { paths } from "@/lib/routes";
import type { SavedMealRecord } from "@/types/records";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useNavigate } from "@tanstack/react-router";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

function sameOrderAndIds(
  a: readonly SavedMealRecord[],
  b: readonly SavedMealRecord[],
): boolean {
  return a.length === b.length && a.every((row, i) => row.id === b[i]?.id);
}

type ListMode = "browse" | "manage" | "reorder";

/** Keeps the saved-meals card header the same height in browse vs edit/reorder. */
const SAVED_MEALS_HEADER_ACTION_BTN =
  "inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold";

const SAVED_MEAL_ROW_PHOTO_CLASS =
  "size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800";

type SavedMealRowContentProps = {
  item: SavedMealRecord;
  leading?: ReactNode;
  titleAccessory?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

function SavedMealRowContent({
  item,
  leading,
  titleAccessory,
  trailing,
  className = "",
}: SavedMealRowContentProps) {
  return (
    <div
      className={`flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden ${className}`}
    >
      {leading ? (
        <div className="flex shrink-0 items-center justify-center">
          {leading}
        </div>
      ) : null}
      <MealPhotoThumb
        photoFileId={item.photoFileId}
        alt={item.food_name}
        cachePolicy={{ tier: "saved" }}
        className={SAVED_MEAL_ROW_PHOTO_CLASS}
      />
      <div className="w-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 truncate font-medium text-white">
            {item.food_name}
          </div>
          {titleAccessory}
        </div>
        <div className="mt-1 truncate text-sm text-mk-muted">
          {Math.round(item.calories)} kcal
        </div>
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}

type ManageRowProps = {
  item: SavedMealRecord;
  committing: boolean;
  onRemove: (id: string) => void;
  editDisabled: boolean;
};

function ManageRow({
  item,
  committing,
  onRemove,
  editDisabled,
}: ManageRowProps) {
  const { t } = useTranslation();
  return (
    <li className="min-w-0 overflow-hidden">
      <SavedMealRowContent
        item={item}
        className="py-3"
        trailing={
          <>
            <Link
              to={paths.add.savedMealEdit}
              params={{ savedMealId: item.id }}
              aria-label={t("meals.editAria", { foodName: item.food_name })}
              className={`relative z-10 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white ${
                editDisabled || committing
                  ? "pointer-events-none opacity-40"
                  : ""
              }`}
            >
              <Pencil className="size-5" aria-hidden />
            </Link>
            <button
              type="button"
              disabled={committing}
              aria-label={t("meals.removeAria", { foodName: item.food_name })}
              onClick={() => onRemove(item.id)}
              className="inline-flex items-center justify-center rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-red-400 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </>
        }
      />
    </li>
  );
}

type SortableReorderRowProps = {
  item: SavedMealRecord;
  committing: boolean;
};

function SortableReorderRow({ item, committing }: SortableReorderRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: committing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`min-w-0 overflow-hidden ${
        isDragging ? "z-10 opacity-90 shadow-lg shadow-black/40" : ""
      }`}
    >
      <SavedMealRowContent
        item={item}
        className="py-3"
        leading={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label={t("meals.dragReorderAria", { foodName: item.food_name })}
            disabled={committing}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 outline-none transition hover:bg-zinc-800 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-sky-500/80 ${
              committing
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab touch-none active:cursor-grabbing"
            }`}
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        }
      />
    </li>
  );
}

export function SavedMealsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    savedMeals,
    addMeal,
    commitSavedMeals,
    isSavedMealsLoading,
    savedMealsError,
  } = useRecords();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>("browse");
  const [draft, setDraft] = useState<SavedMealRecord[] | null>(null);
  const sessionBaselineRef = useRef<SavedMealRecord[]>([]);
  const [committing, setCommitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!savedMealsError) return;
    toast.error(
      savedMealsError instanceof Error
        ? savedMealsError.message
        : t("errors.couldNotLoadSavedMealsDrive"),
    );
  }, [savedMealsError]);

  const beginSession = useCallback(() => {
    sessionBaselineRef.current = [...savedMeals];
    setDraft([...savedMeals]);
  }, [savedMeals]);

  const enterManage = useCallback(() => {
    beginSession();
    setListMode("manage");
  }, [beginSession]);

  const enterReorder = useCallback(() => {
    beginSession();
    setListMode("reorder");
  }, [beginSession]);

  const exitDiscard = useCallback(() => {
    setListMode("browse");
    setDraft(null);
  }, []);

  const exitDone = useCallback(async () => {
    if (!draft) {
      exitDiscard();
      return;
    }
    if (sameOrderAndIds(draft, sessionBaselineRef.current)) {
      exitDiscard();
      return;
    }
    setCommitting(true);
    try {
      await commitSavedMeals(draft);
      toast.success(t("errors.saved"));
      exitDiscard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotSaveChanges"));
    } finally {
      setCommitting(false);
    }
  }, [draft, commitSavedMeals, exitDiscard]);

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
      await navigate({ to: paths.history });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotAddMeal"));
    } finally {
      setPendingId(null);
    }
  };

  const removeFromDraft = (id: string) => {
    setDraft((cur) => (cur ? cur.filter((s) => s.id !== id) : cur));
  };

  const list = listMode !== "browse" && draft !== null ? draft : savedMeals;

  const inSession = listMode !== "browse";

  const showSavedMealsActions = !isSavedMealsLoading && !savedMealsError;

  const canReorder = savedMeals.length >= 2;

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
          <h2 className="text-sm font-semibold text-white">{t("meals.savedMealsSection")}</h2>
          {showSavedMealsActions ? (
            inSession ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={committing}
                  onClick={exitDiscard}
                  className={`${SAVED_MEALS_HEADER_ACTION_BTN} text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={committing}
                  aria-busy={committing}
                  aria-label={committing ? t("common.saving") : undefined}
                  onClick={() => void exitDone()}
                  className={`${SAVED_MEALS_HEADER_ACTION_BTN} relative text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {committing ? (
                    <span className="relative inline-flex items-center justify-center">
                      <span className="invisible" aria-hidden>{t("common.done")}</span>
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        aria-hidden
                      >
                        <ButtonSpinner className="size-5 text-sky-300" />
                      </span>
                    </span>
                  ) : (
                    t("common.done")
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={enterManage}
                  className={`${SAVED_MEALS_HEADER_ACTION_BTN} text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300`}
                >
                  {t("meals.edit")}
                </button>
                {canReorder ? (
                  <button
                    type="button"
                    onClick={enterReorder}
                    className={`${SAVED_MEALS_HEADER_ACTION_BTN} text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300`}
                  >
                    {t("meals.reorder")}
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
        {isSavedMealsLoading ? (
          <p className="text-sm text-mk-muted">{t("meals.loadingSavedMeals")}</p>
        ) : savedMealsError ? (
          <p className="text-sm text-mk-muted">
            Couldn&apos;t load saved meals. Check your connection or try
            refreshing the app.
          </p>
        ) : savedMeals.length === 0 && !inSession ? (
          <p className="text-sm text-mk-muted">
            {t("meals.noSavedMealsBrowse")}
          </p>
        ) : listMode === "reorder" && draft ? (
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
                    committing={committing}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : listMode === "manage" && draft ? (
          <div className="space-y-4">
            {draft.length === 0 ? (
              <p className="text-sm text-mk-muted">
                {t("meals.noSavedMealsManage")}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {draft.map((item) => (
                  <ManageRow
                    key={item.id}
                    item={item}
                    committing={committing}
                    onRemove={removeFromDraft}
                    editDisabled={pendingId !== null}
                  />
                ))}
              </ul>
            )}
            <Link
              to={paths.add.savedMealNew}
              className="btn-mobile-block-lg flex items-center justify-center gap-2 rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              <Plus className="size-4 text-emerald-400" aria-hidden />
              {t("meals.addSavedMeal")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {list.map((item) => (
              <li key={item.id} className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  disabled={pendingId !== null}
                  aria-busy={pendingId === item.id}
                  onClick={() => void onPickSaved(item)}
                  className="w-full p-0 text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SavedMealRowContent
                    item={item}
                    className="py-3"
                    titleAccessory={
                      pendingId === item.id ? (
                        <ButtonSpinner className="shrink-0 text-zinc-200" />
                      ) : null
                    }
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
