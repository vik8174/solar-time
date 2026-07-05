/**
 * buildCities — regenerates `src/data/cities.json` from the GeoNames
 * `cities15000` dump. This is the I/O boundary: it fetches + unzips the dump
 * (cached under `scripts/.cache/`, git-ignored), then delegates every
 * reproducible decision to the pure `geonames` / `citySlug` modules.
 *
 * `cities.json` is committed and consumed by the Astro build — so a normal
 * `astro build` needs no network. Run this only to refresh the dataset:
 *   npx tsx scripts/buildCities.ts
 *
 * Data: GeoNames cities15000 (https://download.geonames.org/export/dump/),
 * licensed CC-BY 4.0 → the site must show footer attribution (footer slice #11).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DUMP_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
/** Population pass size; the zone-completeness pass adds the rest (~1000 total). */
const TARGET_SIZE = 900;

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache');
const zipPath = join(cacheDir, 'cities15000.zip');
const txtPath = join(cacheDir, 'cities15000.txt');
const outPath = join(here, '..', 'src', 'data', 'cities.json');

/** Downloads the dump zip to the cache if it isn't already there. */
const ensureDump = async (): Promise<void> => {
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(txtPath)) {
    if (!existsSync(zipPath)) {
      process.stdout.write(`Downloading ${DUMP_URL}\n`);
      const res = await fetch(DUMP_URL);
      if (!res.ok) throw new Error(`GeoNames download failed: ${res.status} ${res.statusText}`);
      writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    }
    // Node has no zip reader; `unzip` ships on macOS/Linux. Fail fast if absent.
    execFileSync('unzip', ['-o', zipPath, 'cities15000.txt', '-d', cacheDir], {
      stdio: 'ignore',
    });
  }
};

const main = async (): Promise<void> => {
  // Imported lazily so the pure modules stay decoupled from this I/O entry point.
  const { parseDump, selectCities } = await import('./geonames.ts');
  const { toCities } = await import('./citySlug.ts');

  await ensureDump();
  const records = parseDump(readFileSync(txtPath, 'utf8'));
  const selected = selectCities(records, TARGET_SIZE);
  const cities = toCities(selected);

  // Trailing newline for POSIX-clean diffs; 2-space indent, byte-stable order.
  writeFileSync(outPath, `${JSON.stringify(cities, null, 2)}\n`);
  process.stdout.write(
    `Wrote ${String(cities.length)} cities to ${outPath} ` +
      `(from ${String(records.length)} eligible rows)\n`,
  );
};

main().catch((error: unknown) => {
  process.stderr.write(`buildCities failed: ${String(error)}\n`);
  process.exitCode = 1;
});
