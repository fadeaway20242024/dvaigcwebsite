#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGES_DIR="$ROOT/public/images"
MAX_THUMB=540
QUALITY=82

echo "Generating still thumbnails in $IMAGES_DIR ..."
count=0
while IFS= read -r -d '' src; do
  base="${src%.*}"
  dest="${base}-thumb.jpg"
  tmp="$(mktemp "${TMPDIR:-/tmp}/thumb-XXXXXX.jpg")"
  sips -Z "$MAX_THUMB" "$src" --out "$tmp" >/dev/null
  sips -s format jpeg -s formatOptions "$QUALITY" "$tmp" --out "$dest" >/dev/null
  rm -f "$tmp"
  count=$((count + 1))
done < <(
  find "$IMAGES_DIR" -type f \( -iname '*-still-*.jpg' \) ! -iname '*-thumb.jpg' ! -name '._*' -print0
)

echo "Done. Generated/updated $count thumbnails."
du -sh "$IMAGES_DIR"
