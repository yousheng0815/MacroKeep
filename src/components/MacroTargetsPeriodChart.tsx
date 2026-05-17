import { Card } from "@/components/Card";
import {
  buildMacroDaySeries,
  intakeRatio,
  macroTargetForMetric,
  type MacroDayPoint,
  type MacroMetricKey,
} from "@/lib/macro-intake-by-period";
import type { MealRecord, UserProfile } from "@/types/records";
import { Loader2 } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Rolling 7-day window vs daily targets. */
const DAYS = 7;

const CHART_TITLE = "Past week";

const MACRO_CHART_METRICS: {
  key: MacroMetricKey;
  short: string;
  stroke: string;
}[] = [
  { key: "kcal", short: "Cal", stroke: "#38bdf8" },
  { key: "protein", short: "Protein", stroke: "#34d399" },
  { key: "fats", short: "Fat", stroke: "#fbbf24" },
  { key: "carbs", short: "Carbs", stroke: "#c084fc" },
];

/** Stable Y-scale: padding from highs in any macro, not only toggled-on lines. */
const ALL_MACRO_KEYS: ReadonlySet<MacroMetricKey> = new Set(
  MACRO_CHART_METRICS.map((m) => m.key),
);

/** Y-axis tops out at this fraction of daily target. */
const RATIO_CAP = 1.35;

/** Fixed viewBox width; height includes top pad for lines over 100% and bottom for x-axis labels. */
const VB_W = 320;

/** Fixed chart height — width stretches with layout via SVG scaling. */
const CHART_CSS_HEIGHT_PX = 220;

function macroVisibilityDefaults(): Record<MacroMetricKey, boolean> {
  return MACRO_CHART_METRICS.reduce(
    (acc, { key }) => {
      acc[key] = true;
      return acc;
    },
    {} as Record<MacroMetricKey, boolean>,
  );
}

type Props = {
  meals: MealRecord[];
  profile: UserProfile;
  loading: boolean;
  error: unknown;
  onRetry: () => void | Promise<unknown>;
};

type Pt = { x: number; y: number };

