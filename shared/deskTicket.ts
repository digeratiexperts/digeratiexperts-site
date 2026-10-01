import { z } from "zod";

/** Public Desk boundary: validate without coercing objects into visitor text. */
export const deskTicketSchema = z.object({
  email: z.string().trim().max(254).email(),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  // The public support form uses Critical; Desk's equivalent is Urgent.
  priority: z.enum(["Low", "Medium", "High", "Urgent", "Critical"])
    .default("Medium").transform(value => value === "Critical" ? "Urgent" : value),
  name: z.string().trim().max(200).optional(),
  sessionId: z.string().trim().max(200).optional(),
});
