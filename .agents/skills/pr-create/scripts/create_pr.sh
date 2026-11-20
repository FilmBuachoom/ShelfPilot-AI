#!/usr/bin/env bash
# Create a PR for the current branch with labels and draft state from the branch name.
# Usage: create_pr.sh <base> <title> <body-file> [--draft]
# Exit codes: 0 created or already exists (prints "EXISTS <url>"), 2 setup problem, 3 nothing to PR.
set -euo pipefail

base="${1:?usage: create_pr.sh <base> <title> <body-file> [--draft]}"
title="${2:?missing title}"
body="${3:?missing body file}"
draft="${4:-}"

command -v gh >/dev/null || { echo "gh CLI not installed (brew install gh | sudo apt install gh | winget install GitHub.cli)." >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated. Run: gh auth login" >&2; exit 2; }
[ -s "$body" ] || { echo "Body file is missing or empty: $body" >&2; exit 2; }

head="$(git rev-parse --abbrev-ref HEAD)"
case "$head" in
  main|master|develop|staging) echo "On protected branch '$head'. Create a feature branch first." >&2; exit 2 ;;
esac
[ "$head" != "$base" ] || { echo "Head and base are both '$base'." >&2; exit 2; }

git fetch --quiet origin "$base" 2>/dev/null || true
if git rev-parse --verify --quiet "origin/$base" >/dev/null; then ref="origin/$base"; else ref="$base"; fi
ahead="$(git rev-list --count "$ref..HEAD")"
[ "$ahead" -gt 0 ] || { echo "No commits ahead of $base. Nothing to PR." >&2; exit 3; }

if url="$(gh pr view "$head" --json url,state -q 'select(.state=="OPEN") | .url' 2>/dev/null)" && [ -n "$url" ]; then
  echo "EXISTS $url"
  exit 0
fi

label=""
case "$head" in
  feature/*|feat/*)  label="enhancement" ;;
  fix/*|hotfix/*)    label="bug" ;;
  docs/*)            label="documentation" ;;
  chore/*|refactor/*) label="maintenance" ;;
  release/*)         label="release" ;;
  wip/*|draft/*)     label="WIP"; draft="--draft" ;;
esac
if git log "$ref..HEAD" --format=%s | grep -qiE '\[(wip|draft)\]'; then draft="--draft"; fi

git push --quiet -u origin HEAD

args=(--base "$base" --head "$head" --title "$title" --body-file "$body")
[ "$draft" = "--draft" ] && args+=(--draft)
if [ -n "$label" ]; then
  if gh label list --limit 500 --json name -q '.[].name' | grep -qxF "$label"; then
    args+=(--label "$label")
  else
    echo "NOTE label '$label' not in repo — skipped" >&2
  fi
fi

gh pr create "${args[@]}"
