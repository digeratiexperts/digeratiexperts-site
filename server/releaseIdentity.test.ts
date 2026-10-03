import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readReleaseIdentity } from "./releaseIdentity";

const SHA = "823e4d076073037e6f1cd028be8596e08638ef18";

let dir: string;
let marker: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-identity-"));
  marker = path.join(dir, "release.txt");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("release identity for /api/health", () => {
  it("reads the SHA deploy.sh writes, with its trailing newline", () => {
    fs.writeFileSync(marker, `${SHA}\n`);
    const when = new Date("2026-10-03T18:00:00.000Z");
    fs.utimesSync(marker, when, when);

    expect(readReleaseIdentity(marker)).toEqual({
      commit: SHA,
      commitShort: "823e4d07",
      builtAt: "2026-10-03T18:00:00.000Z",
    });
  });

  it("reports unknown when there is no marker (dev, CI smoke)", () => {
    expect(readReleaseIdentity(marker)).toEqual({
      commit: "unknown",
      commitShort: "unknown",
      builtAt: null,
    });
  });

  it("never echoes marker content that is not a full SHA", () => {
    for (const content of ["", "823e4d07\n", `${SHA}\nextra`, "<script>alert(1)</script>", "z".repeat(40)]) {
      fs.writeFileSync(marker, content);
      expect(readReleaseIdentity(marker).commit).toBe("unknown");
    }
  });
});
