import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/portal/ui";
import { usePortalSession } from "./shell/portalSession";

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
  return <Callout tone={missing ? "warn" : "bad"} title={unavailable ? "Company record unavailable" : missing ? (admin ? "Choose a company to continue" : "Your account needs a company") : "Company details couldn't be loaded"} className="mb-4"
    action={onRetry && !missing ? <Button variant="outline" size="sm" onClick={() => void onRetry()}>Retry</Button> : undefined}>
    {unavailable ? "The selected company record is no longer available. Check the company assignment with DE." : missing ? "A company must be linked before you can use its services." : "The company lookup did not complete. Retry, or check your company selection."}{" "}
    {admin ? <Link href="/portal/admin/companies" className="font-semibold underline">Choose a company</Link> : <Link href="/portal/tickets/create" className="font-semibold underline">Contact support</Link>}
  </Callout>;
}
