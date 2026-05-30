import { MealPhotoThumb } from "@/components/MealPhotoThumb";
import { useDrivePhotoUrl } from "@/hooks/use-drive-photo-url";
import type { MealPhotoCachePolicy } from "@/lib/meal-photo-cache";
import {
  comboThumbClassName,
  COMBO_ROW_PHOTO_CLASS,
} from "@/lib/combo-photo-collage";
import { comboItemPhotoFileIds } from "@/lib/saved-combo-utils";
import type { SavedComboRecord, SavedQuickAdd } from "@/types/records";

export { COMBO_ROW_PHOTO_CLASS };

type ComboPhotoThumbProps = {
  combo: SavedComboRecord;
  allItems: readonly SavedQuickAdd[];
  alt: string;
  className?: string;
};

function CollageCell({
  photoFileId,
  cachePolicy,
}: {
  photoFileId: string;
  cachePolicy: MealPhotoCachePolicy;
}) {
  const src = useDrivePhotoUrl(photoFileId, cachePolicy);
  if (!src) {
    return <div className="size-full animate-pulse bg-zinc-800" aria-hidden />;
  }
  return (
    <img
      src={src}
      alt=""
      className="size-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
}

function CollageThumb({
  photoFileIds,
  alt,
  className,
}: {
  photoFileIds: string[];
  alt: string;
  className: string;
}) {
  const cachePolicy = { tier: "saved" as const };
  const shell = comboThumbClassName(className);

  if (photoFileIds.length === 0) {
    return (
      <MealPhotoThumb
        alt={alt}
        enlargeOnClick={false}
        cachePolicy={cachePolicy}
        className={shell}
      />
    );
  }

  if (photoFileIds.length === 1) {
    return (
      <MealPhotoThumb
        photoFileId={photoFileIds[0]}
        alt={alt}
        enlargeOnClick={false}
        cachePolicy={cachePolicy}
        className={shell}
      />
    );
  }

  const ids = photoFileIds.slice(0, 4);
  const extra = photoFileIds.length - 4;

  let gridClass = "grid h-full w-full gap-px bg-zinc-900";
  if (photoFileIds.length === 2) {
    gridClass += " grid-cols-2 grid-rows-1";
  } else {
    gridClass += " grid-cols-2 grid-rows-2";
  }

  return (
    <div className={`relative ${shell}`}>
      <div className={gridClass}>
        {ids.map((id, index) => (
          <div
            key={`${id}-${index}`}
            className={`relative min-h-0 min-w-0 overflow-hidden ${
              photoFileIds.length === 3 && index === 0 ? "row-span-2" : ""
            }`}
          >
            <CollageCell photoFileId={id} cachePolicy={cachePolicy} />
          </div>
        ))}
      </div>
      {extra > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-1">
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            +{extra}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ComboPhotoThumb({
  combo,
  allItems,
  alt,
  className = COMBO_ROW_PHOTO_CLASS,
}: ComboPhotoThumbProps) {
  const cachePolicy = { tier: "saved" as const };
  const shell = comboThumbClassName(className);

  if (combo.photoFileId) {
    return (
      <MealPhotoThumb
        photoFileId={combo.photoFileId}
        alt={alt}
        enlargeOnClick={false}
        cachePolicy={cachePolicy}
        className={shell}
      />
    );
  }

  const photoFileIds = comboItemPhotoFileIds(combo, allItems);
  return (
    <CollageThumb photoFileIds={photoFileIds} alt={alt} className={className} />
  );
}
