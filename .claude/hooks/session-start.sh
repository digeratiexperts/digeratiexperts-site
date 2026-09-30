#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Makes the Scrollcraft preflight (.claude/skills/scrollcraft/scripts/doctor.mjs)
# green in a fresh web session: project dependencies, a FULL ffmpeg build (the
# sandbox only ships Playwright's stripped one), and the pre-installed Chromium,
# exported as SCROLLCRAFT_FFMPEG / SCROLLCRAFT_CHROME for the rest of the session.
#
# Idempotent, non-interactive, and never fatal: a missing optional piece is
# reported, not thrown. Local (non-web) sessions are left alone.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
CACHE="${HOME:-/root}/.cache/scrollcraft"
mkdir -p "$CACHE"

say() { echo "[session-start] $*"; }
persist() {
  # export for this shell and for the session (CLAUDE_ENV_FILE)
  export "$1=$2"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf 'export %s=%q\n' "$1" "$2" >> "$CLAUDE_ENV_FILE"
  fi
}
filters() {
  # number of filters an ffmpeg binary reports; a full build has hundreds
  "$1" -hide_banner -filters 2>/dev/null | wc -l | tr -d ' '
}

# ---------------------------------------------------------------- deps ----
if [ ! -d "$ROOT/node_modules" ]; then
  say "installing project dependencies"
  (cd "$ROOT" && npm install --no-audit --no-fund) || say "npm install failed; continuing"
fi

# -------------------------------------------------------------- ffmpeg ----
FF=""
for c in "${SCROLLCRAFT_FFMPEG:-}" "$CACHE/node_modules/ffmpeg-static/ffmpeg" "$(command -v ffmpeg || true)"; do
  if [ -n "$c" ] && [ -x "$c" ] && [ "$(filters "$c")" -gt 200 ]; then FF="$c"; break; fi
done
if [ -z "$FF" ]; then
  say "no full ffmpeg found; installing ffmpeg-static into $CACHE"
  if (cd "$CACHE" && npm install --no-audit --no-fund --prefix "$CACHE" ffmpeg-static@5 >/dev/null 2>&1) \
     && [ -x "$CACHE/node_modules/ffmpeg-static/ffmpeg" ] \
     && [ "$(filters "$CACHE/node_modules/ffmpeg-static/ffmpeg")" -gt 200 ]; then
    FF="$CACHE/node_modules/ffmpeg-static/ffmpeg"
  elif command -v apt-get >/dev/null 2>&1; then
    say "ffmpeg-static unavailable; trying apt-get"
    (export DEBIAN_FRONTEND=noninteractive; apt-get install -y -q ffmpeg >/dev/null 2>&1) || true
    if [ -x /usr/bin/ffmpeg ] && [ "$(filters /usr/bin/ffmpeg)" -gt 200 ]; then FF="/usr/bin/ffmpeg"; fi
  fi
fi
if [ -n "$FF" ]; then
  persist SCROLLCRAFT_FFMPEG "$FF"
  say "ffmpeg: $FF ($(filters "$FF") filters)"
else
  say "WARNING: no full ffmpeg build could be installed (network policy?). Scrollcraft encode/verify steps will fail until one is available."
fi

# -------------------------------------------------------------- chrome ----
CHROME="${SCROLLCRAFT_CHROME:-}"
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  CHROME="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -n 1 || true)"
fi
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  for c in /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium /usr/bin/chromium-browser; do
    if [ -x "$c" ]; then CHROME="$c"; break; fi
  done
fi
if [ -n "$CHROME" ] && [ -x "$CHROME" ]; then
  persist SCROLLCRAFT_CHROME "$CHROME"
  say "chrome: $CHROME"
else
  say "WARNING: no Chromium executable found; Scrollcraft verification (shoot.mjs) needs SCROLLCRAFT_CHROME."
fi

# ------------------------------------------------------------ preflight ----
if [ -f "$ROOT/.claude/skills/scrollcraft/scripts/doctor.mjs" ]; then
  (cd "$ROOT" && node .claude/skills/scrollcraft/scripts/doctor.mjs 2>&1 | sed 's/\x1b\[[0-9;]*m//g') || true
fi
exit 0
