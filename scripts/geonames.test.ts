import { describe, expect, it } from 'vitest';

import { parseDump, parseLine, selectCities, type GeoNameRecord } from './geonames';

/** Builds a valid tab-separated dump line with overridable columns. */
const line = (over: Partial<Record<number, string>> = {}): string => {
  const cols = Array.from({ length: 19 }, () => '');
  cols[0] = '3067696'; // geonameId
  cols[1] = 'Prague';
  cols[2] = 'Prague'; // asciiname
  cols[3] = 'Praha,Praga'; // altnames
  cols[4] = '50.08804'; // lat
  cols[5] = '14.42076'; // lon
  cols[6] = 'P';
  cols[7] = 'PPLC';
  cols[8] = 'CZ'; // country
  cols[14] = '1165581'; // population
  cols[17] = 'Europe/Prague'; // timezone
  cols[18] = '2026-01-01';
  for (const [k, v] of Object.entries(over)) cols[Number(k)] = v ?? '';
  return cols.join('\t');
};

/** Builds a record directly for select/slug tests. */
const record = (over: Partial<GeoNameRecord> = {}): GeoNameRecord => ({
  geonameId: 1,
  name: 'City',
  latitude: 0,
  longitude: 0,
  countryCode: 'XX',
  population: 1000,
  timeZone: 'UTC',
  altNames: [],
  ...over,
});

describe('parseLine', () => {
  it('parses a well-formed row into a record', () => {
    const r = parseLine(line());
    expect(r).toMatchObject({
      geonameId: 3067696,
      name: 'Prague',
      latitude: 50.08804,
      longitude: 14.42076,
      countryCode: 'CZ',
      population: 1165581,
      timeZone: 'Europe/Prague',
    });
  });

  it('preserves the IANA zone, not a numeric offset', () => {
    expect(parseLine(line())?.timeZone).toBe('Europe/Prague');
  });

  it('drops rows with non-positive population', () => {
    expect(parseLine(line({ 14: '0' }))).toBeUndefined();
    expect(parseLine(line({ 14: '' }))).toBeUndefined();
  });

  it('drops rows missing a timezone', () => {
    expect(parseLine(line({ 17: '' }))).toBeUndefined();
  });

  it('drops rows missing a name', () => {
    expect(parseLine(line({ 2: '' }))).toBeUndefined();
  });

  it('keeps only Latin-script alternate names and excludes the primary', () => {
    const r = parseLine(line({ 3: 'Praha,Прага,布拉格,Praga,Prague' }));
    expect(r?.altNames).toEqual(['Praha', 'Praga']);
  });

  it('yields empty altNames when the column is blank', () => {
    expect(parseLine(line({ 3: '' }))?.altNames).toEqual([]);
  });
});

describe('parseDump', () => {
  it('skips blank lines and malformed rows', () => {
    const text = [line(), '', line({ 17: '' }), line({ 0: '42', 2: 'Brno' })].join('\n');
    const records = parseDump(text);
    expect(records.map((r) => r.name)).toEqual(['Prague', 'Brno']);
  });
});

describe('selectCities', () => {
  it('keeps the top cities by population', () => {
    const records = [
      record({ geonameId: 1, population: 100 }),
      record({ geonameId: 2, population: 500 }),
      record({ geonameId: 3, population: 300 }),
    ];
    const result = selectCities(records, 2);
    expect(result.map((r) => r.geonameId).sort()).toEqual([2, 3]);
  });

  it('breaks population ties by geonameId ascending (deterministic)', () => {
    const records = [
      record({ geonameId: 9, population: 100 }),
      record({ geonameId: 4, population: 100 }),
      record({ geonameId: 7, population: 100 }),
    ];
    // targetSize 1 → the lowest-id tie wins.
    expect(selectCities(records, 1).map((r) => r.geonameId)).toEqual([4]);
  });

  it('guarantees every source time zone is represented', () => {
    const records = [
      record({ geonameId: 1, population: 900, timeZone: 'Europe/Prague' }),
      record({ geonameId: 2, population: 800, timeZone: 'Europe/Prague' }),
      // Small city, only carrier of its zone — must survive despite low pop.
      record({ geonameId: 3, population: 5, timeZone: 'Pacific/Chatham' }),
    ];
    const zones = new Set(selectCities(records, 1).map((r) => r.timeZone));
    expect(zones).toContain('Europe/Prague');
    expect(zones).toContain('Pacific/Chatham');
  });

  it('adds the largest city of a zone the population pass missed', () => {
    const records = [
      record({ geonameId: 1, population: 900, timeZone: 'A' }),
      record({ geonameId: 2, population: 50, timeZone: 'B' }),
      record({ geonameId: 3, population: 80, timeZone: 'B' }),
    ];
    // targetSize 1 keeps zone A; zone B added via its largest (id 3, pop 80).
    const result = selectCities(records, 1);
    const zoneB = result.filter((r) => r.timeZone === 'B');
    expect(zoneB.map((r) => r.geonameId)).toEqual([3]);
  });

  it('returns records sorted by geonameId for byte-stable output', () => {
    const records = [
      record({ geonameId: 3, population: 300, timeZone: 'A' }),
      record({ geonameId: 1, population: 100, timeZone: 'B' }),
      record({ geonameId: 2, population: 200, timeZone: 'C' }),
    ];
    expect(selectCities(records, 3).map((r) => r.geonameId)).toEqual([1, 2, 3]);
  });
});
