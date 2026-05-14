import { toast as sonnerToast } from "sonner";

const SUCCESS_TOAST_DURATION_MS = 1500;

/**
 * Same API as `sonner`; `toast.success` uses a shorter default `duration` so
 * success feedback auto-dismisses quickly. Pass `duration` to override.
 */
export const toast = {
  ...sonnerToast,
  success: (
    message: Parameters<typeof sonnerToast.success>[0],
    data?: Parameters<typeof sonnerToast.success>[1],
  ) =>
    sonnerToast.success(message, {
      ...data,
      duration: data?.duration ?? SUCCESS_TOAST_DURATION_MS,
    }),
} as typeof sonnerToast;
