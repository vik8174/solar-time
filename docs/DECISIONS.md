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
