# Progress Log

Chronological record of what shipped. Newest on top. One entry per merged slice.

Format: `## Slice #N — <title>` · date · PR · outcome · notes.

---

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
