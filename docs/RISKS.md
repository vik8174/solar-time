# Risks & Open Problems

Things that could bite. Mark `open` / `mitigated` / `accepted` / `resolved` rather
than deleting — the trail matters.

---

## R-001 — SSG stale number vs client recompute drift · mitigated

`/[city]` bakes deviation at build date; browser recomputes for today. If the inline
script and the build-time path ever diverge, users see a flicker or a wrong number.
**Mitigation:** both use the exact same `computeDeviation` (SSOT, D-003/D-004).
**Implemented in slice #4 (PR #17):** build and client both call `cityViewModel` →
`computeDeviation`; the inline script is a thin caller with no re-implementation.
**Held in slice #5 (PR #31):** the ~1000-city dataset did not break it — the island now
reads inlined `data-*` inputs (D-013) but still calls the same `cityViewModel` →
`computeDeviation` path, so the invariant survives the registry growth.

## R-002 — Astronomy accuracy · accepted

NOAA/Spencer approximation targets < 30 s error (D-004). Acceptable for a
"how far is your clock from the sun" tool; not for scientific use. Documented as a
known bound, not a bug.

## R-003 — Branch protection deferred · resolved

Free + private repo rejects branch protection (classic and rulesets → 403). `main`/`stage`
are currently unprotected — discipline is manual. **Action:** enable rulesets
(require PR + `Checks` status + squash-only) when the repo goes public, before release.
**Resolved (2026-07-07):** repo made public (R-007), then `main` protected — require PR
(0 approvals, solo maintainer), required status check `Checks` (strict/up-to-date),
`enforce_admins` on, force-push + deletion blocked; repo merge methods restricted to
**squash-only**. `stage` left unprotected for now (no deploy gate needed there yet) — the
release-blocking branch was `main`. **Note:** merges still go through `gh api …/merge`
(R-004 hook), which now additionally requires green `Checks` on the PR.

## R-004 — PR merge is manually gated · accepted

Global hook `~/.claude/hooks/pr-merge-blocker.sh` blocks `gh pr merge` unconditionally.
Merges go through `gh api -X PUT repos/vik8174/solar-time/pulls/N/merge -f
merge_method=squash`, only after explicit user approval (HITL). Intentional guard.

## R-005 — Firebase account context · accepted

Firebase/gcloud CLI must be on **vik8174@gmail.com**, not the work Intellias account.
Wrong account → deploy to the wrong project or auth failure. **Action:** verify active
account before any deploy. **Confirmed (2026-07-07, R-014 deploy):** active account was
`vik8174@gmail.com` and personal is the intended home for this portfolio project — no migration
needed. **Decision (2026-07-07):** the personal account is the **permanent** home — this is
Viktor's own project, so a work/org account is deliberately out of scope. Status → `accepted`;
the residual is only the recurring pre-deploy account check, not a pending decision.

## R-006 — Custom domain not yet acquired · open

