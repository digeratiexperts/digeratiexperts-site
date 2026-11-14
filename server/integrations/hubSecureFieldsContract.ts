import { z } from "zod";

/**
 * DE Desk secure fields on the Hub ticket (Intelligence-Hub #1179), as the
 * website reads them: contract de.hub.portal-secure-fields/v1, pinned in
 * deSyncContract.fixture.json -> reads.portalSecureFields. The Hub keeps a
 * byte-identical copy (artifacts/api-server/src/lib/de-sync-contract.fixture.json)
 * and the parity tests on both sides fail if either drifts.
 *
 * The Hub is the source of truth: the website never stores a value. It sends
 * one to the Hub (encrypted there) and reads back metadata only. There is no
 * reveal on this bridge: the portal webhook is signed per account, not per
 * staff user, so a reveal (which must name a verified person) happens on the
 * Hub ticket only.
 */
export const HUB_SECURE_FIELDS_CONTRACT = "de.hub.portal-secure-fields/v1";
export const HUB_SECURE_FIELDS_PATH = "/api/webhooks/portal/tickets/:ticketId/secure-fields";

export function hubSecureFieldsPath(ticketId: number): string {
  return HUB_SECURE_FIELDS_PATH.replace(":ticketId", String(ticketId));
}

/** Hub slice 1 vocabulary (lib/db/src/schema/desk-secrets.ts). */
export const HUB_SECURE_FIELD_KINDS = ["password", "wifi", "license_key", "api_key", "pin", "other"] as const;
export type HubSecureFieldKind = (typeof HUB_SECURE_FIELD_KINDS)[number];
export const HUB_SECURE_FIELD_SUBMITTERS = ["client", "de_staff"] as const;
export type HubSecureFieldSubmitter = (typeof HUB_SECURE_FIELD_SUBMITTERS)[number];
export const HUB_SECURE_FIELD_STATUSES = ["active", "expired"] as const;
export const HUB_SECURE_FIELD_DEFAULT_TTL_HOURS = 168;
export const HUB_SECURE_FIELD_MAX_TTL_HOURS = 720;
export const HUB_SECURE_FIELD_MAX_VALUE_LENGTH = 4096;
/** The one body key that carries a value. Never logged, never returned. */
export const HUB_SECURE_FIELD_VALUE_KEY = "secretValue";

export const hubSecureFieldSchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  label: z.string(),
  kind: z.enum(HUB_SECURE_FIELD_KINDS),
  status: z.enum(HUB_SECURE_FIELD_STATUSES),
  submittedBy: z.object({ kind: z.enum(["staff", "client"]), name: z.string() }),
  expiresAt: z.string(),
  expiredAt: z.string().nullable(),
  revealCount: z.number().int(),
  lastRevealedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type HubSecureField = z.infer<typeof hubSecureFieldSchema>;

export const hubSecureFieldCreateBodySchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    kind: z.enum(HUB_SECURE_FIELD_KINDS).optional(),
    secretValue: z.string().min(1).max(HUB_SECURE_FIELD_MAX_VALUE_LENGTH),
    ttlHours: z.number().int().min(1).max(HUB_SECURE_FIELD_MAX_TTL_HOURS).optional(),
    submittedBy: z.enum(HUB_SECURE_FIELD_SUBMITTERS),
    authorName: z.string().trim().min(1).max(120),
  })
  .strict();
export type HubSecureFieldCreateBody = z.infer<typeof hubSecureFieldCreateBodySchema>;

export const hubSecureFieldListResponseSchema = z.object({
  contract: z.literal(HUB_SECURE_FIELDS_CONTRACT),
  ticketId: z.number().int(),
  secureFields: z.array(hubSecureFieldSchema),
});

export const hubSecureFieldCreateResponseSchema = z.object({
  contract: z.literal(HUB_SECURE_FIELDS_CONTRACT),
  ticketId: z.number().int(),
  secureField: hubSecureFieldSchema,
});
