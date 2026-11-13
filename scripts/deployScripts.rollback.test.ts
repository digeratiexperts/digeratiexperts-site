import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const deploy = readFileSync(resolve("deploy/vps/deploy.sh"), "utf8");
const start = deploy.indexOf("# ---------------------------------------------------------------- switch");
const end = deploy.indexOf("# ---------------------------------------------------------------- cleanup");
if (start < 0 || end <= start) throw new Error("Deploy activation section not found");
// Execute the real activation/restart/health/rollback section. Earlier setup,
// env sourcing, builds, migrations and pruning never enter this test harness.
const activation = deploy.slice(start, end);

function bashAvailable(): boolean {
  try {
    execFileSync("bash", ["--version"], { stdio: "pipe", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

type Scenario = "success" | "restart_failure" | "inactive" | "health_failure"
  | "public_health_failure" | "release_mismatch" | "rollback_restart_failure"
  | "rollback_health_failure" | "no_previous";

const mocks = String.raw`set -euo pipefail
CURRENT_LINK="$FIXTURE_ROOT/current"
NEW_RELEASE="$FIXTURE_ROOT/new"
SYSTEMCTL=/usr/bin/systemctl
SERVICE_NAME=synthetic-deploy-test
NO_SYSTEMD=0
APP_PORT=3300
PUBLIC_HEALTH_URL=https://synthetic.invalid/healthz
TS=synthetic
COMMIT=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
log() { printf '%s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }
# These functions shadow every service/network call. Never invoke the real sudo
# or curl, including on an unexpected argument. All filesystem paths are fixtures.
sudo() {
  [ "$#" = 4 ] && [ "$1" = -n ] && [ "$2" = /usr/bin/systemctl ] && [ "$4" = "$SERVICE_NAME" ] || return 98
  local target
  target="$(basename "$(readlink -f "$CURRENT_LINK")")"
  printf '%s:%s\n' "$3" "$target" >> "$FIXTURE_ROOT/commands"
  case "$3" in
    restart)
      local n=0
      [ ! -f "$FIXTURE_ROOT/restarts" ] || n=$(cat "$FIXTURE_ROOT/restarts")
      n=$((n+1)); printf '%s' "$n" > "$FIXTURE_ROOT/restarts"
      [ "$SCENARIO" != rollback_restart_failure ] || return 1
      if [ "$n" = 1 ]; then
        case "$SCENARIO" in restart_failure|rollback_health_failure|no_previous) return 1 ;; esac
      fi
      return 0 ;;
    is-active)
      if [ "$SCENARIO" = inactive ] && [ "$(cat "$FIXTURE_ROOT/restarts")" = 1 ]; then
        printf 'inactive\n'; return 3
      fi
      printf 'active\n'; return 0 ;;
    *) return 98 ;;
  esac
}
curl() {
  local target arg
  target="$(basename "$(readlink -f "$CURRENT_LINK")")"
  printf 'curl:%s\n' "$target" >> "$FIXTURE_ROOT/commands"
  if [ "$SCENARIO" = health_failure ] && [ "$target" = new ]; then return 1; fi
  if [ "$SCENARIO" = rollback_health_failure ] && [ "$target" = old ]; then return 1; fi
  for arg in "$@"; do
    if [ "$SCENARIO" = public_health_failure ] && [ "$target" = new ]; then
      case "$arg" in https://*) return 1 ;; esac
    fi
    case "$arg" in
      *release.txt*)
        if [ "$SCENARIO" = release_mismatch ] && [ "$target" = new ]; then
          printf 'cccccccccccccccccccccccccccccccccccccccc\n'
        else cat "$CURRENT_LINK/dist/public/release.txt"; fi
        return 0 ;;
      '%{http_code}') printf '200'; return 0 ;;
    esac
  done
  return 0
}
sleep() { :; }
`;

function runActivation(scenario: Scenario, previousMarker = true) {
  const home = mkdtempSync(join(tmpdir(), "de-deploy-rollback-"));
  try {
    for (const [name, sha] of [["old", "a".repeat(40)], ["new", "b".repeat(40)]]) {
      const publicDir = join(home, name, "dist/public");
      mkdirSync(publicDir, { recursive: true });
      if (name !== "old" || previousMarker) writeFileSync(join(publicDir, "release.txt"), `${sha}\n`);
    }
    if (scenario !== "no_previous") symlinkSync(join(home, "old"), join(home, "current"), "dir");
    const script = join(home, "activation.sh");
    writeFileSync(script, `${mocks}\n${activation}`);
    const out = spawnSync("bash", [script], {
      encoding: "utf8", timeout: 5000, windowsHide: true,
      // No configured environment, DATABASE_URL, credentials or BASH_ENV.
      env: { PATH: process.env.PATH, FIXTURE_ROOT: home, SCENARIO: scenario },
    });
    if (out.error) throw out.error;
    return {
      status: out.status, signal: out.signal,
      output: `${out.stdout}${out.stderr}`,
      current: realpathSync(join(home, "current")) === join(home, "old") ? "old" : "new",
      commands: existsSync(join(home, "commands")) ? readFileSync(join(home, "commands"), "utf8").trim().split("\n") : [],
    };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe.skipIf(!bashAvailable())("deploy activation recovery with mocked service and HTTP", () => {
  it("keeps a healthy exact release active", () => {
    const r = runActivation("success");
    expect([r.status, r.signal, r.current]).toEqual([0, null, "new"]);
    expect(r.commands.filter(c => c.startsWith("restart:"))).toEqual(["restart:new"]);
    expect(r.output).toContain("Health check passed; verified live release SHA");
  });

  it.each(["restart_failure", "inactive"] as const)("restores and restarts the prior release after %s", scenario => {
    const r = runActivation(scenario);
    expect([r.status, r.signal, r.current]).toEqual([1, null, "old"]);
    expect(r.commands.filter(c => c.startsWith("restart:"))).toEqual(["restart:new", "restart:old"]);
    expect(r.commands).not.toContain("curl:new");
    expect(r.output).toContain("Rollback to old @");
    expect(r.output).toContain("succeeded");
  });

  it.each(["health_failure", "public_health_failure", "release_mismatch"] as const)("preserves rollback after %s", scenario => {
    const r = runActivation(scenario);
    expect([r.status, r.signal, r.current]).toEqual([1, null, "old"]);
    expect(r.commands.filter(c => c.startsWith("restart:"))).toEqual(["restart:new", "restart:old"]);
    expect(r.commands).toContain("curl:old");
    expect(r.output).toContain("succeeded");
  });

  it.each(["rollback_restart_failure", "rollback_health_failure"] as const)("reports manual intervention after %s", scenario => {
    const r = runActivation(scenario);
    expect([r.status, r.signal, r.current]).toEqual([1, null, "old"]);
    expect(r.commands.filter(c => c.startsWith("restart:"))).toEqual(["restart:new", "restart:old"]);
    expect(r.output).toContain("Rollback restart/health ALSO failing — manual intervention required");
    expect(r.output).not.toContain("succeeded");
  });

  it("fails explicitly when there is no prior release", () => {
    const r = runActivation("no_previous");
    expect([r.status, r.signal, r.current]).toEqual([1, null, "new"]);
    expect(r.commands.filter(c => c.startsWith("restart:"))).toEqual(["restart:new"]);
    expect(r.output).toContain("No previous release available to roll back to");
    expect(r.output).not.toContain("succeeded");
  });

  it("preserves honest health-only recovery for a prior release without a marker", () => {
    const r = runActivation("health_failure", false);
    expect([r.status, r.signal, r.current]).toEqual([1, null, "old"]);
    expect(r.output).toContain("rollback will verify service health but cannot verify its commit SHA");
    expect(r.output).toContain("Rollback to old succeeded");
  });
});
