/**
 * Which commit this process is serving, for GET /api/health.
 *
 * deploy/vps/deploy.sh writes the exact deployed SHA to dist/public/release.txt
 * after the build, and verifies that same file before it accepts a release. The
 * health endpoint reads that marker instead of running git at request time, so
 * MERGED vs LIVE can be checked with one request.
 *
 * A release directory never changes under a running process (deploy flips the
 * `current` symlink, then restarts), so the marker is read once and cached.
 * Anything missing or malformed reads as "unknown"; it never fails the health check.
 */
import fs from "fs";
import path from "path";

export interface ReleaseIdentity {
  commit: string;
  commitShort: string;
  builtAt: string | null;
}

const UNKNOWN: ReleaseIdentity = { commit: "unknown", commitShort: "unknown", builtAt: null };
const FULL_SHA = /^[0-9a-f]{40}$/;

export function defaultReleaseMarkerPath(): string {
  return path.resolve(process.cwd(), "dist/public/release.txt");
}

export function readReleaseIdentity(markerPath: string = defaultReleaseMarkerPath()): ReleaseIdentity {
  try {
    const commit = fs.readFileSync(markerPath, "utf8").trim().toLowerCase();
    if (!FULL_SHA.test(commit)) return UNKNOWN;
    const builtAt = fs.statSync(markerPath).mtime.toISOString();
    return { commit, commitShort: commit.slice(0, 8), builtAt };
  } catch {
    return UNKNOWN;
  }
}

let cached: ReleaseIdentity | undefined;

export function releaseIdentity(): ReleaseIdentity {
  cached ??= readReleaseIdentity();
  return cached;
}
