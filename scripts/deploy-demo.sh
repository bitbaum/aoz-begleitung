#!/usr/bin/env bash
#
# Deploy the AOZ demo instance (https://aoz.orangecat.ch).
#
# WHY THIS EXISTS, AND WHAT IT IS NOT
# -----------------------------------
# The real deployment (aoz-wohnen.orangecat.ch) is push-to-master CD via
# loki's reusable `selfhost-deploy.yml`. This demo instance is NOT on
# that pipeline yet: it is a second app on the same box, and registering a new
# app is a change in the loki repo, not this one.
#
# So this script is the honest interim — a named, committed, repeatable
# procedure rather than a sequence someone has to remember. Until the instance
# is registered for CD, **a push to master does not update aoz.orangecat.ch**;
# this script does.
#
# WHY A SEPARATE BUILD AT ALL
# ---------------------------
# `NEXT_PUBLIC_BRAND` is inlined at BUILD time, so an AOZ-branded instance
# cannot be served from the WG-branded build the CD pipeline produces. Two
# brands means two builds means two deployments.
#
# WHAT IT DELIBERATELY DOES NOT TOUCH
# -----------------------------------
# /opt/aoz-wohnen, the aoz_wohnen database, and the real Witikonerstrasse data.
# The demo has its own app dir, its own database, its own role, its own systemd
# unit and its own session secret — a cookie minted here is not valid there.
set -euo pipefail

BOX="${BOX:-root@${HETZNER_IP:?set HETZNER_IP or BOX}}"
APP_DIR=/opt/aoz-demo/app
URL=https://aoz.orangecat.ch

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> verify"
pnpm run verify

echo "==> pull the box's env for the build"
# The BOX holds the runtime env; this build has to be made with it, not with
# whatever happens to be in the shell. `next build` runs with NODE_ENV=production
# and the app refuses to load without SESSION_SECRET and DATABASE_URL, so a
# build started anywhere those are absent dies at page-data collection with an
# error that reads like a code fault and is not one.
#
# "Anywhere" very much includes a git WORKTREE: `.env` is gitignored, so it
# exists in the main checkout and in none of the worktrees agents actually work
# in — the script ran fine for whoever wrote it and failed for the next person
# on the same commit. Pulling from the box removes the question.
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
ssh "$BOX" 'cat /opt/aoz-demo/shared/.env' > "$ENV_FILE"
[ -s "$ENV_FILE" ] || { echo "could not read the box env — refusing to build blind"; exit 1; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "==> build (brand: aoz)"
# A developer shell (direnv / .env) exports NODE_ENV=development. `next build`
# then prerenders with "Cannot read properties of null (reading 'useContext')"
# and the CSP includes 'unsafe-eval'. Pin production for this process only.
export NODE_ENV=production
rm -rf .next/standalone .next/static
NEXT_PUBLIC_BRAND=aoz pnpm run build

echo "==> assemble standalone bundle"
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "==> ship"
# launch.sh is excluded: the box's copy pins PORT and the env file path.
rsync -az --delete --exclude launch.sh .next/standalone/ "$BOX:$APP_DIR/"

echo "==> migrate the demo database"
# This step did not exist, and its absence is invisible until a schema change
# lands: the app ships, restarts, answers 200, and every page touching the
# changed table returns a server error. That is exactly what happened —
# `contactNote` and `claimedAt` reached the CODE and never the demo DATABASE,
# so /portal/marketplace 500'd while this script printed success.
#
# The real instance's CD runs migrations; this one is a second app on the same
# box and has to do it itself. Postgres here only accepts 127.0.0.1, so the
# migration runs ON the box against its own loopback.
#
# Drizzle migrations are plain forward-only SQL, applied with psql against the
# demo's own DATABASE_URL and ledgered in public._deploy_schema_history — the
# same ledger loki's apply-schema.sh keeps for the real instance, so both
# databases answer "what has been applied" the same way. Each file runs in a
# single transaction (-1); a failure aborts the deploy before the restart.
rsync -az --delete drizzle/ "$BOX:/opt/aoz-demo/drizzle/"
ssh "$BOX" 'bash -s' <<'EOSH' \
  || { echo "migration failed — NOT restarting into a schema the code cannot use"; exit 1; }
set -euo pipefail
cd /opt/aoz-demo && set -a && . ./shared/.env && set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qc \
  "CREATE TABLE IF NOT EXISTS public._deploy_schema_history (tag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
for f in drizzle/[0-9]*.sql; do
  tag=$(basename "$f" .sql)
  applied=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM public._deploy_schema_history WHERE tag = '$tag'")
  [ "$applied" = "1" ] && { echo "    $tag: already applied"; continue; }
  echo "    $tag: applying"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f "$f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qc "INSERT INTO public._deploy_schema_history(tag) VALUES ('$tag')"
done
EOSH

echo "==> restart"
ssh "$BOX" "chown -R ubuntu:ubuntu $APP_DIR && systemctl restart aoz-demo-app"

echo "==> verify live (not just 'CI is green')"
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/health")
[ "$code" = "200" ] || { echo "health check failed: $code"; exit 1; }

# Assert on CONTENT, never on liveness: a restart that silently failed on a
# busy port still answers 200 — from the OLD process.
html=$(curl -s "$URL/login")
grep -q 'AOZ Begleitung' <<<"$html" || {
  echo "live page does not carry the AOZ brand — stale build?"; exit 1;
}
grep -q 'loki.orangecat.ch/widget.js' <<<"$html" || {
  echo "live page does not carry the Loki widget — stale build?"; exit 1;
}
doors=$(curl -s "$URL/api/auth/demo" | grep -o '"id"' | wc -l)

# Walk through a demo door and read a real page behind it.
#
# Everything above this line passed while /portal/marketplace was returning a
# server error: /api/health touches one trivial query, /login is anonymous, and
# the door list is config. All three were incapable of failing on the thing that
# was actually broken — a missing column — so the script reported success on a
# demo whose main board was dead.
#
# A Next.js server error does not change the status code of an already-streaming
# RSC response; it appears in the payload as an error digest. So the check reads
# the body and refuses that, rather than trusting 200.
COOKIES=$(mktemp)
trap 'rm -f "$ENV_FILE" "$COOKIES"' EXIT
curl -s -c "$COOKIES" -X POST "$URL/api/auth/demo" \
  -H 'Content-Type: application/json' -d '{"role":"resident"}' -o /dev/null \
  || { echo "could not open the resident demo door"; exit 1; }

for path in /portal /portal/marketplace /portal/events /portal/reports; do
  body=$(curl -s -b "$COOKIES" "$URL$path")
  case "$body" in
    *'"digest"'*)
      echo "SERVER ERROR rendering $path — the page 500'd inside the stream"
      echo "  (a missing migration looks exactly like this)"
      exit 1
      ;;
  esac
  [ ${#body} -gt 2000 ] || { echo "$path rendered almost nothing"; exit 1; }
done

echo "    health 200, AOZ brand present, widget snippet present, $doors demo doors offered"
echo "    portal pages render behind a demo door: /portal, marketplace, events, reports"
echo "==> done: $URL"
