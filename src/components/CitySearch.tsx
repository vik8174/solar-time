/**
 * CitySearch — the site-wide city search island (slice #6).
 *
 * A thin, accessible combobox shell over the pure `citySearch` logic: it lazily
 * loads the lean search index, builds the Fuse index once, and renders ranked
 * suggestions as the user types. Selecting a city navigates to `/${slug}`
 * (results are real `<a data-astro-prefetch>` links, so `<ClientRouter />` gives
 * View Transitions and hover-prefetch for free). An empty result shows a soft
 * hint plus a timezone-based "use my location" fallback.
 *
 * Testability: navigation, index loading and the geo fallback are injectable
 * props (defaults wire the real behavior), so the behavioral test drives the
 * component without an Astro runtime or a real network. See `CitySearch.test.tsx`.
 *
 * @example
 * <CitySearch client:idle transition:persist />
 */
import type { JSX, TargetedKeyboardEvent } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { trackEvent } from '../lib/analytics';
import { resolveDefaultCity, type ZoneCity } from '../lib/resolveDefaultCity';
import { buildCityIndex, searchCities, type CityIndex, type SearchCity } from '../lib/citySearch';
import './CitySearch.css';

/** Props — all optional; defaults wire real navigation, fetching and geo. */
export interface CitySearchProps {
  /** Loads the lean search index. Default: fetch `/search-index.json`. */
  loadIndex?: () => Promise<readonly SearchCity[]>;
  /**
   * Called when a city is chosen. When provided (tests), it fully replaces
   * navigation. When omitted (production), the result `<a>` navigates natively
   * and `<ClientRouter />` intercepts it for a View Transition.
   */
  onSelect?: (city: SearchCity) => void;
  /**
   * Geo fallback for an empty result. Default: resolve the browser timezone to
   * a city (no GPS — that's slice #7) and navigate there.
   */
  onUseLocation?: () => void | Promise<void>;
}

const LISTBOX_ID = 'city-search-listbox';
const optionId = (index: number): string => `city-search-opt-${index}`;

/** Default index loader — fetches the prerendered, first-party search index. */
const fetchSearchIndex = async (): Promise<readonly SearchCity[]> => {
  const response = await fetch('/search-index.json');
  if (!response.ok) throw new Error(`search index request failed: ${response.status}`);
  const data: unknown = await response.json();
  // Trusted first-party build artifact (see /search-index.json.ts).
  return Array.isArray(data) ? (data as SearchCity[]) : [];
};

/**
 * Default geo fallback: guess the city from the browser timezone (no GPS) via
 * the lean tz-index and the pure `resolveDefaultCity`, then navigate.
 */
const resolveByTimeZone = async (): Promise<void> => {
  try {
    const response = await fetch('/tz-index.json');
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0) return;
    const zones = data as ZoneCity[];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const largest = zones.reduce((a, b) => (b.population > a.population ? b : a));
    const city = resolveDefaultCity(timeZone, zones, largest);
    window.location.assign(`/${city.slug}`);
  } catch (error) {
    console.warn('CitySearch: timezone fallback failed', error);
  }
};

