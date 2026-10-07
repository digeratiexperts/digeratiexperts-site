/**
 * Self-Service carousel slides. DE staff add company announcements as manual
 * records of kind "announcement"; the portal shows the active ones first,
 * then the built-in DE slides below. Links stay inside the portal: a slide
 * can never send a client to an outside site (the carousel teaches phishing
 * awareness, so it must not look like a phishing vector itself).
 */

export const ANNOUNCEMENT_ART = ["security", "loaner", "return", "status", "calendar", "general"] as const;
export type AnnouncementArt = (typeof ANNOUNCEMENT_ART)[number];

export type PortalAnnouncement = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  art: AnnouncementArt;
  /** "company" = entered by DE for this client; "de" = built-in. */
  source: "company" | "de";
};

/** Portal paths only: "/portal/..." with no scheme, host, protocol-relative or script tricks. */
export function isSafePortalHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const h = href.trim();
  return /^\/portal(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9\-_=&%.+]*)?(#[A-Za-z0-9\-_]*)?$/.test(h) && !h.startsWith("//");
}

/**
 * A staff-entered record → slide, or null when it is incomplete, outside its
 * date window or links outside the portal. Dates are YYYY-MM-DD, inclusive.
 */
export function announcementFromRecord(
  id: string,
  data: Record<string, unknown>,
  today: string,
): PortalAnnouncement | null {
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
  const body = typeof data.body === "string" ? data.body.trim().slice(0, 280) : "";
  const ctaLabel = typeof data.ctaLabel === "string" ? data.ctaLabel.trim().slice(0, 40) : "";
  const ctaHref = typeof data.ctaHref === "string" ? data.ctaHref.trim() : "";
  if (!title || !body || !ctaLabel || !isSafePortalHref(ctaHref)) return null;
  const startsOn = typeof data.startsOn === "string" ? data.startsOn : "";
  const endsOn = typeof data.endsOn === "string" ? data.endsOn : "";
  if (startsOn && today < startsOn) return null;
  if (endsOn && today > endsOn) return null;
  const art = (ANNOUNCEMENT_ART as readonly string[]).includes(String(data.art)) ? (data.art as AnnouncementArt) : "general";
  return { id, title, body, ctaLabel, ctaHref, art, source: "company" };
}

/** Built-in DE slides. Each states a fact about the portal and links to the real page. */
export function builtInAnnouncements(today: string): PortalAnnouncement[] {
  const slides: PortalAnnouncement[] = [];
  if (today.slice(5, 7) === "10") {
    slides.push({
      id: "de-cyber-awareness",
      title: "Cybersecurity Awareness Month",
      body: "This month we're focusing on how to spot suspicious messages and stay ahead of phishing attempts. If something looks off, report it before you click.",
      ctaLabel: "Tips to stay safe",
      ctaHref: "/portal/kb?q=security",
      art: "security",
      source: "de",
    });
  }
  slides.push(
    {
      id: "de-loaner",
      title: "Need a computer while yours is away?",
      body: "Request a loaner laptop or desktop for a set period, and follow it from request to return.",
      ctaLabel: "Request a loaner",
      ctaHref: "/portal/requests/loaner-computer",
      art: "loaner",
      source: "de",
    },
    {
      id: "de-return",
      title: "Someone leaving or replacing a computer?",
      body: "Send a computer back to the IT stockroom or for disposal, and choose where and when we pick it up.",
      ctaLabel: "Return a computer",
      ctaHref: "/portal/requests/return-computer",
      art: "return",
      source: "de",
    },
    {
      id: "de-status",
      title: "Is something down?",
      body: "Check live service status before you open a ticket, and report an outage if you're the first to notice.",
      ctaLabel: "View service status",
      ctaHref: "/portal/status",
      art: "status",
      source: "de",
    },
  );
  return slides;
}
