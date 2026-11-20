#!/usr/bin/env bash
# Print everything needed to describe a PR: branch, commits, files, stats, diff.
# Usage: gather_changes.sh <base-branch> [max-diff-lines]
set -euo pipefail

base="${1:?usage: gather_changes.sh <base-branch> [max-diff-lines]}"
max="${2:-300}"

if git rev-parse --verify --quiet "origin/$base" >/dev/null; then
  ref="origin/$base"
elif git rev-parse --verify --quiet "$base" >/dev/null; then
  ref="$base"
else
  echo "Base branch '$base' not found locally or on origin." >&2
  exit 1
fi

section() { printf '\n=== %s ===\n' "$1"; }

section "Branch"
echo "$(git rev-parse --abbrev-ref HEAD) -> $base (compared with $ref)"

ahead=$(git rev-list --count "$ref..HEAD")
if [ "$ahead" -gt 0 ]; then
  range="$ref...HEAD"
  section "Commits ($ahead, merges skipped)"
  git log "$ref..HEAD" --oneline --no-merges
else
  range="HEAD"
  section "Commits"
  echo "None ahead of $ref — showing uncommitted changes instead."
fi

section "Changed files"
git diff "$range" --name-status

section "Stats"
git diff "$range" --stat | tail -40

section "Diff (first $max lines)"
git diff "$range" | head -n "$max"
