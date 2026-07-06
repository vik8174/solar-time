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

## R-009 — GeoNames attribution not yet shown · open

Slice #5 ships a dataset derived from GeoNames `cities15000`, licensed **CC-BY 4.0** —
the site must visibly credit GeoNames. No footer exists yet, so the attribution is
currently absent from the rendered pages (noted only in `cities.ts`/`buildCities.ts`
source headers). **Action:** add the GeoNames credit when the footer lands (slice #11);
must be in place before the repo goes public / release (R-007).
