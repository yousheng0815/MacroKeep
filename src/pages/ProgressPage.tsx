import { ProgressPhotosSection } from "@/components/progress-photos/ProgressPhotosSection";
import { PageHeader } from "@/components/PageHeader";

export function ProgressPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Progress"
        subtitle="Track your progress photos."
      />
      <ProgressPhotosSection />
    </div>
  );
}
