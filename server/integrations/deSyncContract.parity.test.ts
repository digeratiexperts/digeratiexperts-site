import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
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
};

describe("de-sync contract parity", () => {
  it("keeps the shared event list and envelope fields", () => {
    expect(fixture.version).toBe(1);
    expect([...DE_SYNC_SOURCES]).toEqual(fixture.sources);
    expect([...DE_SYNC_EVENT_TYPES]).toEqual(fixture.eventTypes);
    expect(fixture.eventTypes).toHaveLength(45);
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
});
