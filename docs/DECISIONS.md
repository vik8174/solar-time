# Decisions & Assumptions

ADR-lite. Each entry = a hard-to-reverse choice, its rationale, and any assumptions
it rests on. Don't rewrite; supersede with a new entry and link them.

Status: `accepted` · `superseded by #N` · `assumption` (unverified premise to revisit).

---

## D-001 — Astro + React island, zero backend · accepted

Static-first site (SSG). Content-heavy, one small interactive widget → islands
architecture fits: near-zero JS baseline, perfect Lighthouse, cheap static hosting.
No server/runtime to operate. **Trade-off:** dynamic data must be recomputed client-side.

## D-002 — Firebase Hosting, two projects (stage/prod) · accepted

`solar-time-stage` / `solar-time-prod` under personal account **vik8174@gmail.com**
(not the work Intellias account). Preview channels give per-PR URLs for visual QA.
**Assumption:** free tier is enough for a portfolio-scale tool.

## D-003 — Deviation is recomputed in the browser · accepted

SSG bakes the deviation number **as of build date** (good for SEO / first paint), but
a tiny inline script recomputes it for **today** using the same `computeDeviation`.
The domain module is the single source of truth (SSOT) and must stay serializable /
browser-portable. **Why:** equation-of-time depends on the current date; a baked number
goes stale.

## D-004 — Domain contract (SSOT) · accepted

`computeDeviation({ longitude, timeZone, date }) → { longitudeOffset, equationOfTime,
dst, total, solarNoon }`.

- Sign `+` = clock **ahead** of the sun (noon after 12:00).
- Additive: `longitudeOffset + equationOfTime + dst === total`.
- `equationOfTime` field = **negated** classic EoT; helper `equationOfTimeMinutes` = classic (apparent − mean).
- `solarNoon` = **minutes from local midnight** (UI formats to HH:MM).
- `longitude` east +, west −. `timeZone` IANA. Invalid zone → throws `RangeError` (fail-fast).
- Approximation: NOAA/Spencer, target accuracy **< 30 s**.

**Do not break in UI.** Established in slice #3 (PR #15).

## D-005 — Routing: live geo `/` (noindex) + `/[city]` SSG · accepted

