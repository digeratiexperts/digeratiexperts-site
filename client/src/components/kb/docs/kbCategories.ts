import type { LucideIcon } from "lucide-react";
import { BookOpen, KeyRound, Laptop, Mail, MonitorSmartphone, Network, Phone, Rocket, ShieldCheck, Ticket } from "lucide-react";
import { KB_CATEGORIES } from "@shared/kb";

/** Icon and a one-line scope for each knowledge-base category (portal index cards and the side tree). */
export const KB_CATEGORY_META: Record<string, { icon: LucideIcon; blurb: string }> = {
  "Getting started": { icon: Rocket, blurb: "First steps in the portal and how to reach DE." },
  "Access & accounts": { icon: KeyRound, blurb: "Sign-in, passwords, MFA and account access." },
  Licensing: { icon: Ticket, blurb: "Requesting and understanding software licences." },
  "Email & Microsoft 365": { icon: Mail, blurb: "Outlook, Teams and Microsoft 365 setup." },
  Security: { icon: ShieldCheck, blurb: "Phishing, MFA and keeping accounts safe." },
  Devices: { icon: Laptop, blurb: "Computers, phones and device enrollment." },
  "Network & VPN": { icon: Network, blurb: "Remote access to the office network." },
  Phones: { icon: Phone, blurb: "Business phone and softphone setup." },
  "Remote access": { icon: MonitorSmartphone, blurb: "Connecting to work computers from elsewhere." },
};

export function categoryIcon(category: string): LucideIcon {
  return KB_CATEGORY_META[category]?.icon ?? BookOpen;
}

/** Categories in the canonical order, then any others alphabetically. */
export function orderCategories(categories: Iterable<string>): string[] {
  const seen = new Set(categories);
  const known = KB_CATEGORIES.filter((c) => seen.has(c));
  const rest = Array.from(seen).filter((c) => c && !(KB_CATEGORIES as readonly string[]).includes(c)).sort((a, b) => a.localeCompare(b));
  return [...known, ...rest];
}

export type KbNavArticle = { number: string; title: string; category: string };

/** Articles grouped by category, categories in canonical order, articles by title. */
export function groupByCategory<T extends KbNavArticle>(articles: T[]): Array<{ category: string; articles: T[] }> {
  const map = new Map<string, T[]>();
  for (const a of articles) {
    const key = a.category || "Other";
    map.set(key, [...(map.get(key) ?? []), a]);
  }
  return orderCategories(map.keys()).map((category) => ({
    category,
    articles: [...(map.get(category) ?? [])].sort((x, y) => x.title.localeCompare(y.title)),
  }));
}
