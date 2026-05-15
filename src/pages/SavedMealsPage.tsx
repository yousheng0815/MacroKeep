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
import { ButtonSpinner } from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { paths } from "@/lib/routes";
import type { SavedMealRecord } from "@/types/records";
import { Link, useNavigate } from "@tanstack/react-router";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

function sameOrderAndIds(
  a: readonly SavedMealRecord[],
  b: readonly SavedMealRecord[],
): boolean {
  return a.length === b.length && a.every((row, i) => row.id === b[i]?.id);
}

type ListMode = "browse" | "manage" | "reorder";

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
  return (
    <li className="min-w-0 overflow-hidden">
      <div className="flex max-w-full min-w-0 items-center gap-2 py-3">
        <MealPhotoThumb
          photoFileId={item.photoFileId}
          alt={item.food_name}
          className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
        />
        <div className="w-0 min-w-0 flex-1 overflow-hidden">
          <div className="truncate font-medium text-white">{item.food_name}</div>
          <div className="mt-1 truncate text-sm text-om-muted">
            {Math.round(item.calories)} kcal
          </div>
        </div>
        <Link
          to={paths.add.savedMealEdit}
          params={{ savedMealId: item.id }}
          aria-label={`Edit ${item.food_name}`}
          className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white ${
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
          aria-label={`Remove ${item.food_name} from list`}
          onClick={() => onRemove(item.id)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-red-400 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

type SortableReorderRowProps = {
  item: SavedMealRecord;
  committing: boolean;
};

function SortableReorderRow({ item, committing }: SortableReorderRowProps) {
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
      <div className="flex max-w-full min-w-0 items-center gap-2 py-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Drag to reorder ${item.food_name}`}
          disabled={committing}
          className={`inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-zinc-500 outline-none transition hover:bg-zinc-800 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-sky-500/80 ${
            committing
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab touch-none active:cursor-grabbing"
          }`}
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <MealPhotoThumb
          photoFileId={item.photoFileId}
          alt={item.food_name}
          className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
        />
        <div className="w-0 min-w-0 flex-1 overflow-hidden">
          <div className="truncate font-medium text-white">{item.food_name}</div>
          <div className="mt-1 truncate text-sm text-om-muted">
            {Math.round(item.calories)} kcal
          </div>
        </div>
      </div>
    </li>
  );
}

export function SavedMealsPage() {
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
        : "Could not load saved meals from Drive.",
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
      toast.success("Saved");
      exitDiscard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes.");
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
      toast.success("Meal added");
      await navigate({ to: paths.history });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add meal.");
    } finally {
      setPendingId(null);
    }
  };

  const removeFromDraft = (id: string) => {
    setDraft((cur) => (cur ? cur.filter((s) => s.id !== id) : cur));
  };

  const list =
    listMode !== "browse" && draft !== null ? draft : savedMeals;

  const inSession = listMode !== "browse";

  const showSavedMealsActions =
    !isSavedMealsLoading &&
    !savedMealsError &&
    (savedMeals.length > 0 || inSession);

  const canReorder = savedMeals.length >= 2;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Add From Saved Meals"
        backTo={paths.add.root}
        backAriaLabel="Back to add meal"
        subtitle="Pick a saved meal to quickly log it again."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Saved meals</h2>
          {showSavedMealsActions ? (
            inSession ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={committing}
                  onClick={exitDiscard}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={committing}
                  aria-busy={committing}
                  aria-label={committing ? "Saving" : undefined}
                  onClick={() => void exitDone()}
                  className="inline-flex min-h-[2.25rem] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {committing ? (
                    <span className="relative inline-flex items-center justify-center">
                      <span className="invisible" aria-hidden>
                        Done
                      </span>
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        aria-hidden
                      >
                        <ButtonSpinner className="size-5 text-sky-300" />
                      </span>
                    </span>
                  ) : (
                    "Done"
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={enterManage}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300"
                >
                  Edit
                </button>
                {canReorder ? (
                  <button
                    type="button"
                    onClick={enterReorder}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-400 transition hover:bg-zinc-800 hover:text-sky-300"
                  >
                    Reorder
                  </button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
        {isSavedMealsLoading ? (
          <p className="text-sm text-om-muted">Loading saved meals…</p>
        ) : savedMealsError ? (
          <p className="text-sm text-om-muted">
            Couldn&apos;t load saved meals. Check your connection or try
            refreshing the app.
          </p>
        ) : savedMeals.length === 0 && !inSession ? (
          <p className="text-sm text-om-muted">
            No saved meals yet. Open a meal, then use &quot;Add to saved
            meals&quot; on the meal details screen to build your quick-add list.
          </p>
        ) : list.length === 0 && listMode === "manage" ? (
          <p className="text-sm text-om-muted">
            No meals in this list. Tap Done to clear your saved meals, Cancel to
            undo edits, or add meals from a logged entry first.
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
        ) : (
          <ul className="divide-y divide-zinc-800">
            {list.map((item) => (
              <li key={item.id} className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  disabled={pendingId !== null}
                  aria-busy={pendingId === item.id}
                  onClick={() => void onPickSaved(item)}
                  className="flex w-full max-w-full min-w-0 items-center gap-3 py-3 overflow-hidden text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MealPhotoThumb
                    photoFileId={item.photoFileId}
                    alt={item.food_name}
                    className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800"
                  />
                  <div className="w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="block max-w-full truncate font-medium text-white">
                          {item.food_name}
                        </div>
                      </div>
                      {pendingId === item.id ? (
                        <ButtonSpinner className="shrink-0 text-zinc-200" />
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-sm text-om-muted">
                      {Math.round(item.calories)} kcal
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
