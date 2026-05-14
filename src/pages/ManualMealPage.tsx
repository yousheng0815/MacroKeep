import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Card } from "@/components/Card";
import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { PageHeader } from "@/components/PageHeader";
import { useRecords } from "@/hooks/use-records";
import { fileToBase64 } from "@/lib/file-to-base64";
import { paths } from "@/lib/routes";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalDateTimeInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ManualMealPage() {
  const navigate = useNavigate();
  const { addMeal } = useRecords();
  const [savePending, setSavePending] = useState(false);
  const [photoChoice, setPhotoChoice] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = useCallback(
    (files: FileList | null, input?: HTMLInputElement | null) => {
      const file = files?.[0];
      if (input) input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setPhotoInputKey((k) => k + 1);
      setPhotoChoice((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (photoChoice?.previewUrl) URL.revokeObjectURL(photoChoice.previewUrl);
    };
  }, [photoChoice?.previewUrl]);

  const nowLocal = toLocalDateTimeInput(new Date().toISOString());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add manually"
        backTo={paths.add.root}
        backAriaLabel="Back to add meal"
        subtitle="Enter macros yourself. Optionally attach a photo saved with the meal."
      />

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const form = new FormData(e.currentTarget);
              const foodName = String(form.get("foodName") ?? "").trim();
              if (!foodName) {
                toast.error("Enter a food name.");
                return;
              }
              const calories = String(form.get("calories") ?? "0");
              const protein = String(form.get("protein") ?? "0");
              const fats = String(form.get("fats") ?? "0");
              const carbs = String(form.get("carbs") ?? "0");
              const recordedAtLocal = String(form.get("recordedAt") ?? "");
              setSavePending(true);
              try {
                const photoOpts = photoChoice
                  ? {
                      photo: await fileToBase64(photoChoice.file),
                    }
                  : undefined;
                const mealId = await addMeal(
                  {
                    food_name: foodName,
                    calories: parseNumber(calories),
                    protein: parseNumber(protein),
                    fats: parseNumber(fats),
                    carbs: parseNumber(carbs),
                    recordedAt: toIsoFromLocalDateTimeInput(recordedAtLocal),
                  },
                  photoOpts,
                );
                toast.success("Meal saved");
                await navigate({
                  to: paths.mealDetail,
                  params: { mealId },
                  state: { navFrom: paths.add.root },
                  replace: true,
                });
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not add meal.",
                );
              } finally {
                setSavePending(false);
              }
            })();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-om-muted">
              Food name
            </span>
            <input
              name="foodName"
              type="text"
              autoComplete="off"
              placeholder="e.g. Chicken salad"
              className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-om-muted">
              Recorded at
            </span>
            <input
              name="recordedAt"
              type="datetime-local"
              defaultValue={nowLocal}
              className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
            />
          </label>

          <div className="space-y-2">
            <span className="block text-sm text-om-muted">Photo (optional)</span>
            <input
              key={`cam-${photoInputKey}`}
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
            />
            <input
              key={`lib-${photoInputKey}`}
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files, e.currentTarget)}
            />
            <div className="flex items-start gap-3 rounded-xl border border-om-border bg-om-bg p-3 md:items-center md:gap-5 md:p-4">
              <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-zinc-700 md:size-32">
                {photoChoice ? (
                  <img
                    src={photoChoice.previewUrl}
                    alt="Meal photo preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <MealPhotoThumb
                    alt="No meal photo yet — use Take photo or Upload to add one"
                    className="size-full shrink-0 overflow-hidden rounded-lg border-0 bg-zinc-800/80"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-none md:flex-row md:flex-wrap md:gap-3">
                <button
                  type="button"
                  disabled={savePending}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[11rem]"
                >
                  <Camera className="size-4 text-emerald-400 md:size-5" />
                  {photoChoice ? "Retake photo" : "Take photo"}
                </button>
                <button
                  type="button"
                  disabled={savePending}
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-om-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60 md:w-auto md:min-w-[11rem]"
                >
                  <ImagePlus className="size-4 text-orange-500 md:size-5" />
                  {photoChoice ? "Replace from library" : "Upload from library"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-om-muted">
                Calories
              </span>
              <input
                name="calories"
                type="number"
                inputMode="decimal"
                step="1"
                defaultValue={0}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-om-muted">
                Protein (g)
              </span>
              <input
                name="protein"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-om-muted">Fats (g)</span>
              <input
                name="fats"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-om-muted">
                Carbs (g)
              </span>
              <input
                name="carbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={0}
                className="w-full rounded-xl border border-om-border bg-om-bg px-4 py-3 text-base text-zinc-100 outline-none ring-0 ring-inset ring-emerald-500 transition focus:ring-2"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={savePending}
            aria-busy={savePending}
            className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ButtonPendingContents
              pending={savePending}
              spinner={<ButtonSpinner />}
            >
              Save meal
            </ButtonPendingContents>
          </button>
        </form>
      </Card>
    </div>
  );
}
