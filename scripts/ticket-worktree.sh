#!/bin/sh
# Paved path (R-008): provision a per-ticket git worktree off a fresh `main`.
#
# Usage: scripts/ticket-worktree.sh <branch-name>
#
# Fetches `origin`, then creates a linked worktree at `../solar-time-<branch>`
# on a new branch `<branch-name>` tracking `origin/main`, provisions its
# `node_modules` (symlinked from the primary clone, or `npm install` as a
# fallback) so the `pre-push` gate runs immediately, and prints the path to
# `cd` into. Run from anywhere inside the repository.
set -eu

branch="${1:-}"
if [ -z "$branch" ]; then
	echo "Usage: scripts/ticket-worktree.sh <branch-name>" >&2
	echo "Example: scripts/ticket-worktree.sh chore/worktree-guardrail" >&2
	exit 1
fi

# Sanitize the branch name into a filesystem-safe worktree suffix
# (e.g. `chore/worktree-guardrail` -> `chore-worktree-guardrail`).
suffix=$(printf '%s' "$branch" | tr '/' '-')

# Anchor to the PRIMARY clone regardless of where the script is invoked from:
# `--git-common-dir` always resolves to the primary clone's shared `.git`, even
# when run from inside a linked worktree, so its parent is the primary root. This
# keeps every sibling worktree in one consistent parent directory.
primary_root=$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd)")
worktree_path="$(dirname "$primary_root")/$(basename "$primary_root")-$suffix"

git fetch origin
git worktree add "$worktree_path" -b "$branch" origin/main

# Provision `node_modules` so the `pre-push` gate (D-012) runs immediately in the
# fresh worktree. Prefer symlinking the primary clone's `node_modules` (instant,
# avoids re-downloading the heavy `firebase-tools` tree); fall back to
# `npm install` when the primary has none. `node_modules` is git-ignored, so the
# symlink is never committed.
primary_node_modules="$primary_root/node_modules"
if [ -e "$worktree_path/node_modules" ]; then
	# Idempotent: already provisioned (e.g. a manual re-run of this step).
	echo "node_modules already present; leaving it as-is."
elif [ -d "$primary_node_modules" ]; then
	ln -s "$primary_node_modules" "$worktree_path/node_modules"
	echo "Linked node_modules -> $primary_node_modules"
else
	echo "Primary clone has no node_modules; running npm install in the worktree..."
	(cd "$worktree_path" && npm install)
fi

abs_path=$(cd "$worktree_path" && pwd)
echo ""
echo "Worktree ready. Enter it with:"
echo "  cd $abs_path"
