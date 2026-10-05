import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const deployScript = resolve(root, "deploy/vps/deploy.sh");
const runnerScript = resolve(root, "scripts/setup-github-runner.sh");

function bashAvailable(): boolean {
  try {
    execFileSync("bash", ["--version"], { stdio: "pipe", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

describe("production deployment scripts", () => {
  it.skipIf(!bashAvailable())("remain valid bash", () => {
    expect(() => execFileSync("bash", ["-n", deployScript], { stdio: "pipe" })).not.toThrow();
    expect(() => execFileSync("bash", ["-n", runnerScript], { stdio: "pipe" })).not.toThrow();
    expect(() => execFileSync("bash", ["-n", resolve(root, "deploy/vps/resolve-deploy-commit.sh")], { stdio: "pipe" })).not.toThrow();
  });

  it("pins production to the canonical digeratiexperts-site repository", () => {
    const deploy = readFileSync(deployScript, "utf8");
    const runner = readFileSync(runnerScript, "utf8");

    expect(deploy).toContain(
      'REPO_URL="${REPO_URL:-https://github.com/digeratiexperts/digeratiexperts-site.git}"',
    );
    expect(deploy).toContain('remote set-url origin "$REPO_URL"');
    expect(deploy).not.toContain(
      'REPO_URL="${REPO_URL:-https://github.com/digeratiexperts/Replit-Site.git}"',
    );

    expect(runner).toContain('CANONICAL_GIT_URL="${CANONICAL_GIT_URL:-${REPO_URL}.git}"');
    expect(runner).toContain('production mirror verified: $VERIFIED_ORIGIN');
  });
});
