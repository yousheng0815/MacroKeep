import type { AnyRouter } from "@tanstack/react-router";

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isGoogleAnalyticsEnabled(): boolean {
  return import.meta.env.PROD && Boolean(MEASUREMENT_ID);
}

export function initGoogleAnalytics(): void {
  if (!isGoogleAnalyticsEnabled() || window.gtag) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });
}

function pagePathFromLocation(pathname: string, searchStr: string): string {
  return searchStr ? `${pathname}${searchStr}` : pathname;
}

export function trackPageView(pagePath: string): void {
  if (!isGoogleAnalyticsEnabled() || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** SPA navigations — call once after `initGoogleAnalytics`. */
export function subscribeGoogleAnalyticsPageViews(router: AnyRouter): void {
  if (!isGoogleAnalyticsEnabled()) return;

  const send = () => {
    const { pathname, searchStr } = router.state.location;
    trackPageView(pagePathFromLocation(pathname, searchStr));
  };

  router.subscribe("onResolved", send);
  send();
}
