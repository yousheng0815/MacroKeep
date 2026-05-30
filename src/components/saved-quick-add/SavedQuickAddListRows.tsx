import { ButtonSpinner } from "@/components/ButtonSpinner";
import { ComboPhotoThumb, COMBO_ROW_PHOTO_CLASS } from "@/components/ComboPhotoThumb";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { paths } from "@/lib/routes";
import {
  resolveComboItems,
  sumResolvedMacros,
} from "@/lib/saved-combo-utils";
import {
  isSavedCombo,
  type SavedComboRecord,
  type SavedMealRecord,
  type SavedQuickAdd,
} from "@/types/records";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { Combine, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export const SAVED_MEAL_ROW_PHOTO_CLASS =
  "size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800";

function comboRowSubtitle(calories: number, count: number) {
  return (
    <span className="inline-flex min-w-0 items-center gap-4 truncate">
      <span className="truncate">{Math.round(calories)} kcal</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-orange-400">
        <Combine className="size-3.5 shrink-0" aria-hidden />
        <span>{count}</span>
      </span>
    </span>
  );
}

type RowContentProps = {
  title: string;
  calories: number;
  subtitle?: ReactNode;
  photo: ReactNode;
  leading?: ReactNode;
  titleAccessory?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function RowContent({
  title,
  calories,
  subtitle,
  photo,
  leading,
  titleAccessory,
  trailing,
  className = "",
}: RowContentProps) {
  return (
    <div
      className={`flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden ${className}`}
    >
      {leading ? (
        <div className="flex shrink-0 items-center justify-center">{leading}</div>
      ) : null}
      {photo}
      <div className="w-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 truncate font-medium text-white">{title}</div>
          {titleAccessory}
        </div>
        <div className="mt-1 truncate text-sm text-mk-muted">
          {subtitle ?? `${Math.round(calories)} kcal`}
        </div>
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}

export function mealRowPhoto(item: SavedMealRecord) {
  return (
    <MealPhotoThumb
      photoFileId={item.photoFileId}
      alt={item.food_name}
      enlargeOnClick={false}
      cachePolicy={{ tier: "saved" }}
      className={SAVED_MEAL_ROW_PHOTO_CLASS}
    />
  );
}

function comboRowPhoto(
  combo: SavedComboRecord,
  allItems: readonly SavedQuickAdd[],
) {
  return (
    <ComboPhotoThumb
      combo={combo}
      allItems={allItems}
      alt={combo.name}
      className={COMBO_ROW_PHOTO_CLASS}
    />
  );
}

export function BrowseRow({
  item,
  allItems,
  pendingId,
  onPickMeal,
  onPickCombo,
}: {
  item: SavedQuickAdd;
  allItems: readonly SavedQuickAdd[];
  pendingId: string | null;
  onPickMeal: (item: SavedMealRecord) => void;
  onPickCombo: (item: SavedComboRecord) => void;
}) {
  if (isSavedCombo(item)) {
    const resolved = resolveComboItems(item, allItems);
    const totals = sumResolvedMacros(resolved);
    return (
      <li className="min-w-0 overflow-hidden">
        <button
          type="button"
          disabled={pendingId !== null}
          aria-busy={pendingId === item.id}
          onClick={() => void onPickCombo(item)}
          className="w-full p-0 text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RowContent
            title={item.name}
            calories={totals.calories}
            subtitle={comboRowSubtitle(totals.calories, resolved.length)}
            photo={comboRowPhoto(item, allItems)}
            className="py-3"
            titleAccessory={
              pendingId === item.id ? (
                <ButtonSpinner className="shrink-0 text-zinc-200" />
              ) : null
            }
          />
        </button>
      </li>
    );
  }

  return (
    <li className="min-w-0 overflow-hidden">
      <button
        type="button"
        disabled={pendingId !== null}
        aria-busy={pendingId === item.id}
        onClick={() => void onPickMeal(item)}
        className="w-full p-0 text-left transition hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RowContent
          title={item.food_name}
          calories={item.calories}
          photo={mealRowPhoto(item)}
          className="py-3"
          titleAccessory={
            pendingId === item.id ? (
              <ButtonSpinner className="shrink-0 text-zinc-200" />
            ) : null
          }
        />
      </button>
    </li>
  );
}

export function ManageRow({
  item,
  allItems,
  committing,
  onRemove,
  editDisabled,
}: {
  item: SavedQuickAdd;
  allItems: readonly SavedQuickAdd[];
  committing: boolean;
  onRemove: (id: string) => void;
  editDisabled: boolean;
}) {
  const { t } = useTranslation();

  if (isSavedCombo(item)) {
    const resolved = resolveComboItems(item, allItems);
    const totals = sumResolvedMacros(resolved);
    return (
      <li className="min-w-0 overflow-hidden">
        <RowContent
          title={item.name}
          calories={totals.calories}
          subtitle={comboRowSubtitle(totals.calories, resolved.length)}
          photo={comboRowPhoto(item, allItems)}
          className="py-3"
          trailing={
            <>
              <Link
                to={paths.add.savedComboEdit}
                params={{ comboId: item.id }}
                aria-label={t("meals.editComboAria", { name: item.name })}
                className={`relative z-10 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white ${
                  editDisabled || committing ? "pointer-events-none opacity-40" : ""
                }`}
              >
                <Pencil className="size-5" aria-hidden />
              </Link>
              <button
                type="button"
                disabled={committing}
                aria-label={t("meals.removeComboAria", { name: item.name })}
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

  return (
    <li className="min-w-0 overflow-hidden">
      <RowContent
        title={item.food_name}
        calories={item.calories}
        photo={mealRowPhoto(item)}
        className="py-3"
        trailing={
          <>
            <Link
              to={paths.add.savedMealEdit}
              params={{ savedMealId: item.id }}
              aria-label={t("meals.editAria", { foodName: item.food_name })}
              className={`relative z-10 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white ${
                editDisabled || committing ? "pointer-events-none opacity-40" : ""
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

export function SortableReorderRow({
  item,
  allItems,
  committing,
}: {
  item: SavedQuickAdd;
  allItems: readonly SavedQuickAdd[];
  committing: boolean;
}) {
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

  const label = isSavedCombo(item) ? item.name : item.food_name;
  const comboResolved = isSavedCombo(item)
    ? resolveComboItems(item, allItems)
    : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`min-w-0 overflow-hidden ${
        isDragging ? "z-10 opacity-90 shadow-lg shadow-black/40" : ""
      }`}
    >
      <RowContent
        title={label}
        calories={
          comboResolved
            ? sumResolvedMacros(comboResolved).calories
            : (item as SavedMealRecord).calories
        }
        subtitle={
          comboResolved
            ? comboRowSubtitle(
                sumResolvedMacros(comboResolved).calories,
                comboResolved.length,
              )
            : undefined
        }
        photo={
          isSavedCombo(item)
            ? comboRowPhoto(item, allItems)
            : mealRowPhoto(item)
        }
        className="py-3"
        leading={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label={t("meals.dragReorderAria", { foodName: label })}
            disabled={committing}
            className={`inline-flex shrink-0 items-center justify-center text-zinc-500 outline-none transition hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-sky-500/80 ${
              committing
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab touch-none active:cursor-grabbing"
            }`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </li>
  );
}
