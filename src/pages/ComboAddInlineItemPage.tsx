import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/lib/app-toast";
import {
  comboDraftKey,
  comboEditorReturnTo,
  readComboDraft,
  writeComboDraft,
} from "@/lib/combo-draft";
import { paths } from "@/lib/routes";
import { exitSubflow } from "@/lib/subflow-nav";
import type { ComboItem } from "@/types/records";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ComboItemFlowSearch } from "@/pages/ComboAddSavedMealsPage";

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ComboAddInlineItemPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const search = useSearch({ strict: false }) as ComboItemFlowSearch;
  const [pending, setPending] = useState(false);

  const draftKey = comboDraftKey(search);
  const returnTo = comboEditorReturnTo(search);
  const draft = readComboDraft(draftKey);

  if (!draft) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader
          title={t("meals.addInlineItemToComboPageTitle")}
          backTo={paths.add.savedComboNew}
          backAriaLabel={t("meals.backToComboEditor")}
        />
        <Card>
          <p className="text-sm text-mk-muted">{t("meals.comboDraftExpired")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("meals.addInlineItemToComboPageTitle")}
        onBack={() => exitSubflow(router, returnTo)}
        backAriaLabel={t("meals.backToComboEditor")}
        subtitle={t("meals.addInlineItemToComboSubtitle")}
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const form = new FormData(e.currentTarget);
              const foodName = String(form.get("foodName") ?? "").trim();
              if (!foodName) {
                toast.error(t("common.enterFoodName"));
                return;
              }
              setPending(true);
              try {
                const inlineItem: ComboItem = {
                  source: "inline",
                  food_name: foodName,
                  calories: parseNumber(String(form.get("calories") ?? "0")),
                  protein: parseNumber(String(form.get("protein") ?? "0")),
                  fats: parseNumber(String(form.get("fats") ?? "0")),
                  carbs: parseNumber(String(form.get("carbs") ?? "0")),
                };
                writeComboDraft(draftKey, {
                  ...draft,
                  items: [...draft.items, inlineItem],
                  returnTo,
                });
                exitSubflow(router, returnTo);
              } finally {
                setPending(false);
              }
            })();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-mk-muted">
              {t("common.foodName")}
            </span>
            <input
              name="foodName"
              type="text"
              autoComplete="off"
              placeholder={t("common.placeholderFoodName")}
              className="w-full mk-text-input"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                {t("common.calories")}
              </span>
              <input
                name="calories"
                type="number"
                inputMode="decimal"
                step="1"
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                {t("common.proteinG")}
              </span>
              <input
                name="protein"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                {t("common.fatsG")}
              </span>
              <input
                name="fats"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-mk-muted">
                {t("common.carbsG")}
              </span>
              <input
                name="carbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full mk-text-input"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="relative btn-mobile-block-lg gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents pending={pending} spinner={<ButtonSpinner />}>
              {t("meals.addInlineItemConfirm")}
            </ButtonPendingContents>
          </button>
        </form>
      </Card>
    </div>
  );
}
