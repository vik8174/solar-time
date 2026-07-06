# Progress Log

Chronological record of what shipped. Newest on top. One entry per merged slice.

Format: `## Slice #N — <title>` · date · PR · outcome · notes.

---

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
