# Digerati Experts GitHub Runner Fleet

## Why runners are repo-scoped

The DE repositories are currently owned by the `digeratiexperts` GitHub **user account**. A self-hosted runner registered to one repository is not automatically available to the other repositories. The RackNerd runner originally registered for `vulnerability-management` therefore cannot satisfy a `digeratiexperts-site` job.

One physical Linux host may run multiple isolated runner services. Each service gets its own install directory, repository registration, name, labels, work directory, and systemd service.

## Canonical roles

| Repository | Role label | Intended host | Purpose |
| --- | --- | --- | --- |
| `digeratiexperts/digeratiexperts-site` | `website-prod` + `de-production` | canonical website VPS | production website deploy only |
| `digeratiexperts/Intelligence-Hub` | `hub-prod` + `de-production` | Intelligence Hub VPS | future explicit Hub deployment/ops jobs |
| `digeratiexperts/vulnerability-management` | `security-runner` | RackNerd/Wazuh security VPS | Wazuh/security/local diagnostics |
| development repos | `de-dev` | Zorin laptop or other workstation | optional development/heavy test jobs |

Do not use only `[self-hosted, Linux, X64]` for privileged production jobs. Role labels prevent a laptop or unrelated VPS from accepting a production deployment.

## Website production runner

Run on the canonical website VPS. The recommended runner account is `diger7051`, because the production release script is already designed to run as that site user.

```bash
cd /home/digeratiexperts.com/current
chmod +x scripts/setup-github-runner.sh

# Option A: gh is authenticated with repository-admin permission
sudo -E RUNNER_USER=diger7051 ./scripts/setup-github-runner.sh

# Option B: use the short-lived token from:
# GitHub > digeratiexperts-site > Settings > Actions > Runners > New self-hosted runner
sudo -E RUNNER_TOKEN='SHORT_LIVED_TOKEN' RUNNER_USER=diger7051 ./scripts/setup-github-runner.sh
```

Expected labels:

```text
self-hosted
Linux
X64
de-production
website-prod
```

The bootstrap installs the runner as a systemd service so it returns after reboot without an open terminal.

## Multiple runners on one host

Use a different `RUNNER_ROLE`, labels, and directory for each repo registration. Never reuse one runner directory for multiple repositories.

Example pattern:

```bash
REPO=digeratiexperts/example \
RUNNER_ROLE=de-dev \
RUNNER_LABELS=de-dev,zorin \
RUNNER_USER="$USER" \
RUNNER_ROOT="$HOME/.local/github-runners" \
RUNNER_TOKEN='SHORT_LIVED_TOKEN' \
./scripts/setup-github-runner.sh
```

## CI on a development runner (cost switch)

The `check-test-build` job in `ci.yml` reads its runner from the repository variable `SITE_CI_RUNS_ON`. The production deploy job is unaffected; it keeps its `de-production` / `website-prod` labels.

- **Not set** (default): GitHub-hosted `ubuntu-latest`, as before.
- **Set** to a JSON label list, for example `["self-hosted","Linux","X64","de-dev"]`: the job runs on a `de-dev` runner registered to this repository (home PC in WSL2 or Linux, or a RackNerd host), and those minutes are free.
- Set or delete it under Settings → Secrets and variables → Actions → Variables. A self-hosted job never falls back to GitHub; delete the variable when that machine is off.

The why, the costs and the home PC setup are in Intelligence-Hub `docs/CI-RUNNERS-AND-COSTS.md` (2026-10-27). The Hub has the same switch, `HUB_CI_RUNS_ON`.

## Security rules

1. Production deployment runners are not general-purpose development runners.
2. Public pull-request validation stays on GitHub-hosted runners.
3. Self-hosted production jobs must be restricted to trusted push/dispatch events and exact role labels.
4. Runner registration tokens are short-lived and must never be committed.
5. Do not grant a runner `NOPASSWD: ALL`.
6. Do not place production secrets in repository files or runner workspaces.
7. Each production job must still verify the expected host filesystem/service before making changes.

## Recovery checklist

If a job remains `queued`:

1. Confirm its requested labels match a registered runner for **that repository**.
2. On the runner host, check the runner service:

```bash
systemctl list-units 'actions.runner.*' --all
systemctl status 'actions.runner.*' --no-pager
```

3. In GitHub: **Settings > Actions > Runners** and confirm the runner is `Idle` or `Active`, not `Offline`.
4. If absent/offline, rerun `scripts/setup-github-runner.sh` with a fresh registration token.
5. Do not weaken `runs-on` labels just to make a queued production deployment execute on an unrelated machine.
