import type { ExternalToast } from "sonner";
import { toast as sonnerToast } from "sonner";

type ToastTitle = Parameters<typeof sonnerToast>[0];

type DurationPreset = {
  baseMs: number;
  perCharMs: number;
  minMs: number;
  maxMs: number;
};

/** Short confirmations: stay quick, scale up for longer titles/descriptions. */
const SUCCESS_DURATION: DurationPreset = {
  baseMs: 750,
  perCharMs: 40,
  minMs: 1500,
  maxMs: 4000,
};

/** Errors and warnings: longer floor, scale aggressively for API-style messages. */
const ERRORLIKE_DURATION: DurationPreset = {
  baseMs: 2600,
  perCharMs: 40,
  minMs: 4000,
  maxMs: 15000,
};

/** Default / info / neutral: near Sonner’s 4s default, with headroom for longer copy. */
const NEUTRAL_DURATION: DurationPreset = {
  baseMs: 2000,
  perCharMs: 40,
  minMs: 4000,
  maxMs: 15000,
};

function appendPlainTextLength(acc: number, value: unknown): number {
  if (typeof value === "string") return acc + value.length;
  if (typeof value === "number" || typeof value === "boolean")
    return acc + String(value).length;
  if (value instanceof Error) return acc + value.message.length;
  return acc;
}

function measuredTitleAndDescriptionLength(
  title: ToastTitle,
  data?: ExternalToast,
): number {
  let len = 0;
  if (typeof title !== "function") {
    len = appendPlainTextLength(len, title);
  }
  const desc = data?.description;
  if (typeof desc !== "function" && desc !== undefined) {
    len = appendPlainTextLength(len, desc);
  }
  return len;
}

function durationFromMeasuredLength(
  length: number,
  preset: DurationPreset,
): number {
  const raw = preset.baseMs + length * preset.perCharMs;
  return Math.min(preset.maxMs, Math.max(preset.minMs, Math.round(raw)));
}

function withAdaptiveDuration(
  method: (message: ToastTitle, data?: ExternalToast) => string | number,
  preset: DurationPreset,
) {
  return (message: ToastTitle, data?: ExternalToast) => {
    const length = measuredTitleAndDescriptionLength(message, data);
    return method(message, {
      ...data,
      duration: data?.duration ?? durationFromMeasuredLength(length, preset),
    });
  };
}

/**
 * Same API as `sonner`. Defaults `duration` from title + description text length
 * (plain strings, numbers, booleans, and `Error` only). Pass `duration` to override.
 * `loading`, `promise`, and `custom` are unchanged from Sonner.
 */
export const toast = Object.assign(
  (message: ToastTitle, data?: ExternalToast) => {
    const length = measuredTitleAndDescriptionLength(message, data);
    return sonnerToast(message, {
      ...data,
      duration:
        data?.duration ?? durationFromMeasuredLength(length, NEUTRAL_DURATION),
    });
  },
  {
    ...sonnerToast,
    success: withAdaptiveDuration(sonnerToast.success, SUCCESS_DURATION),
    error: withAdaptiveDuration(sonnerToast.error, ERRORLIKE_DURATION),
    warning: withAdaptiveDuration(sonnerToast.warning, ERRORLIKE_DURATION),
    info: withAdaptiveDuration(sonnerToast.info, NEUTRAL_DURATION),
    message: withAdaptiveDuration(sonnerToast.message, NEUTRAL_DURATION),
  },
) as typeof sonnerToast;
