import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SPOOL_MAX_FILES,
  listSpoolEntries,
  productionSpoolRoot,
  removeSpoolEntry,
  rescueReleaseSpools,
  spoolPendingCount,
  spoolWritable,
  updateSpoolEntry,
  writeSpoolEntry,
  type SpoolEntry,
} from "./publicSolutionSpool";

const entry = (id: string, spooledAt = "2026-10-04T00:00:00.000Z"): SpoolEntry =>
  ({ version: 1, spooledAt, salesEmailedAt: null, record: { id, reference: "DE-ABC123", contactEmail: "r@example.com" } as any });

describe("solution request disk spool (#243)", () => {
  let dir: string;
  beforeEach(() => {
    dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spool-test-")), "solution-requests");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes an owner-only file per request and reads it back in spool order", () => {
    expect(writeSpoolEntry(entry("req-bbbbbb", "2026-10-04T00:00:02.000Z"), dir)).toBe(true);
    expect(writeSpoolEntry(entry("req-aaaaaa", "2026-10-04T00:00:01.000Z"), dir)).toBe(true);
    expect((fs.statSync(dir).mode & 0o777).toString(8)).toBe("700");
    expect((fs.statSync(path.join(dir, "req-aaaaaa.json")).mode & 0o777).toString(8)).toBe("600");
    expect(listSpoolEntries(dir).map((e) => e.record.id)).toEqual(["req-aaaaaa", "req-bbbbbb"]);
    expect(spoolPendingCount(dir)).toBe(2);
    expect(fs.readdirSync(dir).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("updates in place and removes after recovery", () => {
    writeSpoolEntry(entry("req-cccccc"), dir);
    expect(updateSpoolEntry({ ...entry("req-cccccc"), salesEmailedAt: "2026-10-04T00:01:00.000Z" }, dir)).toBe(true);
    expect(listSpoolEntries(dir)[0].salesEmailedAt).toBe("2026-10-04T00:01:00.000Z");
    removeSpoolEntry("req-cccccc", dir);
    expect(spoolPendingCount(dir)).toBe(0);
    expect(updateSpoolEntry(entry("req-cccccc"), dir)).toBe(false);
  });

  it("refuses ids that could escape the directory", () => {
    expect(writeSpoolEntry(entry("../../etc/passwd"), dir)).toBe(false);
    expect(writeSpoolEntry(entry("a/b"), dir)).toBe(false);
    expect(spoolPendingCount(dir)).toBe(0);
  });

  it("leaves an unreadable file in place instead of dropping it", () => {
    writeSpoolEntry(entry("req-dddddd"), dir);
    fs.writeFileSync(path.join(dir, "req-eeeeee.json"), "{not json");
    expect(listSpoolEntries(dir).map((e) => e.record.id)).toEqual(["req-dddddd"]);
    expect(fs.existsSync(path.join(dir, "req-eeeeee.json"))).toBe(true);
  });

  it("stops accepting new files at the cap", () => {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < SPOOL_MAX_FILES; i += 1) fs.writeFileSync(path.join(dir, `fill-${String(i).padStart(6, "0")}.json`), "{}");
    expect(writeSpoolEntry(entry("req-ffffff"), dir)).toBe(false);
  });
});

describe("production spool location (spool-outside-releases)", () => {
  let site: string;
  beforeEach(() => {
    site = fs.mkdtempSync(path.join(os.tmpdir(), "spool-site-"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    fs.rmSync(site, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("keeps the spool in <site>/shared, never inside releases/, whichever path the process sees", () => {
    // systemd starts in <site>/current; process.cwd() reports the release it points to.
    expect(productionSpoolRoot("/home/digeratiexperts.com/releases/20261007115415")).toBe(
      "/home/digeratiexperts.com/shared/spool",
    );
    expect(productionSpoolRoot("/home/digeratiexperts.com/current")).toBe("/home/digeratiexperts.com/shared/spool");
  });

  it("resolves a real symlinked release the way the server does", () => {
    const release = path.join(site, "releases", "r1");
    fs.mkdirSync(release, { recursive: true });
    fs.symlinkSync(release, path.join(site, "current"));
    const seen = fs.realpathSync(path.join(site, "current"));
    expect(productionSpoolRoot(seen)).toBe(path.join(fs.realpathSync(site), "shared", "spool"));
  });

  it("moves entries stranded under releases/shared into the spool in use, and leaves a clash in place", () => {
    const stranded = path.join(site, "releases", "shared", "spool", "desk-tickets");
    const target = path.join(site, "shared", "spool");
    writeSpoolEntry(entry("DE-W-AAAAAA-111111"), stranded);
    writeSpoolEntry(entry("DE-W-BBBBBB-222222"), stranded);
    writeSpoolEntry(entry("DE-W-BBBBBB-222222"), path.join(target, "desk-tickets"));
    const moved = rescueReleaseSpools(path.join(site, "releases", "r1"), (folder) => path.join(target, folder));
    expect(moved).toBe(1);
    expect(listSpoolEntries(path.join(target, "desk-tickets")).map((e) => e.record.id).sort()).toEqual([
      "DE-W-AAAAAA-111111",
      "DE-W-BBBBBB-222222",
    ]);
    expect(fs.readdirSync(stranded)).toEqual(["DE-W-BBBBBB-222222.json"]);
    expect((fs.statSync(path.join(target, "desk-tickets", "DE-W-AAAAAA-111111.json")).mode & 0o777).toString(8)).toBe("600");
  });

  it("does nothing outside a release directory", () => {
    expect(rescueReleaseSpools(path.join(site, "current"), (folder) => path.join(site, "x", folder))).toBe(0);
  });

  it("reports whether the spool folder takes writes", () => {
    expect(spoolWritable(path.join(site, "shared", "spool", "desk-tickets"))).toBe(true);
    const locked = path.join(site, "locked");
    fs.mkdirSync(locked, { mode: 0o500 });
    const runningAsRoot = process.getuid?.() === 0;
    expect(spoolWritable(path.join(locked, "desk-tickets"))).toBe(runningAsRoot);
  });
});

