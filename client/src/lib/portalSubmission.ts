// One binding per document. Background reads can observe a different session,
// but only the explicit same-account reauthentication flow may adopt it.
const sessionReads = new Set(["/api/portal/me", "/api/internal/warehouse/session"]);
const validDigest = /^[0-9a-f]{64}$/;
type Binding = { token: string; context: string };

function readBinding(response: Response): Binding | undefined {
  const token = response.headers.get("X-DE-CSRF-Token") ?? "";
  const context = response.headers.get("X-DE-CSRF-Context") ?? "";
  if (response.ok && validDigest.test(token) && validDigest.test(context)) return { token, context };
}

export class PortalSubmissions {
  private binding?: Binding;
  private pending?: Promise<Response>;
  private recovering = false;

  constructor(
    private readonly send: typeof fetch,
    private readonly origin: string,
    private readonly base: () => string,
    private readonly onMismatch: () => void,
  ) {}

  private readSession(input: RequestInfo | URL, init: RequestInit, headers: Headers) {
    headers.set("X-DE-CSRF-Request", "1");
    const result = this.send(input, { ...init, headers, cache: "no-store", mode: "same-origin", redirect: "error" })
      .then(response => {
        const current = readBinding(response);
        if (!this.recovering && current) {
          if (this.binding && (this.binding.token !== current.token || this.binding.context !== current.context)) {
            // Concurrent view reads can complete out of order. Suspend this
            // document if they resolve to different authorities.
            this.recovering = true;
          } else {
            this.binding = current;
          }
        }
        return response;
      });
    this.pending = result;
    const clear = () => { if (this.pending === result) this.pending = undefined; };
    void result.then(clear, clear);
    return result;
  }

  readForRecovery() {
    // Verification must not install a first binding before the caller checks
    // the user. A document with no original authority cannot resume a draft.
    this.recovering = true;
    return this.readSession(new URL("/api/portal/me", this.origin), { credentials: "same-origin" }, new Headers());
  }

  resume(response: Response) {
    const renewed = readBinding(response);
    if (!renewed || !this.binding || renewed.context !== this.binding.context) {
      throw new Error("Verify the same account and company with the original access. If your access changed, return to the draft to copy it before reloading.");
    }
    this.binding = renewed;
    this.recovering = false;
  }

  fetch: typeof fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input), this.base());
    const credentials = init.credentials ?? request?.credentials;
    const method = (init.method ?? request?.method ?? "GET").toUpperCase();
    if (url.origin !== this.origin || !/^\/api\//i.test(url.pathname)
      || credentials === "omit" || (init.mode ?? request?.mode) === "no-cors") {
      return this.send(input, init);
    }
    const target = request ?? url.href;
    const headers = new Headers(init.headers ?? request?.headers);
    if (method === "GET" && sessionReads.has(url.pathname)) return this.readSession(target, init, headers);
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return this.send(input, init);

    // Authorization follows the identity read that opened the view. A write
    // must never fetch a fresh identity after another tab changed the cookie.
    if (!this.binding && this.pending) await this.pending.catch(() => undefined);
    const cookieSession = !!this.binding || this.recovering;
    if (cookieSession) {
      // A missing cookie must not change an open document into a bearer client.
      headers.set("X-DE-CSRF-Session", "cookie");
      if (this.binding && !this.recovering) headers.set("X-CSRF-Token", this.binding.token);
      else headers.delete("X-CSRF-Token");
    }
    const response = cookieSession
      ? await this.send(target, { ...init, headers, mode: "same-origin", redirect: "error" })
      : await this.send(target, init);
    if (response.status === 403 && response.headers.get("X-DE-CSRF-Status") === "mismatch") {
      this.recovering = true;
      this.onMismatch();
    }
    return response;
  };
}

let submissions: PortalSubmissions | undefined;

export function installPortalSubmissions() {
  if (submissions) return;
  submissions = new PortalSubmissions(window.fetch.bind(window), window.location.origin, () => document.baseURI,
    () => window.dispatchEvent(new CustomEvent("de-portal-session-expired")));
  window.fetch = submissions.fetch;
}

export function readPortalSessionForRecovery() {
  if (!submissions) throw new Error("Reload the portal to verify this session.");
  return submissions.readForRecovery();
}

export function resumeVerifiedPortalSubmission(response: Response) {
  if (!submissions) throw new Error("Reload the portal to verify this session.");
  submissions.resume(response);
}
