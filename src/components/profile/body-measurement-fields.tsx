import { totalInchesFromFeetInches } from "@/lib/units";
import type { UnitsPreference } from "@/types/records";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";

/** Parse digits-only text (non-digits stripped). Empty → 0. */
function intFromDigitsOnly(raw: string): number {
  const d = raw.replace(/\D/g, "");
  if (d === "") return 0;
  const n = Number.parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Block `.`, `e`, signs, etc.; allow navigation and shortcuts. */
function blockNonDigitKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.nativeEvent.isComposing) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length !== 1) return;
  if (/\d/.test(e.key)) return;
  e.preventDefault();
}

/** Reject pastes that are not a plain unsigned integer string. */
function blockInvalidIntPaste(e: ClipboardEvent<HTMLInputElement>): void {
  const text = e.clipboardData.getData("text/plain").trim();
  if (text === "") return;
  if (!/^\d+$/.test(text)) e.preventDefault();
}

/** Imperial ft/in: inches may exceed 11; we only resync from `height` when totals disagree. */
function ImperialHeightRow({
  height,
  weight,
  onChange,
  disabled,
}: {
  height: number;
  weight: number;
  onChange: (next: { height: number; weight: number }) => void;
  disabled?: boolean;
}) {
  const totalIn = Math.round(height);
  const [pair, setPair] = useState(() => ({
    feet: Math.floor(totalIn / 12),
    inches: totalIn % 12,
  }));

  useEffect(() => {
    setPair((prev) => {
      if (prev.feet * 12 + prev.inches === totalIn) return prev;
      return {
        feet: Math.floor(totalIn / 12),
        inches: totalIn % 12,
      };
    });
  }, [totalIn]);

  const { feet, inches } = pair;
  const lb = Math.round(weight);

  return (
    <>
      <div className="block text-sm text-zinc-400 sm:col-span-2">
        <span className="block">Height</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={disabled}
            aria-label="Height feet"
            value={String(feet)}
            onKeyDown={blockNonDigitKeyDown}
            onPaste={blockInvalidIntPaste}
            onChange={(e) => {
              const nextFeet = intFromDigitsOnly(e.target.value);
              const next = { feet: nextFeet, inches };
              setPair(next);
              onChange({
                height: totalInchesFromFeetInches(next.feet, next.inches),
                weight,
              });
            }}
            className="w-20 rounded-xl border border-om-border bg-om-bg px-3 py-3 text-base text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
          />
          <span className="text-zinc-500">ft</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={disabled}
            aria-label="Height inches"
            value={String(inches)}
            onKeyDown={blockNonDigitKeyDown}
            onPaste={blockInvalidIntPaste}
            onChange={(e) => {
              const nextIn = intFromDigitsOnly(e.target.value);
              const next = { feet, inches: nextIn };
              setPair(next);
              onChange({
                height: totalInchesFromFeetInches(next.feet, next.inches),
                weight,
              });
            }}
            className="w-24 rounded-xl border border-om-border bg-om-bg px-3 py-3 text-base text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
          />
          <span className="text-zinc-500">in</span>
        </div>
      </div>
      <label className="block text-sm text-zinc-400">
        Weight (lb)
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          disabled={disabled}
          value={String(lb)}
          onKeyDown={blockNonDigitKeyDown}
          onPaste={blockInvalidIntPaste}
          onChange={(e) =>
            onChange({
              height,
              weight: intFromDigitsOnly(e.target.value),
            })
          }
          className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
        />
      </label>
    </>
  );
}

export function UnitsPreferenceSegment({
  value,
  onChange,
  disabled,
  id,
}: {
  value: UnitsPreference;
  onChange: (next: UnitsPreference) => void;
  disabled?: boolean;
  /** Optional id prefix for `aria-controls` / labels. */
  id?: string;
}) {
  const baseId = id ?? "units-pref";
  return (
    <div
      role="radiogroup"
      aria-label="Units for height and weight"
      className="mt-2 flex rounded-xl border border-om-border p-1"
    >
      {(
        [
          { v: "metric" as const, label: "Metric (cm, kg)" },
          { v: "imperial" as const, label: "Imperial (ft, lb)" },
        ] as const
      ).map(({ v, label }) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            id={`${baseId}-${v}`}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              selected
                ? "bg-zinc-100 text-black"
                : "text-zinc-400 hover:text-zinc-200"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function HeightWeightFields({
  units,
  height,
  weight,
  onChange,
  disabled,
}: {
  units: UnitsPreference;
  height: number;
  weight: number;
  onChange: (next: { height: number; weight: number }) => void;
  disabled?: boolean;
}) {
  if (units === "metric") {
    return (
      <>
        <label className="block text-sm text-zinc-400">
          Height (cm)
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={disabled}
            value={String(Math.round(height))}
            onKeyDown={blockNonDigitKeyDown}
            onPaste={blockInvalidIntPaste}
            onChange={(e) =>
              onChange({
                height: intFromDigitsOnly(e.target.value),
                weight,
              })
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Weight (kg)
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={disabled}
            value={String(Math.round(weight))}
            onKeyDown={blockNonDigitKeyDown}
            onPaste={blockInvalidIntPaste}
            onChange={(e) =>
              onChange({
                height,
                weight: intFromDigitsOnly(e.target.value),
              })
            }
            className="mt-1 w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
          />
        </label>
      </>
    );
  }

  return (
    <ImperialHeightRow
      height={height}
      weight={weight}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
