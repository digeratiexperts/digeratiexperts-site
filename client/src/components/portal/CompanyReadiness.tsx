import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { startViewAs } from "./AdminModeSwitch";
import { usePortalSession } from "./shell/portalSession";

type Tenant = { id: string; companyName: string; type: "msp" | "client" };

/**
 * Lets a DE admin pick the company right here instead of detouring through
 * Manage Companies -> View Portal -> back button (Joe, 2026-10-23). Opening
 * the company reloads this same page, so the form fills in place.
 */
export function CompanyPicker() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenants = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/portal/admin/tenants"],
    queryFn: () => portalGet<{ tenants: Tenant[] }>("/api/portal/admin/tenants"),
    staleTime: 60_000,
  });
  const clients = (tenants.data?.tenants ?? []).filter((t) => t.type === "client");

  const open = async (companyId: string) => {
    if (!companyId) return;
    setBusy(true);
    setError(null);
    try {
      await startViewAs(companyId);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that company");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor="company-picker" className="text-sm font-medium text-foreground">
        Company
      </label>
      <select
        id="company-picker"
        defaultValue=""
        disabled={busy || tenants.isPending}
        onChange={(e) => void open(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-foreground sm:max-w-xs"
        data-testid="company-picker"
      >
        <option value="">{tenants.isPending ? "Loading companies…" : "Choose a company…"}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </select>
      {busy && <span className="text-xs text-muted-foreground" role="status">Opening…</span>}
      {(error || tenants.isError) && (
        <span role="alert" className="text-xs text-destructive">
          {error || "Companies couldn't be loaded."}{" "}
          <Link href="/portal/admin/companies" className="font-semibold underline">Manage Companies</Link>
        </span>
      )}
    </div>
  );
}

/** A failed/unfinished lookup must never appear as an empty company or policy. */
export function CompanyReadiness({ loading, error, missing, unavailable, onRetry }: {
  loading?: boolean;
  error?: unknown;
  missing?: boolean;
  unavailable?: boolean;
  onRetry?: () => unknown;
}) {
  const admin = usePortalSession().user?.role === "admin";
  if (loading) return <Callout tone="info" title="Loading company details" className="mb-4" role="status">Please wait before submitting a request.</Callout>;
  if (!error && !missing && !unavailable) return null;
  if (admin && missing) {
    return <Callout tone="warn" title="Choose a company to continue" className="mb-4">
      Pick the company this is for. The page reloads with that company's people, sites and licence options.
      <CompanyPicker />
    </Callout>;
  }
  return <Callout tone={missing ? "warn" : "bad"} title={unavailable ? "Company record unavailable" : missing ? "Your account needs a company" : "Company details couldn't be loaded"} className="mb-4"
    action={onRetry && !missing ? <Button variant="outline" size="sm" onClick={() => void onRetry()}>Retry</Button> : undefined}>
    {unavailable ? "The selected company record is no longer available. Check the company assignment with DE." : missing ? "A company must be linked before you can use its services." : "The company lookup did not complete. Retry, or check your company selection."}{" "}
    {admin ? <Link href="/portal/admin/companies" className="font-semibold underline">Choose a company</Link> : <Link href="/portal/tickets/create" className="font-semibold underline">Contact support</Link>}
  </Callout>;
}
