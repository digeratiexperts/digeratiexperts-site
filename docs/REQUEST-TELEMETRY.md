# Request telemetry adapter — implementation and integration

Status: adapter implemented; NOT MOUNTED. Owner: Codex. Lead website integrator: Claude Code.
Coordination: issue #442. Starting main: 48f956fd2000eef78ce701b4cd811c1913f33e60.
Canonical envelope: Intelligence-Hub docs/architecture/APPLICATION-TELEMETRY-CONTRACT.md, proposed in Hub PR #344.

## What this code does
server/requestTelemetry.ts emits one bounded completion event for a request when mounted.
Each request gets a fresh server-generated X-Request-ID; caller-supplied identifiers are not trusted.
It uses a monotonic clock for elapsed duration. A disconnect before finish is aborted with a null HTTP status.
Logging failures cannot propagate into the request workflow.

Application classification is a low-cardinality path-prefix map:
- portal: /portal and /api/portal, including descendants
- store: /store, /api/store, /internal/warehouse, /api/internal/warehouse and the exact Zoho payment webhook
- website: everything else

Path classification does not serialize the supplied path. This is not a complete workflow classifier; extend it with tests when actual route inventory warrants it. Express route templates are router-local and may be unmatched for static middleware. Do not reconstruct full routes with req.baseUrl: mounted parameters can carry actual identifiers.

## Mounting — reconcile with open PR #406
The active coordination law prevents this slice from editing server/index.ts while #406 owns an open change there. This adapter is deliberately unmounted until the lead integrator reconciles the following small patch with #406's release-identity change.

Add:
```ts
import { requestTelemetry } from "./requestTelemetry";
```

Replace the entire incoming request-URL logger (the middleware containing req.originalUrl.replace) with the new middleware, before handlers and parsers:
```ts
app.use(requestTelemetry({
  info: (event, message) => console.info(JSON.stringify({ level: "info", message, ...event })),
  warn: (event, message) => console.warn(JSON.stringify({ level: "warn", message, ...event })),
  error: (event, message) => console.error(JSON.stringify({ level: "error", message, ...event })),
}, {
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.RELEASE_SHA,
}));
```

This slice takes only a validated configured commit SHA. Missing or invalid means null, never inferred from uptime.
PR #406 reads the deploy-written release.txt: after reconciliation use its validated commit value, or have deployment supply RELEASE_SHA. Do not hard-code a source SHA. Recheck #406's actual exported API before using it.

The middleware sets a response header before downstream handlers. Do not mount after headers may already have been sent.

## Privacy boundaries and scope
New events contain no headers, cookies, bearer tokens, query strings, raw URL paths, form contents, payment details, client/account IDs, email addresses or raw errors.
Existing console/security/webhook logs are NOT automatically sanitized by adding this middleware. Audit them separately.
No browser beacon endpoint, external collector, session replay, paid service, business-event change or new DB table is included.
The generated ID correlates only one request today. Trusted signed cross-service correlation is an outstanding slice; this is not distributed tracing.

## Verification and release
Run:
- npm run test -- server/requestTelemetry.test.ts
- npm run check
- npm run test
- npm run build
- npm run check:active-work

Then exercise actual Express requests after mounting: 2xx, 4xx, 5xx, static path, mounted router, malformed JSON and disconnect. Verify one event, matching response ID and absence of secrets/possession keys in captured logs.
The adapter's five focused tests also ran locally through Node 24 native TypeScript with the node:test runner; this does not replace the repository's gates.
No rendered product UI changes in this slice.
Do not call telemetry active until the mounting change is reviewed, deployed and verified. The website runtime is unchanged by this adapter-only PR.
