/**
 * Local disk spool for submitted solution requests (#243).
 *
 * A submitted solution request is never lost. When Postgres refuses the write,
 * the full record is written here as one JSON file (temp file, fsync, rename),
 * so it survives a database outage, a process restart and a deploy: the
 * production default lives in the site's shared/ directory, outside the
 * release folders. The replay worker writes each entry into Postgres once it
 * is reachable and deletes the file only after that commit.
 *
 * Files hold contact details: the directory is 0700 and each file 0600, owned
 * by the service user, never under dist/public. The spool is capped so a flood
 * cannot fill the disk; above the cap the CRM and email layers still apply.
 */
import fs from "fs";
import os from "os";
import path from "path";
import type { PublicSolutionRequest } from "./publicSolutionRequestStore";

/** One spooled record. Store quote requests (#240) reuse this spool in their own directory. */
export type SpoolEntry<R extends { id: string } = PublicSolutionRequest> = {
  version: 1;
  spooledAt: string;
  /** Set once the fallback email reached sales, so recovery does not notify twice. */
  salesEmailedAt: string | null;
  record: R;
};

type AnyEntry = SpoolEntry<{ id: string }>;

export const SPOOL_MAX_FILES = 5000;
const SAFE_ID = /^[A-Za-z0-9_-]{6,80}$/;

/**
 * <site>/shared/spool, outside the release folders, in production.
 *
 * systemd starts the site in <site>/current, a symlink to
 * <site>/releases/<timestamp>, and process.cwd() returns the resolved path. So
 * "../shared" from the working directory is <site>/releases/shared: inside the
 * folder deploy/vps/deploy.sh prunes. That deleted a spooled DE Desk ticket on
 * 2026-10-07. A release directory therefore steps out of releases/ first.
 */
export function productionSpoolRoot(cwd: string = process.cwd()): string {
  const parent = path.dirname(path.resolve(cwd));
  const site = path.basename(parent) === "releases" ? path.dirname(parent) : parent;
  return path.join(site, "shared", "spool");
}

export function spoolDir(): string {
  if (process.env.SOLUTION_SPOOL_DIR) return path.resolve(process.env.SOLUTION_SPOOL_DIR);
  if (process.env.NODE_ENV === "production") return path.join(productionSpoolRoot(), "solution-requests");
  return path.join(os.tmpdir(), "de-solution-spool");
}

/** Store quote requests (#240) spool beside solution requests, in their own directory. */
export function quoteSpoolDir(): string {
  if (process.env.QUOTE_SPOOL_DIR) return path.resolve(process.env.QUOTE_SPOOL_DIR);
  if (process.env.NODE_ENV === "production") return path.join(productionSpoolRoot(), "quote-requests");
  return path.join(os.tmpdir(), "de-quote-spool");
}

/** DE Desk tickets the Desk API could not take (desk-ticket-failover), in their own directory. */
export function deskTicketSpoolDir(): string {
  if (process.env.DESK_TICKET_SPOOL_DIR) return path.resolve(process.env.DESK_TICKET_SPOOL_DIR);
  if (process.env.NODE_ENV === "production") return path.join(productionSpoolRoot(), "desk-tickets");
  return path.join(os.tmpdir(), "de-desk-ticket-spool");
}

const SPOOL_FOLDERS = {
  "solution-requests": spoolDir,
  "quote-requests": quoteSpoolDir,
  "desk-tickets": deskTicketSpoolDir,
} as const;

/**
 * Moves spool files left in <site>/releases/shared/spool (where they were
 * written before productionSpoolRoot) into the spool folders in use, so the
 * deploy's release pruning cannot delete them. Runs once at startup, before the
 * deploy prunes. Returns how many files it moved; never throws.
 */
export function rescueReleaseSpools(
  cwd: string = process.cwd(),
  dirFor: (folder: keyof typeof SPOOL_FOLDERS) => string = (folder) => SPOOL_FOLDERS[folder](),
): number {
  const parent = path.dirname(path.resolve(cwd));
  if (path.basename(parent) !== "releases") return 0;
  let moved = 0;
  for (const folder of Object.keys(SPOOL_FOLDERS) as (keyof typeof SPOOL_FOLDERS)[]) {
    const from = path.join(parent, "shared", "spool", folder);
    const to = dirFor(folder);
    if (path.resolve(from) === path.resolve(to)) continue;
    for (const name of spoolFiles(from)) {
      try {
        fs.mkdirSync(to, { recursive: true, mode: 0o700 });
        if (fs.existsSync(path.join(to, name))) continue;
        try {
          fs.renameSync(path.join(from, name), path.join(to, name));
        } catch (error: any) {
          if (error?.code !== "EXDEV") throw error;
          fs.copyFileSync(path.join(from, name), path.join(to, name), fs.constants.COPYFILE_EXCL);
          fs.unlinkSync(path.join(from, name));
        }
        moved += 1;
      } catch (error: any) {
        console.error("[solution-spool] could not move a stranded entry:", name, error?.message || error);
      }
    }
  }
  return moved;
}

function fileFor(dir: string, id: string): string | null {
  return SAFE_ID.test(id) ? path.join(dir, `${id}.json`) : null;
}

function spoolFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
}

function atomicWrite(file: string, data: string): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "wx", 0o600);
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** Writes a new entry. False when the disk refuses it or the spool is full. */
export function writeSpoolEntry(entry: AnyEntry, dir: string = spoolDir()): boolean {
  const file = fileFor(dir, entry.record.id);
  if (!file) return false;
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(file) && spoolFiles(dir).length >= SPOOL_MAX_FILES) {
      console.error("[solution-spool] spool full; not written", { id: entry.record.id });
      return false;
    }
    atomicWrite(file, JSON.stringify(entry));
    return true;
  } catch (error: any) {
    console.error("[solution-spool] write failed:", error?.message || error);
    return false;
  }
}

/** Rewrites an existing entry in place (for example after the email was sent). */
export function updateSpoolEntry(entry: AnyEntry, dir: string = spoolDir()): boolean {
  const file = fileFor(dir, entry.record.id);
  if (!file || !fs.existsSync(file)) return false;
  try {
    atomicWrite(file, JSON.stringify(entry));
    return true;
  } catch (error: any) {
    console.error("[solution-spool] update failed:", error?.message || error);
    return false;
  }
}

export function listSpoolEntries<R extends { id: string } = PublicSolutionRequest>(
  dir: string = spoolDir(),
): SpoolEntry<R>[] {
  const entries: SpoolEntry<R>[] = [];
  for (const name of spoolFiles(dir)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as SpoolEntry<R>;
      if (parsed?.version === 1 && parsed.record?.id && `${parsed.record.id}.json` === name) entries.push(parsed);
      else console.error("[solution-spool] unreadable entry left in place:", name);
    } catch {
      console.error("[solution-spool] unreadable entry left in place:", name);
    }
  }
  return entries.sort((a, b) => a.spooledAt.localeCompare(b.spooledAt));
}

export function removeSpoolEntry(id: string, dir: string = spoolDir()): void {
  const file = fileFor(dir, id);
  if (!file) return;
  try {
    fs.unlinkSync(file);
  } catch {
    // Already gone.
  }
}

/**
 * Whether the spool folder takes writes (it exists or can be made, and the
 * service may write to it, which a read-only systemd mount refuses). Safe to
 * expose on the health endpoint.
 */
export function spoolWritable(dir: string = spoolDir()): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Count only: safe to expose on the health endpoint. */
export function spoolPendingCount(dir: string = spoolDir()): number {
  return spoolFiles(dir).length;
}
