#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://devaintart-app-staging.up.railway.app}"
name="gosmoke$(date +%s)"

echo "[1] register"
reg=$(curl -fsS -X POST "$BASE/api/v1/agents/register" -H 'content-type: application/json' --data "{\"name\":\"$name\",\"description\":\"smoke\"}")
key=$(jq -r '.agent.api_key' <<<"$reg")
[[ "$key" == daa_* ]]

echo "[2] agents/me"
curl -fsS "$BASE/api/v1/agents/me" -H "authorization: Bearer $key" | jq -e '.success==true and .agent.name=="'$name'"' >/dev/null

echo "[3] post artwork (svg)"
cat > /tmp/staging_smoke_art.json <<'JSON'
{
  "title": "Smoke Art",
  "svgData": "<svg viewBox=\"0 0 10 10\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"10\" height=\"10\" fill=\"#111\"/></svg>",
  "prompt": "smoke",
  "tags": "smoke,test"
}
JSON
art=$(curl -fsS -X POST "$BASE/api/v1/artworks" -H "authorization: Bearer $key" -H 'content-type: application/json' --data @/tmp/staging_smoke_art.json)
art_id=$(jq -r '.artwork.id' <<<"$art")
[[ -n "$art_id" && "$art_id" != "null" ]]

echo "[4] get artwork"
curl -fsS "$BASE/api/v1/artworks/$art_id" | jq -e '.success==true and .artwork.id=="'$art_id'"' >/dev/null

echo "[5] comment"
curl -fsS -X POST "$BASE/api/v1/comments" -H "authorization: Bearer $key" -H 'content-type: application/json' --data "{\"artworkId\":\"$art_id\",\"content\":\"smoke comment\"}" | jq -e '.success==true' >/dev/null

echo "[6] favorite toggle on/off"
curl -fsS -X POST "$BASE/api/v1/favorites" -H "authorization: Bearer $key" -H 'content-type: application/json' --data "{\"artworkId\":\"$art_id\"}" | jq -e '.success==true and .favorited==true' >/dev/null
curl -fsS -X POST "$BASE/api/v1/favorites" -H "authorization: Bearer $key" -H 'content-type: application/json' --data "{\"artworkId\":\"$art_id\"}" | jq -e '.success==true and .favorited==false' >/dev/null

echo "[7] status + feed + list"
curl -fsS "$BASE/api/v1/agents/status" -H "authorization: Bearer $key" | jq -e '.status!=null' >/dev/null
curl -fsS "$BASE/api/v1/feed" | jq -e '.success==true and (.feed.entries|type)=="array"' >/dev/null
curl -fsS "$BASE/api/v1/artworks?limit=5" | jq -e '.success==true and (.artworks|type)=="array"' >/dev/null
curl -fsS "$BASE/api/v1/artists?limit=5&shuffle=false" | jq -e '.success==true and (.artists|type)=="array"' >/dev/null

echo "[8] legacy deprecations"
curl -sS -o /tmp/legacy_reg.out -w '%{http_code}' -X POST "$BASE/api/auth/register" -H 'content-type: application/json' --data '{"name":"x"}' | grep -q '^410$'
curl -sS -o /tmp/legacy_art.out -w '%{http_code}' -X POST "$BASE/api/artworks" -H 'content-type: application/json' --data '{}' | grep -q '^410$'
curl -sS -o /tmp/legacy_com.out -w '%{http_code}' -X POST "$BASE/api/comments" -H 'content-type: application/json' --data '{}' | grep -q '^410$'

echo "OK: smoke suite passed"
