import { MISSING_GEMINI_API_KEY_ERROR } from "@/hooks/use-meal-scan-flow";
import { paths } from "@/lib/routes";
import { Link } from "@tanstack/react-router";

type MealScanErrorDialogProps = {
  error: string | null;
  onDismiss: () => void;
  className?: string;
};

function MealScanErrorMessage({ error }: { error: string }) {
  if (error !== MISSING_GEMINI_API_KEY_ERROR) return error;

  return (
    <>
      To estimate macros from a photo, add your Gemini API key in{" "}
      <Link
        to={paths.settings}
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2"
      >
        Settings
      </Link>
      .
    </>
  );
}

export function MealScanErrorDialog({
  error,
  onDismiss,
  className = "",
}: MealScanErrorDialogProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={`fixed bottom-[5.25rem] left-4 right-4 z-[55] ${className}`.trim()}
    >
      <div
        onClick={onDismiss}
        className="w-full cursor-pointer rounded-lg border border-red-500/50 bg-red-950/95 px-4 py-3 text-left text-sm text-red-200"
      >
        <MealScanErrorMessage error={error} />
      </div>
    </div>
  );
}