Skeleton/stage run on `*.web.app`. Custom domain (.app or .com, ~$12/yr) deferred to
the release slice. **Action:** buy + wire DNS + Firebase custom domain at release;
also flip repo public and add analytics keys then.
**Chosen (2026-07-08):** **`solardrift.app`** — verified free (RDAP + no NS), matches the
Solar Drift brand (#94), `.app` = TLD-enforced HTTPS (zero friction with Firebase Hosting).
Recommended registrar: Cloudflare (at-cost, ~$14/yr, free WHOIS privacy). **Still pending
purchase** (owner action); once bought → attach in Firebase console → swap `site` in
`src/config/site.ts` → redeploy → resolve.

## R-007 — Repo still private · resolved

Portfolio value needs a public repo. Kept private until release-ready. Flip to public
at release (couples with R-003 branch protection and R-006 domain).
**Resolved (2026-07-07):** repo flipped to **public** (`gh repo edit --visibility public`)
after a clean history scan — real `.env`/`.env.prod` never committed (only `.env.example`),
no real Firebase/Sentry keys in history (client `PUBLIC_*` keys are non-secret by design,
D-008). Branch protection followed immediately (R-003). Re-adding the footer GitHub link is
now unblocked but optional (dropped in fix #62) — separate ticket if wanted.

## R-008 — Multiple agent sessions share one working copy · mitigated

Slice #4 worker ran in the same clone (`~/Projects/solar-time`) as the coordinator. It
branched `feat/city-page` off an in-flight docs branch instead of `main`, and a
coordinator commit landed on the worker's branch because `HEAD` was switched underneath.
The docs infra got swept into the slice #4 squash — harmless this time, but
uncontrolled. **Action:** each worker session must run in its own `git worktree`,
branched from `main`. Coordinator work also uses a separate worktree. Never two sessions
on one working tree.
**Mitigated in issue #28 (PR #35, D-015):** the convention is now enforced by a committed
`.githooks/pre-commit` guard that hard-blocks commits on `main`/`stage` and commits made in
the primary clone (must be a linked worktree), plus `scripts/ticket-worktree.sh` as the
paved path. `--no-verify` remains an escape hatch, so this is strong enforcement, not
absolute — kept as `mitigated`, not `resolved`.

## R-009 — GeoNames attribution not yet shown · resolved

Slice #5 ships a dataset derived from GeoNames `cities15000`, licensed **CC-BY 4.0** —
the site must visibly credit GeoNames. No footer existed, so the attribution was absent
from rendered pages (noted only in `cities.ts`/`buildCities.ts` source headers).
**Resolved in slice #11 (PR #58):** the footer now carries a visible “City data © GeoNames
(CC BY 4.0)” credit linking geonames.org on **every page** (verified in `dist` on
city/home/privacy). The R-007 release blocker for attribution is cleared.

## R-010 — OG generation build time · accepted

Slice #9 (D-019) regenerates ~1085 OG PNGs on every build, adding **~130 s** (~24 MB output,
~22 KB each). It runs **CI-only** (not in the local `pre-push` loop), so day-to-day dev is
unaffected. Cross-build caching is **not valid** — each card embeds the build-date deviation
number (D-003), so a cached image would go stale. **Accepted** for now as a CI-only cost.
**Watch:** if CI time or the city count grows painful, options are incremental/changed-only
regeneration, moving OG to a separate job, or dropping to on-demand generation.

## R-011 — OG font glyph coverage · accepted

The OG card renders the city name with bundled **JetBrains Mono** (D-019). The current dataset is
Latin-script, but the registry can grow to include **non-Latin city names** (Cyrillic, CJK, Arabic,
…) whose glyphs the bundled font lacks — satori would render tofu/blanks rather than the name.
**Mitigation in place:** a render failure degrades to the branded card (no broken build).
**Action:** when a non-Latin name enters the dataset, either add a broad-coverage fallback font to
the satori pipeline or keep the deliberate brand-card fallback for uncovered names.
**Decision (2026-07-07):** `accepted`. Verified all **1085** current city names are Latin-script
(diacritics only — e.g. `São`, `Zürich`, `Malmö` — all covered by JetBrains Mono); **zero**
Cyrillic/CJK/Arabic in the dataset. satori throws on an uncovered glyph, so `renderCityCard`'s
try/catch already degrades that one city to the brand card (`renderOgCard.ts`) — the build never
breaks and no tofu ships. Bundling broad-coverage fonts (Noto CJK/Arabic ≈ tens of MB) for names
that don't exist would be speculative build bloat (YAGNI). **Revisit only if** a non-Latin name
enters the registry — and even then the brand-card fallback may stay the deliberate choice.

## R-012 — Preact event model differs from React · mitigated

The React→Preact swap (D-021) exposed behavioral gaps that compile fine but break at runtime:
Preact fires `onChange` **per keystroke** (use `onInput`), and **`onBlur` does not bubble** (use
`onFocusOut`). The latter was a real focus-handling regression in `CitySearch`, caught by
`code-reviewer` before merge. **Mitigation:** both fixed in perf #44 (PR #56), and a regression
test now pins the focus-out behavior. **Watch:** any future island interactivity on Preact must
use the DOM-native event names (`onInput` / `onFocusOut`, capture-vs-bubble) rather than assuming
React synthetic-event semantics — the type checker won't catch it.

## R-014 — Analytics dormant until Google Analytics is linked · resolved

Slice #10 + the env-delivery chore (D-022 / D-023) ship analytics **inert** in two ways: (1) the
SDK is off unless its `PUBLIC_*` keys are set, and (2) even with Firebase keys in place, the
Firebase web config's **`measurementId` is still empty** in both projects — **Google Analytics
must be linked in the Firebase console** before Analytics actually collects events. Sentry only
needs its DSN. So on prod today, error monitoring can come up but usage analytics stays silent.
**Action (manual, ops):** in the Firebase console link a Google Analytics property to
`solar-time-prod` (and `-stage` if wanted), copy the resulting `measurementId` into
`.env.prod` / `.env`, and redeploy. Until then analytics is a no-op — not a failure, just unwired.
**No code change needed.**
**Resolved (2026-07-07):** GA linked to prod (`G-NZ83CW3T21`) and stage (`G-LL3CV51B2Q`), Sentry
DSN set in both env files, deployed stage→prod and **verified live in-browser** — `page_view` /
`city_selected` / `geolocation_used` pings fire cookieless (`gcs=G100`/`npa=1`, zero `_ga`, no
coords), Sentry captures with `environment=staging`/`production`. R-005 confirmed: Firebase stays
on personal `vik8174@gmail.com`. See PROGRESS "Ops — R-014".

## R-013 — Shared symlinked node_modules breaks under parallel dep changes · mitigated

`scripts/ticket-worktree.sh` symlinks each worktree's `node_modules` to the primary clone's
(fix #37/#38). That's fine for isolated work, but when a **parallel** slice changes dependencies —
its `npm install` mutates the shared `node_modules` — every other active worktree pointing at the
same symlink breaks mid-flight. Hit twice: #44's React→Preact swap removed `@astrojs/react` and
broke the parallel #11 worktree's typecheck/lint (~161 phantom errors), and the coordinator's
docs worktrees needed a manual `npm install` after #9/#44 landed new deps in main.
**Mitigation (manual):** run a worktree-local `npm ci` off the lockfile when the gate shows
dependency errors during a parallel dep-changing slice (what the #11 worker did). **Watch /
follow-up:** consider hardening `ticket-worktree.sh` — e.g. `npm ci` into the worktree instead of
symlinking (or detect a lockfile/`node_modules` mismatch) when a concurrent slice touches deps.
Acute only while two slices run in parallel and one changes `package.json`.

## R-015 — Firebase preview-channel quota exhausted → every PR's preview check is red · resolved

The `preview` job (`ci.yml:55`, `FirebaseExtended/action-hosting-deploy@v0`) creates a per-PR
Firebase Hosting preview channel on `solar-time-stage`. Firebase caps active preview channels per
site, and that cap is now reached: `POST …/channels → 429 "channel quota reached" RESOURCE_EXHAUSTED`.
Channels have `expires: 7d` (`ci.yml:86`) but are **never deleted on PR close**, so within any 7-day
window the accumulated `pr*` channels exceed the quota. Result: `Deploy Preview` + `PR preview deploy`
fail on **every** same-repo PR (seen on #93, #76, #75, #74 — including doc-only branches that don't
change site output, proving it's infra, not code). The required `Checks` gate is unaffected, so PRs
stay mergeable (`UNSTABLE`) and the coordinator merges as before — but the red X is misleading and
would mask a genuine preview regression. **Filed as issue #96.**
**Resolved (2026-07-08, PRs #99 + #100):** four-part fix —
(1) TTL `expires 7d → 2d` in `ci.yml` as a self-reclaim backstop;
(2) `continue-on-error` on the preview **deploy step** so an infra preview failure no longer
paints the run red while a genuine build regression still fails the job;
(3) a separate `preview-cleanup.yml` (kept out of `ci.yml` so the required `Checks` context is
untouched) with one `reclaim` job that, on `pull_request: closed`, deletes the PR's channel by
`pr<N>-` prefix (never guessing the truncated suffix), and on `workflow_dispatch` prunes **all**
`pr*` channels via the same `FIREBASE_SERVICE_ACCOUNT_STAGE` SA — no local Firebase login needed;
(4) one-time prune dispatched post-merge cleared **50 stale channels**, and the next PR (#100)
got a healthy preview channel again (state `CLEAN`, no 429).
**Gotcha for future edits:** the reclaim job needs `actions/checkout` — `firebase
hosting:channel:list/delete` error `"Not in a Firebase app directory"` without `firebase.json`,
and `--json` hides that error in stdout, so keep the failure-surfacing `cat channels.json`.

## R-016 — Regenerating `cities.json` picks up upstream GeoNames drift · mitigated

`npm run build:cities` refetches the live `cities15000` dump, so **any** regeneration also imports
whatever changed upstream since the last one — the diff is never "just the field I added".
Regenerating for #91 (first refresh in a while) moved the dataset **1085 → 1084 cities**: `comilla`
dropped out of the population pass (no `cumilla` replacement), `rawson` entered via the
zone-completeness pass, and `san-juan-ar` + `san-juan-pr` **collapsed into a bare `san-juan`** —
once only one San Juan survived, the collision that forced the country suffix was gone.

**The nasty part:** slug assignment was a function of the **whole dataset**, so a city entering or
leaving renamed a **different** city's public `/[city]` URL — invisible in code review, only in the
data. Pinning the dump alone is **not sufficient**: #90 scales the count up on a frozen dump, which
re-introduces collisions and re-renames slugs.

**Mitigated (2026-07-10, fix #116 — layers 1 + 2, see D-026):**

- **Slug registry (the root fix).** `scripts/slug-registry.json` freezes every city's slug by
  `geonameId`; `toCities` reuses a registered slug verbatim and only assigns fresh slugs to new ids.
  An existing city's URL **cannot change** when another city enters/leaves — pinned by a regression
  test that removes a colliding San Juan and asserts the survivor's slug is stable. Seeding was
  **byte-identical** to the old algorithm (0 slug diffs / 1084 cities), so `cities.json` is unchanged.
- **Checksum pin.** `scripts/cities15000.sha256` + `buildCities.ts` **fail the build loudly** on
  upstream drift; `GEONAMES_ACCEPT_DRIFT=1` is the sanctioned bump. A regeneration now either
  reproduces `cities.json` byte-for-byte or stops with a clear "dump changed — review & bump" error.

**Why `mitigated`, not `resolved`.** Layers 1 + 2 kill the **URL-rename** hazard. The residual: a
city that genuinely **disappears** upstream still leaves a **dead `/[city]` URL** (no redirect yet).
That's **layer 3** (redirects / tombstones for departed slugs), deliberately deferred to **before the
site is indexed** (#85 / R-006) — stage is still `noindex`, so no live URL 404s today. Track layer 3
there; #90 (scale the count) is now safe on layer 2.

## R-017 — `scripts/*.test.ts` never ran (dormant tests) · resolved

`vitest.config.ts` scoped `test.include` to `src/**/*.{test,spec}.{ts,tsx}`, so the sibling tests
for the build-time generator — `scripts/citySlug.test.ts` and `scripts/geonames.test.ts` — **matched
nothing and never executed**, in CI or in the `pre-push` gate. They looked like coverage but were
dead weight: `npx vitest run scripts/citySlug.test.ts` reported "No test files found".

This bit #91 directly. The acceptance-critical `resolveCountryName` edge cases live script-side; a
test asserting `resolveCountryName('ZZ') === undefined` sat there **passing by never running**,
while the implementation actually returned `"Unknown Region"` (D-024).

**Resolved (2026-07-10, #91):** `test.include` now also matches `scripts/**/*.{test,spec}.{ts,tsx}`.
`coverage.include` is deliberately **unchanged** (still `src/lib` + `src/domain`) — the generator is
build glue, not shipped logic, so it runs but isn't held to the app's thresholds. Turning them on
immediately surfaced a **pre-existing wrong assertion** in `citySlug.test.ts` (it expected
`springfield-10`, but the record that collides correctly falls back to its _own_ id →
`springfield-20`); the assertion was fixed, the behavior was not touched.
**Lesson:** a test file that has never been observed to fail has never been observed at all.

## R-018 — Concurrent dev servers share one Vite dep-optimizer cache · open

Vite's default `cacheDir` is `<root>/node_modules/.vite`. Because `ticket-worktree.sh` symlinks
`node_modules` (D-015), that path **resolves to the same physical directory** for the primary clone
and for _every_ worktree — verified: `realpath <worktree>/node_modules/.vite` ==
`<primary>/node_modules/.vite`. So two `astro dev` servers running at once (say a worker in a
worktree and the coordinator in the primary clone) re-optimize deps into the same cache and
invalidate each other. Observed while fixing #114: after the worktree's server had run, the primary
clone's server answered `504 (Outdated Optimize Dep)` and a plain reload did **not** clear it — the
server had to be restarted.

**Pre-existing, not introduced by #114** — the symlink dates to #37/#38. It was simply unreachable
before, because `astro dev` in a worktree never got far enough to matter (the island 403'd). Fixing
#114 makes worktree dev servers useful, so this becomes hittable.

**Impact:** low and self-healing — restart the affected dev server. No effect on `pre-push`,
`astro build`, or CI (none of them use the dev optimizer cache).
**Watch:** acute only when two dev servers run **concurrently**. If it starts to bite, the one-line
fix is a per-worktree `vite.cacheDir` (outside the symlinked `node_modules`) in `astro.config.mjs`,
deliberately left out of #114 to keep that change small.
**Related:** R-013 (same symlink, different failure mode — parallel dependency changes).
