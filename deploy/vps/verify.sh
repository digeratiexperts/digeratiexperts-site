#!/usr/bin/env bash
#
# Post-deploy verification for the Digerati Experts public website.
#
# Usage:
#   verify.sh staging.digeratiexperts.com
#   verify.sh digeratiexperts.com
#   verify.sh 127.0.0.1:3200 --insecure-http    # direct app check on the VPS
#
set -uo pipefail

HOST="${1:-}"
[ -n "$HOST" ] || { echo "Usage: $0 <hostname>[:port] [--insecure-http]" >&2; exit 64; }
SCHEME="https"
[ "${2:-}" = "--insecure-http" ] && SCHEME="http"
BASE="$SCHEME://$HOST"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$1"; }

code() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$1"; }
redirect_target() { curl -s -o /dev/null -m 20 -w '%{redirect_url}' "$1"; }

echo "== Verifying $BASE =="

# Homepage
[ "$(code "$BASE/")" = "200" ] && ok "homepage 200" || bad "homepage not 200"

# Health endpoints
[ "$(code "$BASE/healthz")" = "200" ] && ok "/healthz 200" || bad "/healthz not 200"

# All sitemap routes
SITEMAP="$(curl -s -m 20 "$BASE/sitemap.xml")"
if [ -z "$SITEMAP" ]; then
  bad "sitemap.xml empty"
else
  # No pipeline here: a `| while` subshell would drop PASS/FAIL increments,
  # letting the script exit 0 with broken sitemap routes.
  SITEMAP_URLS="$(echo "$SITEMAP" | grep -oE '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g')"
  for url in $SITEMAP_URLS; do
    path="${url#https://digeratiexperts.com}"
    c="$(code "$BASE$path")"
    [ "$c" = "200" ] && ok "sitemap $path" || bad "sitemap $path -> $c"
  done
fi

# /internal redirects
for p in /internal /internal/pricing-tiers /internal/sales-process; do
  c="$(code "$BASE$p")"
  t="$(redirect_target "$BASE$p")"
  if [ "$c" = "301" ] || { [ "$c" = "200" ] && [ -n "$t" ]; }; then
    ok "$p redirects (HTTP $c -> ${t:-followed})"
  else
    bad "$p returned $c (expected 301 to /)"
  fi
done

# Bundle content scan (no internal data / credentials in shipped JS)
TMP="$(mktemp -d)"
MAIN_JS="$(curl -s -m 20 "$BASE/" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
if [ -n "$MAIN_JS" ]; then
  curl -s -m 30 "$BASE$MAIN_JS" -o "$TMP/bundle.js"
  if grep -qE 'internal/pricing-tiers|internal/usp-worksheet|Guided Sales Pitch' "$TMP/bundle.js"; then
    bad "main bundle contains internal content"
  else
    ok "main bundle free of internal routes/tools"
  fi
  if grep -qE 'sk_live_|whsec_|jca_[A-Za-z0-9]{20}' "$TMP/bundle.js"; then
    bad "main bundle contains credential patterns"
  else
    ok "main bundle free of credential patterns"
  fi
else
  bad "could not locate main JS bundle"
fi
rm -rf "$TMP"

# HTTP -> HTTPS (only meaningful through the proxy, skip for direct app checks)
if [ "$SCHEME" = "https" ]; then
  c="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "http://$HOST/")"
  case "$c" in
    301|302|308) ok "http -> https redirect ($c)" ;;
    *) bad "http://$HOST/ returned $c (expected redirect)" ;;
  esac
fi

echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
