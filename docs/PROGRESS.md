# Progress Log

Chronological record of what shipped. Newest on top. One entry per merged slice.

Format: `## Slice #N — <title>` · date · PR · outcome · notes.

---

## Fix — recompute the city deviation on every nav (stale DST on navigated-to pages)

- **Date:** 2026-07-13
- **PR:** [#140](https://github.com/vik8174/solar-drift/pull/140) · **Issue:** #139 (closed) · guards R-001 · twin of #127
- **What:** the city page bakes its deviation at build time and a client script recomputes it for
  _today_ so daylight-saving flips stay correct (R-001, D-003/D-004). That recompute ran at
  **top-level module scope**, which Astro executes **once** on the initial load and **not** on
  View-Transition navigations — so any city reached by **in-app navigation** (search-select,
  related-city link) showed its **build-time** value, DST and all. A navigated-to page was off by the
  whole DST offset (~60 min) for ~half the year (whenever viewing-DST ≠ build-DST); the daily
  equation-of-time drift was stale too.
- **Proof (Playwright, clock faked to winter, Europe DST off):** `/zuerich` fresh load recomputed
  `+91/dst+60` → `+34/dst 0` ✓; but `/geneva` reached by navigation stayed `+101/dst+60` while a fresh
  `/geneva` was `+44/dst 0`. After the fix, the navigated value matches the fresh one (`dst 0`).
- **Fix:** run the recompute on `astro:page-load` (fires on the initial load **and** every nav),
  the twin of the share adapter in the same file and the same fix #127 made for the home island. The
  DOM-patching logic is extracted to `src/lib/cityRecompute.ts` (`recomputeCityView(doc, now)`) so it
  is unit-tested: a jsdom test asserts the DST component is `+60` in summer and `0` in winter and that
  the hero flips between them.
- **Scope:** `src/pages/[city].astro` (script now a thin `page-load` wrapper), new
  `src/lib/cityRecompute.ts` (+ test). Gate green: typecheck/lint/format, 385 tests (+4), coverage
  99.76%/94.89%. No ADR — restores the intended R-001 behavior; no contract change.

## Fix — hero entrance no longer replays on city→city nav (mobile multi-render feel)

- **Date:** 2026-07-12
- **PR:** [#138](https://github.com/vik8174/solar-drift/pull/138) · **Issue:** #137 (closed) · amends #84 (motion layer)
- **What:** on mobile, selecting a new city made the big deviation number look like it rendered
  several times; desktop was clean. **Not** a real re-render — instrumentation (Playwright Chromium /
  Pixel 5) showed exactly **one** navigation and **one** value swap (`+68` → `-13`). The visual
  doubling was **two overlapping "appear" animations on the new number**: the default View-Transition
  crossfade (`::view-transition-new(root)` fading in over the old snapshot with `plus-lighter`) plus
  the CSS `rise` **entrance** (#84). `<main>` is swapped on every ClientRouter nav, so the _one-time_
  entrance replayed on **every** city→city navigation; desktop paints fast enough to hide the overlap,
  slower mobile hardware doesn't.
- **Fix:** keep the entrance to a genuine fresh load — a new `suppressHeroEntrance(doc)`
  (`src/lib/heroEntrance.ts`) strips `.entrance` from the incoming document, called from
  `Base.astro`'s `astro:before-swap` listener. Navigations get the clean crossfade alone; the first
  load still animates (it renders server-side with the class, before any swap). Verified on
  Chromium/Pixel 5: `rise` fires **0×** on nav, **1×** on first load; navigation still lands on the
  target city.
- **Scope:** `src/lib/heroEntrance.ts` (+ test), `src/layouts/Base.astro`. Related-but-untouched: the
  solar-noon dot `noon-pulse` also replays per nav (subtle, not reported) — left for a follow-up.
- **Gate:** typecheck/lint/format green, 381 tests (+3), coverage 99.75%/95.62%. No ADR — behavior
  polish within #84's motion layer, no contract change.

## Fix — mobile suggestion tap navigates (real fix; #134 was ineffective on device)

- **Date:** 2026-07-12
- **PR:** [#136](https://github.com/vik8174/solar-drift/pull/136) · **Issue:** #135 (closed) · **Risk:** R-019 (new) · supersedes #134
- **What:** the mobile city-tap bug (#133) shipped a fix in #134 that **did not work on real
  devices** — the owner confirmed tapping a suggestion still selected nothing. This is the real fix,
  verified end-to-end on **Playwright WebKit / iPhone 13**.
- **Why #134 failed:** #134 used a `pointerDownInside` ref, set on `pointerdown` and cleared on
  `pointerup`, to make `focusout` skip the close. But the real iOS event order is
  `pointerdown → pointerup → mousedown → focusout(relatedTarget=null)` — `pointerup` fires **before**
  `focusout`, so the flag was already cleared when `focusout` ran and the guard did nothing. The list
  still closed before the tap's `click` reached the `<a>`. jsdom couldn't reveal this (it doesn't
  model tap-focus), so #134's unit test passed green while the bug persisted (→ R-019).
- **Fix:** `preventDefault()` on the option's **`onMouseDown`** — the emulated event that moves focus
  after a tap. Cancelling its default stops the input from blurring, so `focusout` never fires, the
  list stays open, and the `click` navigates. Same technique the clear (×) button already uses.
  Empirically only `mousedown` works on WebKit (`pointerdown`/`touchstart` don't). #134's dead
  `pointerDownInside` ref + pointer handlers are removed; `onFocusOut` is back to its simple form.
- **Verified:** WebKit/iPhone against the local dev server — tap "Tokyo" on `/prague` → navigates to
  `/tokyo`; event log shows `mousedown@option` then `click@option` with **no `focusout`** and the
  listbox open throughout (vs stage, where `focusout` closed it and `click` never fired). Gate green
  (typecheck/lint/format, 378 tests, coverage 99.75%/95.62%). The unit test now asserts the concrete
  contract — the option's `mousedown` default is prevented (jsdom models this faithfully).
- **Scope:** `src/components/CitySearch.tsx` (+ `CitySearch.test.tsx`), `docs/RISKS.md` (R-019).

## Fix — mobile: tapping a city suggestion did nothing (list closed, no nav)

- **Date:** 2026-07-12
- **PR:** [#134](https://github.com/vik8174/solar-drift/pull/134) · **Issue:** #133 (closed) · **Outcome:** shipped
- **What:** On touch browsers, tapping a `CitySearch` suggestion closed the dropdown but never
  navigated to the city — the current page stayed. Desktop was fine. **Root cause:** the container's
  `onFocusOut` closes the list when focus leaves with a `relatedTarget` that isn't a child. Desktop
  focuses the tapped `<a>` on click (`relatedTarget` = a child → list stays open → the click
  navigates); mobile browsers **don't move DOM focus onto a tapped link**, so the input blurred with
  `relatedTarget = null` → the list closed → the `<ul>` unmounted **before the tap's own `click`
  could fire** → nothing happened.
- **Fix:** a `pointerDownInside` ref (set on the container's `onPointerDown`, cleared on
  `onPointerUp`/`onPointerCancel`) lets `onFocusOut` distinguish a press that began inside the box
  (keep the list open — the ensuing `click` runs `selectCity`, which closes it) from a genuine
  focus-out (close as before). `pointerdown` fires first in every gesture, so the flag is ready by
  the time `focusout` runs. Keyboard/Enter, the clear (×) button, and outside-tap-to-close are all
  unaffected.
- **Scope:** `src/components/CitySearch.tsx` (+ `CitySearch.test.tsx`). A new behavioral test
  dispatches the exact native mobile ordering (`pointerdown` on the option → `focusout` with a null
  `relatedTarget` → `click`) — RED before the fix, GREEN after. Full suite 401✓, no ADR (behavior
  fix, no contract change).

## Fix #131 — one brand OG card for every page (drop per-city cards)

- **Date:** 2026-07-12
- **PR:** [#132](https://github.com/vik8174/solar-drift/pull/132) (merged) · **Issue:** #131 (closed) · **Risk:** R-010 + R-011 (→ resolved) · **ADR:** D-019 (amended)
- **What:** every page's `og:image`/`twitter:image` now points at the single, numberless brand card
  **`/og/home.png`**; per-city OG generation is deleted. Fixes a correctness bug **and** cuts the build.
  - **Why (staleness bug):** `/og/[slug].png` baked `computeDeviation` → the deviation number into a PNG
    at build. That number includes **`dst` (±60 min)** and **`equationOfTime` (±~30 min over the year)**,
    so a card rendered in July ("Prague +67 min") showed a **false** number when the link was shared/viewed
    in January — and that raster _is_ the social-unfurl preview. A raster can't recompute for today the way
    the page's inline script does (D-003), so the honest fix is a card with no number. The brand card already
    served the 4000+ tail (post-#90); this just extends it to the top-1000 too — one image for everyone.
  - **Why (build weight):** the top-K path ran **~1,000 satori/resvg renders** every build (~130 s of the
    2m28s #90 build, R-010). Now it's **one** render. Measured local `npm run build`: **9.19 s** for 5,119
    pages + **1** PNG (vs the ~2m28s recorded for 5,119 pages + 1,000 PNGs) — the ~1,000 per-city renders
    are gone.
- **Scope (deletion + simplification):**
  - `src/lib/seoMeta.ts` — dropped the `hasOwnOgCard` param; `ogImagePath` is **always** `BRAND_OG_PATH`
    (`/og/home.png`). `d` stays — it still drives the `<meta description>` (out of scope, see below).
    `seoMeta.test.ts` updated (per-city/tail OG assertions → "always brand card").
  - `src/pages/[city].astro` — removed `topOgCitySlugs`/`ogSlugs`/`hasOwnOgCard`; calls `seoMeta({name,slug}, deviation)`.
  - **Deleted:** `src/pages/og/[slug].png.ts`, `src/lib/ogPolicy.ts`(+test), `src/lib/ogCard.ts`(+test).
  - `src/og/renderOgCard.ts` — removed `renderCityCard` + `cityCard` + their sizing helpers
    (`valueFontSize`/`UNIT_FONT_SIZE`/`unitBaselineNudge`) + the now-unused `OgCardModel` import and
    `COLOR.text`. **Kept** `brandCard` + `renderBrandCard`. `src/pages/og/home.png.ts` unchanged.
- **Out of scope (flagged):** `<meta name="description">` **also** bakes the number (same staleness) — but
  it's text, not a raster, and the owner's ask was specifically about the share _image_. Left as-is; making
  it evergreen is a separate content decision. `seoMeta` still takes `d` for it.
- **Verified:** `dist/og/` has **only `home.png`** (no `/og/<slug>.png`); every sampled city page
  (prague/tokyo) emits `og:image`+`twitter:image` = `…/og/home.png`. Grep clean — no `ogPolicy`/`ogCard`/
  `renderCityCard`/`topOgCitySlugs`/`hasOwnOgCard` refs left. Gate green (typecheck/lint/format/tests);
  coverage stays green — the two deleted `src/lib` files were fully covered, so removing them left no gap
  (100% lines, branches 95.62% ≥ 80).

## Chore — v1 launch prep: hide donation + set prod domain

- **Date:** 2026-07-12
- **PR:** _pending_ · **Issue:** #128 (closed) · **Risk:** R-006 (resolves on deploy)
- **What:** Coordinator-authored release-prep for the v1 prod launch (config/ops only).
  1. **Donation temporarily hidden** (#128) — new `SUPPORT_ENABLED = false` flag in
     `src/config/links.ts` gates the support note (`Base.astro`) **and** the footer "Support"
     link. BMC has no payout connected and #81 replaces it with LiqPay; all markup/CSS/`SUPPORT_URL`
     kept in place, so re-enabling is a one-line flip (with #81's URL swap). Footer is now
     **Privacy · Feedback** (CSS-`gap` separators — no dangling divider).
  2. **Prod domain set** — `PROD_URL` in `src/config/site.ts` → `https://solardrift.app` (was the
     Firebase default `solar-time-prod.web.app`), so canonical / OG / sitemap URLs are the final
     domain from launch day (clean SEO, no `.web.app`→domain migration). R-006 resolves once the
     domain is attached in Firebase + DNS/SSL live and `deploy:prod` ships.
- **Scope:** `src/config/links.ts`, `src/config/site.ts`, `src/layouts/Base.astro` — visual/config
  only, no domain/`src/lib` logic. Deployed via the manual `deploy:prod` after the domain attaches.

## Feat #84 — Restrained motion layer (3 animations)

- **Date:** 2026-07-12
- **PR:** [#129](https://github.com/vik8174/solar-drift/pull/129) · **Issue:** #84 (`enhancement`, `afk`)
- **What:** a calm, polish-not-spectacle motion layer, all `transform`/`opacity` only (GPU-composited,
  zero layout shift), speaking one language via new motion tokens in `tokens.css` (D-006 SSOT):
  `--motion-fast` (180ms), `--motion-base` (400ms), `--motion-pulse` (1.4s), `--ease-out`. No ADR —
  motion tokens extend D-006 like #83's spacing scale.
  1. **Hero entrance** (rise+fade, `--motion-base`, once): `HeroNumber.astro` gained an `entrance`
     prop. Default `true` on `/[city]` (the SSR value is stable and _is_ the real answer). The old
     unconditional `.hero { animation: rise 0.7s }` moved behind `.hero.entrance`.
  2. **Solar-noon dot pulse** (`SolarScale.astro`): a single gentle breathe on appear (`--motion-pulse`,
     not an infinite loop — no noise/battery). The marker is injected via `set:html`
     (`scaleInnerSvg`, `src/lib` — untouched), so scoped styles can't reach it; targeted through a
     global `[data-scale] circle[style*='fill:var(--accent)']` hook. `transform-box: fill-box` pivots
     the scale on the circle's own centre → no position shift. Re-runs on each SVG re-inject (a fresh
     "appear"), never loops.
  3. **Value crossfade** (`--motion-fast`) on `/`: a `[data-result]` wrapper (eyebrow + number + scale +
     breakdown) dips opacity and back while `initHome`'s `paint()`/`setEyebrow()` swap the resolved
     value in — turning the SSG→estimate→📍 jump into a calm crossfade (also smooths the recompute
     jank). CSS transition on `[data-result]`; the JS timing (`setTimeout`) is gated by
     `matchMedia('(prefers-reduced-motion: reduce)')`. The step-1 same-city recompute paints directly
     (nothing visibly changes); only the estimate + 📍 real changes crossfade.
- **Animation 1 on `/` vs `/[city]` (no loading-state, D-029):** #82 shipped **without** a loading
  state — the SSR Neutral default is visible immediately (LCP). So on `/` there is no placeholder to
  wait past, and animating that misleading default would be a lie **and** delay the LCP number. Home
  therefore passes `entrance={false}`; its meaningful motion is the crossfade when the resolved value
  lands. The entrance-from-nothing belongs to `/[city]`, where the value is real at SSR. Net: removing
  the old 700ms opacity-0 entrance from home's LCP element is a small LCP win.
- **Reduced-motion (two layers, a11y stays 93 ≥ 91):** `tokens.css`'s `@media (prefers-reduced-motion:
reduce) { * { animation:none; transition:none } }` (wildcard) neutralises all three CSS-driven parts;
  the crossfade's JS `setTimeout` is _additionally_ gated by `matchMedia` so it paints instantly. Verified
  by forcing `matchMedia` → the estimate still paints, no stuck `is-swapping`.
- **Scope:** visual-only — `tokens.css`, `HeroNumber.astro`, `SolarScale.astro`, `index.astro`. No
  `[city].astro` change: its recompute is a same-value refresh, so the entrance (not a crossfade)
  carries its motion — anim 3 is scoped to home's multi-step recompute per the ticket. No
  domain/analytics/`src/lib` change, so no unit-test delta; coverage gate untouched (400 tests, 99.75%).
- **Verification (`/browser` in the worktree, #114):** `/prague` — entrance plays once (`animation-name:
rise`, `0.4s`), dot breathes (`noon-pulse`, `1.4s`, `fill-box`); `/` — hero has no entrance
  (`animation-name: none`, opacity 1 immediately), estimate arrives via crossfade (eyebrow → "Estimated
  from your time zone", **CLS = 0** measured through the swap). Forced reduced-motion → instant, nothing
  animates. Both themes × 375 / 768 / 1280. Lighthouse desktop: Accessibility 93, Best Practices 96.

## Fix #126 — Back-nav to `/` showed a stale "In sync"

- **Date:** 2026-07-12
- **PR:** [#127](https://github.com/vik8174/solar-drift/pull/127) · **Issue:** #126 (`bug`, `afk`)
- **What:** the home geo island (`src/pages/index.astro` `<script>`) ran its recompute at **module
  scope**, inside a one-shot `if (root && button && hint) { … }`. Astro runs a module `<script>` **once
  per full load** and does **not** re-run it across a View-Transition navigation, so on **Back** to `/`
  `<ClientRouter />` swapped `<main>` back to the SSR **Neutral default** (Shanghai, ~in-sync) and the
  island never re-fired — the hero (now the above-the-fold number since #82) stayed stuck on a stale
  **"In sync"** instead of the visitor's own estimate. `[city].astro` already avoided this via its
  `astro:page-load` re-bind (`initShare`); the home island had simply never adopted the pattern.
- **Fix:** re-scoped the whole block into a named **`initHome()`** registered **once** at module scope
  on **`astro:page-load`** (fires on the first full load _and_ every nav — the `initShare` twin). The
  DOM queries (`root`/`button`/`hint`) and the mutable state (`geoIndex`, reducer `state`) now live
  **inside** `initHome`, so each navigation starts on the fresh swapped-in nodes with clean state and
  the fresh button gets the listener (the detached one is GC'd — no stacking, no leak).
- **Re-entrancy guard:** because `initHome` is now re-entrant, all DOM writes (`setText`/`paint`/
  `setEyebrow`) query relative to **this invocation's `root`** instead of the global `document`. A
  slower async continuation (the `/tz-index.json` + `/geo-index.json` fetch, or a 📍 flow) that
  resolves _after_ the visitor navigated away and back now writes into a **detached `<main>`** — dead
  nodes — instead of clobbering the fresh page's hero. `renderControls` was already safe (it uses the
  closure-captured `button`/`hint`).
- **Scope:** `src/pages/index.astro` `<script>` only — no new DOM, no `src/lib`/`src/domain` change,
  so no unit-test delta; the re-scope exposed no new pure seam.
- **Verification (`/browser`, both themes):** `/` → `/privacy` → **Back** paints the estimate (+127,
  "Estimated from your time zone"), never "In sync"; same for a `/shanghai` → Back. Repeated navs stay
  consistent (no stacked listeners / stale state); fresh-load estimate paint, 📍 flow, and reducer
  state unregressed. Gate green (typecheck / lint / format / 400 tests).
- **Related:** #82 / D-029 (made the number the above-the-fold hero, so this was maximally visible),
  the `[city].astro` `initShare` pattern, D-013 (bundle isolation — unchanged).

## Feat #82 — `/` becomes an indexable SEO landing (amends D-005)

- **Date:** 2026-07-11
- **PR:** [#125](https://github.com/vik8174/solar-drift/pull/125) · **Issue:** #82 (`enhancement`, `hitl`)
- **What:** `/` was `noindex` (D-005): per-visitor live-geo with no stable URL content. #82 turns `/`
  into a real indexable landing while keeping the live tool as its hero — the **only thing above the
  fold**. The keyword phrase lives in a **site-wide brand tagline** ("How far your clock is from the
  sun") under the wordmark (`Base.astro`); the page's single `<h1>` is **"What is solar time?"** in an
  **explainer** _below_ the tool, followed by a build-time **City directory** (top-24 by population,
  flat `<a>` grid) and a **Landing FAQ** (2 Q&A). All the editorial content is crawlable HTML present
  with JS off; the SSR Neutral default makes even Googlebot's default render a real, unique page.
- **Layout revised mid-flight (D-029, owner-approved 2026-07-12):** the grill had locked an
  "editorial hero (`<h1>` + intro) on top, tool below" layout; the owner found the text wall buried
  the number (immediacy is the product). Research on real tool landings (time.is, epochconverter,
  whatismyip) confirmed the tool-first arrangement is _also_ SEO-optimal — heading size/position is
  not a ranking factor, below-the-fold prose keeps full SEO weight, and no comparable site noindexes
  its live-result page (so the `/`+`/me`+`/coordinates` routing split the owner floated was rejected).
  Net: number-hero above the fold; keyword in a site-wide tagline + the explainer `<h1>`; nothing
  hidden. Touches #80's shared wordmark (site-wide tagline, owner-approved).
- **Indexing mechanics:** `noindex={!IS_PROD}` (indexable on prod, `noindex` on stage — like the
  city pages, D-020); the sitemap filter now **includes** `/` (dropped the `path !== '/'` clause);
  self-canonical `/` already set. `<title>` stays brand-led; the single `<h1>` ("What is solar time?")
  carries the keyword, with the phrase also in the site-wide tagline.
- **JSON-LD (closes the #86 deferral, D-025):** added a pure, tested `faqJsonLd(items)` builder;
  the home `jsonLd` array now emits **`FAQPage`** verbatim-mirroring the visible FAQ (SSOT =
  `FAQ_ITEMS` in `index.astro`, now 2 Q&A — "what is solar time" became the explainer `<h1>`). Note:
  Google removed FAQ rich results (2026-05-07), so this aids topical understanding, not a SERP
  snippet. Dropped **`browserRequirements: "Requires JavaScript."`** from the `WebApplication`
  node — false now that the landing serves content JS-off.
- **HeroNumber** gained an `as?: 'h1' | 'p'` prop (default `h1`, city pages unchanged); the landing
  passes `as="p"` so the number is not a heading and the explainer `<h1>` is the page's only one.
- **Decision:** D-029 (`/` indexable landing; live-geo result stays client-only — amends D-005).
  Drafted as "D-028" in the grill, renumbered because #89 took D-028 first.
- **Docs:** committed `context.md` (ubiquitous language) + pointer in `AGENTS.md`; ADR D-029.
- **Verified:** prod build → `/` has no `noindex`, self-canonical, in the sitemap, `FAQPage` valid
  JSON with `<` escaped, single `<h1>` + 2 FAQ + 24 directory anchors in static HTML; stage build
  keeps `/` `noindex`.

## Fix #123 — Remove the dead × (broken dismiss) from the support note

- **Date:** 2026-07-11
- **PR:** [#124](https://github.com/vik8174/solar-drift/pull/124) · **Issue:** #123 (`bug`, `afk`)
- **What:** The **×** on the "Buy me a coffee ☕" note did nothing. Root cause was a CSS
  specificity bug: `.support { display: flex }` (`Base.astro`) overrode the UA `[hidden] {
display: none }` at **equal specificity**, so the later author rule won — setting
  `note.hidden = true` toggled the attribute but never hid the note. The dismiss was dead
  **entirely and across sessions**; the jsdom test passed because it asserted the `hidden`
  _attribute_, not the computed `display`. **Owner decision: remove the dismiss**, not fix it.
- **Clean removal (revert of slice #11's dismiss):** dropped the `.support-dismiss` `<button>`,
  the `data-support`/`hidden` attributes on the `<aside>`, the whole support `<script>`
  (`initSupport` / `readFlag` / `KEY` / the `astro:page-load` listener), and the `.support-dismiss`
  CSS (desktop + mobile). **Deleted `src/lib/supportVisibility.{ts,test.ts}`** — `shouldShowSupport`
  / `SUPPORT_DISMISSED` had no other consumers. Two now-stale prose comments referencing the
  "support-dismiss adapter" (`src/lib/share.ts`, `src/pages/[city].astro`) were retargeted to the
  geo adapter so the sanity grep stays clean.
- **Improvement:** the note is now a **static** SSR element — it renders **with JS off** too. Before,
  JS-off meant the note never appeared (it shipped `hidden` and only JS revealed it).
- **Verified:** note renders with **no ×** on `/`, `/[city]` (JS on **and** off — raw SSR HTML has
  `<aside class="support">` with no `hidden` and no reveal script), light **and** dark theme; still
  absent on `/privacy`. `grep -rn "support-dismiss\|shouldShowSupport\|supportVisibility\|SUPPORT_DISMISSED\|data-support" src/`
  → clean. Gate green; coverage stayed green (a fully-covered file was removed, not left uncovered).
- **Docs:** no ADR — reverts a slice-#11 feature, no new architectural contract.

## Feat #90 — Scale to ~5,000 cities + decouple OG from page count

- **Date:** 2026-07-11
- **PR:** [#120](https://github.com/vik8174/solar-drift/pull/120) · **Issue:** #90 (`hitl`)
- **What:** Only ~1,085 cities were searchable/indexable — the cap, not the pool, was the limit.
  Two owner decisions: (1) grow to ~5,000 cities by swapping the GeoNames dump **`cities15000` →
  `cities5000`** and raising `TARGET_SIZE` **900 → 5000**; (2) **decouple OG from page count** so the
  build stays ~flat instead of going linear-in-city-count (R-010). Final dataset: **5,117 cities**.
- **Sanctioned dump bump (D-026):** this **is** the intentional refresh #116 built for. Ran
  `GEONAMES_ACCEPT_DRIFT=1 npm run build:cities` — skips the checksum compare and **rewrites** the
  pin. Renamed `scripts/cities15000.sha256` → **`scripts/cities5000.sha256`**, new pin
  **`54d944478777b7ad966b458ef286bf9e390522c7e915a05f87950c4f8d45ecc6`**. Every path/const/comment
  naming the old dump updated (`buildCities.ts`, `geonames.ts`, `dumpChecksum.ts`, `cities.ts`,
  `dev-flow.md`).
- **Existing URLs safe by construction (#116 / D-026):** the `geonameId → slug` registry froze all
  1,084 prior slugs **verbatim** — verified **0 changed / 0 missing** across the old registry; only
  **4,040 new ids** got fresh slugs (registry **extended 1,084 → 5,124**, not rewritten). `/prague`,
  `/kashgar`, `/san-juan` byte-identical.
- **⚠️ 7 old city pages dropped** — `/hamilton` (Bermuda), `/jamestown`, `/marigot`, `/philipsburg`,
  `/san-marino`, `/vaduz`, `/yaren`. **Not a bug:** the zone-completeness pass picks the _largest_
  city per timezone, and the denser `cities5000` dump surfaced a larger (if less famous) city in each
  of these seven micro-state zones (San Marino → Serravalle, Vaduz → Schaan, Hamilton → Pembroke
  Parish, …), so every timezone stays covered. Their slugs remain **frozen in the registry** (a
  future re-entry keeps the URL). The dead URLs are the **R-016 layer-3 residual** (redirects,
  deferred to before indexing #85/R-006; stage is `noindex`, so no live 404s). **Flagged for the
  coordinator** — recognizable capitals were among them.
- **Decouple OG (D-019 amended):** new pure **`src/lib/ogPolicy.ts`** —
  `topOgCitySlugs(cities, k=1000)` → `ReadonlySet<slug>` (top-K by population, deterministic slug
  tie-break) is the **single SSOT** both OG consumers read. The endpoint
  (`og/[slug].png.ts`) gates `getStaticPaths` to that set → **exactly 1,000 per-city PNGs render**;
  `seoMeta` takes a `hasOwnOgCard` flag and emits `/og/<slug>.png` for the top-K, else the shared
  brand card **`/og/home.png`** (one file, not 4,000 copies). `[city].astro` computes membership once
  in `getStaticPaths` and passes it through props (frontmatter-only change; body untouched — stays
  out of #87's way).
- **Build stays ~flat:** local `npm run build` = **2m 28s** for **5,119 pages** + 1,000 OG PNGs —
  vs the pre-#90 ~130 s for ~1,085. **Not** the ~10 min a linear 5k-OG build would cost. `dist/`
  spot-check confirmed the split: `prague` → `og:image=/og/prague.png` (PNG present); tail cities
  (`schaan`, `yangor`, `serravalle`, `pembroke-parish`) → `og:image=/og/home.png` (no per-city PNG).
- **⚠️ search-index size (D-016 watch):** `/search-index.json` ships all cities to the client.
  Gzipped **48.2 KB → 188.5 KB** (raw 169.6 KB → 700.9 KB) at 5,117 cities — `altNames` (≤8)
  dominates. Under the 200 KB ceiling and **lazily fetched on idle** (off the critical path, D-016),
  so shipped as-is; **flagged** — if it grows further, trim tail `altNames` or shard (follow-up).
- **R-011 (OG font):** re-verified **0 non-Latin city names** in the 5,117-city set, so the bundled
  JetBrains Mono still covers every per-city card; the brand-card fallback remains the safety net.
- **Verify:** gate green — typecheck (0 errors) / lint / format:check / **test:coverage (376 tests,
  100 stmts·funcs·lines / 97 branches** on `src/lib`+`src/domain`; new `ogPolicy` + `seoMeta`
  branch tests). Local `build` (stage + prod) ran clean; sitemap grows to the new city count on the
  prod build (D-020).
- **Scope:** `scripts/buildCities.ts`, `scripts/cities5000.sha256` (renamed + re-pinned),
  `scripts/slug-registry.json` (+4,040), `src/data/cities.json` (regenerated — large but mechanical),
  new `src/lib/ogPolicy.ts` (+ test), `src/lib/seoMeta.ts` (+ test), `src/pages/og/[slug].png.ts`,
  `src/pages/[city].astro` (frontmatter only), comment/doc fixes (`geonames.ts`, `dumpChecksum.ts`,
  `cities.ts`, `dev-flow.md`), docs. **No domain/component-body changes.** Landed after **#87**
  (`[city].astro` body); rebased onto it — the frontmatter merge is additive (related + OG membership
  side by side), no body edits.

## Feature #89 — Favicon + brand mark (Concept C "sundial") + header icon

- **Date:** 2026-07-11
- **PR:** [#121](https://github.com/vik8174/solar-drift/pull/121) · **Issue:** #89 (hitl)
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
