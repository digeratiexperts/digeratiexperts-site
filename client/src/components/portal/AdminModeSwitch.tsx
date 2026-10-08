import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, ShieldCheck } from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { apiRequest } from "@/lib/queryClient";
import { resetPortalSession } from "@/components/portal/shell/portalSession";
import { cn } from "@/lib/utils";

/**
 * DE admin mode bar, shown at the top of every portal page for DE admins.
 *
 * - Administer: open a client's admin workspace (/portal/admin/clients/:id):
 *   their vault (contracts, provisioning scripts, agents & apps, PII), users
 *   and files. You stay signed in as yourself.
 * - View as: see the portal exactly as that client does (impersonation). The
 *   vault is unreachable in this mode; the server refuses it.
 *
 * Picking Administer while viewing as a client ends "View as" first.
 */

type Tenant = { id: string; companyName: string; type: "msp" | "client" };
export type AdminMode = "administer" | "view";

export const adminClientIdFromPath = (path: string): string | null => {
  const m = /^\/portal\/admin\/clients\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
};

async function stopViewAs(): Promise<void> {
  const token = localStorage.getItem("portalToken");
  const res = await fetch("/api/portal/admin/stop-impersonation", {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not leave View as");
  const data = await res.json();
  if (data?.token) localStorage.setItem("portalToken", data.token);
  localStorage.removeItem("impersonatingCompany");
  resetPortalSession();
}

export async function startViewAs(companyId: string): Promise<void> {
  const res = await apiRequest("/api/portal/admin/impersonate", "POST", { companyId });
  const data = await res.json();
  if (data?.token) localStorage.setItem("portalToken", data.token);
  localStorage.setItem("impersonatingCompany", JSON.stringify(data.company));
  resetPortalSession();
}

export function AdminModeSwitch({ viewingAs }: { viewingAs: { id?: string; companyName?: string } | null }) {
  const [location, navigate] = useLocation();
  const administeringId = adminClientIdFromPath(location);
  const [mode, setMode] = useState<AdminMode>(viewingAs ? "view" : "administer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/portal/admin/tenants"],
    queryFn: () => portalGet<{ tenants: Tenant[] }>("/api/portal/admin/tenants"),
    staleTime: 60_000,
  });
  const clients = (data?.tenants || []).filter((t) => t.type === "client");
  const selected = (mode === "view" ? viewingAs?.id : administeringId) || "";

  const go = async (clientId: string, nextMode: AdminMode = mode) => {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      if (nextMode === "administer") {
        if (viewingAs) {
          await stopViewAs();
          window.location.href = `/portal/admin/clients/${encodeURIComponent(clientId)}`;
          return;
        }
        navigate(`/portal/admin/clients/${encodeURIComponent(clientId)}`);
      } else {
        if (viewingAs?.id === clientId) return;
        await startViewAs(clientId);
        window.location.href = "/portal/dashboard";
        return;
      }
    } catch (e: any) {
      setError(e?.message || "Could not switch");
    } finally {
      setBusy(false);
    }
  };

  const pick = (next: AdminMode) => {
    setMode(next);
    // Switching modes on the client already in focus acts at once.
    const focus = viewingAs?.id || administeringId;
    if (focus && (next === "administer" ? viewingAs : !viewingAs)) void go(focus, next);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-[hsl(var(--pt-topbar))] px-3 py-2 text-sm md:px-5"
      data-testid="admin-mode-switch"
    >
      <div role="radiogroup" aria-label="Admin mode" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {([
          { id: "administer", label: "Administer", icon: ShieldCheck },
          { id: "view", label: "View as", icon: Eye },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            disabled={busy}
            onClick={() => pick(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              mode === id ? "bg-de-magenta text-white" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`admin-mode-${id}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="admin-mode-client">
        Client
      </label>
      <select
        id="admin-mode-client"
        value={selected}
        disabled={busy}
        onChange={(e) => void go(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-foreground sm:max-w-xs"
        data-testid="admin-mode-client"
      >
        <option value="">{mode === "view" ? "View the portal as…" : "Administer a client…"}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </select>
      {busy && <span className="text-xs text-muted-foreground">Switching…</span>}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
