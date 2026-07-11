/**
 * buildCities — regenerates `src/data/cities.json` from the GeoNames
 * `cities5000` dump. This is the I/O boundary: it fetches + unzips the dump
 * (cached under `scripts/.cache/`, git-ignored), then delegates every
 * reproducible decision to the pure `geonames` / `citySlug` modules.
 *
 * The `cities5000` dump (population ≥ 5,000; ~50k rows) replaced `cities15000`
 * with #90 to scale the searchable/indexable set to ~5,000 cities. That was a
 * sanctioned dump bump (`GEONAMES_ACCEPT_DRIFT=1`, see below).
 *
 * `cities.json` is committed and consumed by the Astro build — so a normal
 * `astro build` needs no network. Run this only to refresh the dataset:
 *   npx tsx scripts/buildCities.ts
 *
 * **Reproducibility (R-016).** The live GeoNames dump is unversioned, so a
 * regeneration would silently import whatever moved upstream. Two guards make a
 * dataset change an explicit, reviewed act:
 *  - **Checksum pin** — the extracted dump is hashed and compared to the
 *    committed `scripts/cities5000.sha256`. A mismatch **fails loudly**;
 *    `GEONAMES_ACCEPT_DRIFT=1` is the sanctioned bump path (skip the compare and
 *    rewrite the pin — how an intentional refresh like #90 updates it).
 *  - **Slug registry** — `scripts/slug-registry.json` freezes every city's slug
 *    by `geonameId`, so drift can only *add* URLs, never rename one (see
 *    `citySlug.ts`). New assignments are written back into it here.
 *
 * CI is unaffected: CI runs `npm run build` (reads the committed `cities.json`),
 * never `build:cities` — the pin only fires on a manual regeneration.
 *
 * Data: GeoNames cities5000 (https://download.geonames.org/export/dump/),
 * licensed CC-BY 4.0 → the site must show footer attribution (footer slice #11).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSlugRegistry, type SlugRegistry } from './citySlug.ts';

const DUMP_URL = 'https://download.geonames.org/export/dump/cities5000.zip';
/** Population pass size; the zone-completeness pass adds the rest (~5000 total). */
const TARGET_SIZE = 5000;

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache');
const zipPath = join(cacheDir, 'cities5000.zip');
const txtPath = join(cacheDir, 'cities5000.txt');
const outPath = join(here, '..', 'src', 'data', 'cities.json');
const shaPath = join(here, 'cities5000.sha256');
const registryPath = join(here, 'slug-registry.json');

/**
 * Reads the committed slug registry, or `{}` when it's absent (first seed).
 * Shape + uniqueness are validated by the pure {@link parseSlugRegistry} — a
 * corrupted registry must fail the build, not silently drop every frozen slug
 * and re-derive URLs (the R-016 hazard).
 */
const readRegistry = (): SlugRegistry => {
  if (!existsSync(registryPath)) return {};
  return parseSlugRegistry(JSON.parse(readFileSync(registryPath, 'utf8')));
};

/** Serializes the registry byte-stably: numeric-id key order, 2-space, newline. */
const serializeRegistry = (registry: SlugRegistry): string => {
  const sorted = Object.fromEntries(
    Object.entries(registry).sort(([a], [b]) => Number(a) - Number(b)),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
};

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
    execFileSync('unzip', ['-o', zipPath, 'cities5000.txt', '-d', cacheDir], {
      stdio: 'ignore',
    });
  }
};

const main = async (): Promise<void> => {
  // Imported lazily so the pure modules stay decoupled from this I/O entry point.
  const { parseDump, selectCities } = await import('./geonames.ts');
  const { toCities } = await import('./citySlug.ts');
  const { reconcileChecksum, sha256 } = await import('./dumpChecksum.ts');

  await ensureDump();

  // Layer 1 — pin the dump. Hash the extracted bytes and reconcile against the
  // committed pin BEFORE doing any work, so drift stops the build up front.
  const dump = readFileSync(txtPath);
  const actualSha = sha256(dump);
  const pinnedSha = existsSync(shaPath) ? readFileSync(shaPath, 'utf8').trim() : undefined;
  // Enabled only by an affirmative value — so a stray `GEONAMES_ACCEPT_DRIFT=0`
  // can't silently wave drift through.
  const acceptDrift = ['1', 'true'].includes(process.env.GEONAMES_ACCEPT_DRIFT ?? '');
  if (reconcileChecksum(actualSha, pinnedSha, acceptDrift) === 'write') {
    writeFileSync(shaPath, `${actualSha}\n`);
    process.stdout.write(`Pinned GeoNames checksum → ${actualSha}\n`);
  }

  // Layer 2 — reuse frozen slugs from the registry; assign only genuinely new ids.
  const registry = readRegistry();
  const records = parseDump(dump.toString('utf8'));
  const selected = selectCities(records, TARGET_SIZE);
  const before = Object.keys(registry).length;
  const { cities, registry: nextRegistry } = toCities(selected, registry);

  // Trailing newline for POSIX-clean diffs; 2-space indent, byte-stable order.
  writeFileSync(outPath, `${JSON.stringify(cities, null, 2)}\n`);
  writeFileSync(registryPath, serializeRegistry(nextRegistry));
  const added = Object.keys(nextRegistry).length - before;
  process.stdout.write(
    `Wrote ${String(cities.length)} cities to ${outPath} ` +
      `(from ${String(records.length)} eligible rows; ` +
      `${String(added)} new slug${added === 1 ? '' : 's'} added to the registry)\n`,
  );
};

main().catch((error: unknown) => {
  process.stderr.write(`buildCities failed: ${String(error)}\n`);
  process.exitCode = 1;
});
