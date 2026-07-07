import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Recursively collects every `.astro` file under `dir`. */
function collectAstroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectAstroFiles(full);
    return entry.name.endsWith('.astro') ? [full] : [];
  });
}

/**
 * Regression guard for issue #77 — "glued" words before an inline tag.
 *
 * Astro's `compressHTML` (default `true`) collapses the whitespace between a
 * text node and an inline element to nothing when the tag opens on the *next*
 * source line, producing joins like "a fewanonymous" or "leaves it.Privacy".
 *
 * The fix is to separate them with an explicit `{' '}` expression instead of
 * relying on a source newline. This test scans every `.astro` template for the
 * anti-pattern and fails, pointing the author at the `{' '}` idiom so the bug
 * cannot silently regress.
 *
 * Detection is deliberately narrow: only the whitespace-string separator
 * (`{' '}` / `{" "}`, which Prettier may wrap across lines) counts as a fix —
 * an arbitrary interpolation like `{count}` right before an inline tag glues
 * exactly the same way and is still flagged.
 */
describe('inline-tag spacing (issue #77)', () => {
  /** The explicit space separator, e.g. `{' '}` or `{" "}` (may span lines). */
  const spaceSeparator = /\{\s*(['"])\s+\1\s*\}/g;

  /**
   * A text char (anything but whitespace or a closing `>`) sitting directly
   * against a newline that opens an inline `<strong>`/`<a>` — the eaten-space
   * bug. Run after normalizing `{' '}` to a real space, so a proper separator
   * leaves a space before the newline and no longer matches.
   */
  const gluedJoin = /[^\s>]\r?\n[ \t]*<(?:strong|a)[\s>]/g;

  const srcDir = fileURLToPath(new URL('.', import.meta.url));
  const astroFiles = collectAstroFiles(srcDir);

  it('finds .astro templates to scan', () => {
    expect(astroFiles.length).toBeGreaterThan(0);
  });

  it.each(astroFiles)('has no glued text→inline-tag joins in %s', (file) => {
    const normalized = readFileSync(file, 'utf8').replace(spaceSeparator, ' ');
    const offenders: string[] = [];

    for (const match of normalized.matchAll(gluedJoin)) {
      const line = normalized.slice(0, match.index).split('\n').length;
      const snippet = match[0].replace(/\s+/g, ' ').trim();
      offenders.push(
        `line ${line}: "${snippet}" ` +
          `(separate the word and the inline tag with {' '} so the space survives compressHTML)`,
      );
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
