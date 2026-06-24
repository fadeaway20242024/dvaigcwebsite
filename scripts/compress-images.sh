#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGES_DIR="$ROOT/public/images"
QUALITY_COVER=90
QUALITY_STILL=88
QUALITY_DEFAULT=88
MAX_COVER=1920
MAX_STILL=2560
MAX_AVATAR=1280

compress_one() {
  local src="$1"
  local base="${src%.*}"
  local name="$(basename "$src")"
  local dest="${base}.jpg"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/img-XXXXXX.jpg")"
  cp "$src" "$tmp"

  if [[ "$name" == *-cover.* ]]; then
    sips -Z "$MAX_COVER" "$tmp" >/dev/null
    sips -s format jpeg -s formatOptions "$QUALITY_COVER" "$tmp" --out "$dest" >/dev/null
  elif [[ "$name" == *-still-*.* ]]; then
    sips -Z "$MAX_STILL" "$tmp" --out "$tmp" >/dev/null
    sips -s format jpeg -s formatOptions "$QUALITY_STILL" "$tmp" --out "$dest" >/dev/null
  elif [[ "$name" == avatar.* ]]; then
    sips -Z "$MAX_AVATAR" "$tmp" >/dev/null
    sips -s format jpeg -s formatOptions "$QUALITY_DEFAULT" "$tmp" --out "$dest" >/dev/null
  else
    sips -Z "$MAX_STILL" "$tmp" >/dev/null
    sips -s format jpeg -s formatOptions "$QUALITY_DEFAULT" "$tmp" --out "$dest" >/dev/null
  fi

  rm -f "$tmp"

  if [[ "$src" != "$dest" && -f "$src" ]]; then
    rm -f "$src"
  fi
}

recompress_jpeg() {
  local src="$1"
  local name="$(basename "$src")"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/jpg-XXXXXX.jpg")"

  if [[ "$name" == *-cover.* ]]; then
    sips -Z "$MAX_COVER" "$src" --out "$tmp" >/dev/null
    sips -s formatOptions "$QUALITY_COVER" "$tmp" --out "$src" >/dev/null
  elif [[ "$name" == *-still-*.* ]]; then
    sips -Z "$MAX_STILL" "$src" --out "$tmp" >/dev/null
    sips -s formatOptions "$QUALITY_STILL" "$tmp" --out "$src" >/dev/null
  else
    cp "$src" "$tmp"
    sips -s formatOptions "$QUALITY_DEFAULT" "$tmp" --out "$src" >/dev/null
  fi

  rm -f "$tmp"
}

echo "Compressing PNG files in $IMAGES_DIR ..."
while IFS= read -r -d '' file; do
  compress_one "$file"
done < <(find "$IMAGES_DIR" -type f \( -iname '*.png' \) ! -name '._*' -print0)

echo "Recompressing existing JPEG files ..."
while IFS= read -r -d '' file; do
  recompress_jpeg "$file"
done < <(find "$IMAGES_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) ! -name '._*' -print0)

before="${1:-}"
if [[ -z "$before" ]]; then
  echo "Done."
  du -sh "$IMAGES_DIR"
fi
