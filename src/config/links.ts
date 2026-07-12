/**
 * links — external destinations surfaced in the footer and support note.
 *
 * Kept in one place so real values can be swapped without touching markup.
 * Pure constants — no logic, no coverage gate.
 *
 * - SUPPORT_URL  — REAL: Buy-Me-a-Coffee page (payout not yet connected, but the
 *                  page is live, so the link works).
 * - FEEDBACK_URL — REAL: hosted Tally form; collects feedback without exposing an email.
 * - GEONAMES_URL — REAL: attribution for the CC-BY city dataset (R-009), stable.
 *
 * GitHub link was dropped from the footer (2026-07-07): the repo is private (R-007),
 * so a source link would 404, and a bare profile link wasn't wanted. Re-add here if
 * the repo goes public.
 */

/** Buy-Me-a-Coffee donation link (plain link, not the JS widget — D-008). */
export const SUPPORT_URL = 'https://buymeacoffee.com/viktorkurysh';

/**
 * Master switch for the donation UI (the support note + the footer "Support"
 * link). **Temporarily `false`** for the v1 launch: Buy-Me-a-Coffee has no
 * payout connected, and #81 replaces it with LiqPay (PrivatBank ФОП). Flip back
 * to `true` when #81 ships a working link (and swap `SUPPORT_URL` → LiqPay). All
 * markup/CSS is kept in place, so re-enabling is this one line.
 */
export const SUPPORT_ENABLED = false;

/** Hosted Tally feedback form — collects feedback without exposing a personal email. */
export const FEEDBACK_URL = 'https://tally.so/r/5B58XQ';

/** GeoNames — required CC-BY 4.0 attribution for the city dataset (R-009). */
export const GEONAMES_URL = 'https://www.geonames.org';