export default function CitySearch({
  loadIndex = fetchSearchIndex,
  onSelect,
  onUseLocation = resolveByTimeZone,
}: CitySearchProps): JSX.Element {
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const optionRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load + build the fuzzy index once, after hydration. A failed load is logged
  // and leaves the box inert rather than throwing an unhandled rejection.
  useEffect(() => {
    let cancelled = false;
    void loadIndex()
      .then((cities) => {
        if (!cancelled) setIndex(buildCityIndex(cities));
      })
      .catch((error: unknown) => {
        console.warn('CitySearch: failed to load search index', error);
      });
    return () => {
      cancelled = true;
    };
  }, [loadIndex]);

  const results = useMemo(() => (index ? searchCities(index, query) : []), [index, query]);

  const trimmed = query.trim();
  const showList = open && results.length > 0;
  const showEmpty = open && index !== null && trimmed !== '' && results.length === 0;

  const clearQuery = (): void => {
    setQuery('');
    setActiveIndex(0);
  };

  const selectCity = (city: SearchCity): void => {
    // Anonymous "a city was chosen" event — just the slug, no personal data
    // (D-008). The event is buffered until analytics boots and survives the
    // ensuing View-Transition navigation (same JS context).
    trackEvent('city_selected', { slug: city.slug });
    onSelect?.(city);
    // Close + clear on BOTH paths: the injected-`onSelect` test path and the
    // native `<a>` nav. The header is `transition:persist`, so this same island
    // is carried to `/{slug}` — resetting here lands it empty and closed instead
    // of arriving with a stale, open dropdown (#79). Setting state right before
    // the link's default navigation is safe: state updates are async and don't
    // cancel the click's navigation.
    setOpen(false);
    clearQuery();
  };

  const onKeyDown = (event: TargetedKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      if (showList) {
        event.preventDefault();
        // Route Enter through the active link's click so both keyboard and
        // pointer selection share one path (onSelect in tests, native nav else).
        optionRefs.current[activeIndex]?.click();
      }
    } else if (event.key === 'Escape') {
      if (trimmed === '') setOpen(false);
      else setQuery('');
    }
  };

  return (
    <div
      className="city-search"
      // `onFocusOut` (native, bubbling `focusout`) — NOT `onBlur`: Preact attaches
      // `onBlur` as a literal non-bubbling `blur` listener on this div, so it would
      // never fire for focus leaving the inner input (React's synthetic onBlur
      // bubbles; plain Preact's does not). `focusout` bubbles from the input up.
      onFocusOut={(event) => {
        // Close unless focus moved to a child (e.g. a result link). `relatedTarget`
        // is `EventTarget | null`; narrow to `Node` so `.contains` stays type-safe
        // and a focus-to-nothing (null) correctly closes the box.
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <div className="city-search__field">
        <input
          ref={inputRef}
          type="text"
          className="city-search__input"
          role="combobox"
          aria-label="Search cities"
          aria-expanded={showList}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={showList ? optionId(activeIndex) : undefined}
          autoComplete="off"
          placeholder="Search a city…"
          value={query}
          onInput={(event) => {
            // Preact fires `onInput` per keystroke (its `onChange` is the native,
            // on-commit event — unlike React). `currentTarget` is the typed input.
            setQuery(event.currentTarget.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />

        {query !== '' && (
          <button
            type="button"
            className="city-search__clear"
            aria-label="Clear search"
            // `onMouseDown` preventDefault stops the button from stealing focus,
            // so the `focusout` close never fires and the caret stays in the input.
            // The ref re-focus is a belt-and-suspenders guarantee for a11y.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              clearQuery();
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>

      {showList && (
        <ul className="city-search__listbox" id={LISTBOX_ID} role="listbox" aria-label="Cities">
          {results.map(({ city, matchedAlt }, i) => {
            // Default secondary hint is the country; when the match came via an
            // alt (an exonym), show that alt instead as the reason (issue #43).
            const hint = matchedAlt ?? city.country;
            return (
              <li key={city.slug} role="presentation">
                <a
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  // Accessible name = the city itself; the country/alt hint is a
                  // decorative visual cue (why the row matched or which country),
                  // so it must not glue onto the name for a screen reader (#43).
                  aria-label={city.name}
                  className="city-search__option"
                  href={`/${city.slug}`}
                  data-astro-prefetch
                  onMouseEnter={() => {
                    setActiveIndex(i);
                  }}
                  onClick={(event) => {
                    if (onSelect) event.preventDefault();
                    selectCity(city);
                  }}
                >
                  <span className="city-search__option-name">{city.name}</span>
                  {hint !== undefined && (
                    <span className="city-search__option-alt" aria-hidden="true">
                      {hint}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {showEmpty && (
        <div className="city-search__empty" role="status">
          <p style={{ margin: 0 }}>Nothing found — check spelling, or use your location.</p>
          <button
            type="button"
            className="city-search__locate"
            onClick={() => {
              void onUseLocation();
            }}
          >
            📍 Use my location
          </button>
        </div>
      )}
    </div>
  );
}
