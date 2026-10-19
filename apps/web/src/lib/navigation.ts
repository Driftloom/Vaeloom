/**
 * Hard, full-document navigation. Prefer the Next router for in-app routing;
 * use this only for terminal flows (signing out, session termination) where a
 * full document reload is intended and the destination must not be resolved
 * by client-side routing.
 */
export function navigateTo(path: string): void {
  window.location.replace(path);
}
