/**
 * Digerati Threat Relevance Engine — shared types and scoring.
 *
 * Homepage cards are a scored subset of authoritative feeds (CISA KEV,
 * CISA advisories, FIRST EPSS, NIST NVD, Microsoft MSRC). Do not invent
 * CVEs, CVSS, clients, or exploitation claims.
 */

export const THREAT_CATEGORIES = [
  "Active Exploitation",
  "Threat Advisory",
  "Critical Vulnerability",
  "Malware Activity",
  "Ransomware",
  "Microsoft Security",
  "Digerati Advisory",
] as const;

export type ThreatCategory = (typeof THREAT_CATEGORIES)[number];

export type ThreatSeverity = "critical" | "high" | "watch";

export const HOMEPAGE_MAX_AGE_DAYS = 45;
export const ARCHIVE_MAX_AGE_DAYS = 90;
export const HOMEPAGE_SCORE_THRESHOLD = 40;
export const ARCHIVE_SCORE_THRESHOLD = 15;
export const HOMEPAGE_THREAT_LIMIT = 4;
export const ARCHIVE_THREAT_LIMIT = 40;

export const THREAT_ATTRIBUTION =
  "Sources: CISA, NIST NVD, FIRST, and Microsoft MSRC. Digerati Experts prioritizes items based on active exploitation, exploit probability, and relevance to SMB environments.";

/** Sources the public attribution line must keep naming. */
export const THREAT_ATTRIBUTION_REQUIRED_SOURCES = [
  "CISA",
  "NIST NVD",
  "FIRST",
  "Microsoft MSRC",
] as const;

/**
 * Keep a canonical company + source line even when a payload omits or mangles
 * attribution. Never invent CVEs — this only guards the footer credit.
 */
export function normalizeThreatAttribution(raw: unknown): string {
  if (typeof raw !== "string") return THREAT_ATTRIBUTION;
  const trimmed = raw.trim();
  if (!trimmed) return THREAT_ATTRIBUTION;
  const hasCompany = /\bDigerati Experts\b/.test(trimmed);
  const hasSources = THREAT_ATTRIBUTION_REQUIRED_SOURCES.every((source) =>
    trimmed.includes(source),
  );
  if (!hasCompany || !hasSources) return THREAT_ATTRIBUTION;
  return trimmed;
}

export interface ThreatItem {
  id: string;
  title: string;
  excerpt: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  kicker: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  cve?: string;
  vendor?: string;
  product?: string;
  cvss?: number;
  epss?: number;
  kev: boolean;
  ransomware: boolean;
  score: number;
  scoreReasons: string[];
}

export interface ThreatSourceStatus {
  ok: boolean;
  count: number;
  fetchedAt?: string;
  error?: string;
}

export interface ThreatFeedPayload {
  status: "ok" | "empty" | "stale";
  generatedAt: string | null;
  items: ThreatItem[];
  sources: Record<string, ThreatSourceStatus>;
  attribution: string;
}

export interface ThreatScoreInput {
  publishedAt: string;
  title: string;
  excerpt?: string;
  vendor?: string;
  product?: string;
  kev: boolean;
  ransomware: boolean;
  cisaUrgentAdvisory?: boolean;
  epss?: number;
  cvss?: number;
  now?: Date;
}

const SMB_RE =
  /\b(microsoft|windows|office|sharepoint|exchange|outlook|teams|entra|azure ad|microsoft 365|m365|defender|hyper-v|active directory|fortinet|fortigate|fortios|cisco|asa|meraki|sonicwall|watchguard|ubiquiti|unifi|sophos|connectwise|n-able|n-central|datto|veeam|acronis|proofpoint|mimecast|google workspace|chrome|edge|adobe|zoom|quickbooks|vpn|firewall|rdp|remote desktop|papercut|vmware|esxi|apache|tomcat|nginx|wordpress|iis|loadmaster)\b/i;

const NICHE_RE =
  /\b(hpe oneview|siemens|parasolid|solid edge|simcenter|johnson controls|metasys|hitachi energy|andritz|aveva|ibm langflow|mainframe|sap hana|as\/400|ibm i)\b/i;

const UNAUTH_RCE_RE =
  /\b(unauthenticated|authentication bypass|remote code execution|\brce\b|command injection|code injection)\b/i;

export function haystack(input: Pick<ThreatScoreInput, "title" | "excerpt" | "vendor" | "product">): string {
  return [input.vendor, input.product, input.title, input.excerpt].filter(Boolean).join(" ");
}

