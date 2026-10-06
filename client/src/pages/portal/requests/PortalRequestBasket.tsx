import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout, EmptyState, Panel } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateRequests } from "@/components/portal/requests/RequestCommon";
import { ServiceRequestApiError, srApi } from "@/lib/serviceRequestsApi";
import { TYPE_LABELS, TYPE_ROUTES, type ServiceRequestRecord } from "@shared/serviceRequests";

/**
 * Request basket: requests saved with Add to Cart, submitted together. Not the
 * Store cart: no prices, no checkout, nothing shared with Store pricing.
 */
export default function PortalRequestBasket() {
  const basket = useQuery({ queryKey: ["/api/portal/service-requests/basket"], queryFn: srApi.basket });
  const invalidate = useInvalidateRequests();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<Array<{ number: string; fieldErrors: Record<string, string> }>>([]);
  const [submitted, setSubmitted] = useState<ServiceRequestRecord[] | null>(null);
  const items = basket.data?.requests ?? [];

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await srApi.cancel(id, "Removed from basket");
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove it");
    } finally {
      setBusy(null);
    }
  };

  const submitAll = async () => {
    setBusy("all");
    setError(null);
    setStale([]);
    try {
      const { requests } = await srApi.submitBasket();
      setSubmitted(requests);
      invalidate();
    } catch (e) {
      if (e instanceof ServiceRequestApiError && Array.isArray(e.body.stale)) setStale(e.body.stale as any);
      setError(e instanceof Error ? e.message : "Could not submit the basket");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PortalLayout title="Request basket" description="Requests you saved with Add to Cart. Submit them together." width="default" backHref="/portal/requests" backLabel="Service Requests">
      <div className="space-y-4">
        {submitted && (
          <Callout tone="ok" title={`${submitted.length} request${submitted.length === 1 ? "" : "s"} submitted`} role="status">
            <ul className="mt-1 space-y-0.5">
              {submitted.map((r) => (
                <li key={r.id}>
                  <Link href={`/portal/requests/${r.id}`} className="pt-num font-semibold underline">
                    {r.number}
                  </Link>{" "}
                  {TYPE_LABELS[r.type]}
                </li>
              ))}
            </ul>
          </Callout>
        )}
        {error && (
          <Callout tone="bad" title="Nothing was submitted">
            {error}
            {stale.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {stale.map((s) => (
                  <li key={s.number}>
                    {s.number}: {Object.values(s.fieldErrors).join("; ")}. Remove it and request it again.
                  </li>
                ))}
              </ul>
            )}
          </Callout>
        )}
        {basket.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : items.length === 0 ? (
          !submitted && (
            <Panel id="basket-empty" flush>
              <EmptyState
                icon={ShoppingCart}
                title="Your request basket is empty"
                description="Use Add to Cart on a request form to save several requests and submit them together."
                action={
                  <Link href="/portal/requests" className="text-sm font-semibold text-[hsl(var(--primary))] hover:underline">
                    Browse requests
                  </Link>
                }
              />
            </Panel>
          )
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <Link href={TYPE_ROUTES[r.type]} className="hover:underline">
                        {TYPE_LABELS[r.type]}
                      </Link>{" "}
                      <span className="pt-num text-sm font-normal text-muted-foreground">{r.number}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">For {r.requestedFor.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    disabled={Boolean(busy)}
                    aria-label={`Remove ${r.number} from the basket`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submitAll()}
                disabled={Boolean(busy)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy === "all" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Submit {items.length} request{items.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
