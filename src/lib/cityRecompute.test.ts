// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { recomputeCityView } from './cityRecompute';

/** A minimal city page: the `data-*` inputs plus every element recompute patches. */
const CITY_MARKUP = `
  <main
    data-city-slug="zuerich"
    data-city-name="Zürich"
    data-city-coords="47.37°N, 8.55°E"
    data-city-longitude="8.55"
    data-city-timezone="Europe/Zurich"
  >
    <p class="hero"><span data-hero-value>?</span><span data-hero-unit hidden>min</span></p>
    <p data-lead>?</p>
    <p data-solar-noon>?</p>
    <div data-scale></div>
    <span data-scale-noon>?</span>
    <div data-row="longitude"><span data-row-value="longitude">?</span></div>
    <div data-row="equationOfTime"><span data-row-value="equationOfTime">?</span></div>
    <div data-row="dst"><span data-row-value="dst">?</span></div>
    <div data-row="total"><span data-row-value="total">?</span></div>
  </main>
`;

const WINTER = new Date('2026-01-15T12:00:00Z'); // Europe DST off
const SUMMER = new Date('2026-07-15T12:00:00Z'); // Europe DST on (+60)

const rowValue = (key: string): string | null | undefined =>
  document.querySelector(`[data-row-value="${key}"]`)?.textContent;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('recomputeCityView', () => {
  it('applies the daylight-saving offset in effect NOW, not at build time', () => {
    document.body.innerHTML = CITY_MARKUP;
    recomputeCityView(document, SUMMER);
    const heroSummer = document.querySelector('[data-hero-value]')?.textContent;
    expect(rowValue('dst')).toBe('+60'); // DST active

    document.body.innerHTML = CITY_MARKUP;
    recomputeCityView(document, WINTER);
    const heroWinter = document.querySelector('[data-hero-value]')?.textContent;
    expect(rowValue('dst')).toBe('0'); // DST off

    // The whole answer flips with DST — this is the drift that made navigated-to
    // pages wrong for half the year before the fix (recompute on every page-load).
    expect(heroWinter).not.toBe(heroSummer);
  });

  it('patches the hero, solar-noon and breakdown rows in place', () => {
    document.body.innerHTML = CITY_MARKUP;
    recomputeCityView(document, WINTER);

    expect(document.querySelector('[data-hero-value]')?.textContent).not.toBe('?');
    expect(document.querySelector('[data-solar-noon]')?.textContent).not.toBe('?');
    expect(rowValue('longitude')).not.toBe('?');
    expect(rowValue('total')).not.toBe('?');
    // The scale SVG is rebuilt from the recomputed geometry.
    expect(document.querySelector('[data-scale]')?.innerHTML).not.toBe('');
  });

  it('is a no-op when the city root is absent (partial or unexpected DOM)', () => {
    document.body.innerHTML = '<main><p data-hero-value>untouched</p></main>';
    expect(() => {
      recomputeCityView(document, WINTER);
    }).not.toThrow();
    expect(document.querySelector('[data-hero-value]')?.textContent).toBe('untouched');
  });

  it('is a no-op when a required input is malformed (non-numeric longitude)', () => {
    document.body.innerHTML = CITY_MARKUP.replace(
      'data-city-longitude="8.55"',
      'data-city-longitude="x"',
    );
    recomputeCityView(document, WINTER);
    // Guard bailed before patching — server-rendered placeholder is left intact.
    expect(document.querySelector('[data-hero-value]')?.textContent).toBe('?');
  });
});
