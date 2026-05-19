import { ButtonSpinner } from "@/components/ButtonSpinner";
import { PageHeader } from "@/components/PageHeader";
import { ProgressPhotoSlideshowViewer } from "@/components/progress-photos/ProgressPhotoSlideshowViewer";
import { useProgressPhotos } from "@/hooks/use-progress-photos";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/app-toast";

export function ProgressPhotoSlideshowPage() {
  const { t } = useTranslation();
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
          title={t("progress.slideshowTitle")}
          backTo="/progress"
          backAriaLabel={t("progress.backToProgress")}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-zinc-400">
          <ButtonSpinner />
          <p className="text-sm">{t("progress.loadingLibrary")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title={t("progress.slideshowTitle")}
          backTo="/progress"
          backAriaLabel={t("progress.backToProgress")}
        />
        <div className="space-y-4 py-8 text-center">
          <p className="text-sm text-zinc-400">
            {t("progress.couldntOpenPhoto")}
          </p>
          <button
            type="button"
            onClick={goBack}
            className="btn-mobile-block-lg rounded-xl border border-mk-border bg-mk-bg px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            {t("progress.backToProgress")}
          </button>
        </div>
      </div>
    );
  }

  if (photos.length < 2) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title={t("progress.slideshowTitle")}
          backTo="/progress"
          backAriaLabel={t("progress.backToProgress")}
        />
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <p className="max-w-sm text-sm text-zinc-400">
            {t("progress.slideshowNeedTwo")}
          </p>
          <button
            type="button"
            onClick={goBack}
            className="btn-mobile-block-lg rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            {t("progress.backToProgress")}
          </button>
        </div>
      </div>
    );
  }

  if (!allBlobsLoaded) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title={t("progress.slideshowTitle")}
          backTo="/progress"
          backAriaLabel={t("progress.backToProgress")}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-zinc-400">
          <ButtonSpinner />
          <p className="text-sm">{t("progress.loadingImages")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      <PageHeader
        title={t("progress.slideshowTitle")}
        backTo="/progress"
        backAriaLabel={t("progress.backToProgress")}
      />
      <div className="min-h-0 flex-1">
        <ProgressPhotoSlideshowViewer photos={photos} onClose={goBack} />
      </div>
    </div>
  );
}
