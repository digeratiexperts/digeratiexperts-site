import { useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileLock2, Lock, Trash2, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Callout, EmptyState, Panel, Token } from "@/components/portal/ui";
import { startViewAs } from "@/components/portal/AdminModeSwitch";
import { portalGet } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import { PortalLayout } from "./PortalLayout";
import {
  CLIENT_VAULT_KINDS,
  CLIENT_VAULT_KIND_LABELS,
  CLIENT_VAULT_MAX_BYTES,
  type ClientVaultItem,
  type ClientVaultKind,
  type ClientVaultListResponse,
} from "@shared/clientVault";

/**
 * DE admin workspace for one client (Administer mode). Holds the client vault:
 * contracts, provisioning scripts, agents & apps and PII documents, encrypted
 * at rest and DE-admin only (server/portalClientVault.ts). The client never
 * sees this page or its files, including through View as.
 */

type CompanyDetail = {
  company: { id: string; companyName: string; contactEmail?: string; status?: string; serviceType?: string };
  users: Array<{ id: string; email: string; fullName: string; role: string; isActive: boolean }>;
};

class VaultError extends Error {
  constructor(public code: string | undefined, message: string, public status: number) {
    super(message);
  }
}

async function vaultFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new VaultError(body?.code, body?.error || `Request failed (${res.status})`, res.status);
  }
  return res;
}

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString();

