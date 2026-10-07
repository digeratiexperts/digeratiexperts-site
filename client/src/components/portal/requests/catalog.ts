import { TYPE_ROUTES } from "@shared/serviceRequests";

/**
 * Portal self-service catalog: every request or action a client can start,
 * for the Self-Service home (search, Recommended, favourites). Each entry
 * points at a real portal route. Ids for the two service request forms equal
 * their request types so favourites set on the form pages show up here.
 */

export type CatalogItem = {
  id: string;
  title: string;
  blurb: string;
  href: string;
  /** lucide icon name, resolved by the page */
  icon: "laptop" | "return" | "key" | "monitor" | "user-plus" | "wrench" | "server" | "cart" | "license";
  keywords: string[];
};

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: "loaner_computer",
    title: "Request Loaner Computer",
    blurb: "Borrow a laptop or desktop for a limited time.",
    href: TYPE_ROUTES.loaner_computer,
    icon: "laptop",
    keywords: ["loaner", "laptop", "desktop", "borrow", "temporary", "computer", "repair"],
  },
  {
    id: "return_computer",
    title: "Return Computer",
    blurb: "Send a computer back to the IT stockroom or for disposal.",
    href: TYPE_ROUTES.return_computer,
    icon: "return",
    keywords: ["return", "leaving", "offboarding", "dispose", "computer", "laptop", "pickup"],
  },
  {
    id: "license_request",
    title: "Request a Software License",
    blurb: "Microsoft 365, Google Workspace or Zoho licences and add-ons like Visio or Project.",
    href: TYPE_ROUTES.license_request,
    icon: "license",
    keywords: ["license", "licence", "microsoft 365", "office", "e5", "e3", "f3", "g5", "google workspace", "zoho", "visio", "project", "power bi", "copilot"],
  },
  {
    id: "form-access",
    title: "Access Request",
    blurb: "Ask for access to a system, mailbox, share or application.",
    href: "/portal/forms",
    icon: "key",
    keywords: ["access", "permission", "account", "mailbox", "share", "application", "login"],
  },
  {
    id: "form-device",
    title: "Device Request",
    blurb: "Request a new device, phone or accessory.",
    href: "/portal/forms",
    icon: "monitor",
    keywords: ["device", "new laptop", "phone", "monitor", "accessory", "hardware"],
  },
  {
    id: "form-onboarding",
    title: "New Employee Onboarding",
    blurb: "Set up accounts and equipment for a new starter.",
    href: "/portal/forms",
    icon: "user-plus",
    keywords: ["onboarding", "new hire", "new employee", "starter", "accounts"],
  },
  {
    id: "report-issue",
    title: "Report an Issue",
    blurb: "Open a support ticket for a problem with hardware, software or access.",
    href: "/portal/tickets/create",
    icon: "wrench",
    keywords: ["issue", "problem", "broken", "error", "incident", "ticket", "help", "not working"],
  },
  {
    id: "infrastructure",
    title: "Report an Outage",
    blurb: "Tell us about a network, internet or server outage.",
    href: "/portal/infrastructure",
    icon: "server",
    keywords: ["outage", "down", "network", "internet", "server", "wifi", "infrastructure"],
  },
  {
    id: "it-shop",
    title: "Digital IT Shop",
    blurb: "Browse and order approved devices, accessories and software.",
    href: "/portal/procurement",
    icon: "cart",
    keywords: ["shop", "order", "buy", "software", "license", "hardware", "procurement"],
  },
];

export function searchCatalog(q: string): CatalogItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return CATALOG_ITEMS.filter(
    (i) => i.title.toLowerCase().includes(s) || i.blurb.toLowerCase().includes(s) || i.keywords.some((k) => k.includes(s) || s.includes(k)),
  );
}
