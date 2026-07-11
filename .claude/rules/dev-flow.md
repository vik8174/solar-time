# Dev Flow

## Start a ticket — isolate in a worktree (R-008)

Every ticket runs in its **own git worktree** off a fresh `main`, never in the
shared primary clone. Provision one with the paved-path script:

```sh
scripts/ticket-worktree.sh <branch-name>   # e.g. chore/worktree-guardrail
```

It fetches `origin`, creates `../solar-time-<branch>` on `<branch-name>`
tracking `origin/main`, provisions the worktree's `node_modules` (symlinked
from the primary clone, or `npm install` as a fallback), and prints the path to
`cd` into. The symlink makes the `pre-push` gate (below) run immediately — no
manual `npm install` needed.

`npm run dev` works inside a worktree. `astro.config.mjs` widens Vite's
`server.fs.allow` to the symlink's real `node_modules` whenever `node_modules`
is a symlink, so the dev server can serve dependencies that resolve outside the
worktree root; without it the islands 403 and never hydrate (fix #114). In the
primary clone the widening is skipped entirely and Vite's defaults apply.
**Caveat:** all worktrees share one Vite dep-optimizer cache, so two dev servers
running at once can invalidate each other — restart the affected one (R-018).

This is enforced by a committed **`pre-commit` git hook**
([`.githooks/pre-commit`](../../.githooks/pre-commit), wired by the same
`core.hooksPath` as `pre-push`): it hard-blocks a commit on `main`/`stage` or in
the primary clone, allowing commits only from a linked worktree on a feature
branch. `git commit --no-verify` remains an accepted escape hatch — CI is the
backstop.

## Pre-PR checks

Local checks run **cheapest-first**, so a fast failure (a type error, a lint
nit) stops you before you spend time on the slower stages. Run them in this
order before opening a PR:

| #   | Stage       | Command                 | Notes                                                              |
| --- | ----------- | ----------------------- | ------------------------------------------------------------------ |
| 1   | Typecheck   | `npm run typecheck`     | `astro check`                                                      |
| 2   | Lint        | `npm run lint`          | ESLint                                                             |
| 3   | Prettier    | `npm run format:check`  | `npm run format` to auto-fix                                       |
| 4   | Tests + cov | `npm run test:coverage` | Enforces coverage thresholds (below)                               |
| 5   | QA          | `qa` agent              | Audit coverage gaps, edge cases                                    |
| 6   | Code review | `code-reviewer` agent   | Before the PR                                                      |
| 7   | Docs        | edit `docs/`            | `PROGRESS.md` entry (+ DECISIONS/RISKS if any) **in this same PR** |
| 8   | PR          | `gh pr create`          | One PR = code + docs; coordinator gates the merge (HITL)           |

The `docs/` update ships **in the same PR as the change** — not a separate journal
PR. Run `npx prettier --write docs/*.md` before pushing (Prettier is in the gate).

**Fill the real PR number in the `docs/` entry.** The entry is written before
`gh pr create`, so the number isn't known yet — write `_pending_`, then once the PR
exists replace it with `#<N> (merged) · **Issue:** #<M> (closed)` and **push to the
same branch** (still one PR, one extra push). Don't leave `_pending_` in a merged
entry — that's exactly the drift the single-PR flow exists to prevent.

## Enforced automatically

Stages 1–4 are wired into a committed **`pre-push` git hook**
([`.githooks/pre-push`](../../.githooks/pre-push)) so a broken push is rejected
locally before it ever reaches CI:

```sh
npm run typecheck && npm run lint && npm run format:check && npm run test:coverage
```

The hook is activated by the `prepare` npm script
(`git config core.hooksPath .githooks`), which runs on `npm install`/`npm ci`.
No extra dependency is added.

## Coverage thresholds

`npm run test:coverage` scopes coverage to the logic dirs (`src/lib`,
`src/domain`) and fails under: **statements 90 / lines 90 / functions 90 /
branches 80**. `src/data` is excluded — it holds generated tables with no
hand-written logic. See [`vitest.config.ts`](../../vitest.config.ts).

## Build

`npm run build` is **CI-only** — it is not part of the local `pre-push` hook,
to keep the local loop fast. CI runs it (and the same 1–4 checks) on every push
and PR.

## Regenerating the city dataset (`build:cities`, R-016)

`npm run build:cities` refetches the **live, unversioned** GeoNames dump and
rewrites `src/data/cities.json`. It is **manual only** — CI never runs it (CI
runs `npm run build`, which reads the committed `cities.json`). Two guards keep
a regeneration from silently changing public `/[city]` URLs:

- **Checksum pin** — the extracted dump is hashed (sha256) and compared to the
  committed `scripts/cities15000.sha256`. If upstream moved, the build **fails
  loudly** (`GeoNames dump changed (sha … ≠ pinned …)`) instead of importing the
  drift. A plain re-run on an unchanged dump is a no-op.
- **Slug registry** — `scripts/slug-registry.json` maps every `geonameId` to its
  slug. A registered city keeps its slug **verbatim, forever**; only genuinely
  new ids get a fresh slug (written back into the registry). So drift and #90's
  scale-up can only _add_ URLs, never rename one.

**Sanctioned dump bump** (an _intentional_ refresh, e.g. #90): re-run with

```sh
GEONAMES_ACCEPT_DRIFT=1 npm run build:cities
```

This skips the compare and **rewrites** `scripts/cities15000.sha256` to the new
hash — an explicit, reviewed act. Commit the updated `cities15000.sha256`,
`slug-registry.json`, and `cities.json` together, and review the `cities.json`
diff like any other change. Without the flag, a drifted dump is rejected.
