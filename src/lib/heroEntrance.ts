/**
 * heroEntrance — keep the hero's one-time "sunrise" entrance (#84) to a genuine
 * fresh load, not client-side View-Transition navigations.
 *
 * `<main>` is swapped on every ClientRouter navigation, so a city→city nav mounts
 * a fresh `.hero.entrance` and replays the `rise` animation. Overlapping the
 * default view-transition crossfade, that stacks two "appear" animations on the
 * same number — on slower mobile hardware the overlap reads as a double / multi-
 * render flash (desktop paints fast enough to hide it). Stripping the class from
 * the incoming document leaves navigations with the clean crossfade alone; the
 * first load still animates (it renders server-side with the class, before any
 * swap).
 */

/**
 * Remove the one-time entrance class from the hero of a document about to be
 * swapped in. A no-op when the incoming page has no animating hero (e.g. `/`,
 * whose hero opts out of the entrance per D-029).
 *
 * @param doc - the incoming document from `astro:before-swap` (`event.newDocument`)
 */
export const suppressHeroEntrance = (doc: Document): void => {
  doc.querySelector('.hero.entrance')?.classList.remove('entrance');
};
