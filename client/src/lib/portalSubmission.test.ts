import { describe, expect, it, vi } from "vitest";
import { PortalSubmissions } from "./portalSubmission";

const origin = "https://portal.test";
const me = "/api/portal/me";
const ticket = "/api/portal/tickets";
const token = "a".repeat(64);
const fresh = "b".repeat(64);
const context = "c".repeat(64);
const proof = (value = token, scope = context) => Response.json({ user: { id: "tech-a" } }, {
  headers: { "X-DE-CSRF-Token": value, "X-DE-CSRF-Context": scope },
});
const refused = () => Response.json({ code: "CSRF_TOKEN_MISMATCH" }, {
  status: 403, headers: { "X-DE-CSRF-Status": "mismatch" },
});

function fixture(base = origin + "/portal/") {
  const send = vi.fn<typeof fetch>();
  const changed = vi.fn();
  const session = new PortalSubmissions(send, origin, () => base, changed);
  const header = (i: number, key = "X-CSRF-Token") => new Headers(send.mock.calls[i][1]?.headers).get(key);
  return { session, send, changed, header };
}

describe("Portal browser submissions", () => {
  it("pins the grant on the regular /me read and replaces the legacy header on a raw request", async () => {
    const { session, send, header } = fixture();
    send.mockResolvedValueOnce(proof()).mockResolvedValueOnce(new Response());
    await session.fetch(me, { credentials: "include" });
    const upload = new FormData();
    upload.set("file", new Blob(["test"]), "sample.txt");
    const request = new Request(origin + ticket + "/T-1/attachments", {
      method: "POST", headers: { "X-CSRF-Token": "1" }, body: upload,
    });
    await session.fetch(request);
    expect(header(0, "X-DE-CSRF-Request")).toBe("1");
    expect(send.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error", mode: "same-origin" });
    expect(header(1)).toBe(token);
    expect(send.mock.calls[1][0]).toBe(request);
    expect((await request.formData()).get("file")).toBeDefined();
    expect(header(1, "Content-Type")).toMatch(/^multipart\/form-data; boundary=/);
    expect(send.mock.calls[1][1]).toMatchObject({ redirect: "error", mode: "same-origin" });
  });

  it("waits for the view’s in-flight identity read before independent Portal and integration actions", async () => {
    const { session, send, header } = fixture();
    let finish!: (response: Response) => void;
    send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(new Response());
    const opening = session.fetch(me);
    const write = session.fetch(ticket, { method: "POST" });
    const other = session.fetch("/api/integrations/retry", { method: "PATCH" });
    expect(send).toHaveBeenCalledTimes(1);
    finish(proof());
    await Promise.all([opening, write, other]);
    expect(send).toHaveBeenCalledTimes(3);
    expect(header(1)).toBe(token);
    expect(header(2)).toBe(token);
  });

  it("keeps a stale tab pinned until explicit reauthentication for its original company", async () => {
    const { session, send, header, changed } = fixture();
    send.mockResolvedValueOnce(proof()).mockResolvedValueOnce(proof(fresh))
      .mockResolvedValueOnce(refused()).mockResolvedValueOnce(new Response());
    await session.fetch(me);
    const renewed = await session.fetch(me);
    const result = await session.fetch(ticket, { method: "POST" });
    expect(result.status).toBe(403);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(3);
    expect(header(2)).toBeNull();
    expect(() => session.resume(proof(fresh, "d".repeat(64)))).toThrow(/same account and company/);
    expect(() => session.resume(new Response())).toThrow();
    session.resume(renewed);
    expect(send).toHaveBeenCalledTimes(3);
    await session.fetch(ticket, { method: "POST" });
    expect(header(3)).toBe(fresh);
  });

  it("passes external URLs, external document bases, unrelated paths, safe reads and credentialless calls through", async () => {
    const { session, send, header } = fixture("https://other.test/base/");
    send.mockResolvedValueOnce(proof()).mockResolvedValue(new Response());
    await session.fetch(origin + me);
    await session.fetch("//other.test/api/portal/tickets", { method: "POST" });
    await session.fetch("relative", { method: "PATCH" });
    await session.fetch(origin + "/collector", { method: "POST" });
    await session.fetch(origin + ticket, { credentials: "omit", method: "POST" });
    await session.fetch(origin + ticket, { method: "HEAD" });
    expect(send).toHaveBeenCalledTimes(6);
    for (let i = 1; i < 6; i++) expect(header(i)).toBeNull();
  });

  it("does not look up identity on submission, including an anonymous form or unverified private view", async () => {
    const { session, send, header } = fixture();
    send.mockResolvedValueOnce(new Response()).mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(proof("1")).mockResolvedValueOnce(refused());
    await session.fetch("/api/portal/login", { method: "POST" });
    await session.fetch(ticket, { method: "POST" });
    await session.fetch(me);
    await session.fetch(ticket, { method: "POST" });
    expect(send).toHaveBeenCalledTimes(4);
    for (const i of [0, 1, 3]) expect(header(i)).toBeNull();
  });

  it("keeps a previously unbound draft locked when another account verifies or a background read succeeds", async () => {
    const { session, send, header } = fixture();
    send.mockResolvedValueOnce(refused()).mockResolvedValueOnce(proof(fresh))
      .mockResolvedValueOnce(proof(fresh)).mockResolvedValueOnce(refused());
    await session.fetch(ticket, { method: "POST" });
    const candidate = await session.readForRecovery();
    expect(() => session.resume(candidate)).toThrow(/original access/);
    await session.fetch(me);
    await session.fetch(ticket, { method: "POST" });
    expect(header(3)).toBeNull();
  });

  it("pins the warehouse entry session even when the cookie changes before its first stock write", async () => {
    const { session, send, header, changed } = fixture();
    send.mockResolvedValueOnce(proof()).mockResolvedValueOnce(proof(fresh, "d".repeat(64)))
      .mockResolvedValueOnce(refused());
    await session.fetch("/api/internal/warehouse/session");
    await session.fetch("/api/internal/warehouse/session");
    const result = await session.fetch("/api/internal/warehouse/stock/receive", { method: "POST" });
    expect(header(0, "X-DE-CSRF-Request")).toBe("1");
    expect(header(2)).toBeNull();
    expect(result.status).toBe(403);
    expect(changed).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(3);
  });
});
