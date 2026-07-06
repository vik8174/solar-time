/**
 * supportVisibility — the one tested rule behind the dismissable "Support" note.
 *
 * The Buy-Me-a-Coffee line is a quiet, one-off nudge that must stay hidden once
 * the visitor closes it (state persisted in `localStorage`, D-008). This module
 * owns only the pure decision — "given the stored flag, show the note?" — so the
 * page `<script>` stays a thin DOM/`localStorage` adapter around it (D-012).
 */

/** The `localStorage` value written when the visitor dismisses the note. */
export const SUPPORT_DISMISSED = 'dismissed';

/**
 * Decides whether the support note should be visible.
 *
 * @param stored - The persisted flag (`localStorage.getItem(...)`), or `null`
 *   when nothing has been stored yet.
 * @returns `true` unless the note has been explicitly dismissed.
 */
export const shouldShowSupport = (stored: string | null): boolean => stored !== SUPPORT_DISMISSED;
