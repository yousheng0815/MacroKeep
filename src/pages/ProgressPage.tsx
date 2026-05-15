import { MacroTargetsPeriodChart } from "@/components/MacroTargetsPeriodChart";
import { ProgressPhotosSection } from "@/components/progress-photos/ProgressPhotosSection";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";

export function ProgressPage() {
  const {
    records,
    isLoading,
    isMealsLoading,
    error,
    mealsError,
    refetch,
  } = useRecords();

  const chartLoading = isLoading || isMealsLoading;
  const chartError = error ?? mealsError;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Progress"
        subtitle="Track macros and progress photos."
      />
      <MacroTargetsPeriodChart
        meals={records.meals}
        profile={records.profile}
        loading={chartLoading}
        error={chartError}
        onRetry={refetch}
      />
      <ProgressPhotosSection />
    </div>
  );
}
