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

## R-003 — Branch protection deferred · open

Free + private repo rejects branch protection (classic and rulesets → 403). `main`/`stage`
are currently unprotected — discipline is manual. **Action:** enable rulesets
(require PR + `Checks` status + squash-only) when the repo goes public, before release.

## R-004 — PR merge is manually gated · accepted

Global hook `~/.claude/hooks/pr-merge-blocker.sh` blocks `gh pr merge` unconditionally.
Merges go through `gh api -X PUT repos/vik8174/solar-time/pulls/N/merge -f
merge_method=squash`, only after explicit user approval (HITL). Intentional guard.

## R-005 — Firebase account context · open

Firebase/gcloud CLI must be on **vik8174@gmail.com**, not the work Intellias account.
Wrong account → deploy to the wrong project or auth failure. **Action:** verify active
account before any deploy.

## R-006 — Custom domain not yet acquired · open

Skeleton/stage run on `*.web.app`. Custom domain (.app or .com, ~$12/yr) deferred to
the release slice. **Action:** buy + wire DNS + Firebase custom domain at release;
also flip repo public and add analytics keys then.

## R-007 — Repo still private · open

Portfolio value needs a public repo. Kept private until release-ready. Flip to public
at release (couples with R-003 branch protection and R-006 domain).

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

## R-011 — OG font glyph coverage · open

The OG card renders the city name with bundled **JetBrains Mono** (D-019). The current dataset is
Latin-script, but the registry can grow to include **non-Latin city names** (Cyrillic, CJK, Arabic,
…) whose glyphs the bundled font lacks — satori would render tofu/blanks rather than the name.
**Mitigation in place:** a render failure degrades to the branded card (no broken build).
**Action:** when a non-Latin name enters the dataset, either add a broad-coverage fallback font to
the satori pipeline or keep the deliberate brand-card fallback for uncovered names.

## R-012 — Preact event model differs from React · mitigated

The React→Preact swap (D-021) exposed behavioral gaps that compile fine but break at runtime:
Preact fires `onChange` **per keystroke** (use `onInput`), and **`onBlur` does not bubble** (use
`onFocusOut`). The latter was a real focus-handling regression in `CitySearch`, caught by
`code-reviewer` before merge. **Mitigation:** both fixed in perf #44 (PR #56), and a regression
test now pins the focus-out behavior. **Watch:** any future island interactivity on Preact must
use the DOM-native event names (`onInput` / `onFocusOut`, capture-vs-bubble) rather than assuming
React synthetic-event semantics — the type checker won't catch it.

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
