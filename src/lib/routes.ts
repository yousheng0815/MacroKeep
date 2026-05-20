/** Canonical app paths — use for links, redirects, and nav highlighting. */
export const paths = {
  login: "/login",
  home: "/",
  history: "/history",
  mealDetail: "/meals/$mealId",
  mealEdit: "/meals/$mealId/edit",
  add: {
    root: "/add",
    savedMeals: "/add/saved-meals",
    savedMealNew: "/add/saved-meals/new",
    savedMealEdit: "/add/saved-meals/$savedMealId/edit",
    history: "/add/history",
    describe: "/add/describe",
    manual: "/add/manual",
  },
  progress: {
    root: "/progress",
    slideshow: "/progress/photos/slideshow",
  },
  drive: "/drive",
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
  if (pathname.endsWith("/edit")) return false;
  return true;
}
