import { randomUUID } from "node:crypto";

type RequestLike = { method: string; path?: string; route?: { path?: unknown } };
type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  once(event: "finish" | "close", callback: () => void): unknown;
};
type Sink = { info(event: object, message: string): unknown; warn(event: object, message: string): unknown; error(event: object, message: string): unknown };

/** Classification only: the supplied path is never emitted. */
export function applicationForPath(path: string | undefined): "website" | "store" | "portal" {
  const under = (prefix: string) => path === prefix || path?.startsWith(prefix + "/") === true;
  if (under("/portal") || under("/api/portal")) return "portal";
  if (under("/store") || under("/api/store") || under("/internal/warehouse") ||
      under("/api/internal/warehouse") || path === "/api/webhooks/zoho-payments") return "store";
  return "website";
}

export function releaseIdentity(value: string | undefined): string | null {
  return value && /^[a-f0-9]{7,40}$/i.test(value) ? value.toLowerCase() : null;
}

/** Only registered route templates; never originalUrl, query, body or headers. */
export function routeTemplate(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") &&
    value.length <= 256 && !/[?#\r\n]/.test(value) ? value : "unmatched";
}

export function requestTelemetry(sink: Sink, config: { environment: string; release: string | undefined }) {
  const environment = ["production", "development", "test"].includes(config.environment)
    ? config.environment : "unknown";
  const release = releaseIdentity(config.release);
  return (req: RequestLike, res: ResponseLike, next: () => void) => {
    const requestId = randomUUID();
    const start = performance.now();
    let recorded = false;
    res.setHeader("X-Request-ID", requestId);
    const record = (aborted: boolean) => {
      if (recorded) return;
      recorded = true;
      const event = {
        schemaVersion: 1,
        event: "http.request.completed",
        application: applicationForPath(req.path),
        environment,
        release,
        timestamp: new Date().toISOString(),
        requestId,
        method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(req.method) ? req.method : "OTHER",
        route: routeTemplate(req.route?.path),
        statusCode: aborted ? null : res.statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - start)),
        outcome: aborted ? "aborted" : res.statusCode >= 400 ? "failure" : "success",
      };
      // Observability failures must not interrupt application responses.
      try {
        if (!aborted && res.statusCode >= 500) sink.error(event, "Request telemetry");
        else if (aborted || res.statusCode >= 400) sink.warn(event, "Request telemetry");
        else sink.info(event, "Request telemetry");
      } catch { /* isolated from business workflows */ }
    };
    res.once("finish", () => record(false));
    res.once("close", () => record(true));
    next();
  };
}
