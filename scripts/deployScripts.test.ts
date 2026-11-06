import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

  it("loads the shared env before the build so public VITE_* keys reach the bundle", () => {
    const deploy = readFileSync(deployScript, "utf8");
    const lines = deploy.split("\n").map((line) => line.trim());
    const sourced = lines.indexOf('. "$SHARED_ENV"');
    const build = lines.indexOf("npm run build");
    expect(sourced).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    expect(sourced).toBeLessThan(build);
  });

  it("refuses a bundle holding the Turnstile secret and a missing site key", () => {
    const deploy = readFileSync(deployScript, "utf8").replace(/\r\n/g, "\n");
    expect(deploy).toMatch(/grep -rqF -e "\$TURNSTILE_SECRET_KEY" dist\/public\/assets\/; then\n\s*fail /);
    expect(deploy).toMatch(/! grep -rqF -e "\$VITE_TURNSTILE_SITE_KEY" dist\/public\/assets\//);
    expect(deploy).toContain("TURNSTILE_SECRET_KEY is set but VITE_TURNSTILE_SITE_KEY is not");
  });

  // Production fails closed without TURNSTILE_SECRET_KEY (server/middleware/security.ts),
  // so a release without both keys would lock clients out of the portal. The deploy
  // refuses in the preflight, before it fetches, builds or writes anything.
  describe.skipIf(!bashAvailable())("Turnstile key preflight", () => {
    function runDeploy(envFile: string) {
      const home = mkdtempSync(join(tmpdir(), "de-deploy-preflight-"));
      mkdirSync(join(home, "shared"));
      writeFileSync(join(home, "shared", ".env"), envFile);
      try {
        const out = spawnSync("bash", [deployScript, "staging"], {
          encoding: "utf8",
          env: { ...process.env, SITE_HOME: home, NO_SYSTEMD: "1", REPO_URL: join(home, "no-such-repo") },
          timeout: 30000,
        });
        return { status: out.status, output: `${out.stdout}${out.stderr}`, releasesCreated: existsSync(join(home, "releases")) };
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    }

    it("refuses when TURNSTILE_SECRET_KEY is missing, before creating anything", () => {
      const r = runDeploy("VITE_TURNSTILE_SITE_KEY=0xSITE\nTURNSTILE_SECRET_KEY=\n");
      expect(r.status).toBe(1);
      expect(r.output).toContain("TURNSTILE_SECRET_KEY is not set");
      expect(r.output).toContain("refusing to deploy");
      expect(r.releasesCreated).toBe(false);
    });

    it("refuses when neither key is set", () => {
      const r = runDeploy("NODE_ENV=production\n");
      expect(r.status).toBe(1);
      expect(r.output).toContain("TURNSTILE_SECRET_KEY is not set");
    });

    it("refuses a secret without the public site key", () => {
      const r = runDeploy("TURNSTILE_SECRET_KEY=secret-value\n");
      expect(r.status).toBe(1);
      expect(r.output).toContain("TURNSTILE_SECRET_KEY is set but VITE_TURNSTILE_SITE_KEY is not");
      expect(r.output).not.toContain("secret-value");
    });

    it("passes the preflight with both keys (and stops later, at the fake repository)", () => {
      const r = runDeploy('TURNSTILE_SECRET_KEY="secret-value"\nVITE_TURNSTILE_SITE_KEY=0xSITE\n');
      expect(r.output).not.toContain("refusing to deploy");
      expect(r.output).toContain("Cloning");
      expect(r.output).not.toContain("secret-value");
    });
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
