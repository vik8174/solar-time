#!/bin/sh
# Paved path (R-008): provision a per-ticket git worktree off a fresh `main`.
#
# Usage: scripts/ticket-worktree.sh <branch-name>
#
# Fetches `origin`, then creates a linked worktree at `../solar-time-<branch>`
# on a new branch `<branch-name>` tracking `origin/main`, and prints the path
# to `cd` into. Run from anywhere inside the repository.
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

abs_path=$(cd "$worktree_path" && pwd)
echo ""
echo "Worktree ready. Enter it with:"
echo "  cd $abs_path"
