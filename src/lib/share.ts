/**
 * share — the pure decisions behind the city-page share control (D-012).
 *
 * The Web Share and Clipboard APIs are browser-only side effects, so this
 * module owns just the two testable rules — which strategy the current browser
 * can use, and the exact URL to share — leaving the page `<script>` a thin
 * adapter that calls `navigator.share` / `navigator.clipboard` (D-001, the twin
 * of the geo and support-dismiss adapters).
 */

/** How the current browser can share: OS sheet, clipboard copy, or nothing. */
export type ShareStrategy = 'native' | 'clipboard' | 'none';

/** Feature-detected capabilities of the current browser (never UA-sniffed). */
export interface ShareCapabilities {
  /** `typeof navigator.share === 'function'` — the Web Share API is present. */
  canShare: boolean;
  /** `navigator.clipboard.writeText` is available. */
  canClipboard: boolean;
}

/**
 * Picks the share strategy from feature-detected capabilities.
 *
 * Native (the OS share sheet) is preferred wherever present — typically mobile
 * — with clipboard copy as the desktop fallback, and `'none'` when neither API
 * exists so the caller can hide the control instead of offering a dead end.
 *
 * @param capabilities - Feature-detected `canShare` / `canClipboard` flags.
 * @returns The strategy to use: `'native'`, `'clipboard'`, or `'none'`.
 */
export const pickShareStrategy = ({ canShare, canClipboard }: ShareCapabilities): ShareStrategy => {
  if (canShare) return 'native';
  if (canClipboard) return 'clipboard';
  return 'none';
};

/**
 * Builds the clean, canonical absolute URL to share for a city.
 *
 * Composes `origin` (e.g. `location.origin`) with the city `slug` as a
 * root-absolute path, so the result carries no query string or fragment
 * (D-020 clean URLs — `https://host/prague`) regardless of any `?`/`#` junk on
 * the current address bar.
 *
 * @param slug - The city slug, e.g. `prague` (a clean kebab-case segment).
 * @param origin - The site origin, e.g. `https://solar-time-prod.web.app`.
 * @returns The canonical share URL, e.g. `https://solar-time-prod.web.app/prague`.
 * @throws {TypeError} If `origin` is not a valid absolute URL.
 */
export const buildShareUrl = (slug: string, origin: string): string =>
  new URL(`/${slug}`, origin).href;
