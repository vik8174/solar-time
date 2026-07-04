import { describe, expect, it } from 'vitest';

import type { Deviation } from '../domain/solarTime';
import { buildCityViewModel } from './cityViewModel';

const PRAGUE = { name: 'Prague', coords: '50.08°N, 14.44°E' };

/** Prague, early July: clock 66 min ahead, solar noon 13:06. */
const summer: Deviation = {
  longitudeOffset: 2.25,
  equationOfTime: 4.04,
  dst: 60,
  total: 66.29,
  solarNoon: 786.29,
};

/** Prague, mid-January: DST off, clock ~11 min ahead. */
const winter: Deviation = {
  longitudeOffset: 2.25,
  equationOfTime: 8.63,
  dst: 0,
  total: 10.88,
  solarNoon: 730.88,
};

describe('buildCityViewModel', () => {
  it('carries the static city identity into the eyebrow', () => {
    const vm = buildCityViewModel(PRAGUE, summer);
    expect(vm.cityName).toBe('Prague');
    expect(vm.coords).toBe('50.08°N, 14.44°E');
  });

  it('shows the signed total as the hero with a unit', () => {
    const vm = buildCityViewModel(PRAGUE, summer);
    expect(vm.heroValue).toBe('+66');
    expect(vm.showUnit).toBe(true);
    expect(vm.inSync).toBe(false);
  });

  it('says how far and which way the clock runs, with solar noon', () => {
    const vm = buildCityViewModel(PRAGUE, summer);
    expect(vm.leadText).toBe('Your clock runs 66 minutes ahead of the sun.');
    expect(vm.solarNoonText).toBe('Real solar noon today is at 13:06.');
    expect(vm.solarNoonLabel).toBe('13:06');
  });

  it('flips the direction wording for a clock behind the sun', () => {
    const behind: Deviation = { ...summer, total: -48 };
    expect(buildCityViewModel(PRAGUE, behind).leadText).toBe(
      'Your clock runs 48 minutes behind the sun.',
    );
  });

  it('uses the singular "minute" at exactly one minute of deviation', () => {
    const oneMinute: Deviation = { ...summer, total: 1 };
    expect(buildCityViewModel(PRAGUE, oneMinute).leadText).toBe(
      'Your clock runs 1 minute ahead of the sun.',
    );
  });

  it('breaks the total into three signed components plus a total', () => {
    const vm = buildCityViewModel(PRAGUE, summer);
    const byKey = Object.fromEntries(vm.breakdown.map((r) => [r.key, r]));
    expect(byKey.longitude.value).toBe('+2');
    expect(byKey.equationOfTime.value).toBe('+4');
    expect(byKey.dst.value).toBe('+60');
    expect(byKey.total.value).toBe('+66');
  });

  it('marks a zero component so the UI can dim it, but still lists it', () => {
    const vm = buildCityViewModel(PRAGUE, winter);
    const dst = vm.breakdown.find((r) => r.key === 'dst');
    expect(dst?.value).toBe('0');
    expect(dst?.zero).toBe(true);
  });

  it('switches the hero to "In sync" within a minute of the sun', () => {
    const synced: Deviation = { ...summer, total: 0.4 };
    const vm = buildCityViewModel(PRAGUE, synced);
    expect(vm.inSync).toBe(true);
    expect(vm.heroValue).toBe('In sync');
    expect(vm.showUnit).toBe(false);
    expect(vm.leadText).toBe('Your clock matches the sun right now.');
  });

  it('includes scale geometry driven by the total', () => {
    const vm = buildCityViewModel(PRAGUE, summer);
    expect(vm.geometry.marker.offset).toBe(66.29);
    expect(vm.geometry.ideal.x).toBeCloseTo((vm.geometry.plotMinX + vm.geometry.plotMaxX) / 2);
  });
});
