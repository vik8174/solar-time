// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
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

  it('selects the highlighted suggestion with the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();

    const input = screen.getByRole('combobox');
    await user.type(input, 'Prague');
    await screen.findByRole('option', { name: /Prague/ });
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: 'prague' }));
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