export function isSmbRelevant(input: Pick<ThreatScoreInput, "title" | "excerpt" | "vendor" | "product">): boolean {
  return SMB_RE.test(haystack(input));
}

export function isNicheProduct(input: Pick<ThreatScoreInput, "title" | "excerpt" | "vendor" | "product">): boolean {
  return NICHE_RE.test(haystack(input));
}

export function looksUnauthOrRce(input: Pick<ThreatScoreInput, "title" | "excerpt">): boolean {
  return UNAUTH_RCE_RE.test(`${input.title} ${input.excerpt || ""}`);
}

export function ageDays(publishedAt: string, now: Date = new Date()): number {
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - published) / (24 * 60 * 60 * 1000);
}

export function scoreThreat(input: ThreatScoreInput): { score: number; reasons: string[] } {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  let score = 0;

  if (input.kev) {
    score += 40;
    reasons.push("+40 CISA KEV");
  }
  if ((input.epss ?? 0) > 0.8) {
    score += 25;
    reasons.push("+25 EPSS > 80%");
  }
  if ((input.cvss ?? 0) >= 9) {
    score += 15;
    reasons.push("+15 Critical CVSS");
  }
  if (isSmbRelevant(input)) {
    score += 15;
    reasons.push("+15 SMB / common stack");
  }
  if (input.ransomware) {
    score += 10;
    reasons.push("+10 ransomware association");
  }
  if (looksUnauthOrRce(input)) {
    score += 10;
    reasons.push("+10 unauth / RCE language");
  }
  if (input.cisaUrgentAdvisory) {
    score += 10;
    reasons.push("+10 CISA urgent advisory");
  }
  if (isNicheProduct(input) && !isSmbRelevant(input)) {
    score -= 20;
    reasons.push("-20 niche / enterprise-only product");
  }
  if (ageDays(input.publishedAt, now) > HOMEPAGE_MAX_AGE_DAYS) {
    score -= 20;
    reasons.push("-20 older than 45 days");
  }

  return { score, reasons };
}

export function categorizeThreat(input: ThreatScoreInput): ThreatCategory {
  if (input.ransomware) return "Ransomware";
  if (input.kev) return "Active Exploitation";
  if (input.cisaUrgentAdvisory) return "Threat Advisory";
  if (/\bmicrosoft|windows|sharepoint|exchange|m365|office|entra|defender\b/i.test(haystack(input))) {
    return "Microsoft Security";
  }
  if ((input.cvss ?? 0) >= 9 || (input.epss ?? 0) >= 0.8) return "Critical Vulnerability";
  return "Threat Advisory";
}

export function severityFor(item: Pick<ThreatItem, "kev" | "ransomware" | "score" | "epss">): ThreatSeverity {
  if (item.kev || item.ransomware || item.score >= 70) return "critical";
  if (item.score >= 50 || (item.epss ?? 0) >= 0.8) return "high";
  return "watch";
}

export function kickerFor(item: {
  kev: boolean;
  ransomware: boolean;
  epss?: number;
  category: ThreatCategory;
}): string {
  if (item.kev) return "CRITICAL · ACTIVE EXPLOITATION";
  if (item.ransomware) return "RANSOMWARE";
  if ((item.epss ?? 0) >= 0.8) {
    const pct = Math.round((item.epss as number) * 100);
    return `HIGH · ${pct}% EPSS`;
  }
  if (item.category === "Microsoft Security") return "MICROSOFT SECURITY";
  if (item.category === "Critical Vulnerability") return "CRITICAL VULNERABILITY";
  if (item.category === "Malware Activity") return "MALWARE ACTIVITY";
  return "THREAT ADVISORY";
}

export function formatThreatDate(iso: string, style: "long" | "short" = "long"): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  if (style === "short") {
    return new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function selectHomepageThreats(
  items: ThreatItem[],
  now: Date = new Date(),
  limit = HOMEPAGE_THREAT_LIMIT,
): ThreatItem[] {
  return items
    .filter((item) => item.score >= HOMEPAGE_SCORE_THRESHOLD && ageDays(item.publishedAt, now) <= HOMEPAGE_MAX_AGE_DAYS)
    .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}

export function selectArchiveThreats(
  items: ThreatItem[],
  now: Date = new Date(),
  limit = ARCHIVE_THREAT_LIMIT,
): ThreatItem[] {
  return items
    .filter((item) => item.score >= ARCHIVE_SCORE_THRESHOLD && ageDays(item.publishedAt, now) <= ARCHIVE_MAX_AGE_DAYS)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.score - a.score)
    .slice(0, limit);
}
