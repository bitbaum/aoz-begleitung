#!/usr/bin/env bash
# Live check of the Einsatzplatz form assistant, through the DEMO door only.
#
# Safe against production: form-assist returns values and never saves, and the
# demo door signs into the isolated demo world (re-seeded nightly), never a
# real staff account. Usage: bash scripts/smoke/form-assist.sh [base-url]
set -euo pipefail
BASE=${1:-https://aoz.orangecat.ch}
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

curl -fsS -c "$JAR" -H 'Content-Type: application/json' -d '{"role":"ADMIN"}' \
  "$BASE/api/auth/demo" >/dev/null
echo "== signed in via demo door"

post() {
  curl -sS -b "$JAR" -H 'Content-Type: application/json' -d "$1" "$BASE/api/ai/form-assist"
  echo
}

echo "== 1. fill from a short title"
post '{"target":"opportunity","intent":"fill","instruction":"Velomechaniker Werkstatt Brokito, Freiwilligenarbeit","values":{}}'

echo "== 2. refine: write the description (the reported failure)"
post '{"target":"opportunity","intent":"refine","instruction":"fülle beschreibung aus","values":{"title":"Velomechaniker bei Brokito","kind":"VOLUNTEERING","organisation":"Brokito","description":null}}'

echo "== 3. refine with pasted details fills empty fields"
post '{"target":"opportunity","intent":"refine","instruction":"Jeweils Dienstag und Donnerstag 13-17 Uhr in Zürich Altstetten, 2 Plätze","values":{"title":"Velomechaniker bei Brokito","kind":"VOLUNTEERING","organisation":"Brokito"}}'

echo "== 4. suggest improvements"
post '{"target":"opportunity","intent":"suggest","values":{"title":"Velomechaniker bei Brokito","kind":"VOLUNTEERING","organisation":"Brokito","description":"Velos flicken."}}'

echo "== 5. nothing to change answers in German"
post '{"target":"opportunity","intent":"refine","instruction":"lass alles so","values":{"title":"Velomechaniker bei Brokito"}}'
