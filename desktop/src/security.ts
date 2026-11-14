export const DESKTOP_PROTOCOL = "digeratiexperts:";
export const DEFAULT_PORTAL_ORIGIN = "https://portal.digeratiexperts.com";

export const PORTAL_DESTINATIONS = {
  dashboard: "/portal/dashboard",
  desk: "/portal/chat",
  knowledge: "/portal/kb",
  tickets: "/portal/tickets",
  newTicket: "/portal/tickets/create",
  account: "/portal/settings",
  agents: "/portal/agent",
  paperwork: "/portal/forms",
} as const;

export type PortalDestination = keyof typeof PORTAL_DESTINATIONS;

export const DESKTOP_NOTIFICATION_EVENTS = {
  ticketUpdated: {
    title: "DE Portal update",
    body: "A support ticket has an update.",
    destination: "tickets",
  },
  approvalRequired: {
    title: "DE Portal action required",
    body: "An approval is waiting for you.",
    destination: "dashboard",
  },
  supportReply: {
    title: "DE Desk reply",
    body: "A support specialist replied in DE Desk.",
    destination: "desk",
  },
  securityActionRequired: {
    title: "DE security action required",
    body: "Open the DE Portal to review a security action.",
    destination: "dashboard",
  },
} as const satisfies Record<
  string,
  { title: string; body: string; destination: PortalDestination }
>;

export type DesktopNotificationEvent = keyof typeof DESKTOP_NOTIFICATION_EVENTS;

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isRendererPermissionAllowed(): false {
  return false;
}

export function isDownloadAllowed(): false {
  return false;
}

export function resolvePortalOrigin(rawOrigin: string, development: boolean): URL {
  const parsed = new URL(rawOrigin);
  const secure = parsed.protocol === "https:";
  const permittedDevelopmentOrigin = development && parsed.protocol === "http:" && isLoopback(parsed.hostname);

  if (!secure && !permittedDevelopmentOrigin) {
    throw new Error("DE_PORTAL_ORIGIN must use HTTPS, except for a loopback development server");
  }
  if (parsed.username || parsed.password) {
    throw new Error("DE_PORTAL_ORIGIN must not contain credentials");
  }

  return new URL(parsed.origin);
}

export function portalUrl(origin: URL, destination: PortalDestination): string {
  return new URL(PORTAL_DESTINATIONS[destination], origin).toString();
}

export function isAllowedPortalUrl(candidate: string, origin: URL): boolean {
  try {
    const parsed = new URL(candidate);
    const portalPath = parsed.pathname === "/portal" || parsed.pathname.startsWith("/portal/");
    return (
      parsed.origin === origin.origin &&
      (parsed.protocol === "https:" || isLoopback(parsed.hostname)) &&
      portalPath
    );
  } catch {
    return false;
  }
}

export function parseDeepLink(value: string): PortalDestination | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== DESKTOP_PROTOCOL || parsed.username || parsed.password) return null;

    const route = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, "");
    if (!route) return "dashboard";

    const match = route.match(/^open\/([A-Za-z]+)$/);
    if (!match) return null;
    const destination = match[1] as PortalDestination;
    return Object.hasOwn(PORTAL_DESTINATIONS, destination) ? destination : null;
  } catch {
    return null;
  }
}
