import { z } from "zod";

/**
 * The Hub's portal ticket API (de.hub.portal-tickets/v1), as the website
 * reads it. Pinned in deSyncContract.fixture.json → reads.portalTickets; the
 * Hub keeps a byte-identical copy (Intelligence-Hub
 * artifacts/api-server/src/lib/de-sync-contract.fixture.json) and the parity
 * tests on both sides fail if either drifts.
 */
export const HUB_TICKETS_CONTRACT = "de.hub.portal-tickets/v1";
export const HUB_TICKETS_PATH = "/api/webhooks/portal/tickets";

export const HUB_TICKET_CHANNELS = ["client_portal", "website_widget"] as const;
export type HubTicketChannel = (typeof HUB_TICKET_CHANNELS)[number];

export const HUB_TICKET_STATUSES = ["open", "in_progress", "pending_client", "resolved", "closed"] as const;
export const HUB_TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type HubTicketPriority = (typeof HUB_TICKET_PRIORITIES)[number];

export const hubTicketSchema = z.object({
  id: z.number().int().positive(),
  number: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(HUB_TICKET_STATUSES),
  priority: z.enum(HUB_TICKET_PRIORITIES),
  requesterEmail: z.string().nullable(),
  requesterName: z.string().nullable(),
  homeSystem: z.string(),
  deskTicketId: z.string().regex(/^\d+$/).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HubTicket = z.infer<typeof hubTicketSchema>;

export const hubTicketMessageSchema = z.object({
  id: z.number().int(),
  from: z.enum(["client", "de"]),
  authorName: z.string(),
  body: z.string(),
  at: z.string(),
});
export type HubTicketMessage = z.infer<typeof hubTicketMessageSchema>;

export const hubTicketCreateBodySchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/),
    channel: z.enum(HUB_TICKET_CHANNELS),
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(8000),
    priority: z.enum(HUB_TICKET_PRIORITIES),
    requesterEmail: z.string().email().max(254),
    requesterName: z.string().max(120).nullable().optional(),
    portalReference: z.string().max(80).nullable().optional(),
  })
  .strict();
export type HubTicketCreateBody = z.infer<typeof hubTicketCreateBodySchema>;

export const hubTicketReplyBodySchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/),
    authorName: z.string().min(1).max(120),
    authorEmail: z.string().email().max(254),
    body: z.string().min(1).max(8000),
  })
  .strict();
export type HubTicketReplyBody = z.infer<typeof hubTicketReplyBodySchema>;

export const hubTicketCreateResponseSchema = z.object({
  contract: z.literal(HUB_TICKETS_CONTRACT),
  created: z.boolean(),
  ticket: hubTicketSchema,
});

export const hubTicketListResponseSchema = z.object({
  contract: z.literal(HUB_TICKETS_CONTRACT),
  accountId: z.number().int(),
  generatedAt: z.string(),
  tickets: z.array(hubTicketSchema),
});

export const hubTicketGetResponseSchema = z.object({
  contract: z.literal(HUB_TICKETS_CONTRACT),
  ticket: hubTicketSchema,
  conversation: z.array(hubTicketMessageSchema),
});

export const hubTicketReplyResponseSchema = z.object({
  contract: z.literal(HUB_TICKETS_CONTRACT),
  ticketId: z.number().int(),
  entryId: z.number().int(),
  created: z.boolean(),
});

/** Portal priority words → the contract's four. Anything unknown is medium. */
export function hubPriorityFromPortal(priority: string | null | undefined): HubTicketPriority {
  const p = String(priority || "").trim().toLowerCase();
  if (p === "critical" || p === "urgent") return "critical";
  if (p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}
