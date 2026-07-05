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
