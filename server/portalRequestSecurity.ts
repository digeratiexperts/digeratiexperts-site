const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RAW_TICKET_ATTACHMENT_PATH = /^\/api\/portal\/tickets\/[^/]+\/attachments\/?$/;
const RAW_TICKET_ATTACHMENT_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

type PortalRequestSecurityResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_origin"
        | "untrusted_origin"
        | "cross_origin_request"
        | "invalid_content_type";
    };

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function normalizedHost(value: string): string | null {
  try {
    return new URL(`http://${value}`).host.toLowerCase();
  } catch {
    return null;
  }
}

export function configuredPortalOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const origins = new Set<string>();
  const candidates = [
    env.PORTAL_BASE_URL,
    env.PORTAL_ORIGIN,
    env.PORTAL_DOMAIN ? `https://${env.PORTAL_DOMAIN}` : undefined,
    "https://portal.digeratiexperts.com",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const origin = normalizedOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function validatePortalRequestSecurity(input: {
  method: string;
  origin?: string;
  referer?: string;
  host: string;
  protocol: string;
  path: string;
  contentType?: string;
  contentLength?: string;
  allowedOrigins: ReadonlySet<string>;
}): PortalRequestSecurityResult {
  const method = input.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return { ok: true };

  const source = input.origin || input.referer;
  if (!source) return { ok: false, reason: "missing_origin" };
  const sourceOrigin = normalizedOrigin(source);
  if (!sourceOrigin || !input.allowedOrigins.has(sourceOrigin)) {
    return { ok: false, reason: "untrusted_origin" };
  }

  // TLS normally terminates at the production reverse proxy, so Express can
  // observe an internal http protocol even for a genuine https browser request.
  // The source origin is already required to match the configured allow-list;
  // exact host matching keeps sibling origins out without trusting proxy headers.
  const requestHost = normalizedHost(input.host);
  const sourceHost = new URL(sourceOrigin).host.toLowerCase();
  if (!requestHost || sourceHost !== requestHost) {
    return { ok: false, reason: "cross_origin_request" };
  }

  const contentType = (input.contentType || "").split(";", 1)[0].trim().toLowerCase();
  const contentLength = Number(input.contentLength || "0");
  const hasBody = contentLength > 0 || Boolean(contentType);
  const isJson = contentType === "application/json" || contentType.endsWith("+json");
  const isValidatedRawTicketAttachment =
    method === "POST" &&
    RAW_TICKET_ATTACHMENT_PATH.test(input.path) &&
    RAW_TICKET_ATTACHMENT_CONTENT_TYPES.has(contentType);
  if (hasBody && !isJson && !isValidatedRawTicketAttachment) {
    return { ok: false, reason: "invalid_content_type" };
  }

  return { ok: true };
}
