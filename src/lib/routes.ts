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
