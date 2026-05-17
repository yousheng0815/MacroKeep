import { Loader2 } from "lucide-react";

type Props = {
  consumed: number;
  target: number;
  /** While true, arc uses 0 progress; only the consumed line shows a loader. */
  consumptionPending?: boolean;
};

export function ProgressArc({ consumed, target, consumptionPending }: Props) {
  const arcConsumed = consumptionPending ? 0 : consumed;
  const safeTarget = Math.max(1, target);
  const totalRatio = arcConsumed / safeTarget;
  const ratio = Math.min(1, totalRatio);
  const overflowRatio = Math.min(1, Math.max(0, totalRatio - 1));
  const overflowStroke = "#F59E0B";
  const remaining = Math.max(0, target - arcConsumed);

  const size = 260;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  const describeArc = () =>
    `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  const arcLen = Math.PI * r;
  const dashOffset = arcLen * (1 - ratio);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={cy + stroke}
        viewBox={`0 0 ${size} ${cy + stroke}`}
        className="overflow-visible"
        aria-label="Daily calorie progress"
      >
        <defs>
          <linearGradient id="omArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <path
          d={describeArc()}
          fill="none"
          stroke="#27272A"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={describeArc()}
          fill="none"
          stroke="url(#omArc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] !duration-500 ease-out"
        />
        <path
          d={describeArc()}
          fill="none"
          stroke={overflowStroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={arcLen * (1 - overflowRatio)}
          className="transition-[stroke-dashoffset,stroke,opacity] !duration-500 ease-out"
          style={{
            transitionDelay: overflowRatio > 0 ? "500ms" : "0ms",
            opacity: overflowRatio > 0 ? 1 : 0,
          }}
        />
      </svg>
      <div className="-mt-14 flex flex-col items-center text-center">
        <div className="text-4xl font-bold tabular-nums text-white">
          {remaining.toLocaleString()}
        </div>
        <div className="text-sm text-zinc-400">Remaining kcal</div>
        <div className="mt-3 flex min-h-[1rem] items-center justify-center gap-2 text-xs text-mk-muted">
          {consumptionPending ? (
            <Loader2
              className="size-3.5 shrink-0 animate-spin text-emerald-400"
              aria-hidden
            />
          ) : (
            Math.round(consumed).toLocaleString()
          )}{" "}
          / {Math.round(target).toLocaleString()} kcal
        </div>
      </div>
    </div>
  );
}
