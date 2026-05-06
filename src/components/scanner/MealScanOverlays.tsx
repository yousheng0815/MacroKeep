import { ButtonSpinner } from "@/components/ButtonSpinner";
import type { MealScanDraft } from "@/types/meal-scan";
import { Loader2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type MealScanOverlaysProps = {
  analyzing: boolean;
  draft: MealScanDraft | null;
  setDraft: Dispatch<SetStateAction<MealScanDraft | null>>;
  isSaving: boolean;
  onSave: () => void | Promise<void>;
  onCancelDraft: () => void;
};

/** Full-screen analyzing blocker + confirm-meal modal (shared Dashboard / Scanner). */
export function MealScanOverlays({
  analyzing,
  draft,
  setDraft,
  isSaving,
  onSave,
  onCancelDraft,
}: MealScanOverlaysProps) {
  return (
    <>
      {analyzing ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label="Analyzing meal photo"
        >
          <Loader2 className="size-12 animate-spin text-emerald-400" />
          <p className="text-center text-base font-medium text-zinc-100">
            AI analyzing…
          </p>
          <p className="max-w-sm text-center text-sm text-zinc-400">
            Stay on this screen — almost done.
          </p>
        </div>
      ) : null}

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-om-border bg-om-surface p-5 shadow-2xl">
            <div className="text-lg font-semibold text-white">Confirm meal</div>
            <p className="mt-1 text-xs text-om-muted">
              Adjust values if needed, then save to your diary (syncs to Drive
              when signed in).
            </p>

            <div className="mt-4 overflow-hidden rounded-xl bg-black/40 ring-1 ring-zinc-700">
              <img
                src={`data:${draft.snapshot.mimeType};base64,${draft.snapshot.base64}`}
                alt="Meal snapshot"
                className="max-h-52 w-full object-cover"
              />
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs text-zinc-400">
                Name
                <input
                  value={draft.estimate.food_name}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            estimate: {
                              ...d.estimate,
                              food_name: e.target.value,
                            },
                          }
                        : d,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-zinc-400">
                  Calories
                  <input
                    inputMode="numeric"
                    value={draft.estimate.calories}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              estimate: {
                                ...d.estimate,
                                calories: Number(e.target.value),
                              },
                            }
                          : d,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Protein (g)
                  <input
                    inputMode="decimal"
                    value={draft.estimate.protein}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              estimate: {
                                ...d.estimate,
                                protein: Number(e.target.value),
                              },
                            }
                          : d,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Fats (g)
                  <input
                    inputMode="decimal"
                    value={draft.estimate.fats}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              estimate: {
                                ...d.estimate,
                                fats: Number(e.target.value),
                              },
                            }
                          : d,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Carbs (g)
                  <input
                    inputMode="decimal"
                    value={draft.estimate.carbs}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              estimate: {
                                ...d.estimate,
                                carbs: Number(e.target.value),
                              },
                            }
                          : d,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={onCancelDraft}
                className="flex-1 rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                aria-busy={isSaving}
                onClick={() => void onSave()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <ButtonSpinner /> : "Save meal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
