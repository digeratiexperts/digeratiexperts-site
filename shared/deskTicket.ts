import { z } from "zod";

/** Public Desk boundary: validate without coercing objects into visitor text. */
export const deskTicketSchema = z.object({
  email: z.string().trim().max(254).email(),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  name: z.string().trim().max(200).optional(),
  sessionId: z.string().trim().max(200).optional(),
});
