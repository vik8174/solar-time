# Progress Log

Chronological record of what shipped. Newest on top. One entry per merged slice.

Format: `## Slice #N — <title>` · date · PR · outcome · notes.

---

## Feature #89 — Favicon + brand mark (Concept C "sundial") + header icon

- **Date:** 2026-07-11
- **PR:** _pending_ · **Issue:** #89 (hitl)
- **What:** replaced Astro's default rocket favicon with the chosen brand mark
  (Concept C — a gold ring + a hand pointing off noon to a sun dot), shipped the
  **full icon set** (previously 404 on prod: `.ico` / apple-touch / manifest),
  and placed the **same mark beside the header wordmark** (the #80 scope-add —
  "one symbol everywhere").
- **One SSOT (`src/lib/brandMark.ts`, D-028):** mark geometry + colours in one
  module (gold `#e8a923` = `--accent`, tile `#141414`). `Base.astro` inlines it
  in the header via `set:html`; the generator rasterises the **same** source —
  favicon, header, and OG identity can't drift. In `src/lib` (not `scripts/`) so
  the layout can import it and the D-012 gate covers it (string-assertion test).
- **Dark tile, no `@media` swap (D-028):** the old favicon swapped black↔white by
  colour scheme; Concept C is a single gold mark, and gold-on-transparent muddies
  on a light tab bar — so the mark **carries its own dark rounded tile** and reads
  crisply on both light and dark chrome with no swap. Stroke weights bumped from
  the sketch (ring/hand 3–4 → 9) for 16px crispness. apple-touch is baked from a
  **full-bleed opaque square** (iOS composites transparency on black + rounds it
  itself); tab/PWA icons use the rounded badge.
- **Reproducible raster set (`scripts/build-favicons.ts`, manual — like
  `build:cities`):** `npm run build:favicons` reuses `@resvg/resvg-js` (already a
  dep) for SVG→PNG and adds one exact devDep **`png-to-ico` 3.0.2** for the
  multi-size `.ico` (16/32/48). CI runs `npm run build`, not the generator, so
  zero CI cost — the committed `public/*` are the source of truth CI serves.
