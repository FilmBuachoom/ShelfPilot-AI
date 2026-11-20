#!/usr/bin/env bash
# Upload images to the repo's `pr-assets` release and print one "<file><TAB><url>" line per image.
# Usage: upload_screenshot.sh <owner/repo> <image-file>...
# Needs: gh (authenticated, token with contents: write).
set -euo pipefail

usage="usage: upload_screenshot.sh <owner/repo> <image-file>..."
repo="${1:?$usage}"
shift
[ "$#" -gt 0 ] || { echo "$usage" >&2; exit 1; }
for file in "$@"; do
  [ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }
done
command -v gh >/dev/null || { echo "gh CLI not installed." >&2; exit 2; }

if ! gh release view pr-assets --repo "$repo" >/dev/null 2>&1; then
  gh release create pr-assets --repo "$repo" --prerelease \
    --title "PR Screenshots" \
    --notes "Asset store for PR screenshots — not a real release, do not delete" >/dev/null
fi

# Stage under unique names outside the repo: duplicate asset names fail with 422.
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
stamp="$(date +%s)"
names=()
i=0
for file in "$@"; do
  i=$((i + 1))
  ext="${file##*.}"
  base="$(basename "$file" ".$ext")"
  base="${base//[^A-Za-z0-9_-]/-}"
  name="screenshot-${stamp}-${i}-${base}.${ext}"
  cp "$file" "$tmpdir/$name"
  names+=("$name")
done

(cd "$tmpdir" && gh release upload pr-assets "${names[@]}" --repo "$repo" >/dev/null)

urls="$(gh release view pr-assets --repo "$repo" --json assets --jq '.assets[] | "\(.name)\t\(.url)"')"
status=0
i=0
for file in "$@"; do
  name="${names[$i]}"
  i=$((i + 1))
  url="$(printf '%s\n' "$urls" | awk -F'\t' -v n="$name" '$1 == n { print $2 }')"
  if [ -n "$url" ]; then
    printf '%s\t%s\n' "$file" "$url"
  else
    echo "Uploaded but no URL found for $file ($name)" >&2
    status=1
  fi
done
exit "$status"
