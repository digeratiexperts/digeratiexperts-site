#!/usr/bin/env bash
#
# Digerati Experts public website — VPS deployment script.
#
# Release-based deploy with health check and automatic rollback:
#
#   GitHub <branch>
#        ↓  git fetch (bare mirror in $SITE_HOME/app)
#   releases/<timestamp>/   (checkout + npm ci + npm run build)
#        ↓  build validation + release.txt commit marker
#   current -> releases/<timestamp>   (atomic symlink flip)
#        ↓  sudo -n /usr/bin/systemctl restart $SERVICE_NAME
#        ↓  sudo -n /usr/bin/systemctl is-active $SERVICE_NAME
#   health check (127.0.0.1 + public HTTPS) AND exact deployed commit verification
#        ↓  on failure: flip symlink back, restart, exit 1
#
# Production (authoritative):
#   User:        diger7051
#   Code:        /home/digeratiexperts.com/current
#   Service:     digeratiexperts-site (systemd — NOT PM2)
#   Repository:  https://github.com/digeratiexperts/digeratiexperts-site.git
#   Do NOT deploy from /root/Replit-Site
#
# Usage:
#   deploy.sh staging          # deploys to /home/staging.digeratiexperts.com
#   deploy.sh production       # deploys to /home/digeratiexperts.com
#
# Overridable environment variables (defaults set per target below):
#   DEPLOY_BRANCH        git branch to deploy            (default: main)
#   SITE_HOME            website home directory
#   APP_PORT             private 127.0.0.1 port the app listens on
#   SERVICE_NAME         systemd service to restart
#   PUBLIC_HEALTH_URL    public HTTPS healthz URL (production default set)
#   REPO_URL             git remote
#   KEEP_RELEASES        how many old releases to keep   (default: 3)
#   NO_SYSTEMD=1         test mode: start node directly instead of systemd
#                        (used for local/CI validation only)
#
set -euo pipefail

SYSTEMCTL="/usr/bin/systemctl"

TARGET="${1:-}"
case "$TARGET" in
  staging)
    SITE_HOME="${SITE_HOME:-/home/staging.digeratiexperts.com}"
    APP_PORT="${APP_PORT:-3200}"
    SERVICE_NAME="${SERVICE_NAME:-digeratiexperts-staging}"
    PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://staging.digeratiexperts.com/healthz}"
    ;;
  production)
    SITE_HOME="${SITE_HOME:-/home/digeratiexperts.com}"
    APP_PORT="${APP_PORT:-3300}"
    SERVICE_NAME="${SERVICE_NAME:-digeratiexperts-site}"
    PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://digeratiexperts.com/healthz}"
    ;;
  *)
    echo "Usage: $0 staging|production" >&2
    exit 64
    ;;
esac

REPO_URL="${REPO_URL:-https://github.com/digeratiexperts/digeratiexperts-site.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
NO_SYSTEMD="${NO_SYSTEMD:-0}"

MIRROR_DIR="$SITE_HOME/app"
RELEASES_DIR="$SITE_HOME/releases"
SHARED_ENV="$SITE_HOME/shared/.env"
CURRENT_LINK="$SITE_HOME/current"
LOG_DIR="$SITE_HOME/logs"
TS="$(date +%Y%m%d%H%M%S)"
NEW_RELEASE="$RELEASES_DIR/$TS"

log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# ---------------------------------------------------------------- preflight
command -v git  >/dev/null || fail "git not found on PATH"
command -v node >/dev/null || fail "node not found on PATH"
command -v npm  >/dev/null || fail "npm not found on PATH"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node 20+ required, found $(node --version)"

[ -f "$SHARED_ENV" ] || fail "$SHARED_ENV missing — create it before deploying (see deploy/vps/env.production.example)"
mkdir -p "$RELEASES_DIR" "$LOG_DIR"

if [ "$NO_SYSTEMD" != "1" ]; then
  # Fail fast if passwordless least-privilege sudo is missing (do not prompt).
  # Note: do NOT probe with `sudo -n true` — diger7051 sudoers only allows
  # specific systemctl verbs for this unit.
  set +e
  SUDO_PROBE_ERR="$(sudo -n "$SYSTEMCTL" is-active "$SERVICE_NAME" 2>&1 >/dev/null)"
  SUDO_PROBE_RC=$?
  set -e
  if printf '%s' "$SUDO_PROBE_ERR" | grep -Eqi 'password is required|a password is required|not allowed|not permitted|a terminal is required'; then
    fail "passwordless sudo required for: $SYSTEMCTL restart|is-active|status $SERVICE_NAME (deploy as diger7051 — not root/PM2//root/Replit-Site)"
  fi
  # rc 0 = active; rc 3 = inactive (both mean sudo worked). Other unexpected codes: warn only.
  if [ "$SUDO_PROBE_RC" -ne 0 ] && [ "$SUDO_PROBE_RC" -ne 3 ]; then
    log "WARN: systemctl is-active probe returned $SUDO_PROBE_RC ($SUDO_PROBE_ERR) — continuing; restart step will enforce success"
  fi