- **Head + manifest wired in `Base.astro`:** `favicon.svg` + `favicon.ico` +
  `apple-touch-icon` + `site.webmanifest` links and `<meta name="theme-color"
content="#141414">`. `site.webmanifest` `name`/`short_name` = **"Solar Drift"**
  (post-#94, not the ticket's stale "Solar Time"); icons 192/512 + apple-touch.
- **Decision:** D-028 (dark-tile brand mark + manual raster generator).
- **Tests:** `brandMark` (3 assertions on the SVG output) — 388 total green;
  coverage 99.7 / 95.7 / 99 / 100, well above the 90/80 gate.
- **Verified in-browser** (dev server in the worktree, #114): all six asset URLs
  resolve **200**; the sundial mark **legible at true 16px on both a white and a
  black background** (svg + ico), no colour-scheme swap; header mark sits beside
  the "Solar Drift" wordmark without breaking the #80 375px layout, in **both
  themes**; no console errors. `npm run build` green — 1086 pages, manifest
  `name` = "Solar Drift", all four asset URLs present in `dist/`.
- **Parallel to #90** (feat/scale-cities): zero shared files — this slice owns
  `public/*`, `Base.astro`, `src/lib/brandMark.ts`, `scripts/build-favicons.ts`;
  only `docs/*` is shared (both entries kept). Whoever merges second rebases.

## Feature #87 — Per-city unique prose + related-city internal links

- **Date:** 2026-07-11
- **PR:** #119 (merged) · **Issue:** #87 (closed)
- **What:** the thin `/[city]` pages now carry (1) a short, genuinely-unique
  descriptive sentence-or-two and (2) a "Related cities" block linking a few
  other city pages — the SEO discoverability slice (unique content + internal
  linking, spreading crawl/authority instead of leaving pages as isolated leaves).
- **Per-city prose (`src/lib/cityProse.ts`, pure, D-012):** derived from the
  **same build-time `Deviation`** the hero/breakdown use (R-001) — magnitude,
  direction, the longitude-vs-zone-meridian fact, and the real solar-noon clock
  time. **Genuinely distinct, not a number-swap template:** the opener varies
  across three magnitude bands (`close` / `runs` / `wide`) and the in-sync case,
  the direction flips the preposition, and the geographic clause reports which
  side of the zone meridian the city sits on (read from the sign of
  `longitudeOffset`). Baked at build like the SEO description — the accepted
  D-003 trade-off (not part of the client recompute).
- **Related cities (`src/lib/relatedCities.ts`, pure, D-012):** relation is
  **same time zone first** (most product-true — same UTC offset, different
  longitudes ⇒ different solar drift), ranked most-populous-first with a slug
  tie-break (deterministic, date-independent); **falls back to nearest by
  great-circle distance** to top up the cap. The fallback is load-bearing, not an
  edge case: **272 of ~355 zones in the dataset are singletons** (e.g. Adamstown /
  `Pacific/Pitcairn` → its Pacific neighbours). Reuses the existing
  `haversineKm` (now exported from `findNearestCity.ts`) and `parseLatitude`
  (`geoIndex.ts`) — no new distance code. Current city excluded, cap 6.
- **Build-time only, zero client JS (D-013):** links are derived in
  `getStaticPaths` over the full `CITIES` registry and emitted as plain crawlable
  `<a href data-astro-prefetch>` anchors by a new `RelatedCities.astro`. Verified
  the city-page island bundle carries **no city names / no `relatedCities`** (the
  only `related*` hit in client JS is Preact's `relatedTarget`). Perf unaffected.
- **#116 safety:** related links are **derived from the registry at build time**
  (`/${city.slug}`), never hardcoded, so a parallel #116 slug reshuffle is
  reflected on the next rebuild for free. Unit tests use **synthetic fixtures**,
  not real dataset slugs, so they can't break when #116 reshapes the data.
- **#86 untouched:** the JSON-LD `BreadcrumbList` frontmatter/const on `<Base>`
  is intact — the prose and related block are additive `.content` body only.
- **Gotcha recorded in code:** `relatedRegistry` must be projected **inside**
  `getStaticPaths` — Astro evaluates that function in isolation, so a module-scope
  const is out of scope there (`ReferenceError` at build until moved in).
- **Decision:** D-027 (relation ranking + build-time-derived prose/links).
- **Tests:** 27 new (`cityProse` 10, `relatedCities` 9, + the shared helper) —
  364 total green; coverage 99.7 / 95.7 / 99 / 100, well above the 90/80 gate.
- **Verified in-browser** (dev server in the worktree, #114): big-offset
  `/baoshan-cn` (89 min, same-tz peers), singleton `/adamstown` (nearest
  fallback), numbers match the hero (R-001); clean at 375 / 768 / 1280 in **both
  themes**. `npm run build` green — 1086 pages in 2m41s.

## Fix #116 — Freeze city slugs so a `cities.json` regeneration can't rename URLs

- **Date:** 2026-07-10
- **PR:** [#118](https://github.com/vik8174/solar-drift/pull/118) · **Issue:** #116 (R-016)
- **What:** Slugs **are** the public `/[city]` URLs, but slug assignment was a function of the
  **whole dataset** (collision → `-{countryCode}`, else `-{geonameId}`). So a city entering or
  leaving the upstream GeoNames dump silently **renamed a _different_ city's URL** — the #91 bug
  (`san-juan-pr → san-juan` when Argentina's San Juan dropped out). Fixed with the owner-chosen
  **layers 1 + 2** (checksum pin + slug registry). Layer 3 (redirects for departed cities) is
  **deferred** to before indexing (R-016 residual). See **ADR D-026**.
- **Layer 2 — slug registry (root fix):** new committed **`scripts/slug-registry.json`** maps
  `geonameId → slug`. `toCities(records, registry)` (`scripts/citySlug.ts`) now **reuses a
  registered id's slug verbatim** and runs the derivation rule **only** for new ids, disambiguating
  a fresh slug against both same-run peers and every already-frozen slug; it returns
  `{ cities, registry }` and never mutates the input. An existing city keeps its URL forever; drift
  and #90's scale-up can only _add_ slugs.
- **The seeding trap:** `cities.json` carries **no `geonameId`**, so the registry can't be seeded
  from the shipped dataset — it's seeded **during regeneration** (start empty → `build:cities`
  derives every slug and records it). Verified the empty-registry path is **byte-identical** to the
  old algorithm on the current dump (**0 slug diffs / 1084 cities**), so `cities.json` is
  **unchanged on `main`** — the final regeneration introduced zero churn.
- **Layer 1 — checksum pin:** `buildCities.ts` hashes the **extracted `cities15000.txt`** (not the
  `.zip` — metadata isn't byte-stable) and compares it to committed **`scripts/cities15000.sha256`**
  before doing work. Drift → **fails loudly** with both hashes; **`GEONAMES_ACCEPT_DRIFT=1`** is the
  sanctioned bump (skips the compare, rewrites the pin — how #90 will refresh). The pure
  compare/rewrite (`sha256` + `reconcileChecksum`) lives in new **`scripts/dumpChecksum.ts`** so
  it's unit-testable **without** the network (`buildCities.ts` runs `main()` on import).
- **CI untouched:** CI runs `npm run build` (reads the committed `cities.json`), **never**
  `build:cities` — the pin + registry only fire on a manual regeneration.
- **Registry is validated at the trust boundary:** pure `parseSlugRegistry` (`citySlug.ts`) rejects
  a non-object, a non-string slug, and — critically — **duplicate slugs across ids** (uniqueness is
  the registry's whole job). A hand-edit / bad merge mapping two cities to one URL **fails the build
  loudly** (verified: exit 1, names the slug + both ids), never collapsing silently into a dup route.
- **Tests (`scripts/*.test.ts`, which now run — R-017):** the core **stability** regression —
  remove a colliding San Juan and assert the survivor's slug doesn't move (**fails on the old
  registry-less code**, which renames `san-juan-pr → san-juan`; passes now); add a colliding city
  and assert the frozen id keeps its slug while the newcomer adapts; new-id assignment + write-back;
  registry immutability; determinism; `parseSlugRegistry` (non-object / non-string / **duplicate
  slug** / valid+empty); and `dumpChecksum` (match passes / mismatch throws / `ACCEPT_DRIFT` rewrites
  / absent-pin throws) — network kept out.
- **Verify — regeneration end-to-end:** deleted `scripts/.cache/`, ran
  `GEONAMES_ACCEPT_DRIFT=1 npm run build:cities` (seeds registry + pin), then a plain re-run =
  **no-op** (pin passes, 0 new slugs, `cities.json` unchanged). Drift path confirmed: a tampered
  pin fails loudly (exit 1); `ACCEPT_DRIFT` rewrites it. Gate green: typecheck / lint / format:check
  / **test:coverage (366 tests, 100 stmts·funcs·lines / 97.46 branches** on `src/lib`+`src/domain`;
  `scripts/` runs but stays out of `coverage.include`, D-012/R-017).
- **Scope:** `scripts/{buildCities,citySlug,dumpChecksum}.ts` (+ `citySlug`/`dumpChecksum` tests),
  new `scripts/slug-registry.json` + `scripts/cities15000.sha256`, `.claude/rules/dev-flow.md`
  (regeneration + `ACCEPT_DRIFT` docs). **`cities.json` byte-unchanged; no `src/` app code.**
  Ran parallel to #114/#117 (disjoint files). **code-reviewer → PASS WITH NOTES**: both ≥75 notes
  fixed pre-PR — the registry uniqueness guard above, and extracting `parseSlugRegistry` as a pure,
  unit-tested function (mirroring `dumpChecksum`).

## Fix #114 — Worktree `node_modules` symlink broke `astro dev` (island never hydrated)

- **Date:** 2026-07-10
- **PR:** #117 (merged) · **Issue:** #114 (closed)
- **Symptom:** in a worktree from `scripts/ticket-worktree.sh` (R-008), `npm run dev` served `/`,
  but the `CitySearch` island stayed inert markup. Console:
  `[astro-island] Error hydrating /src/components/CitySearch.tsx` + a **403** on
  `/@fs/…/solar-time/node_modules/@astrojs/preact/dist/client-dev.js`.
- **Root cause:** the paved-path script (D-015) symlinks `node_modules` at the primary clone —
  the symlink itself came later, in #37 / PR #38.
  Two Vite defaults then collide: `resolve.preserveSymlinks: false` resolves deps to their **real**
  path (inside the primary clone), while `server.fs.allow` defaults to the **project root** (the
  worktree). The real paths sit outside it → the dev server 403s the island's renderer chunk.
  It hid since #37 because `pre-push` and `astro build` resolve modules Node-side, where a symlink
  is transparent — only the **dev server's** fs guard rejects it.
- **Fix (option A — symlink preserved):** `astro.config.mjs` now widens
  `vite.server.fs.allow` to the symlink's **real** `node_modules`, computed at config load via
  `realpathSync`. No hardcoded paths. Two guards, both load-bearing:
  - `allow` **replaces** Vite's default (`allow: raw?.fs?.allow ?? [workspaceRoot]`) rather than
    extending it — so the **project root is listed too**, or the dev server would stop serving the
    worktree's own `src/`.
  - Returns `undefined` when `node_modules` is absent (fresh clone, pre-install) or is **not a
    symlink** (primary clone, tested via `lstatSync().isSymbolicLink()`) — the `vite` key is then
    **omitted entirely** and Vite runs on stock defaults. Verified: primary → `undefined`;
    worktree → `[<worktree>, <primary>/node_modules]`.
- **Why not the alternatives:** **B** (`preserveSymlinks: true`) risks a duplicate Preact instance
  (broken hooks/context) and is hard-to-reverse; **C** (real `npm install` per worktree) throws away
  the #37 win — the whole point of the symlink is an instant `pre-push` with no `firebase-tools`
  re-download. A is machine-agnostic and a no-op outside a worktree.
- **Verified in a fresh worktree** (not the primary clone — it _cannot_ reproduce this, its
  `node_modules` is a real directory): renderer chunk `403 → 200`, own `src/` files still `200`,
  typing a city (`Prague`, `Kyiv`) opens the suggestion `listbox`, browser console clean.
  `pre-push` (typecheck/lint/format/coverage) still runs immediately with **no manual
  `npm install`**. `npm run build` green. Primary clone re-verified unregressed.
- **Workers can now trust `npm run dev` inside a worktree** — the warning that had to be pasted into
  every recent handoff is retired.
- **Also found:** the symlink makes every worktree share the primary clone's Vite dep-optimizer
  cache (`node_modules/.vite`). Pre-existing, not introduced here — logged as **R-018**.
- **Scope:** `astro.config.mjs` + `.claude/rules/dev-flow.md`. No app code, no `src/`, no tests
  (the dev server's behaviour is the test; the coverage gate is untouched).
- **Review:** code-reviewer → PASS.

## Feature #86 — JSON-LD structured data (WebSite, WebApplication, BreadcrumbList)

- **Date:** 2026-07-10
- **PR:** #115 (merged) · **Issue:** #86 (closed)
- **What:** The site emitted no structured data. It now ships JSON-LD in the `<head>`:
  **`WebSite` + `WebApplication`** on the home page `/`, and **`BreadcrumbList`**
  (`Home → {City}`) on every `/[city]` page.
- **Where the value lands today:** `/` is still `noindex` (D-005), so crawlers won't read the
  home nodes until **#82** makes the landing indexable — the markup is correct and waiting.
  The **immediately-useful half is the breadcrumb**, because the city pages _are_ indexable
  on prod (D-020). 1084 city pages gained it.
- **`FAQPage` deliberately not shipped.** Issue #86's title mentions it, but its body defers
  the FAQ to **#82** (the landing ticket owns the content). Inventing FAQ copy here would be
  schema that contradicts the visible page. Follow-up after #82.
- **Architecture (mirrors `seoMeta.ts`):** new **pure** `src/lib/jsonLd.ts` — `homeJsonLd`,
  `cityBreadcrumbJsonLd`, `serializeJsonLd`. It takes the **origin as a parameter**; it never
  imports `Astro.site` or `src/config/site.ts`, so it is unit-testable under the D-012 gate
  (17 tests, 100% stmts/branches/funcs/lines on the module). See **D-025** for the emission
  contract.
- **Three real traps, each covered:**
  1. Astro **HTML-escapes** text interpolation — a bare `{JSON.stringify(x)}` would turn `&`
     into `&amp;` and corrupt the payload. The tag uses **`set:html`** (+ `is:inline`).
  2. `serializeJsonLd` rewrites every **`<`** to its JSON unicode escape, so a literal
     `</script>` inside a string can't terminate the tag. Round-trip tested.
  3. All `url` / `@id` / breadcrumb `item` values are **absolute**, built with
     `new URL(path, origin)` (so odd slugs percent-encode correctly).
- **Unset-`site` guard, actually verified:** `Base.astro` takes a **builder** prop
  (`jsonLd?: (origin: string) => …`) rather than a value, and calls it only when `Astro.site`
  is set — the same `&&` guard that protects canonical/OG. Probed by rebuilding with `site:`
  commented out of `astro.config.mjs`: the `<script>` **disappears entirely** (0 blocks on
  home and on `/prague`), exactly like `rel="canonical"`. No relative or `undefined` URL.
- **Verified in `dist/`:** the tag is present on `/index.html` and on city pages, is valid
  JSON (`JSON.parse`), carries `@context: https://schema.org`, and every URL is absolute.
  `/privacy` has none (correct). Payload is **931 B** on home, **~270 B** per city page.
  Nothing entered the client bundle (no `schema.org` / `BreadcrumbList` in `dist/_astro/`).
- **Not validated (honest limit):** Google's Rich Results Test / `validator.schema.org` were
  **not** run — both need a public URL or an interactive browser, neither available in this
  headless session. Worth a manual paste from the PR preview before merge.
- **`[city].astro` touched in frontmatter only** (a const + one `<Base>` attribute), so **#87**
  — which rewrites that page's body — rebases clean.

## Chore #102 — Bump `actions/checkout` + `actions/setup-node` v4 → v5 (Node 20 EOL)

- **Date:** 2026-07-10
- **PR:** #113 (merged) · **Issue:** #102 (closed)
- **What:** Every CI run logged _"Node.js 20 is deprecated. The following actions target Node.js 20
  but are being forced to run on Node.js 24: `actions/checkout@v4`"_. Cosmetic while the runner's
  Node 20 shim exists, but the v4 lines break when it's removed. Bumped the pinned majors to the v5
  lines (which target Node 24): **3× `actions/checkout`, 2× `actions/setup-node`** — `ci.yml` jobs
  `ci` + `preview`, and `preview-cleanup.yml` job `reclaim`. Spun off from #96 / R-015.
- **Scope — `uses:` lines only:** the `with:` blocks (`node-version: 22`, `cache: npm`) are
  untouched, and so is the `ci` job's `name: Checks` — that string **is** the required status-check
  context under `main`'s branch protection (R-003), so renaming it would silently break the merge
  gate for every future PR. The `reclaim` job keeps its `checkout` too — the Firebase channel ops
  need `firebase.json` on disk (the #96 failure mode).
- **No tests:** the diff is 5 `uses:` lines of YAML — no logic, nothing unit-testable. The CI run
  itself is the verification.
- **Verify — read from the actual run logs, not assumed:** local gate green (typecheck / lint /
  format:check / test:coverage, 328 tests). PR run
  [29096404901](https://github.com/vik8174/solar-drift/actions/runs/29096404901): **zero** hits for
  `Node.js 20 is deprecated` (the only `deprecated` lines left are npm's unrelated
  `node-domexception` notice); `setup-node@v5` resolved **`node: v22.23.1`** from the tool cache and
  the npm cache **restored on a primary-key hit** in both jobs, so `npm ci` ran cached. Required
  **`Checks`** green (branch protection still lists exactly `["Checks"]`, `strict: true`) and
  **`PR preview deploy` + `Deploy Preview`** green.
- **`preview-cleanup.yml` verified separately:** it never runs on an open PR (triggers are
  `pull_request: closed` + `workflow_dispatch`), so `checkout@v5` there would have shipped
  unexercised. Dispatched it **against this branch's ref** — run
  [29097266068](https://github.com/vik8174/solar-drift/actions/runs/29097266068), `reclaim` success:
  `checkout@v5` put `firebase.json` on disk (no _"Not in a Firebase app directory"_), and the prune
  reclaimed 4 stale `pr*` channels (`pr113`, `pr111`, `pr108`, `pr104`). Preview channels for open
  PRs regenerate on their next push.

## Feature #91 — Search results show "City · Country" instead of a cryptic alt-name

- **Date:** 2026-07-10
- **PR:** #112 (merged) · **Issue:** #91 (closed)
- **What:** Search rows showed `City · <alt-name>` where the second part was a cryptic
  exonym (from #43) — `Prague · Praag` reads as "strange text". Results now show
  **`City · Country`** (`Madrid · Spain`), and the matched alt appears **only when the match
  actually came via an alt** (`Praha` → `Prague · Praha`), preserving #43's "why did this row
  match" value. Essential once #90 scales the dataset (duplicate names across countries).
- **Build-time country resolution:** `countryCode` was already parsed by `geonames.ts` but
  dropped at the `toCities` projection. New pure helper `resolveCountryName(code)` in
  `scripts/citySlug.ts` resolves it with the built-in
  `Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })` — no dependency. The
  resolved **name** (not the code) is stored in `cities.json` (static, review-friendly).
  Unresolvable → the field is **absent**, so the UI shows no country and never a dangling `·`.
- **The `ZZ` trap:** `fallback: 'none'` returns `undefined` for unassigned codes (`XX`, `AA`),
  but **`ZZ` is a real CLDR territory** that resolves to the string `"Unknown Region"`. A
  self-echo check (`name === code`) does _not_ catch it. Guarded explicitly — see D-024.
- **Alt-match detection:** Fuse now runs with `includeMatches: true`; `searchCities` returns
  `CityMatch[]` (`{ city, matchedAlt? }`) instead of `SearchCity[]`. `matchedAlt` is set only
  when the result carries **no `name` key** among its matches. When several alts match one
  query (`praha` hits Praag/Prag/Praha), the alt **the user actually typed** wins; otherwise
  the lowest `refIndex`, deterministically.
- **a11y (#43 preserved):** the option's accessible name stays the city (`aria-label`); the
  country/alt hint is a decorative `aria-hidden` span. Verified in the live DOM.
- **Dormant tests woken up (important):** `vitest.config.ts` scoped `test.include` to `src/**`,
  so **`scripts/*.test.ts` never ran** — `citySlug.test.ts` and `geonames.test.ts` were dead
  weight. Added `scripts/**` to the run (still **out of `coverage.include`** — generator glue,
  not shipped logic). Enabling them immediately exposed a **pre-existing wrong assertion** in
  `citySlug.test.ts` (expected `springfield-10`; the colliding record correctly takes its own
  id → `springfield-20`). Fixed the assertion, not the behavior. See R-017.
- **Dataset regenerated:** `npm run build:cities`, deterministic (byte-identical on re-run),
  1084 cities, **all 1084 resolve a country** (242 distinct). Upstream GeoNames drift came
  along for the ride — see R-016. Search-index payload **43.2 → 46.7 KB gzip (+3.5 KB)**.
- **Verify:** gate green (typecheck / lint / format:check / **328 tests**, coverage
  100 stmts / 97.5 branches). Live dev preview in **both themes**: `Madrid · Spain`,
  `Praha` → `Prague · Praha`, `Minhen` → `Munich · Minhen`, `Dunaj` → `Vienna · Dunaj`;
  accessible name = city, hint `aria-hidden="true"`.

## Feature #80 — Home-linking "Solar Drift" brand wordmark in the header

- **Date:** 2026-07-09
- **PR:** #110 (merged) · **Issue:** #80 (closed)
- **What:** From `/privacy` and any `/[city]` there was **no in-page way back to `/`** — the header
  held only the search island; the footer is `Privacy · Feedback · Support`. Added a home-linking
  **"Solar Drift" wordmark** (the standard click-logo-to-home pattern), which also gives the live
  header the brand identity it lacked and keeps it consistent with the OG card wordmark.
- **Brand string:** the wordmark reads **"Solar Drift"**, not "Solar Time". Issue #80 predates the
  rename (#94) and its text says "Solar Time" throughout — the live brand is "Solar Drift"
  (`Base.astro` `og:site_name`, OG card), so the wordmark matches the code, not the stale ticket.
- **Layout — centered wordmark above the search:** a real `<a href="/">` placed **inside** the
  `<header transition:persist>` (persists across View Transitions like the rest of the header),
  above `<CitySearch>`. Centered to match the site's existing centered rhythm (search is a centered
  480px column; footer links are `justify-content: center`). `inline-flex` so **only the text** is
  the click target (no dead-whitespace navigation). Mono family (`--mono`) to match the OG wordmark
  and the `h2` headings; the wordmark↔search gap uses the #83 spacing scale (`--space-sm`), not a
  magic number.
- **a11y:** `aria-current="page"` on the home page only (`Astro.url.pathname === '/'`); on mobile
  (`@media max-width: 480px`) a **44px tap target** via `min-height: var(--tap-min)`, mirroring the
  proven `.footer-links` pattern. Not an `<h1>` — the home hero owns the page heading; this is a
  nav link.
- **Scope — markup + CSS only:** `src/layouts/Base.astro` (markup + its `<style>`) only. No
  `tokens.css` change needed (reused #83's scale + slice-#13's `--tap-min`). No domain / analytics
  / `src/lib` change → the D-012 coverage gate is unaffected (no new unit tests — correct for
  markup/CSS).
- **Verify:** gate green (typecheck / lint / format:check / test:coverage 292 tests). Verified on
  the dev preview in **both themes** at **375 / 768 / 1280** across **home / `/[city]` (prague) /
  `/privacy`**: no horizontal scroll anywhere; wordmark centered above a usable search; tap target
  = 44px at ≤480px, natural height (min-height auto) on desktop; `aria-current="page"` present on
  home, absent elsewhere; the anchor resolves to `/` and clicking it from `/privacy` and `/prague`
  returns to `/`. Desktop layout otherwise unchanged apart from the added wordmark.

## Fix #83 — Vertical spacing scale + consistent section rhythm

- **Date:** 2026-07-09
- **PR:** #107 (merged) · **Issue:** #83 (closed)
- **What:** The lower half of the city + home pages read as disjointed fragments — every stacked
  section set its own unrelated magic-number margin (40 / 36 / 24 / 16 / 12 / 8 / 32px), so the
  gaps didn't relate to each other. There was **no spacing scale** in `tokens.css`. Added one and
  applied it so the TOTAL → Share → support → footer flow reads as one coherent rhythm.
- **Scale (extends D-006 SSOT, no new ADR):** a small stepped scale on a 4px baseline —
  `--space-xs 8 / sm 12 / md 16 / lg 24 / xl 32` — plus **one** fluid token
  `--space-section: clamp(var(--space-lg), 6vw, var(--space-xl))` (24→32) for the single
  inter-section gap, mirroring the existing `--page-pad-*` clamp approach. Six tokens, each used
  ≥1× (no over-tokenization / YAGNI). Horizontal flex gaps and intra-control spacing (row/button
  padding, 2–4px label nudges) deliberately left out of scope — the ticket is **inter-section**.
- **Three oversized gaps tightened + unified into one 24–32px band:**
  - **TOTAL → Share/geo:** 36–40px → `--space-section` (`.share` / `.geo` / `.breakdown` top).
  - **Share → support:** 40px (page frame) → `--space-section` via the `.page` **bottom** padding
    (the "page side" — top still uses `--page-pad-y`, so the frame stays symmetric-ish and the
    slice-#13 layout token is untouched).
  - **support → footer:** 8 + 24 = 32px → 8 + 16 = 24px (footer **top** padding 24→16, `--space-md`).
- **Scope — CSS/visual only:** `tokens.css`, `Breakdown.astro`, `[city].astro`, `index.astro`,
  `Base.astro`. No domain / analytics / `src/lib` change → the D-012 coverage gate is unaffected
  (no new unit tests — correct for CSS). Landed clean with no overlapping work in flight; **unblocks
  #82 (landing) + #80 (wordmark)**, which now build on the scale instead of re-introducing magics.
- **Verify:** gate green (typecheck / lint / format / test:coverage 292 tests / build). Eyeballed on
  the dev preview in **both themes** (spacing is theme-independent; the light `@media` block only
  redefines colors) at **375 / 768 / 1280** — `--space-section` resolves 24 (375) → 32 (≥533px);
  no horizontal scroll; desktop not regressed (36/40→32 is the intended tightening); `/privacy`
  footer not regressed (support aside off there, D-008; footer spacing applies). code-reviewer →
  **PASS** (0 issues ≥75 — naming/consistency/correctness/YAGNI all clean). Squash commit `307cdd3`.
- **Infra note:** the non-required `PR preview deploy` first went red — GitHub never acquired a
  hosted runner ("job was not acquired by Runner … even after multiple attempts"), a transient
  Actions runner-availability flake, **not** the change. `gh run rerun --failed` cleared it; the
  required `Checks` context was green throughout.

## Fix #79 — Search: close + clear on select, add a clear (×) button

- **Date:** 2026-07-08
- **PR:** #105 (merged) · **Issue:** #79 (closed)
- **What:** Selecting a city left the dropdown **open with the stale query** on the destination
  page, and there was no visible way to empty the field (Escape was desktop-only). The site-wide
  search island lives in `<header transition:persist>` (`Base.astro`), so the same `CitySearch`
  instance — with its `query`/`open`/`activeIndex` state — was carried across the View-Transition
  navigation to `/{city}` and arrived dirty.
- **Fix (a) — close + clear on both paths:** moved the `setOpen(false)` / `setQuery('')` /
  `setActiveIndex(0)` reset **out** of the `onSelect`-only (test) branch in `selectCity`, via
  `onSelect?.(city)`, so it fires for both native-nav (prod) and injected `onSelect` (tests).
  Setting state right before the `<a>` nav doesn't cancel it → the persisted island lands on the
  destination **empty and closed**.
- **Fix (b) — clear (×) button:** a real `<button type="button" aria-label="Clear search">`,
  shown only when `query !== ''`; clears the field and **keeps focus on the input** (retype), list
  self-closes (no query → no results). `--tap-min` (44px) touch target on mobile; styled via
  `tokens.css` (SSOT). Reuses the existing Escape-clear intent as a visible, mobile-usable control.
- **Scope:** `CitySearch.tsx` + `CitySearch.css` + `CitySearch.test.tsx` only — pure
  `src/lib/citySearch.ts` (ranking) untouched. Ran isolated (no file overlap with #83 in flight).
- **Tests (TDD, behavioral):** select → listbox gone **and** input empty; × clears + keeps input
  focus; × hidden when empty; Escape-clear regression guard.
- **Verify:** gate green (typecheck / lint / format / coverage / build); PR `Checks` (1m28s) +
  Deploy Preview + PR preview all green. Merged via `gh api` (squash), commit `5de5292`.
- **Follow-up (non-blocking):** the real View-Transition acceptance repro (empty + closed box on
  the destination page) is best eyeballed on the green **deploy preview** — jsdom can't exercise a
  View Transition, so the component test covers the reset but not the persisted-island landing.

## Chore #94 — Brand rename: Solar Time → Solar Drift

- **Date:** 2026-07-08
- **PR:** #103 (merged) · **Issue:** #94 (closed)
- **What:** Renamed the product **Solar Time → Solar Drift** — the name now conveys the core (the
  _drift_ between clock time and true solar time) and avoids the overloaded "time shift". Replaced
  the brand string in all 9 user-facing spots: `og:site_name` (`Base.astro`), the OG wordmark +
  brand-card title (`renderOgCard.ts`), `og/home.png.ts`, the home + privacy `<title>`s, the
  privacy copy, and `README.md`. Tagline "How far your clock is from the sun" unchanged.
- **Out of scope (unchanged):** Firebase project IDs `solar-time-prod`/`-stage` (immutable GCP IDs;
  internal deploy targets) and the GitHub repo slug — the repo rename to `solar-drift` is a
  separate coordinator action (Settings → Rename, auto-redirects).
- **Verify:** OG PNGs regenerated with the `SOLAR DRIFT` wordmark; no brand "Solar Time" left in
  `dist` (only the `*.web.app` deploy URLs). Preview checks green (first PR since the #96 fix).
- **Chosen domain:** `solardrift.app` (free; `.app` = HTTPS-native) — see R-006.

## Fix #96 — Firebase preview-channel quota exhausted (429 on every PR)

- **Date:** 2026-07-08
- **PRs:** #99 + #100 (merged) · **Issue:** #96 (closed) · **Risk:** R-015 (resolved)
- **What:** Per-PR Firebase preview channels on `solar-time-stage` were created with `expires: 7d`
  and **never deleted on PR close**, so within any 7-day window the accumulated `pr*` channels hit
  the per-site quota → `429 RESOURCE_EXHAUSTED` on every same-repo PR's preview deploy.
- **Fix (4 parts):**
  1. `ci.yml`: TTL `expires 7d → 2d` (self-reclaim backstop).
  2. `ci.yml`: `continue-on-error` on the preview **deploy step** — an infra preview failure no
     longer paints the run red, but a genuine build regression still fails the job.
  3. New `preview-cleanup.yml` (separate file so `ci.yml`'s required `Checks` context is untouched)
     — one `reclaim` job: on `pull_request: closed` deletes the PR's channel by `pr<N>-` prefix
     (never guesses the truncated suffix); on `workflow_dispatch` prunes **all** `pr*` channels via
     the same `FIREBASE_SERVICE_ACCOUNT_STAGE` SA — no local Firebase login needed.
  4. One-time prune dispatched post-merge cleared **50 stale channels**; #100 then got a healthy
     preview channel again (state `CLEAN`, no 429) — first green preview since the outage.
- **Gotcha:** the reclaim job needs `actions/checkout` (firebase channel ops require `firebase.json`);
  #99 shipped without it and failed silently (the `--json` redirect hid the error), fixed in #100.
- **Scope:** `.github/workflows/` only — no app/site code touched; `Checks` gate unaffected throughout.

## Fix #78 — Keep the unit on the number's baseline on the OG share card

- **Date:** 2026-07-07
- **PR:** #95 (merged) · **Issue:** #78 (closed)
- **What:** On the OG share card the unit "min" dropped below the big number. satori's
  `alignItems: 'baseline'` is unreliable across very different font sizes (number ~240px vs unit
  84px), so the small unit landed too low.
- **Fix:** control alignment explicitly in `renderOgCard.ts` — the number+unit row uses
  `alignItems: 'flex-end'` with `lineHeight: 1` on both, and the unit gets a `paddingBottom` of
  `k · (numberSize − unitSize)` (`unitBaselineNudge`) that cancels the descent gap so it sits on
  the number's baseline. Holds across all `valueFontSize` branches (240/170/130).
- **Scope:** layout-only in the `src/og` adapter (outside the D-012 gate); `ogCardModel` (pure)
  untouched. Verified on the regenerated PNGs.

## Fix #77 — Missing space before inline tags that wrap to a new line

- **Date:** 2026-07-07
- **PR:** #93 (merged) · **Issue:** #77 (closed)
- **What:** On `/privacy` and home, words glued to a following bold/link — "a fewanonymous",
  "arenever stored", "leaves it.Privacy". `compressHTML` (Astro default `true`) collapses the
  whitespace between a text node and an inline element **to nothing** when the tag opens on the
  _next_ source line; a same-line space (`any <strong>`) survives.
- **Fix:** explicit `{' '}` separator before each of the **5** affected inline tags
  (`privacy.astro` ×3, `index.astro`, `Base.astro`) — point fix, keeps `compressHTML`/minification
  on (no global `compressHTML: false`). Verified in built `dist` (space present; glued forms gone).
- **Guard:** `src/inlineTagSpacing.test.ts` scans every `.astro` for the anti-pattern (text char
  directly against a newline-opened `<strong>`/`<a>`). Only a real `{' '}`/`{" "}` separator counts
  as a fix — an arbitrary interpolation like `{count}` glues the same way and is still flagged.
- **Spun off:** the red `Deploy Preview` / `PR preview deploy` checks are a pre-existing infra
  failure (Firebase preview-channel quota), not this change — filed as R-015 / issue #96.

## Ops — Repo public + `main` branch protection (R-007, R-003)

- **Date:** 2026-07-07
- **PR:** #75 (this journal) · actions applied directly via `gh` (no source change)
- **R-007 — repo public:** flipped `vik8174/solar-time` to **public**. Pre-flip safety scan
  was clean — real `.env`/`.env.prod` never committed (only `.env.example` tracked), no real
  Firebase/Sentry keys anywhere in history (client `PUBLIC_*` keys are non-secret by design, D-008).
- **R-003 — branch protection on `main`:** require PR before merge (0 approvals — solo maintainer),
  required status check **`Checks`** strict/up-to-date, `enforce_admins` on, force-push + branch
  deletion blocked. Repo merge methods restricted to **squash-only** (merge-commit + rebase off).
  `stage` intentionally left unprotected (no deploy gate needed there yet).
- **Consequence:** every future PR — including coordinator docs chores — must now show green
  `Checks` on GitHub before the `gh api …/merge` (R-004) will succeed. This is the intended cost.
- **Release-readiness:** with R-014/R-005/R-007/R-003 closed, the only open risks are R-006
  (custom domain) and R-011 (OG font glyphs, minor). Site is live-ready on `solar-time-prod.web.app`.

## Ops — R-014 analytics + monitoring live

- **Date:** 2026-07-07
- **Type:** Ops ticket (config + deploy + verify) — **no code change**. Feature built in slice #10,
  hardened in fix #68. Journal-only commit via chore-worktree (R-008).
- **What:** Brought analytics + error monitoring **live** on both envs by wiring the real keys into
  the git-ignored `.env` (stage) / `.env.prod` (prod) and redeploying. Analytics had shipped
  **dormant** because Firebase `measurementId` was empty until Google Analytics was linked (R-014).
- **Linked / keys:**
  - **stage** — `solar-time-stage`, GA4 linked, `measurementId=G-LL3CV51B2Q`.
  - **prod** — `solar-time-prod`, GA4 linked, `measurementId=G-NZ83CW3T21`.
  - **Sentry** — one DSN for both (`o4511693747388416.ingest.de.sentry.io`, EU); `environment`
    split by `SITE_ENV` (staging / production).
  - Firebase account confirmed **vik8174@gmail.com** (R-005) — personal is the intended home.
- **Deploy:** `deploy:stage` → https://solar-time-stage.web.app, then `deploy:prod` →
  https://solar-time-prod.web.app. Both green.
- **In-browser verification (both envs, per fix-#68 method):**
  - `page_view`, `city_selected` (`ep.slug=berlin`), `geolocation_used` pings all fire to
    `region1.google-analytics.com/g/collect` with the right `tid`.
  - **Cookieless holds:** `document.cookie` empty (zero `_ga`); every collect ping carries
    `gcs=G100` / `npa=1` (Consent Mode signature).
  - **No coordinates** in any `geolocation_used` payload (`en=geolocation_used&_ee=1&ep.origin=firebase`).
  - **Sentry captured** a test error on each env — `environment=staging` / `production`, HTTP 200,
    `infer_ip: never`, no GPS in payload/breadcrumbs, no transaction envelopes (`tracesSampleRate: 0`).
  - **Not verified headless:** GA4 Realtime console (needs an authenticated console session) — left
    for Viktor to eyeball.
- **Follow-ups (separate tickets, do not block):** R-006 custom domain, R-003 branch protection,
  R-007 repo public.

## Slice #13 — Responsive / mobile pass (375px → desktop)

- **Date:** 2026-07-07
- **PR:** #71 (merged) · **Issue:** #13 (closed)
- **What:** Cross-screen adaptive pass so every page reads cleanly from **375px → desktop**.
  **Last roadmap slice** — all tracer bullets #2–#13 now shipped; only issue #1 (PRD) stays open.
- **Strategy — fluid-first, one mobile breakpoint:** a single `@media (max-width: 480px)`,
  aligned with the existing `--content-max: 480px` (one number, not a new magic value).
  Breakpoint + layout scale live as tokens in `tokens.css` (D-006 SSOT): `--content-max`,
  fluid `--page-pad-x/y` (`clamp`), `--tap-min: 44px`, documented `--bp-mobile`.
- **Overflow guard:** `body { overflow-wrap: break-word }` prevents long city names from
  breaking the layout. Tap targets ≥44px on mobile (search input, dropdown options, geo/share
  buttons, footer nav links, centered dismiss ×); inline sentence links left as-is (WCAG 2.5.5
  exception).
- **Scope — visual only:** domain / analytics / OG / `src/lib` untouched; no new testable code.
  HeroNumber left alone (already fluid).
- **Files:** `src/styles/tokens.css`, `src/layouts/Base.astro`,
  `src/pages/{index,[city],privacy}.astro`, `src/components/{CitySearch.css,SolarScale.astro}`.
- **Verify:** 0 horizontal scroll at 320/375/768/1280 (home, `/[city]`, longest name
  `Petropavlovsk-Kamchatsky`, `/privacy`); tap targets measured 44px; dropdown within viewport;
  desktop visually identical to before. Gate green (typecheck / lint / format / 100% lib coverage /
  build 1087 pages). code-reviewer → PASS WITH NOTES; the ≥75 note (× glyph centering in the 44×44
  box) fixed pre-merge.

## Fix #68 — GA4 truly cookieless via Consent Mode

- **Date:** 2026-07-07
- **PR:** #68 (merged) · follow-up to slice #10 (analytics)
- **What:** Fixed a **privacy defect** found while verifying slice #10 in-browser with live keys:
  the site still set `_ga` / `_ga_<id>` cookies, violating the "zero cookies" acceptance
  criterion (PRD story 29). Corrects the mechanism recorded in **ADR D-022**.
- **Root cause:** the cookieless design relied on gtag `client_storage: 'none'` — but **GA4
  ignores it** and writes `_ga` cookies anyway. `client_storage` is not the GA4 cookieless switch.
- **Fix:** switch to **GA4 Consent Mode** — call Firebase `setConsent({ analytics_storage:
'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })`
  **before** `initializeAnalytics`, so it lands as the `consent default` ahead of the first config
  command. GA4 then writes **no cookies** and sends anonymous cookieless pings. Dropped the
  ineffective `client_storage: 'none'`.
- **Verified in-browser (live stage keys):** `document.cookie` went from `_ga=…; _ga_…` (2
  cookies) to `""` (zero); `page_view` **still sent** — the collect ping carries `gcs=G100` /
  `npa=1` (cookieless-mode signature). Firebase Installations still uses IndexedDB (not a cookie).
  SDKs still load lazily after idle.
- **Scope:** only `src/scripts/deferredInit.ts` (browser orchestrator); no `src/lib` logic changed
  → 280 unit tests still pass, 100% lib coverage. typecheck / lint / format green.

## Chore — Prod env-key delivery (`.env.prod` + dotenv-cli)

- **Date:** 2026-07-07
- **PR:** #65 (merged) · follow-up to slice #10 (analytics)
- **What:** Wired the two-environment key delivery so `deploy:prod` uses **prod** Firebase/Sentry
  keys, not stage. Every `astro build` runs in Vite **production** mode, so a `.env.production`
  would auto-load for the _stage_ deploy too — Vite mode can't separate the two (the split is
  driven by `SITE_ENV`, not Vite mode). See **ADR D-023**.
- **Fix:** `deploy:prod` now loads `.env.prod` explicitly via **`dotenv-cli`**
  (`SITE_ENV=prod dotenv -e .env.prod -- npm run build && firebase deploy …`); its `PUBLIC_*`
  values take precedence over the auto-loaded stage `.env` (verified: `projectId` resolved to
  `solar-time-prod` under `dotenv -e .env.prod`, `solar-time-stage` on a plain build).
  `.env.prod` is a non-magic filename → never auto-loaded elsewhere. `.gitignore` now covers
  `.env` + `.env.*` with a `!.env.example` negation; `.env.example` + README document the split.
- **Dep:** `dotenv-cli@11.0.0` (exact devDep). Config/docs only — no source; 273 tests still pass.
- **Setup done:** Firebase web apps created in both projects; configs live in git-ignored
  `.env`/`.env.prod`. **`measurementId` still empty in both** — Google Analytics must be linked
  in the Firebase console before analytics boots. See **R-014**.

## Slice #12 — Share button on city pages

- **Date:** 2026-07-07
- **PR:** #66 (merged) · **Issue:** #12 (closed)
- **What:** A **share button on `/[city]` only** that forwards the city's clean, OG-ready URL
  (slice #9). Personal share from `/` stays out of scope (post-MVP) — button absent on home
  (verified in `dist`: home 0, `/prague` 1).
- **Strategy (feature-detected, never UA-sniffed):** pure `pickShareStrategy({ canShare,
canClipboard })` → `native | clipboard | none`. **native** — `navigator.share` opens the OS
  sheet (its own confirmation). **clipboard** — `navigator.clipboard.writeText` + a brief
  `aria-live` "Link copied". **none** — button renders `hidden` and JS only reveals it for a
  usable strategy, so it's never a dead end.
- **Clean URL:** `buildShareUrl(slug, origin)` = `new URL('/'+slug, origin).href` — no
  query/fragment, matches the D-020 clean-URL scheme.
- **Approach:** pure logic in `src/lib/share.ts` (D-012 gate); the `[city].astro` `<script>` is a
  thin DOM adapter (D-001), re-bound on `astro:page-load` for View Transitions (mirrors the
  support-dismiss adapter). No empty catch — native-share user-cancel (`AbortError`) swallowed
  intentionally; every other failure `console.warn` + a visible message. a11y: real `<button>`,
  `role="status"` + `aria-live="polite"`; styled via `tokens.css`.
- **Verify:** typecheck / lint / format / test:coverage / build green. code-reviewer → PASS.

## Slice #10 — Analytics + error monitoring

- **Date:** 2026-07-07
- **PR:** #61 (merged) · **Issue:** #10 (closed)
- **What:** A shared **`deferredInit`** boots **Firebase Analytics** (cookieless) and **Sentry**
  (error-only) after `requestIdleCallback`, so neither blocks first paint. Mounted once from
  `Base.astro` as a plain module `<script>` (not a Preact island, D-021). Both SDKs are
  **dynamically imported inside the idle callback**, so the ~446 KB Firebase chunk stays out of
  the critical path (only a ~2.3 KB mount chunk loads eagerly). See **ADR D-022**.
- **Analytics — cookieless:** `client_storage: 'none'` (no GA cookie) + `send_page_view: false`
  (we emit our own) + ad/Google signals off. Anonymous events: `page_view`, `city_selected`
  (slug — emitted from `CitySearch.selectCity`), `geolocation_used` (**no coordinates**). Zero
  cookies (Firebase Installations uses IndexedDB, which is not a cookie).
- **Monitoring — error-only:** `tracesSampleRate: 0`, no tracing/replay integrations ever
  imported; `environment` tag from `SITE_ENV` (build-time). `beforeSend` runs the pure
  **`scrubEvent`** which strips GPS across four vectors — coordinate-named keys, `[lat, lon]`
  arrays, `lat=/lon=` URL params, and free-text decimal pairs / high-precision decimals.
- **Env delivery:** client keys via `PUBLIC_*` (inlined, not secret); **any key group unset ⇒
  that SDK is off**, so local/CI/build stay green with no real keys. `.env.example` documents them.
- **Testability (D-012):** pure `src/lib` cores fully covered — `idleScheduler`, `scrubEvent`,
  `analyticsEnv`, `analytics` (event bus), `eventBuffer` (bounded buffer/flush). SDKs are
  true-external, mocked at the boundary; `deferredInit` is a thin adapter in `src/scripts`
  (outside the gated dirs). **273 tests, 100% stmts/lines/funcs on `src/lib`.**
- **Deps:** `firebase@12.15.0`, `@sentry/browser@10.63.0` (exact). code-reviewer → PASS
  (scrub hardened pre-merge). Coordinator review confirmed the `beforeSend`→`scrubEvent` wiring.
- **⏳ Ops follow-up:** the feature ships **dormant** until real `PUBLIC_FIREBASE_*` + a
  `PUBLIC_SENTRY_DSN` are set in `.env` + CI/deploy env (Firebase config from the existing
  hosting project with Analytics enabled; Sentry DSN from a new project).

## Fix #62 — Footer links wired (BMC + Tally), GitHub dropped

- **Date:** 2026-07-07
- **PR:** #62 (merged) · follow-up to slice #11 (#58)
- **What:** Replaced the slice-#11 footer placeholders with real destinations and removed the
  GitHub item. `SUPPORT_URL` → `https://buymeacoffee.com/viktorkurysh` (page live; Stripe payout
  deferred, but the link works), `FEEDBACK_URL` → `https://tally.so/r/5B58XQ` (published Tally
  form, no email exposed).
- **GitHub item dropped** from the footer + `links.ts`: the repo is private (R-007) so a source
  link would 404, and a bare profile link wasn't wanted. Footer is now `Privacy · Feedback ·
Support` + the GeoNames credit. `links.ts` documents re-adding it if the repo goes public.
- **Scope:** `src/config/links.ts` + `src/layouts/Base.astro` (config + markup only). CI green.

## Slice #11 — Footer / Privacy / Feedback / Support

- **Date:** 2026-07-06
- **PR:** #58 (merged) · **Issue:** #11 (closed)
- **What:** Site footer on every page (`Base.astro`, after `<slot />`):
  `Privacy · Feedback · Support · GitHub` + a separate **GeoNames credit** line —
  “City data © GeoNames (CC BY 4.0)” linking geonames.org. Styled via `tokens.css` (D-006),
  quiet/minimal. **Closes the R-009 release blocker.**
- **`/privacy`:** new `src/pages/privacy.astro` (uses `Base`), plain-language data policy —
  geolocation computed in-browser and never sent, cookieless analytics, error-only monitoring
  with coordinate scrubbing, no cookies/banner. Describes the policy (D-008); wires no SDK.
  `noindex={!IS_PROD}` — indexable on prod like city pages (D-020).
- **Support (Buy Me a Coffee):** a **plain link**, not the JS widget — a quiet dismissable line
  after the result, gated by a `support` prop (on `/` and `/[city]`, off on `/privacy`). Dismiss
  state persists in `localStorage`. Pure `shouldShowSupport(stored)` in
  `src/lib/supportVisibility.ts` (100% covered, D-012); the `<script>` is a thin adapter bound on
  `astro:page-load` so it re-binds across View Transitions. Both catch blocks `console.warn`
  (no empty catch).
- **Micro-copyright near 📍:** strengthened the home `.geo` line with a link to `/privacy`.
- **Placeholders (`src/config/links.ts`) — need real values:** `SUPPORT_URL` (BMC) and
  `FEEDBACK_URL` (Tally) are `REPLACE_ME`; `GITHUB_URL` points at the owner profile
  `github.com/vik8174` (repo is private — R-007 — a repo link would 404; revisit when public).
- **Verify:** typecheck / lint / format:check / test:coverage (100% on the new lib) / build
  (1087 pages incl. `/privacy`) all green. code-reviewer → PASS WITH NOTES (all actionable
  applied). GeoNames credit confirmed visible in `dist` on city/home/privacy.
- **Infra note:** the worker's symlinked `node_modules` was poisoned mid-flight by parallel #44's
  `npm install` (React→Preact) — fixed with a worktree-local `npm ci`. Recorded as **R-013**.

## Perf #44 — React → Preact for the search island

- **Date:** 2026-07-06
- **PR:** #56 (merged) · **Issue:** #44 (closed)
- **What:** Swapped the sole client island (`CitySearch`) from React to **Preact** — a full
  migration to `preact/hooks` (not the `compat` shim), toward D-001's "near-zero JS" ideal.
  Resolves QA finding #3 from slice #6. See **ADR D-021**.
- **Payload (per-page island, network-confirmed):** **raw −79.5%** (221 → 45 KB), **gzip −74.9%**
  (71 → 18 KB) — the ~184 KB React runtime is gone. Fuse.js + the pure `citySearch.ts` logic are
  framework-agnostic and were untouched.
- **React↔Preact traps handled:** `onChange` → `onInput` (Preact fires change per-keystroke) and
  `onBlur` → `onFocusOut` — **Preact's `onBlur` does not bubble**, a real regression caught by
  `code-reviewer` and now pinned by a regression test (see R-012). Removed a now-needless
  `as never` in `renderOgCard.ts` (fallout of dropping `@types/react`; OG logic unchanged).
- **Verify:** typecheck / lint / format / test:coverage (**228 tests**) + full prod build (1086
  pages, OG + sitemap) green; PR CI all green. `#43` a11y intact.
- **Deps:** `@astrojs/react` + `react` + `react-dom` → `@astrojs/preact` + `preact`;
  `@testing-library/react` → `@testing-library/preact`; `@types/react*` dropped (exact versions).

## Slice #9 — SEO + OG share cards

- **Date:** 2026-07-06
- **PR:** #54 (merged) · **Issue:** #9 (closed)
- **What:** Every `/[city]` becomes a real search + share target — unique metadata, a build-time
  Open Graph card, and an environment-aware crawl policy.
- **Per-page metadata:** `Base.astro` emits `<meta name="description">`, `<link rel="canonical">`,
  and full Open Graph + Twitter Card tags, absolutized against `site`. Driven by a pure, tested
  `seoMeta(city, deviation)` (`src/lib`, under the D-012 gate). Title is evergreen
  (`Solar time in {City}`); the description carries the build-date number (D-003 snapshot).
- **Build-time OG cards (ADR D-019):** one 1200×630 PNG per city (deviation number + name) via
  `satori` → `@resvg/resvg-js` from the endpoint `/og/[slug].png`; pure `ogCardModel` feeds the
  layout, and the number flows through the same `format.ts` helpers as `cityViewModel` (SSOT,
  R-001 — never recomputed). Home gets a branded `/og/home.png`. A per-city render failure
  degrades to the brand card; a systemic failure still fails the build (fail-fast).
- **Environment split (ADR D-020):** `SITE_ENV=prod` (in `deploy:prod`) read once in
  `src/config/site.ts`, driving the `site` URL, sitemap gating, robots, and per-page `noindex`.
  robots.txt is now an endpoint (stage `Disallow: /`, prod `Allow: /` + `Sitemap:`), replacing
  the old static `public/robots.txt`. Sitemap (`@astrojs/sitemap`, prod-only) lists 1085 city
  URLs, excludes `/` (noindex, D-005) and endpoints; `trailingSlash: 'never'` matches the
  canonical URLs + firebase `cleanUrls`. City pages: noindex on stage, indexable on prod.
- **Verify:** typecheck / lint / format / **test:coverage (224 tests, 100 / 97.9 / 100 / 100)**
  green. Full stage + prod builds validated end-to-end (robots, sitemap 1085 urls, noindex/
  indexable per env, absolute canonical + OG/Twitter, valid 1200×630 PNGs — Prague + home checked).
  `code-reviewer` → PASS WITH NOTES (both ≥75 fixed); `qa` → +24 edge tests.
- **Cost:** OG generation adds ~130 s to the CI-only `build` (~1085 imgs / ~24 MB); every build
  regenerates cards (date-dependent number → no valid cross-build cache). See R-010.

## Fix #50 — Wrap longitude offset across the antimeridian

- **Date:** 2026-07-06
- **PR:** #52 (merged) · **Issue:** #50 (closed)
- **What:** Three antimeridian Pacific cities computed a physically impossible ~+24 h deviation
  that also overflowed the `SolarScale` axis — Nuku'alofa **+1485 min**, Apia +1472, Mata-Utu
  +1429 (West longitude but East UTC +13/+14, just across the date line). Found by the slice #8
  verification (full-dataset build scan).
- **Root cause (domain):** `longitudeOffsetMinutes = standardOffset − 4×longitude` never
  normalized across the date line — for Nuku'alofa `780 − 4×(−175.2) = +1481`, exactly **1440
  (24 h) above** the true ~+45 min. Solar time is cyclic; the offset wasn't wrapped.
- **Fix:** new pure `wrapMinutes` folds `longitudeOffset` into **[−720, +720)** (mod 1440),
  applied in `computeDeviation`. `total` is still derived from the wrapped component, so
  **D-004's additive invariant holds** (`longitudeOffset + equationOfTime + dst === total`).
  Normal cities are already in range → the wrap is a **no-op** for them; no `scaleWindow` / UI
  change (WIDEST 720 now suffices). See **ADR D-018**.
- **Verify:** RED test pinned the 3 antimeridian cases first (`/tdd`); existing domain tests
  (Prague/Madrid/Kashgar/EoT/DST/on-meridian) pass unchanged. typecheck / lint / format /
  test:coverage / build green. code-reviewer → PASS.
- **Coordinator re-verification (full-dataset build scan):** **0 cities** now exceed ±720 (was
  3); the trio resolves to sane values — Nuku'alofa **+45**, Apia **+32**, Mata-Utu **−11**.

## Fix #43 — Separate city name from matched alt-name in search results

- **Date:** 2026-07-06
- **PR:** #49 (merged) · **Issue:** #43 (closed)
- **What:** Search result options concatenated the city name and its first matched alt-name with
  no separator, so each option's **accessible name** read as one run — "MunichMünchen",
  "FunchalFNC", "YunchengAn-i-hsien". A screen reader announced it as a single word; visually
  cramped too. Resolves QA finding #2 from slice #6.
- **Fix (a11y / display-only):** the `role="option"` anchor gets a clean accessible name via
  `aria-label={city.name}`; the alt-name `<span>` is marked `aria-hidden="true"` (decorative
  visual hint — _why_ the row matched, not part of the name); a muted CSS `::before` "·"
  separator adds visual separation. ARIA combobox/listbox semantics and keyboard nav
  (`aria-selected`, `aria-activedescendant`, `optionId`, Arrow/Enter/Esc) untouched.
- **Scope:** `CitySearch.tsx` + `CitySearch.css` + `CitySearch.test.tsx` only — no domain /
  `src/lib` change. Ran in parallel with slice #7 (disjoint files, clean rebase).
- **Tests:** behavioral regression — types a diacritic query and asserts the option's
  accessible name is exactly `Munich` (not `MunichMünchen`) and the alt still renders as an
  `aria-hidden` hint.
- **Verify:** typecheck / lint / format / test:coverage / build all green. code-reviewer → PASS.
- **Note:** trade-off — the alt is now `aria-hidden`, so a screen reader no longer announces
  "why it matched"; accepted, the alt is a purely visual hint and the clean city name is the
  a11y win.

## Slice #7 — Live geolocation mode on `/`

- **Date:** 2026-07-06
- **PR:** #47 (merged) · **Issue:** #7 (closed)
- **What:** Turned the `/` placeholder into the **live, per-visitor solar-time mode**. First
  paint is a real result (SSG bakes a neutral global default — largest city); the island
  recomputes it for _today_ (D-013 inline pattern) and upgrades to the visitor's **timezone
  estimate** via `/tz-index.json` + the new `/geo-index.json`. **📍 my location** → precise
  Geolocation fix: deviation computed from the **exact longitude + browser timezone** (no city
  lookup for the number); `findNearestCity` only supplies the **"Your location / near {city}"**
  label, hidden when the nearest city is **>100 km** away.
- **Graceful everywhere:** denied → 📍 becomes a **search hint**, not a dead button (Permissions
  pre-check); ~9 s timeout / unavailable → default stays with a quiet note; no `Intl`/`Geolocation`
  → the SSG snapshot stays. `/` remains **noindex** (D-005).
- **Architecture:** Geolocation is the I/O boundary — the pure state machine `geoReducer`
  (`idle→locating→located/denied/error/unsupported`) drives the UI; the `.astro` `<script>` is a
  thin adapter/DOM shell. Pure `src/lib` modules (all tested, under the D-012 gate): `geoReducer`,
  `findNearestCity` (haversine), `homeView` (label + status copy), `geoIndex` (projection), and
  the thin `geolocation` adapter (mocked at the boundary). New lean **`/geo-index.json`** =
  `{ slug, name, lat, lon }` — see **ADR D-017**.
- **SSOT preserved (R-001):** every compute path goes through `computeDeviation` →
  `buildCityViewModel`, same as the city pages. Registry never enters the JS bundle (home island
  ≈ 4 KB; verified no city names in `dist/**/*.js` — D-013 holds).
- **Verify:** typecheck / lint / format:check / test:coverage / build all green. **179 tests,
  coverage 100 / 98.66 / 100 / 100** on `src/lib` + `src/domain`; build 1086 pages.
- **Review:** `qa` agent added 28 edge-case tests (poles, antimeridian, threshold boundaries,
  reducer transitions, error-code mapping). `code-reviewer` flagged a race (fast 📍 fix
  clobbered by the slower timezone estimate) + an empty-eyebrow gap — **both fixed** before
  merge; fetched-JSON shape guard hardened. Known suggestion-level edge (not fixed): a
  cached-permission 📍 resolving before `/geo-index.json` loads shows "Your location" without
  "near {city}" for that one click (valid fallback).

## Fix #42 — Breakdown rows reconcile with the displayed total

- **Date:** 2026-07-06
- **PR:** #45 (merged) · **Issue:** #42 (closed)
- **What:** The city page rounded each breakdown component independently with `Math.round`, so
  the shown parts could sum to a different integer than the shown total — **/prague** showed
  `+2 +4 +60` (=66) against a `+67` total. At the current build date this hit **452 of 1085
  cities**. Resolves QA finding #1 from slice #6.
- **Fix (display-only):** new pure helper `src/lib/apportionMinutes.ts` — signed
  largest-remainder (Hamilton) apportionment: rounds each component to the nearest minute, then
  hands the ±1 leftover to the components whose fractional remainder is closest to flipping.
  The target is the components' **own rounded sum**, derived inside the helper (no `total`
  parameter — a mismatched total is unrepresentable, SSOT / type-safety).
- **Wiring:** `cityViewModel.ts` apportions the three components before formatting;
  `signedMinutes` stays the single-value formatter. The inline client recompute already calls
  `cityViewModel`, so build-time and client render both get the fix (R-001 / D-013).
- **Domain untouched:** `computeDeviation` and **D-004**'s additive invariant hold on the
  _unrounded_ values — this only changes how `cityViewModel` rounds for display. No new ADR.
- **Tests:** `apportionMinutes.test.ts` (parts-sum-to-total across a swept range — positive,
  negative, mixed, rounding boundaries, single-element, empty, the Prague case);
  `cityViewModel.test.ts` (shown rows sum to shown total; existing hero/lead/zero behaviour
  unchanged).
- **Verify:** typecheck / lint / format / test:coverage (100% stmts·lines·funcs, 95.83%
  branches) / build all green. code-reviewer → PASS WITH NOTES (the "derive total internally"
  note applied pre-merge).

## Slice #6 — City search

- **Date:** 2026-07-06
- **PR:** #40 (merged) · **Issue:** #6 (closed)
- **What:** Fuzzy city search on every page. `CitySearch` React island (combobox: arrow/Enter/Esc
  keyboard nav, ARIA) over a Fuse.js index; select → navigate to `/[city]`; empty → hint + geo
  fallback via `resolveDefaultCity`.
- **Lean search index (ADR D-016):** `src/lib/searchIndex.ts` projects the full registry to
  `{ slug, name, altNames }`; served as a prerendered static endpoint `/search-index.json`
  (+ `/tz-index.json`) that the island fetches lazily on idle — not inlined, not bundled.
  The deliberate exception to D-013 (search needs all cities client-side), kept minimal.
- **Pure logic under the gate:** `src/lib/citySearch.ts` (build Fuse index + query + rank),
  diacritic/case normalization (NFD → strip marks → lowercase), Fuse typo tolerance. Lives in
  `src/lib` so it falls under the D-012 coverage floor; component is a thin shell.
- **Navigation:** `astro.config.mjs` adds `prefetch: { defaultStrategy: 'hover' }` +
  `<ClientRouter />` View Transitions; new `src/layouts/Base.astro` hosts the search on all pages.
- **Deps/config:** `fuse.js` 7.4.2, `@astrojs/react` integration added (exact); `vitest.config`
  scope + `tsconfig` touched.
- **Verify:** typecheck / lint / format / test:coverage / build all green (per PR #40).

## Chore — `ticket-worktree.sh` provisions node_modules

- **Date:** 2026-07-06
- **PR:** #38 (merged) · **Issue:** #37 (closed)
- **What:** Closed the paved-path friction from D-015 — a fresh worktree had no
  `node_modules`, so the `pre-push` gate (D-012) failed until a manual `npm install`.
- **Fix:** `scripts/ticket-worktree.sh` now symlinks the primary clone's `node_modules`
  into the new worktree (falls back to `npm install` when the primary has none), so
  `pre-push` runs immediately. `.gitignore` adjusted (`node_modules` without trailing
  slash) so the symlink stays untracked; `dev-flow.md` updated.
- **Dogfooded:** this journal PR was pushed from a `ticket-worktree.sh` worktree — the
  symlink was created and the `pre-push` gate passed with no manual install.

## Chore — Worktree isolation guardrail (R-008 enforced)

- **Date:** 2026-07-05
- **PR:** #35 (merged) · **Issue:** #28 (closed)
- **What:** Turned the R-008 convention into a technical guarantee (see ADR D-015).
- **Guardrail:** committed `.githooks/pre-commit` hard-blocks commits on `main`/`stage` and
  commits in the primary clone (must be a linked worktree). Detection via
  `git rev-parse --absolute-git-dir` vs resolved `--git-common-dir`.
- **Paved path:** `scripts/ticket-worktree.sh <branch>` provisions `../solar-time-<branch>`
  off a fresh `origin/main`. `dev-flow.md` documents both. `--no-verify` stays an escape hatch.
- **Note:** dogfooded — this very journal PR was authored in a worktree created by
  `scripts/ticket-worktree.sh`, and the pre-commit guard correctly allowed the commit.

## Chore — Deploy scripts (stage/prod) + README refresh

- **Date:** 2026-07-05
- **PR:** #33 (merged) · **Issue:** #27 (closed)
- **What:** Added the missing manual deploy scripts and rewrote the placeholder README.
  `package.json` gains `deploy:stage` / `deploy:prod` — each `npm run build && firebase
deploy --only hosting -P <alias>` (aliases from `.firebaserc`: `stage` →
  `solar-time-stage`, `prod` → `solar-time-prod`). README rewritten per
  `~/.claude/rules/readme-structure.md`: description, Quick Start, Tech Stack,
  Prerequisites, Scripts table, Project Structure (reflects slice #5 `scripts/` +
  `src/data`), Deployment (aliases + noindex/pre-release note), `docs/` link. GeoNames
  credited as CC-BY (R-009); visible in-page credit still deferred to footer slice #11.
- **firebase-tools as devDep (ADR D-014):** pinned exact `15.22.4` so scripts are
  self-contained (`npm install` is enough; npm resolves `firebase` from
  `node_modules/.bin`). Trade-off recorded in D-014.
- **Scope:** config + docs + one devDep — no source/behavior changes. Single `build`
  (no `build:stage/prod`, YAGNI); CI auto-deploy on merge left OUT (future ticket).
- **Verify:** typecheck / lint / format:check / test:coverage (68 pass) / build (1086
  pages) all green; `deploy:prod` deliberately not run. code-reviewer → PASS (0 issues ≥75).

## Slice #5 — City dataset + build script

- **Date:** 2026-07-05
- **PR:** #31 (merged) · **Issue:** #5 (closed)
- **What:** Replaced the hardcoded single-city registry with a generated ~1000-city dataset
  wired into SSG. `scripts/buildCities.ts` (I/O boundary) fetches + unzips the GeoNames
  `cities15000` dump (cached under git-ignored `scripts/.cache/`) and delegates every
  reproducible decision to pure modules `scripts/geonames.ts` (parse + select) and
  `scripts/citySlug.ts` (collision-free slugs). Output `src/data/cities.json` is committed
  (1085 cities, 355 IANA zones) so `astro build` needs no network. `getStaticPaths` now
  renders 1086 pages. `resolveDefaultCity(browserTimeZone)` (in `src/lib/`) maps a browser
  IANA zone → city (exact → same-region → fallback, never undefined).
- **Selection (deterministic):** population-desc pass (geonameId tie-break) + a
  zone-completeness pass guaranteeing every source IANA zone has ≥1 city, so
  `resolveDefaultCity` can always resolve an exact zone. No `Date`/random; byte-stable JSON.
- **Bundle isolation (ADR D-013):** city pages inline their own city's data into `data-*`
  attributes at build time; the island no longer imports the full registry. Verified: single
  island bundle 4.7 KB, no city names in `dist/**/*.js`. `cityViewModel`/`computeDeviation`
  stay the SSOT (R-001 held — thin client preserved as the dataset grew).
- **Contract:** `City` extended additively (`altNames`, `population`); `getCity` unchanged.
- **Coverage:** `resolveDefaultCity` placed in `src/lib` so it falls under the D-012 gate;
  100% stmts/funcs/lines, branch 85% (one unreachable `noUncheckedIndexedAccess` guard).
- **Review:** code-reviewer → PASS WITH NOTES (0 issues ≥75). Coordinator caught + fixed
  pre-merge: ADR ref D-012→D-013, and moved `resolveDefaultCity` src/data→src/lib.
- **Attribution debt:** GeoNames `cities15000` is CC-BY 4.0 — footer attribution required,
  deferred to footer slice #11 (noted in `cities.ts`/`buildCities.ts` headers, see R-009).

## Chore — Minimum unit-test coverage gate

- **Date:** 2026-07-05
- **PR:** #29 (merged) · **Issue:** #26 (closed)
- **What:** Coverage floor enforced on both sides from one SSOT. `vitest.config.ts` scopes
  `coverage.include` to the logic dirs (`src/lib`, `src/domain`) and adds
  `thresholds: { statements: 90, lines: 90, functions: 90, branches: 80 }`; under threshold
  `vitest run --coverage` exits non-zero. See ADR D-012.
- **Both sides, same command:** CI's Test step runs `npm run test:coverage` (was `npm test`);
  a committed `.githooks/pre-push` runs typecheck → lint → format:check → test:coverage
  (build stays CI-only), wired for every clone via a `prepare` script
  (`test -z "$CI" && git config core.hooksPath .githooks || true` — local-only, no CI churn).
- **Scope rationale:** `src/data` excluded (generated tables, rewritten by slice #5, no
  hand-written logic); components/pages are `.astro`, the one inline script only re-invokes
  already-covered lib/domain functions.
- **Coverage after:** 100% statements/branches/functions/lines on the scoped dirs (passes
  90/80 with headroom).
- **Review:** code-reviewer → PASS WITH NOTES; both notes ($CI-gated `prepare`, labeled
  pre-push stages) applied before merge.
- **Docs:** `.claude/rules/dev-flow.md` added — cheap-first local order the hook enforces.

## Chore — ESLint `strictTypeChecked` + type-aware linting

- **Date:** 2026-07-05
- **PR:** #24 (merged) · **Issue:** #21 (closed)
- **What:** ESLint upgraded from `typescript-eslint` `recommended` → `strictTypeChecked`
  with type-aware linting on (`projectService` + `tsconfigRootDir`). See ADR D-011.
- **Config:** `**/*.astro` block applies `disableTypeChecked` (no astro type-checked
  preset); `restrict-template-expressions` set to `allowNumber` for SVG/render code;
  `no-non-null-assertion` off for `**/*.test.ts` (the `!` from D-010 is necessary there).
- **Side effects:** `tseslint.config()` → `defineConfig()` (resolves `no-deprecated`);
  added dev dep `@types/node` (exact 26.1.0) for `import.meta.dirname` under `astro check`.
- **Verify:** lint / typecheck / test / build all green.

## Chore — Prettier defaults pinned

- **Date:** 2026-07-05
- **PR:** #23 (merged)
- **What:** Made two Prettier defaults explicit in `.prettierrc.json` — `trailingComma:
"all"` and `endOfLine: "lf"`. No reformatting (both already matched Prettier 3 defaults);
  documents intent and guards against CRLF from non-macOS contributors.

## Chore — tsconfig tightened to `strictest`

- **Date:** 2026-07-05
- **PR:** #20 (merged) · **Issue:** #19 (closed)
- **What:** `tsconfig.json` now extends `astro/tsconfigs/strictest` (was `strict`). Adds
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals/Parameters`, `noImplicitOverride`,
  `allowUnreachableCode:false`, `allowUnusedLabels:false`. See ADR D-010.
- **Fixes:** 12 `noUncheckedIndexedAccess` errors — `scaleWindow.ts` (named `WIDEST`
  fallback constant instead of an indexed one) + `cityViewModel.test.ts` /
  `scaleWindow.test.ts`. Type-only, behavior unchanged. `.astro` files needed no changes.
- **Verify:** `astro check` 0 errors, tests green.

## Slice #4 — City page `/[city]` end-to-end (Prague)

- **Date:** 2026-07-04
- **PR:** #17 (merged) · **Issue:** #4 (closed)
- **What:** First real screen. Static per-city page via SSG (`getStaticPaths`) on a
  hardcoded Prague entry (full dataset is slice #5).
- **SSOT recompute:** `[city].astro` computes the deviation at build time **and** ships a
  tiny inline `<script>` that recomputes for **today** — both call the same
  `cityViewModel` / `computeDeviation`, so a page built days ago never shows a stale
  number (implements D-003, mitigates R-001).
- **New modules:** `src/lib/cityViewModel.ts` (pure SSOT for display strings + scale
  geometry), `format.ts`, `scaleWindow.ts`, `scaleGeometry.ts`, `scaleSvg.ts` — all with
  tests. Data: `src/data/cities.ts` (Prague only for now).
- **UI:** `HeroNumber`, `SolarScale`, `Breakdown` Astro components; visual tokens realized
  in `src/styles/tokens.css` (D-006).
- **Note:** landed on `main` via squash together with the docs/handoffs infra (the
  worker branch was cut from that branch — see the shared-working-copy incident, R-008).

## Slice #3 — Domain `computeDeviation`

- **Date:** 2026-07-04
- **PR:** #15 (merged) · **Issue:** #3 (closed)
- **What:** Pure astronomy module `src/domain/solarTime.ts` — clock-vs-sun deviation.
  Zero DOM/IO, serializable, browser-ready.
- **Public API:** `computeDeviation`, `equationOfTimeMinutes`, `longitudeOffsetMinutes`,
  `offsetMinutes`, `standardOffsetMinutes`, `dstMinutes`.
- **Contract:** `computeDeviation({ longitude, timeZone, date })` returns `{ longitudeOffset, equationOfTime, dst, total, solarNoon }`. Additive: `longitudeOffset + equationOfTime + dst === total`. Sign `+` = clock ahead of sun. `solarNoon` = minutes from local midnight.
- **Tests:** 19 behavioral tests, 100% coverage. Reference cities Prague/Madrid/Kashgar,
  solstice/equinox EoT, winter/summer DST, on-meridian → total ≈ 0.
- **Review:** code-reviewer → PASS WITH NOTES.

## Slice #2 — Project skeleton + deploy pipeline

- **Date:** 2026-07-04
- **PR:** #14 (merged) · **Issue:** #2 (closed)
- **What:** Full delivery pipeline proven end-to-end on a trivial page.
- **Stack:** Astro 7.0.6 + TS strict · Vitest 4 (+v8 coverage) · ESLint 10 flat ·
  Prettier · `astro check`. Scripts: `typecheck` / `lint` / `format:check` / `test` /
  `test:coverage` / `build`. `.npmrc` pins exact versions.
- **Hosting:** Firebase Hosting — projects `solar-time-stage` / `solar-time-prod`
  under personal account vik8174@gmail.com. Stage live at
  https://solar-time-stage.web.app (noindex + robots disallow-all).
- **CI:** `.github/workflows/ci.yml` — `Checks` job (typecheck→lint→format→test→build) plus a `preview` job (Firebase preview channel, gated on same-repo PRs). Secret `FIREBASE_SERVICE_ACCOUNT_STAGE` set in repo.
- **Branches:** `main` (default) + `stage`, kept in sync. Flow: feat → PR → squash-merge.

## Slice #1 — Planning (PRD)

- **Date:** 2026-07-04
- **Issue:** #1 (PRD, open as living spec)
- **What:** grill-me → write-a-prd → prd-to-issues. 31 user stories, module design,
  testing decisions. 12 tracer-bullet issues (#2–#13). Local copy: `career/solar-time/PRD.md`
  in the personal workspace.
