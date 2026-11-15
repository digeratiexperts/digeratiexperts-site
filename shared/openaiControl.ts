import { z } from "zod";

/** Safe admin projection. Never include credentials or arbitrary provider URLs. */
export const openAIControlResponseSchema = z.object({
  success: z.literal(true),
  status: z.object({
    enabled: z.boolean(),
    configured: z.boolean(),
    persistence: z.literal("process"),
    restartEnabled: z.boolean(),
  }).strict(),
  message: z.string(),
}).strict();

export type OpenAIControlResponse = z.infer<typeof openAIControlResponseSchema>;
export type OpenAIControlStatus = OpenAIControlResponse["status"];
