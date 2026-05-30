import type { MealPhotoCachePolicy } from "@/lib/meal-photo-cache";

/** Canonical app paths — use for links, redirects, and nav highlighting. */
export const paths = {
  login: "/login",
  home: "/",
  history: "/history",
  mealDetail: "/meals/$mealId",
  mealEdit: "/meals/$mealId/edit",
  mealPhoto: "/photos/$photoFileId",
  add: {
    root: "/add",
    savedMeals: "/add/saved-meals",
    savedMealsManage: "/add/saved-meals/manage",
    savedMealNew: "/add/saved-meals/new",
    savedMealEdit: "/add/saved-meals/$savedMealId/edit",
    savedComboNew: "/add/saved-meals/combo/new",
    savedComboEdit: "/add/saved-meals/combo/$comboId/edit",
    comboAddSavedMeals: "/add/saved-meals/combo/items/saved",
    comboAddInlineItem: "/add/saved-meals/combo/items/inline",
    history: "/add/history",
    describe: "/add/describe",
    manual: "/add/manual",
  },
  progress: {
    root: "/progress",
    capture: "/progress/photos/new",
    photo: "/progress/photos/$photoId",
    slideshow: "/progress/photos/slideshow",
  },
  drive: {
    root: "/drive",
    file: "/drive/files/$fileId",
  },
  settings: "/settings",
  tutorial: "/tutorial",
} as const;

export const NAV_TAB_PATHS = [
  paths.home,
  paths.history,
  paths.add.root,
  paths.progress.root,
] as const;

export type NavTabPath = (typeof NAV_TAB_PATHS)[number];

/** Shell nav highlight when viewing `/meals/:id`. */
export type MealDetailNavFrom = NavTabPath;

/** Location state when opening `/photos/:photoFileId`. */
export type MealPhotoViewerState = {
  alt: string;
  cachePolicy?: MealPhotoCachePolicy;
  returnTo: string;
};

export type DriveBrowseSearch = {
  path?: string;
};

/** Pull-to-refresh only refetches Drive records; skip forms, add flow, and viewers. */
export function pathnameAllowsPullToRefresh(pathname: string): boolean {
  if (pathname === paths.tutorial) return false;
  if (
    pathname === paths.add.root ||
    pathname.startsWith(`${paths.add.root}/`)
  ) {
    return false;
  }
  if (pathname.startsWith(paths.settings)) return false;
  if (pathname.startsWith(paths.progress.slideshow)) return false;
  if (pathname.startsWith("/progress/photos/")) return false;
  if (pathname.startsWith("/photos/")) return false;
  if (pathname.startsWith("/drive/files/")) return false;
  if (pathname.endsWith("/edit")) return false;
  return true;
}
