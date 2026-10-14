/**
 * Ticket response targets, as the public SLA page (client/src/pages/legal/SLA.tsx)
 * states them. The portal reads these so it never promises a different time.
 */
export const RESPONSE_TARGETS = {
  critical: "15 minutes",
  high: "1 hour",
  medium: "4 hours",
  low: "Next business day",
} as const;

export type ResponsePriority = keyof typeof RESPONSE_TARGETS;

/** "Critical 15 minutes · High 1 hour · Medium 4 hours · Low next business day" */
export function formatResponseTargets(separator = " · "): string {
  return (Object.entries(RESPONSE_TARGETS) as [ResponsePriority, string][])
    .map(([p, t]) => `${p[0].toUpperCase()}${p.slice(1)} ${p === "low" ? t.toLowerCase() : t}`)
    .join(separator);
}
