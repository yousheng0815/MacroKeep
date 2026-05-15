import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AddFromHistoryPage } from "@/pages/AddFromHistoryPage";
import { AddMealPage } from "@/pages/AddMealPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DriveFilesPage } from "@/pages/DriveFilesPage";
import { SavedMealEditPage } from "@/pages/SavedMealEditPage";
import { SavedMealsPage } from "@/pages/SavedMealsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { MealDetailPage } from "@/pages/MealDetailPage";
import { MealEditPage } from "@/pages/MealEditPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { ProgressPhotoSlideshowPage } from "@/pages/ProgressPhotoSlideshowPage";
import { DescribeMealPage } from "@/pages/DescribeMealPage";
import { ManualMealPage } from "@/pages/ManualMealPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TutorialPage } from "@/pages/TutorialPage";
import { GoogleSessionProvider } from "@/contexts/google-session";
import { legacyPaths, paths } from "@/lib/routes";
import type { MealDetailNavFrom } from "@/lib/routes";
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => (
    <GoogleSessionProvider>
      <Outlet />
    </GoogleSessionProvider>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: paths.login,
  component: LoginPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: () => (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.home,
  component: DashboardPage,
});

const historyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.history,
  component: HistoryPage,
});

const mealEditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.mealEdit,
  component: MealEditPage,
});

const mealDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.mealDetail,
  component: MealDetailPage,
});

const addMealRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.root,
  component: AddMealPage,
});

const savedMealsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.savedMeals,
  component: SavedMealsPage,
});

const savedMealEditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.savedMealEdit,
  component: SavedMealEditPage,
});

const legacyFavoriteMealsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.favorites,
  component: () => <Navigate to={paths.add.savedMeals} replace />,
});

const addFromHistoryRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.history,
  component: AddFromHistoryPage,
});

const manualMealRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.manual,
  component: ManualMealPage,
});

const describeMealRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.add.describe,
  component: DescribeMealPage,
});

const legacyScannerRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: legacyPaths.scanner,
  component: () => <Navigate to={paths.add.root} replace />,
});

const legacyScannerFavoritesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: legacyPaths.scannerFavorites,
  component: () => <Navigate to={paths.add.savedMeals} replace />,
});

const legacyScannerManualRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: legacyPaths.scannerManual,
  component: () => <Navigate to={paths.add.manual} replace />,
});

const progressRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.progress.root,
  component: ProgressPage,
});

const progressPhotoSlideshowRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.progress.slideshow,
  component: ProgressPhotoSlideshowPage,
});

const driveRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.drive,
  component: DriveFilesPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.settings,
  component: SettingsPage,
});

const tutorialRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: paths.tutorial,
  component: TutorialPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    historyRoute,
    mealEditRoute,
    mealDetailRoute,
    addMealRoute,
    savedMealsRoute,
    savedMealEditRoute,
    legacyFavoriteMealsRoute,
    addFromHistoryRoute,
    describeMealRoute,
    manualMealRoute,
    legacyScannerRoute,
    legacyScannerFavoritesRoute,
    legacyScannerManualRoute,
    progressRoute,
    progressPhotoSlideshowRoute,
    driveRoute,
    settingsRoute,
    tutorialRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }

  /** Location state for highlighting the shell nav on `/meals/:id`. */
  interface HistoryState {
    navFrom?: MealDetailNavFrom;
  }
}
