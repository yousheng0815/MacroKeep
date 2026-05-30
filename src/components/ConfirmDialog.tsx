import { ButtonPendingContents, ButtonSpinner } from "@/components/ButtonSpinner";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={cancelLabel}
        onClick={onCancel}
        disabled={pending}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-mk-border bg-mk-surface shadow-xl">
        <div className="space-y-3 px-4 py-4">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <div className="text-sm text-mk-muted">{description}</div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-mk-border px-4 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-mk-border bg-mk-bg px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
            className="relative rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ButtonPendingContents
              pending={pending}
              spinner={<ButtonSpinner className="text-black" />}
            >
              {confirmLabel}
            </ButtonPendingContents>
          </button>
        </div>
      </div>
    </div>
  );
}
