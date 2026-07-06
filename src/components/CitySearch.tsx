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
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

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
}: CitySearchProps): React.JSX.Element {
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const optionRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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

  const selectCity = (city: SearchCity): void => {
    if (onSelect) {
      onSelect(city);
      setOpen(false);
    }
    // Otherwise the <a> navigates natively (ClientRouter → View Transition).
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
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
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
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
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {showList && (
        <ul className="city-search__listbox" id={LISTBOX_ID} role="listbox" aria-label="Cities">
          {results.map((city, i) => (
            <li key={city.slug} role="presentation">
              <a
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                // Accessible name = the city itself; the matched alt is a
                // decorative visual hint (why the row matched), so it must not
                // glue onto the name for a screen reader (issue #43).
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
                {city.altNames.length > 0 && (
                  <span className="city-search__option-alt" aria-hidden="true">
                    {city.altNames[0]}
                  </span>
                )}
              </a>
            </li>
          ))}
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
