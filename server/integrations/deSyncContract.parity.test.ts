import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
import { HUB_LICENSES_CONTRACT, HUB_LICENSES_PATH, hubLicenseItemSchema, hubLicensesProjectionSchema } from "./hubLicensesContract";
import {
  DE_SYNC_EVENT_TYPES,
  DE_SYNC_SOURCES,
  createDeSyncEnvelope,
} from "./deSyncContract";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "deSyncContract.fixture.json"), "utf8"),
) as {
  version: number;
  sources: string[];
  eventTypes: string[];
  envelopeFields: string[];
  identity: { canonicalAccountId: string; portalClientId: string };
  signing: {
    timestampSkewMs: number;
    sample: {
      method: string;
      path: string;
      timestamp: string;
      eventId: string;
      body: string;
      secret: string;
      signature: string;
    };
  };
  reads: {
    portalLicenses: {
      contract: string;
      direction: string;
      method: string;
      path: string;
      query: { required: string[]; optional: string[] };
      auth: { source: string; scopedSecretEnv: string; signsQuery: boolean; legacySecret: string };
      responseFields: string[];
      itemFields: string[];
      seatFields: string[];
      totalsFields: string[];
      kinds: string[];
      seatSources: string[];
      errors: Record<string, string>;
      signingSample: {
        method: string;
        path: string;
        timestamp: string;
        eventId: string;
        body: string;
        secret: string;
        signature: string;
      };
    };
  };
};

describe("de-sync contract parity", () => {
  it("keeps the shared event list and envelope fields", () => {
    expect(fixture.version).toBe(1);
    expect([...DE_SYNC_SOURCES]).toEqual(fixture.sources);
    expect([...DE_SYNC_EVENT_TYPES]).toEqual(fixture.eventTypes);
    expect(fixture.eventTypes).toHaveLength(47);
    const envelope = createDeSyncEnvelope({
      eventType: "lead.created",
      source: "website",
      entityType: "lead",
      entityId: "prospect-1",
      canonicalAccountId: "41",
      payload: { portalClientId: "prospect-1" },
    });
    expect(Object.keys(envelope).sort()).toEqual([...fixture.envelopeFields].sort());
    expect(fixture.identity.canonicalAccountId).toBe("envelope");
    expect(envelope.canonicalAccountId).toBe("41");
    expect(fixture.identity.portalClientId).toBe("payload");
    expect(envelope.payload.portalClientId).toBe("prospect-1");
  });

  it("signs the same canonical string the Hub verifies", () => {
    const sample = fixture.signing.sample;
    expect(fixture.signing.timestampSkewMs).toBe(5 * 60 * 1000);
    expect(
      signDeSyncRequest({
        method: sample.method,
        path: sample.path,
        timestamp: sample.timestamp,
        eventId: sample.eventId,
        body: sample.body,
        secret: sample.secret,
      }),
    ).toBe(sample.signature);
  });

  it("pins the Hub licences read (reads.portalLicenses, de.hub.licenses/v1)", () => {
    const read = fixture.reads.portalLicenses;
    expect(read.contract).toBe(HUB_LICENSES_CONTRACT);
    expect(read.direction).toBe("portal_to_hub");
    expect(read.method).toBe("GET");
    expect(read.path).toBe(HUB_LICENSES_PATH);
    expect(read.query).toEqual({ required: ["accountId"], optional: ["portalClientId"] });
    // Scoped secret only, query covered by the signature, legacy refused.
    expect(read.auth).toEqual({ source: "portal", scopedSecretEnv: "PORTAL_TO_HUB_SECRET", signsQuery: true, legacySecret: "refused" });

    // The site's parser accepts exactly the fields the Hub pins, no more, no fewer.
    expect(Object.keys(hubLicensesProjectionSchema.shape).sort()).toEqual([...read.responseFields].sort());
    expect(Object.keys(hubLicenseItemSchema.shape).sort()).toEqual([...read.itemFields].sort());
    expect(Object.keys(hubLicenseItemSchema.shape.seats.shape).sort()).toEqual([...read.seatFields].sort());
    expect(Object.keys(hubLicensesProjectionSchema.shape.totals.shape).sort()).toEqual([...read.totalsFields].sort());
    expect([...hubLicenseItemSchema.shape.kind.options]).toEqual(read.kinds);
    expect(read.seatSources).toEqual(["pool", "order"]);
    expect(Object.keys(read.errors).sort()).toEqual(["401", "409", "503"]);

    const sample = read.signingSample;
    expect(sample.path.startsWith(`${read.path}?accountId=`)).toBe(true);
    expect(
      signDeSyncRequest({
        method: sample.method,
        path: sample.path,
        timestamp: sample.timestamp,
        eventId: sample.eventId,
        body: sample.body,
        secret: sample.secret,
      }),
    ).toBe(sample.signature);
  });
});