/** Linear interpolation between samples (straight segments). */
function linePathD(pts: Pt[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

/**
 * Smooth stroke through samples, monotone preserving in X (Fritsch–Carlson /
 * harmonic interior slopes → cubic Hermite mapped to Bézier). Avoids ugly
 * Catmull spikes on outliers.
 */
function linePathMonotonePchip(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (n === 2) return linePathD(pts);

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const h = xs.map((x, i) => (i < n - 1 ? xs[i + 1] - x : 0));
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const hi = h[i];
    deltas.push(hi !== 0 ? (ys[i + 1] - ys[i]) / hi : 0);
  }

  const m = new Array<number>(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const dk = deltas[k];
    const dkm = deltas[k - 1];
    if (dk === 0 || dkm === 0 || dk * dkm < 0) {
      m[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      m[k] = (w1 + w2) / (w1 / dkm + w2 / dk);
    }
  }
  m[0] = deltas[0] ?? 0;
  m[n - 1] = deltas[n - 2] ?? 0;

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let k = 0; k < n - 1; k++) {
    const seg = xs[k + 1] - xs[k];
    if (seg === 0) {
      d += ` L ${xs[k + 1]} ${ys[k + 1]}`;
      continue;
    }
    const mx1 = xs[k] + seg / 3;
    const my1 = ys[k] + (seg * m[k]) / 3;
    const mx2 = xs[k + 1] - seg / 3;
    const my2 = ys[k + 1] - (seg * m[k + 1]) / 3;
    d += ` C ${mx1} ${my1} ${mx2} ${my2} ${xs[k + 1]} ${ys[k + 1]}`;
  }
  return d;
}

function areaPathUnderLine(
  lineD: string,
  pts: Pt[],
  baselineY: number,
): string {
  if (pts.length === 0) return "";
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${lineD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function chartYpx(
  yInner: number,
  ch: number,
  vbHeight: number,
  vbPadTop: number,
): number {
  return ((yInner + vbPadTop) / vbHeight) * ch;
}

/** Largest intake/target ratio in the window (capped), across enabled metrics. */
function maxCappedRatioAcrossSeries(
  series: MacroDayPoint[],
  profile: UserProfile,
  cap: number,
  enabledKeys: ReadonlySet<MacroMetricKey>,
): number {
  let maxR = 0;
  for (const day of series) {
    for (const m of MACRO_CHART_METRICS) {
      if (!enabledKeys.has(m.key)) continue;
      const raw = day[m.key];
      const tgt = macroTargetForMetric(profile, m.key);
      const r = Math.min(cap, raw / Math.max(1, tgt));
      maxR = Math.max(maxR, r);
    }
  }
  return maxR;
}

function ChartBody({
  series,
  profile,
  enabledKeys,
}: {
  series: MacroDayPoint[];
  profile: UserProfile;
  enabledKeys: ReadonlySet<MacroMetricKey>;
}) {
  const clipId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotBox, setPlotBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setPlotBox({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartTop = 8;
  const chartBottom = 156;
  const chartH = chartBottom - chartTop;
  /** Include every macro so hiding a spike does not squash the vertical scale. */
  const maxRLayout = maxCappedRatioAcrossSeries(
    series,
    profile,
    RATIO_CAP,
    ALL_MACRO_KEYS,
  );
  /** Vertical space above the 100% line driven by tallest peak (any macro). */
  const dataClipPadTop = chartH * Math.max(0, maxRLayout - 1);
  /** Small bleed for stroke when any day is over target. */
  const clipPadTop =
    maxRLayout > 1 ? Math.max(dataClipPadTop, 2) : dataClipPadTop;
  /** ViewBox lift: clip area + a few px so strokes stay inside the viewport. */
  const vbPadTop = Math.max(4, Math.ceil(clipPadTop + 4));
  const xAxisLabelY = chartBottom + 11;
  const vbHeight = vbPadTop + xAxisLabelY + 12;

  const cw = plotBox.width > 0 ? plotBox.width : VB_W;
  const ch = plotBox.height > 0 ? plotBox.height : vbHeight;
  /** Matches proportional label sizing vs the nominal 320×vbHeight canvas. */
  const labelEm = Math.min(cw / VB_W, ch / vbHeight);

  /** X span for grid + clipped series — nearly full svg width minus % labels / micro pads. */
  const EDGE_PAD_RIGHT_PX = 2;
  const EDGE_PAD_LEFT_SVG_PX = 2;
  const LABEL_GAP_BEFORE_GRID_PX = 4;
  const pctFontPx = 10 * labelEm;
  /** Reserve for “100%” so anchors don’t crowd the grid stroke. */
  const pctLabelWidthApproxPx = pctFontPx * 3.14;
  const gridLeftPx = Math.ceil(
    EDGE_PAD_LEFT_SVG_PX + pctLabelWidthApproxPx + LABEL_GAP_BEFORE_GRID_PX,
  );
  const gridRightPx = Math.max(gridLeftPx + 40, cw - EDGE_PAD_RIGHT_PX);

  const markerR = Math.min(4.25, Math.max(2.75, cw / 110));
  const strokeW = Math.min(3.25, Math.max(2.25, cw / 200));
  /** Horizontal clip bleed keeps dot/spline tails inside svg without large plotInset. */
  const clipBleedXPx = Math.min(
    Math.ceil(markerR + strokeW / 2 + 2),
    Math.max(0, gridLeftPx - 10),
  );
  const clipBleedXR = Math.ceil(markerR + strokeW / 2 + 2);
  const markerVerticalBleedPx = markerR + strokeW / 2 + 2.25;
  /** Tight inward band on the plot; horizontal clip bleed covers marker overhang.
   * Slightly wider on the left so day-1 discs don’t visually crowd the %-axis/grid. */
  const plotInsetPx = Math.max(1.5, markerR * 0.35 + strokeW * 0.45);
  const plotInsetLeftPx = plotInsetPx + Math.max(5, Math.ceil(cw * 0.014));
  const plotInsetRightPx = plotInsetPx;
  const plotLeftPx = gridLeftPx + plotInsetLeftPx;
  const plotRightPx = gridRightPx - plotInsetRightPx;
  const spanX = Math.max(0, plotRightPx - plotLeftPx);

  const n = series.length;
  const xAtPixel = (i: number): number => {
    if (spanX <= 0) return (gridLeftPx + gridRightPx) / 2;
    if (n <= 0) return plotLeftPx + spanX / 2;
    if (n === 1) return plotLeftPx + spanX / 2;
    return plotLeftPx + (i / (n - 1)) * spanX;
  };

  const labelAnchorXPx = gridLeftPx - LABEL_GAP_BEFORE_GRID_PX;

  const y100 = chartTop;

  const baselineY = chartYpx(chartBottom, ch, vbHeight, vbPadTop);

  const metricPaths = MACRO_CHART_METRICS.filter((m) =>
    enabledKeys.has(m.key),
  ).map((m) => {
    const pts = series.map((day, i) => {
      const raw = day[m.key];
      const tgt = macroTargetForMetric(profile, m.key);
      const r = intakeRatio(raw, tgt, RATIO_CAP);
      const x = xAtPixel(i);
      const y = chartBottom - r * chartH;
      return { x, y, raw, tgt, day };
    });
    const pixelPts = pts.map(({ x, y }) => ({
      x,
      y: chartYpx(y, ch, vbHeight, vbPadTop),
    }));
    const d = linePathMonotonePchip(pixelPts);
    const fillD = areaPathUnderLine(d, pixelPts, baselineY);
    const unit = m.key === "kcal" ? " kcal" : " g";
    const title =
      `${m.short}: ` +
      pts
        .map(
          ({ day, raw, tgt }) =>
            `${day.label} ${Math.round(raw)}/${Math.round(tgt)}${unit}`,
        )
        .join(" · ");
    return {
      m,
      d,
      fillD,
      pixelPts,
      title,
    };
  });

  const ysClipRawTop = chartYpx(chartTop - clipPadTop, ch, vbHeight, vbPadTop);
  const ysClipRawBot = chartYpx(chartBottom, ch, vbHeight, vbPadTop);
  const clipRight = gridRightPx + clipBleedXR;
  const clipX = Math.max(0, gridLeftPx - clipBleedXPx);
  const clipY = ysClipRawTop - markerVerticalBleedPx;
  const clipW = clipRight - clipX;
  const clipH = ysClipRawBot - ysClipRawTop + markerVerticalBleedPx * 2;

  return (
    <div
      ref={containerRef}
      className="w-full min-h-0 md:mx-auto md:max-w-2xl"
      style={{ height: CHART_CSS_HEIGHT_PX }}
    >
      <svg
        className="block h-full w-full"
        viewBox={`0 0 ${cw} ${ch}`}
        role="img"
        shapeRendering="auto"
        aria-label="Past week: intake compared to macro targets by day."
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={clipX} y={clipY} width={clipW} height={clipH} rx="4" />
          </clipPath>
        </defs>

        <line
          x1={gridLeftPx}
          x2={gridRightPx}
          y1={chartYpx(y100, ch, vbHeight, vbPadTop)}
          y2={chartYpx(y100, ch, vbHeight, vbPadTop)}
          className="stroke-zinc-600"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        <line
          x1={gridLeftPx}
          x2={gridRightPx}
          y1={chartYpx(chartTop + chartH * 0.5, ch, vbHeight, vbPadTop)}
          y2={chartYpx(chartTop + chartH * 0.5, ch, vbHeight, vbPadTop)}
          className="stroke-zinc-800"
          strokeWidth={1}
        />

        <line
          x1={gridLeftPx}
          x2={gridRightPx}
          y1={chartYpx(chartBottom, ch, vbHeight, vbPadTop)}
          y2={chartYpx(chartBottom, ch, vbHeight, vbPadTop)}
          className="stroke-zinc-700"
          strokeWidth={1}
        />

        <g clipPath={`url(#${clipId})`}>
          {metricPaths.map(({ m, fillD, title }) => (
            <path
              key={`${m.key}-fill`}
              d={fillD}
              fill={m.stroke}
              fillOpacity={0.11}
              stroke="none"
            >
              <title>{title}</title>
            </path>
          ))}
          {metricPaths.map(({ m, d, title }) => (
            <path
              key={m.key}
              d={d}
              fill="none"
              stroke={m.stroke}
              strokeWidth={strokeW}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="opacity-95"
            >
              <title>{title}</title>
            </path>
          ))}
          {metricPaths.map(({ m, pixelPts }) =>
            pixelPts.map((pt, i) => (
              <circle
                key={`${m.key}-${series[i]?.dayStartMs ?? i}`}
                cx={pt.x}
                cy={pt.y}
                r={markerR}
                fill={m.stroke}
                stroke="#18181b"
                strokeWidth={1.25}
                className="opacity-95"
                aria-hidden
              />
            )),
          )}
        </g>

        <text
          x={labelAnchorXPx}
          y={chartYpx(y100 + 4, ch, vbHeight, vbPadTop)}
          textAnchor="end"
          className="fill-zinc-500"
          style={{ fontSize: pctFontPx }}
        >
          100%
        </text>

        <text
          x={labelAnchorXPx}
          y={chartYpx(chartTop + chartH * 0.5 + 4, ch, vbHeight, vbPadTop)}
          textAnchor="end"
          className="fill-zinc-500"
          style={{ fontSize: pctFontPx }}
        >
          50%
        </text>

        <text
          x={labelAnchorXPx}
          y={chartYpx(chartBottom + 4, ch, vbHeight, vbPadTop)}
          textAnchor="end"
          className="fill-zinc-500"
          style={{ fontSize: pctFontPx }}
        >
          0
        </text>

        {series.map((day, i) => {
          const short = new Date(day.dayStartMs).toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          });
          return (
            <text
              key={day.dayStartMs}
              x={xAtPixel(i)}
              y={chartYpx(xAxisLabelY, ch, vbHeight, vbPadTop)}
              textAnchor="middle"
              dominantBaseline="hanging"
              className="fill-zinc-500"
              style={{ fontSize: 9 * labelEm }}
            >
              {short}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function MacroTargetsPeriodChart({
  meals,
  profile,
  loading,
  error,
  onRetry,
}: Props) {
  const [retryPending, setRetryPending] = useState(false);
  const [macroShown, setMacroShown] = useState<Record<MacroMetricKey, boolean>>(
    () => macroVisibilityDefaults(),
  );

  const series = useMemo(() => buildMacroDaySeries(meals, DAYS), [meals]);

  const enabledKeys = useMemo(
    () =>
      new Set(
        MACRO_CHART_METRICS.filter(({ key }) => macroShown[key]).map(
          (m) => m.key,
        ),
      ),
    [macroShown],
  );

  if (loading) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-white">{CHART_TITLE}</h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-12">
          <Loader2
            className="size-8 animate-spin text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-mk-muted">Loading meals…</p>
        </div>
      </Card>
    );
  }

  if (error) {
    const msg =
      error instanceof Error
        ? error.message
        : "Could not load meals from Drive.";
    return (
      <Card>
        <h2 className="text-sm font-semibold text-white">{CHART_TITLE}</h2>
        <div className="mt-4 flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-red-300">{msg}</p>
          <button
            type="button"
            disabled={retryPending}
            aria-busy={retryPending}
            onClick={() =>
              void (async () => {
                setRetryPending(true);
                try {
                  await onRetry();
                } finally {
                  setRetryPending(false);
                }
              })()
            }
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">{CHART_TITLE}</h2>

      <div className="mt-3 flex w-full flex-col gap-4 md:mt-4 md:flex-row md:items-start md:gap-8">
        <div className="order-2 min-w-0 flex-1 md:order-1">
          <ChartBody
            series={series}
            profile={profile}
            enabledKeys={enabledKeys}
          />
        </div>
        <div
          className="order-1 flex w-full shrink-0 flex-wrap gap-2 md:order-2 md:w-auto md:min-w-[7.5rem] md:flex-col md:flex-nowrap md:gap-3"
          role="group"
          aria-label="Macros shown on chart"
        >
          {MACRO_CHART_METRICS.map((m) => {
            const pressed = macroShown[m.key];
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={pressed}
                onClick={() =>
                  setMacroShown((prev) => ({ ...prev, [m.key]: !prev[m.key] }))
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition md:w-full ${
                  pressed
                    ? "border-zinc-600 bg-zinc-800/90 text-white"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                }`}
              >
                <span
                  className="size-2 shrink-0 rounded-full opacity-95 ring-1 ring-white/10 md:size-2.5"
                  style={{ backgroundColor: m.stroke }}
                  aria-hidden
                />
                <span>{m.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
