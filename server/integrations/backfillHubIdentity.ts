/**
 * Copy a Hub account id onto a portal client only when a stored
 * techsales_hub mapping already has that id. Never match by company name.
 */

export function trustedHubAccountId(externalId: string | null | undefined): string | null {
  const value = externalId?.trim() ?? "";
  return /^[1-9]\d*$/.test(value) ? value : null;
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
