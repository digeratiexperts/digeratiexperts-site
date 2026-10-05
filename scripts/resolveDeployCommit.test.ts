import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * #391: the CI deploy job must ship the commit its checks passed on, even when
 * main advances between the job's stale check and deploy.sh's fetch.
 */
const root = process.cwd();
const resolver = resolve(root, "deploy/vps/resolve-deploy-commit.sh");

function available(cmd: string): boolean {
  try {
    execFileSync(cmd, ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const canRun = available("bash") && available("git");

let dir: string;
let work: string;
let mirror: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  })
    .toString()
    .trim();
}

function commit(message: string): string {
  writeFileSync(join(work, "file.txt"), message);
  git(work, "add", "file.txt");
  git(work, "commit", "-q", "-m", message);
  return git(work, "rev-parse", "HEAD");
}

function fetchMirror() {
  git(mirror, "fetch", "-q", "--prune", "origin");
}

function runResolver(...args: string[]) {
  const out = spawnSync("bash", [resolver, mirror, "main", ...args], { encoding: "utf8" });
  return { status: out.status, stdout: out.stdout.trim(), stderr: out.stderr };
}

describe.skipIf(!canRun)("resolve-deploy-commit.sh (#391)", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "deploy-commit-"));
    work = join(dir, "work");
    mirror = join(dir, "mirror.git");
    execFileSync("git", ["init", "-q", "-b", "main", work]);
    commit("one");
    execFileSync("git", ["clone", "-q", "--mirror", work, mirror]);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("deploys the branch head when no commit is pinned (manual deploys, unchanged)", () => {
    const head = git(work, "rev-parse", "HEAD");
    expect(runResolver()).toMatchObject({ status: 0, stdout: head });
  });

  it("deploys the CI-tested commit, not a newer one that landed after the stale check", () => {
    const tested = commit("tested by CI");
    // The workflow's stale check passes here; then main advances before deploy.sh fetches.
    const untested = commit("merged mid-deploy, CI still running");
    fetchMirror();

    const result = runResolver(tested);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(tested);
    expect(result.stdout).not.toBe(untested);
    expect(result.stderr).toContain(`main advanced to ${untested}`);
  });

  it("refuses a pinned commit that is not on the branch", () => {
    git(work, "checkout", "-q", "-b", "side");
    const side = commit("never merged");
    git(work, "checkout", "-q", "main");
    fetchMirror();
    const result = runResolver(side);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("is not on main");
  });

  it("refuses a commit missing from the mirror, a short SHA, or anything not a SHA", () => {
    const head = git(work, "rev-parse", "HEAD");
    expect(runResolver("0".repeat(40)).stderr).toContain("is not in the mirror");
    expect(runResolver(head.slice(0, 8)).status).not.toBe(0);
    expect(runResolver("main").status).not.toBe(0);
    expect(runResolver(`${head}; rm -rf /`).status).not.toBe(0);
  });
});

describe("deploy wiring (#391)", () => {
  const deploy = readFileSync(resolve(root, "deploy/vps/deploy.sh"), "utf8");
  const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

  it("deploy.sh resolves through the pin and checks out the resolved commit, not the branch name", () => {
    expect(deploy).toContain('resolve-deploy-commit.sh" "$MIRROR_DIR" "$DEPLOY_BRANCH" "$DEPLOY_COMMIT"');
    expect(deploy).toContain('checkout -f "$COMMIT" -- .');
    expect(deploy).not.toContain('checkout -f "$DEPLOY_BRANCH" -- .');
    expect(deploy).toContain('printf \'%s\\n\' "$COMMIT" > "$NEW_RELEASE/dist/public/release.txt"');
  });

  it("the CI deploy job pins its own SHA, asserts the live release, and purges against what is serving", () => {
    expect(ci).toContain("DEPLOY_COMMIT=$GITHUB_SHA");
    expect(ci).toMatch(/LOCAL_RELEASE" != "\$GITHUB_SHA"/);
    expect(ci).toContain("const head = process.env.DE_DEPLOYED_RELEASE || context.sha;");
  });
});
