#!/usr/bin/env bash
# Make this repo's skills available in every project on this machine.
#
#   bash .claude/install-user-skills.sh            # symlink each skill into ~/.claude/skills and ~/.agents/skills
#   bash .claude/install-user-skills.sh --copy     # copy instead of symlink (survives deleting this clone)
#   bash .claude/install-user-skills.sh --uninstall
#
# ~/.claude/skills  is read by Claude Code in every project (user-level skills).
# ~/.agents/skills  is the agentskills convention read by Codex and other tools.
# Existing entries are left alone unless --force is given. Nothing here touches secrets:
# put KIE_AI_API_KEY in each project's .env or your shell profile separately.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/skills"
MODE="link"; FORCE=0; UNINSTALL=0
for a in "$@"; do case "$a" in --copy) MODE="copy";; --force) FORCE=1;; --uninstall) UNINSTALL=1;; *) echo "unknown flag $a"; exit 1;; esac; done
TARGETS=("$HOME/.claude/skills" "$HOME/.agents/skills")
for t in "${TARGETS[@]}"; do mkdir -p "$t"; done
for d in "$SRC"/*/; do
  n="$(basename "$d")"
  [ -f "$d/SKILL.md" ] || continue
  for t in "${TARGETS[@]}"; do
    dest="$t/$n"
    if [ "$UNINSTALL" = 1 ]; then
      if [ -L "$dest" ] || [ -d "$dest" ]; then rm -rf "$dest"; echo "removed  $dest"; fi
      continue
    fi
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      if [ "$FORCE" = 1 ]; then rm -rf "$dest"; else echo "kept     $dest (exists; use --force to replace)"; continue; fi
    fi
    if [ "$MODE" = "copy" ]; then cp -R "$d" "$dest"; echo "copied   $dest"; else ln -s "$d" "$dest"; echo "linked   $dest -> $d"; fi
  done
done
[ "$UNINSTALL" = 1 ] || echo "Done. Open any project and type /nano-banana-images (or any skill name) to confirm."
