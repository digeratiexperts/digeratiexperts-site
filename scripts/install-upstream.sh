#!/usr/bin/env bash
# Fetch the external MSP / MSSP skill kits this kit builds on, into a gitignored
# vendor directory, and optionally link the skill folders into ~/.claude/skills.
#
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --list
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh                 # clone or update every kit
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --only rtfm,cmmc
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --link          # also symlink skills into ~/.claude/skills
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --dry-run
#   bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --uninstall     # remove the links (keeps the clones)
#
# Options
#   --dest <dir>     vendor directory (default: artifacts/msp-ai-kit/vendor, gitignored)
#   --only a,b       limit to these kit ids (rtfm, servosity, wyre, cmmc)
#   --link           symlink Claude Code skill folders into ~/.claude/skills (never overwrites existing entries)
#   --uninstall      remove links this script created
#   --dry-run        print what would happen
#   --depth <n>      git clone depth (default 1)
#
# Nothing here runs remote install scripts. Servosity and WYRE publish curl|bash
# and /plugin marketplace installers; this script only clones the repositories and
# prints those commands so you can read them before running anything. Credentials
# for PSA / RMM / M365 connectors are never read or written by this script.
set -Eeuo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../../.." && pwd)"
DEST="$REPO_ROOT/artifacts/msp-ai-kit/vendor"
ONLY=""; LINK=0; UNINSTALL=0; DRY=0; LIST=0; DEPTH=1
SKILLS_HOME="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

# id | repo url | license | default branch | skill folders to link (colon separated globs, relative to clone) | note
KITS=(
  "rtfm|https://github.com/RTFM-IT-Services-LLC/msp-claude-skills|CC BY-NC-SA 4.0|main|skills/*|16 MSP operations skills (setup, brand, pricing, legal, sales, marketing, onboarding, helpdesk, QBR, security). Non-commercial share-alike: use it to run your own MSP, do not resell or copy its text into this MIT repository."
  "servosity|https://github.com/Servosity/msp-skills|Apache-2.0|main||67 MCP connectors for PSA, RMM, backup, security, M365 with a local SQLite mirror. Install per connector with its documented install.sh / install.ps1 after reading it; credentials come from environment variables at run time."
  "wyre|https://github.com/wyre-technology/msp-claude-plugins|Apache-2.0|main||83+ Claude plugins for PSA, RMM, documentation, security and accounting vendors. Install through Claude Code: /plugin marketplace add wyre-technology/msp-claude-plugins, then /plugin install <name>@msp-claude-plugins."
  "cmmc|https://github.com/LV-262/cmmc-advisor|MIT|main|.|CMMC 2.0 advisor skill (levels 1 to 3, 14 domains, 110 practices) mapped to real IT stacks. Pairs with the compliance-mapping module."
)

usage() { sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2;;
    --only) ONLY="$2"; shift 2;;
    --link) LINK=1; shift;;
    --uninstall) UNINSTALL=1; shift;;
    --dry-run) DRY=1; shift;;
    --list) LIST=1; shift;;
    --depth) DEPTH="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2;;
  esac
done

log() { printf '%s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then log "  [dry-run] $*"; else "$@"; fi; }
wanted() { [ -z "$ONLY" ] || [[ ",$ONLY," == *",$1,"* ]]; }
field() { printf '%s' "$1" | cut -d'|' -f"$2"; }

if [ "$LIST" = 1 ]; then
  log "Upstream kits (vendor dir: $DEST)"
  for k in "${KITS[@]}"; do
    id=$(field "$k" 1); url=$(field "$k" 2); lic=$(field "$k" 3); note=$(field "$k" 6)
    state="not cloned"; [ -d "$DEST/$id/.git" ] && state="cloned $(git -C "$DEST/$id" rev-parse --short HEAD 2>/dev/null || echo '?')"
    printf '  %-10s %-16s %s\n             %s\n             %s\n' "$id" "$lic" "$url" "$state" "$note"
  done
  exit 0
fi

command -v git >/dev/null || { echo "git is required" >&2; exit 2; }
run mkdir -p "$DEST"

for k in "${KITS[@]}"; do
  id=$(field "$k" 1); url=$(field "$k" 2); lic=$(field "$k" 3); branch=$(field "$k" 4); links=$(field "$k" 5); note=$(field "$k" 6)
  wanted "$id" || continue
  target="$DEST/$id"

  if [ "$UNINSTALL" = 1 ]; then
    [ -n "$links" ] || continue
    for l in "$SKILLS_HOME"/*; do
      [ -L "$l" ] || continue
      case "$(readlink "$l")" in "$target"*) run rm "$l"; log "unlinked $l";; esac
    done
    continue
  fi

  log "== $id ($lic)"
  if [ -d "$target/.git" ]; then
    run git -C "$target" fetch --depth "$DEPTH" origin "$branch"
    run git -C "$target" reset --hard "origin/$branch" --quiet
    log "  updated  $target"
  else
    run git clone --depth "$DEPTH" --branch "$branch" --quiet "$url" "$target"
    log "  cloned   $target"
  fi
  log "  $note"
  if [ "$DRY" = 0 ] && [ -d "$target" ]; then
    lic_file=$(find "$target" -maxdepth 1 -iname 'LICENSE*' | head -1 || true)
    [ -n "$lic_file" ] && log "  license file: $lic_file"
  fi

  if [ "$LINK" = 1 ] && [ -n "$links" ]; then
    run mkdir -p "$SKILLS_HOME"
    IFS=':' read -r -a globs <<< "$links"
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

Done. Cloned kits live under $DEST (gitignored). Read each kit's README and LICENSE before use.
- rtfm:      run its msp-setup skill once to fill in identity and pricing; keep its text out of this repository.
- servosity: per connector, read skills/<name>/install.sh (or .ps1) and run it yourself; export the connector's API credentials as environment variables first.
- wyre:      in Claude Code run /plugin marketplace add wyre-technology/msp-claude-plugins then /plugin install <plugin>@msp-claude-plugins.
- cmmc:      with --link it is available as /cmmc-advisor in every project.
The DE prompt packs themselves come from build.mjs, not from these kits.
EOF
