/**
 * cityRecompute — patch a rendered city page with values computed for a given
 * instant, in place (no reflow, no re-render).
 *
 * The build bakes a correct-at-build snapshot; this re-derives it for "now" using
 * the same domain + view model (SSOT), so a page built days ago — or on the other
 * side of a daylight-saving flip — shows today's real answer. The city's inputs
 * are read from `data-*` attributes on `[data-city-slug]`, so this never imports
 * the ~1000-city registry (ADR D-013).
 *
 * Must run on `astro:page-load` (initial load AND every View-Transition nav), not
 * once at module scope: `<main>` is swapped on a city→city navigation, so a
 * single top-level run would leave navigated-to cities showing their build-time
 * (possibly wrong-DST) value.
 */

import { computeDeviation } from '../domain/solarTime';
import { buildCityViewModel } from './cityViewModel';
import { scaleInnerSvg } from './scaleSvg';

/**
 * Re-derive and patch the city view in `doc` for the instant `now`.
 *
 * A no-op when the expected `[data-city-slug]` root or its numeric/string inputs
 * are missing or malformed (defensive — a partially-swapped or unexpected DOM
 * leaves the server-rendered values untouched rather than throwing).
 *
 * @param doc - The document to read the city inputs from and patch.
 * @param now - The instant to compute for (production passes `new Date()`).
 */
export const recomputeCityView = (doc: Document, now: Date): void => {
  const root = doc.querySelector<HTMLElement>('[data-city-slug]');
  const longitude = Number(root?.dataset.cityLongitude);
  const timeZone = root?.dataset.cityTimezone;
  const name = root?.dataset.cityName;
  const coords = root?.dataset.cityCoords;
  if (!root || !timeZone || name === undefined || coords === undefined || Number.isNaN(longitude)) {
    return;
  }

  const vm = buildCityViewModel(
    { name, coords },
    computeDeviation({ longitude, timeZone, date: now }),
  );

  const setText = (selector: string, text: string): void => {
    const el = doc.querySelector(selector);
    if (el) el.textContent = text;
  };

  setText('[data-hero-value]', vm.heroValue);
  setText('[data-lead]', vm.leadText);
  setText('[data-solar-noon]', vm.solarNoonText);
  setText('[data-scale-noon]', vm.solarNoonLabel);

  const unit = doc.querySelector<HTMLElement>('[data-hero-unit]');
  if (unit) unit.hidden = !vm.showUnit;
  doc.querySelector('.hero')?.classList.toggle('synced', vm.inSync);

  const scale = doc.querySelector('[data-scale]');
  if (scale) scale.innerHTML = scaleInnerSvg(vm.geometry);

  for (const row of vm.breakdown) {
    setText(`[data-row-value="${row.key}"]`, row.value);
    doc.querySelector(`[data-row="${row.key}"]`)?.classList.toggle('zero', row.zero);
  }
};