fi

# ---------------------------------------------------------------- fetch
if [ ! -d "$MIRROR_DIR" ]; then
  log "Cloning $REPO_URL (bare mirror) into $MIRROR_DIR"
  git clone --mirror "$REPO_URL" "$MIRROR_DIR"
else
  git --git-dir="$MIRROR_DIR" rev-parse --is-bare-repository 2>/dev/null | grep -qx true \
    || fail "$MIRROR_DIR exists but is not a valid bare Git repository"

  CURRENT_ORIGIN="$(git --git-dir="$MIRROR_DIR" remote get-url origin 2>/dev/null || true)"
  if [ "$CURRENT_ORIGIN" != "$REPO_URL" ]; then
    log "Repairing mirror origin: ${CURRENT_ORIGIN:-<missing>} -> $REPO_URL"
    if [ -n "$CURRENT_ORIGIN" ]; then
      git --git-dir="$MIRROR_DIR" remote set-url origin "$REPO_URL"
    else
      git --git-dir="$MIRROR_DIR" remote add origin "$REPO_URL"
    fi
  fi
fi

VERIFIED_ORIGIN="$(git --git-dir="$MIRROR_DIR" remote get-url origin 2>/dev/null || true)"
[ "$VERIFIED_ORIGIN" = "$REPO_URL" ] \
  || fail "mirror origin verification failed: expected $REPO_URL, got ${VERIFIED_ORIGIN:-<missing>}"

log "Fetching latest $DEPLOY_BRANCH from $VERIFIED_ORIGIN"
git --git-dir="$MIRROR_DIR" fetch --prune origin
COMMIT="$(git --git-dir="$MIRROR_DIR" rev-parse "refs/heads/$DEPLOY_BRANCH")"
log "Deploying $DEPLOY_BRANCH @ $COMMIT"

# ---------------------------------------------------------------- build
log "Checking out release into $NEW_RELEASE"
mkdir -p "$NEW_RELEASE"
git --git-dir="$MIRROR_DIR" --work-tree="$NEW_RELEASE" checkout -f "$DEPLOY_BRANCH" -- .

cd "$NEW_RELEASE"
log "Installing dependencies (npm ci)"
npm ci --no-audit --no-fund

log "Building production bundle"
npm run build

# Apply additive, versioned migrations before activating the new release. Each
# file is transactional and checksum-protected; a failure leaves the currently
# active application untouched.
log "Applying database migrations"
set -a
# shellcheck disable=SC1090
. "$SHARED_ENV"
set +a
npm run db:migrate

# ---------------------------------------------------------------- validate
[ -f dist/index.js ] || fail "build validation failed: dist/index.js missing"
[ -f dist/public/index.html ] || fail "build validation failed: dist/public/index.html missing"
JS_COUNT="$(find dist/public/assets -name '*.js' | wc -l)"
[ "$JS_COUNT" -gt 0 ] || fail "build validation failed: no JS assets emitted"

# Publish an immutable-by-content release identity into the built site. Health checks
# request it with a cache-busting query string and compare it to the exact Git commit.
printf '%s\n' "$COMMIT" > "$NEW_RELEASE/dist/public/release.txt"

log "Scanning built bundle for internal content and secret patterns"
if grep -rqE 'internal/(pricing-tiers|sales-process|security-stack|usp-worksheet)' dist/public/assets/; then
  fail "bundle contains internal page routes — refusing to deploy"
fi
if grep -rqE 'sk_live_[A-Za-z0-9]|whsec_[A-Za-z0-9]|jca_[A-Za-z0-9]{20}|client_secret["'"'"']?\s*[:=]\s*["'"'"'][a-f0-9]{30}' dist/public/assets/; then
  fail "bundle appears to contain credentials — refusing to deploy"
fi

# link the shared env into the release for tooling that expects a local .env
ln -sfn "$SHARED_ENV" "$NEW_RELEASE/.env"

# ---------------------------------------------------------------- switch
PREVIOUS_RELEASE=""
PREVIOUS_COMMIT=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK")"
  if [ -f "$PREVIOUS_RELEASE/dist/public/release.txt" ]; then
    PREVIOUS_COMMIT="$(tr -d '\r\n' < "$PREVIOUS_RELEASE/dist/public/release.txt")"
  fi
fi

log "Activating release $TS"
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"

