#!/usr/bin/env bash
# Deletes the remote branches listed in 2026-10-08-merged-branches.tsv.
# Every one was checked on 2026-10-08 against main ac45aadf: its work is
# already on main. Each delete is leased to the recorded SHA, so a branch
# that moved since then is left alone. To restore one:
#   git push origin <sha>:refs/heads/<branch>
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
list=artifacts/branch-cleanup/2026-10-08-merged-branches.tsv
args=()
while IFS=$'\t' read -r branch sha; do
  args+=("--force-with-lease=refs/heads/$branch:$sha" ":refs/heads/$branch")
  if (( ${#args[@]} >= 100 )); then git push origin "${args[@]}"; args=(); fi
done < "$list"
(( ${#args[@]} )) && git push origin "${args[@]}"
echo "Done."
