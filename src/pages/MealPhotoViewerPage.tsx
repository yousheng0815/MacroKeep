import { MealPhotoViewerScreen } from "@/components/MealPhotoViewerScreen";
import type { MealPhotoViewerState } from "@/lib/routes";
import { paths } from "@/lib/routes";
import { mealPhotoRoute } from "@/router";
import {
  Navigate,
  useNavigate,
  useParams,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useRef } from "react";

export function MealPhotoViewerPage() {
  const photoFileId = useParams({
    from: mealPhotoRoute.id,
    shouldThrow: false,
  })?.photoFileId;
  const mealPhoto = useRouterState({
    select: (s) => s.location.state?.mealPhoto as MealPhotoViewerState | undefined,
  });
  const navigate = useNavigate();
  const router = useRouter();
  const dismissingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    const returnTo = mealPhoto?.returnTo;
    if (returnTo) {
      void navigate({ to: returnTo });
      return;
    }
    void navigate({ to: paths.home });
  }, [mealPhoto?.returnTo, navigate, router.history]);

  const fallbackTo = mealPhoto?.returnTo ?? paths.home;

  if (!photoFileId) {
    return <Navigate to={fallbackTo} replace />;
  }

  return (
    <MealPhotoViewerScreen
      photoFileId={photoFileId}
      alt={mealPhoto?.alt ?? ""}
      cachePolicy={mealPhoto?.cachePolicy}
      onDismiss={dismiss}
    />
  );
}
