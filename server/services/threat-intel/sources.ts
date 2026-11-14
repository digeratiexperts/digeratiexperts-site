import { advisoryExcerpt, fetchJson, fetchText, parseLooseDate, stripHtml, truncate } from "./http";

export type RawThreat = {
  id: string;
  title: string;
  excerpt: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  cve?: string;
  vendor?: string;
  product?: string;
  kev: boolean;
  ransomware: boolean;
  cisaUrgentAdvisory?: boolean;
};

type KevCatalog = {
  dateReleased?: string;
  vulnerabilities?: Array<{
    cveID?: string;
    vendorProject?: string;
    product?: string;
    vulnerabilityName?: string;
    dateAdded?: string;
    shortDescription?: string;
    knownRansomwareCampaignUse?: string;
  }>;
};

type EpssResponse = {
  data?: Array<{ cve?: string; epss?: string }>;
};

type NvdResponse = {
  vulnerabilities?: Array<{
    cve?: {
      id?: string;
      metrics?: Record<string, Array<{ cvssData?: { baseScore?: number } }>>;
    };
  }>;
};

type MsrcResponse = {
  value?: Array<{
    cveNumber?: string;
    cveTitle?: string;
    releaseDate?: string;
    latestRevisionDate?: string;
    tag?: string;
    isMariner?: boolean;
    customerActionRequired?: boolean;
  }>;
};

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CISA_ADVISORIES_URL = "https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml";
const CISA_ALERTS_URL = "https://www.cisa.gov/cybersecurity-advisories/alerts.xml";
const EPSS_URL = "https://api.first.org/data/v1/epss";
const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const MSRC_URL =
  "https://api.msrc.microsoft.com/sug/v2.0/en-US/vulnerability?$filter=isMariner eq false&$orderby=latestRevisionDate desc&$top=40";

const CVE_RE = /CVE-\d{4}-\d{4,}/gi;
const KEV_ANNOUNCE_RE = /cisa adds .+ known exploited/i;
const URGENT_ADVISORY_RE = /urges|warns|stopransomware|active campaign|exploit|hardening|ransomware/i;
const MSRC_KEEP_RE =
  /\b(windows|office|sharepoint|exchange|outlook|teams|entra|azure ad|microsoft 365|m365|defender|hyper-v|active directory|edge)\b/i;
const MSRC_SKIP_RE = /^chromium:/i;

function uniqueCves(text: string): string[] {
  return Array.from(new Set((text.match(CVE_RE) || []).map((cve) => cve.toUpperCase())));
}

function rssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match) => {
    const block = match[1];
    const pick = (tag: string) => {
      const found = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      return found ? stripHtml(found[1]) : "";
    };
    return {
      title: pick("title"),
      link: pick("link"),
      description: pick("description"),
      pubDate: pick("pubDate") || pick("dc:date"),
    };
  });
}

