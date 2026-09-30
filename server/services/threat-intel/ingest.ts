import fs from "node:fs";
import path from "node:path";
import {
  ARCHIVE_MAX_AGE_DAYS,
  categorizeThreat,
  HOMEPAGE_MAX_AGE_DAYS,
  kickerFor,
  scoreThreat,
  selectArchiveThreats,
  selectHomepageThreats,
  severityFor,
  THREAT_ATTRIBUTION,
  type ThreatFeedPayload,
  type ThreatItem,
  type ThreatSourceStatus,
} from "../../../shared/threatFeed";
import {
  fetchCisaAdvisories,
  fetchEpss,
  fetchKev,
  fetchMsrc,
  fetchNvdCvss,
  type RawThreat,
} from "./sources";

const REFRESH_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 8_000;

type CachedFeed = {
  generatedAt: string;
  sources: Record<string, ThreatSourceStatus>;
  items: ThreatItem[];
};

let memory: CachedFeed | null = null;
let refreshInFlight: Promise<CachedFeed> | null = null;
let schedulerStarted = false;

function feedPath(): string {
  if (process.env.THREAT_FEED_PATH) return process.env.THREAT_FEED_PATH;
  if (process.env.NODE_ENV === "production" && fs.existsSync("/home/digeratiexperts.com/logs")) {
    return "/home/digeratiexperts.com/logs/threat-feed.json";
  }
  return path.join(process.cwd(), "data", "threat-feed.json");
}

function loadFromDisk(): CachedFeed | null {
  try {
    const raw = fs.readFileSync(feedPath(), "utf8");
    const parsed = JSON.parse(raw) as CachedFeed;
    if (parsed?.items && parsed.generatedAt) {
      memory = parsed;
      return parsed;
    }
  } catch {
    // First run or unreadable cache — ingest will rebuild.
  }
  return null;
}

function persist(feed: CachedFeed): void {
  const dest = feedPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(feed, null, 2));
  fs.renameSync(tmp, dest);
}

async function settle<T>(
  name: string,
  work: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; status: ThreatSourceStatus }> {
  try {
    const value = await work();
    const count = Array.isArray(value) ? value.length : value instanceof Map ? value.size : 1;
    return {
      value,
      status: { ok: true, count, fetchedAt: new Date().toISOString() },
    };
  } catch (error: any) {
    return {
      value: fallback,
      status: {
        ok: false,
        count: 0,
        fetchedAt: new Date().toISOString(),
        error: error?.message || `${name} failed`,
      },
    };
  }
}

function mergeRaw(rows: RawThreat[]): RawThreat[] {
  const byCve = new Map<string, RawThreat>();
  const extras: RawThreat[] = [];

  for (const row of rows) {
    if (!row.cve) {
      extras.push(row);
      continue;
    }
    const existing = byCve.get(row.cve);
    if (!existing) {
      byCve.set(row.cve, row);
      continue;
    }
    // KEV wins the narrative; keep Microsoft product tags and ransomware flags.
    const preferKev = row.kev && !existing.kev ? row : existing.kev && !row.kev ? existing : existing;
    const other = preferKev === existing ? row : existing;
    byCve.set(row.cve, {
      ...preferKev,
      ransomware: preferKev.ransomware || other.ransomware,
      vendor: preferKev.vendor || other.vendor,
      product: preferKev.product || other.product,
      cisaUrgentAdvisory: preferKev.cisaUrgentAdvisory || other.cisaUrgentAdvisory,
    });
  }

  return [...byCve.values(), ...extras];
}

function toItems(
  rows: RawThreat[],
  epss: Map<string, number>,
  cvss: Map<string, number>,
  now: Date,
): ThreatItem[] {
  return rows.map((row) => {
    const epssScore = row.cve ? epss.get(row.cve) : undefined;
    const cvssScore = row.cve ? cvss.get(row.cve) : undefined;
    const input = {
      publishedAt: row.publishedAt,
      title: row.title,
      excerpt: row.excerpt,
      vendor: row.vendor,
      product: row.product,
      kev: row.kev,
      ransomware: row.ransomware,
      cisaUrgentAdvisory: row.cisaUrgentAdvisory,
      epss: epssScore,
      cvss: cvssScore,
      now,
    };
    const { score, reasons } = scoreThreat(input);
    const category = categorizeThreat(input);
    const draft = {
      ...row,
      epss: epssScore,
      cvss: cvssScore,
      category,
      score,
      scoreReasons: reasons,
    };
    return {
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      category,
      severity: severityFor(draft),
      kicker: kickerFor(draft),
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt,
      cve: row.cve,
      vendor: row.vendor,
      product: row.product,
      cvss: cvssScore,
      epss: epssScore,
      kev: row.kev,
      ransomware: row.ransomware,
      score,
      scoreReasons: reasons,
    };
  });
}

