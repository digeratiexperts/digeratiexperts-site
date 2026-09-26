/**
 * Copy a Hub account id onto a portal client only when a stored
 * techsales_hub mapping already has that id. Never match by company name.
 */

export function trustedHubAccountId(externalId: string | null | undefined): string | null {
  const value = externalId?.trim() ?? "";
  return /^[1-9]\d*$/.test(value) ? value : null;
}

export type HubAccountWrite =
  | { action: "set"; hubAccountId: string }
  | { action: "keep"; hubAccountId: string }
  | { action: "ignore" }
  | { action: "conflict"; existing: string; incoming: string };

/** An existing Hub account id is never replaced by a different id or a name. */
export function retainHubAccountMapping(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): HubAccountWrite {
  const next = trustedHubAccountId(incoming);
  const current = trustedHubAccountId(existing);
  if (!next) return { action: "ignore" };
  if (!current) return { action: "set", hubAccountId: next };
  if (current === next) return { action: "keep", hubAccountId: current };
  return { action: "conflict", existing: current, incoming: next };
}

export function selectBackfillUpdates(
  rows: Array<{ clientId: string; hubAccountId: string | null; externalId: string | null }>,
): Array<{ clientId: string; hubAccountId: string }> {
  const updates: Array<{ clientId: string; hubAccountId: string }> = [];
  for (const row of rows) {
    if (row.hubAccountId?.trim()) continue;
    const trusted = trustedHubAccountId(row.externalId);
    if (!trusted) continue;
    updates.push({ clientId: row.clientId, hubAccountId: trusted });
  }
  return updates;
}
