import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type MacroSummaryProps = {
  proteinG: number;
  fatsG: number;
  carbsG: number;
  targets: { p: number; f: number; c: number };
  variant?: "compact" | "expanded";
  /** While true, bars use 0 progress; numeric totals show spinners. */
  consumptionPending?: boolean;
};

function pct(cur: number, tgt: number): number {
  return Math.min(1, cur / Math.max(1, tgt));
}

function MacroCell({
  label,
  cur,
  tgt,
  expanded,
  consumptionPending,
}: {
  label: string;
  cur: number;
  tgt: number;
  expanded: boolean;
  consumptionPending?: boolean;
}) {
  const barCur = consumptionPending ? 0 : cur;
  const totalRatio = barCur / Math.max(1, tgt);
  const p = pct(barCur, tgt);
  const overflowP = Math.min(1, Math.max(0, totalRatio - 1));
  const overflowClass = "bg-amber-400/90";
  const gramsLineClass = expanded
    ? "text-sm text-white"
    : "text-xs text-zinc-400";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] !duration-500 ease-out"
          style={{ width: `${p * 100}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color,opacity] !duration-500 ease-out ${overflowClass}`}
          style={{
            width: `${overflowP * 100}%`,
            transitionDelay: overflowP > 0 ? "500ms" : "0ms",
            visibility: overflowP > 0 ? "visible" : "hidden",
          }}
        />
      </div>
      <div className={`tabular-nums ${gramsLineClass}`}>
        {consumptionPending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2
              className="size-3 shrink-0 animate-spin text-emerald-400"
              aria-hidden
            />
            <span className="text-zinc-500">/ {tgt} g</span>
          </span>
        ) : (
          <>
            {Math.round(cur)} / {tgt} g
          </>
        )}
      </div>
    </div>
  );
}

export function MacroSummary({
  proteinG,
  fatsG,
  carbsG,
  targets,
  variant = "compact",
  consumptionPending,
}: MacroSummaryProps) {
  const { t } = useTranslation();
  const expanded = variant === "expanded";
  return (
    <div
      className={`grid gap-4 ${expanded ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3"}`}
    >
      <MacroCell
        label={t("common.protein")}
        cur={proteinG}
        tgt={targets.p}
        expanded={expanded}
        consumptionPending={consumptionPending}
      />
      <MacroCell
        label={t("common.fat")}
        cur={fatsG}
        tgt={targets.f}
        expanded={expanded}
        consumptionPending={consumptionPending}
      />
      <MacroCell
        label={t("common.carbs")}
        cur={carbsG}
        tgt={targets.c}
        expanded={expanded}
        consumptionPending={consumptionPending}
      />
    </div>
  );
}
