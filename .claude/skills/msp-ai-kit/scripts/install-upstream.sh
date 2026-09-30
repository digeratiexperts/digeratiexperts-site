#!/usr/bin/env bash
# Fetch the external MSP / MSSP skill kits this kit builds on, pinned to the
# commits in ../upstream.lock, into a gitignored vendor directory. Optionally
# link the skill folders into ~/.claude/skills.
#
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --list
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh                 # clone or update every kit at its pinned commit
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --only rtfm,cmmc
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --link          # also symlink skills into ~/.claude/skills
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --latest        # ignore the pins, take each default branch head
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --update-pins   # rewrite upstream.lock with the current heads
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --dry-run
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --uninstall     # remove the links (keeps the clones)
#
# Options
#   --dest <dir>     vendor directory (default: artifacts/msp-ai-kit/vendor, gitignored)
#   --only a,b       limit to these kit ids
#   --link           symlink Claude Code skill folders into ~/.claude/skills (never overwrites existing entries)
#   --latest         fetch the default branch head instead of the pinned commit
#   --update-pins    look up each default branch head and rewrite upstream.lock (no clone)
#   --uninstall      remove links this script created
#   --dry-run        print what would happen
#
# Nothing here runs remote install scripts. Servosity and WYRE publish curl|bash
# and /plugin marketplace installers; this script only clones the repositories at
# a known commit, copies each LICENSE into vendor/LICENSES/, and prints those
# commands so you can read them before running anything. Credentials for
# PSA / RMM / M365 connectors are never read or written by this script.
set -Eeuo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$HERE/.." && pwd)"
REPO_ROOT="$(cd "$KIT_ROOT/../../.." && pwd)"
LOCK="$KIT_ROOT/upstream.lock"
DEST="$REPO_ROOT/artifacts/msp-ai-kit/vendor"
ONLY=""; LINK=0; UNINSTALL=0; DRY=0; LIST=0; LATEST=0; UPDATE_PINS=0
SKILLS_HOME="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

usage() { sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2;;
    --only) ONLY="$2"; shift 2;;
    --link) LINK=1; shift;;
    --latest) LATEST=1; shift;;
    --update-pins) UPDATE_PINS=1; shift;;
    --uninstall) UNINSTALL=1; shift;;
    --dry-run) DRY=1; shift;;
    --list) LIST=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2;;
  esac
done

log() { printf '%s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then log "  [dry-run] $*"; else "$@"; fi; }
wanted() { [ -z "$ONLY" ] || [[ ",$ONLY," == *",$1,"* ]]; }

[ -f "$LOCK" ] || { echo "missing $LOCK" >&2; exit 2; }
# read the lock into parallel arrays (skip comments and blanks)
IDS=(); URLS=(); SHAS=(); LICS=(); LINKS=(); NOTES=()
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// /}" ]] && continue
  read -r id url sha lic links <<< "$(printf '%s' "$line" | tr -s ' \t' ' ')"
  IDS+=("$id"); URLS+=("$url"); SHAS+=("$sha"); LICS+=("$lic"); LINKS+=("$links")
done < "$LOCK"

note_for() {
  case "$1" in
    rtfm) echo "16 MSP operations skills (setup, brand, pricing, legal, sales, marketing, onboarding, helpdesk, QBR, security). Non-commercial share-alike: use it to run your own MSP, do not resell or copy its text into this MIT repository.";;
    servosity) echo "67 MCP connectors for PSA, RMM, backup, security, M365 with a local SQLite mirror. Install per connector with its documented install.sh / install.ps1 after reading it; credentials come from environment variables at run time.";;
    wyre) echo "83+ Claude plugins for PSA, RMM, documentation, security and accounting vendors. Install through Claude Code: /plugin marketplace add wyre-technology/msp-claude-plugins, then /plugin install <name>@msp-claude-plugins.";;
    cmmc) echo "CMMC 2.0 advisor skill (levels 1 to 3, 14 domains, 110 practices) mapped to real IT stacks. Pairs with the compliance-mapping module.";;
    *) echo "";;
  esac
}

if [ "$LIST" = 1 ]; then
  log "Upstream kits (vendor dir: $DEST, lock: $LOCK)"
  for i in "${!IDS[@]}"; do
    id="${IDS[$i]}"; state="not cloned"
    [ -d "$DEST/$id/.git" ] && state="cloned $(git -C "$DEST/$id" rev-parse --short HEAD 2>/dev/null || echo '?')"
    printf '  %-10s %-16s %s\n             pinned %s | %s\n             %s\n' "$id" "${LICS[$i]}" "${URLS[$i]}" "${SHAS[$i]:0:12}" "$state" "$(note_for "$id")"
  done
  exit 0
