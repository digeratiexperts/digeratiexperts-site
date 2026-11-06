import { execFileSync } from "child_process";
import { constants, createHash, verify, X509Certificate } from "crypto";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Microsoft Graph certificate auth (docs/runbooks/msgraph-certificate-auth.md):
 * the certificate is used whenever it is configured, the client secret is the
 * unchanged fallback with a health warning, and a broken certificate fails
 * closed instead of quietly using the secret.
 */

const dir = mkdtempSync(join(tmpdir(), "msgraph-cert-"));
function makeCert(name: string) {
  const key = join(dir, `${name}.key`);
  const cert = join(dir, `${name}.pem`);
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "2", "-subj", `/CN=${name}`], { stdio: "ignore" });
  return { key, cert };
}
const good = makeCert("de-graph-test");
const other = makeCert("de-graph-other");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const VARS = [
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
  "MS_GRAPH_CERT",
  "MS_GRAPH_CERT_PATH",
  "MS_GRAPH_CERT_PRIVATE_KEY",
  "MS_GRAPH_CERT_PRIVATE_KEY_PATH",
  "MS_GRAPH_GOV_CLIENT_ID",
  "MS_GRAPH_GOV_CLIENT_SECRET",
  "MS_GRAPH_GOV_CERT_PATH",
  "MS_GRAPH_GOV_CERT_PRIVATE_KEY_PATH",
];

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = String(url).includes("/oauth2/")
      ? { access_token: "tok", expires_in: 3600 }
      : { value: [] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const v of VARS) delete process.env[v];
});

const form = (c: Call) => new URLSearchParams(String(c.init.body));
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("Microsoft Graph auth mode", () => {
  it("keeps the client-secret request exactly as before when no certificate is set, and warns in health", async () => {
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CLIENT_SECRET = "s3cret-value";
    const ms = await import("./msGraph");
    expect(await ms.msSubscribedSkus("acme.onmicrosoft.com", "commercial")).toEqual({ ok: true, skus: [] });
    expect(calls[0].url).toBe("https://login.microsoftonline.com/acme.onmicrosoft.com/oauth2/v2.0/token");
    expect(String(calls[0].init.body)).toBe(
      "client_id=app&client_secret=s3cret-value&grant_type=client_credentials&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default",
    );
    const health = ms.msGraphHealth();
    expect(health.commercial).toEqual({ authMode: "secret", warning: ms.MS_GRAPH_SECRET_WARNING });
    expect(health.gccHigh).toEqual({ authMode: "not_configured" });
    expect(JSON.stringify(health)).not.toContain("s3cret-value");
  });

  it("signs a PS256 client assertion with the certificate and sends no secret", async () => {
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CLIENT_SECRET = "s3cret-value"; // still set: the certificate wins
    process.env.MS_GRAPH_CERT_PATH = good.cert;
    process.env.MS_GRAPH_CERT_PRIVATE_KEY_PATH = good.key;
    const ms = await import("./msGraph");
    expect(ms.msGraphConfigured("commercial")).toBe(true);
    expect(ms.msGraphAuthHealth("commercial")).toEqual({ authMode: "certificate" });

    expect(await ms.msSubscribedSkus("acme.onmicrosoft.com", "gcc")).toMatchObject({ ok: true });
    const tokenUrl = "https://login.microsoftonline.com/acme.onmicrosoft.com/oauth2/v2.0/token";
    expect(calls[0].url).toBe(tokenUrl);
    const f = form(calls[0]);
    expect([...f.keys()]).toEqual(["client_id", "client_assertion_type", "client_assertion", "grant_type", "scope"]);
    expect(f.get("client_secret")).toBeNull();
    expect(String(calls[0].init.body)).not.toContain("s3cret-value");
    expect(f.get("client_assertion_type")).toBe("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    expect(f.get("grant_type")).toBe("client_credentials");
    expect(f.get("scope")).toBe("https://graph.microsoft.com/.default");

    const [h, p, s] = f.get("client_assertion")!.split(".");
    const x509 = new X509Certificate(readFileSync(good.cert));
    expect(decode(h)).toEqual({ alg: "PS256", typ: "JWT", "x5t#S256": createHash("sha256").update(x509.raw).digest("base64url") });
    const claims = decode(p);
    expect(claims).toMatchObject({ aud: tokenUrl, iss: "app", sub: "app" });
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(claims.exp - claims.nbf).toBe(600);
    expect(Math.abs(claims.nbf - Date.now() / 1000)).toBeLessThan(5);
    const signedOk = verify(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key: x509.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST },
      Buffer.from(s, "base64url"),
    );
    expect(signedOk).toBe(true);
  });

  it("accepts inline PEMs with literal \\n, and GCC High uses its own certificate settings", async () => {
    process.env.MS_GRAPH_GOV_CLIENT_ID = "gov-app";
    process.env.MS_GRAPH_GOV_CERT_PATH = good.cert;
    process.env.MS_GRAPH_GOV_CERT_PRIVATE_KEY_PATH = good.key;
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CERT = readFileSync(good.cert, "utf8").replace(/\n/g, "\\n");
    process.env.MS_GRAPH_CERT_PRIVATE_KEY = readFileSync(good.key, "utf8").replace(/\n/g, "\\n");
    const ms = await import("./msGraph");
    expect(ms.msGraphHealth()).toEqual({ commercial: { authMode: "certificate" }, gccHigh: { authMode: "certificate" } });
    expect(await ms.msSubscribedSkus("acme.onmicrosoft.us", "gcc_high")).toMatchObject({ ok: true });
    expect(calls[0].url).toBe("https://login.microsoftonline.us/acme.onmicrosoft.us/oauth2/v2.0/token");
    const claims = decode(form(calls[0]).get("client_assertion")!.split(".")[1]);
    expect(claims).toMatchObject({ iss: "gov-app", aud: calls[0].url });
  });

  it("fails closed on an unreadable certificate setting instead of using the secret", async () => {
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CLIENT_SECRET = "s3cret-value";
    process.env.MS_GRAPH_CERT_PATH = good.cert;
    process.env.MS_GRAPH_CERT_PRIVATE_KEY_PATH = join(dir, "missing.key");
    const ms = await import("./msGraph");
    expect(ms.msGraphAuthHealth("commercial")).toEqual({
      authMode: "invalid",
      error: "MS_GRAPH_CERT_PRIVATE_KEY_PATH could not be read",
    });
    expect(await ms.msAssignLicense("acme.onmicrosoft.com", "commercial", "a@acme.test", "sku")).toEqual({
      ok: false,
      error: "MS_GRAPH_CERT_PRIVATE_KEY_PATH could not be read",
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects a key that does not match the certificate, and a half-set certificate", async () => {
    process.env.MS_GRAPH_CLIENT_ID = "app";
    process.env.MS_GRAPH_CERT_PATH = good.cert;
    process.env.MS_GRAPH_CERT_PRIVATE_KEY_PATH = other.key;
    let ms = await import("./msGraph");
    expect(ms.msGraphAuthHealth("commercial")).toMatchObject({ authMode: "invalid", error: "The Graph private key does not match the certificate" });

    delete process.env.MS_GRAPH_CERT_PRIVATE_KEY_PATH;
    vi.resetModules();
    ms = await import("./msGraph");
    expect(ms.msGraphAuthHealth("commercial")).toMatchObject({ authMode: "invalid", error: "MS_GRAPH_CERT_PRIVATE_KEY or MS_GRAPH_CERT_PRIVATE_KEY_PATH is required with the certificate" });
    expect(await ms.msSubscribedSkus("acme.onmicrosoft.com", "commercial")).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
  });
});
