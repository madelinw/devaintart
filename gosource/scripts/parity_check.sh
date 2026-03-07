#!/usr/bin/env bash
set -euo pipefail

PROD_BASE="${PROD_BASE:-https://devaintart.net}"
STAGE_BASE="${STAGE_BASE:-https://devaintart-app-staging.up.railway.app}"
OUT_DIR="${OUT_DIR:-gosource/parity}"

mkdir -p "$OUT_DIR"

normalize_html() {
  sed -E 's/[[:space:]]+/ /g' | \
  sed -E 's/<!--[^>]*-->//g' | \
  sed -E 's/"(buildId|x-railway-request-id|x-request-id)"[[:space:]]*:[[:space:]]*"[^"]*"/"\1":"<redacted>"/g'
}

normalize_json() {
  jq -S '
    walk(
      if type == "object" then
        del(.updatedAt, .createdAt, .lastActiveAt, .resetTime)
      else . end
    )
  '
}

check_html() {
  local path="$1"
  local key
  key="$(echo "$path" | sed 's#^/##; s#[^a-zA-Z0-9._-]#_#g')"
  [[ -z "$key" ]] && key="root"

  curl -fsSL "$PROD_BASE$path" | normalize_html > "$OUT_DIR/prod_${key}.html"
  curl -fsSL "$STAGE_BASE$path" | normalize_html > "$OUT_DIR/stage_${key}.html"

  if ! diff -u "$OUT_DIR/prod_${key}.html" "$OUT_DIR/stage_${key}.html" > "$OUT_DIR/diff_${key}.html.diff"; then
    echo "HTML DIFF: $path"
  else
    rm -f "$OUT_DIR/diff_${key}.html.diff"
    echo "HTML OK:   $path"
  fi
}

check_json() {
  local path="$1"
  local key
  key="$(echo "$path" | sed 's#^/##; s#[^a-zA-Z0-9._-]#_#g')"

  curl -fsSL "$PROD_BASE$path" | normalize_json > "$OUT_DIR/prod_${key}.json"
  curl -fsSL "$STAGE_BASE$path" | normalize_json > "$OUT_DIR/stage_${key}.json"

  if ! diff -u "$OUT_DIR/prod_${key}.json" "$OUT_DIR/stage_${key}.json" > "$OUT_DIR/diff_${key}.json.diff"; then
    echo "JSON DIFF: $path"
  else
    rm -f "$OUT_DIR/diff_${key}.json.diff"
    echo "JSON OK:   $path"
  fi
}

HTML_PATHS=(
  "/"
  "/artists"
  "/chatter"
  "/tags"
  "/api-docs"
)

JSON_PATHS=(
  "/api/v1/artworks?limit=5"
  "/api/v1/feed"
  "/api/v1/artists?limit=5&shuffle=false"
)

for p in "${HTML_PATHS[@]}"; do
  check_html "$p"
done

for p in "${JSON_PATHS[@]}"; do
  check_json "$p"
done

echo "\nDiff files:"
ls -1 "$OUT_DIR"/diff_* 2>/dev/null || echo "None"
