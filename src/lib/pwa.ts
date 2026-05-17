/** True when running as an installed home-screen / standalone PWA (not a normal browser tab). */
export function isInstalledPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type MobileInstallPlatform = "ios" | "android";

/** iPhone/iPad or Android phone browser; null on desktop and most tablets in desktop mode. */
export function getMobileInstallPlatform(): MobileInstallPlatform | null {
  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return null;
}

/** Mobile browser tab where the user has not added MacroKeep to the home screen yet. */
export function shouldShowInstallGuide(): boolean {
  if (isInstalledPwa()) return false;
  return getMobileInstallPlatform() !== null;
}
