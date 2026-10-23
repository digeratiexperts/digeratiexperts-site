/**
 * Client vault contract shared by the server (server/portalClientVault.ts) and
 * the DE admin workspace (client/src/pages/portal/AdminClientWorkspace.tsx).
 * The vault is DE-admin only; nothing in the client portal reads it.
 */

export const CLIENT_VAULT_KINDS = ["contract", "script", "agent", "pii"] as const;
export type ClientVaultKind = (typeof CLIENT_VAULT_KINDS)[number];

/** Upload cap per file (bytes). Agent installers above this go through the vendor's own link. */
export const CLIENT_VAULT_MAX_BYTES = 50 * 1024 * 1024;

export const CLIENT_VAULT_KIND_LABELS: Record<ClientVaultKind, { label: string; hint: string }> = {
  contract: { label: "Contracts", hint: "Signed agreements, SOWs, amendments" },
  script: { label: "Provisioning scripts", hint: "PowerShell, Bash and RMM scripts for this client" },
  agent: { label: "Agents & apps", hint: "Vendor agent installers and client-specific apps" },
  pii: { label: "PII documents", hint: "Identity, HR and other personal data" },
};

export type ClientVaultItem = {
  id: string;
  clientId: string;
  kind: ClientVaultKind;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  notes: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

export type ClientVaultAuditEntry = {
  action: "list" | "upload" | "download" | "delete";
  outcome: "ok" | "denied" | "error";
  itemId?: string | null;
  detail?: string | null;
  actorEmail?: string | null;
  at: string;
};

export type ClientVaultListResponse = {
  items: ClientVaultItem[];
  audit: ClientVaultAuditEntry[];
  /** Documents the client's business type needs (from its starter kit), with on-file status. */
  requirements?: ClientVaultRequirementStatus[];
};

/**
 * A document the client should have in the vault, added by a business-type
 * starter kit (shared/starterKits.ts). It counts as on file once a vault item
 * of the same kind has the same title (case and spacing ignored).
 */
export type ClientVaultRequirement = {
  id: string;
  clientId: string;
  kind: ClientVaultKind;
  title: string;
  hint: string | null;
  /** Where it came from, e.g. "kit:regulated". */
  source: string;
  createdAt: string;
};

export type ClientVaultRequirementStatus = ClientVaultRequirement & { onFile: boolean };

const normTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

export function requirementStatus(
  requirements: ClientVaultRequirement[],
  items: Array<Pick<ClientVaultItem, "kind" | "title">>,
): ClientVaultRequirementStatus[] {
  const onFile = new Set(items.map((i) => `${i.kind}|${normTitle(i.title)}`));
  return requirements.map((r) => ({ ...r, onFile: onFile.has(`${r.kind}|${normTitle(r.title)}`) }));
}

export const sameRequirementTitle = (a: string, b: string) => normTitle(a) === normTitle(b);
