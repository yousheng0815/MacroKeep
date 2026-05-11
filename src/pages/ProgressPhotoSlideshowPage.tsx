import { ButtonSpinner } from "@/components/ButtonSpinner";
import { PageHeader } from "@/components/PageHeader";
import { ProgressPhotoSlideshowViewer } from "@/components/progress-photos/ProgressPhotoSlideshowViewer";
import { useProgressPhotos } from "@/hooks/use-progress-photos";
import { useNavigate } from "@tanstack/react-router";

export function ProgressPhotoSlideshowPage() {
  const navigate = useNavigate();
  const { photos, loading, allBlobsLoaded, error } = useProgressPhotos({
    continuousBlobFetch: true,
  });

  const goBack = () => {
    void navigate({ to: "/progress" });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Play back"
          backTo="/progress"
          backAriaLabel="Back to Progress"
        />
        <div className="space-y-4 py-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={goBack}
            className="mx-auto inline-flex rounded-xl border border-om-border bg-om-bg px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Back to Progress
          </button>
        </div>
      </div>
    );
  }

  if (photos.length < 2) {
    return (
      <div className="flex flex-col gap-4">
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
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Back to Progress
          </button>
        </div>
      </div>
    );
  }

  if (!allBlobsLoaded) {
    return (
      <div className="flex flex-col gap-4">
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
    <div className="flex min-h-0 flex-col gap-4">
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
