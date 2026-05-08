import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DashboardPage } from "@/pages/DashboardPage";
import { DriveFilesPage } from "@/pages/DriveFilesPage";
import { FavoriteMealsPage } from "@/pages/FavoriteMealsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { MealDetailPage } from "@/pages/MealDetailPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { ProgressPhotoSlideshowPage } from "@/pages/ProgressPhotoSlideshowPage";
import { ScannerPage } from "@/pages/ScannerPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TutorialPage } from "@/pages/TutorialPage";
import { GoogleSessionProvider } from "@/contexts/google-session";
import {
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
  path: "/login",
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
  path: "/",
  component: DashboardPage,
});

const historyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/history",
  component: HistoryPage,
});

const mealDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/meals/$mealId",
  component: MealDetailPage,
});

const scannerRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/scanner",
  component: ScannerPage,
});

const favoriteMealsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/scanner/favorites",
  component: FavoriteMealsPage,
});

const progressRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/progress",
  component: ProgressPage,
});

const progressPhotoSlideshowRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/progress/photos/slideshow",
  component: ProgressPhotoSlideshowPage,
});

const driveRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/drive",
  component: DriveFilesPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const tutorialRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/tutorial",
  component: TutorialPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    historyRoute,
    mealDetailRoute,
    scannerRoute,
    favoriteMealsRoute,
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
}
