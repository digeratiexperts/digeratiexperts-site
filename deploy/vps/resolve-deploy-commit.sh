#!/usr/bin/env bash
# Prints the exact commit deploy.sh should build (#391).
#
#   resolve-deploy-commit.sh <bare-mirror> <branch> [expected-sha]
#
# Without an expected SHA (manual deploys) it prints the branch head, as before.
# With one (the CI deploy job passes the SHA its checks passed on), it prints
# that SHA and nothing else: it must be a full 40-character commit present in
# the mirror and already on the branch. If the branch has since advanced, the
# tested commit is still the one deployed; the newer commit deploys from its
# own CI run, which the production concurrency group queues behind this one.
set -euo pipefail

mirror="${1:?usage: resolve-deploy-commit.sh <bare-mirror> <branch> [expected-sha]}"
branch="${2:?usage: resolve-deploy-commit.sh <bare-mirror> <branch> [expected-sha]}"
expected="${3:-}"

fail() {
  echo "resolve-deploy-commit: $*" >&2
  exit 1
}

head="$(git --git-dir="$mirror" rev-parse --verify --quiet "refs/heads/$branch^{commit}")" \
  || fail "branch $branch not found in $mirror"

if [ -z "$expected" ]; then
  echo "$head"
  exit 0
fi

[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || fail "expected commit must be a full 40-character lowercase SHA, got '$expected'"
git --git-dir="$mirror" cat-file -e "$expected^{commit}" 2>/dev/null \
  || fail "expected commit $expected is not in the mirror"
git --git-dir="$mirror" merge-base --is-ancestor "$expected" "$head" \
  || fail "expected commit $expected is not on $branch (head $head); refusing to deploy it"

if [ "$expected" != "$head" ]; then
  echo "resolve-deploy-commit: $branch advanced to $head after CI; deploying the tested $expected. The newer commit deploys from its own CI run." >&2
fi
echo "$expected"
