/** Canonical app paths — use for links, redirects, and nav highlighting. */
export const paths = {
  login: "/login",
  home: "/",
  history: "/history",
  mealDetail: "/meals/$mealId",
  add: {
    root: "/add",
    favorites: "/add/favorites",
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

/** Old URLs kept as redirects for bookmarks and shared links. */
export const legacyPaths = {
  scanner: "/scanner",
  scannerFavorites: "/scanner/favorites",
  scannerManual: "/scanner/manual",
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