Home `/` = live geolocated mode, **not indexed** (per-visitor, not a stable URL).
`/[city]` = static per-city pages via `getStaticPaths`, indexable and shareable.
City dataset (slice #5): GeoNames cities15000 → top ~1000, IANA zones.

## D-006 — Visual identity in `tokens.css` (SSOT) · accepted

Warm dark palette: bg `#0d0d0d`, text `#f5f0e8`, amber accent `#e8a923`, axis `#3a3a3a`.
Mono for numbers, sans for labels, 8px spacing, `prefers-color-scheme`. Tokens split
from components. **Figma NOT used** — avoids a second source of truth; core UI by hand (SVG/CSS).

## D-007 — Design tooling scope · accepted

Nano Banana (Gemini 2.5 Flash Image) → **raster assets only** (OG image, mood board).
Recraft V4 → logo/favicon (SVG). Neither produces production UI.

## D-008 — Analytics & feedback · accepted

Cookieless Firebase Analytics + Sentry (error-only). BMC donation (one-off).
Tally feedback form. English-only for MVP. App Check NOT needed for MVP (no backend resources).

## D-009 — Coordinator + worker workflow · accepted

Each ticket runs in its own fresh agent session (worker); a coordinator session holds
state and passes work via handoffs. Handoffs are throwaway (`../handoffs/`, git-ignored);
durable history lives in these committed docs. **Each session works in its own
`git worktree` off `main`** — never two sessions on one working tree (see R-008).

**Amendment (2026-07-09):** the worker ships the `docs/` update (the `PROGRESS.md` entry
plus any `DECISIONS.md`/`RISKS.md` change) **in the same PR as the code** — the
coordinator reviews it while gating that single PR and no longer opens a separate
post-merge journal PR. Keeps the journal from drifting from the code and halves merge
overhead. (Superseded the two-PR split used through #79/#83. Coordinator-only doc
chores with no associated ticket may still use a standalone chore-PR.)

## D-010 — TypeScript `strictest` preset · accepted

`tsconfig.json` extends `astro/tsconfigs/strictest` (not `strict`). Turns on the full
strict set, notably `noUncheckedIndexedAccess` (indexed access is `T | undefined`) and
`exactOptionalPropertyTypes`. **Why:** catch silent index/optional bugs at compile time,
especially before the city dataset (slice #5) which is index-access heavy. **Cost:** array
and object-index access must be guarded/narrowed, not assumed. Impact when adopted was
small (12 type-only fixes, PR #20 / issue #19). ESLint gets the symmetric `strictTypeChecked`
move in issue #21 (future D-011).

## D-011 — ESLint `strictTypeChecked` + type-aware linting · accepted

`eslint.config.js` uses `typescript-eslint`'s `strictTypeChecked` (was `recommended`) with
type-aware linting enabled (`parserOptions.projectService` + `tsconfigRootDir`). The
symmetric counterpart to D-010: types and lint are both at the strictest tier. Enables
bug-class rules (`no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`,
`no-unsafe-*`, …). **Config specifics:** `**/*.astro` files get `disableTypeChecked` (the
astro parser doesn't feed the TS program and there is no astro type-checked preset);
`restrict-template-expressions` is `{ allowNumber: true }` for number-heavy SVG/render code;
`no-non-null-assertion` is off for `**/*.test.ts` (the `!` assertions D-010 requires are
necessary there). **Why config change over edits:** the codebase was already clean
(0 bug-class hits) — value is preventative. **Side effects:** migrated the deprecated
`tseslint.config()` helper to ESLint's `defineConfig()`; added `@types/node` (exact 26.1.0)
so `import.meta.dirname` type-checks under `astro check`. Impact when adopted: 29 lint
errors, all in 2 rules, all resolved (PR #24 / issue #21).

## D-012 — Minimum unit-test coverage gate · accepted

Coverage floor enforced from one SSOT in `vitest.config.ts`:
`thresholds: { statements: 90, lines: 90, functions: 90, branches: 80 }`, with
`coverage.include` scoped to `src/lib` + `src/domain`. Both sides run the same
`npm run test:coverage`: CI (the hard backstop) and a committed `.githooks/pre-push` hook
(fail-fast locally, wired via a `prepare` script; bypassable with `--no-verify` — accepted,
CI is the real gate). **Why a floor, not a driver:** TDD already yields ~100%; this is a
ratchet so untested logic can't slip in as AFK slices land. **Why scoped:** `src/data` holds
generated tables (rewritten by slice #5) with no hand-written logic; components/pages are
`.astro`. **Assumption:** the gate stays meaningful only while logic lives in `src/lib` /
`src/domain` — a future logic dir must be added to `coverage.include` or it escapes the gate.
Impact when adopted: config + hook + docs only, no source changes (PR #29 / issue #26).

## D-013 — City-page bundle isolation (inline data, no registry import) · accepted

City pages (`[city].astro`) inline their own city's data (`longitude`, `timeZone`, `name`,
`coords`) into `data-*` attributes at build time; the client island reads them from the DOM
instead of `import`-ing the city registry. **Why:** with a ~1000-city dataset (slice #5,
D-004 shape) importing `getCity` would pull the whole registry into the island bundle. Each
page only needs its own city, so inlining keeps the island tiny — verified single island
bundle 4.7 KB, zero city names in `dist/**/*.js`. The full dataset stays build-time only
(`getStaticPaths`) plus the future home page (`/`, live geo). **Invariant (R-001):** the
island stays a thin caller of `cityViewModel` → `computeDeviation` (the SSOT); inlining
changes only _where the inputs come from_, not the compute path. **Assumption:** any new
per-page client logic must read from `data-*` / props, not re-import the registry, or the
bundle win regresses. Adopted with slice #5 (PR #31 / issue #5).

## D-014 — `firebase-tools` as an exact devDependency (not global CLI) · accepted

Deploy scripts (`deploy:stage` / `deploy:prod`, D-002 aliases) call `firebase` via a
**pinned devDependency** (`firebase-tools@15.22.4`, save-exact) rather than a globally
installed CLI. **Why:** self-contained + reproducible — `npm install` is the only setup
step, npm resolves `firebase` from `node_modules/.bin`, and the version is locked so a
deploy can't silently pick up a breaking CLI release. Only `firebase login` (on
**vik8174@gmail.com**, D-002 / R-005) remains a manual prerequisite. **Trade-off:** heavy
dep — pulls ~597 transitive packages and carries some moderate advisories in its
transitive tree; acceptable because it's dev-only and never ships to the static bundle.
**Alternative considered:** global `firebase` + a README prerequisite (lighter tree, but
unpinned and non-reproducible across machines). Adopted with the deploy-scripts chore
(PR #33 / issue #27).

## D-015 — Per-ticket worktree isolation enforced by a pre-commit guard · accepted

R-008 (each session in its own git worktree off `main`) was convention-only and the slice #4
incident proved convention fails. Now enforced technically by a committed `.githooks/pre-commit`
that hard-blocks a commit when the branch is `main`/`stage` OR the commit is made in the
**primary clone** rather than a linked worktree (detected via `git rev-parse --absolute-git-dir`
vs the resolved `--git-common-dir`). Wired through the existing `core.hooksPath` (D-012's
`prepare` script). Paired with `scripts/ticket-worktree.sh <branch>` — the paved path that
provisions `../solar-time-<branch>` off fresh `origin/main` — referenced from `dev-flow.md`.
**Why guard + script:** the hook makes the wrong thing impossible; the script makes the right
thing one command. **Escape hatch:** `git commit --no-verify` bypasses it, so this is strong
enforcement, not absolute — CI + review remain the backstop. The coordinator commits docs in a
linked worktree on a chore branch, which the guard allows by design. Mitigates R-008
(PR #35 / issue #28).

## D-016 — Lean, lazily-fetched search index (deliberate D-013 exception) · accepted

City search needs _all_ cities on the client — the opposite of D-013, which keeps the full
registry out of the per-page deviation island. Reconciled by shipping a **minimal** index:
`toSearchIndex` (`src/lib/searchIndex.ts`) projects the registry to `{ slug, name, altNames }`
only (dropping longitude/timeZone/population/coords), served as a **prerendered static
endpoint** `/search-index.json` (and `/tz-index.json` for timezone→city). The `CitySearch`
island fetches it **lazily on idle** and builds the Fuse.js index client-side. **Why an
endpoint, not inlining:** kept out of every page's initial HTML, cacheable, and reused across
navigations. **Why keep it lean:** the payload is the one unavoidable "ship the registry" cost,
so it carries only search fields. **Invariant:** the per-page deviation island stays untouched
(D-013 holds); search is a separate, lazily-loaded island. **Assumption:** new searchable
attributes must be weighed against payload size before being added to the index shape. Fuzzy
logic (`src/lib/citySearch.ts`) is pure and under the D-012 gate; diacritic/case-insensitive
via NFD normalization; typo tolerance from Fuse. Adopted with slice #6 (PR #40 / issue #6).

## D-017 — Lean, lazily-fetched nearest-city geo-index · accepted

Slice #7's "Your location / **near {city}**" label needs each city's **coordinates**, but the
search index (D-016) deliberately dropped coords, and the per-page island (D-013) never sees the
registry. Rather than widen either, ship a **separate lean geo-index**: `toGeoIndex`
(`src/lib/geoIndex.ts`) projects the registry to `{ slug, name, lat, lon }` only, served as a
prerendered static endpoint **`/geo-index.json`**, fetched **lazily and only for the geo flow**
(the 📍 path), then consumed by the pure `findNearestCity(lat, lon)` (haversine, under the D-012
gate). **Latitude source:** the registry stores no numeric latitude, so it's parsed from the
city's `coords` display string; both coords **rounded to 2 decimals** (~1 km — ample for the
100 km "near" cutoff). **Payload:** ~68 KB raw / **~18 KB gzip**. **Why not fold into the
search index (D-016):** search needs `altNames`, geo needs `lat/lon` — different shapes, each
kept minimal; both stay separate lean endpoints. **Deferred (YAGNI):** timezone-bucket sharding
to shrink the payload further was considered but dropped — gzip already handles it and the
geo-index carries no timezone (the tz pick reuses `/tz-index.json`). **Invariant:** the deviation
number is always computed from exact longitude via `computeDeviation` (D-004/R-001); the
geo-index only supplies the _label_, never the number. Adopted with slice #7 (PR #47 / issue #7).

## D-018 — Longitude offset normalized across the antimeridian · accepted

Solar time is **cyclic** (period 24 h), but `longitudeOffsetMinutes = standardOffset − 4×longitude`
computed a raw value that could sit a full day off for places whose longitude and UTC offset
straddle the date line (West longitude, East UTC +13/+14: Tonga, Samoa, Wallis). Nuku'alofa read
+1485 min (~24.75 h) instead of ~+45 — exactly 1440 min high — and the marker left the scale.
**Decision:** a pure `wrapMinutes` folds the longitude offset into the principal range
**[−720, +720)** (mod 1440); `computeDeviation` applies it to `longitudeOffset`, and `total`
stays the sum of the three components. **Why wrap the component, not `total`:** it keeps **D-004's
additive invariant** (`longitudeOffset + equationOfTime + dst === total`) intact while making the
offset itself physically meaningful. **No-op for normal cities** (already in range), so existing
domain tests are unchanged; **no `scaleWindow`/UI change** (WIDEST 720 now always suffices — the
domain, not the scale, was the bug). **Assumption:** ±720 min is the correct principal range for a
clock-vs-sun deviation; any real value outside it indicates a date-line artifact, not a real
offset. Found by the slice #8 verification scan. Adopted with fix #50 (PR #52 / issue #50).

## D-019 — Build-time OG cards via satori + resvg · accepted

Share previews need a 1200×630 image per city (deviation number + name). **Decision:** generate
them **at build time**, not runtime — `satori@0.26.0` renders a programmatic card (JSX + the
`tokens.css` palette, D-006) to SVG, then `@resvg/resvg-js@2.6.2` rasterizes to PNG, exposed as
the endpoint `/og/[slug].png` (home = `/og/home.png`). The card's number flows through the same
`format.ts` helpers as `cityViewModel`, so it is the **SSOT number** (R-001), never recomputed.
A pure `ogCardModel(cityName, deviation)` holds the layout (tested under D-012). Font: **JetBrains
Mono (OFL)** bundled — satori needs the font bytes, no system fallback at build. **No Nano Banana**
— per-city cards are programmatic; the design tool stays for the separate mood/hero raster (D-007).
**Failure policy:** a single per-city render failure degrades to the branded card; a systemic
failure fails the build (fail-fast). **Trade-off:** ~130 s added to the CI build and no valid
cross-build caching (see R-010); accepted as CI-only cost. Adopted with slice #9 (PR #54 / issue #9).

**Amendment (2026-07-11, #90) — top-K per-city + brand tail.** Scaling the dataset to ~5,000 cities
(#90) would make "one satori render per city" dominate the build (linear in city count — R-010, the
~10 min projection). **Decision:** decouple OG from page count — only the **top-K cities by
population** (`k = 1000`, matching the pre-#90 coverage so nothing regresses) get a bespoke
`/og/<slug>.png`; every **tail** city's `og:image` points at the existing shared brand card
**`/og/home.png`** (one file, not ~4,000 near-identical renders). Build stays ~flat (measured **2m
28s** for 5,119 pages + 1,000 PNGs, vs the old ~130 s for ~1,085).

**One SSOT for membership — do not duplicate it.** A pure `topOgCitySlugs(cities, k=1000)`
(`src/lib/ogPolicy.ts`) returns the `ReadonlySet<slug>` of top-K cities (population desc,
**slug-asc** deterministic tie-break — the shipped `City` carries no `geonameId`, so slug is the
stable secondary key). **Both** consumers read this one helper: the endpoint `og/[slug].png.ts` gates
`getStaticPaths` to it (so exactly the top-K PNGs render), and `seoMeta(city, d, hasOwnOgCard)` emits
the per-city path only when the caller reports membership, else the brand path. If they derived
membership independently they'd drift → a page pointing at a `/og/<slug>.png` that was never rendered
(404) or wasted renders no page references. `[city].astro` computes the set **once** in
`getStaticPaths` and threads each city's membership through props (frontmatter-only; the page body is
untouched, so #87's parallel body work rebases clean). **Invariant unchanged:** a top-K card's number
is still the build-date SSOT via `ogCardModel` (R-001); the tail just swaps _which image_ the
`og:image` names, never a number. Amended with #90.

**Amendment (2026-07-12, #131) — one brand OG card for _every_ page; per-city cards deleted.** The
per-city card baked the deviation **number** into a PNG at build, but that number includes **`dst`
(±60 min)** and **`equationOfTime` (±~30 min/yr)** — so a card rendered in July showed a **false**
number when the link was shared/viewed in January, and the raster (unlike the page, D-003) can't
recompute for today. **Decision:** point **every** page's `og:image`/`twitter:image` at the existing,
numberless brand card **`/og/home.png`** (which already served the 4000+ tail post-#90) and **delete
per-city OG generation entirely**. It swaps a "pretty-but-wrong" share preview for an
"honest-and-fast" one, and drops OG cost from ~1,000 satori renders to **one** (R-010 → resolved).
**Removed:** `src/pages/og/[slug].png.ts`, `src/lib/ogPolicy.ts` (the top-K SSOT — now moot),
`src/lib/ogCard.ts` (the city-card text model — now unused), and `renderCityCard`/`cityCard` from
`renderOgCard.ts`; `seoMeta` lost its `hasOwnOgCard` param (`ogImagePath` is always the brand path).
**Kept:** `brandCard`/`renderBrandCard` + `og/home.png.ts`, unchanged. **Consequence — #90's top-K
machinery is fully reverted:** the "one SSOT for membership" note above and the `topOgCitySlugs`
lockstep are now historical (no consumer derives membership; there is one image for all). **Out of
scope (flagged):** `<meta description>` still bakes the number (same staleness) — text, not a raster,
and the owner's ask was the share image; left as a separate content decision, so `seoMeta` still takes
`d`. **Invariant:** the _page's_ hero number is still the SSOT recompute (R-001/D-003); only the raster
— which never recomputed — is dropped.

## D-020 — Environment-based stage/prod split (`SITE_ENV`) · accepted

The site had no way to differ between stage and prod — `build` was identical and
`public/robots.txt` (a static `Disallow: /`) would have shipped to prod too. **Decision:** a single
build-time flag **`SITE_ENV=prod`** (set in `deploy:prod`; unset = stage) is read once in
`src/config/site.ts` and drives everything env-dependent: the `site` URL, per-page `noindex`, the
robots endpoint, and sitemap gating. **robots** is now a generated endpoint — stage `Disallow: /`,
prod `Allow: /` + `Sitemap:` (replaces the static file). **sitemap** (`@astrojs/sitemap@3.7.3`,
prod-gated) lists the 1085 city URLs, excludes `/` (noindex, D-005) and all endpoints;
`trailingSlash: 'never'` keeps sitemap/canonical URLs aligned with firebase `cleanUrls`
(D-002 / firebase.json). **`site` = `https://solar-time-prod.web.app`** (Firebase default; a
custom domain is a one-line change before prod is ever indexed — R-006). **Invariant:** `/` is
always noindex; city pages are noindex on stage, indexable on prod. Adopted with slice #9
(PR #54 / issue #9).

## D-021 — Preact (not React) for client islands · accepted

The one interactive island (`CitySearch`) shipped a ~184 KB React runtime on **every page** —
a direct departure from D-001's "near-zero JS" ideal for a minimalist static tool. **Decision:**
use **Preact** for islands, via a **full migration to `preact/hooks`** (not `@astrojs/preact`'s
`compat` shim) so no React/`react-dom` alias ships. Measured payload drop for the per-page island:
**raw −79.5 %** (221 → 45 KB), **gzip −74.9 %** (71 → 18 KB). Fuse.js and the pure
`src/lib/citySearch.ts` logic are framework-agnostic and were untouched — only the component
wrapper + test harness (`@testing-library/preact`) changed. **Assumption / guardrail:** future
islands use Preact + `preact/hooks`; mind the event-model differences from React (see R-012).
Realizes the D-001 intent that earlier slices deferred. Adopted with perf #44 (PR #56 / issue #44).

## D-022 — Analytics + error monitoring stack (deferred, cookieless, scrubbed) · accepted

Product needs anonymous usage analytics + error monitoring (D-008, PRD stories 29–30) without
betraying the tool's privacy-first, near-zero-JS posture (D-001). **Decision:** **Firebase
Analytics** (cookieless) + **Sentry** (error-only), both booted by a single shared
**`deferredInit`** after `requestIdleCallback`, mounted from `Base.astro` as a plain module
`<script>` (not a Preact island — D-021). Both SDKs are **dynamically imported inside the idle
callback**, so their weight (Firebase ~446 KB) never enters the critical path. **Cookieless:**
gtag `client_storage: 'none'` + `send_page_view: false` + ad/Google signals off — no analytics
cookie (Installations' IndexedDB is not a cookie); no consent banner. **Error-only:**
`tracesSampleRate: 0` and no tracing/replay integrations imported, so none ship; `environment`
from `SITE_ENV` (D-020). **Privacy invariant:** Sentry's `beforeSend` runs the pure, hard-tested
`scrubEvent`, which removes GPS by key name, `[lat, lon]` array shape, URL param, and free-text
decimal — a coordinate must never leave the device (PRD story 30). **Env-key delivery:** client
keys via `PUBLIC_*` (inlined, non-secret); **an unset key group disables that SDK**, so builds/CI
run green without real keys and the feature ships dormant until keys are provisioned. **Pinned:**
`firebase@12.15.0`, `@sentry/browser@10.63.0`. **Assumption:** the pure `src/lib` cores
(`scrubEvent`, `idleScheduler`, event bus/buffer) carry the guarantees under the D-012 gate; the
SDKs stay true-external adapters. Adopted with slice #10 (PR #61 / issue #10).

**Correction (2026-07-07, PR #68):** the "cookieless" mechanism above was implemented as gtag
`client_storage: 'none'`, but **GA4 ignores that flag and still writes `_ga` cookies** — the
decision (cookieless) stands, the mechanism was wrong. Actual cookieless is achieved via **GA4
Consent Mode**: `setConsent({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data:
'denied', ad_personalization: 'denied' })` **before** `initializeAnalytics`, so GA4 writes no
cookies and sends cookieless pings (verified in-browser: `document.cookie === ''`). The ineffective
`client_storage: 'none'` was dropped.

## D-023 — Prod env keys via `.env.prod` + dotenv-cli (not Vite mode) · accepted

Analytics keys (D-022) differ per environment, but the stage/prod split is driven by `SITE_ENV`
(D-020), **not** Vite mode — and every `astro build` runs in Vite **production** mode, so a magic
`.env.production` would be auto-loaded for the _stage_ deploy too, defeating the split. **Decision:**
keep prod keys in a **non-magic `.env.prod`** and have `deploy:prod` load it explicitly via
**`dotenv-cli`** (`SITE_ENV=prod dotenv -e .env.prod -- npm run build && firebase deploy …`).
Because `dotenv-cli` puts the values in `process.env`, and Vite's `loadEnv` gives `process.env`
precedence over `.env` files, `.env.prod`'s `PUBLIC_*` win over the auto-loaded stage `.env` —
verified end-to-end (`projectId → solar-time-prod` under the dotenv run vs `→ solar-time-stage` on
a plain build). A non-magic filename is never auto-loaded, so stage/dev builds can't accidentally
pick up prod keys. **Secrets hygiene:** `.gitignore` covers `.env` + `.env.*` with a
`!.env.example` negation; only the empty-valued `.env.example` is tracked. **Dep:** `dotenv-cli`
(exact devDep). **Assumption:** all client keys stay `PUBLIC_*` (inlined, non-secret — Firebase web
config + Sentry DSN are safe to expose); a truly-secret key would need a different channel (CI
secret, not `.env.prod`). Adopted with the prod-env-delivery chore (PR #65).

## D-024 — `country` resolved at build, alt-name shown only on an alt-match · accepted

Search rows defaulted their secondary label to the first alt-name (#43), which reads as cryptic
noise (`Prague · Praag`). **Decision:** the secondary label is the **country**; the matched alt is
shown **only when the match actually came via an alt**.

**Where country comes from.** `geonames.ts` already parses `countryCode`; it was dropped at the
`toCities` projection. It is now resolved to an **English country name at build time** by the pure
helper `resolveCountryName` (`scripts/citySlug.ts`) using the built-in
`Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })` — no new dependency — and the
**resolved name is stored** in `cities.json` (static and review-friendly; nothing resolves at
render). **Unknown ⇒ absent, never a placeholder:** the field is omitted entirely (helped by
`exactOptionalPropertyTypes`, so `undefined` is not assignable), so the UI renders no country and
no dangling `·`. Three unresolvable shapes, all → `undefined`:

- **empty** code (some dump rows carry none);
- **structurally invalid** code — `.of()` throws `RangeError` (e.g. `"1"`, `"E"`);
- **well-formed but unassigned** — `fallback: 'none'` returns `undefined` (e.g. `"XX"`, `"AA"`).

**The `ZZ` trap (why `fallback: 'none'` is not enough).** `ZZ` is the ISO 3166-1 "unknown or
unspecified" sentinel, but CLDR defines it as a real territory whose English display name is the
literal string **`"Unknown Region"`**. So `.of('ZZ')` returns a _name_, not `undefined`, and the
obvious "did `.of` echo the code back?" check does **not** catch it. `ZZ` is therefore rejected by
an explicit code guard. Do not "simplify" that guard away.

**Alt-match provenance.** Fuse runs with `includeMatches: true`; `searchCities` returns
`CityMatch[]` (`{ city, matchedAlt? }`), not `SearchCity[]`. `matchedAlt` is set **only when the
result carries no `name` key** among its matches — a canonical-name hit is self-explanatory and
falls back to the country. When one query matches several alts, the alt **equal to the query** is
preferred (typing `Praha` must not surface `Praag`); ties fall back to the lowest `refIndex`, so
the pick stays deterministic.

**Payload (amends D-016's "weigh new attributes against payload size").** Country names are short:
the lean search index grows **43.2 → 46.7 KB gzip (+3.5 KB)** across 1084 cities. Accepted — the
disambiguation is exactly what D-016's consumer needs, and it becomes load-bearing once #90 scales
the dataset (multiple "Springfield", "San José"). **Invariant kept from #43:** the option's
accessible name is the city alone (`aria-label`); country/alt are decorative `aria-hidden` hints.
Adopted with feature #91.

## D-025 — JSON-LD from a pure builder, absolutized behind the `Astro.site` guard · accepted

The site needed structured data (#86) but had no place to put it. **Decision:** mirror the
`seoMeta.ts` contract (D-012) exactly — a **pure `src/lib/jsonLd.ts`** builds the nodes and
**`Base.astro` emits** them.

**Origin is a parameter, not an import.** `jsonLd.ts` never touches `Astro.site` or
`src/config/site.ts`; `homeJsonLd({ origin, … })` / `cityBreadcrumbJsonLd({ origin, … })` take the
absolute origin and resolve every `url` / `@id` / breadcrumb `item` through `new URL(path, origin)`.
That keeps the module unit-testable under the coverage gate and keeps URL-encoding correct for
non-ASCII slugs.

**The prop is a builder, not a value.** `Base.astro` takes
`jsonLd?: (origin: string) => JsonLdNode | readonly JsonLdNode[]` and calls it only when
`Astro.site` is set — the identical `&&` guard that already protects `canonical` and the OG image
(`Base.astro`). Passing pre-built nodes would have forced each page to duplicate that guard and to
decide what a node with a relative URL means. With a builder there is no such state: **no `site` ⇒
no call ⇒ the `<script>` disappears**, never a relative or `undefined` URL. Verified by rebuilding
with `site:` commented out (0 `ld+json` blocks, exactly like `rel="canonical"`). It also sidesteps
`exactOptionalPropertyTypes`: a function literal is always passed, never `undefined`.

**Two escaping hazards, both load-bearing — do not "simplify" either away.**

1. **`set:html` is mandatory.** Astro HTML-escapes text interpolation, so a plain
   `{JSON.stringify(node)}` child emits `&amp;` for `&` and produces broken JSON-LD. The tag also
   carries `is:inline` so Astro treats it as opaque markup rather than a bundleable script.
2. **`serializeJsonLd` rewrites `<` to its JSON unicode escape.** A literal `</script>` inside any
   string would otherwise close the tag early. `>` is deliberately left alone — it is inert once
   `<` cannot appear. `JSON.parse` decodes the escape back, so the payload is unchanged.

**Content is constrained by the visible page.** `WebSite` + `WebApplication` on `/` (linked by
`@id`), `BreadcrumbList` (`Home → {City}`, two levels, no invented category tier) on `/[city]`.
**No `aggregateRating`, `review`, `offers`, or `author`** — there is nothing truthful to put in
them. **No `potentialAction`/`SearchAction`**: the city search is a client island with no `?q=`
URL for a sitelinks searchbox to target, so claiming one would be schema that lies. The home
`title`/`description` are hoisted to consts in `index.astro` so the `<head>` and the JSON-LD cannot
drift apart.

**Scope:** `FAQPage` is **not** shipped. #86's body defers the FAQ to **#82**, which owns the
landing copy; inventing questions would violate the "schema matches the page" rule above. It
becomes a follow-up once #82 lands. **Note:** `/` is `noindex` today (D-005), so the home nodes are
inert until #82 — the breadcrumb on the indexable city pages (D-020) is what pays off now.
Adopted with feature #86.

## D-026 — City slugs frozen by a `geonameId → slug` registry + a dump checksum pin · accepted

Slugs **are** the public `/[city]` URLs (D-005), but slug assignment in `citySlug.ts` was a
function of **the whole dataset**, not of the city: on a name collision it appended `-{countryCode}`,
else `-{geonameId}`. So a city entering or leaving the upstream GeoNames dump could **silently rename
a _different_ city's URL** (R-016). Proven by #91: San Juan (AR) dropped out, the collision vanished,
and the surviving San Juan (PR) collapsed `san-juan-pr → san-juan`. Pinning the dump alone is **not
sufficient** — #90 deliberately scales the city count up, which re-introduces collisions and re-renames
slugs on a frozen dump. **Owner decision (via #116):** ship **layers 1 + 2**; layer 3 (redirects for
departed cities) is deferred to before indexing (#85 / R-006).

**Layer 2 — the registry is the SSOT for slugs.** A committed **`scripts/slug-registry.json`**
maps `geonameId → slug`. `toCities(records, registry)` (`scripts/citySlug.ts`) **reuses a
registered id's slug verbatim** and runs the derivation rule **only** for ids absent from the
registry, disambiguating a fresh slug against **both** its same-run peers **and** every slug already
frozen by the registry (base → `-{countryCode}` → `-{geonameId}`). Every fresh assignment is written
back. It returns `{ cities, registry }` and **never mutates** the input registry. Result: an existing
city keeps its URL forever; drift and #90's scale-up can only _add_ slugs.

- **Why a registry keyed by `geonameId`, not editing `cities.json`.** `cities.json` carries **no
  `geonameId`** (slug/name/coords/…), so it can't be the SSOT binding a city to its slug, and it
  can't be self-seeded. The registry is seeded **during regeneration**, where `GeoNameRecord.geonameId`
  is available: start empty → `build:cities` derives every slug (historical behaviour) and records it.
  Verified the empty-registry path is **byte-identical** to the pre-registry algorithm on the current
  dump (0 slug diffs across 1084 cities), so seeding introduced **zero** churn — `cities.json` is
  unchanged on `main`.
- **Byte-stable file:** numeric-`geonameId` key order, 2-space, trailing newline, Prettier-clean —
  a clean, reviewable diff on every future dataset change.

**Layer 1 — checksum pin (`scripts/cities15000.sha256`).** `buildCities.ts` hashes the **extracted
`cities15000.txt`** (not the `.zip` — zip metadata isn't byte-stable) and compares it to the committed
pin **before** doing any work. A mismatch **fails loudly** with both hashes; **`GEONAMES_ACCEPT_DRIFT=1`**
is the sole sanctioned bump — it skips the compare and **rewrites** the pin (how a future intentional
refresh like #90 updates it). The pure compare/rewrite decision lives in **`scripts/dumpChecksum.ts`**
(`sha256` + `reconcileChecksum`) so it's unit-testable **without** the network — kept out of
`buildCities.ts`, whose `main()` runs on import.

**CI unaffected:** CI runs `npm run build` (reads the committed `cities.json`), **never**
`build:cities` — the pin and registry only fire on a manual regeneration.

**Hard-to-reverse:** the registry is now authoritative; a slug can only change by an **explicit
registry edit**, never as a side effect of a dataset refresh. **#116 must land before #90** (#90
re-churns slugs without layer 2). **Residual (not covered):** a city that _disappears_ upstream still
leaves a dead URL — the layer-3 redirect pass, deferred to before indexing (R-016 → `mitigated`).
Adopted with fix #116.

## D-027 — Per-city prose + related-city links: same-tz-first relation, build-derived · accepted

#87 needed the thin `/[city]` pages to carry unique content and internal links without betraying
the near-zero-JS posture (D-001/D-013) or the SSOT number (R-001). Two pure `src/lib` helpers under
the D-012 gate; `[city].astro` + a new `RelatedCities.astro` only render their output.

**Prose is derived, never authored (R-001).** `cityProse(city, deviation)` builds the sentence from
the **same build-time `Deviation`** the hero shows — magnitude, direction, longitude-vs-zone-meridian
(read from the **sign of `longitudeOffset`**: positive ⇒ west of the meridian), and the real
solar-noon clock time. No fabricated city trivia — only what the solar math supports. **Distinct per
city, not a number-swap template** (the acceptance bar): the opener switches across three magnitude
bands + the in-sync case, the preposition flips with direction, and the meridian clause varies with
longitude — so two cities read materially differently, not the same words with a swapped number. Like
the SEO description (`seoMeta`), it is **baked at build date and not part of the client recompute** —
the same D-003 trade-off (numbers match the hero exactly at build; ±1-min lifetime drift accepted).

**Relation: same time zone first, nearest by distance as fallback.** Same UTC offset at different
longitudes ⇒ different solar drift, which is exactly what the tool is about — so `relatedCities`
leads with same-`timeZone` peers, ranked **most-populous-first with a slug tie-break** (deterministic,
date-independent → stable built HTML). It **tops up to the cap (6) with the nearest cities by
great-circle distance**. The fallback is **load-bearing, not an edge case: 272 of ~355 zones in the
current dataset are singletons** (e.g. `Pacific/Pitcairn`), which would otherwise link to nothing.
`country` (D-024) was considered as a third axis and **not used** — a weaker relation for a
solar-drift tool. Distance reuses the existing `haversineKm` (now **exported** from
`findNearestCity.ts`) and `parseLatitude` (`geoIndex.ts`) — no reinvented geo.

**Build-time only, zero client JS (D-013 upheld).** Both helpers run in `getStaticPaths`/frontmatter
over the full `CITIES` registry and emit plain crawlable `<a href>` anchors (`data-astro-prefetch`,
matching search results). Verified the city-page island bundle gains **no city names and no
`relatedCities`** — perf/bundle untouched. **Slugs are read from the registry, never hardcoded**, so
a parallel **#116** slug reshuffle is reflected on the next rebuild for free; tests use **synthetic
fixtures**, not real slugs, for the same reason.

**Constraint learned:** the registry projection (`CITIES.map(toRelatedCity)`) **must live inside**
`getStaticPaths` — Astro evaluates that function in isolation, so a module-scope const is out of scope
there and throws `ReferenceError` at build. Adopted with feature #87.

## D-028 — Brand mark on a dark tile (no `@media` swap) + manual raster generator · accepted

#89 replaced Astro's default favicon with the chosen brand mark (Concept C "sundial" — a gold ring
with a hand pointing off noon to a sun dot) and shipped the full icon set (`.svg`, `.ico`,
`apple-touch-icon`, PWA PNGs + `site.webmanifest`), plus the same mark beside the header wordmark
(the #80 scope-add: "one symbol everywhere").

**One SSOT for the mark: `src/lib/brandMark.ts`.** The mark geometry and colours live in one module
(gold `#e8a923` = `--accent`, tile `#141414`). `Base.astro` inlines it in the header via `set:html`;
`scripts/build-favicons.ts` rasterises the _same_ source into every format — so favicon, header icon,
and OG identity can never drift apart. It sits in `src/lib` (not `scripts/`) so it's importable by the
Astro layout and covered by the D-012 gate; a small string-assertion test keeps coverage green.

**A dark tile instead of a `prefers-color-scheme` fill swap.** The old default favicon was a monochrome
shape that swapped black↔white by scheme. Concept C is a _single gold_ mark, and gold on transparent
goes muddy on a light tab bar. So the mark **carries its own dark rounded tile** — it reads crisply on
both light and dark browser chrome with **no colour-scheme swap**, and it's exactly the badge the owner
picked. Verified at true 16px on both a white and a black background (the whole acceptance bar). The
same badge in the header reads as a small app-icon chip in light theme and blends its tile into the
near-black background in dark theme — the gold mark stays prominent in both. Stroke weights are bumped
from the source sketch (ring/hand 3–4 → 9) so the mark survives rasterisation to 16px.

**Raster set is generated, not hand-dropped (matches the `build:cities` ethos).**
`npm run build:favicons` is **manual, never CI** — CI runs `npm run build`, which serves the committed
static assets in `public/`. The generator reuses `@resvg/resvg-js` (already a dep, for OG cards) for
SVG→PNG and adds one exact devDep, **`png-to-ico` (3.0.2)**, for the multi-size `.ico` (16/32/48). The
`apple-touch-icon` is baked from a **full-bleed opaque square** (radius 0) because iOS composites a
transparent icon on black and rounds it itself; the tab/PWA icons use the **rounded** badge. Manifest
`name`/`short_name` = **"Solar Drift"** (post-#94 rename, not the ticket's stale "Solar Time").

## D-029 — `/` is an indexable landing; live-geo result stays client-only · accepted (amends D-005)

_(Drafted as "D-028" in the #82 grill; renumbered to D-029 because #89's brand-mark ADR took D-028
first — same content, next free number.)_

D-005 made `/` noindex (per-visitor live-geo, no stable URL content). #82 reverses that: `/` keeps
the **live tool as its hero** but earns indexing by adding stable, crawlable content around it — a
quiet keyword-led single `<h1>`, a short explainer, a top-24 City directory, and a FAQ — all present
in the HTML with JS off. The SSR Neutral default (labelled an estimate) means even Googlebot's
default render is a real, unique page. Consequences: `/` enters the sitemap + index on prod (noindex
on stage); `FAQPage` JSON-LD ships (D-025), though it no longer yields a SERP rich result (Google
removed FAQ rich results 2026-05-07) — kept for topical understanding; the WebApplication
`browserRequirements` claim is dropped as now-false.

**Layout revised during implementation (2026-07-12), owner-approved.** The grill had locked
"Editorial hero (`<h1>` + intro) on top, tool below". A pre-implementation review found that a wall
of editorial text above the number buried the tool — the immediacy _is_ the product. Research on how
real interactive-tool landings rank (time.is, epochconverter, unixtimestamp, whatismyip) converged on
the opposite arrangement, and it is also SEO-optimal: **the live number is the only thing above the
fold.** The keyword phrase moves into a **site-wide brand tagline** under the "Solar Drift" wordmark
in the shared header (`Base.astro`; touches #80's wordmark, owner-approved as a site-wide element),
and the page's single `<h1>` becomes **"What is solar time?"** in an explainer section _below_ the
tool — fully visible, just lower in the DOM, which carries full SEO weight (heading size/position is
not a ranking factor). Hiding text only from users (display:none-for-crawlers) was explicitly
rejected as spam. The routing split the owner also floated (`/` editorial + noindex `/me` +
`/coordinates`) was rejected: no comparable site noindexes its live result page, and burying an
immediacy-first tool one click deep hurts the exact thing that makes it valuable.