fi

command -v git >/dev/null || { echo "git is required" >&2; exit 2; }

if [ "$UPDATE_PINS" = 1 ]; then
  tmp="$(mktemp)"
  { grep -E '^\s*#' "$LOCK" || true; } > "$tmp"
  for i in "${!IDS[@]}"; do
    head_sha="$(git ls-remote "${URLS[$i]}" HEAD | cut -f1)"
    [ -n "$head_sha" ] || { echo "could not resolve ${URLS[$i]}" >&2; rm -f "$tmp"; exit 1; }
    printf '%-10s %-60s %s  %-16s %s\n' "${IDS[$i]}" "${URLS[$i]}" "$head_sha" "${LICS[$i]}" "${LINKS[$i]}" >> "$tmp"
    log "${IDS[$i]}: ${SHAS[$i]:0:12} -> ${head_sha:0:12}"
  done
  if [ "$DRY" = 1 ]; then log "[dry-run] would rewrite $LOCK"; rm -f "$tmp"; else mv "$tmp" "$LOCK"; log "rewrote $LOCK"; fi
  exit 0
fi

run mkdir -p "$DEST" "$DEST/LICENSES"

for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; url="${URLS[$i]}"; sha="${SHAS[$i]}"; lic="${LICS[$i]}"; links="${LINKS[$i]}"
  wanted "$id" || continue
  target="$DEST/$id"

  if [ "$UNINSTALL" = 1 ]; then
    [ "$links" != "-" ] || continue
    for l in "$SKILLS_HOME"/*; do
      [ -L "$l" ] || continue
      case "$(readlink "$l")" in "$target"*) run rm "$l"; log "unlinked $l";; esac
    done
    continue
  fi

  log "== $id ($lic)"
  if [ ! -d "$target/.git" ]; then
    run git init --quiet "$target"
    run git -C "$target" remote add origin "$url"
    log "  initialised $target"
  fi
  if [ "$LATEST" = 1 ]; then
    run git -C "$target" fetch --depth 1 --quiet origin HEAD
  else
    run git -C "$target" fetch --depth 1 --quiet origin "$sha"
  fi
  run git -C "$target" checkout --quiet --force FETCH_HEAD
  if [ "$DRY" = 0 ]; then
    now="$(git -C "$target" rev-parse HEAD)"
    if [ "$LATEST" = 0 ] && [ "$now" != "$sha" ]; then echo "  pin mismatch for $id: wanted $sha got $now" >&2; exit 1; fi
    log "  checked out ${now:0:12}"
    lic_file="$(find "$target" -maxdepth 1 -iname 'LICENSE*' | head -1 || true)"
    if [ -n "$lic_file" ]; then cp "$lic_file" "$DEST/LICENSES/$id-LICENSE.txt"; log "  license copied to $DEST/LICENSES/$id-LICENSE.txt"; else log "  no LICENSE file at the repository root; license per lock: $lic"; fi
  fi
  log "  $(note_for "$id")"

  if [ "$LINK" = 1 ] && [ "$links" != "-" ]; then
    run mkdir -p "$SKILLS_HOME"
    IFS=':' read -r -a globs <<< "$links"; IFS=$'\n\t'
    for g in "${globs[@]}"; do
      for d in "$target"/$g; do
        [ -f "$d/SKILL.md" ] || continue
        name="$(basename "$(cd "$d" && pwd)")"; [ "$g" = "." ] && name="$id-advisor"
        dest="$SKILLS_HOME/$name"
        if [ -e "$dest" ] || [ -L "$dest" ]; then log "  kept     $dest (exists)"; continue; fi
        run ln -s "$(cd "$d" && pwd)" "$dest"; log "  linked   $dest"
      done
    done
  fi
done

[ "$UNINSTALL" = 1 ] && exit 0
cat <<EOF

Done. Cloned kits live under $DEST (gitignored), pinned by $LOCK; licenses in $DEST/LICENSES.
- rtfm:      run its msp-setup skill once to fill in identity and pricing; keep its text out of this repository.
- servosity: per connector, read skills/<name>/install.sh (or .ps1) and run it yourself; export the connector's API credentials as environment variables first.
- wyre:      in Claude Code run /plugin marketplace add wyre-technology/msp-claude-plugins then /plugin install <plugin>@msp-claude-plugins.
- cmmc:      with --link it is available as /cmmc-advisor in every project.
The DE prompt packs themselves come from build.mjs, not from these kits.
EOF
