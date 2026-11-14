import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
import { HUB_TICKETS_PATH } from "./hubTicketsContract";
import {
  HUB_SECURE_FIELDS_CONTRACT,
  HUB_SECURE_FIELDS_PATH,
  HUB_SECURE_FIELD_DEFAULT_TTL_HOURS,
  HUB_SECURE_FIELD_KINDS,
  HUB_SECURE_FIELD_MAX_TTL_HOURS,
  HUB_SECURE_FIELD_STATUSES,
  HUB_SECURE_FIELD_SUBMITTERS,
  HUB_SECURE_FIELD_VALUE_KEY,
  hubSecureFieldCreateBodySchema,
  hubSecureFieldCreateResponseSchema,
  hubSecureFieldListResponseSchema,
  hubSecureFieldSchema,
} from "./hubSecureFieldsContract";

/**
 * reads.portalSecureFields (de.hub.portal-secure-fields/v1, Intelligence-Hub
 * #1179 slice 2). The Hub keeps a byte-identical fixture and its own test
 * (routes/__tests__/portal-secure-fields.contract.test.ts).
 */
type Op = { method: string; path: string; query: { required: string[]; optional: string[] }; bodyFields?: string[]; responseFields: string[]; noAccountSubmitters?: string[] };
const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "deSyncContract.fixture.json"), "utf8")) as {
  reads: {
    portalSecureFields: {
      contract: string;
      direction: string;
      auth: { source: string; scopedSecretEnv: string; signsQuery: boolean; legacySecret: string };
      operations: Record<string, Op>;
      metadataFields: string[];
      submittedByFields: string[];
      submitters: string[];
      kinds: string[];
      statuses: string[];
      ttlHours: { default: number; max: number };
      valueField: string;
      valueReturned: string;
      reveal: string;
      errors: Record<string, string>;
      signingSample: { method: string; path: string; timestamp: string; eventId: string; body: string; secret: string; signature: string };
    };
  };
};

describe("de-sync contract parity: Hub secure fields", () => {
  const read = fixture.reads.portalSecureFields;

  it("pins the routes, auth and vocabularies the website uses", () => {
    expect(read.contract).toBe(HUB_SECURE_FIELDS_CONTRACT);
    expect(read.direction).toBe("portal_to_hub");
    expect(read.auth).toEqual({ source: "portal", scopedSecretEnv: "PORTAL_TO_HUB_SECRET", signsQuery: true, legacySecret: "refused" });
    expect(HUB_SECURE_FIELDS_PATH.startsWith(`${HUB_TICKETS_PATH}/`)).toBe(true);
    expect(Object.keys(read.operations).sort()).toEqual(["create", "list"]);
    expect([read.operations.list.method, read.operations.list.path]).toEqual(["GET", HUB_SECURE_FIELDS_PATH]);
    expect([read.operations.create.method, read.operations.create.path]).toEqual(["POST", HUB_SECURE_FIELDS_PATH]);
    expect(read.operations.list.query.required).toEqual(["accountId"]);
    expect(read.operations.create.query.required).toEqual([]);
    expect(read.operations.create.noAccountSubmitters).toEqual(["client"]);
    expect(Object.keys(hubSecureFieldCreateBodySchema.shape).sort()).toEqual([...read.operations.create.bodyFields!].sort());
    expect(Object.keys(hubSecureFieldListResponseSchema.shape).sort()).toEqual([...read.operations.list.responseFields].sort());
    expect(Object.keys(hubSecureFieldCreateResponseSchema.shape).sort()).toEqual([...read.operations.create.responseFields].sort());
    expect(Object.keys(hubSecureFieldSchema.shape).sort()).toEqual([...read.metadataFields].sort());
    expect(Object.keys(hubSecureFieldSchema.shape.submittedBy.shape)).toEqual(read.submittedByFields);
    expect([...HUB_SECURE_FIELD_SUBMITTERS]).toEqual(read.submitters);
    expect([...HUB_SECURE_FIELD_KINDS]).toEqual(read.kinds);
    expect([...HUB_SECURE_FIELD_STATUSES]).toEqual(read.statuses);
    expect(read.ttlHours).toEqual({ default: HUB_SECURE_FIELD_DEFAULT_TTL_HOURS, max: HUB_SECURE_FIELD_MAX_TTL_HOURS });
    expect(read.valueField).toBe(HUB_SECURE_FIELD_VALUE_KEY);
    expect(Object.keys(read.errors).sort()).toEqual(["400", "401", "404", "409", "422", "503"]);
  });

  it("never returns a value and has no reveal on the bridge", () => {
    expect(read.valueReturned).toBe("never");
    expect(read.reveal).toBe("hub_staff_only");
    expect(read.metadataFields).not.toContain(HUB_SECURE_FIELD_VALUE_KEY);
    expect(Object.keys(hubSecureFieldSchema.shape)).not.toContain(HUB_SECURE_FIELD_VALUE_KEY);
  });

  it("signs the same canonical string the Hub verifies, with a placeholder value", () => {
    const s = read.signingSample;
    expect(s.path).toMatch(/^\/api\/webhooks\/portal\/tickets\/\d+\/secure-fields\?accountId=/);
    const body = JSON.parse(s.body);
    expect(hubSecureFieldCreateBodySchema.safeParse(body).success).toBe(true);
    expect(String(body.secretValue)).toMatch(/^fake-placeholder/);
    expect(signDeSyncRequest(s)).toBe(s.signature);
  });
});
