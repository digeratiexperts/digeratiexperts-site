import type { PoolItemKind } from "./licenseBoard";
import { LICENSE_CATALOG } from "./licensing";

/**
 * The patch bay's parts bin: everything DE can put in its pool, grouped on
 * shelves. Product names and package ids only; no prices (prices live in the
 * Hub catalog and the Store).
 *
 * Sources, merged by the server: this starter shelf, the licensing catalog
 * (shared/licensing.ts) and, when the Hub feed is connected, the Hub's SKUs.
 * DE can always add its own (a line-of-business app, a vendor SKU not here).
 */

export type ShelfEntry = {
  /** Stable key, so the bin can show what is already in the pool. */
  key: string;
  kind: PoolItemKind;
  vendor: string;
  product: string;
  category: ShelfCategory;
  catalogKey?: string;
  sku?: string;
  /** Chocolatey package id, for apps JumpCloud Software Management can install on Windows. */
  chocoPackage?: string;
  source: "starter" | "catalog" | "hub";
};

export const SHELF_CATEGORIES = [
  { key: "Productivity", kind: "license", blurb: "Mail, Office and collaboration suites" },
  { key: "Security", kind: "license", blurb: "EDR, MDR, identity protection" },
  { key: "Identity & devices", kind: "license", blurb: "Directory, SSO, device management" },
  { key: "Voice", kind: "license", blurb: "Phones and calling" },
  { key: "Hub SKUs", kind: "license", blurb: "From the Intelligence Hub catalog" },
  { key: "Baseline apps", kind: "app", blurb: "What every machine gets" },
  { key: "Agents", kind: "app", blurb: "DE and vendor agents on each machine" },
  { key: "Line-of-business", kind: "app", blurb: "The client's own business software" },
] as const;

export type ShelfCategory = (typeof SHELF_CATEGORIES)[number]["key"];

const platformVendor = (platform: string) =>
  platform.startsWith("microsoft") ? "Microsoft" : platform.startsWith("google") ? "Google" : "Zoho";

const STARTER: ShelfEntry[] = [
  // Security and identity: the vendors DE already deploys (desktop agents, lifecycle).
  { key: "starter:jumpcloud-platform", kind: "license", vendor: "JumpCloud", product: "JumpCloud Platform", category: "Identity & devices", source: "starter" },
  { key: "starter:coro", kind: "license", vendor: "Coro", product: "Coro Cybersecurity", category: "Security", source: "starter" },
  { key: "starter:blackpoint-mdr", kind: "license", vendor: "Blackpoint", product: "Blackpoint MDR", category: "Security", source: "starter" },
  { key: "starter:defender-business", kind: "license", vendor: "Microsoft", product: "Microsoft Defender for Business", category: "Security", source: "starter" },
  { key: "starter:entra-p1", kind: "license", vendor: "Microsoft", product: "Microsoft Entra ID P1", category: "Identity & devices", source: "starter" },
  { key: "starter:intune-p1", kind: "license", vendor: "Microsoft", product: "Microsoft Intune Plan 1", category: "Identity & devices", source: "starter" },
  { key: "starter:cytracom-seat", kind: "license", vendor: "Cytracom", product: "Cytracom phone seat", category: "Voice", source: "starter" },
  { key: "starter:adobe-acrobat-pro", kind: "license", vendor: "Adobe", product: "Adobe Acrobat Pro", category: "Productivity", source: "starter" },

  // Baseline apps: Chocolatey community package ids.
  { key: "starter:adobereader", kind: "app", vendor: "Adobe", product: "Adobe Acrobat Reader", category: "Baseline apps", chocoPackage: "adobereader", source: "starter" },
  { key: "starter:7zip", kind: "app", vendor: "Igor Pavlov", product: "7-Zip", category: "Baseline apps", chocoPackage: "7zip", source: "starter" },
  { key: "starter:googlechrome", kind: "app", vendor: "Google", product: "Google Chrome", category: "Baseline apps", chocoPackage: "googlechrome", source: "starter" },
  { key: "starter:firefox", kind: "app", vendor: "Mozilla", product: "Mozilla Firefox", category: "Baseline apps", chocoPackage: "firefox", source: "starter" },
  { key: "starter:office365business", kind: "app", vendor: "Microsoft", product: "Microsoft 365 Apps", category: "Baseline apps", chocoPackage: "office365business", source: "starter" },
  { key: "starter:teams", kind: "app", vendor: "Microsoft", product: "Microsoft Teams", category: "Baseline apps", source: "starter" },
  { key: "starter:zoom", kind: "app", vendor: "Zoom", product: "Zoom Workplace", category: "Baseline apps", chocoPackage: "zoom", source: "starter" },
  { key: "starter:notepadplusplus", kind: "app", vendor: "Notepad++", product: "Notepad++", category: "Baseline apps", chocoPackage: "notepadplusplus", source: "starter" },
  { key: "starter:vlc", kind: "app", vendor: "VideoLAN", product: "VLC media player", category: "Baseline apps", chocoPackage: "vlc", source: "starter" },

  // Agents.
  { key: "starter:agent-jumpcloud", kind: "app", vendor: "JumpCloud", product: "JumpCloud Agent", category: "Agents", source: "starter" },
  { key: "starter:agent-de", kind: "app", vendor: "Digerati Experts", product: "DE Desktop Agent", category: "Agents", source: "starter" },
  { key: "starter:agent-coro", kind: "app", vendor: "Coro", product: "Coro Agent", category: "Agents", source: "starter" },
  { key: "starter:agent-blackpoint", kind: "app", vendor: "Blackpoint", product: "Blackpoint Agent", category: "Agents", source: "starter" },
];

/** The licensing catalog as shelf entries (all Productivity). */
export function catalogShelf(): ShelfEntry[] {
  return LICENSE_CATALOG.map((c) => ({
    key: `catalog:${c.key}`,
    kind: "license" as const,
    vendor: platformVendor(c.platform),
    product: c.name,
    category: "Productivity" as const,
    catalogKey: c.key,
    source: "catalog" as const,
  }));
}

/** Hub staff-catalog rows ({ sku, name, category }) as shelf entries. */
export function hubShelf(skus: unknown): ShelfEntry[] {
  if (!Array.isArray(skus)) return [];
  const out: ShelfEntry[] = [];
  for (const row of skus) {
    const r = row as { sku?: unknown; name?: unknown; category?: unknown; vendor?: unknown };
    const sku = typeof r.sku === "string" ? r.sku.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!sku || !name) continue;
    out.push({
      key: `hub:${sku}`,
      kind: "license",
      vendor: typeof r.vendor === "string" && r.vendor.trim() ? r.vendor.trim() : typeof r.category === "string" ? r.category : "Hub",
      product: name,
      category: "Hub SKUs",
      sku,
      source: "hub",
    });
  }
  return out;
}

export function starterShelf(): ShelfEntry[] {
  return STARTER;
}

