// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
});
