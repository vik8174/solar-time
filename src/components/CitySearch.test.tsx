// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchCity } from '../lib/citySearch';
import CitySearch from './CitySearch';

afterEach(cleanup);

const CITIES: readonly SearchCity[] = [
  { slug: 'prague', name: 'Prague', altNames: ['Praha'] },
  { slug: 'munich', name: 'Munich', altNames: ['München'] },
  { slug: 'madrid', name: 'Madrid', altNames: [] },
];

const renderSearch = (): {
  onSelect: ReturnType<typeof vi.fn>;
  onUseLocation: ReturnType<typeof vi.fn>;
} => {
  const onSelect = vi.fn();
  const onUseLocation = vi.fn();
  render(
    <CitySearch
      loadIndex={() => Promise.resolve(CITIES)}
      onSelect={onSelect}
      onUseLocation={onUseLocation}
    />,
  );
  return { onSelect, onUseLocation };
};

describe('CitySearch', () => {
  it('shows fuzzy suggestions as the user types (tolerating diacritics)', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByRole('combobox'), 'munchen');

    const option = await screen.findByRole('option', { name: /Munich/ });
    expect(option).toBeDefined();
  });

  it('navigates when a suggestion is clicked', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    await user.type(screen.getByRole('combobox'), 'Prague');
    await user.click(await screen.findByRole('option', { name: /Prague/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: 'prague' }));
  });

  it('closes the listbox and clears the field after selecting a city', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole<HTMLInputElement>('combobox');
    await user.type(input, 'Prague');
    await user.click(await screen.findByRole('option', { name: /Prague/ }));

    // The persisted island must arrive on the destination empty and closed:
    // no listbox, and the combobox value reset to ''.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('');
    // Reset must not swallow the selection callback (native-nav path parity).
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: 'prague' }));
  });

  it('selects the highlighted suggestion with the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('option', { name: /Prague/ });
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: 'prague' }));
  });

  it('closes and clears after an Enter selection too (keyboard path parity)', async () => {
    const user = userEvent.setup();
    renderSearch();

    // Enter routes through the active link's `.click()`, a different entry into
    // `selectCity` than a pointer click — guard that it resets state identically.
    const input = screen.getByRole<HTMLInputElement>('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('option', { name: /Prague/ });
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('');
  });

  it('moves the active option with arrow keys before selecting', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole('combobox');
    // Broad query so several cities match, then arrow down to the second.
    await user.type(input, 'a');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows the empty-result hint and a location fallback for no matches', async () => {
    const user = userEvent.setup();
    const { onUseLocation } = renderSearch();

    await user.type(screen.getByRole('combobox'), 'zzzzzzzz');

    expect(await screen.findByText(/check spelling, or use your location/i)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /use my location/i }));
    expect(onUseLocation).toHaveBeenCalledTimes(1);
  });

  it('does not navigate above the first option with ArrowUp at position 0', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'a');
    await screen.findByRole('listbox');
    // Press ArrowUp multiple times — activeIndex should stay at 0
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await user.keyboard('{Enter}');

    // Should select the first option, not go out of bounds
    expect(onSelect).toHaveBeenCalledTimes(1);
    const firstCity = CITIES[0]!;
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: firstCity.slug }));
  });

  it('closes the open listbox when focus leaves the search box', async () => {
    const user = userEvent.setup();
    render(
      <>
        <CitySearch
          loadIndex={() => Promise.resolve(CITIES)}
          onSelect={vi.fn()}
          onUseLocation={vi.fn()}
        />
        <button type="button">outside</button>
      </>,
    );

    await user.type(screen.getByRole('combobox'), 'Prague');
    await screen.findByRole('listbox');

    // Move focus out of the component entirely (not onto a result link) — the
    // box must close. Guards the `focusout` bubbling the React→Preact swap relies
    // on: plain Preact's `onBlur` would not fire here, leaving the box stuck open.
    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the listbox when Escape is pressed with an empty query', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('listbox');

    // Clear the query first
    await user.clear(input);
    // Then press Escape — should close without opening again
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears the query when Escape is pressed with a non-empty query', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByRole<HTMLInputElement>('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('listbox');

    // Escape should clear the query but keep focus
    await user.keyboard('{Escape}');

    expect(input.value).toBe('');
  });

  it('does not render the clear button while the query is empty', () => {
    renderSearch();

    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });

  it('reveals the clear button, clears the field and keeps focus on click', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByRole<HTMLInputElement>('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('listbox');

    const clear = screen.getByRole('button', { name: /clear search/i });
    await user.click(clear);

    // Field emptied, list gone (no results for '') and the caret stays put so
    // the user can immediately retype.
    expect(input.value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('shows alt names as hints in the option label', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'Prague');

    const option = await screen.findByRole('option', { name: /Prague/ });
    // Prague has an alt name 'Praha'
    expect(option.textContent).toContain('Praha');
  });

  it('exposes the city name — not glued with the alt — as the option accessible name', async () => {
    const user = userEvent.setup();
    renderSearch();

    // Diacritic-tolerant match on Munich, whose alt name is 'München'.
    await user.type(screen.getByRole('combobox'), 'munchen');

    // Accessible name must be exactly the city — never "MunichMünchen".
    const option = await screen.findByRole('option', { name: 'Munich' });
    expect(option).toBeDefined();
    // The alt still renders as a visible, but decorative (aria-hidden), hint.
    const alt = within(option).getByText('München');
    expect(alt.getAttribute('aria-hidden')).toBe('true');
  });

  it('handles consecutive ArrowDown presses', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'a'); // Matches Madrid and Munich
    await screen.findByRole('listbox');

    // Navigate down twice
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