export function AdminClientWorkspace() {
  const [, params] = useRoute("/portal/admin/clients/:id");
  const clientId = params?.id ? decodeURIComponent(params.id) : "";
  const { toast } = useToast();
  const [viewing, setViewing] = useState(false);

  const company = useQuery<CompanyDetail>({
    queryKey: ["/api/portal/admin/companies", clientId],
    queryFn: () => portalGet<CompanyDetail>(`/api/portal/admin/companies/${encodeURIComponent(clientId)}`),
    enabled: !!clientId,
  });
  const name = company.data?.company.companyName || "Client";

  const viewAs = async () => {
    setViewing(true);
    try {
      await startViewAs(clientId);
      window.location.href = "/portal/dashboard";
    } catch (e: any) {
      setViewing(false);
      toast({ title: "Could not switch", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <PortalLayout
      title={name}
      eyebrow="Administer client"
      description="DE-only workspace. Files here are encrypted, every access is logged, and the client cannot see them."
      backHref="/portal/admin/companies"
      backLabel="Companies"
      width="wide"
      actions={
        <Button variant="outline" onClick={viewAs} disabled={viewing || !clientId} data-testid="button-view-as-client">
          <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
          {viewing ? "Switching…" : `View as ${name}`}
        </Button>
      }
    >
      {company.isError ? (
        <Callout tone="bad" title="Client not found">
          <Link href="/portal/admin/companies">Back to companies</Link>
        </Callout>
      ) : (
        <Tabs defaultValue="contract" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {CLIENT_VAULT_KINDS.map((k) => (
              <TabsTrigger key={k} value={k} data-testid={`tab-vault-${k}`}>
                {CLIENT_VAULT_KIND_LABELS[k].label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="activity">Access log</TabsTrigger>
          </TabsList>
          {CLIENT_VAULT_KINDS.map((k) => (
            <TabsContent key={k} value={k}>
              <VaultSection clientId={clientId} kind={k} />
            </TabsContent>
          ))}
          <TabsContent value="users">
            <Panel title="Portal users" icon={Users} flush>
              {(company.data?.users || []).length === 0 ? (
                <EmptyState compact title="No portal users yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {company.data!.users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.fullName || u.email}</p>
                        <p className="truncate text-muted-foreground">{u.email}</p>
                      </div>
                      <Token label={u.isActive ? u.role : "disabled"} tone={u.isActive ? "neutral" : "warn"} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </TabsContent>
          <TabsContent value="activity">
            <AccessLog clientId={clientId} />
          </TabsContent>
        </Tabs>
      )}
    </PortalLayout>
  );
}

function useVault(clientId: string) {
  return useQuery<ClientVaultListResponse, VaultError>({
    queryKey: ["client-vault", clientId],
    queryFn: async () =>
      (await vaultFetch(`/api/portal/admin/clients/${encodeURIComponent(clientId)}/vault`)).json(),
    enabled: !!clientId,
    retry: false,
    gcTime: 0,
  });
}

function VaultBlocked({ error }: { error: VaultError }) {
  if (error.code === "VAULT_MFA_REQUIRED") {
    return (
      <Callout tone="warn" title="Turn on MFA to open the client vault">
        Contracts, scripts and PII are locked to DE admins with MFA. <Link href="/portal/settings">Open Settings</Link>
      </Callout>
    );
  }
  if (error.code === "VAULT_NOT_CONFIGURED") {
    return (
      <Callout tone="warn" title="The vault is not configured on this server">
        Set VAULT_ENCRYPTION_KEY (32+ random characters) in the server environment and restart. Nothing is stored until it
        is set.
      </Callout>
    );
  }
  return <Callout tone="bad" title="The vault is unavailable">{error.message}</Callout>;
}

function VaultSection({ clientId, kind }: { clientId: string; kind: ClientVaultKind }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const vault = useVault(clientId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const meta = CLIENT_VAULT_KIND_LABELS[kind];

  if (vault.error) return <VaultBlocked error={vault.error} />;
  const items = (vault.data?.items || []).filter((i) => i.kind === kind);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > CLIENT_VAULT_MAX_BYTES) {
      toast({ title: "File too large", description: `Limit is ${fmtBytes(CLIENT_VAULT_MAX_BYTES)}.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const qs = new URLSearchParams({
        kind,
        fileName: file.name,
        title: title.trim() || file.name,
        contentType: file.type || "application/octet-stream",
      });
      await vaultFetch(`/api/portal/admin/clients/${encodeURIComponent(clientId)}/vault?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      toast({ title: "Stored encrypted", description: file.name });
      await qc.invalidateQueries({ queryKey: ["client-vault", clientId] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const download = async (item: ClientVaultItem) => {
    try {
      const res = await vaultFetch(
        `/api/portal/admin/clients/${encodeURIComponent(clientId)}/vault/${encodeURIComponent(item.id)}/download`,
      );
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      void qc.invalidateQueries({ queryKey: ["client-vault", clientId] });
    } catch (e: any) {
      toast({ title: "Download refused", description: e?.message, variant: "destructive" });
    }
  };

  const remove = async (item: ClientVaultItem) => {
    if (!window.confirm(`Permanently destroy “${item.title}”? The encrypted file is deleted and cannot be recovered.`)) return;
    try {
      await vaultFetch(
        `/api/portal/admin/clients/${encodeURIComponent(clientId)}/vault/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      await qc.invalidateQueries({ queryKey: ["client-vault", clientId] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={`Add to ${meta.label.toLowerCase()}`} description={meta.hint} icon={Lock}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="sm:max-w-xs"
            maxLength={160}
          />
          <Input ref={fileRef} type="file" className="sm:max-w-sm" data-testid={`input-vault-file-${kind}`} />
          <Button onClick={upload} disabled={uploading} data-testid={`button-vault-upload-${kind}`}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {uploading ? "Encrypting…" : "Upload"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Encrypted with AES-256 before storage · up to {fmtBytes(CLIENT_VAULT_MAX_BYTES)} · DE admins with MFA only.
        </p>
      </Panel>
      <Panel title={meta.label} icon={FileLock2} flush>
        {vault.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState compact icon={FileLock2} title={`No ${meta.label.toLowerCase()} yet`} description={meta.hint} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-testid={`vault-item-${item.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.fileName} · {fmtBytes(item.sizeBytes)} · {fmtDate(item.createdAt)}
                    {item.createdByEmail ? ` · ${item.createdByEmail}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(item)} aria-label={`Download ${item.title}`}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(item)} aria-label={`Destroy ${item.title}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AccessLog({ clientId }: { clientId: string }) {
  const vault = useVault(clientId);
  if (vault.error) return <VaultBlocked error={vault.error} />;
  const rows = vault.data?.audit || [];
  return (
    <Panel title="Vault access log" description="Most recent 25 events. Every view, upload, download, delete and refusal is recorded." flush>
      {rows.length === 0 ? (
        <EmptyState compact title="No access recorded yet" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <Token label={r.action} tone={r.outcome === "ok" ? "neutral" : r.outcome === "denied" ? "warn" : "bad"} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {r.actorEmail || "unknown"}
                {r.detail ? ` · ${r.detail}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
