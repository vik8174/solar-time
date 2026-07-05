# Risks & Open Problems

Things that could bite. Mark `open` / `mitigated` / `accepted` / `resolved` rather
than deleting — the trail matters.

---

## R-001 — SSG stale number vs client recompute drift · mitigated

`/[city]` bakes deviation at build date; browser recomputes for today. If the inline
script and the build-time path ever diverge, users see a flicker or a wrong number.
**Mitigation:** both use the exact same `computeDeviation` (SSOT, D-003/D-004).
**Implemented in slice #4 (PR #17):** build and client both call `cityViewModel` →
`computeDeviation`; the inline script is a thin caller with no re-implementation. Keep
this invariant when the dataset grows in slice #5.

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

## R-008 — Multiple agent sessions share one working copy · open

Slice #4 worker ran in the same clone (`~/Projects/solar-time`) as the coordinator. It
branched `feat/city-page` off an in-flight docs branch instead of `main`, and a
coordinator commit landed on the worker's branch because `HEAD` was switched underneath.
The docs infra got swept into the slice #4 squash — harmless this time, but
uncontrolled. **Action:** each worker session must run in its own `git worktree` (see
the `/worktree` skill), branched from `main`. Coordinator work also uses a separate
worktree. Never two sessions on one working tree.
