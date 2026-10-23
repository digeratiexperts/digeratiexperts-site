import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, ShieldCheck, Users } from "lucide-react";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { Panel } from "@/components/portal/ui/Panel";
import { Token } from "@/components/portal/ui/PortalStatus";
import { EmptyState } from "@/components/portal/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  CLIENT_ROLES,
  ENTITLEMENT_KEYS,
  type ClientRole,
  type EntitlementKey,
} from "@shared/permissions";

/**
 * DE staff manage a company's purchased-service entitlements and its users'
 * client hats (lane A). Entitlements are OFF for every company until one is
 * granted here, and a hat is never granted without an explicit row.
 */

const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  cloud_edge: "Secure access",
  voice: "Business phone",
  security_awareness: "Security training",
};

const CLIENT_ROLE_LABELS: Record<ClientRole, string> = {
  standard: "Standard",
  approver: "Approver",
  client_admin: "Client admin",
  billing: "Billing",
  purchaser: "Purchaser",
  owner: "Owner",
};

type EntitlementsResponse = {
  entitlements: Array<{ entitlement: EntitlementKey; status: string }>;
  held: EntitlementKey[];
};

type ClientRolesResponse = {
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    clientRoles: ClientRole[];
  }>;
};

const chipClass =
  "rounded-[3px] border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function StatusNote({ tone, text }: { tone: "ok" | "neutral" | "warn"; text: string }) {
  return (
    <p className={cn("text-xs", tone === "warn" ? "text-destructive" : "text-muted-foreground")} role="status">
      {text}
    </p>
  );
}

export function CompanyAccessPanel({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const entQuery = useQuery<EntitlementsResponse>({
    queryKey: ["/api/portal/admin/companies", companyId, "entitlements"],
    queryFn: () => portalGet<EntitlementsResponse>(`/api/portal/admin/companies/${companyId}/entitlements`),
  });

  const rolesQuery = useQuery<ClientRolesResponse>({
    queryKey: ["/api/portal/admin/companies", companyId, "client-roles"],
    queryFn: () => portalGet<ClientRolesResponse>(`/api/portal/admin/companies/${companyId}/client-roles`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies", companyId, "entitlements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies", companyId, "client-roles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/me"] });
  };

  const setEntitlement = useMutation({
    mutationFn: (input: { entitlement: EntitlementKey; status: "active" | "ended" }) =>
      portalFetch(`/api/portal/admin/companies/${companyId}/entitlements`, {
        method: "PUT",
        body: JSON.stringify(input),
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not save");
        return res.json();
      }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const setClientRoles = useMutation({
    mutationFn: (input: { userId: string; clientRoles: ClientRole[] }) =>
      portalFetch(`/api/portal/admin/companies/${companyId}/client-roles`, {
        method: "PUT",
        body: JSON.stringify(input),
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not save");
        return res.json();
      }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const held = entQuery.data?.held ?? [];
  const users = rolesQuery.data?.users ?? [];

  return (
    <>
      <Panel id="company-entitlements" title="Service entitlements" flush>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Nothing is shown to client users until the service is granted here.
          </p>
        </div>
        {entQuery.isLoading ? (
          <p className="flex items-center gap-2 px-4 pb-4 text-xs text-muted-foreground" role="status">
            <Loader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading entitlements…
          </p>
        ) : entQuery.isError ? (
          <div className="px-4 pb-4">
            <StatusNote tone="warn" text="Could not load entitlements. Try again." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {ENTITLEMENT_KEYS.map((key) => {
              const isHeld = held.includes(key);
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {ENTITLEMENT_LABELS[key]}
                  </span>
                  <span className="flex items-center gap-2">
                    <Token
                      label={isHeld ? "Granted" : "Not granted"}
                      tone={isHeld ? "ok" : "neutral"}
                      dot
                    />
                    <button
                      type="button"
                      className={cn(chipClass, "border-border bg-card hover:bg-accent/50")}
                      disabled={setEntitlement.isPending}
                      data-testid={`toggle-entitlement-${key}`}
                      onClick={() =>
                        setEntitlement.mutate({ entitlement: key, status: isHeld ? "ended" : "active" })
                      }
                    >
                      {isHeld ? "End" : "Grant"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel id="company-client-roles" title="Client roles" flush>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Hats decide what each user sees in the client menu. Every user is at least Standard.
          </p>
        </div>
        {rolesQuery.isLoading ? (
          <p className="flex items-center gap-2 px-4 pb-4 text-xs text-muted-foreground" role="status">
            <Loader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading users…
          </p>
        ) : rolesQuery.isError ? (
          <div className="px-4 pb-4">
            <StatusNote tone="warn" text="Could not load users. Try again." />
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState compact icon={Users} title="No users yet" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li key={user.id} className="px-4 py-3" data-testid={`client-roles-${user.id}`}>
                <p className="truncate text-sm font-medium">{user.fullName || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn(chipClass, "border-border bg-muted/50 text-muted-foreground")}>
                    {CLIENT_ROLE_LABELS.standard}
                  </span>
                  {CLIENT_ROLES.filter((role) => role !== "standard").map((role) => {
                    const active = user.clientRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                          chipClass,
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-accent/50",
                        )}
                        disabled={setClientRoles.isPending}
                        data-testid={`toggle-role-${user.id}-${role}`}
                        onClick={() => {
                          const next = active
                            ? user.clientRoles.filter((r) => r !== role)
                            : [...user.clientRoles, role];
                          setClientRoles.mutate({ userId: user.id, clientRoles: next });
                        }}
                      >
                        {CLIENT_ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <div className="px-4 pb-4">
            <StatusNote tone="warn" text={error} />
          </div>
        )}
      </Panel>
    </>
  );
}