export async function refreshThreatFeed(): Promise<CachedFeed> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const now = new Date();
    const kev = await settle("kev", () => fetchKev(ARCHIVE_MAX_AGE_DAYS), []);
    const advisories = await settle("cisa", () => fetchCisaAdvisories(ARCHIVE_MAX_AGE_DAYS), []);
    const msrc = await settle("msrc", () => fetchMsrc(HOMEPAGE_MAX_AGE_DAYS), []);

    const merged = mergeRaw([...kev.value, ...advisories.value, ...msrc.value]);
    const cves = merged.map((row) => row.cve).filter((cve): cve is string => Boolean(cve));
    const homepageCves = merged
      .filter((row) => row.kev || row.cisaUrgentAdvisory)
      .map((row) => row.cve)
      .filter((cve): cve is string => Boolean(cve))
      .slice(0, 8);

    const epss = await settle("epss", () => fetchEpss(cves), new Map<string, number>());
    const nvd = await settle("nvd", () => fetchNvdCvss(homepageCves), new Map<string, number>());

    const items = toItems(merged, epss.value, nvd.value, now);
    const feed: CachedFeed = {
      generatedAt: now.toISOString(),
      sources: {
        kev: kev.status,
        cisa: advisories.status,
        msrc: msrc.status,
        epss: epss.status,
        nvd: nvd.status,
      },
      items,
    };
    memory = feed;
    try {
      persist(feed);
    } catch (error: any) {
      console.warn("threat-feed persist skipped:", error?.message || error);
    }
    return feed;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function cacheAgeMs(feed: CachedFeed | null): number {
  if (!feed?.generatedAt) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(feed.generatedAt);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : Date.now() - ms;
}

export function getCachedThreatFeed(): CachedFeed | null {
  return memory || loadFromDisk();
}

export async function getThreatFeed(scope: "homepage" | "all" = "homepage"): Promise<ThreatFeedPayload> {
  let feed = getCachedThreatFeed();
  if (!feed || cacheAgeMs(feed) > REFRESH_MS) {
    if (feed) {
      void refreshThreatFeed().catch((error) => {
        console.warn("threat-feed background refresh failed:", error?.message || error);
      });
    } else {
      try {
        feed = await refreshThreatFeed();
      } catch (error: any) {
        console.warn("threat-feed initial refresh failed:", error?.message || error);
      }
    }
  }

  const items = feed?.items || [];
  const selected = scope === "homepage" ? selectHomepageThreats(items) : selectArchiveThreats(items);
  const stale = Boolean(feed && cacheAgeMs(feed) > REFRESH_MS * 2);
  return {
    status: selected.length ? (stale ? "stale" : "ok") : "empty",
    generatedAt: feed?.generatedAt || null,
    items: selected,
    sources: feed?.sources || {},
    attribution: THREAT_ATTRIBUTION,
  };
}

export function startThreatIntelScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  loadFromDisk();
  const delay = Number(process.env.THREAT_FEED_STARTUP_DELAY_MS || STARTUP_DELAY_MS);
  setTimeout(() => {
    refreshThreatFeed()
      .then((feed) => {
        console.log(
          `threat-feed refreshed: ${feed.items.length} items from ${Object.entries(feed.sources)
            .map(([name, status]) => `${name}${status.ok ? "" : "!"}`)
            .join(",")}`,
        );
      })
      .catch((error) => {
        console.warn("threat-feed startup refresh failed:", error?.message || error);
      });
  }, delay);
  setInterval(() => {
    refreshThreatFeed().catch((error) => {
      console.warn("threat-feed scheduled refresh failed:", error?.message || error);
    });
  }, REFRESH_MS).unref();
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function isLoopback(ip: string): boolean {
  const host = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function isLocalRequest(req: {
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  const peer = req.socket?.remoteAddress || "";
  if (!isLoopback(peer)) return false;
  // OpenLiteSpeed connects to Node on localhost, so the peer is always loopback
  // in production. Forwarding headers are not proof of a local caller: a client
  // can put 127.0.0.1 first and a proxy that appends keeps that value. The
  // in-process refresh and the localhost timer call the app port with no
  // forwarding header. Any proxied request is refused.
  const forwarded = headerValue(req.headers?.["x-forwarded-for"]).trim();
  const realIp = headerValue(req.headers?.["x-real-ip"]).trim();
  if (forwarded || realIp) return false;
  return true;
}
