#!/usr/bin/env bash
# Deletes the remote branches listed in 2026-10-08-merged-branches.tsv.
# Every one was checked on 2026-10-08 against main ac45aadf: its work is
# already on main. A branch that is already gone, or whose tip moved since
# that check, is skipped; every delete is also leased to the recorded SHA.
# Safe to run more than once. To restore one:
#   git push origin <sha>:refs/heads/<branch>
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
list=artifacts/branch-cleanup/2026-10-08-merged-branches.tsv
declare -A remote
while read -r sha ref; do remote["${ref#refs/heads/}"]=$sha; done < <(git ls-remote --heads origin)
args=(); skipped=0; failed=0
flush() {
  (( ${#args[@]} )) || return 0
  git push origin "${args[@]}" || failed=1
  args=()
}
while IFS=$'\t' read -r branch sha; do
  current=${remote[$branch]:-}
  if [[ -z $current ]]; then continue; fi
  if [[ $current != "$sha" ]]; then echo "skip (changed since the check): $branch"; skipped=$((skipped+1)); continue; fi
  args+=("--force-with-lease=refs/heads/$branch:$sha" ":refs/heads/$branch")
  if (( ${#args[@]} >= 100 )); then flush; fi
done < "$list"
flush
echo "Done. Skipped $skipped changed branch(es)."
(( failed == 0 )) || echo "Some pushes were refused; run the script again."
