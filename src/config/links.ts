/**
 * links — external destinations surfaced in the footer and support note.
 *
 * Kept in one place so the still-pending real values (slice #11) can be swapped
 * without touching markup. Pure constants — no logic, no coverage gate.
 *
 * Status of each (report to coordinator):
 * - SUPPORT_URL  — PLACEHOLDER: real Buy-Me-a-Coffee handle still needed.
 * - FEEDBACK_URL — PLACEHOLDER: real Tally form id still needed (must not expose an email).
 * - GITHUB_URL   — owner profile for now; the repo is private (R-007), so a repo
 *                  link would 404 for visitors. Swap to the repo URL once public.
 * - GEONAMES_URL — REAL: attribution for the CC-BY city dataset (R-009), stable.
 */

/** Buy-Me-a-Coffee donation link (plain link, not the JS widget — D-008). */
export const SUPPORT_URL = 'https://www.buymeacoffee.com/REPLACE_ME';

/** Hosted Tally feedback form — collects feedback without exposing a personal email. */
export const FEEDBACK_URL = 'https://tally.so/r/REPLACE_ME';

/** GitHub link — owner profile until the repo is public (R-007). */
export const GITHUB_URL = 'https://github.com/vik8174';

/** GeoNames — required CC-BY 4.0 attribution for the city dataset (R-009). */
export const GEONAMES_URL = 'https://www.geonames.org';