restart_app() {
  if [ "$NO_SYSTEMD" = "1" ]; then
    # Test mode only: run the server directly, fully detached (setsid) so the
    # deploy script never blocks waiting on it.
    pkill -f "node $CURRENT_LINK/dist/index.js" 2>/dev/null || true
    sleep 1
    (cd "$CURRENT_LINK" && set -a && . "$SHARED_ENV" && set +a \
      && NODE_ENV=production PORT="$APP_PORT" setsid nohup node "$CURRENT_LINK/dist/index.js" \
         >> "$LOG_DIR/app.log" 2>&1 < /dev/null &) &
    wait $! 2>/dev/null || true
    return 0
  fi

  # Least-privilege passwordless restart — failure is a failed deployment.
  if ! sudo -n "$SYSTEMCTL" restart "$SERVICE_NAME"; then
    log "ERROR: sudo -n $SYSTEMCTL restart $SERVICE_NAME failed"
    return 1
  fi
  # Note: sudoers allows exact `systemctl is-active $SERVICE` (no --quiet).
  # Using --quiet makes sudo deny the command and falsely looks "inactive".
  ACTIVE_STATE="$(sudo -n "$SYSTEMCTL" is-active "$SERVICE_NAME" 2>/dev/null || true)"
  if [ "$ACTIVE_STATE" != "active" ]; then
    log "ERROR: $SERVICE_NAME is not active after restart (state=${ACTIVE_STATE:-unknown})"
    return 1
  fi
  log "systemd: $SERVICE_NAME is active"
  return 0
}

release_matches() {
  local url="$1"
  local expected_sha="$2"
  local seen_sha

  # An empty expected SHA is allowed only for rollback to a release created before
  # commit markers existed. New deployments always pass COMMIT and are strict.
  [ -z "$expected_sha" ] && return 0

  seen_sha="$(curl -fsS -m 5 "${url}?sha=${expected_sha}&ts=${TS}" 2>/dev/null | tr -d '\r\n' || true)"
  [ "$seen_sha" = "$expected_sha" ]
}

local_health_check() {
  local expected_sha="${1:-}"
  local tries=15
  for i in $(seq 1 "$tries"); do
    if curl -sf -o /dev/null -m 5 "http://127.0.0.1:$APP_PORT/healthz" \
       && [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$APP_PORT/")" = "200" ] \
       && release_matches "http://127.0.0.1:$APP_PORT/release.txt" "$expected_sha"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

public_health_check() {
  local expected_sha="${1:-}"
  # Skip when NO_SYSTEMD or PUBLIC_HEALTH_URL explicitly emptied.
  [ "$NO_SYSTEMD" = "1" ] && return 0
  [ -z "${PUBLIC_HEALTH_URL:-}" ] && return 0

  local public_base="${PUBLIC_HEALTH_URL%/healthz}"
  local tries=10
  for i in $(seq 1 "$tries"); do
    if curl -fsS -m 10 "${PUBLIC_HEALTH_URL}?sha=${expected_sha}&ts=${TS}" >/dev/null \
       && release_matches "${public_base}/release.txt" "$expected_sha"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

health_check() {
  local expected_sha="${1:-}"
  local_health_check "$expected_sha" || return 1
  public_health_check "$expected_sha" || return 1
  return 0
}

restart_app || fail "service restart failed — deployment aborted (no silent continue)"
log "Waiting for health check and exact release verification on 127.0.0.1:$APP_PORT (and public HTTPS if configured)"
if health_check "$COMMIT"; then
  log "Health check passed; verified live release SHA $COMMIT"
else
  log "Health/release verification FAILED — rolling back"
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
    if [ -z "$PREVIOUS_COMMIT" ]; then
      log "WARN: previous release predates release markers; rollback will verify service health but cannot verify its commit SHA"
    fi
    if restart_app && health_check "$PREVIOUS_COMMIT"; then
      if [ -n "$PREVIOUS_COMMIT" ]; then
        log "Rollback to $(basename "$PREVIOUS_RELEASE") @ $PREVIOUS_COMMIT succeeded"
      else
        log "Rollback to $(basename "$PREVIOUS_RELEASE") succeeded"
      fi
    else
      log "Rollback restart/health ALSO failing — manual intervention required"
    fi
  else
    log "No previous release available to roll back to"
  fi
  exit 1
fi

# ---------------------------------------------------------------- cleanup
log "Pruning old releases (keeping $KEEP_RELEASES + current)"
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  [ "$(readlink -f "$old")" = "$(readlink -f "$CURRENT_LINK")" ] && continue
  log "Removing old release $old"
  rm -rf "$old"
done

log "Deploy complete: $DEPLOY_BRANCH @ $COMMIT is verified live on 127.0.0.1:$APP_PORT and public HTTPS"
