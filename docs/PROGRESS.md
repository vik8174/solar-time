# Progress Log

Chronological record of what shipped. Newest on top. One entry per merged slice.

Format: `## Slice #N — <title>` · date · PR · outcome · notes.

---

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