export async function fetchKev(maxAgeDays = 90): Promise<RawThreat[]> {
  const catalog = await fetchJson<KevCatalog>(KEV_URL);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return (catalog.vulnerabilities || [])
    .map((row): RawThreat | null => {
      const publishedAt = parseLooseDate(row.dateAdded);
      const cve = row.cveID?.toUpperCase();
      if (!publishedAt || !cve) return null;
      if (Date.parse(publishedAt) < cutoff) return null;
      const vendor = row.vendorProject?.trim();
      const product = row.product?.trim();
      const name = row.vulnerabilityName?.trim() || `${vendor || "Vendor"} ${product || "product"} vulnerability`;
      const ransomware = /^known$/i.test(row.knownRansomwareCampaignUse || "");
      return {
        id: `kev:${cve}`,
        title: `Active Exploitation: ${vendor || "Vendor"} ${product || ""}`.trim() + " added to CISA KEV",
        excerpt: truncate(
          `${row.shortDescription || name} CISA has confirmed exploitation in the wild.`,
        ),
        sourceName: "CISA KEV",
        sourceUrl: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(cve)}`,
        publishedAt,
        cve,
        vendor,
        product,
        kev: true,
        ransomware,
      };
    })
    .filter((row): row is RawThreat => Boolean(row));
}

export async function fetchCisaAdvisories(maxAgeDays = 90): Promise<RawThreat[]> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const [advisoriesXml, alertsXml] = await Promise.all([
    fetchText(CISA_ADVISORIES_URL),
    fetchText(CISA_ALERTS_URL),
  ]);

  const items = [...rssItems(advisoriesXml), ...rssItems(alertsXml)];
  const seen = new Set<string>();
  const out: RawThreat[] = [];

  for (const item of items) {
    if (!item.title || !item.link) continue;
    if (KEV_ANNOUNCE_RE.test(item.title)) continue;
    if (/ics-advisories|ics-medical-advisories/i.test(item.link)) continue;
    const publishedAt = parseLooseDate(item.pubDate);
    if (!publishedAt || Date.parse(publishedAt) < cutoff) continue;
    const key = item.link;
    if (seen.has(key)) continue;
    seen.add(key);

    const cves = uniqueCves(item.title);
    const ransomware = /ransomware/i.test(`${item.title} ${item.description}`);
    out.push({
      id: `cisa:${item.link}`,
      title: item.title.replace(/^#/, "").trim(),
      excerpt: advisoryExcerpt(
        item.description ||
          "CISA published an advisory covering recent, ongoing, or high-impact cyber activity. Review affected systems and recommended mitigations.",
      ),
      sourceName: "CISA",
      sourceUrl: item.link,
      publishedAt,
      cve: cves[0],
      kev: false,
      ransomware,
      cisaUrgentAdvisory: URGENT_ADVISORY_RE.test(item.title) || /\/aa\d{2}-/i.test(item.link),
    });
  }

  return out;
}

export async function fetchMsrc(maxAgeDays = 45): Promise<RawThreat[]> {
  const payload = await fetchJson<MsrcResponse>(MSRC_URL, {
    headers: { Accept: "application/json" },
  });
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return (payload.value || [])
    .map((row): RawThreat | null => {
      const cve = row.cveNumber?.toUpperCase();
      const title = row.cveTitle?.trim();
      if (!cve || !title || row.isMariner || MSRC_SKIP_RE.test(title)) return null;
      if (!MSRC_KEEP_RE.test(`${title} ${row.tag || ""}`)) return null;
      const publishedAt = parseLooseDate(row.releaseDate) || parseLooseDate(row.latestRevisionDate);
      if (!publishedAt || Date.parse(publishedAt) < cutoff) return null;
      return {
        id: `msrc:${cve}`,
        title,
        excerpt:
          "Microsoft published a security update for this vulnerability. Inventory affected systems and apply the vendor update where applicable.",
        sourceName: "Microsoft MSRC",
        sourceUrl: `https://msrc.microsoft.com/update-guide/vulnerability/${cve}`,
        publishedAt,
        cve,
        vendor: "Microsoft",
        product: row.tag || undefined,
        kev: false,
        ransomware: false,
      };
    })
    .filter((row): row is RawThreat => Boolean(row));
}

export async function fetchEpss(cves: string[]): Promise<Map<string, number>> {
  const unique = Array.from(new Set(cves.map((cve) => cve.toUpperCase()))).slice(0, 80);
  const scores = new Map<string, number>();
  if (!unique.length) return scores;

  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40);
    const url = `${EPSS_URL}?cve=${encodeURIComponent(batch.join(","))}`;
    const payload = await fetchJson<EpssResponse>(url);
    for (const row of payload.data || []) {
      const cve = row.cve?.toUpperCase();
      const epss = Number(row.epss);
      if (cve && Number.isFinite(epss)) scores.set(cve, epss);
    }
  }
  return scores;
}

export async function fetchNvdCvss(cves: string[]): Promise<Map<string, number>> {
  const unique = Array.from(new Set(cves.map((cve) => cve.toUpperCase()))).slice(0, 8);
  const scores = new Map<string, number>();
  const apiKey = (process.env.NVD_API_KEY || "").trim();
  const headers = apiKey ? { apiKey } : undefined;

  for (const cve of unique) {
    try {
      const payload = await fetchJson<NvdResponse>(`${NVD_URL}?cveId=${encodeURIComponent(cve)}`, {
        timeoutMs: 12_000,
        headers,
      });
      const metrics = payload.vulnerabilities?.[0]?.cve?.metrics || {};
      const preferred = metrics.cvssMetricV31 || metrics.cvssMetricV40 || metrics.cvssMetricV30 || metrics.cvssMetricV2;
      const score = preferred?.[0]?.cvssData?.baseScore;
      if (typeof score === "number") scores.set(cve, score);
    } catch {
      // NVD is supporting data — skip a single miss rather than failing the feed.
    }
    await new Promise((resolve) => setTimeout(resolve, apiKey ? 200 : 700));
  }
  return scores;
}
