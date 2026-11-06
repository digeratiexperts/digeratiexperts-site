import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
import { HUB_LICENSES_CONTRACT, HUB_LICENSES_PATH, hubLicenseItemSchema, hubLicensesProjectionSchema } from "./hubLicensesContract";
import {
  HUB_TICKETS_CONTRACT,
  HUB_TICKETS_PATH,
  HUB_TICKET_CHANNELS,
  HUB_TICKET_PRIORITIES,
  HUB_TICKET_STATUSES,
  hubTicketCreateBodySchema,
  hubTicketCreateResponseSchema,
  hubTicketGetResponseSchema,
  hubTicketListResponseSchema,
  hubTicketMessageSchema,
  hubTicketReplyBodySchema,
  hubTicketReplyResponseSchema,
  hubTicketSchema,
} from "./hubTicketsContract";
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
    portalTickets: {
      contract: string;
      direction: string;
      auth: { source: string; scopedSecretEnv: string; signsQuery: boolean; legacySecret: string };
      operations: Record<
        "create" | "list" | "get" | "reply",
        { method: string; path: string; query: { required: string[]; optional: string[] }; bodyFields?: string[]; responseFields: string[]; noAccountChannels?: string[] }
      >;
      channels: string[];
      ticketFields: string[];
      messageFields: string[];
      messageFrom: string[];
      statuses: string[];
      priorities: string[];
      errors: Record<string, string>;
      signingSample: { method: string; path: string; timestamp: string; eventId: string; body: string; secret: string; signature: string };
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

  it("pins the Hub portal tickets API (reads.portalTickets, de.hub.portal-tickets/v1)", () => {
    const read = fixture.reads.portalTickets;
    expect(read.contract).toBe(HUB_TICKETS_CONTRACT);
    expect(read.direction).toBe("portal_to_hub");
    expect(read.auth).toEqual({ source: "portal", scopedSecretEnv: "PORTAL_TO_HUB_SECRET", signsQuery: true, legacySecret: "refused" });
    const ops = read.operations;
    expect([ops.create.method, ops.create.path]).toEqual(["POST", HUB_TICKETS_PATH]);
    expect([ops.list.method, ops.list.path]).toEqual(["GET", HUB_TICKETS_PATH]);
    expect([ops.get.method, ops.get.path]).toEqual(["GET", `${HUB_TICKETS_PATH}/:ticketId`]);
    expect([ops.reply.method, ops.reply.path]).toEqual(["POST", `${HUB_TICKETS_PATH}/:ticketId/replies`]);
    expect(ops.create.query.required).toEqual([]);
    expect(ops.create.noAccountChannels).toEqual(["website_widget"]);
    for (const op of [ops.list, ops.get, ops.reply]) expect(op.query.required).toEqual(["accountId"]);

    // What the site sends and parses is exactly what the Hub pins.
    expect(Object.keys(hubTicketCreateBodySchema.shape).sort()).toEqual([...ops.create.bodyFields!].sort());
    expect(Object.keys(hubTicketReplyBodySchema.shape).sort()).toEqual([...ops.reply.bodyFields!].sort());
    expect(Object.keys(hubTicketCreateResponseSchema.shape).sort()).toEqual([...ops.create.responseFields].sort());
    expect(Object.keys(hubTicketListResponseSchema.shape).sort()).toEqual([...ops.list.responseFields].sort());
    expect(Object.keys(hubTicketGetResponseSchema.shape).sort()).toEqual([...ops.get.responseFields].sort());
    expect(Object.keys(hubTicketReplyResponseSchema.shape).sort()).toEqual([...ops.reply.responseFields].sort());
    expect(Object.keys(hubTicketSchema.shape).sort()).toEqual([...read.ticketFields].sort());
    expect(Object.keys(hubTicketMessageSchema.shape).sort()).toEqual([...read.messageFields].sort());
    expect([...hubTicketMessageSchema.shape.from.options]).toEqual(read.messageFrom);
    expect([...HUB_TICKET_CHANNELS]).toEqual(read.channels);
    expect([...HUB_TICKET_STATUSES]).toEqual(read.statuses);
    expect([...HUB_TICKET_PRIORITIES]).toEqual(read.priorities);
    expect(Object.keys(read.errors).sort()).toEqual(["400", "401", "404", "409", "503"]);

    const sample = read.signingSample;
    expect(sample.path.startsWith(`${HUB_TICKETS_PATH}?accountId=`)).toBe(true);
    expect(hubTicketCreateBodySchema.safeParse(JSON.parse(sample.body)).success).toBe(true);
    expect(signDeSyncRequest(sample)).toBe(sample.signature);
  });
});
