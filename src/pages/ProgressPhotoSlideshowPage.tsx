import { ButtonSpinner } from "@/components/ButtonSpinner";
import { PageHeader } from "@/components/PageHeader";
import { ProgressPhotoSlideshowViewer } from "@/components/progress-photos/ProgressPhotoSlideshowViewer";
import { useProgressPhotos } from "@/hooks/use-progress-photos";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "@/lib/app-toast";

export function ProgressPhotoSlideshowPage() {
  const navigate = useNavigate();
  const { photos, loading, allBlobsLoaded, error } = useProgressPhotos({
    continuousBlobFetch: true,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const goBack = () => {
    void navigate({ to: "/progress" });
  };

  if (loading) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title="Play back"
          backTo="/progress"
          backAriaLabel="Back to Progress"
        />
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-zinc-400">
          <ButtonSpinner />
          <p className="text-sm">Loading library…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title="Play back"
          backTo="/progress"
          backAriaLabel="Back to Progress"
        />
        <div className="space-y-4 py-8 text-center">
          <p className="text-sm text-zinc-400">
            Couldn&apos;t load progress photos. Check the notification for
            details.
          </p>
          <button
            type="button"
            onClick={goBack}
            className="btn-mobile-block-lg rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            Back to Progress
          </button>
        </div>
      </div>
    );
  }

  if (photos.length < 2) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title="Play back"
          backTo="/progress"
          backAriaLabel="Back to Progress"
        />
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <p className="max-w-sm text-sm text-zinc-400">
            Add at least two progress photos to watch a playback across time.
          </p>
          <button
            type="button"
            onClick={goBack}
            className="btn-mobile-block-lg rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Back to Progress
          </button>
        </div>
      </div>
    );
  }

  if (!allBlobsLoaded) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title="Play back"
          backTo="/progress"
          backAriaLabel="Back to Progress"
        />
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-zinc-400">
          <ButtonSpinner />
          <p className="text-sm">Loading images…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <PageHeader
        title="Play back"
        backTo="/progress"
        backAriaLabel="Back to Progress"
      />
      <div className="min-h-0 flex-1">
        <ProgressPhotoSlideshowViewer photos={photos} onClose={goBack} />
      </div>
    </div>
  );
}
