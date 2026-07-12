# Ubiquitous language — Solar Drift

One language across code, docs, and UI. Terms here become variable names, file
names, and labels. Started during the #82 grill (indexable landing).

## Terms

- **Landing** — the home page `/` in its new role (#82): an indexable page that
  keeps the live tool as its hero but adds stable, crawlable editorial content
  around it. Amends D-005.
- **Brand tagline** — a site-wide line under the "Solar Drift" wordmark in the
  shared header ("How far your clock is from the sun", `Base.astro`). Quiet, sans;
  keeps the keyword phrase visible above the fold on every page. **Not** an `<h1>`
  (the header repeats on every page; each page owns its own single heading).
- **Explainer** — the "What is solar time?" section _below_ the tool: its `<h1>`
  is the Landing's single, keyword-bearing heading ("solar time"), followed by a
  short definition. Fully visible, lower in the DOM — full SEO weight, nothing
  hidden — so the live number stays the only thing above the fold. Heading size is
  not a ranking factor (#82 research).
- **Editorial content** — the crawlable prose the Landing adds around the tool:
  the **explainer**, the **City directory**, and the **Landing FAQ**, all _below_
  the tool. Visible with JS off. (Revised from the grill's "Editorial hero on
  top" — see Decisions.)
- **Live-geo tool** — the client-rendered hero: the deviation number, solar scale,
  and "📍 Use my location". Sits directly under the header — the visual focal point
  _and_ (via its server-rendered default) crawlable. (The home island, D-013.)
- **Neutral default** — the SSR snapshot the Live-geo tool shows before geolocation
  resolves: the most-populous city (deterministic, population-desc). Rendered
  **labelled as an estimate** ("Estimated for your region"), never as the visitor's
  own value. Keeps the first paint full (LCP/CLS) without the old "−1 min flash".
- **Estimate state** — the Live-geo tool's pre-GPS state: a timezone estimate
  computed client-side from `Intl` (no GPS), upgrading the Neutral default. The
  first _meaningful_ number the visitor sees.
- **City directory** — a build-time static grid of internal `<a>` links to the
  **top 24 cities by population** (same population-desc sort as the Neutral
  default — SSOT). Stable editorial content + crawl/PageRank funnel to `/[city]`.
  Rendered in the `.astro` template (not the client island), so D-013 holds. A
  _hub_ of the biggest cities — distinct from #87's per-city same-timezone
  "related cities" (neighbours).
- **Landing FAQ** — 2 Q&A below the explainer ("Why is my clock ahead of or behind
  the sun?", "What is the equation of time?"). ("What is solar time?" is the
  explainer `<h1>`, so it is not repeated as a FAQ.) Worker drafts, grounded in the
  existing city-page explanations (accurate, not invented); coordinator reviews.
  Emits **`FAQPage` JSON-LD** verbatim-matching the visible copy (D-025 builder
  pattern). Note: Google **removed FAQ rich results** (2026-05-07), so the JSON-LD is
  for topical understanding, not a SERP snippet.

## Decisions locked (this grill)

- Live-geo tool **stays on `/`** — no `/me` route. One page serves crawler + visitor.
- **Tool-first layout (revised 2026-07-12).** The grill locked "Editorial hero on
  top; tool below", but the owner reversed it during implementation after research
  on interactive-tool landings (time.is, epochconverter, whatismyip): the **live
  number is the only thing above the fold**. The keyword phrase lives in a
  site-wide **brand tagline** under the wordmark; the page's single `<h1>` ("What
  is solar time?") and the rest of the editorial prose (directory + FAQ) sit
  **below** the tool — fully visible, lower in the DOM, which carries full SEO
  weight, nothing hidden (hidden-only-for-crawlers text would be spam). Captured in
  ADR **D-029**.
- Neutral default is **SSR + labelled as estimate** (option A), not a blank/skeleton
  — chosen to protect LCP/CLS over eliminating the single quiet repaint.
- **City directory = top 24 by population, flat** (no region grouping in v1).
- **Landing FAQ ships now**, and **emits `FAQPage` JSON-LD immediately** (closes the
  #86 debt in the same PR).
- **`<h1>` is keyword-led, not brand-led:** the single `<h1>` is `What is solar
time?` (in the explainer) — it carries the "solar time" keyword. The brand "Solar
  Drift" lives in the wordmark / `<title>` / `og:site_name` / domain, with the
  tagline "How far your clock is from the sun" beneath it — never spends the h1 on a
  zero-search-volume brand term. `<title>` stays brand-led (title ≠ h1). Aligns with
  `seoMeta`'s intentional "solar time = keyword, Solar Drift = brand" split.
- **Indexing:** `noindex={!IS_PROD}` (indexable on prod, noindex on stage — like
  city pages); flip the sitemap filter to **include** `/`; self-canonical `/`.
- **`browserRequirements` removed** from the WebApplication JSON-LD (#86): the
  Landing now serves meaningful content with JS off, so "Requires JavaScript." is
  false. JS only _enhances_ (the Live-geo tool).

## Grill status

#82 design tree **resolved** (2026-07-11). All three flagged owner decisions +
hero structure + flash handling + h1 keyword + FAQ/JSON-LD + indexing mechanics
locked above. Ready for the D-005-reversal ADR (**D-029**) and the worker brief.
`context.md` + the ADR land in #82's implementation PR (add a pointer to this file
in `AGENTS.md`/`CLAUDE.md` there).
